import React from 'react';

import { deepCopy, isEmpty, dbClient, cl, recordExists } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, isDark } from '../../util/AVAStyles';
import { makeName } from '../../util/AVAPeople';

import useSession from '../../hooks/useSession';

import GroupProfileSection from '../sections/GroupProfileSection';
import GroupSecuritySection from '../sections/GroupSecuritySection';
import GroupHierarchySection from '../sections/GroupHierarchySection';
import GroupFormsSection from '../sections/GroupFormsSection';

import { Snackbar, Button, Avatar, Box, Dialog, Typography, Menu, MenuList, MenuItem, Paper } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
  },
  padRight: {
    marginRight: theme.spacing(2),
  },
}));

export default ({ pK, client_id, overrideValues, tableName = 'Groups', pKName = 'group_id', options = {}, onModuleClose = () => { } }) => {

  const isMounted = React.useRef(false);
  const isClosing = React.useRef(false);
  const cleanupRef = React.useRef(() => { });
  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const [reactData, setReactData] = React.useState({
    initialized: false,
    popupMenuOpen: false,
    client_id,
    isMobile: (window.window.innerWidth < 800),
    linkedPersonFilter: {},
    mode: options.mode || 'edit',
    addFamilyMember: false,
    viewFamilyMember: false,
    levelHidden: [],
    user_id: state.session.user_id,
    person_id: state.session.patient_id,
    formHistoryMode: false,
    recentlyCompletedDocs: [],
    addAccountList: [],
    groupsManagedObject: deepCopy(options.groupsManagedObject || {}),
    familyFormsObj: {},
    user_class: state.session.account_class,
    administrative_account: (['admin', 'support', 'master'].includes(state.session.account_class)),
    unsavedChanges: false,
    alert: false,
    myFormListObj: {},
    minimumGroupLevel: options.minimumGroupLevel || 0,
    myImage: '',
    image_editing: false,
    selections: [],
    showRulesQuickSearch: false,
    selectedRulesPeople: [],
    special_values: [{
      person_id: '*Caregivers*',
      groups: [],
      first: 'Caregiver(s)',
      last: 'of Addressee'
    }],
    pK: pK,
    MessagingInitialized: false,
    keyChange: false,
    membershipChange: false,
    refresh_onExit: false,
    reload_onExit: false,
    bBoardList: {},
    deletePending: false,
    spliceAt: -1,
    confirmMessage: '',
    accessList: (state.accessList && state.accessList[state.session.client_id])
      ? state.accessList[state.session.client_id].list
      : [],
    textInput: {},
    editMode: {},
    addAttachment: false,
    isError: false,
    showQuickSearch: false,
    groupsToAdd: [],
    pendingAddIconGroups: [],
    addLink: false,
    needsHeader: false,
    changesMade: false,
    components: {
      GroupProfileSection: {
        component_id: GroupProfileSection,
      },
      GroupSecuritySection: {
        component_id: GroupSecuritySection,
      },
      GroupHierarchySection: {
        component_id: GroupHierarchySection,
      },
      GroupFormsSection: {
        component_id: GroupFormsSection,
      }
    },
    og: {
      [tableName]: false,
    },
    current: {
      [tableName]: {},
    },
    errorList: {},
    options
  });

  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    if (isMounted.current) {
      setReactData((prevValues) => (Object.assign(
        prevValues,
        newData
      )));
      if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
    }
  };

  React.useEffect(() => {
    async function initialize() {
      // Get information about the Group that we are updating
      let reactUpdObj = {
        initialized: true,
        sections: [{
          section_name: 'Group Name & Profile',
          color: options?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'GroupProfileSection'
        },
        {
          section_name: 'Group Security',
          color: options?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'GroupSecuritySection'
        },
        {
          section_name: 'Parent & Children',
          color: options?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'GroupHierarchySection'
        },
        {
          section_name: 'Group Forms',
          color: options?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'GroupFormsSection'
        }]
      };

      let gRecs = await dbClient    // This retrieves the current information about the Group identified with pK (group_id in theis case)
        .get({
          TableName: tableName,
          Key: { client_id, [pKName]: reactData.pK }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading ${tableName} for ${pKName} ${reactData.pK} - error is ${error}`);
        });
      reactUpdObj.defaults = {};  // these are defaults that MUST exist, even if the retireved record does not contain them
      if (recordExists(gRecs)) {
        reactUpdObj.og = {
          [tableName]: deepCopy(
            Object.assign({},
              gRecs.Item   // record retreived from DB
            ))
        };
        reactUpdObj.current = {
          [tableName]: deepCopy(
            Object.assign({},
              reactUpdObj.defaults,  // make sure these exist
              gRecs.Item,   // record retreived from DB
              overrideValues  // any incoming values that should override the DB record
            ))
        };
        // We need to get the names that go with the Group Admins - store in reactData.admin_names for use in the GroupProfileSection
        let admin_names = [];
        for (let this_adminID of gRecs.Item.admin_list || []) {
          admin_names.push(await makeName(this_adminID) || this_adminID);
        }
        reactUpdObj.admin_names = admin_names;
      }
      else {
        return {
          response_code: 400,
          errorMessage: `AVA doesn't recognize ID ${reactData.pK} - No ${tableName} data found.`
        };
      }
      updateReactData(reactUpdObj, true);
    };


    window.addEventListener('resize', handleResize);
    function handleResize() {
      updateReactData({
        isMobile: (window.window.innerWidth < 800),
      }, true);
    }

    isMounted.current = true;
    cleanupRef.current = () => {
      isMounted.current = false;
      window.removeEventListener('resize', handleResize);
    };
    initialize();

    return () => {
      cleanupRef.current();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function buildExitResponse() {
    let responseObj = { response: {} };
   if (reactData.reload_onExit) {
      responseObj.response = { reload: true };
    }
    else if (reactData.refresh_onExit) {
      responseObj.response = { refresh: true };
    }
    else {
      if (reactData.keyChange) {
        responseObj.response.rename = reactData.keyChange;
      }
      if (reactData.membershipChange) {
        responseObj.response.membership = true;
      }
    }
    return responseObj;
  }

  function handleGoodExit({ discardChanges = false, reason = 'close' } = {}) {
    if (isClosing.current) { return; }
    isClosing.current = true;

    cleanupRef.current();

    const responseObj = discardChanges ? { response: {} } : buildExitResponse();
    responseObj.reason = reason;
    onModuleClose(responseObj);
  }

  function renderSection(componentName) {
    const SectionToRender = reactData.components[componentName].component_id;
    return (
      <SectionToRender
        currentValues={reactData.current}
        ogValues={reactData.og}
        errorList={reactData.errorList}
        setError={(errorList) => {
          for (let errorObj of [errorList].flat()) {
            const { errorField, isError } = errorObj;
            if (!isError) {
              delete reactData.errorList[errorField];
            }
            else {
              reactData.errorList[errorField] = errorObj;
            }
          }
          updateReactData({
            errorList: reactData.errorList,
          }, true);
        }}
        updateField={async ({ updateList, errorObj, reactUpd }) => {
          if (reactData.mode !== 'view') {
            let reactUpdObj = {
              unsavedChanges: true,
              current: reactData.current,
            };
            if (reactUpd) {
              Object.assign(reactUpdObj, reactUpd);
            };
            if (errorObj) {
              reactUpdObj.errorList = reactData.errorList;
              for (let errorItem of [errorObj].flat()) {
                const { errorField, isError } = errorItem;
                if (!isError) {
                  delete reactUpdObj.errorList[errorField];
                }
                else {
                  reactUpdObj.errorList[errorField] = errorItem;
                }
              }
            }
            for (let this_update of [updateList].flat()) {
              if (this_update) {
                const { tableName, fieldName, newData, keyChange, refresh_onExit } = this_update;   // fieldName as <custom_key>.customization_value...
                let result = resolve(reactData.current[tableName], fieldName.split('.'), newData);
                reactUpdObj.current[tableName] = result;
                if (keyChange) {
                  reactUpdObj.keyChange = newData;
                }
                if (refresh_onExit) {
                  reactUpdObj.refresh_onExit = true;
                }
              }
            }
            updateReactData(reactUpdObj, true);
          }
        }}
        reactData={reactData}
        updateReactData={(newData, force) => {
          updateReactData(newData, force);
        }}
      />);
  }

  const resolve = (object, key, value) => {
    const this_key = key.shift();
    if (key.length === 0) {
      object[this_key] = value;
      return object;
    }
    else if (!object.hasOwnProperty(this_key)) {
      let resolvedObj = resolve({}, key, value);
      object[this_key] = resolvedObj;
      return object;
    }
    else if (isEmpty(object)) {
      let resolvedObj = resolve({}, key, value);
      object = resolvedObj;
      return object;
    }
    else {
      let resolvedObj = resolve(object[this_key], key, value);
      object[this_key] = resolvedObj;
      return object;
    }
  };

  const warning_unsavedChanges = () => {
    updateReactData({
      alert: {
        severity: 'warning',
        title: 'Changes are Pending',
        message: `There are unsaved changes.  Exit anyway?`,
        action: [
          {
            text: `Keep editing`,
            function: () => {
              updateReactData({
                alert: false
              }, true);
            }
          },
          {
            text: `Exit`,
            function: () => {
              handleGoodExit({ discardChanges: true, reason: 'discard' });
            }
          }
        ]
      }
    }, true);
  };

  const saveChanges = async () => {
    // validation
    let errorsExist = false;
    if (JSON.stringify(reactData.og[tableName]) !== JSON.stringify(reactData.current[tableName])) {
      // error evaluation goes here - if errors are found, update the errorList with the appropriate error objects and set errorsExist to true
      if (errorsExist) {
        // alert error messages here
      }
      else {
        await dbClient
          .put({
            TableName: tableName,
            Item: reactData.current[tableName]
          })
          .promise()
          .catch(error => {
            console.log(`caught error putting to ${tableName}; error is:`, error);
            return false;
          });
        reactData.og[tableName] = deepCopy(reactData.current[tableName]);
      }
    }
    // add any new groups to the database
    for (let newGroup of reactData.groupsToAdd) {
      reactData.reload_onExit = true;  // if we are adding new groups, we need to do a full reload on exit to update the group list in the GroupHierarchySection
      await dbClient.put({
        TableName: 'Groups',
        Item: newGroup
      })
        .promise()
        .catch(error => {
          console.log(`caught error putting to Groups; error is:`, error);
          return false;
        });
    }

    updateReactData({
      unsavedChanges: false,
      groupsToAdd: [],
      pendingAddIconGroups: [],
      reload_onExit: reactData.reload_onExit,
      og: reactData.og,
      current: reactData.current
    }, true);

    return true;
  };

  return (
    reactData.initialized &&
    <Dialog
      open={(true || refreshTrigger)}
      maxWidth={false}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
      onClose={() => {
        if (reactData.unsavedChanges) {
          warning_unsavedChanges();
        }
        else {
          handleGoodExit({ reason: 'dialog_close' });
        }
      }}
    >
      <Box
        display='flex' flexDirection='row'
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '32px',
          marginBottom: '32px',
          marginLeft: '16px',
          marginRight: '16px',
        }}
        key={'topBox'}
      >
        <Box
          display='flex' flexDirection='row'
          flexGrow={1}
          style={{
            alignItems: 'center',
          }}
          key={'personBox'}
        >
          <Avatar className={AVAClass.AVAAvatar} src={reactData.myImage} alt={reactData.client_id} />
          <Typography
            key={`groupName`}
            style={AVATextStyle({
              size: 1.8,
              bold: true,
              margin: {
                left: 1.5
              }
            })}>
            {reactData.current?.Groups.name || state.session.client_name || `Group ${pK}`}
          </Typography>
        </Box>
        {/* Logo and Pop-up Menu */}
        <Box
          display='flex'
          ml={2}
          overflow='auto'
          flexDirection='column'
        >
          <Avatar className={AVAClass.AVAAvatar}
            alt=''
            src={process.env.REACT_APP_AVA_LOGO}
            ml={2}
            mr={2}
            aria-controls='hidden-menu'
            aria-haspopup='true'
            onClick={(event) => {
              updateReactData({
                anchorEl: event.currentTarget,
                popupMenuOpen: true
              }, true);
            }}
          />

        </Box>
        <Menu
          id='hidden-menu'
          anchorEl={reactData.anchorEl}
          open={reactData.popupMenuOpen}
          classes={{ paper: classes.clientPopUp }}
          onClose={() => {
            updateReactData({
              popupMenuOpen: false
            }, true);
          }}
          keepMounted>
          <MenuList className={classes.popUpMenu}>
            <MenuItem>
              <Box
                display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                key={'vRowRefresh'}
                style={AVATextStyle({ size: 0.8 })}
              >
                <Typography style={AVATextStyle({ size: 0.8 })}>
                  {`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
                </Typography>
                <Typography style={AVATextStyle({ size: 0.8 })}>
                  {`User ${state.session.user_id}${state.session.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}
                </Typography>
              </Box>
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>

      <Paper component={Box}
        key={`section_frame`} variant='outlined' overflow={'auto'}
      >
        {reactData.sections.map((this_section, sectionNdx) => (
          (this_section.isAuthorized &&
            <Box
              key={`frag__${sectionNdx}`}
            >
              <Box
                display='flex'
                ml={2} mr={2} mt={'8px'}
                key={`sectionRow__${sectionNdx}`}
                style={{
                  borderRadius: (this_section.isOpen ? '30px 30px 0px 0px' : '30px 30px 30px 30px'),
                  marginBottom: (this_section.isOpen ? 0 : '8px'),
                  backgroundColor: this_section.color,
                  textDecoration: 'none',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  opacity: 1
                }}
                borderTop={1}
                borderLeft={1}
                borderRight={1}
                borderBottom={!this_section.isOpen ? 1 : 0}
                justifyContent='center'
                flexDirection='column'
                minHeight={80}
                onClick={async () => {
                  reactData.sections[sectionNdx].isOpen = !reactData.sections[sectionNdx].isOpen;
                  updateReactData({
                    sections: reactData.sections
                  }, true);
                }}
              >
                <Typography
                  style={AVATextStyle({ size: 1.5, bold: true, align: 'center', color: (isDark(this_section.color) ? 'cornsilk' : 'black') })} >
                  {this_section.section_name.trim()}
                </Typography>
              </Box>
              {this_section.isOpen &&
                <React.Fragment
                  key={`${this_section.section_name}__callFrag`}
                >
                  <Box
                    border={1}
                    ml={2} mr={2}
                  >
                    {renderSection(this_section.component_name)}
                  </Box>
                  <Box
                    display='flex'
                    border={1}
                    style={{
                      borderRadius: '0px 0px 30px 30px',
                      backgroundColor: this_section.color,
                      textDecoration: 'none'
                    }}
                    ml={2} mr={2} mb={1.5}
                    onClick={async () => {
                      reactData.sections[sectionNdx].isOpen = !reactData.sections[sectionNdx].isOpen;
                      updateReactData({
                        sections: reactData.sections
                      }, true);
                    }}
                    justifyContent='center'
                    flexDirection='column'
                    minHeight={30}
                    height={30}
                  />
                </React.Fragment>
              }
            </Box>
          )
        ))}
      </Paper>

      <Box
        display='flex'
        flexDirection='row'
        alignItems={'center'}
        marginTop={'16px'}
        marginBottom={'16px'}
        justifyContent={'space-around'}
      >
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            if (reactData.unsavedChanges) {
              warning_unsavedChanges();
            }
            else {
              handleGoodExit({ reason: 'exit_button' });
            }
          }}
        >
          {'Exit'}
        </Button>
        {reactData.unsavedChanges ?
          (isEmpty(reactData.errorList) ?
            <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
              <Button
                onClick={async () => {
                  const goodSave = await saveChanges();
                  updateReactData({
                    unsavedChanges: !goodSave
                  }, true);
                }}
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'lightcyan', color: 'black' }}
                size='small'
              >
                {reactData.isMobile ? 'Save' : 'Save/Continue'}
              </Button>
              <Button
                onClick={async () => {
                  let goodSave = await saveChanges();
                  if (goodSave) {
                    handleGoodExit({ reason: 'save_finish' });
                  }
                  else {
                    updateReactData({
                      unsavedChanges: true
                    }, true);
                  }
                }}
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                size='small'
              >
                {'Save/Finish'}
              </Button>
            </Box>
            :
            <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
              <Typography style={{ color: 'red', bold: true }}>
                {(Object.keys(reactData.errorList).length === 1)
                  ? `${reactData.errorList[Object.keys(reactData.errorList)[0]].errorMessage}`
                  : `${Object.keys(reactData.errorList).length} issues`
                }
              </Typography>
            </Box>
          )
          :
          <Box display='flex' flexDirection='column' justifyContent='flex-end' alignItems='center'>
            <Typography style={{ size: 1.2, bold: true }}>
              {`${(reactData.current.Groups.name + "'s").replace("s's", "s'")} Group Specifications`}
            </Typography>
            {(reactData.mode === 'view') &&
              <Typography style={{ size: 1.2, bold: true }}>
                {`** View only **`}
              </Typography>
            }
            {(reactData.mode === 'view') &&
              <Typography style={{ marginTop: 0, size: 1 }}>
                {`No Changes allowed`}
              </Typography>
            }
          </Box>
        }
      </Box>

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
    </Dialog >
  );
};
