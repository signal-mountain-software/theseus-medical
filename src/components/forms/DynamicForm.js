import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { Box, FormGroup, FormControl } from '@material-ui/core';


import NewCalendarEvent from '../dialogs/NewCalendarEvent';
import MessageForm from '../forms/MessageForm';
import MessageMonitor from './MessageMonitor';
import MessageFormLegacy from './MessageFormLegacy';
import MakeMessage from './MakeMessage';
import FileUpload from '../forms/FileUpload';
import ObservationForm from '../forms/ObservationForm';
import FamilyMaintenance from './FamilyMaintenance';
import FormFill from './FormFill';
import DocumentDashboardB from '../dialogs/DocumentDashboardB';
import MarqueeMaintenance from '../dialogs/MarqueeMaintenance';
import MultiObservationFormC from '../forms/MultiObservationFormC';
import MultiObservationFormD from '../forms/MultiObservationFormD';
import CheckInCheckOut from '../forms/CheckInCheckOut';
import RequestDashboard from '../dialogs/RequestDashboard';
import ReportRequest from './ReportRequest';
import CalendarDashboard from '../dialogs/CalendarDashboard';
import ShowCalendar from '../dialogs/ShowCalendar';
import ShowMenu from '../dialogs/ShowMenu';
import ShowEventActivity from '../dialogs/ShowEventActivity';
import LoadWorkOrderSpreadsheet from '../forms/LoadWorkOrderSpreadsheet';
import LoadNamesFromFile from '../forms/LoadNamesFromFile';
import ShowGroup from '../dialogs/ShowGroup';
import GroupForm from '../forms/GroupForm';
import AVASubscription from '../forms/AVASubscription';
import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import ClientMaintenance from '../dialogs/ClientMaintenance';
import FormManagement from '../dialogs/FormManagement';

import { createPutFact } from '../../graphql/mutations';
import { useSnackbar } from 'notistack';
import useSession from '../../hooks/useSession';

import VideoRecorder from 'react-video-recorder';
import ReactPlayer from 'react-player';
import AVAInHome from '../sections/AVAInHome';
import ShowMenuB from '../dialogs/ShowMenuB';
import BulletinBoard from '../dialogs/BulletinBoard';

import ImageGallery from 'react-image-gallery';
import "react-image-gallery/styles/css/image-gallery.css";

export default ({
  open,
  newFact,
  setNewFact,
  type,
  factName,
  session,
  message,
  values,
  qualifierTable,
  defaultValue,
  defaultObject,
  observationKey,
  onError,
  onSave,
  onClose,
}) => {

  const { state } = useSession();

  const gallery = React.useRef(null);

  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');
  const { enqueueSnackbar } = useSnackbar();

  const [formState, setFormState] = React.useState(1);

  const [OGmessage, setOGmessage] = React.useState('');
  const [OGvalue, setOGvalue] = React.useState('');

  const [freeText, setFreeText] = React.useState('');

  if (OGmessage === '') {
    setOGmessage(message);
  }

  if (OGvalue === '' && type === 'document') {
    setOGvalue(value);
  }

  const onChangeQualText = event => {
    setFreeText(event.target.value);
  };

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNums = index => event => {
    const newNums = [...nums];
    newNums[index] = event.target.value;
    setNums(newNums);
    if (newNums[0] && newNums[1]) {
      newFact.value = observationKey + '.' + newNums.join(' over ');
    } else {
      newFact.value = 'number.partial';
    }
    setNewFact(newFact);
  };

  React.useEffect(() => {
    if (open) {
      setMOut(message);
      setFormState(1);
    } else {
      setValue(defaultValue || '');
      setNums(['', '']);
      setMOut(message || 'Enter something here');
    }
  }, [message]);  // eslint-disable-line react-hooks/exhaustive-deps

  switch (type) {
    case 'characteristic_num':
      return (
        <NumberForm
          open={open}
          label='Number'
          value={value}
          message={mOut}
          onChange={onChangeValue}
          onError={onError}
        />
      );
    case 'upload_file_legacy':
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <br />
            <FreeTextForm
              open={true}
              label='Name your file'
              value={freeText}
              onChange={onChangeQualText}
              onError={onError}
            />
            <br />
            <input
              type="file"
              onChange={async (target) => {
                let fObj = target.target.files[0];
                let oName = fObj.name.toLowerCase().split('.');
                let oType = oName.pop();
                let fName = freeText ? (freeText + '.' + oType) : fObj.name;
                const pFile = {
                  Bucket: 'theseus-medical-storage',
                  Key: fName,
                  Body: fObj,
                  ACL: 'public-read-write',
                  ContentType: fObj.type,
                  Metadata: { 'Content-Type': fObj.type }
                };
                newFact.value.tag = freeText || oName;
                newFact.value.mediaData = pFile;
              }
              }
            />
          </FormGroup>
        </FormControl>
      );
    case 'people_maintenance':
    case 'person_maintenance': {
      let defaultValueObj = {};
      if (!defaultValue) { }
      else {
        if (Array.isArray(defaultValue)) {
          defaultValue.forEach(d => {
            if (typeof d === 'string') {
              let [dKey, dVal] = d.split('=');
              defaultValueObj[dKey] = dVal;
            }
            else {
              for (let dKey in d) {
                defaultValueObj[dKey] = d[dKey];
              }
            }
          });
        }
        else {
          try { defaultValueObj = JSON.parse(defaultValue); }
          catch { console.log(defaultValue); }
        }
      }
      return (
        <PeopleMaintenance
          person_id={session.patient_id}
          options={defaultValueObj.options}
          onClose={(updatedPerson) => {
            if (updatedPerson && updatedPerson.saveCompleted) {
              sessionStorage.removeItem('AVASessionData');
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
            }
            else {
              onClose();
            }
          }}
        />
      );
    }
    case 'client_maintenance': {
      return (
        <ClientMaintenance
          client_id={session.client_id}
          onClose={(updatedPerson) => {
            if (updatedPerson) {
              sessionStorage.removeItem('AVASessionData');
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
            }
            else {
              onClose();
            }
          }}
        />
      );
    }
    case 'form_management': {
      return (
        <FormManagement
          client_id={session.client_id}
          form_id={'billing_summary_1NEWVERSION'}
          onClose={() => {
            onClose();
          }}
        />
      );
    }
    case 'make_payment': {
      window.open('https://buy.stripe.com/3cs5lzbSS9RXecwcMN');
      onClose();
      break;
    }
    case 'record_video':
      var dateOptions = { month: 'short', day: 'numeric' };
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <br />
            {!freeText ?
              (defaultValue ?
                setFreeText(defaultValue + " - " + new Date().toLocaleDateString('en-US', dateOptions))
                :
                setFreeText((session.patient_display_name.split(',')[1] || session.patient_display_name.split(' ')[0]) + "'s video - "
                  + new Date().toLocaleDateString('en-US', dateOptions)))
              : null}
            <FreeTextForm
              open={true}
              label='Name your video'
              value={freeText}
              onChange={onChangeQualText}
              onError={onError}
            />
            <br />
            <VideoRecorder
              isOnInitially
              showReplayControls
              replayVideoAutoplayAndLoopOff={false}
              onRecordingComplete={async (videoBlob) => {
                const pVideo = {
                  Bucket: 'theseus-medical-storage',
                  Key: freeText.replace('.', '_') + '.webm',
                  Body: videoBlob,
                  ACL: 'public-read-write',
                  ContentType: 'video/webm'
                };
                newFact.value.tag = freeText;
                newFact.value.mediaData = pVideo;
                newFact.value.recordingStatus = 'stopped';
              }}
              onStartRecording={() => {
                newFact.value.recordingStatus = 'started';
              }}
            />
          </FormGroup>
        </FormControl>
      );
    case 'play_video':
      return (
        <ReactPlayer
          url={defaultValue}
          controls={true}
          width='100%'
          height='100%'
          playing={true}
          onError={async (err) => {
            console.log(err);
            let eValue = `error_value.Video error (user not notified) - err is ${JSON.stringify(err)}`;
            if (err?.target?.error?.message) {
              enqueueSnackbar(`I'm sorry... AVA can't play that video. (${err?.target?.error?.message || 'Details not provided'})`, { variant: 'error' });
              eValue = `error_value.File=${defaultValue} Code=${err?.target?.error?.code} Message=${err?.target?.error?.message}`;
              await API
                .graphql(graphqlOperation(createPutFact, {
                  input: {
                    patient_id: session.patient_id,
                    activity_key: 'error.videoPlayer',
                    status: new Date().toString(),
                    value: eValue,
                    qualifier: null,
                    session: {
                      user_id: session.user_id,
                      session_id: session.session_id
                    },
                  }
                }))
                .catch(error => { console.log(error); });
            }
          }}
        />
      );
    case 'show_image': {
      let defaultValueObj = {};
      if (!defaultValue) {
        defaultValueObj = { images: [] };
      }
      else {
        if (Array.isArray(defaultValue)) {
          defaultValue.forEach(d => {
            if (typeof d === 'string') {
              let [dKey, dVal] = d.split('=');
              defaultValueObj[dKey] = dVal;
            }
            else {
              for (let dKey in d) {
                defaultValueObj[dKey] = d[dKey];
              }
            }
          });
        }
        else {
          try { defaultValueObj = JSON.parse(defaultValue); }
          catch { console.log(defaultValue); }
        }
      }
      return (
        <Box
          key={'ImageBox'}
          onContextMenu={defaultValueObj.allowDownload
            ? null
            : async (e) => {
              e.preventDefault();
            }}
        >
          <ImageGallery
            ref={gallery}
            items={defaultValueObj.images}
            showThumbnails={false}
            slideInterval={10000}
            showNav={true}
            showFullscreenButton={false}
            autoPlay={true}
            startIndex={0}
            onClick={() => {
            }}
          />
        </Box>
      );
    };
    case 'characteristic_num2':
      return (
        <Number2Form
          open={open}
          labelOne='Systolic'
          labelTwo='Diastolic'
          value={nums}
          message={mOut}
          onChange={onChangeNums}
          onError={onError}
        />
      );
    /*  Candidate for retirement
    case 'document':
      let nowJ = new Date().getTime();
      window.open(`${defaultValue}?qt=${nowJ.toString()}`, message);  // intentionally fall through to the message case
      return;
    */
    /*  Candidate for retirement
    case 'message':
     return (
       <FreeTextForm
         open={open}
         label='Message'
         value={(OGvalue !== value && type === 'document') ? OGvalue : value}
         message={mOut}
         onChange={onChangeMessage}
         onError={onError}
       />
     );
    */
    case 'message_list':
      if ((session.client_style.allow_old_messaging) && !state.patient.useNewMessaging) {
        return (
          <MessageFormLegacy
            pPerson={session.patient_id}
            pClient={session.client_id}
            pMessageList={[]}
            pSession={session}
            onReset={(instruction) => {
              if (instruction !== 'restart') {
                onSave();
              }
              else {
                sessionStorage.removeItem('AVASessionData');
                window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
              }
            }}
            defaultValue={defaultValue}
          />
        );
      }
      else {
        return (
          <MessageForm
            pPerson={session.patient_id}
            pClient={session.client_id}
            pMessageList={[]}
            pSession={session}
            onReset={onSave}
            defaultValue={defaultValue}
          />
        );
      }
    case 'message_monitor': {
      let defaultValueObj = {};
      if (!defaultValue) { defaultValueObj = { recipientID: '*select' }; }
      else {
        if (Array.isArray(defaultValue)) {
          defaultValue.forEach(d => {
            if (typeof d === 'string') {
              let [dKey, dVal] = d.split('=');
              defaultValueObj[dKey] = dVal;
            }
            else {
              for (let dKey in d) {
                defaultValueObj[dKey] = d[dKey];
              }
            }
          });
        }
        else {
          try { defaultValueObj = JSON.parse(defaultValue); }
          catch { console.log(defaultValue); }
        }
      }
      return (
        <MessageMonitor
          defaults={defaultValueObj}
          onCancel={() => {
            onClose();
          }}
        />
      );
    }
    case 'make_message': {
      let defaultValueObj = {};
      if (!defaultValue) { defaultValueObj = { recipientID: '*select' }; }
      else {
        if (Array.isArray(defaultValue)) {
          defaultValue.forEach(d => {
            if (typeof d === 'string') {
              let [dKey, dVal] = d.split('=');
              defaultValueObj[dKey] = dVal;
            }
            else {
              for (let dKey in d) {
                defaultValueObj[dKey] = d[dKey];
              }
            }
          });
        }
        else {
          try { defaultValueObj = JSON.parse(defaultValue); }
          catch { console.log(defaultValue); }
        }
      }
      let recipients = [];
      if ((defaultValueObj.hasOwnProperty('recipientID')) && (Object.keys(defaultValueObj.recipientID).length > 0)) {
        for (const [i, person_id] of [defaultValueObj.recipientID].flat().entries()) {
          recipients.push({
            person_id,
            person_name: ([defaultValueObj.recipientName].flat()[i] || `user ${person_id}`)
          });
        }
      }
      if ((session.client_style.allow_old_messaging) && !state.patient.useNewMessaging) {
        return (
          <MakeMessage
            titleText={defaultValueObj.title}
            promptText={defaultValueObj.prompt || `What's the Message?`}
            promptUse={defaultValueObj.promptUse}
            buttonText={defaultValueObj.button || 'Send'}
            sender={session}
            pRecipientID={defaultValueObj.recipientID || '*select'}
            pRecipientName={defaultValueObj.recipientName || `user ${defaultValueObj.recipientID}`}
            peopleList={defaultValueObj.peopleList || []}
            options={defaultValueObj.options}
            onCancel={onClose}
            onComplete={onClose}
            allowCancel={true}
          />
        );
      }
      else {
        return (
          <MessageForm
            pPerson={session.patient_id}
            pClient={session.client_id}
            pMessageList={[]}
            pSession={session}
            onReset={onClose}
            options={{
              newMessage: true,
              recipients,
              showPreferredList: (defaultValueObj.options === 'groupOnly' ? false : true),
              showGroupList: (defaultValueObj.options === 'groupOnly' ? true : false),
            }}
          />);
      }
    };
    case 'bulletin_board':
      return (
        <BulletinBoard
          pClient={session.client_id}
          pGroup={defaultValue}
          onClose={onClose}
        />
      );
    case 'submit_report':
      let requestor = [];
      if (defaultObject.hasOwnProperty('requestor') && ([defaultObject.requestor].flat().length > 0)) {
        requestor = [defaultObject.requestor].flat();
      }
      if (!requestor.includes(session.user_id)) {
        requestor.push(session.user_id);
      }
      return (
        <ReportRequest
          report_id={defaultObject.report_id}
          title={defaultObject.title}
          buttonText={defaultObject.buttonText}
          requestor={requestor}
          options={defaultObject.options}
          onClose={(response) => {
            onClose(response);
          }}
        />
      );
    case 'upload_file':
      return (
        <FileUpload
          fileTag={defaultValue}
          pClient={session.client_id}
          onCancel={onClose}
          promptText={factName}
        />
      );
    case 'observation_form':
      return (
        <ObservationForm
          fact={newFact}
          factName={factName}
          defaultValue={defaultValue}
          prompt={message}
          pClient={session.client_id}
          qualifiers={qualifierTable}
          listValues={values}
          onSave={(requestNumber, oSelected, fText, fQualifiers) => {
            newFact.commonKey = requestNumber;
            newFact.value.selected = oSelected;
            newFact.value.freeText = fText;
            newFact.value.qualifiers = fQualifiers;
            newFact.status = 'confirmed';
            setNewFact(newFact);
            onSave();
          }}
          onClose={onClose}
        />
      );
    case 'subscription_management':
      return (
        <AVASubscription
          defaults={defaultValue}
          onClose={onClose}
        />
      );
    case 'multi_observation':
    case 'multi_observation_type2':
    case 'multi_observation_type3':
      return (
        <MultiObservationFormC
          fact={newFact}
          factName={factName}
          defaultValue={defaultObject}
          prompt={message}
          pClient={session.client_id}
          qualifiers={qualifierTable}
          listValues={values}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case 'multi_observation_type4':
    case 'multi_observation_image_based':
      return (
        <MultiObservationFormD
          fact={newFact}
          factName={factName}
          defaultValue={defaultObject}
          prompt={message}
          pClient={session.client_id}
          qualifiers={qualifierTable}
          listValues={values}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case 'checkout':
      return (
        <CheckInCheckOut
          onSave={onSave}
          onClose={onClose}
        />
      );
    case 'request_dashboard': {
      let filter = {};
      if (defaultObject.hasOwnProperty('request_type')) { }
      else if (newFact?.value?.freeText?.requestType) {
        filter = { request_type: newFact.value.freeText.requestType };
      }
      else {
        filter = { person_id: session.patient_id };
      };
      return (
        <RequestDashboard
          session={session}
          title={factName}
          filter={Object.assign(filter, defaultObject, { options: null })}
          options={defaultObject.options}
          onClose={(response) => {
            onClose(response);
          }}
        />
      );
    }
    case 'calendar_dashboard': {
      let filter = { person_id: session.patient_id };
      if (newFact?.value?.freeText?.requestType) {
        filter = { request_type: newFact.value.freeText.requestType };
      }
      return (
        <CalendarDashboard
          session={session}
          filter={filter}
          onClose={onClose}
        />
      );
    }
    case 'new_event':
      let isAppointment = false;
      let personalEvent = false;
      let defaultObj = {};
      if (Array.isArray(defaultValue)) {
        defaultValue.forEach(dV => {
          if (typeof (dV) === 'string') {
            let [dVKey, dVValue] = dV.split('=');
            if (dVValue) {
              dV = { [dVKey]: dVValue };
            }
          }
          if (dV.hasOwnProperty('isAppointment')) {
            isAppointment = true;
            personalEvent = true;
          }
          else if (dV.hasOwnProperty('personalEvent')) {
            personalEvent = true;
          }
          Object.assign(defaultObj, dV);
        });
      }
      return (
        <NewCalendarEvent
          patient={session}
          peopleList={values}
          isAppointment={isAppointment}
          personalEvent={personalEvent}
          options={defaultObj}
          picture={null}
          showNewEvent={true}
          onClose={onSave}
        />
      );
    case 'edit_marquee':
      return (
        <MarqueeMaintenance
          patient={session}
          peopleList={values}
          picture={null}
          showNewEvent={true}
          onClose={onSave}
        />
      );
    case 'show_calendar':
    case 'calendar_history':
    case 'add_calendar':
      let OGsession = {};
      Object.assign(OGsession, session);
      return (
        <ShowCalendar
          patient={session}
          OGpatient={OGsession}
          peopleList={values}
          defaultObject={defaultObject || []}
          eventClient={newFact.client_id || session.client_id}
          calendarMode={(type === 'show_calendar') ? 'view' : ((type === 'calendar_history') ? 'history' : 'signUp')}
          onClose={onSave}
        />
      );
    case 'show_menu':
      return (
        <ShowMenu
          pClient={session.client_id}
          showMenu={true}
          onClose={onSave}
        />
      );
    case 'show_menuB':
      return (
        <ShowMenuB
          pClient={session.client_id}
          showMenu={true}
          onClose={onSave}
        />
      );
    case 'load_names':
      return (
        <LoadNamesFromFile
          options={defaultValue}
          onClose={onSave}
        />
      );
    case 'family_maintenance':
      return (
        <FamilyMaintenance
          options={defaultObject}
          onSave={onSave}
          onClose={onSave}
        />
      );
    case 'form_fill':
      return (
        <FormFill
          request={defaultValue}
          onClose={onSave}
          mode={'new'}
        />
      );
    case 'document_dashboard':
      return (
        <DocumentDashboardB
          request={defaultValue}
          onClose={onSave}
        />
      );
    case 'load_workorder_sheet':
      return (
        <LoadWorkOrderSpreadsheet
          pClient={session.client_id}
          showSheet={true}
          defaults={defaultValue}
          session={session}
          onClose={onSave}
        />
      );
    case 'show_event':
      return (
        <ShowEventActivity
          pSession={session}
          pEvent_id={defaultValue}
          pName={message}
          showList={true}
          onClose={onSave}
        />
      );
    case 'show_groups':
      return (
        <ShowGroup
          defaults={defaultObject}
          options={{
            pSession: session,
            pGroup_id: (defaultObject?.groups || defaultValue),
            pGroup_name: message,
            peopleList: values,
            showList: (defaultObject?.mode || 'full'),
            safeMode: defaultObject.safeMode
          }}
          onClose={(updatesMade) => {
            if (updatesMade) {
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
            }
            else {
              onSave();
            }
          }}
          onAbort={onClose}
        />
      );
    case 'manage_groups':
      return (
        <ShowGroup
          defaults={defaultObject}
          options={{
            pSession: session,
            pGroup_id: (defaultObject?.groups || defaultValue),
            pGroup_name: message,
            peopleList: values,
            showList: (defaultObject?.mode || 'full'),
            safeMode: defaultObject.safeMode,
            groupManagement: true
          }}
          onClose={(updatesMade) => {
            if (updatesMade) {
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
            }
            else {
              onSave();
            }
          }}
          onAbort={onClose}
        />
      );
    case 'manage_forms':
      return (
        // defaults, focusAt, onCancel, onSelect, onRefresh 
        <FormManagement
          defaults={defaultObject}
          onClose={onClose}
        />
      );
    case 'carousel':
    case 'in_home':
      return (
        <AVAInHome
          pPerson={state.patient.person_id}
          patient={state.patient}
          pClient={session.client_id}
          onReset={onClose}
        />
      );
    case 'group_form':
      return (
        <GroupForm
          options={{
            groupMemberList: state.accessList,
            peopleList: defaultValue || values,
            pPatient: session.patient_id,
            pPatientName: session.patient_display_name,
            pClient: session.client_id
          }}
          onReset={(updatesMade) => {
            if (updatesMade) {
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
            }
            else {
              onSave();
            }
          }}
        />
      );
    default:
      enqueueSnackbar(`AVA needs to update this function.  Please try again later.`, { variant: 'error' });
  }
};
