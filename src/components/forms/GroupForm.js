import React from 'react';
import { lambda, cl, sentenceCase, switchActiveAccount, listFromArray, makeArray } from '../../util/AVAUtilities';

import { useSnackbar } from 'notistack';
import { getImage, getPerson, formatPhone } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import { getMemberList, addMember, getPublicGroupList, getPrivateGroupList, determineClass, getRole, getAllGroups, removeMember, removeAdministrator, addAdministrator } from '../../util/AVAGroups';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import useSession from '../../hooks/useSession';

import List from '@material-ui/core/List';
import PatientDialog from '../dialogs/PatientDialog';

import CloseIcon from '@material-ui/icons/HighlightOff';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import Button from '@material-ui/core/Button';

import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import DeleteIcon from '@material-ui/icons/Delete';
import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';

import GroupAddIcon from '@material-ui/icons/GroupAdd';

import PersonFilter from '../forms/PersonFilter';
import AVAConfirm from './AVAConfirm';
import MakeMessage from './MakeMessage';

import { AVAclasses, AVATextStyle, AVATextVariableStyle, AVADefaults } from '../../util/AVAStyles';
import RequestDashboard from '../dialogs/RequestDashboard';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  progressBar: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  giveSpace: {
    marginTop: theme.spacing(2),
  },
  giveMoreSpace: {
    marginTop: theme.spacing(4),
  },
  giveSpaceBoth: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  adHead: {
    fontSize: '1.1rem',
    fontWeight: 'bold'
  },
  adName: {
    fontSize: '1.1rem',
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  makeIconStyle: {
    marginRight: theme.spacing(1),
  },
  locationLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
  },
  firstName: {

  },
  lastName: {
    fontWeight: 'bold',
    marginRight: theme.spacing(1),
  },
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  superSizeLast: {
    marginTop: theme.spacing(0),
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize * 2.8
  },
  superSizeFirst: {
    marginTop: theme.spacing(-2.5),
    fontSize: theme.typography.fontSize * 2.8
  },
  upSizeLast: {
    marginTop: theme.spacing(0),
    fontSize: theme.typography.fontSize * 2.0
  },
  upSizeLocation: {
    marginTop: theme.spacing(2),
    fontSize: theme.typography.fontSize * 2.0,
    flexGrow: 1,
    textAlign: 'center',
    lineHeight: `${theme.spacing(3)}px`,
  },
  upSizePreferenceBox: {
    marginTop: theme.spacing(2),
    lineHeight: `${theme.spacing(3)}px`,
  },
  superSizePreferenceLine1: {
    fontSize: theme.typography.fontSize * 2.0,
  },
  superSizePreferenceLine2: {
    marginTop: theme.spacing(0.5),
    lineHeight: `${theme.spacing(3)}px`,
    fontSize: theme.typography.fontSize * 2.0,
    fontWeight: 'bold'
  },
  superSizePreferenceLine3: {
    marginTop: 0,
    lineHeight: `${theme.spacing(3)}px`,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
    marginBottom: theme.spacing(0.5),
  },
  superSizeArea: {
    minHeight: '100%'
  }
}));

export default ({ groupMemberList, peopleList, pPatient, pPatientName, pClient, pGroup, pGroupRec, pGroupName, pStyle = 'full', pRole = '', onReset }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  const [person_filter_lower, setPersonFilterLower] = React.useState(' ');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [showEditPerson, setShowEditPerson] = React.useState(null);
  const [editPersonRec, setEditPersonRec] = React.useState(null);
  const [groupData, setGroupData] = React.useState({});

  const [workingMemberList, setGroupMemberList] = React.useState(Array.isArray(groupMemberList) ? groupMemberList : groupMemberList[pClient].list);

  const [deletePending, setDeletePending] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmPerson, setConfirmPerson] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [showSuperSize, setshowSuperSize] = React.useState(false);
  const [showAccountHistory, setShowAccountHistory] = React.useState(false);
  const [superSizeData, setSuperSizeData] = React.useState(false);
  const [singlePersonMode, setsinglePersonMode] = React.useState(false);
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [choiceList, setChoiceList] = React.useState([]);

  /*
  const [reactData, setReactData] = React.useState({
    listXRef: [],
  });
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };
  */
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  if (peopleList && !showSuperSize) {
    let singlePerson;
    if (Array.isArray(peopleList) && (peopleList.length === 1)) {
      if (typeof (peopleList[0]) === 'string') {
        singlePerson = peopleList[0];
      }
      else if (peopleList[0].hasOwnProperty('person_id')) {
        singlePerson = peopleList[0].person_id;
      }
    }
    else if (typeof (peopleList) === 'string') {
      singlePerson = peopleList;
    }
    if (singlePerson && !singlePerson.startsWith('~')) {
      let this_item = workingMemberList.find((pObj) => {
        return (pObj.person_id === singlePerson);
      });
      if (this_item) {
        this_item.role = 'member';    // await getRole(pGroup, singlePerson);
        this_item.public_groups = [];   //  await getPublicGroupList(state.session.client_id, singlePerson);
        this_item.private_groups = [];
        if (!this_item.account_class) {
          this_item.account_class = determineClass(this_item.groups, state.session.group_assignments);
        }
        setSuperSizeData(this_item);
        setshowSuperSize(true);
        setsinglePersonMode(true);
      }
    }
  }

  const [overrideRole, setOverrideRole] = React.useState();

  const [rowLimit, setRowLimit] = React.useState(5);
  const scrollValue = 5;
  var rowsWritten;
  let filterTimeOut;

  const multiGroups = (
    (Array.isArray(pGroup))
      ? ((pGroup.length > 1) || (pGroup[0] === '*all'))
      : (pGroup.includes('~') || (pGroup === '*all'))
  );

  const adminAccount =
    ['master', 'support', 'admin'].includes(state.profile.account_class)
    || (pRole === 'admin')
    || (pRole === 'responsible');

  const { enqueueSnackbar } = useSnackbar();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  function prefLineText(prefLine) {
    if (prefLine.private) { return `${prefLine.type} un-published`; }
    else if (prefLine.type === 'e-Mail') { return prefLine.display.join('@'); }
    else { return `${prefLine.type} ${prefLine.display[0]}`; }
  };

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  function formatLocalData(ldKey, inData) {
    switch (state.session.local_data[ldKey]) {
      case 'phone': {
        return formatPhone(inData);
      }
      case 'boolean': {
        return (inData ? 'Yes' : 'No');
      }
      case 'date': {
        return makeDate(inData).dateOnly;
      }
      case 'fulldate': {
        return makeDate(inData).absolute;
      }
      default: { return inData; }
    }
  }

  const handleChangePersonFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        setPersonFilterLower('');
        setSingleFilterDigit(false);
      }
      else {
        setPersonFilterLower(vCheck.toLowerCase());
        setSingleFilterDigit(vCheck.length === 1);
      }
      setRowLimit(scrollValue);
    }, 500);
  };

  const handleAddPersonToGroup = async (pPerson, pGroup) => {
    for (let p = 0; p < pPerson.length; p++) {
      await addMember(pPerson[p], pClient, pGroup);
    }
    let memberInfo = await getMemberList(pGroup, pClient, { "sort": true, "exclude": false });
    setGroupMemberList(memberInfo.peopleList);
  };

  const handleRemoveGroupMember = async (pPerson, pIndex) => {
    /*
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "remove_person_from_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": workingMemberList
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while deleting that item.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    */
    await removeMember(pPerson, pClient, pGroup);
    let tempMemberList = workingMemberList;
    tempMemberList.splice(pIndex, 1);
    setGroupMemberList(tempMemberList);
    setForceRedisplay(!forceRedisplay);
    return tempMemberList;
  };

  const handlePrintDirectory = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:printDirectory';
    params.Payload = JSON.stringify({
      "body": {
        "client_id": pClient,
        "requestor": pPatient,
        "report_title": pGroupName,
        "paperSize": (state?.session?.directory_format?.paperSize || [563, 750]),
        "showImages": true,
        "group_id": pClient + '~' + pGroup
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Directory.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Directory Print request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const handlePrintRoster = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:group_roster';
    params.Payload = JSON.stringify({
      "body": {
        "client_id": pClient,
        "person_id": state.session.user_id,
        "values": pGroupName + ':group=' + pClient + '~' + pGroup,
        "showCognito": "true",
        "test": true
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Roster.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Roster report request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const setChoices = async (inList) => {
    let response = [];
    if (state.accessList) {
      state.accessList[state.session.client_id].list.forEach((a, x) => {
        if ((a.access === 'proxy') || (a.access === 'full')) {
          // list is of the form <name>:<id>:<search_string>
          response.push(`${a.name.last}${a.name.first ? ', ' + a.name.first : ''}:${a.id}:${a.display_name}_${a.location}`);
        }
      });
    }
    else {
      let memberInfo = await getMemberList(inList, pClient, { "sort": true, "exclude": false });
      /* getMemberList returns
          {
            peopleList: [<People records of the members>],
            groupList: [<Group records for the selected groups>]
          }
      */
      let mInfo;
      let pLL = memberInfo.peopleList.length;
      for (let e = 0; e < pLL; e++) {
        let p = memberInfo.peopleList[e];
        let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
        if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
        // list is of the form <name>:<id>:<search_string>
        try {
          mInfo = `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
          response.push(mInfo);
        }
        catch (error) {
          cl(`response push error at index ${e} with ${mInfo}`);
        }
      };
    }
    setChoiceList(response);
    setShowAddPrompt(true);
  };

  const onScroll = event => {
    setRowLimit(rowLimit + scrollValue);
    setForceRedisplay(!forceRedisplay);
  };

  function okToShow(pPerson) {
    try {
      if (!adminAccount && (pPerson.directory_option === 'exclude')) {
        return false;
      }
      else if (singleFilterDigit) {
        return (pPerson.name.last.toLowerCase().startsWith(person_filter_lower.trim()) || pPerson.location.toLowerCase().startsWith(person_filter_lower.trim() + '-'));
      }
      else {
        let searchString = [...Object.values(pPerson.name), pPerson.search_data, pPerson.location, pPerson.member_of].join(' ');
        if (pPerson.messaging) { searchString += Object.values(pPerson.messaging).join; }
        return searchString.toLowerCase().includes(person_filter_lower.trim());
      }
    }
    catch (error) {
      return false;
    }
  }

  let nameXRef;
  function makeResponsibleLines(respIn) {
    let respArray = makeArray(respIn);
    if (respArray.length === 0) {
      return '';
    }
    if (!nameXRef) {
      nameXRef = {};
      if (state.accessList?.[state.session.client_id]) {
        state.accessList[state.session.client_id].list.forEach(a => {
          if (a.access !== 'none') {
            nameXRef[a.person_id] = (`${a.name.first} ${a.name.last}`).trim();
          }
        });
      }
    }
    let respFiltered = respArray.filter(r => {
      return (nameXRef.hasOwnProperty(r.trim()));
    });
    if (respFiltered.length === 0) {
      return '';
    }
    else {
      return ('Linked to: ' + listFromArray(respFiltered.map(r => { return nameXRef[r.trim()]; })));
    }
  }

  function makeContactLines(pMessaging, pPreference, pPerson) {
    let returnArray = [];
    for (const messageType in pMessaging) {
      switch (messageType) {
        case 'sms': {
          if (pMessaging.sms && (!pMessaging.sms_private || adminAccount)) {
            returnArray.push({
              action: [`sms:${pMessaging.sms}`, `tel:${pMessaging.sms}`],
              button: ['Send Text', 'Call Cell'],
              type: 'cell',
              display: [formatPhone(pMessaging.sms)],
              private: pMessaging.sms_private
            });
          }
          break;
        }
        case 'voice': {
          if (pMessaging.voice && (!pMessaging.voice_private || adminAccount)) {
            returnArray.push({
              action: [`tel:${pMessaging.voice}`],
              button: ['Call Home'],
              type: 'home',
              display: [formatPhone(pMessaging.voice)],
              private: pMessaging.voice_private
            });
          }
          break;
        }
        case 'office': {
          if (pMessaging.office && (!pMessaging.office_private || adminAccount)) {
            returnArray.push({
              action: [`tel:${pMessaging.office}`],
              button: ['Call Work'],
              type: 'work',
              display: [formatPhone(pMessaging.office)],
              private: pMessaging.office_private
            });
          }
          break;
        }
        case 'email': {
          if (pMessaging.email && (!pMessaging.email_private || adminAccount)) {
            returnArray.push({
              action: [`mailto:${pMessaging.email}`],
              button: ['e-Mail'],
              type: 'e-Mail',
              display: (((pMessaging.email.length < 20) || !isMobile) ? [pMessaging.email] : pMessaging.email.split('@')),
              private: pMessaging.email_private
            });
          }
          break;
        }
        default: { break; }
      }
    }
    return returnArray;
  }

  // ******************

  return (
    <React.Fragment>
      <Dialog
        open={true || forceRedisplay}
        onScroll={onScroll}
        p={2}
        fullScreen
      >
        <React.Fragment>
          {!showSuperSize &&
            <Box>
              <Typography
                className={classes.title} style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
              >
                {multiGroups ? 'Directory Listing' : `Members of the ${pGroupName} Group`}
              </Typography>
              <TextField
                id='List Filter'
                onChange={event => (handleChangePersonFilter(event.target.value))}
                className={classes.freeInput}
                helperText={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
                inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
          }
          <Paper component={Box} variant='outlined' overflow='auto' square>
            <List>
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
              {workingMemberList.map((this_item, index) => (
                ((rowsWritten <= rowLimit) && (okToShow(this_item)) &&
                  <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsWritten++}
                    </Typography>
                    <Box display='flex' flexDirection='column' >
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.person_id + 'r' + index}
                        className={classes.listItem}
                      >
                        {(pStyle !== 'short') &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            justifyContent='space-between'
                            alignItems='center'
                          >
                            <Box>
                              <Box
                                component="img"
                                ml={isMobile ? 2 : 5}
                                mr={1}
                                border={1}
                                minHeight={isMobile ? 100 : 150}
                                maxHeight={isMobile ? 100 : 150}
                                minWidth={isMobile ? 100 : 150}
                                maxWidth={isMobile ? 100 : 150}
                                alt={''}
                                src={getImage(this_item.person_id)}
                              />
                            </Box>
                          </Box>
                        }
                        <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center' overflow={'hidden'}>
                          <Box
                            onClick={async () => {
                              this_item.role = await getRole(pGroup, this_item.person_id);
                              this_item.public_groups = await getPublicGroupList(state.session.client_id, this_item.person_id);
                              this_item.private_groups = await getPrivateGroupList(state.session.client_id, this_item.person_id);
                              if (!this_item.account_class) {
                                this_item.account_class = determineClass(this_item.groups, state.session.group_assignments);
                              }
                              setSuperSizeData(this_item);
                              setshowSuperSize(true);
                            }}
                            display='flex' flexDirection='column'>
                            {(pStyle !== 'short')
                              ?
                              <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                                <Typography style={AVATextVariableStyle((this_item.name.last || this_item.display_name), { size: 1.5, bold: true, margin: { top: 1, right: 1 } })} >{this_item.name.last || this_item.display_name}</Typography>
                                <Typography style={AVATextStyle({ size: 1.5 })}>{this_item.name.first}</Typography>
                              </Box>
                              :
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                <Typography style={AVATextStyle({ size: 1.5 })} >{this_item.name.first}</Typography>
                                <Typography style={AVATextStyle({ size: 1.5, bold: true, margin: { left: 0.5 } })}>{this_item.name.last || this_item.display_name}</Typography>
                              </Box>
                            }
                            {adminAccount && ((this_item.session && this_item.session.responsible_for) || (this_item.responsible_for)) &&
                              <Box display='flex' flexDirection='column'>
                                <Typography id={`resp_line`} key={`resp_line`}
                                  style={AVATextStyle({ margin: { top: 0, bottom: (pStyle !== 'short' ? 1.5 : 0.5) } })}>
                                  {makeResponsibleLines((this_item.session && this_item.session.responsible_for) || (this_item.responsible_for))}
                                </Typography>
                              </Box>
                            }
                            {(pStyle !== 'short') && multiGroups && this_item.hasOwnProperty('member_of') &&
                              <Typography key={`member_of-${index}`} style={AVATextStyle({ bold: true, margin: { top: 0.5, bottom: 1 } })}>{sentenceCase(this_item.member_of)}</Typography>
                            }
                            {this_item.location && this_item.location.split('~').map((locLine, locIndex) => (
                              <Typography key={`locationLine-${index}.${locIndex}`} style={AVATextStyle({ margin: { bottom: 0.5 } })}>{locLine.trim()}</Typography>
                            ))}
                            {(this_item.directory_option === 'exclude') &&
                              <Typography key={`excluded-${index}`} style={AVATextStyle({ margin: { bottom: 0.5 } })}>{'** Excluded from Directory **'}</Typography>
                            }
                            <Box
                              display='flex'
                              flexDirection='row'
                              justifyContent='flex-start'
                              alignItems='center'
                              key={`contactRows.${index}`}
                            >
                              <Box display='flex' flexDirection='column'>
                                {(makeContactLines(this_item.messaging, this_item.preferred_method, this_item)
                                  .map((prefLine, prefIndex) => (
                                    <a href={prefLine.action[0]}
                                      key={`prefLink-${index}.${prefIndex}`}
                                      style={{ color: 'inherit', textDecoration: 'none' }}>
                                      <Typography
                                        key={`prefLine-${index}.${prefIndex}`}
                                        style={AVATextVariableStyle(prefLineText(prefLine), { margin: { bottom: 0.5 } })}
                                      >
                                        {prefLineText(prefLine)}
                                      </Typography>
                                    </a>
                                  )))}
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                )
              ))}
              {(rowsWritten === 0) &&
                <Box display='flex' marginLeft={3} flexDirection='column' justifyContent='center' alignItems='flex-start'>
                  <Typography style={AVATextStyle({ size: 1.5, margin: { bottom: 1 } })}>{'No Directory entries match your search!'}</Typography>
                </Box>
              }
            </List>
          </Paper>
          {showAddPrompt &&
            <PersonFilter
              prompt={'Tap the name of the person you wish to add'}
              peopleList={choiceList}
              onCancel={() => {
                setShowAddPrompt(false);
              }}
              onSelect={async (selectedPerson) => {
                await handleAddPersonToGroup(selectedPerson, pGroup);
                setShowAddPrompt(false);
              }}
              multiSelect={true}
            >
            </PersonFilter>
          }
          {showEditPerson && editPersonRec &&
            <PatientDialog
              patient={editPersonRec}
              groupData={groupData}
              open={true}
              onClose={(updatedPerson) => {
                if (updatedPerson) {
                  updatedPerson.account_class = determineClass(updatedPerson.groups, state.session.group_assignments);
                  setSuperSizeData(Object.assign(superSizeData, updatedPerson));
                }
                setEditPersonRec(null);
                setShowEditPerson(null);
              }}
            />
          }
          {promptForMessage &&
            <MakeMessage
              titleText={(messageType.includes('URGENT')) ? 'AVA will attempt to voice call all phones' : null}
              promptText={['Subject', `What should your ${messageType.includes('Group') ? 'group ' : ''}message to ${recipient.split(':')[0]} say?`, `(Optional) Alternate message if leaving Voice Mail`]}
              promptUse={['subject', 'message', 'voicemail']}
              buttonText={'Send'}
              sender={{
                "client_id": pClient,
                "patient_id": pPatient,
                "patient_display_name": pPatientName
              }}
              pRecipientID={recipient.split(':')[1]}
              pRecipientName={recipient.split(':')[0]}
              onCancel={() => { setPromptForMessage(false); }}
              onComplete={() => { setPromptForMessage(false); }}
              setMethod={(messageType === 'AVA') ? 'AVA' : (messageType.includes('URGENT') ? 'voice' : null)}
              allowCancel={true}
            />
          }
          {deletePending &&
            <AVAConfirm
              promptText={confirmMessage}
              onCancel={() => {
                setDeletePending(false);
              }}
              onConfirm={() => {
                handleRemoveGroupMember(confirmPerson, confirmIndex);
                if (confirmPerson === pPatient) { setOverrideRole('non-member'); }
                setDeletePending(false);
              }}
            >
            </AVAConfirm>
          }
          {!showSuperSize &&    // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    startIcon={<CloseIcon size="small" />}
                    onClick={() => {
                      setOverrideRole(null);
                      onReset();
                    }}
                  >
                    {'Close'}
                  </Button>
                </Box>
                {adminAccount && (pStyle === 'select') &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    {!multiGroups && (['open', 'public', 'private', 'closed'].includes(pGroupRec.group_type)) &&
                      <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'green', color: 'white' }}
                        size='small'
                        onClick={async () => {
                          await setChoices(peopleList);
                        }}
                        startIcon={<GroupAddIcon size="small" />}
                      >
                        {(isMobile ? 'Add' : 'Add Members')}
                      </Button>
                    }
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                      onClick={() => { handlePrintDirectory(pGroup); }}
                      startIcon={<PrintIcon size='small' />}
                    >
                      {'Directory'}
                    </Button>
                    <Button
                      onClick={() => { handlePrintRoster(pGroup); }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'gray', color: 'white' }}
                      size='small'
                      startIcon={<StorageOutlined size='small' />}
                    >
                      {'Roster'}
                    </Button>
                  </Box>
                }
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  {(pGroupRec && (['open', 'public'].includes(pGroupRec.group_type))) &&
                    (overrideRole === 'member' || (!overrideRole && (pRole === 'member'))) &&
                    <Button
                      onClick={() => {
                        setConfirmMessage(`Confirm removing ${pPatientName} from the ${pGroupName} ${pGroupName.includes('roup') ? '' : ' Group'}`);
                        setConfirmPerson(pPatient);
                        setConfirmIndex(workingMemberList.findIndex(m => { return m.person_id === pPatient; }));
                        setDeletePending(true);
                        setForceRedisplay(false);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'red', color: 'white' }}
                      size='small'
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Remove me
                    </Button>
                  }
                  {(pGroupRec && (['open', 'public'].includes(pGroupRec.group_type))) &&
                    (overrideRole === 'non-member' || (!overrideRole && (pRole === 'non-member'))) &&
                    <React.Fragment>
                      {!multiGroups &&
                        <Button
                          className={AVAClass.AVAButton}
                          style={{ backgroundColor: 'green', color: 'white' }}
                          size='small'
                          onClick={async () => {
                            await handleAddPersonToGroup([pPatient], pGroup);
                            setOverrideRole('member');
                          }}
                          startIcon={<GroupAddIcon size="small" />}
                        >
                          {'Add Myself'}
                        </Button>
                      }
                    </React.Fragment>
                  }
                  {!adminAccount &&
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('');
                        let rKey = '';
                        pGroupRec.admin_list.forEach((g, i) => {
                          rKey += ((i > 0) ? ' ~ ' : '') + `${pGroupName}${pGroupName.includes('roup') ? '' : ' Group'} Administrator:${g}`;
                        });
                        setRecipient(rKey);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                      startIcon={<SendIcon size='small' />}
                    >
                      {`Msg Admin`}
                    </Button>
                  }
                </Box>
                {adminAccount &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('Group');
                        setRecipient(pGroupName + ':GRP//' + pClient + '/' + pGroup);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                      startIcon={<SendIcon size='small' />}
                    >
                      {`Group Msg`}
                    </Button>
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('URGENT Group');
                        setRecipient(pGroupName + ':GRP//' + pClient + '/' + pGroup);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'red', color: 'white' }}
                      size='small'
                      startIcon={<PhoneInTalkIcon size='small' />}
                    >
                      {`Call All`}
                    </Button>
                  </Box>
                }
              </Box>
            </DialogActions>
          }
        </React.Fragment>
        {showSuperSize &&
          <List classes={{ root: classes.superSizeArea }}   >
            <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
              <Box>
                <Box
                  component="img"
                  mt={5}
                  minWidth={250}
                  maxWidth={250}
                  alt=''
                  src={getImage(superSizeData.id)}
                />
              </Box>
              <Typography className={classes.superSizeLast} >{superSizeData.name.last || superSizeData.display_name}</Typography>
              <Typography className={classes.superSizeFirst}>{superSizeData.name.first}</Typography>
              {(superSizeData.member_of) &&
                <Typography key={`member_of-superSize`} className={classes.upSizeLast}>{superSizeData.member_of}</Typography>
              }
              {superSizeData.location && superSizeData.location.split('~').map((locLine, locIndex) => (
                <Typography key={`locationLine-superSize_${locIndex}`} className={classes.upSizeLocation}>{locLine.trim()}</Typography>
              ))}
              {(superSizeData.directory_option === 'exclude') &&
                <Typography key={`excluded-superSize`} className={classes.upSizeLocation}>{'** Excluded from Directory **'}</Typography>
              }
              {(makeContactLines(superSizeData.messaging, superSizeData.preferred_method, superSizeData)
                .map((prefLine, prefIndex) => (
                  <a href={prefLine.action[0]}
                    key={`prefLink-superSize.${prefIndex}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Box className={classes.upSizePreferenceBox} display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
                      <Typography key={`prefLine-superSize.${prefIndex}a`} className={classes.adName}>
                        {sentenceCase(prefLine.type)}
                      </Typography>
                      <Typography key={`prefLine-superSize.${prefIndex}b`} className={classes.superSizePreferenceLine2}>
                        {prefLine.display[0]}
                      </Typography>
                    </Box>
                    {(prefLine.display.length > 1) &&
                      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
                        <Typography key={`prefLine-superSize.${prefIndex}c`} className={classes.superSizePreferenceLine2}>
                          @{prefLine.display[1]}
                        </Typography>
                      </Box>
                    }
                  </a>
                )))}
              {adminAccount &&
                <React.Fragment>
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                    <React.Fragment>
                      <Box className={classes.upSizePreferenceBox} display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
                        <Typography key={`prefLine-superSize.UserIDa`} className={classes.adName}>
                          {`User ID`}
                        </Typography>
                        <Typography key={`prefLine-superSize.UserIDb`} className={classes.superSizePreferenceLine2}>
                          {superSizeData.person_id.trim()}
                        </Typography>
                      </Box>
                    </React.Fragment>
                  </Box>
                  <Box display='flex' className={classes.giveSpace} flexDirection='column' justifyContent='center' alignItems='center' >
                    <Typography key={`dobtext-superSize`} className={classes.adName}>
                      {`Member of`}
                    </Typography>
                    <Typography key={`HeadLine-superSize`} className={classes.superSizePreferenceLine3}>
                      {`${sentenceCase(superSizeData.account_class)}${adminAccount ? ' account' : ''}`}
                    </Typography>
                    {superSizeData.public_groups && (Object.keys(superSizeData.public_groups).length > 0) &&
                      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
                        {Object.keys(superSizeData.public_groups).map((pG, g) => (
                          <React.Fragment key={`pubGFrag_${g}-superSize`}>
                            {(superSizeData.public_groups[pG].role !== 'non-member') &&
                              <Typography key={`pubG_${g}-superSize`} className={classes.superSizePreferenceLine3}>
                                {sentenceCase(superSizeData.public_groups[pG].group_name)}
                              </Typography>
                            }
                          </React.Fragment>
                        ))}
                      </Box>
                    }
                    {superSizeData.private_groups && (Object.keys(superSizeData.private_groups).length > 0) &&
                      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
                        {Object.keys(superSizeData.private_groups).map((pG, g) => (
                          <React.Fragment key={`pubGFrag_${g}-superSize`}>
                            {(superSizeData.private_groups[pG].role !== 'non-member') &&
                              <Typography key={`pubG_${g}-superSize`} className={classes.superSizePreferenceLine3}>
                                {sentenceCase(superSizeData.private_groups[pG].group_name)}
                              </Typography>
                            }
                          </React.Fragment>
                        ))}
                      </Box>
                    }
                    {superSizeData.local_data && (Object.keys(superSizeData.local_data).length > 0) &&
                      <React.Fragment>
                        {Object.keys(superSizeData.local_data).map((local, l) => (
                          <Box display='flex' key={`local_${l}`} className={classes.giveSpaceBoth} flexDirection='column' justifyContent='center' alignItems='center' >
                            <Typography key={`localtext_${l}-superSize`} className={classes.adName}>
                              {`${sentenceCase(local)}`}
                            </Typography>
                            <Typography key={`local_${l}-superSize`} className={classes.superSizePreferenceLine3}>
                              {formatLocalData(local, superSizeData.local_data[local])}
                            </Typography>
                          </Box>
                        ))
                        }
                      </React.Fragment>
                    }
                  </Box>
                </React.Fragment>
              }
              <Box display='flex' className={classes.giveMoreSpace} flexDirection='row' justifyContent='center' alignItems='center' >
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'red', color: 'white' }}
                  size='small'
                  startIcon={<CloseIcon size="small" />}
                  onClick={() => {
                    if (singlePersonMode) {
                      onReset();
                    }
                    else {
                      setshowSuperSize(false);
                      setForceRedisplay(!forceRedisplay);
                    }
                  }}
                >
                  {'Back'}
                </Button>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'blue', color: 'white' }}
                  size='small'
                  startIcon={<SendIcon size="small" />}
                  onClick={() => {
                    setPromptForMessage(true);
                    setMessageType('');
                    let rKey = `${superSizeData.name.first} ${superSizeData.name.last}:${superSizeData.person_id}`;
                    setRecipient(rKey.trim());
                  }}
                >
                  {`AVA Msg`}
                </Button>
              </Box>
              <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                {(makeContactLines(superSizeData.messaging, superSizeData.preferred_method, superSizeData)
                  .map((prefLine, prefIndex) => (
                    <React.Fragment key={`Frag_${prefIndex}`}>
                      <a href={prefLine.action[0]}
                        key={`aRefButtonLine0.${prefIndex}`}
                        style={{ textDecoration: 'none' }}>
                        <Button
                          className={AVAClass.AVAButton}
                          style={{ backgroundColor: 'blue', color: 'white' }}
                          size='small'
                        >
                          {prefLine.button[0]}
                        </Button>
                      </a>
                      {(prefLine.action.length > 1) &&
                        <a href={prefLine.action[1]}
                          key={`aRefButtonLine1.${prefIndex}`}
                          style={{ textDecoration: 'none' }}>
                          <Button
                            className={AVAClass.AVAButton}
                            style={{ backgroundColor: 'blue', color: 'white' }}
                            size='small'
                          >
                            {prefLine.button[1]}
                          </Button>
                        </a>
                      }
                    </React.Fragment>
                  )))}
              </Box>
              {adminAccount &&
                <React.Fragment>
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                    <Button
                      onClick={async () => {
                        await switchActiveAccount(
                          state.session,
                          state.session.client_id,
                          {
                            id: superSizeData.person_id,
                            name: `${superSizeData.name.first} ${superSizeData.name.last || superSizeData.display_name}`
                          }
                        );
                      }}
                      startIcon={<SwapHorizIcon size='small' />}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                    >
                      {'Switch to'}
                    </Button>
                    <Button
                      onClick={async () => {
                        setGroupData(await getAllGroups(superSizeData.person_id));
                        setShowEditPerson(superSizeData.person_id);
                        setEditPersonRec(await getPerson(superSizeData.person_id));
                      }}
                      startIcon={<EditIcon size='small' />}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                    >
                      {'Edit'}
                    </Button>
                    <Button
                      onClick={async () => {
                        setShowAccountHistory(true);
                      }}
                      startIcon={<EditIcon size='small' />}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'gray', color: 'white' }}
                      size='small'
                    >
                      {'Show Activity'}
                    </Button>
                  </Box>
                </React.Fragment>
              }
              {adminAccount
                && !multiGroups
                &&
                <React.Fragment>
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                    <Button
                      onClick={() => {
                        setConfirmMessage(`Confirm removing ${superSizeData.name.first} ${superSizeData.name.last || superSizeData.display_name} from the ${pGroupName} ${pGroupName.includes('roup') ? '' : ' Group'}`);
                        setConfirmPerson(superSizeData.person_id);
                        setConfirmIndex(workingMemberList.findIndex(m => { return m.person_id === superSizeData.person_id; }));
                        setDeletePending(true);
                        setForceRedisplay(false);
                      }}
                      startIcon={<DeleteIcon size='small' />}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'red', color: 'white' }}
                      size='small'
                    >
                      {`Remove ${superSizeData.name.first || superSizeData.display_name} from the group`}
                    </Button>
                  </Box>
                  {(superSizeData.role === 'member') ?
                    <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                      <Button
                        onClick={async () => {
                          await addAdministrator(superSizeData.person_id, pGroup);
                          setForceRedisplay(false);
                        }}
                        startIcon={<AddCircleOutlineIcon size='small' />}
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'green', color: 'white' }}
                        size='small'
                      >
                        {`Make ${superSizeData.name.first || superSizeData.display_name} an Administrator of the group`}
                      </Button>
                    </Box>
                    :
                    <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                      <Button
                        onClick={async () => {
                          await removeAdministrator(superSizeData.person_id, pGroup);
                          setForceRedisplay(false);
                        }}
                        startIcon={<RemoveCircleOutlineIcon size='small' />}
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'red', color: 'white', textWrap: 'wrap' }}
                        size='small'
                      >
                        {`Remove ${superSizeData.name.first || superSizeData.display_name} as an Administrator of the group`}
                      </Button>
                    </Box>
                  }
                </React.Fragment>
              }
            </Box>
          </List>
        }
        {showAccountHistory &&
          <RequestDashboard
            session={state.session}
            title={superSizeData.display_name}
            filter={{
              person_id: superSizeData.person_id,
              sort: 'desc'
            }}
            options={{
              shortForm: true,
              showForeignKey: false,
              textForm: false,
              updateMode: false,
              noSelect: true
            }}
            onClose={() => {
              setShowAccountHistory(false);
            }}
          />
        }
      </Dialog >
    </React.Fragment >
  );
};