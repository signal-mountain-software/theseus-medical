import React from 'react';

import useSession from '../../hooks/useSession';

import { deepCopy, isMobile, dbClient, recordExists } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

import { Box, Button, TextField, Typography, Checkbox } from '@material-ui/core/';

export default ({ currentValues, updateField, reactData, updateReactData }) => {

  const AVAClass = AVAclasses();

  const { state } = useSession();
  const isMounted = React.useRef(false);

  let rowsWritten = 0;

  React.useEffect(() => {
    async function initialize() {
      if (reactData.administrative_account && !reactData.accessList) {
        if (!state.accessList) {
          if (isMounted.current) {
            updateReactData({
              alert: {
                severity: 'warning',
                title: 'Still loading Account information',
                message: `AVA is still loading.  Wait just a moment and try again, please.`
              }
            }, true);
          }
        }
        else {
          updateReactData({
            accessList: deepCopy(state.accessList[state.session.client_id].list)
          }, true);
        }
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const OKtoShow = (this_person) => {
    if (this_person.person_id === currentValues.peopleRec.person_id) { return false; }
    return (
      (currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_person.person_id))
      || ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (`${this_person.last} ${this_person.first}`).toLowerCase().includes(reactData.linkedPersonFilter.lower))
    );
  };

  const number_of_proxy_accounts = () => {
    return (Object.keys(currentValues.peopleRec.proxy_allowed_from).length);
  };

  return (
    <Box
      key={`MessagePrefSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      <Box
        display='flex'
        flexDirection='column'
        alignItems={'flex-start'}
        marginTop={2}
        marginBottom={1}
      >
        {currentValues.peopleRec.myFamilyMembers &&
          (Object.keys(currentValues.peopleRec.myFamilyMembers).length > 0) &&
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`You have ${Object.keys(currentValues.peopleRec.myFamilyMembers).length} Family Member${(Object.keys(currentValues.peopleRec.myFamilyMembers).length > 1) ? 's' : ''} added`}
          </Typography>
        }
        {(!currentValues.peopleRec.myFamilyMembers ||
          (Object.keys(currentValues.peopleRec.myFamilyMembers).length === 0)) &&
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`You don't have any Family members yet.`}
          </Typography>
        }
        <Typography
          style={AVATextStyle({ margin: { top: 1 }, italic: true })}
        >
          {`You may create a new Family Member's account by tapping a button below.`}
        </Typography>
        <Typography
          style={AVATextStyle({ margin: { top: 0, bottom: 1 }, size: 0.8 })}
        >
          {`If your Family Member already has an account, ask them to add you to their Family.`}
        </Typography>
        {currentValues.peopleRec.myFamilyMembers &&
          <React.Fragment>
            <Typography className={AVAClass.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
              {rowsWritten = 0}
            </Typography>
            <Typography
              style={AVATextStyle({})}
            >
              {`Your existing Family members are:`}
            </Typography>
            {Object.keys(currentValues.peopleRec.myFamilyMembers).map((this_member, memberNdx) => (
              <Box
                display='flex'
                flexDirection='row'
                alignItems={'flex-start'}

                key={`family_${memberNdx}`}
              >
                {(currentValues.peopleRec.myFamilyMembers[this_member].type === 'Camper') &&
                  <Typography style={AVATextStyle({ margin: { top: 1, left: 1, right: -0.8 }, bold: true })}
                    onClick={async () => {
                      updateReactData({
                        viewFamilyMember: this_member
                      }, true);
                    }}
                  >
                    {`Camper ${++rowsWritten} -`}
                  </Typography>
                }
                <Typography
                  style={AVATextStyle({ margin: { top: 1, left: 1 }, bold: true })}
                  onClick={async () => {
                    updateReactData({
                      viewFamilyMember: this_member
                    }, true);
                  }}
                >
                  {`${currentValues.peopleRec.myFamilyMembers[this_member].name}`}
                </Typography>
              </Box>
            ))}
          </React.Fragment>
        }
        <Box
          display='flex'
          flexDirection='row'
          alignItems={'center'}
          key={`add_button_row`}
          style={{ marginTop: '4px', marginBottom: '4px' }}
        >
          <Button
            onClick={async () => {
              updateReactData({
                addCamper: true
              }, true);
            }}
            className={AVAClass.AVAButton}
            style={{ marginLeft: '8px', marginTop: '16px', backgroundColor: 'white', color: 'black' }}
            size='small'
          >
            {'Add a Camper'}
          </Button>
          <Button
            onClick={async () => {
              updateReactData({
                addFamilyMember: true
              }, true);
            }}
            className={AVAClass.AVAButton}
            style={{ marginLeft: '8px', marginTop: '16px', backgroundColor: 'white', color: 'black' }}
            size='small'
          >
            {'Add another Individual'}
          </Button>
        </Box>
        {reactData.addCamper &&
          <PeopleMaintenance
            person_id={null}
            initialValues={{
              color: 'turquoise',
              peopleRec: {
                account_class: 'camper',
                client_id: currentValues.peopleRec.client_id,
                proxy_allowed_from: {
                  [currentValues.peopleRec.person_id]: `${currentValues.peopleRec.name.first} ${currentValues.peopleRec.name.last}`
                },
                groups: ['new_campers', 'all_campers', 'ALL', '__top__'],
                address: currentValues.peopleRec.address
              },
              sessionRec: {
                client_id: currentValues.peopleRec.client_id
              }
            }}
            onClose={async ({ newID, newName }) => {
              let updateObj = {};
              if (newID) {
                if (!currentValues.peopleRec.myFamilyMembers) {
                  currentValues.peopleRec.myFamilyMembers = {};
                }
                currentValues.peopleRec.myFamilyMembers[newID] =
                {
                  name: newName,
                  type: 'Camper'
                };
                updateObj.updateList =
                  [{
                    tableName: 'peopleRec',
                    fieldName: 'myFamilyMembers',
                    newData: currentValues.peopleRec.myFamilyMembers
                  }];
              };
              updateObj.reactUpd = {
                addCamper: false
              };
              await updateField(updateObj);
            }}
          />
        }
        {reactData.addFamilyMember &&
          <PeopleMaintenance
            person_id={null}
            initialValues={{
              peopleRec: {
                account_class: 'family',
                client_id: currentValues.peopleRec.client_id,
                proxy_allowed_from: {
                  [currentValues.peopleRec.person_id]: `${currentValues.peopleRec.name.first} ${currentValues.peopleRec.name.last}`
                },
                groups: ['new_familyAccount', 'all_familyAccounts', 'ALL', '__top__'],
                address: currentValues.peopleRec.address
              },
              sessionRec: {
                client_id: currentValues.peopleRec.client_id
              }
            }}
            onClose={async ({ newID, newName }) => {
              let updateObj = {};
              if (newID) {
                if (!currentValues.peopleRec.myFamilyMembers) {
                  currentValues.peopleRec.myFamilyMembers = {};
                }
                currentValues.peopleRec.myFamilyMembers[newID] = {
                  name: newName,
                  type: 'Non-Camper'
                };
                updateObj.updateList =
                  [{
                    tableName: 'peopleRec',
                    fieldName: 'myFamilyMembers',
                    newData: currentValues.peopleRec.myFamilyMembers
                  }];
              };
              updateObj.reactUpd = {
                addFamilyMember: false
              };
              await updateField(updateObj);
            }}
          />
        }
        {reactData.viewFamilyMember &&
          <PeopleMaintenance
            person_id={reactData.viewFamilyMember}
            initialValues={{
              color: 'turquoise'
            }}
            onClose={async ({ newID, newName }) => {
              updateReactData({
                viewFamilyMember: false
              }, true);
            }}
          />
        }

        {(reactData.administrative_account &&
          reactData.accessList &&
          (reactData.accessList.length > number_of_proxy_accounts())) &&
          <Box flexGrow={2} display='flex' flexDirection='column'>
            <Typography
              style={AVATextStyle({ margin: { top: 3 }, italic: true })}
            >
              {`You may add existing accounts to your family`}
            </Typography>
            <Typography
              style={AVATextStyle({ margin: { top: 0.5 }, size: 0.8 })}
            >
              {`Accounts added here will be granted authority to access your account`}
            </Typography>
            {(number_of_proxy_accounts() > 0) &&
              <Typography
                style={AVATextStyle({ margin: { top: 0.5 }, size: 0.8 })}
              >
                {`You have already granted permission for ${number_of_proxy_accounts()} other account${(number_of_proxy_accounts() > 1) ? 's' : ''} to act your behalf`}
              </Typography>
            }
            <Typography
              style={AVATextStyle({ margin: { top: 0, bottom: 1 }, size: 0.8 })}
            >
              {`Use the Search line to find ${(number_of_proxy_accounts() > 0) ? 'more ' : ''}people you wish to authorize.`}
            </Typography>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <TextField
                multiline
                style={isMobile ? AVATextStyle({ width: '90%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
                key={`key_words`}
                defaultValue={reactData.linkedPersonFilter.raw || ''}
                onChange={(event) => {
                  if (event.target.value.length === 0) {
                    updateReactData({
                      linkedPersonFilter: {
                        raw: '',
                        lower: ''
                      }
                    }, true);
                  }
                  else {
                    updateReactData({
                      linkedPersonFilter: {
                        raw: event.target.value.trim(),
                        lower: event.target.value.trim().toLowerCase()
                      }
                    }, true);
                  }
                }}
                autoComplete='off'
                helperText='Name Search'
              />
            </Box>
          </Box>
        }
        {reactData.administrative_account &&
          reactData.accessList &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {reactData.accessList.map((this_item, tIndex) => (
              OKtoShow(this_item) &&
              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`select_person_opt${tIndex}`}
                style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
              >
                <Checkbox
                  aria-label={`select_person_opt${tIndex}`}
                  name={`select_person_opt${tIndex}`}
                  key={`select_person_opt${tIndex}`}
                  size='small'
                  checked={currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id)}
                  onClick={async () => {
                    if (currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id)) {
                      delete currentValues.peopleRec.proxy_allowed_from[this_item.person_id];
                    }
                    else {
                      currentValues.peopleRec.proxy_allowed_from[this_item.person_id] = `${this_item.first} ${this_item.last}`;
                    }
                    await updateField({
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'proxy_allowed_from',
                          newData: currentValues.peopleRec.proxy_allowed_from
                        }]
                    });
                    let proxyRec = await dbClient
                      .get({
                        Key: { person_id: this_item.person_id },
                        TableName: "People"
                      })
                      .promise()
                      .catch(error => {
                        console.log({ 'Error reading People': error });
                      });
                    if (recordExists(proxyRec)) {
                      let newFamilyMembers = proxyRec.Item.myFamilyMembers || {};
                      newFamilyMembers[currentValues.peopleRec.person_id] = `${currentValues.peopleRec.name.first} ${currentValues.peopleRec.name.last}`;
                      await dbClient
                        .update({
                          Key: { person_id: this_item.person_id },
                          TableName: "People",
                          UpdateExpression: 'set myFamilyMembers = :n',
                          ExpressionAttributeValues: { ':n': newFamilyMembers },
                        })
                        .promise()
                        .catch(error => {
                          console.log(`caught error updating People; error is: `, error);
                        });
                    }
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
                <Typography
                  style={AVATextStyle({ bold: currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id) })}
                >
                  {`${this_item.first} ${this_item.last}`}
                </Typography>
              </Box>
            )
            )}
          </Box>
        }
      </Box>
    </Box >
  );
};;