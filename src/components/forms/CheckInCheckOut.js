import React from 'react';
import AVATextInput from './AVATextInput';

import Dialog from '@material-ui/core/Dialog';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import { isEmpty, titleCase, getCustomizations } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { determineClass } from '../../util/AVAGroups';
import { getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import { getPerson, getImage, getPersonByWords, addGuest, addVendor, makeName } from '../../util/AVAPeople';
import { AVAclasses } from '../../util/AVAStyles';

import { useSnackbar } from 'notistack';

import useSession from '../../hooks/useSession';
import AVAConfirm from './AVAConfirm';

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
      guest_vendor: false,
      resident_mode: false,
      add_guest_mode: false,
      adminOverride: false,
      adminIndex: -1,
      outList: [],
      adminView: false,
      initialized: false
    }
  );

  // Initialization

  React.useEffect(() => {
    async function initialize() {
      let customRec = await getCustomizations('resident_checkout_prompts', state.session.client_id);
      reactData.residentPrompts = customRec.customization_value || [];
      reactData.initialized = true;
      setReactData(reactData);
      setForceRedisplay(!forceRedisplay);
    }
    initialize();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps



  // Functions

  async function validateUser(IDString, client_id, nonRes) {
    if (!IDString) { return { result: 'invalid', error_field: 0, reason: 'The ID field is empty' }; }
    // get candidates from the words entered
    let personRecs = [];
    let ID_words = IDString.trim().split(/\s+/);
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
    for (let p = 0; p < personRecs.length; p++) {
      personRecs[p].account_class = determineClass(personRecs[p].groups, state.session.group_assignments);
      if (personRecs[p].messaging.voice) { personRecs[p].phone_key = `(xxx) xxx-${personRecs[p].messaging.voice.slice(-4)}`; }
      else if (personRecs[p].messaging.sms) { personRecs[p].phone_key = `(xxx) xxx-${personRecs[p].messaging.sms.slice(-4)}`; }
    }
    switch (personRecs.length) {
      case 0: {
        return { result: 'invalid', error_field: 1, reason: `That information doesn't match any ${nonRes ? titleCase(nonRes) : 'Resident'} accounts that we can find` };
      }
      case 1: {
        return { result: 'match', person_id: personRecs[0].person_id, personRec: personRecs[0] };
      }
      default: {
        return {
          result: 'ambiguous',
          error_field: 1,
          reason: `"${IDString}" matches more than one ${nonRes ? titleCase(nonRes) : 'Resident'} account`,
          candidates: personRecs
        };
      }
    }
  }

  async function getCurrentStatus(client_id, person_id, mode) {
    let reqArray = await getServiceRequests({ client_id, person_id, foreign_key: mode, request_type: "checkout" });
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
          "on_behalf_of": `${state.patient.name.first} ${state.patient.name.last}`,
          "request_type": 'checkout',
          "request_date": now,
          "original_request": {},
          "history": [],
          "local_key": `${person_id}_checkout`,
          "foreign_key": mode,
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
    let checkedInGuests = [];
    let checkedInVendors = [];
    let outSorter = [];
    let guestSorter = [];
    let vendorSorter = [];
    if (reqArray.length > 0) {
      reqArray.forEach((c, x) => {
        if ((c.last_status === 'out') && (c.foreign_key === 'resident')) {
          outSorter.push(`${c.last_update}~${x}`);
        }
        else if ((c.last_status === 'in') && (c.foreign_key === 'guest')) {
          guestSorter.push(`${c.last_update}~${x}`);
        }
        else if ((c.last_status === 'in') && (c.foreign_key === 'vendor')) {
          vendorSorter.push(`${c.last_update}~${x}`);
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
      guestSorter.sort();
      for (let x = 0; x < guestSorter.length; x++) {
        let c = reqArray[Number(guestSorter[x].split('~')[1])];
        checkedInGuests.push({
          person_id: c.requestor,
          reqRec: c,
          last_update: c.last_update,
          name: await makeName(c.requestor),
          message: c.history[0].replace('Checked in', '').trim()
        });
      }
      vendorSorter.sort();
      for (let x = 0; x < vendorSorter.length; x++) {
        let c = reqArray[Number(vendorSorter[x].split('~')[1])];
        checkedInVendors.push({
          person_id: c.requestor,
          reqRec: c,
          last_update: c.last_update,
          name: await makeName(c.requestor),
          message: c.history[0].replace('Checked in', '').trim()
        });
      }
    }
    return [checkedOutList, checkedInGuests, checkedInVendors];
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
      staff_mode: false,
      add_guest_mode: false,
      adminOverride: false,
      adminIndex: -1,
      outList: [],
      adminView: false,
      initialized: true
    });
    setForceRedisplay(!forceRedisplay);
  }

  function determineMode(personRec) {
    reactData.resident_mode = false;
    reactData.guest_mode = false;
    reactData.staff_mode = false;
    reactData.other_mode = false;
    let mode;
    switch (personRec.account_class) {
      case 'staff':
      case 'admin': {
        reactData.staff_mode = true;
        mode = 'resident';
        break;
      }
      case 'resident': {
        reactData.resident_mode = true;
        mode = 'resident';
        break;
      }
      case 'vendor': {
        reactData.guest_mode = true;
        mode = 'vendor';
        break;
      }
      case 'other': {
        reactData.other_mode = true;
        mode = 'other';
        break;
      }
      default: {
        reactData.guest_mode = true;
        mode = 'guest';
      }
    }
    return mode;
  }

  function makeGreeting(pName) {
    if (state.session?.custom_greeting) { return `${state.session.custom_greeting}${pName ? ', ' + pName : ''}!`; }
    else { return `Good ${makeDate(new Date()).dayPart}${pName ? ', ' + pName : ''}!`; }
  }

  return (
    <Dialog
      open={(!!reactData.initialized) && (true || forceRedisplay)}
      p={2}
      fullScreen
    >
      {/* *** CHECK-IN/OUT VIEW *** */
        !reactData.adminView &&
        <React.Fragment>
          { /* **********************************
               We don't know who this is yet
               ********************************** */
            !reactData.validated_user && !reactData.add_guest_mode &&
            (!reactData.select_user ?
              <Dialog open={forceRedisplay || true} fullWidth >
                <AVATextInput
                  titleText={[(`Welcome to ${state.session.client_name}`)]}
                  promptText={["Name or AVA ID"]}
                  valueText={[
                    (!reactData.kiosk_mode ? reactData.residentName : '')
                  ]}
                  buttonText={[(!reactData.kiosk_mode ? 'Confirm' : 'Lookup'), 'Exit', (state.session.adminAccount ? 'Admin' : null)]}
                  onCancel={() => {
                    onClose();
                  }}
                  errorText={reactData.errorText}
                  onSave={async ([enteredID], buttonPressed) => {
                    if (buttonPressed === 2) {
                      let [outList, guestList, vendorList] = await getCheckedOut();
                      reactData.outList = outList;
                      reactData.guestList = guestList;
                      reactData.vendorList = vendorList;
                      reactData.adminView = true;
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }
                    if (!enteredID) {
                      reactData.errorText[0] = `Please enter your name or AVA ID so we can properly identify you!`;
                    }
                    else if (enteredID === 'exit') {
                      onClose();
                    }
                    if (enteredID) {
                      let validation = {};
                      if (enteredID === reactData.residentName) {
                        validation = {
                          result: 'match',
                          person_id: reactData.personRec.person_id,
                          personRec: reactData.personRec,
                        };
                        validation.personRec.account_class = determineClass(reactData.personRec.groups, state.session.group_assignments);
                      }
                      else {
                        validation = await validateUser(enteredID.toLowerCase(), state.session.client_id);
                      }
                      reactData.errorText = [];
                      reactData.enteredID = enteredID;
                      if ((validation.result === 'match') && (validation.personRec.person_id === state.patient.person_id)) {  // Found myself
                        reactData.validated_user = true;
                        reactData.personRec = validation.personRec;
                        let mode = determineMode(validation.personRec);
                        reactData.currentStatus = await getCurrentStatus(state.session.client_id, validation.personRec.person_id, mode);
                        reactData.select_user = false;
                      }
                      else if ((validation.result === 'match') || (validation.result === 'ambiguous')) {
                        reactData.select_user = true;
                        reactData.candidates = validation.candidates || [validation.personRec];
                      }
                      else {
                        // put AVA in "add a new guest" mode
                        reactData.select_user = false;
                        reactData.add_guest_mode = true;
                        reactData.add_try_number = 1;
                      }
                    }
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                  }}
                  allowCancel={!reactData.kiosk_mode}
                  options={{ save_on_enter: true }}
                />
              </Dialog>
              :
              <Dialog open={forceRedisplay || true} fullWidth >
                <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography variant='h5' id='dialog-title'>{makeGreeting()}</Typography>
                  <Typography variant='subtitle2' id='dialog-title'>{`Please select from this list or tap "None of these"`}</Typography>
                </Box>
                <Paper component={Box} style={{ paddingTop: '16px' }} overflow='auto' square>
                  {reactData.candidates.map((candidate, cIndex) => (
                    <Box display='flex'
                      style={{ marginBottom: '2em', marginLeft: '1em', }}
                      flexDirection='row' key={`ambiguous-${cIndex}`} justifyContent='flex-start' alignItems='center'
                      paddingX={2}
                      paddingY={1}
                      marginRight={2}
                      minWidth={'90%'}
                      border={1}
                      borderRadius={'16px'}
                      onClick={async () => {
                        reactData.validated_user = true;
                        reactData.personRec = candidate;
                        let mode = determineMode(candidate);
                        reactData.currentStatus = await getCurrentStatus(state.session.client_id, candidate.person_id, mode);
                        reactData.select_user = false;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                    >
                      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                        <Typography variant='h5'>{`${titleCase(candidate.name.first)} ${titleCase(candidate.name.last)}`}</Typography>
                        <Typography style={{ fontSize: '0.8em' }} variant='h6'>{`${titleCase(candidate.account_class)} - ${(candidate.phone_key || candidate.location)}`}</Typography>
                      </Box>
                    </Box>
                  )
                  )}
                </Paper>
                <Box display='flex' flexDirection='row' paddingY={2} justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => {
                      reactData.select_user = false;
                      reset();
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                  >
                    Start over
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                    size='small'
                    onClick={() => {
                      // put AVA in "add a new guest" mode
                      reactData.select_user = false;
                      reactData.add_guest_mode = true;
                      reactData.add_try_number = 1;
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                  >
                    None of these
                  </Button>
                </Box>
              </Dialog>
            )
          }
          { /* **********************************
               We are checking in/out a Resident
               ********************************** */
            reactData.validated_user
            && (reactData.resident_mode || reactData.staff_mode)
            &&
            (['in', 'none'].includes(reactData.currentStatus.last_status) ?
              <AVATextInput
                titleText={[makeGreeting(reactData.personRec.name.first), `Check out - ${makeDate(new Date()).absolute}`]}
                promptText={reactData.residentPrompts || []}
                buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
                onCancel={() => {
                  reactData.validated_user = false;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }
                }
                onSave={async (responses) => {
                  let now = makeDate(new Date());
                  reactData.currentStatus.reqRec.last_status = 'out';
                  reactData.currentStatus.reqRec.last_update = now.timestamp;
                  let hNote = `Checked out on ${now.absolute}`;
                  responses.forEach((r, x) => {
                    if (r && reactData.residentPrompts) {
                      hNote += ` ${reactData.residentPrompts[x]}: ${r}.`;
                    }
                  });
                  reactData.currentStatus.reqRec.history.unshift(hNote);
                  await updateServiceRequest(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`Got it!  Thank you!`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
                options={{ save_on_enter: (reactData.residentPrompts && (reactData.residentPrompts.length === 1)) }}

              />
              :
              <AVAConfirm
                promptText={[`Welcome home, ${reactData.personRec.name.first}!`, `[italic]Checked out ${makeDate(reactData.currentStatus.reqRec.last_update).relative}`]}
                cancelText={`Cancel`}
                confirmText={`Check-in`}
                onCancel={() => {
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else {
                    reactData.validated_user = false;
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                  }
                }}
                onConfirm={async () => {
                  let now = makeDate(new Date());
                  reactData.currentStatus.reqRec.last_status = 'in';
                  reactData.currentStatus.reqRec.last_update = now.timestamp;
                  let hNote = `Checked in on ${now.absolute}`;
                  reactData.currentStatus.reqRec.history.unshift(hNote);
                  await updateServiceRequest(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`You're all set!`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
              />
            )
          }
          { /* **********************************
               We are checking in/out a Guest or Vendor
               ********************************** */
            reactData.validated_user
            && reactData.guest_mode
            &&
            (['in', 'none'].includes(reactData.currentStatus.last_status) ?
              <AVAConfirm
                promptText={[`Thanks for visiting ${state.session.client_name}, ${reactData.personRec.name.first}!`, `[italic]${reactData.currentStatus.reqRec.history[0]}`]}
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
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
              />
              :
              <AVATextInput
                titleText={`Welcome back, ${reactData.personRec.name.first}!`}
                promptText={["Who are you visiting today?"]}
                valueText={[(reactData.currentStatus ? reactData.currentStatus.reqRec.on_behalf_of : '')]}
                buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
                errorText={reactData.errorText}
                onCancel={() => {
                  reactData.errorText = [];
                  reactData.validated_user = false;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
                onSave={async ([destination]) => {
                  reactData.errorText = [];
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
                    if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                    else { reset(); }
                  }
                  else {
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                  }
                }}
                options={{ save_on_enter: true }}
                allowCancel={true}
              />
            )
          }
          { /* **********************************
               Other/Error mode - You are not allowed to check-in/out
               ********************************** */
            reactData.validated_user
            && reactData.other_mode
            &&
            <AVAConfirm
              promptText={[`Thanks for visiting ${state.session.client_name}`, `[italic]Please check with the Reception Desk to continue`]}
              confirmText={`Exit`}
              onCancel={async () => {
                reactData.validated_user = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              onConfirm={async () => {
                reactData.validated_user = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              allowCancel={false}
            />
          }
          { /* ************************************
               Previously unknown user that must be created
               ************************************ */
            reactData.add_guest_mode
            &&
            <AVATextInput
              titleText={[makeGreeting(titleCase(reactData.enteredID.split(/\s/)[0])), 'We need to create an new account for you']}
              promptText={["Please enter your full name", "(Vendors only) What Company do you represent?", "What is your phone number", "Who are you visiting today?"]}
              valueText={[titleCase(reactData.enteredID), '', '']}
              buttonText={[((reactData.add_try_number === 1) ? 'Save my info' : 'Confirm'), (reactData.kiosk_mode ? 'Start over' : 'Back')]}
              onCancel={() => {
                reactData.validated_user = false;
                reactData.add_guest_mode = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              errorText={reactData.errorText}
              onSave={async ([guestName, vendorCompany, contactNumber, destination]) => {
                reactData.errorText = [];
                if (reactData.enteredID.toLowerCase() !== guestName.toLowerCase()) {
                  let validation = await validateUser(guestName, state.session.client_id);
                  reactData.enteredID = guestName;
                  if ((validation.result === 'match') || (validation.result === 'ambiguous')) {
                    reactData.select_user = true;
                    reactData.candidates = validation.candidates || [validation.personRec];
                    reactData.add_guest_mode = false;
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                    return;
                  }
                }
                let gNames = titleCase(guestName.trim()).split(/\s+/);
                let gLast, gFirst;
                if (gNames.length < 2) {
                  reactData.errorText[0] = `Please enter your full name`;
                }
                else {
                  gLast = gNames.pop();
                  gFirst = gNames.join(' ');
                }
                let dNames = (destination ? titleCase(destination.trim()).split(/\s+/) : []);
                let dLast, dFirst;
           //     if (dNames.length < 2) {
           //       reactData.errorText[3] = `Please enter the full name of the person you are visiting`;
           //     }
           //     else {
                  dLast = dNames.pop();
                  dFirst = dNames.join(' ');
          //      }
                let gPhone = Number(contactNumber.replace(/\D/g, ''));
                if (gPhone < 1000000000) {
                  reactData.errorText[1] = `Please enter your area code and phone number`;
                }
                let residentRec = {};
                if (reactData.errorText.length === 0) {
                  residentRec = await getPersonByWords(state.session.client_id, destination.trim().split(/\s+/));
                  switch (residentRec.length) {
                    case 0: {
                      if (reactData.add_try_number === 1) {
                        reactData.errorText[3] = `We don't find anyone to match "${destination}".  Please confirm this is correct.`;
                      }
                      else {
                        residentRec = [{ name: { first: (dFirst || ''), last: (dLast || destination) } }];
                      }
                      break;
                    }
                    case 1: {
                      break;
                    }
                    default: {
                      if (reactData.add_try_number === 1) {
                        reactData.errorText[3] = `There are ${residentRec.length} matches for "${destination}".  Please be more specific if you can, and confirm the name.`;
                      }
                      break;
                    }
                  }
                }
                if (reactData.errorText.length === 0) {
                  let addedPerson = {};
                  let newPersonRec = {
                    name: {
                      first: gFirst,
                      last: gLast
                    },
                    sms: `+1${gPhone}`,
                    client_id: state.session.client_id
                  };
                  if (vendorCompany) {
                    newPersonRec.location = `Vendor - ${vendorCompany}`;
                    addedPerson = await addVendor(newPersonRec);
                  }
                  else {
                    newPersonRec.location = 'Guest';
                    addedPerson = await addGuest(newPersonRec);
                  }
                  if (addedPerson.result !== 'success') {
                    reactData.errorText[0] = `Something went wrong.  Please see the Receptionist.  Error: ${addedPerson.message}`;
                  }
                  else {
                    let now = makeDate(new Date());
                    let hNote = `Checked in on ${now.absolute}`;
                    hNote += ` Visiting ${residentRec[0].name.first} ${residentRec[0].name.last}${residentRec[0].location ? ' at ' + residentRec[0].location : ''}`;
                    await updateServiceRequest(
                      {
                        client_id: state.session.client_id,
                        request_id: `${addedPerson.personRec.person_id}_checkout`,
                        requestor: addedPerson.personRec.person_id,
                        on_behalf_of: `${residentRec[0].name.first} ${residentRec[0].name.last}`,
                        request_type: 'checkout',
                        request_date: now.timestamp,
                        original_request: (vendorCompany ? { "vendor_company": [vendorCompany] } : {}),
                        history: [hNote],
                        local_key: `${addedPerson.personRec.person_id}_checkout`,
                        foreign_key: (vendorCompany ? 'vendor' : 'guest'),
                        last_update: now.timestamp,
                        last_status: 'in'
                      }
                    );
                    enqueueSnackbar(`You're all set, ${gFirst}!  Have a great visit!`, { variant: 'success', persist: false });
                    reactData.validated_user = false;
                    reactData.add_guest_mode = false;
                    reset();
                  }
                }
                else {
                  reactData.add_try_number++;
                }
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }} /* end of onSave */
              allowCancel={true}
            />
          }
        </React.Fragment>
      }
      {/* *** ADMIN (REPORTING) VIEW *** */
        reactData.adminView &&
        <React.Fragment>
          { /* **********************************
               Reporting all data
               ********************************** */
            (!reactData.adminOverride ?
              <Dialog open={forceRedisplay || true} fullWidth >
                <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography variant='h5' key={`title1`} style={{ fontWeight: 'bold' }}>
                    {`Check-in/out status`}
                  </Typography>
                  <Typography variant='h5' key={`title2`} style={{ fontWeight: 'bold' }}>
                    {`as of ${makeDate(new Date()).absolute}`}
                  </Typography>
                </Box>
                <Paper component={Box} style={{ paddingTop: '16px' }} overflow='auto' square>
                  <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                    <Typography variant='h6' id='dialog-title'>{'Residents currently checked-out'}</Typography>
                    {(reactData.outList.length === 0) &&
                      <Box style={{ paddingTop: '-8px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'>
                        <Typography><i>No residents currently checked out</i></Typography>
                      </Box>
                    }
                    {(reactData.outList.length > 0)
                      && reactData.outList.map((outRow, outNdx) => (
                        <Box
                          style={{ paddingBottom: '2em' }}
                          display='flex'
                          flexDirection='row'
                          justifyContent='flex-start'
                          key={`outList_${outNdx}`}
                          alignItems='center'
                          onClick={async () => {
                            reactData.adminOverride = true;
                            reactData.resident_mode = true;
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
                            alt=' '
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
                    <Typography variant='h6' id='dialog-title'>{'Guests still checked-in'}</Typography>
                    {(reactData.guestList.length === 0) &&
                      <Box style={{ paddingTop: '-8px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'>
                        <Typography><i>No guests currently checked in</i></Typography>
                      </Box>
                    }
                    {(reactData.guestList.length > 0) && reactData.guestList.map((inRow, inNdx) => (
                      <Box style={{ paddingBottom: '2em' }}
                        display='flex'
                        flexDirection='row'
                        key={`guestList_${inNdx}`}
                        justifyContent='flex-start'
                        alignItems='center'
                        onClick={async () => {
                          reactData.adminOverride = true;
                          reactData.guest_mode = true;
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
                  <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                    <Box display='flex' style={{ marginTop: '1.5em', marginBottom: '1.5em' }} flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                      <Typography variant='h6' id='dialog-title'>{'Vendors still checked-in'}</Typography>
                    </Box>
                    {(reactData.vendorList.length === 0) &&
                      <Box style={{ paddingTop: '-8px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'>
                        <Typography><i>No vendors currently checked in</i></Typography>
                      </Box>
                    }
                    {(reactData.vendorList.length > 0) && reactData.vendorList.map((inRow, inNdx) => (
                      <Box style={{ paddingBottom: '2em' }}
                        display='flex'
                        flexDirection='row'
                        key={`vendorList_${inNdx}`}
                        justifyContent='flex-start'
                        alignItems='center'
                        onClick={async () => {
                          reactData.adminOverride = true;
                          reactData.vendor_mode = true;
                          reactData.adminIndex = inNdx;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                      >
                        <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                          <Typography><b>{inRow.name}</b></Typography>
                          <Typography>{inRow.reqRec.original_request.vendor_company[0]}</Typography>
                          <Typography variant='subtitle2' style={{ marginLeft: '20px' }}>{inRow.message}</Typography>
                        </Box>
                      </Box>
                    )
                    )}
                  </Box>
                </Paper>
                <Box display='flex' flexDirection='row' marginTop={1} paddingBottom={1} justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => {
                      reset();
                    }}
                  >
                    Back
                  </Button>
                </Box>
              </Dialog>
              :
              <React.Fragment>
                {reactData.resident_mode &&
                  <AVAConfirm
                    promptText={`Confirm override check-in for ${reactData.outList[reactData.adminIndex].name}`}
                    cancelText={`Cancel`}
                    confirmText={`Check-in`}
                    onCancel={() => {
                      reactData.adminOverride = false;
                      reactData.resident_mode = false;
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
                      reactData.adminOverride = false;
                      reactData.resident_mode = false;
                      reactData.outList.splice(reactData.adminIndex, 1);
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    allowCancel={true}
                  />
                }
                {reactData.vendor_mode &&
                  <AVAConfirm
                    promptText={`Confirm override check-out for ${reactData.vendorList[reactData.adminIndex].name}`}
                    cancelText={`Cancel`}
                    confirmText={`Check-out`}
                    onCancel={() => {
                      reactData.adminOverride = false;
                      reactData.vendor_mode = false;
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    onConfirm={async () => {
                      let reqRec = reactData.vendorList[reactData.adminIndex].reqRec;
                      let now = makeDate(new Date());
                      reqRec.last_status = 'out';
                      reqRec.last_update = now.timestamp;
                      let hNote = `Checked out by ${state.session.user_display_name} on ${now.absolute}`;
                      reqRec.history.unshift(hNote);
                      await updateServiceRequest(reqRec);
                      enqueueSnackbar(`Check-out is complete!`, { variant: 'success', persist: false });
                      reactData.adminOverride = false;
                      reactData.vendor_mode = false;
                      reactData.vendorList.splice(reactData.adminIndex, 1);
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    allowCancel={true}
                  />
                }
                {reactData.guest_mode &&
                  <AVAConfirm
                    promptText={`Confirm override check-out for ${reactData.guestList[reactData.adminIndex].name}`}
                    cancelText={`Cancel`}
                    confirmText={`Check-out`}
                    onCancel={() => {
                      reactData.adminOverride = false;
                      reactData.guest_mode = false;
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    onConfirm={async () => {
                      let reqRec = reactData.guestList[reactData.adminIndex].reqRec;
                      let now = makeDate(new Date());
                      reqRec.last_status = 'out';
                      reqRec.last_update = now.timestamp;
                      let hNote = `Checked out by ${state.session.user_display_name} on ${now.absolute}`;
                      reqRec.history.unshift(hNote);
                      await updateServiceRequest(reqRec);
                      enqueueSnackbar(`Check-out is complete!`, { variant: 'success', persist: false });
                      reactData.adminOverride = false;
                      reactData.guest_mode = false;
                      reactData.guestList.splice(reactData.adminIndex, 1);
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    allowCancel={true}
                  />
                }
                )
              </React.Fragment>
            )
          }
        </React.Fragment>
      }
    </Dialog>
  );
};