import React from 'react';
import { useSnackbar } from 'notistack';

import { createNewGroup } from '../../util/AVAGroups';

import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';

import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloseIcon from '@material-ui/icons/ExitToApp';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import CircularProgress from '@material-ui/core/CircularProgress';

import AVATextInput from '../forms/AVATextInput';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  page: {
    height: 800,
  },
  formControl: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingTop: 3,
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  titleText: {
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small'
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.primary[theme.palette.type],
  },
  greenButton: {
    variant: 'outlined',
    backgroundColor: 'green',
  },
  resetButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
    marginLeft: 10,
    paddingLeft: 10,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  listItemAVALight: {
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'light'
  },
  listItemAVABold: {
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  rightEdgeSmall: {
    fontSize: theme.typography.fontSize * 0.8,
    justifyContent: 'right',
    textTransform: 'capitalize'
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

export default ({ pSession, groupsManagedObject, focusAt, onCancel, onSelect, onRefresh }) => {
  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');
  const [promptForName, setPromptForName] = React.useState(false);

  function calcMinimumGroupLevel() {
    let response = 99;
    Object.keys(groupsManagedObject).forEach((listEntry) => {
      if (groupsManagedObject[listEntry].level &&(groupsManagedObject[listEntry].level < response)) {
        response = groupsManagedObject[listEntry].level;
      }
    });
    return response;
  }
  const [minimumGroupLevel, ] = React.useState(calcMinimumGroupLevel() - 1);

  /*
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [reactData, setReactData] = React.useState({
    hideChildren: {},
    hiding: false,
    hidingLevel: 0
  });
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };
  */
  const autoFocus = (element) => element?.focus();

  var rowsDisplayed;

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar } = useSnackbar();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
    setLowerFilter(event.target.value.toLowerCase());
  };

  function OKtoShow(inObj) {
    if (!lower_activity_filter) { return true; }
    if (inObj.hasOwnProperty('group_name')) {
      if (inObj.group_name.toLowerCase().includes(lower_activity_filter)) {
        return true;
      }
    }
    return (inObj.group_id.toLowerCase().includes(lower_activity_filter));
  };

  // **************************

  return (
    <Dialog
      // open={forceRedisplay || true}
      open={true}
      fullWidth
      variant={'elevation'} elevation={2}
    >
      {Object.keys(groupsManagedObject).length === 0
        ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Typography className={classes.formControl} variant='h5' >
            {'Building the Group List'}
          </Typography>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </div>
        </Box>
        :
        <React.Fragment>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            <Typography
              className={classes.title}
              style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
              id='scroll-dialog-title'
            >
              {'Select a group from this list'}
            </Typography>

            <TextField
              id='List Filter'
              value={activity_filter}
              className={classes.freeInput}
              onChange={handleChangeActivityFilter}
              helperText={'Filter'}
              inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
              FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
              variant={'standard'}
              autoComplete='off'
            />
          </Box>
          <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
            <List component='nav'>
              <Typography
                key={'hidden_row'}
                className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsDisplayed = 0}
              </Typography>
              {Object.keys(groupsManagedObject).map((listEntry, listIndex) => (
                (OKtoShow(groupsManagedObject[listEntry]) &&
                  <React.Fragment key={`frag_${listIndex}`}>
                    <Typography
                      key={`counter_row_${listIndex}`}
                      className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsDisplayed++}
                    </Typography>
                    <ListItem
                      key={`activity-list_${listIndex}_${((listIndex === focusAt) ? 'selected' : '')}`}
                      ref={(listIndex === focusAt) ? autoFocus : null}
                      style={(listIndex === focusAt) ? { backgroundColor: 'lightBlue', margin: { bottom: 1.5 } } : { margin: { bottom: 1.5 } }}
                      onClick={() => {
                        onSelect(listEntry, listIndex);
                      }}
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        enqueueSnackbar(`Group ID = ${listEntry}`, { variant: 'info', persist: true });
                      }}
                      button
                    >
                      <Box
                        key={`g_box_${listIndex}_${(listIndex === focusAt) ? 'selected' : ''}`}
                        display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
                        <Typography
                          key={`g_text_${listIndex}_${(listIndex === focusAt) ? 'selected' : ''}`}
                          style={AVATextStyle({
                            size: 1.5,
                            margin: { left: (groupsManagedObject[listEntry].level ? (groupsManagedObject[listEntry].level - minimumGroupLevel) - 1 : 0) },
                            weight: (groupsManagedObject[listEntry].role === 'member' ? null
                              : (groupsManagedObject[listEntry].role === 'non-member' ? 'light' : 'bold'))
                          })}>
                          {groupsManagedObject[listEntry].group_name}
                        </Typography>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                )
              ))
              }
              {promptForName &&
                <AVATextInput
                  promptText="Enter a Name for the Group you're creating"
                  buttonText='Create'
                  onCancel={() => { setPromptForName(false); }}
                  onSave={async (newGroupName) => {
                    setPromptForName(false);
                    const newGroupID = await createNewGroup({
                      client_id: pSession.client_id,
                      group_name: newGroupName,
                      adminList: pSession.patient_id,
                      memberList: []
                    });
                    onRefresh({
                      newGroupID,
                      newGroupName
                    });
                  }}
                />
              }
              {!promptForName && (rowsDisplayed === 0) &&
                <Box display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
                  <Typography
                    key={`g_text_end`}
                    style={AVATextStyle({
                      size: 1.5,
                      margin: { bottom: 1 },
                    })}>
                    {!lower_activity_filter ? 'This Group has no members' : 'No members match that filter'}
                  </Typography>
                </Box>
              }
            </List>
          </Paper>
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
        {pSession?.adminAccount &&
          <Button
            onClick={() => {
              setPromptForName(true);
            }}
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            startIcon={<GroupAddIcon fontSize="small" />}
          >
            {`New Group`}
          </Button>
        }
      </DialogActions>
    </Dialog>
  );
};
