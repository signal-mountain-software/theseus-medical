import React from 'react';

import useSession from '../../hooks/useSession';

import { getMemberList } from '../../util/AVAGroups';
import { dbClient } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';
import { getPerson } from '../../util/AVAPeople';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography, Switch, Slider } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import CloseIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';
import SendIcon from '@material-ui/icons/Send';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import MessageForm from './MessageForm';

import { useIdleTimer } from 'react-idle-timer';

const useStyles = makeStyles(theme => ({
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  myImageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginTop: '16px',
    marginRight: theme.spacing(1),
    borderRadius: '25px'
  },
  peopleBox: {
    paddingTop: 0,
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'column'
  },
  peopleBoxWithSpace: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'row'
  },
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    height: '100%',
    overflow: 'hidden'
  },
  dragNamesFirst: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    marginBottom: '-10px'
  },
  dragNamesLast: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    fontWeight: 'bold',
    marginBottom: '-10px'
  },
  assignment_avatar: {
    marginTop: 0,
    marginBottom: 0,
    height: 40,
    width: 40,
    paddingTop: 0,
    fontSize: '1.2rem',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
}));

export default ({ defaults, onCancel }) => {

  const { state } = useSession();

  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: 1,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    anchorEl: null,
    building: 'not started',
    columnSort: 'sent',
    daysToMonitor: 1,
    defaults,
    denseView: false,
    display_name: state.patient?.name?.first || 'My',
    event_being_edited: false,
    filterTextLower: null,
    focusAt: (defaults.focusAt || 0),
    forceReloadTime: 0,
    groupID: (defaults.group_id || '*all'),
    groupName: '',
    groupRec: {},
    groupsManagedObject: prepareGroupObject([defaults.group_id || '*all'].flat()),
    groupMemberList: [],
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
    loading: false,
    needRef: false,
    newGroups: {},
    popUpOpen: false,
    progressMessage: 'Building Group List',
    pWidth: 60,
    received_mode: false,
    rowLimit: 50,
    selectDate: null,
    selectedPerson_id: null,
    selectedPersonRec: false,
    selectedPersonFirstName: '',
    selectedPersonLastName: '',
    showList: (defaults.show_group || 'select'),
    showGroupSelect: false,
    showQuickSearch: false,
    selectedGroup_id: null,
    selectedGroupRec: false,
    selectedGroupMembers: false,
    timeLastFetched: 0,
    timeWindowStart: new Date().getTime() - (24 * 60 * 60 * 1000),     // 24-hours ago
    updatesMade: false,
    viewPeopleMaintenance: false
  });
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
  };

  const sliderMarks = [
    {
      value: 1,
      label: '',
    },
    {
      value: 2,
      label: '2',
    },
    {
      value: 3,
      label: '3',
    },
    {
      value: 4,
      label: '4',
    },
    {
      value: 5,
      label: '5',
    },
    {
      value: 6,
      label: '6',
    },
    {
      value: 7,
      label: '',
    },
  ];


  function handleResize() {
    updateReactData({
      window_width: Math.min(((window.window.innerWidth - 220) / 1400), 1),
    }, true);
  }

  function calcMinimumGroupLevel() {
    let response = 99;
    Object.keys(reactData.groupsManagedObject).forEach((listEntry) => {
      if (reactData.groupsManagedObject[listEntry].level && (reactData.groupsManagedObject[listEntry].level < response)) {
        response = reactData.groupsManagedObject[listEntry].level;
      }
    });
    return response;
  }
  const [minimumGroupLevel,] = React.useState(calcMinimumGroupLevel() - 1);

  const oneMinute = 1000 * 60;
  const msBeforeSleeping = 1 * oneMinute;

  const onAction = async () => {
    if (reactData.forceReloadTime) {
      let now = new Date().getTime();
      if (reactData.forceReloadTime < now) {
        const timeLastFetched = new Date().getTime();
        let groupMembersUpdated = await messageFetch({
          response: reactData.selectedGroupMembers,
          startTime: reactData.timeLastFetched,
        });
        updateReactData({
          selectedGroupMembers: groupMembersUpdated,
          forceReloadTime: new Date().getTime() + (1000 * 300),
          timeLastFetched,
        }, true);
      }
    }
    if (reactData.idleState) {
      updateReactData({
        idleState: false,
      }, false);
    }
    reset();
  };

  const onIdle = async () => {
    let now = new Date();
    let minutesSinceActive = 0;
    if (reactData.forceReloadTime) {
      let now = new Date().getTime();
      if (reactData.forceReloadTime < now) {
        const timeLastFetched = new Date().getTime();
        let groupMembersUpdated = await messageFetch({
          response: reactData.selectedGroupMembers,
          startTime: reactData.timeLastFetched,
        });
        updateReactData({
          selectedGroupMembers: groupMembersUpdated,
          forceReloadTime: new Date().getTime() + (1000 * 300),
          timeLastFetched,
        }, true);
      }
    }
    if (!reactData.idleState) {    // if we weren't previously in an idle state and we are now...
      updateReactData({
        idleState: true,
        enteredIdleStateTime: now,
      }, true);
    }
    else {   // we are still in an idle state
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      if (minutesSinceActive > 1) {
        const timeLastFetched = new Date().getTime();
        let groupMembersUpdated = await messageFetch({
          response: reactData.selectedGroupMembers,
          startTime: reactData.timeLastFetched,
        });
        updateReactData({
          selectedGroupMembers: groupMembersUpdated,
          forceReloadTime: new Date().getTime() + (1000 * 300),
          timeLastFetched,
        }, true);
      }
      else {
      }
    }
    reset();
  };

  const { start, reset } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  function prepareGroupObject(pGroupList) {
    let selectAll = pGroupList.includes('*all');
    let selectOpen = pGroupList.includes('*all_open') || pGroupList.includes('*all_public');
    let selectPrivate = pGroupList.includes('*all_closed') || pGroupList.includes('*all_private');
    const selectMine = !pGroupList || (pGroupList.length === 0) || (pGroupList.includes('*user'));
    const authorized_groups = state.accessList?.[state.session.client_id]?.groups || [];
    let gList = state.groups.adminHierarchy.filter(g => authorized_groups.includes(g.id));
    let response = {};
    for (let g of gList) {
      if ((g.level > 0)
        && (selectAll
          || selectMine
          || pGroupList.includes(g.id)
          || pGroupList.includes(g.belongs_to)
          || pGroupList.includes('*responsible'))
      ) {
        response[g.id] = {
          group_name: g.name,
          group_type: 'admin',
          group_id: g.id,
          level: g.level
        };
        if (!pGroupList.includes(g.id)) {
          pGroupList.push(g.id);
        }
      }
    };
    for (let gID in state.groups.publicGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectOpen)) {
        response[gID] = {
          group_name: state.groups.publicGroups[gID].group_name,
          group_id: gID,
          group_type: 'public',
          level: 0
        };
      }
    };
    for (let gID in state.groups.privateGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectPrivate)) {
        response[gID] = {
          group_name: state.groups.privateGroups[gID].group_name,
          group_id: gID,
          group_type: 'private',
          level: 0
        };
      }
    };
    return response;
  };

  // const autoFocus = (element) => element?.focus();

  var rowsDisplayed;

  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
    setLowerFilter(event.target.value.toLowerCase());
  };

  function OKtoShow(inObj) {
    if (!lower_activity_filter) { return true; }
    if (inObj.hasOwnProperty('group_name')) {
      if (inObj.group_name.toLowerCase().includes(lower_activity_filter)) {
        return true;
      }
    }
    return (inObj.group_id.toLowerCase().includes(lower_activity_filter));
  };

  async function resetTimeWindow(daysToMonitor) {
    for (const this_member in reactData.selectedGroupMembers) {
      reactData.selectedGroupMembers[this_member].messageData = {
        sent: {
          count: 0,
          urgent: 0,
          held: 0,
          blocked: 0,    // hold_reason === 'blocked'
          redirected: 0,    // hold_reason === 'replaced'
          bounced: 0,
          with_attachment: 0,
          with_rules: 0
        },
        received: {
          count: 0,
          urgent: 0,
          held: 0,
          blocked: 0,    // hold_reason === 'blocked'
          redirected: 0,    // hold_reason === 'replaced'
          bounced: 0,
          with_attachment: 0,
          with_rules: 0,
          not_og: 0    // you were not an original receipient (recipient_list.not_original_recipient is true)
        },
      };
    }
    const start_time = new Date().getTime() - (daysToMonitor * 24 * 60 * 60 * 1000);
    let updatedSelections = await messageFetch({
      response: reactData.selectedGroupMembers,
      startTime: start_time,
    });
    updateReactData({
      daysToMonitor: daysToMonitor,
      timeWindowStart: start_time,
      forceReloadTime: new Date().getTime() + (1000 * 300),
      selectedGroupMembers: updatedSelections
    }, true);
    return;
  }

  async function selectMembers(this_group) {
    let response = {};
    let memberList = await getMemberList(this_group, state.session.client_id, { "exclude": false });
    for (const this_member of memberList.peopleList) {
      response[this_member.person_id] = this_member;
      response[this_member.person_id].messageData = {
        sent: {
          count: 0,
          urgent: 0,
          held: 0,
          blocked: 0,    // hold_reason === 'blocked'
          redirected: 0,    // hold_reason === 'replaced'
          bounced: 0,
          with_attachment: 0,
          with_rules: 0
        },
        received: {
          count: 0,
          urgent: 0,
          held: 0,
          blocked: 0,    // hold_reason === 'blocked'
          redirected: 0,    // hold_reason === 'replaced'
          bounced: 0,
          with_attachment: 0,
          with_rules: 0,
          not_og: 0    // you were not an original receipient (recipient_list.not_original_recipient is true)
        },
      };
    }
    await messageFetch({
      response,
      startTime: reactData.timeWindowStart,
    });
    return response;
  }

  async function queryMessagesByIndex(indexName, partitionKeyName, personId, startTime) {
    let allMessages = [];
    let queryObj = {
      KeyConditionExpression: `${partitionKeyName} = :pk and created_time > :s`,
      ExpressionAttributeValues: {
        ':pk': personId,
        ':s': `${startTime}`
      },
      TableName: "TheseusMessages",
      IndexName: indexName,
      ScanIndexForward: false,
    };

    do {
      let mRecs = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            updateReactData({
              alert: {
                severity: 'error',
                title: 'No network',
                message: `There is no internet connection.`
              }
            }, true);
          }
          console.log({ 'Error reading Messages': error });
        });

      if (mRecs && mRecs.hasOwnProperty('Items')) {
        allMessages = allMessages.concat(mRecs.Items);
      }

      if (mRecs?.LastEvaluatedKey) {
        queryObj.ExclusiveStartKey = mRecs.LastEvaluatedKey;
      } else {
        delete queryObj.ExclusiveStartKey;
      }
    } while (queryObj.ExclusiveStartKey);

    return allMessages;
  }

  async function messageFetch({ response, startTime }) {
    const personIds = Object.keys(response);
    const processedMessageIds = new Set(); // prevent duplicate counting

    try {
      // Run all person queries in parallel (both sent_from and deliver_to indexes)
      const allQueries = personIds.flatMap(personId => [
        queryMessagesByIndex('sent_from-index', 'sent_from', personId, startTime),
        queryMessagesByIndex('deliver_to-index', 'deliver_to', personId, startTime)
      ]);

      const allResults = await Promise.all(allQueries);

      // Process all messages from both indexes
      for (const messages of allResults) {
        for (const this_message of messages) {
          // Skip if we've already processed this message
          const messageId = this_message.id || `${this_message.author?.author_id}_${this_message.created_time}_${this_message.deliver_to}`;
          if (processedMessageIds.has(messageId)) {
            continue;
          }
          processedMessageIds.add(messageId);

          let isUrgent = (this_message.urgency?.startsWith('urg') ? 1 : 0);
          let isAttachment = ((this_message.content?.current?.attachments && (this_message.content.current.attachments.length > 0)) ? 1 : 0);
          let ruleUsed = this_message.recipient_list?.rule_used ? 1 : 0;
          let blocked = 0;
          let redirected = 0;
          let held = 0;
          if (this_message.delivery_status === 'held') {
            held = 1;
            blocked = ((this_message.recipient_list?.hold_reason === 'blocked') ? 1 : 0);
            redirected = ((this_message.recipient_list?.hold_reason === 'replaced') ? 1 : 0);
          }

          // Process sender side
          if (response.hasOwnProperty(this_message.author?.author_id)) {
            let sender = this_message.author?.author_id;
            response[sender].messageData.sent.count++;
            response[sender].messageData.sent.urgent += isUrgent;
            response[sender].messageData.sent.with_attachment += isAttachment;
            response[sender].messageData.sent.with_rules += ruleUsed;
            response[sender].messageData.sent.held += held;
            response[sender].messageData.sent.blocked += blocked;
            response[sender].messageData.sent.redirected += redirected;
            if (ruleUsed) {
              objRefIncrement(response[sender].messageData.sent.rule_list, this_message.recipient_list.rule_used);
            }
          }

          // Process recipient side
          if (response.hasOwnProperty(this_message.deliver_to)) {
            let recipient = this_message.deliver_to;
            response[recipient].messageData.received.count++;
            response[recipient].messageData.received.urgent += isUrgent;
            response[recipient].messageData.received.with_attachment += isAttachment;
            response[recipient].messageData.received.with_rules += ruleUsed;
            response[recipient].messageData.received.held += held;
            response[recipient].messageData.received.blocked += blocked;
            response[recipient].messageData.received.redirected += redirected;
            if (ruleUsed) {
              objRefIncrement(response[recipient].messageData.received.rule_list, this_message.recipient_list.rule_used);
            }
            if (this_message.recipient_list?.not_original_recipient) {
              response[recipient].messageData.received.not_og++;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in messageFetch:', error);
    }

    return response;
  };

  function objRefIncrement(obj, key) {
    if (!obj) { obj = { key: 1 }; }
    else if (!(key in obj)) { obj[key] = 1; }
    else { return obj[key] + 1; }
  }

  async function initialize() {
  }

  React.useEffect(() => {
    initialize();
    window.addEventListener('resize', handleResize);
    start();  // idle timer
    updateReactData({
      lastReloadTime: new Date(),
      lastActiveTime: new Date(),
      forceReloadTime: 0,
      idleState: false,
      statusMessage: false,
      showGroupSelect: true,
      building: 'done'
    }, true);
    return () => window.removeEventListener('resize', handleResize);
  }, [defaults]); // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

  return (
    <Dialog
      open={true || refreshTrigger}
      maxWidth={false}
      key={`dialog_${Object.keys(reactData.groupsManagedObject).length}`}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
    >
      {(reactData.building === 'done')
        &&
        <React.Fragment>
          <Box style={{ borderRadius: '30px 30px 30px 30px', marginRight: '16px' }}
            key={`topRow_${Object.keys(reactData.groupsManagedObject).length}`}
            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
          >
            <Box
              key={'topBox'}
              display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            >
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
                id='scroll-dialog-title'
              >
                {'Select a group from this list'}
              </Typography>
              <TextField
                style={{
                  marginLeft: '25px',
                  marginRight: '16px',
                  marginBottom: '16px',
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingBottom: '8px',
                  width: '40%',
                  verticalAlign: 'middle',
                  fontSize: 0.4,
                  minHeight: 2.8,
                }}
                id='List Filter'
                value={activity_filter}
                className={classes.freeInput}
                onChange={handleChangeActivityFilter}
                helperText={'Filter Groups'}
                inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
            <PeopleIcon
              style={{ marginRight: '32px' }}
              onClick={() => {
                updateReactData({ showQuickSearch: true }, true);
              }}
            />
          </Box>

          <Box display='flex' flexDirection='row' style={{ flexGrow: 1, height: '100px' }}>

            {/* LEFT SIDE */}
            <Box display='flex' style={{ width: '44.5%' }}
              flexDirection='column'
              justifyContent='flex-start'
              alignItems='flex-start'
              marginLeft={'32px'}
            >
              <Typography
                key={`g_client_name_header`}
                style={AVATextStyle({
                  size: 1.5,
                  bold: true,
                  overflow: 'visible',
                  margin: { top: 1, bottom: 1 },
                })}>
                {`${state.session.client_name} Groups`}
              </Typography>
              <Paper component={Box} elevation={0} overflow='auto' square
                style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
              >
                <Box display='flex' flexDirection='column'
                  key={`box_${new Date().getTime()}`}
                  justifyContent='flex-start'
                  alignItems='flex-start'
                >
                  {Object.keys(reactData.groupsManagedObject).map((listEntry, listIndex) => (
                    (OKtoShow(reactData.groupsManagedObject[listEntry]) &&
                      <React.Fragment key={`frag_${listIndex}`}>
                        <Box
                          key={`activity-list_${listIndex}_${((listIndex === reactData.focusAt) ? 'selected' : '')}_${new Date().getTime()}`}
                          onClick={async () => {
                            const timeLastFetched = new Date().getTime();  // want to set this before getting into select members to accomodate latendy in that process
                            updateReactData({
                              selectedGroup_id: listEntry,
                              selectedGroupRec: reactData.groupsManagedObject[listEntry],
                              selectedGroupMembers: await selectMembers(listEntry),
                              forceReloadTime: new Date().getTime() + (1000 * 300),
                              timeLastFetched,
                              selectedPerson_id: false,
                              selectedPersonRec: false,
                              selectedPersonFirstName: false,
                              selectedPersonLastName: false,
                            }, true);
                          }}
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            updateReactData({
                              alert: {
                                severity: 'info',
                                title: reactData.groupsManagedObject[listEntry].group_name,
                                message: <div>
                                  Group ID: <strong>{listEntry}</strong></div>
                              }
                            }, true);
                          }}
                        >
                          <Typography
                            key={`g_text_${listIndex}_${(listIndex === reactData.focusAt) ? 'selected' : ''}_${new Date().getTime()}`}
                            style={AVATextStyle({
                              size: 1.2,
                              color: (
                                (
                                  (
                                    reactData.selectedPersonRec
                                    &&
                                    reactData.selectedPersonRec.groups.includes(listEntry)
                                  )
                                  ||
                                  (reactData.selectedGroup_id === listEntry) || (state.groups.parent_of.hasOwnProperty(listEntry) && state.groups.parent_of[listEntry].includes(reactData.selectedGroup_id))
                                )
                                  ? 'orange'
                                  : null
                              ),
                              weight: (((reactData.selectedPersonRec && reactData.selectedPersonRec.groups.includes(listEntry)) || (reactData.selectedGroup_id === listEntry)) ? 'bold' : null),
                              margin: { left: (reactData.groupsManagedObject[listEntry].level ? ((reactData.groupsManagedObject[listEntry].level - minimumGroupLevel) - 1) * 1.5 : 0), top: 0, bottom: 0.8 },
                            })}>
                            {reactData.groupsManagedObject[listEntry].group_name}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    )
                  ))}
                </Box>
              </Paper>
              <SendIcon
                classes={{ root: classes.rowButton }}
                size='medium'
                style={{ alignSelf: 'center' }}
                aria-label="trash_icon"
                edge="start"
              />
            </Box>

            {/* RIGHT SIDE */}
            {reactData.selectedGroupRec &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
                paddingLeft={'32px'}
              >
                <Box display='flex' flexDirection='row'
                  justifyContent='space-between'
                  alignItems='flex-start'
                  width={'100%'}
                  paddingRight={'4px'}
                >
                  <Typography
                    key={`g_name`}
                    style={AVATextStyle({
                      size: 1.5,
                      overflow: 'visible',
                      bold: true,
                      margin: { top: 1, bottom: 1 },
                    })}>
                    {`${reactData.selectedGroupRec.group_name} Members`}
                  </Typography>
                  <Box flexGrow={2} display='flex' alignItems='center'
                    justifyContent='flex-end' flexDirection='row'
                    marginTop={'16px'} marginBottom={'13px'}
                  >
                    <Typography
                      style={AVATextStyle({
                        size: 0.8, margin: { right: 0.8 },
                        bold: !reactData.received_mode
                      })}
                    >
                      {'Sent'}
                    </Typography>
                    <Switch
                      checked={reactData.received_mode}
                      onClick={() => {
                        updateReactData({
                          received_mode: !reactData.received_mode
                        }, true);
                      }}
                      name="Mode"
                      color="primary"
                    />
                    <Typography
                      style={AVATextStyle({
                        size: 0.8, margin: { left: 0.8 },
                        bold: reactData.received_mode
                      })}
                    >
                      {`Rec'd`}
                    </Typography>
                  </Box>
                </Box>
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  key={`right_paper`}
                  style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    key={`right_paper_boxcolumn`}
                    alignItems='flex-start' width={'100%'}
                    marginRight={'12px'}
                  >
                    <Box display='flex' flexDirection='row' width={'100%'}
                      key={`right_paper_boxrow`}
                    >
                      <Box display='flex' flexDirection='row' flexGrow={1} width={'200px'}
                        key={`right_paper_detailrow`}
                      >
                        <Typography
                          key={`g_peopleHeader`}
                          style={AVATextStyle({
                            overflow: 'visible',
                            size: 1,
                            width: '200px',
                            margin: { top: 0, bottom: 0.8 },
                          })}
                        >
                          {``}
                        </Typography>
                      </Box>
                      <Box display='flex' flexDirection='row'
                        key={`g_countHead`}
                      >
                        {(['#', 'Urg', 'Hld', 'Blk', 'Chg', 'Att', 'Rul'].concat(reactData.received_mode ? ['xOG'] : [])).map((this_key, kX) =>
                          <Typography
                            key={`g_count-head_${kX}`}
                            onClick={async () => {
                              if (this_key === 'Hld') {
                                updateReactData({
                                  heldMessages: true
                                }, true);
                              }
                            }}
                            style={AVATextStyle({
                              overflow: 'visible',
                              align: 'center',
                              size: 1,
                              width: '35px',
                              margin: { left: 0.2, right: 0.2, top: 0, bottom: 0.8 },
                            })}
                          >
                            {this_key}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    {reactData.selectedGroupMembers && Object.keys(reactData.selectedGroupMembers).sort((a, b) => {
                      if (!reactData.received_mode) {
                        return (reactData.selectedGroupMembers[a].messageData.sent.count < reactData.selectedGroupMembers[b].messageData.sent.count) ? 1 : -1;
                      }
                      else {
                        return (reactData.selectedGroupMembers[a].messageData.received.count < reactData.selectedGroupMembers[b].messageData.received.count) ? 1 : -1;
                      }
                    }).map((this_person, cX) => (
                      <Box display='flex' flexDirection='row' width={'100%'}
                        key={`g_peopleoutbox-${cX}`}
                      >
                        <Box display='flex' flexDirection='row' flexGrow={1} minWidth={'200px'}
                          key={`g_peopleinnerbox-${cX}`}
                        >
                          <Typography
                            key={`g_textpeople-${cX}`}
                            style={Object.assign({},
                              { width: '100%' },
                              AVATextStyle({
                                overflow: 'visible',
                                size: 1,
                                margin: { top: 0, bottom: 0.8 },
                              })
                            )}
                            onClick={async () => {
                              updateReactData({
                                personMessages: this_person
                              }, true);
                            }}
                          >
                            {`${reactData.selectedGroupMembers[this_person].name.first} ${reactData.selectedGroupMembers[this_person].name.last}`}
                          </Typography>
                        </Box>
                        <Box display='flex' flexDirection='row'
                          key={`g_countBox-${cX}`}
                        >
                          {(['count', 'urgent', 'held', 'blocked', 'redirected', 'with_attachment', 'with_rules'].concat(reactData.received_mode ? ['not_og'] : [])).map((this_key, kX) =>
                            <Typography
                              key={`g_count-${cX}_${kX}`}
                              onClick={async () => {
                                updateReactData({
                                  personMessages: this_person,
                                  personMessages_inOutFilter: (reactData.received_mode ? 'in' : 'out'),
                                  personMessages_statusFilter: ((this_key === 'count') ? false : this_key)
                                }, true);
                              }}
                              style={AVATextStyle({
                                overflow: 'visible',
                                align: 'center',
                                size: 1,
                                width: '35px',
                                opacity: (((reactData.received_mode && reactData.selectedGroupMembers[this_person].messageData.received[this_key] === 0)
                                  || (!reactData.received_mode && reactData.selectedGroupMembers[this_person].messageData.sent[this_key] === 0)
                                ) ? '30%' : ''),
                                margin: { left: 0.2, right: 0.2, top: 0, bottom: 0.8 },
                              })}
                            >
                              {reactData.received_mode
                                ? `${reactData.selectedGroupMembers[this_person].messageData.received[this_key]}`
                                : `${reactData.selectedGroupMembers[this_person].messageData.sent[this_key]}`
                              }
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Paper>
                <Box flexGrow={1}
                  key={`slider_parent`}
                  display="flex"
                  flexDirection='column'
                  alignItems="center"
                  justifyContent="center"
                  marginTop={'16px'}
                  width={'100%'}
                >
                  <Typography key={`slider_top`}
                    style={{
                      fontSize: `0.8rem`,
                      marginTop: '-6px',
                      lineHeight: 1.2,
                      overflow: ('hidden')
                    }}
                  >
                    {`Days to Monitor`}
                  </Typography>
                  <Box width={300} display="flex"
                    key={`slider_display-${reactData.daysToMonitor || 1}`}
                    flexDirection='row'
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography key={`slider_left`}
                      style={{
                        fontSize: `0.8rem`,
                        overflow: ('hidden'),
                        marginRight: '16px'
                      }}
                    >
                      {`1`}
                    </Typography>
                    <Slider
                      key={`slider_value-${reactData.daysToMonitor || 1}`}
                      value={reactData.daysToMonitor || 1}
                      onChangeCommitted={async (event, newValue) => {
                        await resetTimeWindow(newValue);
                      }}
                      aria-labelledby="continuous-slider"
                      marks={sliderMarks}
                      step={1}
                      min={1}
                      max={7}
                    />
                    <Typography key={`slider_right`}
                      style={{
                        fontSize: `0.8rem`,
                        overflow: ('hidden'),
                        marginLeft: '16px'
                      }}
                    >
                      {`7`}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            }
          </Box>

        </React.Fragment>
      }
      {reactData.showQuickSearch &&
        <QuickSearch
          reactData={reactData}
          updateReactData={updateReactData}
          options={{
            pickOne: true,
            showAll: true
          }}
          onClose={async (selections) => {
            if (selections && (selections.length > 0)) {
              updateReactData({
                showQuickSearch: false,
                selectedGroup_id: false,
                selectedGroupRec: false,
                seletedGroupMembers: false,
                selectedPerson_id: selections[0].person_id,
                selectedPersonRec: await getPerson(selections[0].person_id,),
                selectedPersonFirstName: selections[0].person_firstName,
                selectedPersonLastName: selections[0].person_lastName,
              }, true);
            }
            else {
              updateReactData({
                showQuickSearch: false,
              }, true);
            }
          }}
        />
      }
      {reactData.personMessages &&
        <MessageForm
          pPerson={reactData.personMessages}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              personMessages: false,
              personMessages_inOutFilter: false,
              personMessages_statusFilter: false
            }, true);
          }}
          options={{
            viewOnly: true,
            start_time: reactData.timeWindowStart,
            inOut_filter: reactData.personMessages_inOutFilter,
            statusFilter: reactData.personMessages_statusFilter
          }}
        />
      }
      {reactData.heldMessages &&
        <MessageForm
          pPerson={'*allHeld'}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              heldMessages: false,
            }, true);
          }}
        />
      }
      {(rowsDisplayed === 0) &&
        <Box display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
          <Typography
            key={`g_text_end`}
            style={AVATextStyle({
              size: 1.5,
              margin: { bottom: 1 },
            })}>
            {!lower_activity_filter ? 'This Group has no members' : 'No members match that filter'}
          </Typography>
        </Box>
      }
      <DialogActions className={classes.buttonArea} >
        {(reactData.building === 'done') &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            startIcon={<CloseIcon fontSize="small" />}
            onClick={() => {
              onCancel();
            }}
          >
            {'Done'}
          </Button>
        }
      </DialogActions>
      {reactData.alert &&
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
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
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
            variant='filled'
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
