import React from 'react';

import { deepCopy, isEmpty, dbClient, cl, recordExists } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, isDark } from '../../util/AVAStyles';

import useSession from '../../hooks/useSession';

import ClientProfileSection from '../sections/ClientProfileSection';
import ClientMessagingSection from './ClientMessagingSection';
import WeatherSection from '../sections/WeatherSection';
import GlobalMessagePreferencesSection from '../sections/GlobalMessagePreferencesSection';

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

export default ({ client_id, personRec, initialValues, options = {}, onClose }) => {

  const isMounted = React.useRef(false);
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
    user_id: state.user.user_id,
    formHistoryMode: false,
    recentlyCompletedDocs: [],
    addAccountList: [],
    familyFormsObj: {},
    user_class: state.user.account_class,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    OKtoSave: false,
    alert: false,
    myFormListObj: {},
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
    group_id: 'ALL',
    MessagingInitialized: false,
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
    addLink: false,
    needsHeader: false,
    changesMade: false,
    components: {
      ClientProfileSection: {
        component_id: ClientProfileSection,
      },
      ClientWeatherSection: {
        component_id: WeatherSection,
      },
      ClientMessagingSection: {
        component_id: ClientMessagingSection,
      },
      GlobalMessagePreferencesSection: {
        component_id: GlobalMessagePreferencesSection,
      }

    },
    og: {
      customizationRecs: false,
    },
    current: {
      customizationRecs: {},
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
      let reactUpdObj = {
        initialized: true,
        sections: [{
          section_name: 'Client Name & Profile',
          color: initialValues?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'ClientProfileSection'
        },
        {
          section_name: 'Weather',
          color: initialValues?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'ClientWeatherSection'
        },
        {
          section_name: 'Global Messaging Rules',
          color: initialValues?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'GlobalMessagePreferencesSection'
        },
        {
          section_name: 'Preferred Recipients',
          color: initialValues?.color || 'orange',
          isOpen: false,
          isAuthorized: true,
          version_id: 0,
          component_name: 'ClientMessagingSection'
        }]
      };
      // incoming client_id should tell us who we are editing here

      // there will be a Customization entry for key "editable_entries" in the global client "AVA" and in the local client_id
      // it's customization_value will be an array of Objects in the form {key: <table_key>, }

      // Client Profile fields
      //   Field                       custom_key            customization_value              data type
      //   --------                    -----------------     ---------------------------      -------------
      //   Profile
      //   Name                        client_name           <value>                          text    
      //   Logo                        logo                  <value>                          image file URL
      //   Background Image            client_style          .checkin_image                   image file URL
      //   Background Color                                  .backgroundColor                 hex color value
      //
      //   Weather
      //   Suppress                    client_weather        .suppress_on_marquee                             
      //   Latitude/Longitude                                .nws_office  .nws_x   .nws_y
      //   Place Name                                        .place_name
      //
      //   Messaging
      //   Message Targets             message_targets       .<group>                         array of objs [{name_on_menu, [{type: <group, person>, id: <person_id or group_id>}, ...]}, {}, ...]
      //   Global Rules                global_mail_rules     .time_based_rules                array of objs [{day, method, from, to}, {}, ...]

      let cRecs = await dbClient
        .query({
          TableName: 'Customizations',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': reactData.client_id }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading Cusomtizations for client ${reactData.client_id} - error is ${error}`);
        });
      reactUpdObj.og = {              // this default will be replaced in the for...of loop below if a legitimate global_mail_rules key exists
        customizationRecs: {
          global_mail_rules: {
            client_id: reactData.client_id,
            custom_key: 'global_mail_rules',
            customization_value: {}
          }
        }
      };
      if (recordExists(cRecs)) {
        for (const this_cRec of cRecs.Items) {
          switch (this_cRec.custom_key) {
            case 'client_name':
            case 'client_weather':
            case 'client_style': {
              reactUpdObj.og.customizationRecs[this_cRec.custom_key] = this_cRec;
              break;
            }
            case 'logo': {
              reactUpdObj.myImage = this_cRec.customization_value || this_cRec.icon;
              this_cRec.customization_value = reactUpdObj.myImage;
              this_cRec.icon = reactUpdObj.myImage;
              reactUpdObj.og.customizationRecs[this_cRec.custom_key] = this_cRec;
              break;
            }
            case 'global_mail_rules': {
              if (this_cRec.customization_value?.time_based_rules && (this_cRec.customization_value?.time_based_rules.length > 0)) {
                this_cRec.customization_value.time_based_rules.forEach((this_rule, ndx) => {
                  if (this_rule.method && !this_rule.methods) {
                    this_cRec.customization_value.time_based_rules[ndx].methods = [this_rule.method];
                  }
                });
              }
              else {
                this_cRec.customization_value.time_based_rules = [];
              }
              reactUpdObj.og.customizationRecs['global_mail_rules'].customization_value.time_based_rules = this_cRec.customization_value.time_based_rules;
              break;
            }
            default: {
              reactUpdObj.og.customizationRecs[this_cRec.custom_key] = this_cRec;
            }
          }
        }
        reactUpdObj.current = {
          customizationRecs: deepCopy(
            Object.assign({},
              reactUpdObj.og.customizationRecs,
              initialValues?.peopleRec
            ))
        };
      }
      else {
        return {
          response_code: 400,
          errorMessage: `AVA doesn't recognize ID ${client_id} - No Client data found.`
        };
      }
      updateReactData(reactUpdObj, true);
      window.addEventListener('resize', handleResize);
    };
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
    // validation
    let errorsExist = false;
    if (reactData.current.customizationRecs?.global_mail_rules?.customization_value?.time_based_rules
      && (reactData.current.customizationRecs.global_mail_rules.customization_value.time_based_rules.length > 0)
    ) {
      for (let check_rule of reactData.current.customizationRecs.global_mail_rules.customization_value.time_based_rules) {
        if (!check_rule.methods || (check_rule.methods.length === 0)) {
          updateReactData({
            alert: {
              severity: 'error',
              title: `Error on Rule "${check_rule.name}"`,
              message: `You didn't select any actions for this rule`,
            }
          }, false);
          errorsExist = true;
        }
        else {
          if (((check_rule.methods.includes('add_recipients') && (!check_rule.hasOwnProperty('add_recipients') || (check_rule['add_recipients'].length === 0))))
            || (check_rule.methods.includes('replace_recipients') && (!check_rule.hasOwnProperty('replace_recipients') || (check_rule['replace_recipients'].length === 0)))) {
            updateReactData({
              alert: {
                severity: 'error',
                title: `Error on Rule "${check_rule.name}"`,
                message: `When using "instead of" or "in addition to" rules, you must select at least one recipient`
              }
            }, false);
            errorsExist = true;
          }
        }
      }
    }
    if (errorsExist) {
      return false;
    }
    else {
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
            {reactData.current.customizationRecs.client_name.customization_value || `Client ${reactData.client_id}`}
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
              {`${(reactData.current.customizationRecs.client_name.customization_value + "'s").replace("s's", "s'")} Organizational Data`}
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
