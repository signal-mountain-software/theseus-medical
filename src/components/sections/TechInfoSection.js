import React from 'react';
import { Box, Typography, Switch, Checkbox } from '@material-ui/core/';
import { getPerson } from '../../util/AVAPeople';
import { titleCase } from '../../util/AVAUtilities';
import DeleteIcon from '@material-ui/icons/Delete';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';

import useSession from '../../hooks/useSession';

import TextField from '@material-ui/core/TextField';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, ogValues, errorList, reactData, setError, updateField, updateReactData, onClose }) => {

  const { state } = useSession();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [familyCheckConfirmOpen, setFamilyCheckConfirmOpen] = React.useState(false);
  const [familyCheckMessage, setFamilyCheckMessage] = React.useState('');
  const [canProceedWithDelete, setCanProceedWithDelete] = React.useState(false);
  const { dbClient } = require('../../util/AVAUtilities');

  const handleDeleteAccount = async () => {
    try {
      const person_id = currentValues.peopleRec.person_id;
      const peopleRec = currentValues.peopleRec;

      // Check if this person has a family_id
      if (peopleRec.family_groups && peopleRec.family_groups.length > 0) {
        peopleRec.family_groups.forEach(async (family_id) => {
          if (family_id) {
            try {
              // Get the FamilyGroups record with this family_id
              const familyResult = await dbClient.query({
                KeyConditionExpression: 'family_id = :f',
                ExpressionAttributeValues: { ':f': family_id },
                TableName: 'FamilyGroups',
                IndexName: 'family_id-index'
              }).promise();

              if (familyResult.Items && familyResult.Items.length > 0) {
                const familyRec = familyResult.Items[0];

                // Check if this person is the primary contact
                if (familyRec.primary_contact && familyRec.primary_contact.id === person_id) {
                  setFamilyCheckMessage(
                    `Cannot delete this account. ${familyRec.primary_contact.name} is the primary contact for the family. Please designate a new primary contact or delete the entire family group.`
                  );
                  setCanProceedWithDelete(false);
                  setFamilyCheckConfirmOpen(true);
                  return;
                }

                // Check if this person is in other_members
                if (familyRec.other_members && Array.isArray(familyRec.other_members) && familyRec.other_members.some(m => m.id === person_id)) {
                  familyRec.other_members = familyRec.other_members.filter(m => m.id !== person_id);
                  await dbClient.update({
                    TableName: 'FamilyGroups',
                    Key: {
                      client_id: state.session.client_id,
                      composite_key: familyResult.Items[0].family_id
                    },
                    UpdateExpression: 'set other_members = :om',
                    ExpressionAttributeValues: {
                      ':om': familyRec.other_members
                    }
                  }).promise();
                  return;
                }
              }
            } catch (error) {
              console.error('Error checking FamilyGroups:', error);
              // Continue with deletion if family check fails
            }
          }
        });
      }

      // No family issues, proceed with deletion
      await proceedWithAccountDeletion(person_id);
    } catch (error) {
      console.error('Error in handleDeleteAccount:', error);
      alert(`Failed to delete account: ${error.message}`);
    }
  };

  const proceedWithAccountDeletion = async (person_id) => {
    try {
      // Delete from People table
      await dbClient.delete({
        TableName: 'People',
        Key: { person_id }
      }).promise();

      // Delete from SessionsV2 table
      await dbClient.delete({
        TableName: 'SessionsV2',
        Key: { session_id: person_id }
      }).promise();

      // Delete all PeopleGroups rows for this person (any status, any group)
      const pgResult = await dbClient.query({
        TableName: 'PeopleGroups',
        IndexName: 'person-index',
        KeyConditionExpression: 'person_id = :p',
        ExpressionAttributeValues: { ':p': person_id }
      }).promise().catch(err => { console.error('Error querying PeopleGroups for deletion:', err); return null; });
      if (pgResult?.Items?.length > 0) {
        await Promise.all(pgResult.Items.map(row =>
          dbClient.delete({
            TableName: 'PeopleGroups',
            Key: { client_group_id: row.client_group_id, person_id: row.person_id }
          }).promise().catch(err => { console.error('Error deleting PeopleGroups row:', err); })
        ));
      }

      setDeleteConfirmOpen(false);
      setFamilyCheckConfirmOpen(false);
      console.log(`Account ${person_id} deleted successfully`);

      // Close PeopleMaintenance dialog
      if (onClose) {
        onClose({ accountDeleted: true, person_id });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(`Failed to delete account: ${error.message}`);
    }
  };

  let search_words = [
    titleCase(reactData.current.peopleRec.name.first),
    titleCase(reactData.current.peopleRec.name.last),
    reactData.current.peopleRec.name.first.toLowerCase(),
    reactData.current.peopleRec.name.last.toLowerCase(),
    reactData.current.peopleRec.contact_info?.cell?.number
      ? reactData.current.peopleRec.contact_info.cell.number.slice(-10)
      : (reactData.current.peopleRec.messaging?.sms ? reactData.current.peopleRec.messaging.sms.slice(-10) : ' ')
  ];

  if (!reactData.current.peopleRec.search_data) {
    reactData.current.peopleRec.search_data = search_words.join(' ');
  }
  else {
    for (let this_word of search_words) {
      if (!reactData.current.peopleRec.search_data.includes(this_word)) {
        reactData.current.peopleRec.search_data += ' ' + this_word;
      }
    }
  }

  function filteredPerson(pID, pName = { last: '*No Name*', first: '*No Name*' }) {
    if (!pName.first) { pName.first = '*No First Name*'; }
    if (!pName.last) { pName.last = '*No Last Name*'; }
    return (
      (
        (currentValues.sessionRec
          && currentValues.sessionRec.responsible_for
          && currentValues.sessionRec.responsible_for.includes(pID))
        ||
        (
          reactData.proxyFilter
          &&
          (pName.last.toLowerCase().includes(reactData.proxyFilter) || pName.first.toLowerCase().includes(reactData.proxyFilter))
        )
      )
      && (pID !== currentValues.sessionRec?.session_id)
    );
  }

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
          disabled={!!(ogValues?.peopleRec?.person_id || reactData?.has_been_saved)}
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


        <Box display='flex' alignItems='center'
          justifyContent='flex-start' flexDirection='row'>
          <TextField
            style={{ minWidth: '80%', marginTop: '12px' }}
            multiline
            id='search_data'
            autoComplete='off'
            key={`techSection__search_data__${currentValues.peopleRec.person_id}__${errorList.hasOwnProperty('search_data') ? 'error' : 'ok'}`}
            defaultValue={currentValues.peopleRec.search_data.replace(/undefined/g, '') || ''}
            onBlur={async (event) => {
              let updateObj = {
                updateList:
                  [{
                    tableName: 'peopleRec',
                    fieldName: 'search_data',
                    newData: event.target.value.replace(/undefined/g, '')
                  }]
              };
              await updateField(updateObj);
            }
            }
            helperText={'Search Data'}
          />
        </Box>

        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1.5 } })}
          >
            {`I may assume the identity of...`}
          </Typography>
          <Box display='flex' alignItems='center'
            justifyContent='flex-start' flexDirection='row'>
            <TextField
              style={{ minWidth: '80%', marginTop: '0', marginLeft: '12px' }}
              multiline
              id='search_data'
              autoComplete='off'
              key={`techSection__search_data__${currentValues.peopleRec.person_id}__${errorList.hasOwnProperty('search_data') ? 'error' : 'ok'}`}
              defaultValue={reactData.proxyFilter || ''}
              onChange={(event) => {
                if (event.target.value.length < 2) {
                  updateReactData({ proxyFilter: false }, true);
                }
                else {
                  updateReactData({ proxyFilter: event.target.value.toLowerCase() }, true);
                }
              }
              }
              helperText={'Search the directory by name'}
            />
          </Box>

          <Box
            display='flex'
            flexDirection='row'
            marginLeft={1}
            marginTop={-0}
            flexWrap={'wrap'}
          >
            {state.accessList?.[state.session.client_id]?.list?.map((this_candidate, tIndex) => (
              filteredPerson(this_candidate.person_id, this_candidate.name) &&
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
                  checked={currentValues.sessionRec.responsible_for.includes(this_candidate.person_id)}
                  onClick={async () => {
                    if (!currentValues.sessionRec.responsible_for.includes(this_candidate.person_id)) {
                      currentValues.sessionRec.responsible_for.push(this_candidate.person_id);
                    }
                    else {
                      currentValues.sessionRec.responsible_for = currentValues.sessionRec.responsible_for.filter(this_person => {
                        return (this_person !== this_candidate.person_id);
                      });
                    }
                    await updateField({
                      updateList:
                        [{
                          tableName: 'sessionRec',
                          fieldName: 'responsible_for',
                          newData: currentValues.sessionRec.responsible_for
                        }]
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
                <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.4 } })} >
                  {`${this_candidate.name.first} ${this_candidate.name.last}`}
                </Typography>
              </Box>
            ))}
          </Box>
        </React.Fragment>

        {reactData.administrative_account &&
          <React.Fragment>
            <Box
              display="flex"
              pt={2}
              flexDirection='column'
              justifyContent="center"
            >
              <Typography
                style={AVATextStyle({ margin: { top: 1 } })}
              >
                {'Inactive Account'}
              </Typography>
              <Box flexGrow={2} display='flex' alignItems='center'
                justifyContent='flex-start' marginBottom={1} flexDirection='row'>
                <Typography
                  style={AVATextStyle({
                    size: 0.8, margin: { right: 0.8 },
                    bold: !currentValues.peopleRec.inactive_account
                  })}
                >
                  {'No'}
                </Typography>
                <Switch
                  checked={currentValues.peopleRec.inactive_account}
                  onClick={async (event) => {
                    const newValue = !currentValues.peopleRec.inactive_account;
                    let updateObj = {
                      updateList: [{
                        tableName: 'peopleRec',
                        fieldName: 'inactive_account',
                        newData: newValue
                      }]
                    };
                    await updateField(updateObj);
                  }}
                  name="InactiveAccount"
                  color="primary"
                />
                <Typography
                  style={AVATextStyle({
                    size: 0.8, margin: { left: 0.8 },
                    bold: currentValues.peopleRec.inactive_account
                  })}
                >
                  {'Yes'}
                </Typography>
              </Box>
            </Box>

            <Box
              display="flex"
              paddingRight={2}
              flexDirection='row'
              justifyContent="flex-end"
              alignItems="center"
            >
              <IconButton
                onClick={() => setDeleteConfirmOpen(true)}
                color="secondary"
                title="Delete Account"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </React.Fragment>
        }



      </Box>



      {/* Family Check Confirmation Dialog */}
      <Dialog
        open={familyCheckConfirmOpen}
        onClose={() => setFamilyCheckConfirmOpen(false)}
        PaperProps={{
          style: {
            borderRadius: '30px'
          }
        }}
      >
        <DialogTitle style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Family Group Conflict
        </DialogTitle>
        <DialogContent style={{ padding: '16px 24px' }}>
          <Typography>
            {familyCheckMessage}
          </Typography>
        </DialogContent>
        <DialogActions style={{
          justifyContent: 'center',
          padding: '16px 24px',
          gap: '16px'
        }}>
          <Button
            onClick={() => {
              setFamilyCheckConfirmOpen(false);
              setCanProceedWithDelete(false);
            }}
            color="primary"
            variant="outlined"
          >
            {canProceedWithDelete ? 'No, cancel' : 'OK'}
          </Button>
          {canProceedWithDelete && (
            <Button
              onClick={async () => {
                const person_id = currentValues.peopleRec.person_id;
                try {
                  // Remove this person from the family's other_members array
                  const familyResult = await dbClient.query({
                    KeyConditionExpression: 'family_id = :f',
                    ExpressionAttributeValues: { ':f': currentValues.peopleRec.family_id },
                    TableName: 'FamilyGroups',
                    IndexName: 'family_id-index'
                  }).promise();

                  if (familyResult.Items && familyResult.Items.length > 0) {
                    const familyRec = familyResult.Items[0];
                    // Remove this person from other_members
                    if (familyRec.other_members && Array.isArray(familyRec.other_members)) {
                      const updatedOtherMembers = familyRec.other_members.filter(m => m.id !== person_id);
                      // Update the FamilyGroups record with the primary key (client_id and composite_key)
                      await dbClient.update({
                        TableName: 'FamilyGroups',
                        Key: {
                          client_id: state.session.client_id,
                          composite_key: familyRec.composite_key || familyRec.family_id
                        },
                        UpdateExpression: 'set other_members = :om',
                        ExpressionAttributeValues: {
                          ':om': updatedOtherMembers
                        }
                      }).promise();
                    }
                  }
                } catch (error) {
                  console.error('Error updating FamilyGroups:', error);
                }
                // Proceed with account deletion
                await proceedWithAccountDeletion(person_id);
              }}
              color="secondary"
              variant="contained"
              style={{ backgroundColor: '#ff5252', color: 'white' }}
            >
              Yes, proceed with delete
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          style: {
            borderRadius: '30px'
          }
        }}
      >
        <DialogTitle style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Delete Account
        </DialogTitle>
        <DialogContent style={{ padding: '16px 24px' }}>
          <Typography>
            Are you sure you want to delete this account ({currentValues.peopleRec.person_id})?
          </Typography>
        </DialogContent>
        <DialogActions style={{
          justifyContent: 'center',
          padding: '16px 24px',
          gap: '16px'
        }}>
          <Button
            onClick={() => setDeleteConfirmOpen(false)}
            color="primary"
            variant="outlined"
          >
            No, go back
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="secondary"
            variant="contained"
            style={{ backgroundColor: '#ff5252', color: 'white' }}
          >
            Yes, delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
