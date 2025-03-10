import React from 'react';

import useSession from '../../hooks/useSession';

import { Box, Typography, Button } from '@material-ui/core/';
import { formatPhone } from '../../util/AVAPeople';
import { deepCopy } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import SendIcon from '@material-ui/icons/Send';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';

import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import MakeMessage from '../forms/MakeMessage';

export default ({ currentValues, reactData, updateReactData }) => {

  const { state } = useSession();
  const isMounted = React.useRef(false);

  const AVAClass = AVAclasses();

  const makeLocation = () => {
    if (currentValues.peopleRec.hasOwnProperty('address')) {
      if (!currentValues.peopleRec.address.address1 && currentValues.peopleRec.location) {
        return currentValues.peopleRec.location;
      }
      else {
        return (`${currentValues.peopleRec.address.address1 || ''} ${currentValues.peopleRec.address.city || ''} ${currentValues.peopleRec.address.state || ''}`).trim();
      }
    }
    else {
      return currentValues.peopleRec.location;
    }
  };

  React.useEffect(() => {
    async function initialize() {
      let reactUpdObj = {};
      if (!reactData.accessList) {
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
          reactUpdObj.accessList = deepCopy(state.accessList[state.session.client_id].list);
          if (!currentValues.peopleRec.hasOwnProperty('proxy_allowed_from')) {
            currentValues.peopleRec.proxy_allowed_from = {};
            reactUpdObj.currentValues = currentValues;
          }
        }
      }
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
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      {currentValues.peopleRec.hasOwnProperty('person_notes') &&
        (currentValues.peopleRec.person_notes.length > 0) &&
        (currentValues.peopleRec.person_notes.some(n => { return n.urgent; })) &&
        (currentValues.peopleRec.person_notes.filter(n => { return n.urgent; }).map((this_urgentNote, uNx) => (
          <Box display='flex' alignItems='flex-start'
            justifyContent='flex-start' flexDirection='column'>
            <Typography
              key={`urgent_note-${uNx}`}
              style={AVATextStyle({ margin: { top: 0.5, bottom: 0 }, bold: true, color: 'red', size: 1.2 })}
            >
              {this_urgentNote.noteText}
            </Typography>
            <Typography
              key={`urgent_note-${uNx}`}
              style={AVATextStyle({ margin: { top: 0, bottom: 1.5 }, color: 'red', size: 0.8 })}
            >
              {`by ${this_urgentNote.user_name} on ${this_urgentNote.last_update}`}
            </Typography>
          </Box>
        )))
      }
      <Box display='flex' alignItems='center'
        style={{marginBottom: '16px'}}
        justifyContent='flex-start' flexDirection='row'>
        <Box
          component="img"
          minWidth={150}
          maxWidth={150}
          minHeight={150}
          maxHeight={150}
          border={1}
          alt=''
          src={reactData.myImage}
        />
        <Box
          key={`profileSection_masterBox`}
          flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
        >
          <Typography
            style={AVATextStyle({ margin: { top: 1 }, bold: true, size: 2 })}
          >
            {`${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
          </Typography>
          <Typography
            style={AVATextStyle({ bold: true, size: 1 })}
          >
            {makeLocation()}
          </Typography>
          {(Object.keys(reactData.local_customFields).length > 0) && Object.keys(reactData.local_customFields).map((this_customField, cFNdx) => (
            (currentValues.peopleRec?.local_data?.[this_customField] &&
              <Box
                key={`local_box__${cFNdx}`}
                display='flex' flexDirection='row'
                style={{ marginTop: ((cFNdx === 0) ? '12px' : '4px') }}
              >
                <Typography
                  key={`local_prompt__${cFNdx}`}
                  style={AVATextStyle({ size: 0.8 })}
                >
                  {`${reactData.local_customFields[this_customField].prompt}: `}
                </Typography>
                <Typography
                  key={`local_prompt__${cFNdx}`}
                  style={AVATextStyle({ size: 0.8, margin: { left: 0.5 }, bold: true })}
                >
                  {currentValues.peopleRec?.local_data?.[this_customField]}
                </Typography>
              </Box>
            )
          ))}

        </Box>
      </Box>
      {(currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
        <Typography
          style={AVATextStyle({ margin: { top: 0.5 } })}
        >
          {`Cell phone: ${(formatPhone(currentValues.peopleRec?.contact_info?.cell?.number
            ? currentValues.peopleRec.contact_info.cell.number
            : (currentValues.peopleRec?.messaging?.sms || '')
          ))}`}
        </Typography>
      }
      {(currentValues.peopleRec?.contact_info?.work?.number) &&
        <Typography
          style={AVATextStyle({ margin: { top: 0.5 } })}
        >
          {`Work phone: ${(formatPhone(currentValues.peopleRec?.contact_info?.work?.number))}`}
        </Typography>
      }
      {(currentValues.peopleRec?.contact_info?.home?.number) &&
        <Typography
          style={AVATextStyle({ margin: { top: 0.5 } })}
        >
          {`Home phone: ${(formatPhone(currentValues.peopleRec?.contact_info?.home?.number))}`}
        </Typography>
      }
      {(currentValues.peopleRec.emergency_contact?.contact1 || currentValues.peopleRec.emergency_contact?.contact2) &&
        <Typography
          style={AVATextStyle({ margin: { top: 0.5 } })}
        >
          {`Emergency contacts:`}
        </Typography>
      }
      {currentValues.peopleRec.emergency_contact?.contact1 &&
        <Typography
          style={AVATextStyle({ margin: { left: 1, top: 0 } })}
        >
          {currentValues.peopleRec.emergency_contact.contact1}
        </Typography>
      }
      {currentValues.peopleRec.emergency_contact?.contact2 &&
        <Typography
          style={AVATextStyle({ margin: { left: 1, top: 0 } })}
        >
          {currentValues.peopleRec.emergency_contact.contact2}
        </Typography>
      }
      {(currentValues.peopleRec.myFamilyMembers &&
        (currentValues.peopleRec.myFamilyMembers.length > 0)) &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first} is responsible for:`}
          </Typography>
          {Object.keys(currentValues.peopleRec.myFamilyMembers).sort((p1, p2) => {
            if (currentValues.peopleRec.myFamilyMembers[p1].type !== currentValues.peopleRec.myFamilyMembers[p2].type) {
              return ((currentValues.peopleRec.myFamilyMembers[p1].type > currentValues.peopleRec.myFamilyMembers[p2].type) ? 1 : -1);
            }
            else {
              return ((currentValues.peopleRec.myFamilyMembers[p1].name > currentValues.peopleRec.myFamilyMembers[p2].name) ? 1 : -1);
            }
          }).map((this_member, memberNdx) => (
            <Box
              display='flex'
              flexDirection='row'
              alignItems={'flex-start'}

              key={`family_${memberNdx}`}
            >
              {(currentValues.peopleRec.myFamilyMembers[this_member].type.toLowerCase() === 'camper') &&
                <Typography style={AVATextStyle({ margin: { top: 0, left: 1, right: -0.8 }, bold: true })}>
                  {`Camper -`}
                </Typography>
              }
              <Typography
                style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
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
      {currentValues.peopleRec.proxy_allowed_from &&
        (Object.keys(currentValues.peopleRec.proxy_allowed_from).length > 0) &&
        reactData.accessList &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first}'s Caregiver(s):`}
          </Typography>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {reactData.accessList.map((this_item, tIndex) => (
              currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id) &&
              <Button
                className={AVAClass.AVAButton_noBorder}
                key={`parent_button__${tIndex}`}
                onClick={async () => {
                  updateReactData({
                    viewFamilySnapshot: this_item.person_id
                  }, true);
                }}
                style={{ marginLeft: '18px', backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<SendIcon size='small' />}
              >
                <Box display='flex' alignItems='center'
                  key={`parent_box__${tIndex}`}
                  justifyContent='flex-end' flexDirection='column'>
                  <Typography
                    key={`parent_name__${tIndex}`}
                    style={AVATextStyle({ margin: { top: 0, left: 0 }, bold: true })}
                  >
                    {`${this_item.first} ${this_item.last}`}
                  </Typography>
                </Box>
              </Button>
            )
            )}
          </Box>
        </React.Fragment>
      }
      {currentValues.peopleRec.myFamilyMembers &&
        (Object.keys(currentValues.peopleRec.myFamilyMembers).length > 0) &&
        reactData.accessList &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first} is a Caregiver for:`}
          </Typography>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {Object.keys(currentValues.peopleRec.myFamilyMembers).map((this_item, tIndex) => (
              <Button
                className={AVAClass.AVAButton_noBorder}
                key={`child_button__${tIndex}`}
                onClick={async () => {
                  updateReactData({
                    viewFamilySnapshot: this_item
                  }, true);
                }}
                style={{ marginLeft: '18px', backgroundColor: 'white', color: 'black' }}
                size='small'
              >
                <Box display='flex' alignItems='center'
                  key={`child_box__${tIndex}`}
                  justifyContent='flex-end' flexDirection='column'>
                  <Typography
                    key={`child_name__${tIndex}`}
                    style={AVATextStyle({ margin: { top: 0, left: 0 }, bold: true })}
                  >
                    {`${currentValues.peopleRec.myFamilyMembers[this_item].name}`}
                  </Typography>
                </Box>
              </Button>
            )
            )}
          </Box>
        </React.Fragment>
      }
      {currentValues.peopleRec.hasOwnProperty('person_notes') &&
        (currentValues.peopleRec.person_notes.length > 0) &&
        (currentValues.peopleRec.person_notes.some(n => { return !n.urgent; })) &&
        <Box display='flex' alignItems='flex-start'
          justifyContent='flex-start' flexDirection='column'>
          <Typography
            key={`note_head`}
            style={AVATextStyle({ margin: { top: 1, bottom: 0.2 } })}
          >
            {`Notes:`}
          </Typography>
          {currentValues.peopleRec.person_notes.filter(n => { return !n.urgent; }).map((this_note, nx) => (
            <Box display='flex' alignItems='flex-start'
              justifyContent='flex-start' flexDirection='column'>
              <Typography
                key={`normal_note-${nx}`}
                style={AVATextStyle({ margin: { left: 0.5, top: 0.5, bottom: 0 } })}
              >
                {this_note.noteText}
              </Typography>
              <Typography
                key={`note-${nx}`}
                style={AVATextStyle({ margin: { left: 0.5, top: 0, bottom: 0.5 }, size: 0.8 })}
              >
                {`by ${this_note.user_name} on ${this_note.last_update}`}
              </Typography>
            </Box>
          ))}
        </Box>
      }
      <Box
        display='flex'
        alignItems={'center'}
        justifyContent='space-between' flexDirection='row'
        key={`bottom_row`}
        style={{ marginTop: '24px' }}
      >
        <Box
          display='flex'
          alignItems={'center'}
          justifyContent='flex-start' flexDirection='row'
          key={`bottom_buttons`}
          style={{}}
        >
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            <Button
              key={`sendMessagesButton`}
              onClick={async () => {
                updateReactData({
                  sendMessage: true
                }, true);
              }}
              className={AVAClass.AVAButton}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<SendIcon size='small' />}
            >
              <Box display='flex' alignItems='center'
                key={`sendMessages`}
                justifyContent='flex-end' flexDirection='column'>
                <Typography
                  key={`sendMessage`}
                  style={AVATextStyle({ size: 0.7, margin: { right: 0.5 } })}
                >
                  {`Message`}
                </Typography>
              </Box>
            </Button>
          }
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec.contact_info?.cell.number) &&
            <Button
              className={AVAClass.AVAButton}
              key={`callCellButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<PhoneInTalkIcon size='small' />}
            >
              <a href={`tel:${currentValues.peopleRec.contact_info.cell.number}`}
                key={`callCell`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`callCell_words`}
                  style={AVATextStyle({ size: 0.7, margin: { right: 0.5 } })}
                >
                  {`Call Cell`}
                </Typography>
              </a>
            </Button>
          }
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec.contact_info?.work?.number) &&
            <Button
              className={AVAClass.AVAButton}
              key={`callWorkButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<PhoneInTalkIcon size='small' />}
            >
              <a href={`tel:${currentValues.peopleRec.contact_info.work.number}`}
                key={`callWork`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`callWork_words`}
                  style={AVATextStyle({ size: 0.7, margin: { right: 0.5 } })}
                >
                  {`Call Work`}
                </Typography>
              </a>
            </Button>
          }
        </Box>
        {(reactData.administrative_account || (state.session.user_id === currentValues.peopleRec.person_id)) &&
          <Box display='flex' alignItems='center'
            justifyContent='flex-end' flexDirection='row'>
            <Typography
              style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
            >
              {`User ID: ${currentValues.peopleRec.person_id}`}
            </Typography>
          </Box>
        }
      </Box>

      {reactData.sendMessage &&
        <MakeMessage
          titleText={`Send a message to ${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
          promptText={['Subject', `What should your message to ${currentValues.peopleRec.name?.first} say?`]}
          promptUse={['subject', 'message']}
          buttonText={'Send'}
          sender={{
            "client_id": state.session.client_id,
            "patient_id": state.session.user_id,
            "patient_display_name": state.session.user_display_name
          }}
          pRecipientID={currentValues.peopleRec.person_id}
          pRecipientName={`${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`}
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

      {reactData.viewFamilySnapshot &&
        <PeopleMaintenance
          person_id={reactData.viewFamilySnapshot}
          initialValues={{ color: 'green' }}
          options={{ sectionToShow: 'Snapshot' }}
          onClose={() => {
            updateReactData({
              viewFamilySnapshot: false
            }, true);
          }}
        />
      }

      {reactData.viewFamilyMember &&
        <PeopleMaintenance
          person_id={reactData.viewFamilyMember}
          initialValues={{ color: 'turquoise' }}
          onClose={() => {
            updateReactData({
              viewFamilyMember: false
            }, true);
          }}
        />
      }
    </Box>
  );
};
