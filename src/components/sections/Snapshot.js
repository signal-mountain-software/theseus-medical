import React from 'react';

import useSession from '../../hooks/useSession';

import { Box, Typography, Button } from '@material-ui/core/';
import { formatPhone } from '../../util/AVAPeople';
import { deepCopy } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import SendIcon from '@material-ui/icons/Send';

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
      <Box display='flex' alignItems='center'
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
        </Box>
      </Box>
      {(currentValues.peopleRec?.contact_info?.cell?.number || currentValues.peopleRec?.messaging?.sms) &&
        <Typography
          style={AVATextStyle({ margin: { top: 1 } })}
        >
          {`Cell phone: ${(formatPhone(currentValues.peopleRec?.contact_info?.cell?.number
            ? currentValues.peopleRec.contact_info.cell.number
            : (currentValues.peopleRec?.messaging?.sms || '')
          ))}`}
        </Typography>
      }
      {(currentValues.peopleRec.emergency_contact?.contact1 || currentValues.peopleRec.emergency_contact?.contact2) &&
        <Typography
          style={AVATextStyle({ margin: { top: 1 } })}
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
            {`${currentValues.peopleRec.name?.first}'s account may be managed by:`}
          </Typography>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {reactData.accessList.map((this_item, tIndex) => (
              currentValues.peopleRec.proxy_allowed_from.hasOwnProperty(this_item.person_id) &&
              <Typography
                style={AVATextStyle({ margin: { top: 0, left: 1 }, bold: true })}
                onClick={async () => {
                  updateReactData({
                    viewFamilySnapshot: this_item.person_id
                  }, true);
                }}
              >
                {`${this_item.first} ${this_item.last}`}
              </Typography>
            )
            )}
          </Box>
        </React.Fragment>
      }
      <Box
        display='flex'
        alignItems={'center'}
        justifyContent='space-between' flexDirection='row'
        key={`bottom_row`}
        style={{ marginTop: '24px' }}
      >
        {(state.session.user_id !== currentValues.peopleRec.person_id) &&
          <Button
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
              justifyContent='flex-end' flexDirection='column'>
              <Typography
                style={AVATextStyle({ size: 0.7, margin: { top: 0.2, right: 0.5 } })}
              >
                {`Message`}
              </Typography>
              <Typography
                style={AVATextStyle({ size: 0.7, margin: { bottom: 0.2, right: 0.5 } })}
              >
                {currentValues.peopleRec.name?.first}
              </Typography>
            </Box>
          </Button>
        }
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
