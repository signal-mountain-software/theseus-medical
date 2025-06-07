import React from 'react';
import { Box, Typography, Switch, Checkbox } from '@material-ui/core/';
import { getPerson } from '../../util/AVAPeople';

import TextField from '@material-ui/core/TextField';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, ogValues, errorList, reactData, setError, updateField }) => {

  return (
    <Box
      key={`techSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'>
        <TextField
          style={{ minWidth: '40%' }}
          id='person_id'
          autoComplete='off'
          key={`techSection__person_id__${currentValues.peopleRec.person_id}__${errorList.hasOwnProperty('person_id') ? 'error' : 'ok'}`}
          error={errorList.hasOwnProperty('person_id')}
          defaultValue={((errorList.hasOwnProperty('person_id')) && (errorList.person_id.errorValue))
            ? errorList.person_id.errorValue
            : currentValues.peopleRec.person_id
          }
          onBlur={async (event) => {
            let proposedID = event.target.value.trim().toLowerCase();
            if ((proposedID !== currentValues.peopleRec.person_id) || (errorList.hasOwnProperty('person_id'))) {  // id changed or previously in error?
              if (!proposedID) {
                proposedID = ogValues.peopleRec.person_id;
              }
              else if (proposedID !== ogValues.peopleRec.person_id) {    // We don't need to check the ID if you changed it back to its og value
                // check to see if that ID is available
                const person_id_exists = await getPerson(proposedID, 'validate');
                if (person_id_exists) {
                  // it DOES exist already.  This is an error
                  setError({
                    errorField: 'person_id',
                    errorValue: proposedID,
                    isError: true,
                    errorMessage: `The ID ${proposedID} is already taken.`
                  });
                  return;
                }
              }
              // all good
              // update the data
              let updateObj = {
                updateList: [{
                  tableName: 'peopleRec',
                  fieldName: 'person_id',
                  newData: proposedID
                },
                {
                  tableName: 'sessionRec',
                  fieldName: 'session_id',
                  newData: proposedID
                },
                {
                  tableName: 'sessionRec',
                  fieldName: 'user_id',
                  newData: proposedID
                }]
              };
              // clear error if one existed
              if (errorList.hasOwnProperty('person_id')) {
                updateObj.errorObj = {
                  errorField: 'person_id',
                  isError: false
                };
              }
              await updateField(updateObj);
            }
          }}
          helperText={errorList.hasOwnProperty('person_id') ? errorList.person_id.errorMessage : 'User ID'}
        />
      </Box>
      <Box
        display="flex"
        pt={2}
        flexDirection='column'
        justifyContent="center"
      >
        {!reactData.mandatory_passwords
          // Require Password 
          ? <Box
            display="flex"
            pt={2}
            flexDirection='column'
            justifyContent="center"
          >
            <Typography
              style={AVATextStyle({ margin: { top: 1 } })}
            >
              {'Require a password to log in?'}
            </Typography>
            <Box flexGrow={2} display='flex' alignItems='center'
              justifyContent='flex-start' marginBottom={1} flexDirection='row'>
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { right: 0.8 },
                  bold: !currentValues.peopleRec.requirePassword
                })}
              >
                {'Simplified Log-in'}
              </Typography>
              <Switch
                checked={currentValues.peopleRec.requirePassword}
                onClick={async (event) => {
                  const newValue = !currentValues.peopleRec.requirePassword;
                  let updateObj = {
                    updateList: [{
                      tableName: 'peopleRec',
                      fieldName: 'requirePassword',
                      newData: newValue
                    },
                    {
                      tableName: 'sessionRec',
                      fieldName: 'requirePassword',
                      newData: newValue
                    }]
                  };
                  if (newValue && (!currentValues.sessionRec.last_login || (currentValues.sessionRec.last_login.length < 5))) {
                    updateObj.errorObj = {
                      errorField: 'password',
                      errorValue: currentValues.sessionRec.last_login,
                      isError: true,
                      errorMessage: `Please enter a password that is at least 5 characters in length`
                    };
                  }
                  await updateField(updateObj);
                }}
                name="PWDrequired"
                color="primary"
              />
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { left: 0.8 },
                  bold: currentValues.peopleRec.requirePassword
                })}
              >
                {'Password Required'}
              </Typography>
            </Box>
          </Box>
          : <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${reactData.client_name} requires passwords for all accounts`}
          </Typography>
        }
        {reactData.administrative_account &&
          // Force Password change
          <Box
            display="flex"
            pt={2}
            flexDirection='column'
            justifyContent="center"
          >
            <Typography
              style={AVATextStyle({ margin: { top: 1 } })}
            >
              {'Force Password Change?'}
            </Typography>
            <Box flexGrow={2} display='flex' alignItems='center'
              justifyContent='flex-start' marginBottom={1} flexDirection='row'>
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { right: 0.8 },
                  bold: !currentValues.sessionRec.forceSetPassword
                })}
              >
                {'No'}
              </Typography>
              <Switch
                checked={currentValues.sessionRec.forceSetPassword}
                onClick={async (event) => {
                  const newValue = !currentValues.sessionRec.forceSetPassword;
                  let updateObj = {
                    updateList: [{
                      tableName: 'peopleRec',
                      fieldName: 'forceSetPassword',
                      newData: newValue
                    },
                    {
                      tableName: 'sessionRec',
                      fieldName: 'forceSetPassword',
                      newData: newValue
                    }]
                  };
                  await updateField(updateObj);
                }}
                name="ForcePWDchange"
                color="primary"
              />
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { left: 0.8 },
                  bold: currentValues.sessionRec.forceSetPassword
                })}
              >
                {'Yes'}
              </Typography>
            </Box>
          </Box>
        }
        {currentValues.peopleRec.requirePassword &&
          <Box display='flex' alignItems='center'
            justifyContent='flex-start' flexDirection='row'>
            <TextField
              style={{ minWidth: '40%' }}
              id='password'
              autoComplete='off'
              key={`techSection__password__${currentValues.peopleRec.password}__${errorList.hasOwnProperty('password') ? 'error' : 'ok'}`}
              error={errorList.hasOwnProperty('password')}
              defaultValue={((errorList.hasOwnProperty('password')) && (errorList.password.errorValue))
                ? errorList.password.errorValue
                : currentValues.sessionRec.last_login
              }
              onBlur={async (event) => {
                let proposedPass = event.target.value.trim();
                if (proposedPass.length < 5) {  // invalid password
                  if ((!proposedPass || (proposedPass.length === 0)) && ogValues.sessionRec.last_login) {
                    proposedPass = ogValues.sessionRec.last_login;
                  }
                  else {    // Don't have a good password yet
                    setError({
                      errorField: 'password',
                      errorValue: proposedPass,
                      isError: true,
                      errorMessage: `Please enter a password that is at least 5 characters in length`
                    });
                    return;
                  }
                }
                // all good
                // update the data
                let updateObj = {
                  updateList: [{
                    tableName: 'peopleRec',
                    fieldName: 'newPassword',
                    newData: proposedPass
                  },
                  {
                    tableName: 'sessionRec',
                    fieldName: 'last_login',
                    newData: proposedPass
                  },
                  {
                    tableName: 'peopleRec',
                    fieldName: 'password_change_date',
                    newData: `${makeDate(new Date()).oaDate}`
                  },
                  {
                    tableName: 'sessionRec',
                    fieldName: 'password_change_date',
                    newData: `${makeDate(new Date()).oaDate}`
                  }
                  ]
                };
                // clear error if one existed
                if (errorList.hasOwnProperty('person_id')) {
                  updateObj.errorObj = {
                    errorField: 'password',
                    isError: false
                  };
                }
                await updateField(updateObj);
              }}
              helperText={errorList.hasOwnProperty('password') ? errorList.password.errorMessage : 'Password'}
            />
          </Box>
        }
        {reactData.administrative_account &&
          <Box
            display="flex"
            pt={2}
            flexDirection='column'
            justifyContent="center"
          >
            <Typography
              style={AVATextStyle({ margin: { top: 1 } })}
            >
              {'Include Client ID on message replies'}
            </Typography>
            <Box flexGrow={2} display='flex' alignItems='center'
              justifyContent='flex-start' marginBottom={1} flexDirection='row'>
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { right: 0.8 },
                  bold: !currentValues.peopleRec.inbound_customizations.include_sender_client
                })}
              >
                {'No'}
              </Typography>
              <Switch
                checked={currentValues.peopleRec.inbound_customizations.include_sender_client}
                onClick={async (event) => {
                  const newValue = !currentValues.peopleRec.inbound_customizations.include_sender_client;
                  let updateObj = {
                    updateList: [{
                      tableName: 'peopleRec',
                      fieldName: 'inbound_customizations.include_sender_client',
                      newData: newValue
                    }]
                  };
                  await updateField(updateObj);
                }}
                name="IncludeClient"
                color="primary"
              />
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { left: 0.8 },
                  bold: currentValues.peopleRec.inbound_customizations.include_sender_client
                })}
              >
                {'Yes'}
              </Typography>
            </Box>
          </Box>
        }
        <Box
          display="flex"
          pt={2}
          flexDirection='column'
          justifyContent="center"
        >
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`Include Sender's Tag info on message replies`}
          </Typography>
          <Box flexGrow={2} display='flex' alignItems='center'
            justifyContent='flex-start' marginBottom={1} flexDirection='row'>
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { right: 0.8 },
                bold: !currentValues.peopleRec.inbound_customizations.include_sender_tag
              })}
            >
              {'No'}
            </Typography>
            <Switch
              checked={currentValues.peopleRec.inbound_customizations.include_sender_tag}
              onClick={async (event) => {
                const newValue = !currentValues.peopleRec.inbound_customizations.include_sender_tag;
                let updateObj = {
                  updateList: [{
                    tableName: 'peopleRec',
                    fieldName: 'inbound_customizations.include_sender_tag',
                    newData: newValue
                  }]
                };
                await updateField(updateObj);
              }}
              name="IncludeTag"
              color="primary"
            />
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { left: 0.8 },
                bold: currentValues.peopleRec.inbound_customizations.include_sender_tag
              })}
            >
              {'Yes'}
            </Typography>
          </Box>
        </Box>
        {reactData.administrative_account && !reactData.master_account &&
          <React.Fragment>
            <Typography
              style={AVATextStyle({ margin: { top: 1.5 } })}
            >
              {`Account Class`}
            </Typography>
            <Box
              display='flex'
              flexDirection='row'
              marginLeft={-0.5}
              marginTop={-0}
              flexWrap={'wrap'}
            >
              {[{ option: 'support', label: 'Support' },
              { option: 'admin', label: 'Admin' },
              { option: 'camper', label: 'Camper' },
              { option: 'family', label: 'Family/Other' },
              { option: '', label: 'Standard' }
              ].map((this_option, tIndex) => (
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  key={`MessagePref_option__${tIndex}`}
                  style={{ marginRight: '24px' }}
                >
                  <Checkbox
                    aria-label={`MessagePref_option__${tIndex}`}
                    name={`MessagePref_option__${tIndex}`}
                    key={`MessagePref_option__${tIndex}`}
                    size='small'
                    checked={((currentValues.peopleRec.account_class === this_option.option)
                      || (!this_option.option && !currentValues.peopleRec.account_class))
                    }
                    onClick={async () => {
                      await updateField({
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'account_class',
                            newData: this_option.option
                          }]
                      });
                    }}
                    disableRipple
                    inputProps={{ 'aria-labelledby': `message_routing_3` }}
                  />
                  <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.4 } })} >
                    {`${this_option.label}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </React.Fragment>
        }
        {reactData.master_account &&
          <React.Fragment>
            <Typography
              style={AVATextStyle({ margin: { top: 1.5 } })}
            >
              {`Account Class`}
            </Typography>
            <Box
              display='flex'
              flexDirection='row'
              marginLeft={-0.5}
              marginTop={-0}
              flexWrap={'wrap'}
            >
              {[{ option: 'master', label: 'Master' },
              { option: 'support', label: 'Support' },
              { option: 'admin', label: 'Admin' },
              { option: 'camper', label: 'Camper' },
              { option: 'family', label: 'Family/Other' },
              { option: '', label: 'Standard' }
              ].map((this_option, tIndex) => (
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  key={`MessagePref_option__${tIndex}`}
                  style={{ marginRight: '24px' }}
                >
                  <Checkbox
                    aria-label={`MessagePref_option__${tIndex}`}
                    name={`MessagePref_option__${tIndex}`}
                    key={`MessagePref_option__${tIndex}`}
                    size='small'
                    checked={((currentValues.peopleRec.account_class === this_option.option)
                      || (!this_option.option && !currentValues.peopleRec.account_class))
                    }
                    onClick={async () => {
                      await updateField({
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'account_class',
                            newData: this_option.option
                          }]
                      });
                    }}
                    disableRipple
                    inputProps={{ 'aria-labelledby': `message_routing_3` }}
                  />
                  <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.4 } })} >
                    {`${this_option.label}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </React.Fragment>
        }

        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1.5 } })}
          >
            {`Directory Option`}
          </Typography>
          <Box
            display='flex'
            flexDirection='column'
            marginLeft={-0.5}
            marginTop={-0}
            flexWrap={'wrap'}
          >
            {[{ option: 'normal', label: 'Include my info' },
            { option: 'exclude', label: 'Exclude me' },
            { option: 'alone', label: `Do not print my info with anyone else's` },
            ].map((this_option, tIndex) => (
              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`Directory_option__${tIndex}`}
                style={{ marginRight: '24px' }}
              >
                <Checkbox
                  aria-label={`Directory_option__${tIndex}`}
                  name={`Directory_option__${tIndex}`}
                  key={`Directory_option__${tIndex}`}
                  style={{paddingTop: '2px', paddingBottom: '2px'}}
                  size='small'
                  checked={((currentValues.peopleRec.directory_option === this_option.option)
                    || ((this_option.option === 'normal') && !currentValues.peopleRec.directory_option))
                  }
                  onClick={async () => {
                    await updateField({
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'directory_option',
                          newData: this_option.option
                        }]
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
                <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.4 } })} >
                  {`${this_option.label}`}
                </Typography>
              </Box>
            ))}
          </Box>
        </React.Fragment>
      </Box>
    </Box>
  );
};
