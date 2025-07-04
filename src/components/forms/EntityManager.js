import React from 'react';

import useSession from '../../hooks/useSession';

import { dbClient, cl } from '../../util/AVAUtilities';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import CloseIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  myImageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginTop: '16px',
    marginRight: theme.spacing(1),
    borderRadius: '25px'
  },
  peopleBox: {
    paddingTop: 0,
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'column'
  },
  peopleBoxWithSpace: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'row'
  },
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    height: '100%',
    overflow: 'hidden'
  },
  dragNamesFirst: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    marginBottom: '-10px'
  },
  dragNamesLast: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    fontWeight: 'bold',
    marginBottom: '-10px'
  },
  assignment_avatar: {
    marginTop: 0,
    marginBottom: 0,
    height: 40,
    width: 40,
    paddingTop: 0,
    fontSize: '1.2rem',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
}));

export default ({ defaults, onCancel }) => {

  const { state } = useSession();

  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: 1,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    // from defaults
    agendaView: defaults.agendaView,
    allowAssign: defaults.allowAssign,
    assignmentList: defaults.assignmentList,
    assignmentView: defaults.assignmentView,
    viewOnly: defaults.viewOnly,

    // general keys
    client_id: state.session.client_id,
    parentObj: {},
    entityObj: {},
    hierarchy: false,
    orphans: {},
    build_version: 0,

    // previous keys
    anchorEl: null,
    building: 'not started',
    defaults,
    denseView: false,
    display_name: state.patient?.name?.first || 'My',
    event_being_edited: false,
    filterTextLower: null,
    groupID: '',
    groupName: '',
    groupRec: {},
    groupRole: '',
    groupsManagedObject: [],
    groupMemberList: [],
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
    loading: false,
    needRef: false,
    newGroups: {},
    popUpOpen: false,
    progressMessage: 'Building Group List',
    pWidth: 60,
    rowLimit: 50,
    selectDate: null,
    selectedPerson_id: null,
    selectedPersonRec: false,
    selectedPersonFirstName: '',
    selectedPersonLastName: '',
    showGroupSelect: false,
    showQuickSearch: false,
    selectedGroup_id: null,
    selectedGroupRec: false,
    selectedGroupMembers: false,
    updatesMade: false,
    viewPeopleMaintenance: false
  });
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
  };


  function handleResize() {
    updateReactData({
      window_width: Math.min(((window.window.innerWidth - 220) / 1400), 1),
    }, true);
  }

  /*
  const placeholderImage =
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/ademo.jpg';

  
  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };
  */

  // const autoFocus = (element) => element?.focus();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
    setLowerFilter(event.target.value.toLowerCase());
  };

  function OKtoShow(inObj) {
    if (!lower_activity_filter) { return true; }
    if (inObj.hasOwnProperty('entity_name')) {
      if (inObj.entity_name.toLowerCase().includes(lower_activity_filter)) {
        return true;
      }
    }
    return (inObj.group_id.toLowerCase().includes(lower_activity_filter));
  };

  function buildHierarchy(entity_id) {
    if (!reactData.parentObj[entity_id] || (reactData.parentObj[entity_id].length === 0)) {
      return [];
    }
    let hierarchy = [{
      level: 0,
      entity_id,
      entity_name: reactData.entityObj[entity_id].entity_name,
      ownership_percentage: 0
    }];
    getMyChildren({ entity_id, current_level: 0, hierarchy, parentObj: reactData.parentObj, entityObj: reactData.entityObj});
    updateReactData({
      hierarchy,
      build_version: new Date().getTime(),
      selectedEntity_id: entity_id
    }, true);
  }

  function getMyChildren({ entity_id, current_level, hierarchy, parentObj, entityObj }) {
    if (!parentObj[entity_id] || (parentObj[entity_id].length === 0)) {
      return;
    }
    let this_level = current_level + 1;
    for (let my_child of parentObj[entity_id]) {
      hierarchy.push({
        level: this_level,
        entity_id: my_child.child_entity_id,
        entity_name: entityObj[my_child.child_entity_id].entity_name,
        ownership_percentage: my_child.child_entity_id.percent_share || my_child.child_entity_id.number_of_shares
      });
      getMyChildren({ entity_id: my_child.child_entity_id, current_level: this_level, hierarchy, parentObj, entityObj });
    }
  }

  async function initialize() {
    let parentObj = {};
    let entityObj = {};
    let orphans = {};
    let eRecs = await dbClient
      .query({
        TableName: 'Entities',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': reactData.client_id }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading Entities table for client ${reactData.client_id} - error is ${error}`);
      });
    for (let this_entity of eRecs.Items) {
      entityObj[this_entity.entity_id] = this_entity;
      orphans[this_entity.entity_id] = true;
    }
    let rRecs = await dbClient
      .query({
        TableName: 'Entity_Relationships',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': reactData.client_id }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading ER table for client ${reactData.client_id} - error is ${error}`);
      });
    for (let this_entity of rRecs.Items) {
      if (!parentObj.hasOwnProperty(this_entity.parent_entity_id)) {
        parentObj[this_entity.parent_entity_id] = [];
      }
      parentObj[this_entity.parent_entity_id].push(this_entity);
      delete orphans[this_entity.child_entity_id];
    }
    let hierarchy = [];
    for (let this_orphan in orphans) {
      hierarchy.push({
        level: 0,
        entity_id: this_orphan,
        entity_name: entityObj[this_orphan].entity_name,
        ownership_percentage: 0
      });
      getMyChildren({ entity_id: this_orphan, current_level: 0, hierarchy, parentObj, entityObj });
    }
    updateReactData({ parentObj, entityObj, orphans, hierarchy, build_version: new Date().getTime() }, true);
  }

  React.useEffect(() => {
    if (!reactData.hierarchy) {
      initialize();
      window.addEventListener('resize', handleResize);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  return (
    <Dialog
      open={true || refreshTrigger}
      maxWidth={false}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
    >
      {reactData.hierarchy && (reactData.hierarchy.length === 0) &&
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Typography
            style={{
              marginTop: 4,
              marginBottom: 2,
              marginLeft: 2,
              marginRight: 2,
              paddingTop: 3,
            }}
          >
            {`No Entities to show`}
          </Typography>
        </Box>
      }
      {reactData.hierarchy && (reactData.hierarchy.length > 0) &&
        <React.Fragment
          key={`leftAll_${reactData.build_version}`}
        >
          <Box style={{ borderRadius: '30px 30px 30px 30px', marginRight: '16px' }}
            key={'topRow'}
            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
          >
            <Box
              key={'topBox'}
              display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            >
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
                id='scroll-dialog-title'
              >
                {'Select an Entity from this list'}
              </Typography>
              <TextField
                style={{
                  marginLeft: '25px',
                  marginRight: '16px',
                  marginBottom: '16px',
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingBottom: '8px',
                  width: '40%',
                  verticalAlign: 'middle',
                  fontSize: 0.4,
                  minHeight: 2.8,
                }}
                id='List Filter'
                value={activity_filter}
                className={classes.freeInput}
                onChange={handleChangeActivityFilter}
                helperText={'Filter Entities'}
                inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
            <PeopleIcon
              style={{ marginRight: '32px' }}
              onClick={() => {
                updateReactData({ showQuickSearch: true }, true);
              }}
            />
          </Box>

          <Box display='flex'
            key={`leftBox_${reactData.build_version}`}
            flexDirection='row' style={{ flexGrow: 1, height: '100px' }}
          >
            {/* LEFT SIDE */}
            <Box display='flex' style={{ width: '44.5%' }}
              flexDirection='column'
              justifyContent='flex-start'
              alignItems='flex-start'
              key={`leftSide_${reactData.build_version}`}
              marginLeft={'32px'}
            >
              <Typography
                key={`g_client_name_header`}
                style={AVATextStyle({
                  size: 1.5,
                  bold: true,
                  overflow: 'visible',
                  margin: { top: 1, bottom: 1 },
                })}>
                {`${state.session.client_name} Entities`}
              </Typography>
              <Paper component={Box} elevation={0} overflow='auto' square
                style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
                key={`leftPaper_${reactData.build_version}`}
              >
                <Box display='flex' flexDirection='column'
                  justifyContent='flex-start'
                  alignItems='flex-start'
                  key={`leftPaperBox_${reactData.build_version}`}
                >
                  {reactData.hierarchy.map((listEntry, listIndex) => (
                    (OKtoShow(listEntry) &&
                      <React.Fragment key={`frag_${listIndex}_${reactData.build_version}`}>
                        <Box
                          key={`activity-list_${listIndex}_${reactData.build_version}`}
                          onClick={async () => {
                            buildHierarchy(listEntry.entity_id)                          
                          }}
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            updateReactData({
                              alert: {
                                severity: 'info',
                                title: listEntry.entity_name,
                                message: <div>
                                  Entity ID: <strong>{listEntry.entity_id}</strong></div>
                              }
                            }, true);
                          }}
                        >
                          <Typography
                            key={`g_text_${listIndex}_${reactData.build_version}`}
                            style={AVATextStyle({
                              size: 1.2,
                              color: (false ? 'orange' : null),
                              weight: (false ? 'bold' : null),
                              margin: { left: (listEntry.level ? (listEntry.level * 1.5) : 0), top: 0, bottom: 0.8 },
                            })}>
                            {listEntry.entity_name}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    )
                  ))}
                </Box>
              </Paper>
            </Box>

            {/* RIGHT SIDE */}
            {reactData.selectedEntity_id &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
                paddingLeft={'32px'}
              >
                <Box display='flex' flexDirection='row'
                  justifyContent='space-between'
                  alignItems='center'
                  style={{ width: '100%' }}
                >
                  <Box display='flex' flexDirection='row'
                    flexGrow={1}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    <Typography
                      key={`g_text_end-last_name`}
                      style={AVATextStyle({
                        size: 1.5,
                        overflow: 'visible',
                        bold: true,
                        margin: { top: 1, bottom: 1, right: 0 },
                      })}>
                      {reactData.entityObj[reactData.selectedEntity_id].entity_name}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            }
          </Box>
        </React.Fragment>
      }
      <DialogActions className={classes.buttonArea} >
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          startIcon={<CloseIcon fontSize="small" />}
          onClick={() => {
            onCancel();
          }}
        >
          {'Done'}
        </Button>
      </DialogActions>
      {reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
          onClose={() => {
            updateReactData({
              alert: false
            }, true);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            key={`alert_box`}
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                mx={1}
                overflow='auto'
                flexDirection='column'
              >
                {([reactData.alert.action].flat()).map((this_action, actionNdx) => (
                  <Button
                    key={`alert_button__${actionNdx}`}
                    className={AVAClass.AVAButton} color="inherit"
                    onClick={() => this_action.function()}
                  >
                    {this_action.text}
                  </Button>
                ))}
              </Box>
              : null
            )}
            variant='filled'
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar >
      }
    </Dialog>
  );
};
