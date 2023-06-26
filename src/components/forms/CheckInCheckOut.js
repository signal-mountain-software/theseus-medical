import React from 'react';
import AVATextInput from '../forms/AVATextInput';

import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';

import { isEmpty, titleCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import { getPerson, getImage, getPersonByWords, addGuest, formatPhone, makeName } from '../../util/AVAPeople';
import { AVAclasses } from '../../util/AVAStyles';

import { useSnackbar } from 'notistack';

import useSession from '../../hooks/useSession';
import AVAConfirm from './AVAConfirm';

// import makeStyles from '@material-ui/core/styles/makeStyles';

/*
const localClass = makeStyles(theme => ({
  containerBox: {
    paddingTop: theme.spacing(3),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
}));
*/

export default ({ onSave, onClose }) => {

  const AVAClass = AVAclasses();
  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState();
  const [reactData, setReactData] = React.useState(
    {
      kiosk_mode: (state.session.hasOwnProperty('kiosk_mode') ? state.session.kiosk_mode : false),
      validated_user: false,
      personRec: state.patient,
      residentName: ((state.patient && state.patient.name) ? `${state.patient.name.first} ${state.patient.name.last}` : ''),
      residentLocation: ((state.patient && state.patient.location) ? `${state.patient.location.trim().split(/\s+/)[0]}` : ''),
      errorText: [],
      guest_mode: false,
      resident_mode: false,
      add_guest_mode: false,
      adminOverride: 'none',
      adminIndex: -1,
      outList: [],
      adminView: false
    }
  );

  // Functions

  async function validateUser(IDString, numberString, client_id, guest) {
    if (!IDString) { return { result: 'invalid', error_field: 0, reason: 'The ID field is empty' }; }
    if (!numberString) { return { result: 'invalid', error_field: 1, reason: 'No numbers were entered' }; }
    // get candidates from the words entered
    let personRecs = [];
    let ID_words = IDString.trim().split(/\s+/);
    if (guest) { ID_words.push('guest'); }
    if (ID_words.length === 1) {  // only one word, try it as a user ID
      let result = await getPerson(ID_words[0], '*all');
      if (!isEmpty(result)) { personRecs.push(result); }
    }
    if (isEmpty(personRecs)) {
      personRecs.push(...(await getPersonByWords(client_id, ID_words)));
      if (isEmpty(personRecs)) {
        return { result: 'invalid', error_field: 0, reason: `We didn't find an account for ${IDString}` };
      }
    }
    // do some of the numbers show up in any of the found people?
    let numberWords = numberString.trim().split(/\D+/);
    let matchedPeople = [];
    personRecs.forEach(p => {
      if (numberWords.some(n => { return p.search_data.includes(n); })) { matchedPeople.push(p); }
    });
    switch (matchedPeople.length) {
      case 0: {
        return { result: 'invalid', error_field: 1, reason: `This information doesn't match any ${IDString}` };
      }
      case 1: {
        return { result: 'match', person_id: matchedPeople[0].person_id, personRec: matchedPeople[0] };
      }
      default: {
        return {
          result: 'ambiguous',
          error_field: 1,
          reason: `This information matches more than one ${IDString}`,
          candidates: matchedPeople
        };
      }
    }
  }

  async function getCurrentStatus(client_id, person_id) {
    let reqArray = await getServiceRequests({ client_id, person_id, request_type: "checkout" });
    if (reqArray.length === 0) {
      let now = new Date().getTime();
      return {
        last_status: 'none',
        last_update: 0,
        history: [],
        reqRec: {
          client_id,
          "request_id": `${person_id}_checkout`,
          "requestor": person_id,
          "on_behalf_of": await makeName(person_id),
          "request_type": 'checkout',
          "request_date": now,
          "original_request": {},
          "history": [],
          "local_key": `${person_id}_checkout`,
          "foreign_key": 'resident',
          "last_update": now,
          "last_status": 'none'
        }
      };
    }
    else
      return {
        last_status: reqArray[0].last_status,
        last_update: reqArray[0].last_update,
        history: reqArray[0].history,
        reqRec: reqArray[0]
      };
  }

  async function getCheckedOut() {
    let reqArray = await getServiceRequests({ client_id: state.session.client_id, request_type: "checkout" });
    let checkedOutList = [];
    let checkedInList = [];
    let outSorter = [];
    let inSorter = [];
    if (reqArray.length > 0) {
      reqArray.forEach((c, x) => {
        if ((c.last_status === 'out') && (c.foreign_key === 'resident')) {
          outSorter.push(`${c.last_update}~${x}`);
        }
        else if ((c.last_status === 'in') && (c.foreign_key === 'guest')) {
          inSorter.push(`${c.last_update}~${x}`);
        }
      });
      outSorter.sort();
      outSorter.forEach(s => {
        let c = reqArray[Number(s.split('~')[1])];
        checkedOutList.push({
          person_id: c.requestor,
          reqRec: c,
          last_update: c.last_update,
          name: c.on_behalf_of,
          message: c.history[0].replace('Checked out', '').trim()
        });
      });
      inSorter.sort();
      for (let x = 0; x < inSorter.length; x++) {
        let c = reqArray[Number(inSorter[x].split('~')[1])];
        checkedInList.push({
          person_id: c.requestor,
          reqRec: c,
          last_update: c.last_update,
          name: await makeName(c.requestor),
          message: c.history[0].replace('Checked in', '').trim()
        });
      }
    }
    return [checkedOutList, checkedInList];
  }

  function reset() {
    setReactData({
      kiosk_mode: (state.session.hasOwnProperty('kiosk_mode') ? state.session.kiosk_mode : false),
      validated_user: false,
      personRec: state.patient,
      residentName: ((state.patient && state.patient.name) ? `${state.patient.name.first} ${state.patient.name.last}` : ''),
      residentLocation: ((state.patient && state.patient.location) ? `${state.patient.location.trim().split(/\s+/)[0]}` : ''),
      errorText: [],
      guest_mode: false,
      resident_mode: false,
      add_guest_mode: false,
      adminOverride: 'none',
      adminIndex: -1,
      outList: [],
      adminView: false
    });
    setForceRedisplay(!forceRedisplay);
  }

  function makeGreeting(pName) {
    if (state.session?.custom_greeting) { return `${state.session.custom_greeting}, ${pName}!`; }
    else { return `Good ${makeDate(new Date()).dayPart}, ${pName}!`; }
  }

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      { /* 
          We don't know what mode we're in
        */
        !reactData.resident_mode
        && !reactData.guest_mode
        && !reactData.add_guest_mode
        && !reactData.adminView
        &&
        <DialogContent style={{ justifyContent: 'center' }}>
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={2} mr={2} mb={2} mt={2}
          >
            <Box
              component="img"
              mb={2}
              minWidth={150}
              maxWidth={150}
              alt=''
              src={state.session.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            <Typography variant='h5' >{'Welcome to'}</Typography>
            <Typography variant='h5' style={{ fontWeight: 'bold' }}>{state.session.client_name}</Typography>
          </Box>
          <Box display='flex' style={{ marginTop: '2em' }} flexDirection='column' justifyContent='center' alignItems='center'>
            <Button
              className={AVAClass.AVAButton}
              style={{ minWidth: '200px', minHeight: '50px', marginTop: '20px', fontSize: '2em', fontWeight: 'bold' }}
              size='small'
              onClick={async () => {
                reactData.resident_mode = true;
                if (!reactData.kiosk_mode) {
                  reactData.validated_user = true;
                  reactData.currentStatus = await getCurrentStatus(state.session.client_id, reactData.personRec.person_id);
                }
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
            >
              Resident
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{ minWidth: '200px', minHeight: '50px', marginTop: '20px', fontSize: '2em', fontWeight: 'bold' }}
              size='small'
              onClick={() => {
                reactData.guest_mode = true;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
            >
              Guest
            </Button>
          </Box>
          <Box style={{ marginTop: '10em' }} display='flex' flexDirection='row' justifyContent='space-between' alignItems='flex-end'>
            <Button
              className={AVAClass.AVAButton}
              style={{ fontSize: '0.5em' }}
              size='small'
              onClick={() => {
                onClose();
              }}
            >
              Exit
            </Button>
            {state.session.adminAccount &&
              <Button
                className={AVAClass.AVAButton}
                style={{ fontSize: '0.5em' }}
                size='small'
                onClick={async () => {
                  let [outList, inList] = await getCheckedOut();
                  reactData.outList = outList;
                  reactData.inList = inList;
                  reactData.adminView = true;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
              >
                Admin
              </Button>
            }
          </Box>
        </DialogContent>
      }
      { /* 
          Admin list of checkouts
        */
        !reactData.resident_mode
        && !reactData.guest_mode
        && !reactData.add_guest_mode
        && reactData.adminView
        && ((reactData.adminOverride !== 'in') && (reactData.adminOverride !== 'out'))
        &&
        <Dialog open={forceRedisplay || true} fullWidth >
          <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
            <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start' style={{ marginBottom: '1.5em' }}>
              <Typography variant='h5' id='dialog-title'>{'Residents currently checked-out'}</Typography>
            </Box>
            {(reactData.outList.length === 0) &&
              <Box style={{ paddingTop: '-8px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'>
                <Typography><i>No residents currently checked out</i></Typography>
              </Box>
            }
            {(reactData.outList.length > 0) && reactData.outList.map((outRow, outNdx) => (
              <Box
                style={{ paddingBottom: '2em' }}
                display='flex'
                flexDirection='row'
                justifyContent='flex-start'
                alignItems='center'
                onClick={async () => {
                  reactData.adminOverride = 'in';
                  reactData.adminIndex = outNdx;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
              >
                <Box
                  component="img"
                  mr={1}
                  minWidth={50}
                  minHeight={50}
                  maxWidth={50}
                  border={1}
                  alt=''
                  src={getImage(outRow.person_id)}
                />
                <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography><b>{outRow.name}</b></Typography>
                  <Typography variant='subtitle2' style={{ marginLeft: '20px' }}>{outRow.message}</Typography>
                </Box>
              </Box>
            )
            )}
          </Box>
          <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
            <Box display='flex' style={{ marginTop: '1.5em', marginBottom: '1.5em' }} flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
              <Typography variant='h5' id='dialog-title'>{'Guests still checked-in'}</Typography>
            </Box>
            {(reactData.inList.length === 0) &&
              <Box style={{ paddingTop: '-8px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'>
                <Typography><i>No guests currently checked in</i></Typography>
              </Box>
            }
            {(reactData.inList.length > 0) && reactData.inList.map((inRow, inNdx) => (
              <Box style={{ paddingBottom: '2em' }}
                display='flex'
                flexDirection='row'
                justifyContent='flex-start'
                alignItems='center'
                onClick={async () => {
                  reactData.adminOverride = 'out';
                  reactData.adminIndex = inNdx;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
              >
                <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography><b>{inRow.name}</b></Typography>
                  <Typography variant='subtitle2' style={{ marginLeft: '20px' }}>{inRow.message}</Typography>
                </Box>
              </Box>
            )
            )}
          </Box>
          <Button
            className={AVAClass.AVAButton}
            style={{ color: 'red', marginTop: '1.5em', marginInline: 'auto', maxWidth: '30px' }}
            size='small'
            onClick={() => {
              reset();
            }}
          >
            Back
          </Button>
        </Dialog>
      }
      {  /* 
          Admin override, check-in
          Current status is OUT, so they are checking IN
        */
        reactData.adminOverride === 'in'
        &&
        <AVAConfirm
          promptText={`Confirm override check-in for ${reactData.outList[reactData.adminIndex].name}`}
          cancelText={`Cancel`}
          confirmText={`Check-in`}
          onCancel={() => {
            reactData.adminOverride = null;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onConfirm={async () => {
            let reqRec = reactData.outList[reactData.adminIndex].reqRec;
            let now = makeDate(new Date());
            reqRec.last_status = 'in';
            reqRec.last_update = now.timestamp;
            let hNote = `Checked in by ${state.session.user_display_name} on ${now.absolute}`;
            reqRec.history.unshift(hNote);
            await updateServiceRequest(reqRec);
            enqueueSnackbar(`Check-in completed!`, { variant: 'success', persist: false });
            reactData.adminOverride = null;
            reactData.outList.splice(reactData.adminIndex, 1);
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          allowCancel={true}
        />
      }
      {  /* 
          Admin override, check-out
          Current status is IN, so they are checking OUT
        */
        reactData.adminOverride === 'out'
        &&
        <AVAConfirm
          promptText={`Confirm override check-out for ${reactData.inList[reactData.adminIndex].name}`}
          cancelText={`Cancel`}
          confirmText={`Check-out`}
          onCancel={() => {
            reactData.adminOverride = null;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onConfirm={async () => {
            let reqRec = reactData.inList[reactData.adminIndex].reqRec;
            let now = makeDate(new Date());
            reqRec.last_status = 'out';
            reqRec.last_update = now.timestamp;
            let hNote = `Checked out by ${state.session.user_display_name} on ${now.absolute}`;
            reqRec.history.unshift(hNote);
            await updateServiceRequest(reqRec);
            enqueueSnackbar(`Check-out is complete!`, { variant: 'success', persist: false });
            reactData.adminOverride = null;
            reactData.inList.splice(reactData.adminIndex, 1);
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          allowCancel={true}
        />
      }
      { /* 
          We don't know who the current user is
          Resident mode selected 
        */
        !reactData.validated_user
        && reactData.resident_mode
        && !reactData.select_user
        &&
        <AVATextInput
          titleText={(!reactData.kiosk_mode ? makeGreeting(reactData.personRec.name.first) : `${state.session.client_name} resident Check-in/Check-out`)}
          promptText={["Name or AVA ID", "Apartment, Phone number, or AVA password"]}
          valueText={[
            (!reactData.kiosk_mode ? reactData.residentName : ''),
            (!reactData.kiosk_mode ? reactData.residentLocation : '')
          ]}
          buttonText={[(!reactData.kiosk_mode ? 'Confirm' : 'Lookup'), 'Start over']}
          onCancel={() => {
            reset();
          }}
          errorText={reactData.errorText}
          onSave={async ([enteredID, enteredNumber]) => {
            if (!enteredID) {
              reactData.errorText[0] = `Please enter your name or AVA ID so we can properly identify you!`;
            }
            else if (enteredID === 'exit') {
              onClose();
            }
            if (!enteredNumber) {
              reactData.errorText[1] = `For security, we use this information for validation.  Please enter something here.  Thanks! `;
            }
            if (enteredID && enteredNumber) {
              let validation = await validateUser(enteredID, enteredNumber, state.session.client_id);
              reactData.errorText = [];
              if (validation.result === 'match') {
                reactData.validated_user = true;
                reactData.personRec = validation.personRec;
                reactData.currentStatus = await getCurrentStatus(state.session.client_id, validation.personRec.person_id);
              }
              else if (validation.result === 'ambiguous') {
                reactData.select_user = true;
                reactData.candidates = validation.candidates;
              }
              else {
                reactData.errorText[validation.error_field] = validation.reason;
              }
            }
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          allowCancel={true}
        />
      }
      { /* 
          We have an ambigous list of possible candidates
        */
        !reactData.validated_user
        && reactData.resident_mode
        && reactData.select_user
        &&
        <Dialog open={forceRedisplay || true} fullWidth >
          <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
            <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start' style={{ marginBottom: '1.5em' }}>
              <Typography variant='h5' id='dialog-title'>{'More than one match was found!'}</Typography>
              <Typography variant='subtitle2' id='dialog-title'>{'Please tap on your selection below:'}</Typography>
            </Box>
            {reactData.candidates.map(candidate => (
              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                onClick={async () => {
                  reactData.validated_user = true;
                  reactData.personRec = candidate;
                  reactData.currentStatus = await getCurrentStatus(state.session.client_id, candidate.person_id);
                  reactData.select_user = false;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
              >
                <Box
                  component="img"
                  mr={1}
                  minWidth={50}
                  maxWidth={50}
                  alt=''
                  src={getImage(candidate.person_id)}
                />
                <Typography variant='h5'>{`${candidate.name.first} ${candidate.name.last}`}</Typography>
              </Box>
            )
            )}
          </Box>
          <Button
            className={AVAClass.AVAButton}
            style={{ color: 'red', marginTop: '1.5em', marginInline: 'auto', maxWidth: '30px' }}
            size='small'
            onClick={() => {
              reactData.select_user = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
          >
            Back
          </Button>
        </Dialog>
      }
      { /* 
          We know who the current user is
          Resident mode selected 
          Current status is IN, so they are checking OUT
        */
        reactData.validated_user
        && reactData.resident_mode
        && (['in', 'none'].includes(reactData.currentStatus.last_status))
        &&
        <AVATextInput
          titleText={makeGreeting(reactData.personRec.name.first)}
          promptText={["(Optional) What is your destination?", "How long will you be gone?"]}
          buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
          onCancel={() => {
            reactData.validated_user = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onSave={async ([destination, time_away]) => {
            let now = makeDate(new Date());
            reactData.currentStatus.reqRec.last_status = 'out';
            reactData.currentStatus.reqRec.last_update = now.timestamp;
            let hNote = `Checked out on ${now.absolute}`;
            if (destination) { hNote += ` Destination: ${destination}.`; }
            if (time_away) { hNote += ` Planned time away: ${time_away}.`; }
            reactData.currentStatus.reqRec.history.unshift(hNote);
            await updateServiceRequest(reactData.currentStatus.reqRec);
            enqueueSnackbar(`Got it!  Thank you!`, { variant: 'success', persist: false });
            reset();
          }}
          allowCancel={true}
        />
      }
      {  /* 
          We know who the current user is
          Resident mode selected 
          Current status is OUT, so they are checking IN
        */
        reactData.validated_user
        && reactData.resident_mode
        && (reactData.currentStatus.last_status === 'out')
        &&
        <AVAConfirm
          promptText={`Welcome home, ${reactData.personRec.name.first}!`}
          cancelText={`Cancel`}
          confirmText={`Check-in`}
          onCancel={() => {
            reactData.validated_user = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onConfirm={async () => {
            let now = makeDate(new Date());
            reactData.currentStatus.reqRec.last_status = 'in';
            reactData.currentStatus.reqRec.last_update = now.timestamp;
            let hNote = `Checked in on ${now.absolute}`;
            reactData.currentStatus.reqRec.history.unshift(hNote);
            await updateServiceRequest(reactData.currentStatus.reqRec);
            enqueueSnackbar(`You're all set!`, { variant: 'success', persist: false });
            reset();
          }}
          allowCancel={true}
        />
      }
      { /* 
          We don't know who the current user is
          Guest mode selected 
        */
        !reactData.validated_user
        && reactData.guest_mode
        &&
        <AVATextInput
          titleText={`Welcome to ${state.session.client_name}!`}
          promptText={["Name", "Phone number"]}
          buttonText={['Look me up', 'Start over']}
          onCancel={() => {
            reactData.errorText = [];
            reactData.guest_mode = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          errorText={reactData.errorText}
          onSave={async ([enteredID, enteredNumber]) => {
            if (!enteredID) {
              reactData.errorText[0] = `Please enter your name so we can properly identify you!`;
            }
            else if (enteredID === 'exit') {
              onClose();
            }
            if (!enteredNumber) {
              reactData.errorText[1] = `For security, we use this information for validation.  Please enter a phone number with area code.  Thanks! `;
            }
            if (enteredID && enteredNumber) {
              let validation = await validateUser(enteredID, enteredNumber, state.session.client_id, true);
              reactData.errorText = [];
              if (validation.result === 'match') {
                reactData.validated_user = true;
                reactData.personRec = validation.personRec;
                reactData.currentStatus = await getCurrentStatus(state.session.client_id, validation.personRec.person_id);
              }
              else if (validation.error_field !== 0) {
                reactData.errorText[validation.error_field] = validation.reason;
              }
              else {
                /* This is an unknown person */
                reactData.validated_user = true;
                reactData.add_guest_mode = true;
                reactData.enteredID = enteredID;
                reactData.enteredNumber = enteredNumber;
              }
            }
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          allowCancel={true}
        />
      }
      { /*
          Guest mode
          Previously unknown user that must be created
          Assume checking IN
        */
        reactData.add_guest_mode
        &&
        <AVATextInput
          titleText={makeGreeting(titleCase(reactData.enteredID.split(/\s/)[0]))}
          promptText={["Please enter your full name", "What is your phone number", "Who are you visiting today?"]}
          valueText={[titleCase(reactData.enteredID), formatPhone(reactData.enteredNumber), '']}
          buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
          onCancel={() => {
            reactData.validated_user = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          errorText={reactData.errorText}
          onSave={async ([guestName, contactNumber, destination]) => {
            reactData.errorText = [];
            let gNames = titleCase(guestName.trim()).split(/\s+/);
            if (gNames.length < 2) {
              reactData.errorText[0] = `Please enter your full name`;
            }
            let gPhone = Number(contactNumber.replace(/\D/g, ''));
            if (gPhone < 1000000000) {
              reactData.errorText[1] = `Please enter your area code and phone number`;
            }
            let residentRec = await getPersonByWords(state.session.client_id, destination.trim().split(/\s+/));
            switch (residentRec.length) {
              case 0: {
                reactData.errorText[2] = `We don't find anyone to match "${destination}".`;
                break;
              }
              case 1: {
                break;
              }
              default: {
                reactData.errorText[2] = `There are ${residentRec.length} matches for "${destination}".  Can you be more specific?`;
                break;
              }
            }
            let guestAdd = {};
            let gLast = gNames.pop();
            let gFirst = gNames.join(' ');
            if (reactData.errorText.length === 0) {
              guestAdd = await addGuest({
                name: {
                  first: gFirst,
                  last: gLast
                },
                sms: `+1${gPhone}`,
                client_id: state.session.client_id
              });
              if (guestAdd.result !== 'success') {
                reactData.errorText[0] = `Something went wrong.  Please see the Receptionist.  Error: ${guestAdd.message}`;
              }
            }
            if (reactData.errorText.length === 0) {
              let now = makeDate(new Date());
              let hNote = `Checked in on ${now.absolute}`;
              hNote += ` Visiting ${residentRec[0].name.first} ${residentRec[0].name.last}${residentRec[0].location ? ' at ' + residentRec[0].location : ''}`;
              await updateServiceRequest(
                {
                  client_id: state.session.client_id,
                  request_id: `${guestAdd.personRec.person_id}_checkout`,
                  requestor: guestAdd.personRec.person_id,
                  on_behalf_of: `${residentRec[0].name.first} ${residentRec[0].name.last}`,
                  request_type: 'checkout',
                  request_date: now.timestamp,
                  original_request: {},
                  history: [hNote],
                  local_key: `${guestAdd.personRec.person_id}_checkout`,
                  foreign_key: 'guest',
                  last_update: now.timestamp,
                  last_status: 'in'
                }
              );
              reset();
            }
            else {
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }
          }} /* end of onSave */
          allowCancel={true}
        />
      }
      { /* 
          We know who the current user is
          Guest mode selected 
          Current status is IN, so they are checking OUT
        */
        reactData.validated_user
        && (reactData.guest_mode && !reactData.add_guest_mode)
        && ((reactData.currentStatus) && (reactData.currentStatus.last_status) && (reactData.currentStatus.last_status === 'in'))
        &&
        <AVAConfirm
          promptText={`Thanks for visiting ${state.session.client_name}, ${reactData.personRec.name.first}!`}
          cancelText={`Cancel`}
          confirmText={`Check-out`}
          onCancel={() => {
            reactData.validated_user = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onConfirm={async () => {
            let now = makeDate(new Date());
            reactData.currentStatus.reqRec.last_status = 'out';
            reactData.currentStatus.reqRec.last_update = now.timestamp;
            let hNote = `Checked out on ${now.absolute}`;
            reactData.currentStatus.reqRec.history.unshift(hNote);
            await updateServiceRequest(reactData.currentStatus.reqRec);
            enqueueSnackbar(`You're all set!`, { variant: 'success', persist: false });
            reset();
          }}
          allowCancel={true}
        />
      }
      {  /* 
          We know who the current user is
          Guest mode selected 
          Current status is OUT, so they are checking IN
        */
        reactData.validated_user
        && (reactData.guest_mode && !reactData.add_guest_mode)
        && ((!reactData.currentStatus) || (!reactData.currentStatus.last_status) || (['out', 'none'].includes(reactData.currentStatus.last_status)))
        &&
        <AVATextInput
          titleText={`Welcome back, ${reactData.personRec.name.first}!`}
          promptText={["Who are you visiting today?"]}
          valueText={[(reactData.currentStatus ? reactData.currentStatus.reqRec.on_behalf_of : '')]}
          buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
          onCancel={() => {
            reactData.validated_user = false;
            setReactData(reactData);
            setForceRedisplay(!forceRedisplay);
          }}
          onSave={async ([destination]) => {
            let hWho;
            if (destination !== reactData.currentStatus.reqRec.on_behalf_of) {
              let residentRec = await getPersonByWords(state.session.client_id, destination.trim().split(/\s+/));
              switch (residentRec.length) {
                case 0: {
                  reactData.errorText[0] = `We don't find anyone to match "${destination}".`;
                  break;
                }
                case 1: {
                  hWho = ` Visiting ${residentRec[0].name.first} ${residentRec[0].name.last} at ${residentRec[0].location}`;
                  break;
                }
                default: {
                  reactData.errorText[0] = `There are ${residentRec.length} matches for "${destination}".  Can you be more specific?`;
                  break;
                }
              }
            }
            else {
              hWho = ` Visiting ${reactData.currentStatus.reqRec.on_behalf_of}`;
            }
            if (reactData.errorText.length === 0) {
              let now = makeDate(new Date());
              reactData.currentStatus.reqRec.last_status = 'in';
              reactData.currentStatus.reqRec.last_update = now.timestamp;
              let hNote = `Checked in on ${now.absolute}`;
              hNote += hWho;
              reactData.currentStatus.reqRec.history.unshift(hNote);
              await updateServiceRequest(reactData.currentStatus.reqRec);
              enqueueSnackbar(`Got it!  Thank you!`, { variant: 'success', persist: false });
              reset();
            }
            else {
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }
          }}
          allowCancel={true}
        />
      }
    </Dialog>
  );
};