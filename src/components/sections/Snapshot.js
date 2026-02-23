import React from 'react';

import useSession from '../../hooks/useSession';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import { Box, Typography, Button } from '@material-ui/core/';
import { formatPhone } from '../../util/AVAPeople';
import { deepCopy, titleCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import SendIcon from '@material-ui/icons/Send';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import TextsmsIcon from '@material-ui/icons/Textsms';

import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import MakeMessage from '../forms/MakeMessage';

export default ({ currentValues, reactData, updateReactData }) => {

  const { state } = useSession();
  const isMounted = React.useRef(false);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  const AVAClass = AVAclasses();

  const sanitizeLocation = (value) => {
    if (!value) return '';
    return String(value)
      .replace(/undefined/g, '')
      .trim()
      .replace(/^[\s,;:]+|[\s,;:]+$/g, '');
  };

  const makeName = (person_id) => {
    let peopleList = state.accessList?.[state.session.client_id].list;
    let foundPerson = peopleList?.find(p => p.person_id === person_id);
    if (foundPerson) {
      return `${foundPerson.name.first} ${foundPerson.name.last}`;
    }
    else {
      return null;
    }
  }

  const makeLocation = () => {
    if (currentValues.peopleRec.hasOwnProperty('address') && currentValues.peopleRec.address) {
      if (currentValues.peopleRec.address.street) {
        // If 'street' exists, use it as address1
        currentValues.peopleRec.address.address1 = currentValues.peopleRec.address.street;
      }
      if ((!currentValues.peopleRec.address || Object.keys(currentValues.peopleRec.address).length === 0) && currentValues.peopleRec.location) {
        return sanitizeLocation(currentValues.peopleRec.location);
      }
      else {
        // Filter out nullish values and join with spaces
        let addressParts = '';
        if (currentValues.peopleRec.address.address1
          && currentValues.peopleRec.address.address1.trim() !== ''
          && currentValues.peopleRec.address.address1.includes('undefined') !== true
        ) {
          addressParts += titleCase(currentValues.peopleRec.address.address1) + "; ";
        }
        if (currentValues.peopleRec.address.city
          && currentValues.peopleRec.address.city.trim() !== ''
          && currentValues.peopleRec.address.city.includes('undefined') !== true
        ) {
          addressParts += titleCase(currentValues.peopleRec.address.city) + ", ";
        }
        if (currentValues.peopleRec.address.state
          && currentValues.peopleRec.address.state.trim() !== ''
          && currentValues.peopleRec.address.state.includes('undefined') !== true
        ) {
          addressParts += currentValues.peopleRec.address.state + " ";
        }
        if (currentValues.peopleRec.address.zip
          && currentValues.peopleRec.address.zip.trim() !== ''
          && currentValues.peopleRec.address.zip.includes('undefined') !== true
        ) {
          addressParts += currentValues.peopleRec.address.zip;
        }
        return sanitizeLocation(addressParts);
      }
    }
    else {
      return sanitizeLocation(currentValues.peopleRec.location);
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
        style={{ marginBottom: '16px' }}
        flexWrap={'wrap'}
        justifyContent='flex-start' flexDirection='row'>
        <Box
          component="img"
          minWidth={150}
          maxWidth={150}
          minHeight={150}
          maxHeight={150}
          border={1}
          mr={2}
          alt=''
          src={reactData.myImage}
        />
        <Box
          key={`profileSection_masterBox`}
          flexGrow={2} pr={2} py={isMobile ? 2 : 4} display='flex' flexDirection='column'
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
          {currentValues.peopleRec.checkout_message &&
            <Typography
              style={AVATextStyle({ bold: true, size: 1 })}
            >
              {currentValues.peopleRec.checkout_message}
            </Typography>
          }

          {/* Display leaf groups (groups with no children) */}
          {currentValues.peopleRec.groups && currentValues.peopleRec.groups.length > 0 && (() => {
            // Filter to only show groups with no children (leaf nodes)
            const leafGroups = currentValues.peopleRec.groups.filter(group_id => {
              // Exclude if this group is '_top_'
              if (group_id.toLowerCase().includes('_top_')) { return false; }
              // Exclude if this group has children (exists in parent_of and has entries) AND I belong to at least one of those children
              let hasChildren = state.groups?.parent_of?.[group_id] && (state.groups.parent_of[group_id].length > 0);
              let belongsToChild = hasChildren && state.groups.parent_of[group_id].some(child_id => currentValues.peopleRec.groups.includes(child_id));
              return !belongsToChild;
            });

            if (leafGroups.length === 0) return null;

            return (
              <Box display='flex' flexDirection='column' style={{ marginTop: '12px' }}>
                <Typography style={AVATextStyle({ size: 0.8 })}>
                  {'Groups:'}
                </Typography>
                {leafGroups.map((group_id, idx) => {
                  // Find the group name
                  const groupInfo = state.groups?.adminHierarchy?.find(g => g.id === group_id);
                  const groupName = groupInfo?.name ||
                    state.groups?.publicGroups?.[group_id]?.group_name ||
                    state.groups?.privateGroups?.[group_id]?.group_name ||
                    group_id;

                  return (
                    <Typography
                      key={`group__${idx}`}
                      style={AVATextStyle({ size: 0.8, margin: { left: 1 }, bold: true })}
                    >
                      {groupName}
                    </Typography>
                  );
                })}
              </Box>
            );
          })()}

          {(Object.keys(reactData.local_customFields).length > 0) && Object.keys(reactData.local_customFields).map((this_customField, cFNdx) => (
            (currentValues.peopleRec?.local_data?.[this_customField] &&
              <Box
                key={`local_box__${cFNdx}`}
                display='flex' flexDirection='row'
                style={{ marginTop: ((cFNdx === 0) ? '12px' : '4px') }}
              >
                <Typography
                  key={`local_prompt__${cFNdx}a`}
                  style={AVATextStyle({ size: 0.8 })}
                >
                  {`${reactData.local_customFields[this_customField].prompt || titleCase(this_customField.replace(/[^a-z^A-Z^0-9]/g, " "))}:`}
                </Typography>
                <Typography
                  key={`local_prompt__${cFNdx}b`}
                  style={AVATextStyle({ size: 0.8, margin: { left: 0.5 }, bold: true })}
                >
                  {currentValues.peopleRec?.local_data?.[this_customField]}
                </Typography>
              </Box>
            )
          ))}
          {(Object.keys(reactData.form_fields).length > 0) && Object.keys(reactData.form_fields).map((this_formField, cFNdx) => (
            <React.Fragment
              key={`fraglocal_box__${cFNdx}`}
            >
              {reactData.form_fields[this_formField].snapshot && reactData.form_fields[this_formField].value &&
                <Box
                  key={`local_box__${cFNdx}`}
                  display='flex' flexDirection='row'
                  style={{ marginTop: ((cFNdx === 0) ? '12px' : '4px') }}
                >
                  <Typography
                    key={`local_prompt__${cFNdx}c`}
                    style={AVATextStyle({ size: 0.8 })}
                  >
                    {reactData.form_fields[this_formField].fieldRec.prompt.value}
                  </Typography>
                  <Typography
                    key={`local_prompt__${cFNdx}d`}
                    style={AVATextStyle({ size: 0.8, margin: { left: 0.5 }, bold: true })}
                  >
                    {reactData.form_fields[this_formField].fieldRec?.value?.type === 'date'
                      ? makeDate(reactData.form_fields[this_formField].value).absolute_withAge
                      : reactData.form_fields[this_formField].value
                    }
                  </Typography>
                </Box>
              }
            </React.Fragment>
          ))}

        </Box>
      </Box>
      {(currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
          key={`callCell`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Cell' : 'Cell phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.cell?.number
              ? currentValues.peopleRec.contact_info.cell.number
              : (currentValues.peopleRec?.messaging?.sms || '')
            ))}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.work?.number) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.work?.number}`}
          key={`callWork_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Work' : 'Work phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.work?.number))}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice) &&
        <a href={`tel:${currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice}`}
          key={`callHome_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? 'Home' : 'Home phone:'} ${(formatPhone(currentValues.peopleRec?.contact_info?.home?.number
              || currentValues.peopleRec?.contact_info?.landline?.number
              || currentValues.peopleRec?.messaging?.voice
              || '')
            )}`}
          </Typography>
        </a>
      }
      {(currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email) &&
        <a href={`mailto:${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
          key={`eMailMe_text`}
          style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography
            style={AVATextStyle({ margin: { top: 0.5 }, size: 1.5 })}
          >
            {`${isMobile ? '' : 'e-Mail: '}${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
          </Typography>
        </a>
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
      {(currentValues.familyRecs && currentValues.familyRecs.length > 0) &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {`${currentValues.peopleRec.name?.first}'s family:`}
          </Typography>
          <Box
              display='flex'
              flexDirection='row'
              alignItems={'flex-start'}

              key={`family_primary`}
            >
              <Typography
                style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
                onClick={async () => {
                  updateReactData({
                    viewFamilyMember: currentValues.familyRecs[0].primary_contact.id
                  }, true);
                }}
              >
                {`${makeName(currentValues.familyRecs[0].primary_contact.id) || currentValues.familyRecs[0].primary_contact.name.trim() || currentValues.familyRecs[0].primary_contact.id || 'Unknown Person'}`}
              </Typography>
              <Typography style={AVATextStyle({ margin: { top: 0, left: 0.5, right: -0.8 }, bold: true })}>
                {'- Primary'}
              </Typography>
            </Box>
          {currentValues.familyRecs[0].other_members.sort((p1, p2) => {
            if (p1.role !== p2.role) {
              return ((p1.role > p2.role) ? 1 : -1);
            }
            else {
              return ((p1.name > p2.name) ? 1 : -1);
            }
          }).map((this_member, memberNdx) => (
            <Box
              display='flex'
              flexDirection='row'
              alignItems={'flex-start'}

              key={`family_${memberNdx}`}
            >
              <Typography
                style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
                onClick={async () => {
                  updateReactData({
                    viewFamilyMember: this_member.id
                  }, true);
                }}
              >
                {`${makeName(this_member?.id) || this_member?.name.trim() || this_member?.id || 'Unknown Person'}`}
              </Typography>
              <Typography style={AVATextStyle({ margin: { top: 0, left: 0.5, right: -0.8 }, bold: true })}>
                {this_member.role && this_member.role === 'primary' ? '- Primary' : (this_member.relationship ? ('- ' + this_member.relationship) : '')}
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
          flexWrap={'wrap'}
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
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Message`}
                </Typography>
              </Box>
            </Button>
          }
          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
            <React.Fragment>
              <Button
                className={AVAClass.AVAButton}
                key={`callCellButton`}
                style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<PhoneInTalkIcon size='small' />}
              >
                <a href={`tel:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
                  key={`callCell_button`}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Typography
                    key={`callCell_words`}
                    style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                  >
                    {`Call Cell`}
                  </Typography>
                </a>
              </Button>
              <Button
                className={AVAClass.AVAButton}
                key={`textCellButton`}
                style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                size='small'
                startIcon={<TextsmsIcon size='small' />}
              >
                <a href={`sms:${currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms}`}
                  key={`callCell_button`}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Typography
                    key={`textCell_words`}
                    style={AVATextStyle({ margin: { right: 0.5 }, size: 1.2 })}
                  >
                    {`Text Msg`}
                  </Typography>
                </a>
              </Button>
            </React.Fragment>
          }






          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice) &&
            <Button
              className={AVAClass.AVAButton}
              key={`callHomeButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<PhoneInTalkIcon size='small' />}
            >
              <a href={`tel:${currentValues.peopleRec?.contact_info?.home?.number || currentValues.peopleRec?.contact_info?.landline?.number || currentValues.peopleRec?.messaging?.voice}`}
                key={`callHome_button`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`callHome_words`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Call Home`}
                </Typography>
              </a>
            </Button>
          }


          {(state.session.user_id !== currentValues.peopleRec.person_id) &&
            (currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email) &&
            <Button
              className={AVAClass.AVAButton}
              key={`eMailButton`}
              style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
              size='small'
              startIcon={<SendIcon size='small' />}
            >
              <a href={`mailto:${currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec?.messaging?.email}`}
                key={`eMailMe`}
                style={{ color: 'inherit', textDecoration: 'none' }}>
                <Typography
                  key={`eMail_words`}
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`e-Mail`}
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
                  style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                >
                  {`Call Work`}
                </Typography>
              </a>
            </Button>
          }
        </Box>
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
