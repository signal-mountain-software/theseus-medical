import React from 'react';

import { deepCopy, isEmpty, dbClient, cl, recordExists } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, isDark } from '../../util/AVAStyles';

import useSession from '../../hooks/useSession';

import FormSectionByFormType from '../sections/FormSectionByFormType';

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

export default ({ client_id, form_id, formRec, initialValues, options = {}, onClose }) => {

  const isMounted = React.useRef(false);
  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const [reactData, setReactData] = React.useState({
    accessList: [],
    addAccountList: [],
    addAttachment: false,
    addFamilyMember: false,
    addLink: false,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    alert: false,
    bBoardList: {},
    changesMade: false,
    client_id,
    confirmMessage: '',
    deletePending: false,
    editMode: {},
    errorList: {},
    familyFormsObj: {},
    formHistoryMode: false,
    group_id: 'ALL',
    image_editing: false,
    initialized: false,
    isError: false,
    isMobile: (window.window.innerWidth < 800),
    linkedPersonFilter: {},
    MessagingInitialized: false,
    mode: options.mode || 'edit',
    myFormListObj: {},
    myImage: '',
    needsHeader: false,
    OKtoSave: false,
    options,
    popupMenuOpen: false,
    recentlyCompletedDocs: [],
    selectedForm: form_id || formRec.form_id,
    selections: [],
    showQuickSearch: false,
    spliceAt: -1,
    textInput: {},
    user_class: state.user.account_class,
    user_id: state.user.user_id,
    viewFamilyMember: false,

    components: {
      FormSectionByFormType: {
        component_id: FormSectionByFormType,
      }
    },
    og: {
      customizationRecs: false,
    },
    current: {
      customizationRecs: {},
    },
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
      let reactUpdObj = {
        initialized: true,
        sections: [{
          section_name: 'Document Management',
          color: initialValues?.color || 'lightBlue',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'FormSectionByFormType'
        }]
      };

      if (!formRec) {
        formRec = await dbClient
          .get({
            TableName: 'Forms',
            Key: {
              client_id: reactData.client_id,
              form_id: reactData.selectedForm
            }
          })
          .promise()
          .catch(error => {
            if (error.code === 'NetworkingError') {
              cl(`Security Violation or no Internet Connection`);
            }
            cl(`Error reading Form ${reactData.selectedForm} for ${reactData.client_id} - error is ${error}`);
          });
      }

      reactUpdObj.og = { formRec };
      reactUpdObj.current = {
        formRec: deepCopy(
          Object.assign({},
            reactUpdObj.og.formRec,
            initialValues
          ))
      };
      updateReactData(reactUpdObj, true);
      window.addEventListener('resize', handleResize);
    }
    function handleResize() {
      updateReactData({
        isMobile: (window.window.innerWidth < 800),
      }, true);
    }
    isMounted.current = true;
    initialize();
    return () => {
      isMounted.current = false;
      window.removeEventListener('resize', handleResize);
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
              OKtoSave: true,
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
                const { tableName, fieldName, newData } = this_update;   // fieldName as <custom_key>.customization_value...
                let result = resolve(reactData.current[tableName], fieldName.split('.'), newData);
                reactUpdObj.current[tableName] = result;
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

  const handleAbort = () => {
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
              onClose(false);
            }
          }
        ]
      }
    }, true);
  };

  const saveChanges = async () => {
    if (JSON.stringify(reactData.og.customizationRecs) !== JSON.stringify(reactData.current.customizationRecs)) {
      for (const this_key in reactData.current.customizationRecs) {
        if (JSON.stringify(reactData.og.customizationRecs[this_key]) !== JSON.stringify(reactData.current.customizationRecs[this_key])) {
          await dbClient
            .put({
              TableName: 'Customizations',
              Item: reactData.current.customizationRecs[this_key]
            })
            .promise()
            .catch(error => {
              console.log(`caught error putting to Customizations at key ${this_key}; error is:`, error);
            });
          reactData.og.customizationRecs[this_key] = deepCopy(reactData.current.customizationRecs[this_key]);
        }
      }
      updateReactData({
        OKtoSave: false,
        og: reactData.og,
        current: reactData.current
      }, true);
    }
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
        if (reactData.OKtoSave) {
          handleAbort();
        }
        else {
          onClose({
            newName: reactData.current.customizationRecs.client_name.customization_value
          });
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
            key={`personName`}
            style={AVATextStyle({
              size: 1.8,
              bold: true,
              margin: {
                left: 1.5
              }
            })}>
            {reactData.current.formRec.form_name || `Client ${reactData.form_id}`}
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
            if (reactData.OKtoSave) {
              handleAbort();
            }
            else {
              onClose({
                newName: reactData.current.customizationRecs.client_name.customization_value
              });
            }
          }}
        >
          {'Exit'}
        </Button>
        {reactData.OKtoSave ?
          (isEmpty(reactData.errorList) ?
            <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
              <Button
                onClick={async () => {
                  const result = await saveChanges();
                  updateReactData({
                    OKtoSave: !result
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
                  let result = await saveChanges();
                  if (result) {
                    onClose({
                      newName: reactData.current.customizationRecs.client_name.customization_value
                    });
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
              {reactData.current.formRec.form_name}
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
