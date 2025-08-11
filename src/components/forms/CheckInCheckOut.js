import React from 'react';
import AVATextInput from './AVATextInput';

import { Snackbar, Dialog, Box, Button, Paper, Typography } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import { isEmpty, titleCase, dbClient, cl } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { determineClass } from '../../util/AVAGroups';
import { getServiceRequests, putServiceRequest, updateServiceRequest } from '../../util/AVAServiceRequest';
import { getPerson, getImage, getPersonByWords, addGuest, addVendor, makeName } from '../../util/AVAPeople';
import { AVAclasses, AVADefaults, AVATextStyle, AVATextVariableStyle } from '../../util/AVAStyles';

// import { useSnackbar } from 'notistack';

import useSession from '../../hooks/useSession';
import AVAConfirm from './AVAConfirm';
import { isPhoneNumber } from '../../util/AVAUtilities';
import { formatPhone } from '../../util/AVAPeople';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
  AVAClientBackground: {
    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).backgroundColor : null,
    borderRadius: '30px',
    padding: 5
  },
  AVAPromptBackground: {
    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null,
    borderRadius: '30px',
    padding: 5
  }
}));

export default ({ onSave, onClose }) => {

  const isMounted = React.useRef(false);
  const classes = useStyles();
  const AVAClass = AVAclasses();
  // const { enqueueSnackbar } = useSnackbar();
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
      enteredDestination: false,
      guest_mode: false,
      guest_vendor: false,
      resident_mode: false,
      add_guest_mode: false,
      adminOverride: false,
      adminIndex: -1,
      outList: [],
      adminView: false,
      initialized: false,
      alert: false
    }
  );

  const updateReactData = (newData, force = false) => {
    if (isMounted.current) {
      setReactData((prevValues) => (Object.assign(
        prevValues,
        newData
      )));
      if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
    }
  };

  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialization

  React.useEffect(() => {
    async function initialize() {
      reactData.initialized = true;
      reactData.marquee_message = JSON.parse(sessionStorage.getItem('marquee_message'));
      setReactData(reactData);
      setForceRedisplay(!forceRedisplay);
    }
    isMounted.current = true;
    initialize();
    return () => {
      isMounted.current = false;
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps



  // Functions

  const enqueueSnackbar = (message, options) => {
    updateReactData({
      alert: {
        severity: options.variant || 'info',
        title: options.title || 'Check-in / Check-out',
        message,
        action: []
      }
    }, true);
  };

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
    personRecs = personRecs.filter(p => { return (p.account_class !== 'inactive'); });
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
          "on_behalf_of": `${reactData.personRec.name.first} ${reactData.personRec.name.last}`,
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
      for (let x = 0; x < outSorter.length; x++) {
        let c = reqArray[Number(outSorter[x].split('~')[1])];
        checkedOutList.push({
          person_id: c.requestor,
          reqRec: c,
          last_update: c.last_update,
          name: await makeName(c.requestor),
          message: c.history[0].replace('Checked out', '').trim()
        });
      };
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

  async function checkGuestInput(responses) {
    let errorText = [];
    let obo;
    if (!state.session.guest_checkout_prompts) {
      state.session.guest_checkout_prompts = [{
        prompt: "Who are you visiting today?",
        checkName: true,
        required: false,
        checkSensitivity: 'warning',
        value: 'Visiting'
      }];
    }
    let nameIndex = -1;
    for (let [x, this_prompt] of state.session.guest_checkout_prompts.entries()) {
      if (this_prompt.required && !responses[x]) {
        errorText[x] = `Please don't leave this blank!`;
      }
      else if (this_prompt.checkName) {
        nameIndex = x;
        obo = titleCase(responses[x]);
        responses[x] = obo;
        if ((state.session.guest_checkout_prompts[nameIndex].checkSensitivity === 'error')
          || !reactData.previouslyEnteredDestination
          || (responses[x].toLowerCase() !== reactData.previouslyEnteredDestination.toLowerCase())
        ) {
          let residentRec = await getPersonByWords(state.session.client_id, responses[x].trim().split(/\s+/));
          switch (residentRec.length) {
            case 0: {
              errorText[x] = `We don't find anyone to match "${responses[x]}".  Please confirm this is correct.`;
              reactData.previouslyEnteredDestination = responses[x];
              break;
            }
            case 1: {
              obo = (`${residentRec[0].name.first.trim()} ${residentRec[0].name.last.trim()}${residentRec[0].location ? ' (' + residentRec[0].location + ')' : ''}`).trim();
              responses[x] = obo;
              break;
            }
            default: {
              errorText[x] = `There are ${residentRec.length} matches for "${responses[x]}".  Please be more specific if you can, and confirm the name.`;
              break;
            }
          }
        }
      }
    };
    return { obo, errorText, responses };
  }

  async function putCheckout(reqRec, options) {
    await updateServiceRequest(reqRec);
    let requestor = reactData.personRec.person_id;
    if (['vendor', 'guest'].includes(reqRec.foreign_key)) {
      requestor = reqRec.visiting;
      let visitor_name = `${reactData.personRec.name.first} ${reactData.personRec.name.last}`;
      reqRec.history[0] = `${visitor_name} ${reqRec.history[0]}`;
    }
    if ((reqRec.last_status === 'in') || (!reqRec.hasOwnProperty('current_request'))) {
      reqRec.current_request = {
        textInput: {
          Action: reqRec.history[0]
        }
      };
    }
    await putServiceRequest({
      client: state.session.client_id,
      author: requestor,
      proxy_user: state.session.user_id,
      requestType: 'checkout',
      requestor: requestor,
      activity_key: "",
      onBehalfOf: `${reactData.personRec.name.first} ${reactData.personRec.name.last}`,
      foreign_key: reqRec.foreign_key || reactData.personRec.person_id,  // if person checking into another person
      local_key: `${reactData.personRec.person_id}_checkout`,
      history: reqRec.history[0],
      last_status: reqRec.last_status,
      request: {
        selections: [`Checked ${reqRec.last_status}`],
        textInput: reqRec.current_request.textInput,
      },
      messaging: {}
    });
    let last10checkout = [reqRec.history[0]];
    if (reactData.personRec.hasOwnProperty('checkout_recent_history')) {
      last10checkout.push(...reactData.personRec.checkout_recent_history.slice(0, 9));
    }
    await dbClient
      .update({
        Key: { person_id: reactData.personRec.person_id },
        UpdateExpression: 'set #s = :s, #h = :h',
        ExpressionAttributeValues: {
          ':s': reqRec.last_status,
          ':h': last10checkout
        },
        ExpressionAttributeNames: {
          '#s': 'checkout_status',
          '#h': 'checkout_recent_history'
        },
        TableName: "People",
      })
      .promise()
      .catch(error => {
        cl(`caught error updating People; error is: `, error);
      });
  }

  function reset() {
    let marquee_message = JSON.parse(sessionStorage.getItem('marquee_message'));
    setReactData({
      kiosk_mode: (state.session.hasOwnProperty('kiosk_mode') ? state.session.kiosk_mode : false),
      validated_user: false,
      personRec: state.patient,
      residentName: ((state.patient && state.patient.name) ? `${state.patient.name.first} ${state.patient.name.last}` : ''),
      residentLocation: ((state.patient && state.patient.location) ? `${state.patient.location.trim().split(/\s+/)[0]}` : ''),
      errorText: [],
      guest_mode: false,
      resident_mode: false,
      enteredDestination: false,
      staff_mode: false,
      add_guest_mode: false,
      adminOverride: false,
      adminIndex: -1,
      outList: [],
      adminView: false,
      initialized: true,
      marquee_message,
      alert: reactData.alert
    });
    setForceRedisplay(!forceRedisplay);
  }

  const resolveValue = (object, key, value) => {
    const this_key = key.shift();
    let solution;
    if (key.length === 0) {
      solution = value;
    }
    else if (isEmpty(object) || !object.hasOwnProperty(this_key)) {
      solution = resolveValue({}, key, value);
    }
    else {
      solution = resolveValue(object[this_key], key, value);
    }
    object[this_key] = solution;
    return object;
  };

  const fetchValue = (object, key) => {
    const this_key = key.shift();
    let solution;
    if (key.length === 0) {
      solution = object[this_key];
    }
    else if (isEmpty(object) || !object.hasOwnProperty(this_key)) {
      solution = null;
    }
    else {
      solution = fetchValue(object[this_key], key);
    }
    return solution;
  };

  function determineMode(personRec) {
    reactData.resident_mode = false;
    reactData.guest_mode = false;
    reactData.staff_mode = false;
    reactData.other_mode = false;
    reactData.isVendor = false;
    let mode;
    switch (personRec.account_class) {
      case 'staff':
      case 'admin': {
        reactData.staff_mode = true;
        mode = 'resident';
        break;
      }
      case 'student':
      case 'resident': {
        reactData.resident_mode = true;
        mode = 'resident';
        break;
      }
      case 'vendor': {
        reactData.guest_mode = true;
        mode = 'vendor';
        reactData.isVendor = true;
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
      open={(true || forceRedisplay)}
      p={2}
      fullScreen
    >
      <Box
        display='flex' flexDirection='row' justifyContent='center' alignItems='center'
        width={'100%'}
        maxHeight={'100%'}
        minHeight={'100%'}
        overflow={'hidden'}
      >
        <Box
          component="img"
          width={'100vw'}
          height={'100vh'}
          m={2}
          alt=''
          src={AVADefaults({ client_style: 'get' })
            ? AVADefaults({ client_style: 'get' }).checkin_image
            : (state.session?.client_logo || process.env.REACT_APP_AVA_LOGO)}
        />
      </Box>
      {/* *** CHECK-IN/OUT VIEW *** */
        !reactData.adminView &&
        <React.Fragment>
          { /* **********************************
               We don't know who this is yet
               ********************************** */
            !reactData.validated_user && !reactData.add_guest_mode &&
            (!reactData.select_user ?
              <AVATextInput
                titleText={[(`Welcome to ${state.session.client_name}`)]}
                promptText={["Name or AVA ID"]}
                valueText={[
                  (!reactData.kiosk_mode ? reactData.residentName : '')
                ]}
                buttonText={[(!reactData.kiosk_mode ? 'Confirm' : 'Lookup'), 'Cancel', (state.session.adminAccount ? 'Admin' : null)]}
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
                  if (enteredID && (enteredID.toLowerCase() === 'exit')) {
                    onClose();
                  }
                  else {
                    if (!enteredID) {
                      reactData.errorText[0] = `Please enter your name or AVA ID so we can properly identify you!`;
                    }
                    else {
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
                        reactData.previouslyEnteredDestination = false;
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
                  }
                }}
                allowCancel={!reactData.kiosk_mode}
                options={{
                  save_on_enter: true,
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
              />
              :
              <Dialog
                open={forceRedisplay || true} fullWidth
                classes={{ paper: classes.AVAPromptBackground }}
              >
                <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography style={AVATextStyle({ size: 1.3, bold: true })} id='dialog-title'>{makeGreeting()}</Typography>
                  <Typography style={AVATextStyle({ size: 0.8 })} id='dialog-title'>{`Please select from this list or tap "None of these"`}</Typography>
                </Box>
                <Paper
                  component={Box}
                  style={{
                    paddingTop: '16px',
                    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null,
                  }}
                  overflow='auto'
                  square
                >
                  {reactData.candidates.map((candidate, cIndex) => (
                    <Box display='flex'
                      style={{ color: 'black', marginBottom: '2em', marginLeft: '1em', backgroundColor: (isDarkMode ? 'gray' : 'white'), borderColor: (isDarkMode ? 'white' : 'black') }}
                      flexDirection='row' key={`ambiguous-${cIndex}`} justifyContent='flex-start' alignItems='center'
                      paddingX={2}
                      flexGrow={1}
                      paddingY={1}
                      marginRight={2}
                      minWidth={'90%'}
                      border={1}
                      borderRadius={'16px'}
                      onClick={async () => {
                        reactData.validated_user = true;
                        reactData.previouslyEnteredDestination = false;
                        reactData.personRec = candidate;
                        let mode = determineMode(candidate);
                        reactData.currentStatus = await getCurrentStatus(state.session.client_id, candidate.person_id, mode);
                        reactData.select_user = false;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                    >
                      <Box display='flex' flexGrow={1} flexDirection='column' justifyContent='center' alignItems='flex-start'>
                        <Typography style={AVATextStyle({ size: 1.3, bold: true })}>{`${titleCase(candidate.name.first)} ${titleCase(candidate.name.last)}`}</Typography>
                        <Typography style={AVATextVariableStyle(`${titleCase(candidate.account_class)} - ${(candidate.phone_key || candidate.location)}`, { bold: true, margin: { right: 2 } })} >{`${titleCase(candidate.account_class)} - ${(candidate.phone_key || candidate.location)}`}</Typography>
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
            && (reactData.resident_mode)
            &&
            (['in', 'none'].includes(reactData.currentStatus.last_status) ?
              <AVATextInput
                titleText={[
                  makeGreeting(reactData.personRec.name.first),
                  ` `,
                  `[italic]You are currently checked in`,
                  ` `,
                  `Tap below to check out`
                ]}
                promptText={state.session.resident_checkout_prompts || []}
                buttonText={['Check out', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
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
                  let textInput = {
                    Action: hNote
                  };
                  if (responses && (responses.length > 0)) {
                    responses.forEach((r, x) => {
                      if (r && state.session.resident_checkout_prompts) {
                        hNote += ` ${state.session.resident_checkout_prompts[x]}: ${r}.`;
                        textInput[state.session.resident_checkout_prompts[x]] = r;
                      }
                    });
                  }
                  reactData.currentStatus.reqRec.history.unshift(hNote);
                  if (!isEmpty(textInput)) {
                    reactData.currentStatus.reqRec.current_request = { textInput };
                  }
                  await putCheckout(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`Got it!  You have successfully checked out.  Thank you!`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
                options={{
                  save_on_enter: (state.session.resident_checkout_prompts && (state.session.resident_checkout_prompts.length === 1)),
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}

              />
              :
              <AVAConfirm
                promptText={[
                  `Welcome home, ${reactData.personRec.name.first}!`,
                  `[italic]You've been checked out since ${makeDate(reactData.currentStatus.reqRec.last_update).relative}`,
                  `Tap below to check in`
                ]}
                cancelText={`Cancel`}
                confirmText={`Check-in`}
                options={{
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
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
                  await putCheckout(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`You're all set!  You have successfully checked in.`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
              />
            )
          }
          { /* **********************************
               We are checking in/out Staff
               ********************************** */
            reactData.validated_user
            && reactData.staff_mode
            &&
            (['in', 'none'].includes(reactData.currentStatus.last_status) ?
              <AVAConfirm
                promptText={[`Have a great day ${reactData.personRec.name.first}!`, 'Staff check-out'].concat(reactData.currentStatus.reqRec.history[0] ? [`[italic]${reactData.currentStatus.reqRec.history[0]}`] : [])}
                cancelText={`Cancel`}
                confirmText={`Check-out`}
                onCancel={() => {
                  reactData.validated_user = false;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
                options={{
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
                onConfirm={async () => {
                  let now = makeDate(new Date());
                  reactData.currentStatus.reqRec.last_status = 'out';
                  reactData.currentStatus.reqRec.last_update = now.timestamp;
                  let hNote = `Checked out on ${now.absolute}`;
                  reactData.currentStatus.reqRec.history.unshift(hNote);
                  await putCheckout(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`You're all set!`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
              />
              :
              <AVAConfirm
                promptText={[`Welcome back, ${reactData.personRec.name.first}!`]}
                cancelText={`Cancel`}
                confirmText={`Staff Check-in`}
                options={{
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
                onCancel={() => {
                  reactData.errorText = [];
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
                  await putCheckout(reactData.currentStatus.reqRec);
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
                promptText={[
                  `Thanks for visiting ${state.session.client_name}, ${reactData.personRec.name.first}!`,
                  (reactData.currentStatus.reqRec.history[0] ? `[italic]${reactData.currentStatus.reqRec.history[0]}` : null)
                ]}
                cancelText={`Cancel`}
                confirmText={`Check-out`}
                options={{
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
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
                  await putCheckout(reactData.currentStatus.reqRec);
                  enqueueSnackbar(`You're all set!`, { variant: 'success', persist: false });
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }}
                allowCancel={true}
              />
              :
              <AVATextInput
                titleText={[`Welcome back, ${reactData.personRec.name.first}!`, (reactData.isVendor ? 'Vendor Check-in' : 'Guest Check-in')]}
                promptText={state.session.guest_checkout_prompts
                  ? state.session.guest_checkout_prompts.map(this_prompt => { return this_prompt.prompt; })
                  : ["Who are you visiting today?"]}
                valueText={state.session.guest_checkout_prompts
                  ? state.session.guest_checkout_prompts.map(this_prompt => {
                    return (this_prompt.saveAs ? fetchValue(reactData.personRec, this_prompt.saveAs.split('.')) : null);
                  })
                  : [reactData?.currentStatus?.reqRec?.on_behalf_of || '']
                }
                selectionList={(state.session.guest_checkout_prompts
                  ? state.session.guest_checkout_prompts.map(this_prompt => { return this_prompt.selections; })
                  : [])
                }
                buttonText={['Confirm', (reactData.kiosk_mode ? 'Start over' : 'Back')]}
                errorText={reactData.errorText}
                onCancel={() => {
                  reactData.errorText = [];
                  reactData.validated_user = false;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
                onSave={async (responses) => {
                  let { obo, errorText } = await checkGuestInput(responses);
                  reactData.errorText = errorText;
                  if (reactData.errorText.length === 0) {
                    // Everything is good - go ahead and check them in
                    let now = makeDate(new Date());
                    let my_request = {
                      last_status: 'in',
                      last_update: now.timestamp,
                      client_id: state.session.client_id,
                      request_id: `${reactData.personRec.person_id}_checkout`,
                      requestor: reactData.personRec.person_id,
                      on_behalf_of: obo,
                      request_type: 'checkout',
                      request_date: now.timestamp,
                      original_request: (reactData.isVendor ? { "vendor_company": [reactData.personRec.location] } : {}),
                      local_key: `${reactData.personRec.person_id}_checkout`,
                      foreign_key: (reactData.isVendor ? 'vendor' : 'guest'),
                      history: ((reactData.currentStatus?.reqRec?.history && reactData.currentStatus.reqRec.history.length > 0)
                        ? reactData.currentStatus.reqRec.history
                        : []
                      )
                    };

                    let hNote = `Checked in on ${now.absolute}`;
                    let textInput = {
                      Action: hNote
                    };
                    if (responses && (responses.length > 0)) {
                      responses.forEach((r, x) => {
                        if (r && state.session.guest_checkout_prompts[x]) {
                          hNote += `${(x === 0) ? ' -' : ';'} ${state.session.guest_checkout_prompts[x].value}: ${r}.`;
                          textInput[state.session.guest_checkout_prompts[x].value] = r;
                        }
                      });
                    }
                    my_request.history.unshift(hNote);
                    if (!isEmpty(textInput)) {
                      my_request.current_request = { textInput };
                    }
                    await putCheckout(my_request);
                    enqueueSnackbar(`Got it!  You have successfully checked in to see ${obo}.  Thank you!`, { variant: 'success', persist: false });
                    reactData.validated_user = false;
                    reactData.add_guest_mode = false;
                    if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                    else { reset(); }
                  }
                  else {
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                  }
                }}
                options={{
                  save_on_enter: true,
                  bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                }}
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
              options={{
                bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
              }}
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
              titleText={[makeGreeting(), 'We need to create an new account for you']}
              promptText={["Please enter your full name",
                "(Vendors only) What Company do you represent?",
                "What is your phone number"].concat(
                  (state.session.guest_checkout_prompts
                    ? state.session.guest_checkout_prompts.map(this_prompt => { return this_prompt.prompt; })
                    : ["Who are you visiting today?"])
                )}
              valueText={[
                isPhoneNumber(reactData.enteredID) ? '' : titleCase(reactData.enteredID),
                '',
                isPhoneNumber(reactData.enteredID) ? formatPhone(reactData.enteredID) : '',
              ]}
              selectionList={[null, null, null].concat(
                (state.session.guest_checkout_prompts
                  ? state.session.guest_checkout_prompts.map(this_prompt => { return this_prompt.selections; })
                  : [])
              )}
              buttonText={[((reactData.add_try_number === 1) ? 'Save my info' : 'Confirm'), (reactData.kiosk_mode ? 'Start over' : 'Back')]}
              onCancel={() => {
                reactData.validated_user = false;
                reactData.add_guest_mode = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              errorText={reactData.errorText}
              onSave={async (returnValues) => {
                let guestName = returnValues[0];
                let vendorCompany = returnValues[1];
                let contactNumber = returnValues[2];
                let { obo, errorText, responses } = await checkGuestInput(returnValues.slice(3));
                returnValues = returnValues.slice(0, 3).concat(responses);
                if (errorText.length > 0) {
                  reactData.errorText = [null, null, null].concat(errorText);
                }
                else {
                  reactData.errorText = [];
                }
                // Validating the new account's name
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
                let gPhone = Number(contactNumber.replace(/\D/g, ''));
                if (gPhone < 1000000000) {
                  reactData.errorText[1] = `Please enter your area code and phone number`;
                }
                // No errors?  Add the account
                let addedPerson = {};
                if (reactData.errorText.length === 0) {
                  let newPersonRec = {
                    name: {
                      first: gFirst,
                      last: gLast
                    },
                    sms: `+1${gPhone}`,
                    client_id: state.session.client_id
                  };
                  if (state.session.guest_checkout_prompts) {
                    state.session.guest_checkout_prompts.forEach((this_prompt, x) => {
                      if (this_prompt.saveAs) {
                        resolveValue(newPersonRec, this_prompt.saveAs.split('.'), returnValues[x + 3]);
                      };
                    });
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
                    reactData.errorText[0] = `Something went wrong and we couldn't create your account.  Please see the Receptionist.  Error: ${addedPerson.message}`;
                  }
                }

                if (reactData.errorText.length === 0) {
                  // Everything is good - go ahead and check them in
                  reactData.personRec = addedPerson.personRec;
                  let now = makeDate(new Date());
                  let my_request = {
                    last_status: 'in',
                    last_update: now.timestamp,
                    client_id: state.session.client_id,
                    request_id: `${addedPerson.personRec.person_id}_checkout`,
                    requestor: addedPerson.personRec.person_id,
                    on_behalf_of: obo,
                    request_type: 'checkout',
                    request_date: now.timestamp,
                    original_request: (vendorCompany ? { "vendor_company": [addedPerson.personRec.location] } : {}),
                    local_key: `${addedPerson.personRec.person_id}_checkout`,
                    foreign_key: (vendorCompany ? 'vendor' : 'guest'),
                    history: []
                  };

                  let hNote = `Checked in on ${now.absolute}`;
                  let textInput = {
                    Action: hNote
                  };
                  if (returnValues.length > 3) {
                    if (!state.session.guest_checkout_prompts) {
                      hNote += ` - Visiting: ${returnValues[3]}`;
                      textInput['Visiting'] = returnValues[3];
                    }
                    else {
                      returnValues.forEach((r, x) => {
                        if (x > 2) {
                          if (r && state.session.guest_checkout_prompts[x - 3]) {
                            hNote += `${(x === 3) ? ' -' : ';'} ${state.session.guest_checkout_prompts[x - 3].value}: ${r}.`;
                            textInput[state.session.guest_checkout_prompts[x - 3].value] = r;
                          }
                        }
                      });
                    };
                  }
                  my_request.history.unshift(hNote);
                  if (!isEmpty(textInput)) {
                    my_request.current_request = { textInput };
                  }
                  await putCheckout(my_request);
                  enqueueSnackbar(`Got it!  You have successfully checked in to see ${obo}.  Thank you!`, { variant: 'success', persist: false });
                  reactData.validated_user = false;
                  reactData.add_guest_mode = false;
                  if (!reactData.kiosk_mode && !state.session.adminAccount) { onClose(); }
                  else { reset(); }
                }
                else {
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }


              }} /* end of onSave */
              allowCancel={true}
              options={{
                bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
              }}
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
              <Dialog open={forceRedisplay || true}
                classes={{ paper: classes.AVAPromptBackground }}
                fullWidth
              >
                <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                  <Typography variant='h5' key={`title1`} style={{ fontWeight: 'bold' }}>
                    {`Check-in/out status`}
                  </Typography>
                  <Typography variant='h5' key={`title2`} style={{ fontWeight: 'bold' }}>
                    {`as of ${makeDate(new Date()).absolute}`}
                  </Typography>
                </Box>
                <Paper component={Box}
                  style={{
                    paddingTop: '16px',
                    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                  }}
                  elevation={0}
                  overflow='auto' square>
                  <Box style={{ margin: '16px' }} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                    <Box display='flex' style={{ marginBottom: '1.5em' }} flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                      <Typography variant='h6' id='dialog-title'>{'Residents currently checked-out'}</Typography>
                    </Box>
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
                    <Box display='flex' style={{ marginTop: '1.5em', marginBottom: '1.5em' }} flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                      <Typography variant='h6' id='dialog-title'>{'Guests still checked-in'}</Typography>
                    </Box>
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
                          reactData.isVendor = true;
                          reactData.adminIndex = inNdx;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                      >
                        <Box display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'>
                          <Typography><b>{inRow.name}</b></Typography>
                          {inRow.reqRec && inRow.reqRec.original_request && inRow.reqRec.original_request.vendor_company
                            && Array.isArray(inRow.reqRec.original_request.vendor_company)
                            &&
                            <Typography>{inRow.reqRec.original_request.vendor_company[0]}</Typography>
                          }
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
                    options={{
                      bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                    }}
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
                      let myName = await makeName(state.session.user_id);
                      let hNote = `Checked in by ${myName} on ${now.absolute}`;
                      reqRec.history.unshift(hNote);
                      await putCheckout(reqRec, { proxy: true });
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
                {reactData.isVendor &&
                  <AVAConfirm
                    promptText={`Confirm override check-out for ${reactData.vendorList[reactData.adminIndex].name}`}
                    cancelText={`Cancel`}
                    confirmText={`Check-out`}
                    options={{
                      bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                    }}
                    onCancel={() => {
                      reactData.adminOverride = false;
                      reactData.isVendor = false;
                      setReactData(reactData);
                      setForceRedisplay(!forceRedisplay);
                    }}
                    onConfirm={async () => {
                      let reqRec = reactData.vendorList[reactData.adminIndex].reqRec;
                      let now = makeDate(new Date());
                      reqRec.last_status = 'out';
                      reqRec.last_update = now.timestamp;
                      let myName = await makeName(state.session.user_id);
                      let hNote = `Checked out by ${myName} on ${now.absolute}`;
                      reqRec.history.unshift(hNote);
                      await putCheckout(reqRec, { proxy: true });
                      enqueueSnackbar(`Check-out is complete!`, { variant: 'success', persist: false });
                      reactData.adminOverride = false;
                      reactData.isVendor = false;
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
                    options={{
                      bgColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null
                    }}
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
                      let myName = await makeName(state.session.user_id);
                      let hNote = `Checked out by ${myName} on ${now.absolute}`;
                      reqRec.history.unshift(hNote);
                      await putCheckout(reqRec, { proxy: true });
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
      {/* *** ALERTS - SNACKBAR *** */
        reactData.alert &&
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
            style={{ marginX: '8px', borderRadius: '20px', border: 1, backgroundColor: 'white' }}
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
            variant='outlined'
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
    </Dialog>
  );
};