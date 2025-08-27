import React from 'react';

import { deepCopy, isSmallScreen } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import QuickSearch from '../sections/QuickSearch';
import MakeMessage from '../forms/MakeMessage';
import { getPerson } from '../../util/AVAPeople';

import SendIcon from '@material-ui/icons/Send';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import { Box, Button, TextField, Typography, Checkbox } from '@material-ui/core/';

export default ({ currentValues, updateField, reactData, updateReactData }) => {

  const AVAClass = AVAclasses();

  const isMounted = React.useRef(false);

  async function getPhone(personObj) {
    if (personObj.phone) { return personObj.phone; }
    let pRec = await getPerson(personObj.id);
    if (pRec.contact_info?.cell?.number) {
      personObj.phone = pRec.contact_info.cell.number;
      return personObj.phone;
    }
    else if (pRec.messaging?.sms) {
      personObj.phone = pRec.messaging?.sms;
      return personObj.phone;
    }
    return false;
  }

  React.useEffect(() => {
    async function initialize() {
      for (let this_family of currentValues.familyRecs) {
        this_family.primary_contact.phone = await getPhone(this_family.primary_contact);
        if (this_family.other_members) {
          for (let this_member of this_family.other_members) {
            if (this_member.role !== 'view') {
              this_member.phone = await getPhone(this_member);
            }
          }
        }
      }
      let reactUpdObj = { OKtoShow_Family: true };
      if (Object.keys(reactUpdObj).length > 0) {
        updateReactData(reactUpdObj, true);
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      key={`roleSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {reactData.OKtoShow_Family ?
        <Box
          display='flex'
          flexDirection='column'
          alignItems={'flex-start'}
          marginTop={2}
          marginBottom={1}
        >
          {(currentValues.familyRecs && (currentValues.familyRecs.length > 0))
            ?
            <Typography
              style={AVATextStyle({ margin: { top: 1 } })}
            >
              {`You are a member of ${currentValues.familyRecs.length} family group${(currentValues.familyRecs.length > 1) ? 's' : ''}`}
            </Typography>
            :
            <Typography
              style={AVATextStyle({ margin: { top: 1 } })}
            >
              {`You don't have any family information stored`}
            </Typography>
          }

          {currentValues.familyRecs && currentValues.familyRecs.map((this_familyRec, fNdx) => (
            <React.Fragment
              key={`sendMessages_masterBox`}
            >







              <Box
                display='flex'
                alignItems={'center'}
                justifyContent='flex-start' flexDirection='row'
                key={`bottom_buttons`}
                style={{ marginTop: '16px' }}
              >
                <Typography
                  style={AVATextStyle({ margin: { right: 2 }, bold: true })}
                >
                  {this_familyRec.family_name}
                </Typography>
                {(reactData.administrative_account) &&
                  <SendIcon
                    key={`sendMessagesButton`}
                    style={{ height: '16px' }}
                    onClick={async () => {
                      let recipient_list = [this_familyRec.primary_contact.id];
                      let plural = '';
                      for (let this_member of this_familyRec.other_members) {
                        if (this_member.role !== 'view') {
                          recipient_list.push(this_member.id);
                          plural = 's';
                        }
                      }
                      updateReactData({
                        sendMessage: {
                          target_name: `${this_familyRec.family_name} (${recipient_list.length} recipient${plural})`,
                          target_id: recipient_list
                        }
                      }, true);
                    }}
                    size='small'
                  />
                }
              </Box>


































              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`family_primary`}
                style={AVATextStyle({ margin: { top: 1, bottom: 1 } })}
              >
                <Typography style={AVATextStyle({ margin: { left: 1 } })}
                  key={`family_${fNdx}__primary`}
                  onClick={async () => {
                    if (this_familyRec.primary_contact.id !== currentValues.peopleRec.person_id) {
                      updateReactData({
                        viewFamilyMember: this_familyRec.primary_contact.id
                      }, true);
                    }
                  }}
                >
                  {`${this_familyRec.primary_contact.name}${this_familyRec.primary_contact.nickname ? (' (' + this_familyRec.primary_contact.nickname + ')') : ''}`}
                </Typography>
                <Typography style={AVATextStyle({ color: 'red', bold: true, margin: { left: 1, right: 1 }, size: 0.8 })}
                  key={`fprimary`}
                >
                  {`Primary`}
                </Typography>
                {(reactData.administrative_account) &&
                  <React.Fragment>
                    <SendIcon
                      key={`sendMessagesButton_primary`}
                      style={{ height: '16px' }}
                      onClick={async () => {
                        let recipient_list = [this_familyRec.primary_contact.id];
                        updateReactData({
                          sendMessage: {
                            target_name: this_familyRec.primary_contact.name,
                            target_id: recipient_list
                          }
                        }, true);
                      }}
                      size='small'
                    />
                    {this_familyRec.primary_contact.phone &&
                      <a href={`tel:${this_familyRec.primary_contact.phone}`}
                        key={`callCell`}
                        style={{ height: '16px' }}
                      >
                        <PhoneInTalkIcon
                          key={`sendMessagesButton_cell`}
                          style={{ height: '16px', color: 'black' }}
                          size='small'
                        />
                      </a>
                    }
                  </React.Fragment>
                }
              </Box>
              {this_familyRec.other_members && (this_familyRec.other_members.length > 0) &&
                <Box
                  display='flex'
                  flexDirection='column'
                  alignItems={'flex-start'}
                  key={`family_header`}
                >
                  {this_familyRec.other_members.map((this_familyMember, memberNdx) => (
                    <Box
                      display='flex'
                      flexDirection='row'
                      alignItems={'center'}
                      key={`family_${memberNdx}`}
                      style={AVATextStyle({ margin: { bottom: 1 } })}
                    >
                      <Typography
                        style={AVATextStyle({ margin: { left: 1 } })}
                        key={`familymember_${memberNdx}`}
                        onClick={async () => {
                          if (this_familyMember.id !== currentValues.peopleRec.person_id) {
                            updateReactData({
                              viewFamilyMember: this_familyMember.id
                            }, true);
                          }
                        }}
                      >
                        {`${this_familyMember.name}${this_familyMember.nickname ? (' (' + this_familyMember.nickname + ')') : ''}`}
                      </Typography>
                      <Typography style={AVATextStyle({ margin: { left: 1, right: 1 }, size: 0.8 })}
                        key={`familyrole_${memberNdx}`}
                      >
                        {this_familyMember.relationship || ''}
                      </Typography>
                      {(reactData.administrative_account) && (this_familyMember.role !== 'view') &&
                        <React.Fragment>
                          <SendIcon
                            key={`sendMessagesButton_other_${memberNdx}`}
                            style={{ height: '16px' }}
                            onClick={async () => {
                              let recipient_list = [this_familyMember.id];
                              updateReactData({
                                sendMessage: {
                                  target_name: this_familyMember.name,
                                  target_id: recipient_list
                                }
                              }, true);
                            }}
                            size='small'
                          />
                          {this_familyMember.phone &&
                            <a href={`tel:${this_familyMember.phone}`}
                              key={`callCell_${memberNdx}`}
                              style={{ height: '16px' }}
                            >
                              <PhoneInTalkIcon
                                key={`sendMessagesButton_cell`}
                                style={{ height: '16px', color: 'black' }}
                                size='small'
                              />
                            </a>
                          }
                        </React.Fragment>
                      }
                    </Box>
                  ))}
                </Box>
              }
              {((reactData.user_id === this_familyRec.primary_contact.id) || (reactData.administrative_account)) &&
                <TextField
                  style={AVATextStyle({ margin: { left: 1 }, width: '80%' })}
                  key={`familyname_${fNdx}`}
                  id={`familyname_${fNdx}`}
                  autoComplete='off'
                  defaultValue={this_familyRec.family_name}
                  onBlur={async (event) => {
                    currentValues.familyRecs[fNdx].family_name = event.target.value;
                    await updateReactData({ current: currentValues, OKtoSave: true }, true);
                  }}
                  helperText={`Family Name`}
                />
              }
              <TextField
                style={AVATextStyle({ margin: { left: 1 }, width: '80%' })}
                key={`me_${fNdx}`}
                id={`me_${fNdx}`}
                autoComplete='off'
                defaultValue={reactData.myFamilyData[fNdx].nickname}
                onBlur={async (event) => {
                  if (reactData.myFamilyData[fNdx].primary) {
                    currentValues.familyRecs[fNdx].primary_contact.nickname = event.target.value;
                  }
                  else {
                    currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index].nickname = event.target.value;
                  }
                  await updateReactData({ current: currentValues, OKtoSave: true }, true);
                }}
                helperText={`${this_familyRec.family_name} calls me`}
              />
              <TextField
                style={AVATextStyle({ margin: { left: 1 }, width: '80%' })}
                key={`myRelationship_${fNdx}`}
                id={`myRelationship_${fNdx}`}
                autoComplete='off'
                defaultValue={reactData.myFamilyData[fNdx].relationship}
                onBlur={async (event) => {
                  if (reactData.myFamilyData[fNdx].primary) {
                    currentValues.familyRecs[fNdx].primary_contact.relationship = event.target.value;
                  }
                  else {
                    currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index].relationship = event.target.value;
                  }
                  await updateReactData({ current: currentValues, OKtoSave: true }, true);
                }}
                helperText={`My relationship to ${this_familyRec.family_name} is`}
              />
              <React.Fragment>
                {(reactData.myFamilyData[fNdx].primary)
                  ?
                  <Typography
                    style={AVATextStyle({ margin: { top: 1, left: 1 }, bold: true })}
                  >
                    {`I am the Primary Contact for ${this_familyRec.family_name}`}
                  </Typography>
                  :
                  <React-Fragment>
                    <Typography
                      style={AVATextStyle({ margin: { top: 1, left: 1 } })}
                    >
                      {`My role in ${this_familyRec.family_name} is`}
                    </Typography>
                    <Box
                      display='flex'
                      flexDirection='row'
                      marginLeft={'16px'}
                      marginTop={-0}
                      flexWrap={'wrap'}
                    >
                      {(((currentValues.peopleRec.person_id !== this_familyRec.primary_contact.id) &&
                        ((reactData.user_id === this_familyRec.primary_contact.id) || (reactData.administrative_account)))
                        ? [{ option: 'primary', label: 'Primary Contact' }]
                        : []).concat(
                          [
                            { option: 'alternate', label: 'Alternate Primary' },
                            { option: 'messages', label: 'Receive Family Messages and View Information' },
                            { option: 'view', label: 'View only' }
                          ]).map((this_option, tIndex) => (
                            <Box
                              display='flex'
                              flexDirection='row'
                              alignItems={'center'}
                              key={`role_option__${tIndex}`}
                              style={{ marginRight: '24px' }}
                            >
                              <Checkbox
                                aria-label={`role_option__${tIndex}`}
                                name={`role_option__${tIndex}`}
                                key={`role_option__${tIndex}`}
                                size='small'
                                checked={(currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index].role === this_option.option)}
                                onClick={async () => {
                                  if (this_option.option === 'primary') {
                                    let hold_info = deepCopy(currentValues.familyRecs[fNdx].primary_contact);
                                    currentValues.familyRecs[fNdx].primary_contact = Object.assign({}, currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index], { role: 'primary' });
                                    currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index] = Object.assign({}, hold_info, { role: 'alternate' });
                                    reactData.myFamilyData[fNdx] = Object.assign({}, currentValues.familyRecs[fNdx].primary_contact, { primary: true, other_index: null });
                                  }
                                  else {
                                    currentValues.familyRecs[fNdx].other_members[reactData.myFamilyData[fNdx].other_index].role = this_option.option;
                                    reactData.myFamilyData[fNdx].role = this_option.option;
                                  }
                                  await updateReactData({ current: currentValues, OKtoSave: true }, true);
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
                  </React-Fragment>
                }
              </React.Fragment>
              {((reactData.user_id === this_familyRec.primary_contact.id) || (reactData.administrative_account)) &&
                <Button
                  onClick={async () => {
                    let updateObj = {};
                    updateObj.reactUpd = {
                      addFamilyMember: currentValues.familyRecs[fNdx].family_id
                    };
                    await updateField(updateObj);
                  }}
                  className={AVAClass.AVAButton}
                  style={{ marginLeft: '8px', marginTop: '24px', backgroundColor: 'white', color: 'black' }}
                  size='small'
                >
                  {isSmallScreen() ? `Create new` : `Create a new account for the ${currentValues.familyRecs[fNdx].family_name}`}
                </Button>
              }
              {(reactData.administrative_account) &&
                <Button
                  onClick={async () => {
                    let updateObj = {};
                    updateObj.reactUpd = {
                      showQuickSearch: currentValues.familyRecs[fNdx].family_id
                    };
                    await updateField(updateObj);
                  }}
                  className={AVAClass.AVAButton}
                  style={{ marginLeft: '8px', marginTop: '16px', backgroundColor: 'white', color: 'black' }}
                  size='small'
                >
                  {isSmallScreen() ? `Add existing` : `Find an existing account to add to ${currentValues.familyRecs[fNdx].family_name}`}
                </Button>
              }
            </React.Fragment>
          ))}


          <Button
            onClick={async () => {
              let timestamp = new Date().getTime();
              if (!currentValues.familyRecs || (currentValues.familyRecs.length === 0)) {
                currentValues.familyRecs = [];
              }
              currentValues.familyRecs.push({
                client_id: currentValues.peopleRec.client_id,
                composite_key: `family_${timestamp}`,
                family_id: `family_${timestamp}`,
                family_name: `The ${currentValues.peopleRec.name.last} Family`,
                primary_contact: {
                  id: currentValues.peopleRec.person_id,
                  name: `${currentValues.peopleRec.name.first} ${currentValues.peopleRec.name.last}`,
                  nickname: currentValues.peopleRec.name.first,
                  relationship: 'Primary caregiver'
                }
              });
              if (!reactData.myFamilyData || (reactData.myFamilyData.length === 0)) {
                reactData.myFamilyData = [];
              }
              reactData.myFamilyData.push({
                id: currentValues.peopleRec.person_id,
                name: `${currentValues.peopleRec.name.first} ${currentValues.peopleRec.name.last}`,
                nickname: currentValues.peopleRec.name.first,
                primary: true
              });
              updateReactData({
                current: currentValues,
                myFamilyData: reactData.myFamilyData,
                OKtoSave: true
              }, true);
            }}
            className={AVAClass.AVAButton}
            style={{ marginLeft: '8px', marginTop: '32px', backgroundColor: 'green', color: 'white' }}
            size='small'
          >
            {'Create a new Family Group'}
          </Button>

          {(reactData.addFamilyMember) &&
            <PeopleMaintenance
              person_id={null}
              options={{
                mode: 'add',
                sectionToShow: ['ProfileSection']
              }}
              initialValues={{
                color: 'turquoise',
                peopleRec: {
                  client_id: currentValues.peopleRec.client_id,
                  groups: currentValues.peopleRec.groups,
                  address: currentValues.peopleRec.address,
                  family_groups: [reactData.addFamilyMember]
                },
                sessionRec: {
                  client_id: currentValues.peopleRec.client_id
                }
              }}
              onClose={async ({ newID, newName }) => {
                let updateObj = {};
                if (newID) {
                  let familyAt = currentValues.familyRecs.findIndex(this_familyRec => {
                    return (this_familyRec.family_id === reactData.addFamilyMember);
                  });
                  if (!currentValues.familyRecs[familyAt].other_members || (currentValues.familyRecs[familyAt].other_members.length === 0)) {
                    currentValues.familyRecs[familyAt].other_members = [];
                  }
                  currentValues.familyRecs[familyAt].other_members.push({
                    id: newID,
                    name: newName,
                    nickname: newName.split(' ')[0],
                    relationship: '',
                    role: 'view'
                  });
                };
                updateObj.reactUpd = {
                  current: currentValues,
                  addFamilyMember: false
                };
                await updateField(updateObj);
              }}
            />
          }

          {reactData.sendMessage &&
            <MakeMessage
              titleText={`Send a message to ${reactData.sendMessage.target_name}`}
              promptText={['Subject', `What should your message say?`]}
              promptUse={['subject', 'message']}
              buttonText={'Send'}
              sender={{
                client_id: currentValues.peopleRec.client_id,
                patient_id: reactData.user_id,
                patient_display_name: `Messaging User`
              }}
              pRecipientID={reactData.sendMessage.target_id}
              pRecipientName={reactData.sendMessage.target_name}
              onCancel={() => {
                updateReactData({
                  sendMessage: false
                }, true);
              }}
              onComplete={() => {
                updateReactData({
                  sendMessage: false
                }, true);
              }}
              setMethod={null}
              allowCancel={true}
            />
          }

          {reactData.showQuickSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                pickOne: false,
                pickAndGo: true,
                showAll: true
              }}
              onClose={async (selections) => {
                let updateObj = {};
                if (selections && (selections.length > 0)) {
                  let familyAt = currentValues.familyRecs.findIndex(this_familyRec => {
                    return (this_familyRec.family_id === reactData.showQuickSearch);
                  });
                  if (!currentValues.familyRecs[familyAt].other_members || (currentValues.familyRecs[familyAt].other_members.length === 0)) {
                    currentValues.familyRecs[familyAt].other_members = [];
                  }
                  for (let this_selection of selections) {
                    currentValues.familyRecs[familyAt].other_members.push({
                      id: this_selection.person_id,
                      name: `${this_selection.person_firstName} ${this_selection.person_lastName}`,
                      nickname: this_selection.person_firstName,
                      relationship: '',
                      role: 'view'
                    });
                  }
                }
                updateObj.reactUpd = {
                  current: currentValues,
                  showQuickSearch: false
                };
                await updateField(updateObj);
              }}
            />
          }

          {reactData.viewFamilyMember &&
            <PeopleMaintenance
              person_id={reactData.viewFamilyMember}
              options={{
                mode: (reactData.administrative_account ? 'edit' : 'view'),
                sectionToShow: ['ProfileSection']
              }}
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

        </Box>
        :
        <Typography
          style={AVATextStyle({ margin: { top: 1 } })}
        >
          {`AVA is gathering your Family Information`}
        </Typography>
      }
    </Box>
  );
};;