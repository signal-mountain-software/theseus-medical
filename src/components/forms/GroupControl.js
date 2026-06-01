import React from 'react';

import useSession from '../../hooks/useSession';

import { createNewGroup, getGroupMembers, getMemberList, addMember, removeMember } from '../../util/AVAGroups';
import { dbClient, sentenceCase, isObject, listFromArray, cl } from '../../util/AVAUtilities';
import AVATextInput from '../forms/AVATextInput';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import GroupMaintenance from '../dialogs/GroupMaintenance';
import { getPerson } from '../../util/AVAPeople';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography, Checkbox, FormControlLabel, LinearProgress, Tooltip } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';
import {
  getExportFieldPickerData,
  saveExportFieldSelections,
  resolveSelectedFieldValuesForPeople,
  downloadRowsAsCsv,
  downloadRowsAsXlsx,
  downloadRowsAsPdf,
  sanitizeExportBaseName,
  listSavedReports,
  saveReport,
  collectPromptSpecs,
} from '../../util/AVAPeopleListExport';

import ExportFilterPrompt from '../dialogs/ExportFilterPrompt';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloseIcon from '@material-ui/icons/ExitToApp';
import DeleteIcon from '@material-ui/icons/Delete';
import SendIcon from '@material-ui/icons/Send';
import ExpandMoreIcon from '@material-ui/icons/Visibility';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import GetAppIcon from '@material-ui/icons/GetApp';
import PhotoLibraryIcon from '@material-ui/icons/PhotoLibrary';

import { SET_GROUPS, SET_ACCESSLIST } from '../../contexts/Session/actions';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import MessageForm from './MessageForm';
import GroupPhotoDirectory from './GroupPhotoDirectory';

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

// Persists expand/collapse state across GroupControl mounts within the same session
let _savedLevelHidden = null;

export default ({ defaults, pSession, groupsManagedObject, focusAt, preSelectedGroup = null, preSelectedFunction = null, directoryGroupIds = null, onCancel = () => { }, onRefresh = () => { }, renderAsDialog = true }) => {

  const isMounted = React.useRef(false);
  const isExiting = React.useRef(false);
  const filterTimeoutRef = React.useRef(null);
  const personRowDragActiveRef = React.useRef(false);
  const personRowDragResetRef = React.useRef(null);

  const { dispatch, state } = useSession();

  const [promptForName, setPromptForName] = React.useState(false);

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: window.window.innerWidth,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    // from defaults
    agendaView: defaults.agendaView,
    allowAssign: defaults.allowAssign,
    assignmentList: defaults.assignmentList,
    assignmentView: defaults.assignmentView,
    viewOnly: defaults.viewOnly,
    defaultCollapsed: !(defaults.expand_parents || false),
    no_contact_directory: defaults.hideContactInfo,


    anchorEl: null,
    building: 'not started',
    defaults,
    denseView: false,
    display_name: state.patient?.name?.first || 'My',
    event_being_edited: false,
    filterTextLower: null,
    groupID: '',
    groupName: '',
    groupRec: {},
    groupRole: '',
    groupsManagedObject: Object.keys(groupsManagedObject),
    groupMemberList: [],
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
    levelHidden: _savedLevelHidden || [],
    loading: false,
    needRef: false,
    newGroups: {},
    people_filter: null,
    lower_people_filter: null,
    minimumGroupLevel: calcMinimumGroupLevel() - 1,
    people_filter_reset: 0,
    popUpOpen: false,
    progressMessage: 'Building Group List',
    pWidth: 60,
    rowLimit: 50,
    selectDate: null,
    selectedPerson_id: null,
    selectedPersonRec: false,
    selectedPersonFirstName: '',
    selectedPersonLastName: '',
    showGroupSelect: false,
    showQuickSearch: false,
    selectedGroup_id: null,
    selectedGroupIds: [],
    selectedGroupMembersPerGroup: {},
    intersectionMode: false,
    selectedGroupRec: false,
    selectedGroupMembers: false,
    sortedGroupMembers: [],
    showFieldPicker: false,
    showPhotoDirectory: false,
    photoDirectoryPeople: [],
    loadingExportFields: false,
    exportInProgress: false,
    exportProgressCurrent: 0,
    exportProgressTotal: 0,
    exportProgressLabel: '',
    exportFieldOptions: [],
    selectedExportFieldNames: [],
    savedReports: [],
    selectedReportId: null,
    reportNameInput: '',
    hasUnsavedSelections: false,
    showDownloadConfirm: null,
    showExportFilterPrompt: false,
    exportFilterPromptSpecs: [],
    updatesMade: false,
    viewPeopleMaintenance: false,
    viewGroupMaintenance: false
  });
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    if (isMounted.current) {
      setReactData((prevValues) => (Object.assign(
        prevValues,
        newData
      )));
      if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
    }
  };

  function exitGroupControl({ mode = 'cancel', reason = 'done', payload = {} } = {}) {
    if (isExiting.current) {
      return;
    }
    isExiting.current = true;
    clearTimeout(filterTimeoutRef.current);

    const responseObj = {
      reason,
      ...payload
    };

    if (mode === 'refresh') {
      onRefresh(responseObj);
    }
    else {
      onCancel(responseObj);
    }
  }

  const isSmallScreen = () => {
    return (reactData.window_width < 800);
  };

  async function handleChangePersonFilter(vCheck) {
    clearTimeout(filterTimeoutRef.current);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeoutRef.current = setTimeout(async () => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      let reactUpdObj = {
        people_filter: vCheck,
        lower_people_filter: vCheck.toLowerCase(),
        selectedPerson_id: false,
        selectedPersonRec: false,
        selectedPersonFirstName: false,
        selectedPersonLastName: false
      };
      if (!reactData.selectedGroupRec) {
        // if no group is selected, then assume selection of the highest group in the list
        let listEntry = Object.keys(groupsManagedObject)[0];
        let memberList = await selectMembers(listEntry, { live: true });
        reactUpdObj.selectedGroup_id = listEntry;
        reactUpdObj.selectedGroupRec = groupsManagedObject[listEntry];
        reactUpdObj.selectedGroupMembers = memberList;
        reactUpdObj.sortedGroupMembers = sortGroupMembers(memberList);
      };
      if (!vCheck || vCheck === '') {
        reactUpdObj.people_filter_reset = reactData.people_filter_reset + 1;
      }
      updateReactData(reactUpdObj, true);
    }, 500);
  };

  function handleResize() {
    updateReactData({
      window_width: window.window.innerWidth,
    }, true);
  }

  function calcMinimumGroupLevel() {
    let response = 99;
    Object.keys(groupsManagedObject).forEach((listEntry) => {
      if (groupsManagedObject[listEntry].level && (groupsManagedObject[listEntry].level < response)) {
        response = groupsManagedObject[listEntry].level;
      }
    });
    return response;
  }

  function hasChildren(this_index) {
    try {
      return (groupsManagedObject[reactData.groupsManagedObject[this_index + 1]].level > groupsManagedObject[reactData.groupsManagedObject[this_index]].level);
    }
    catch {
      return false;
    }
  }

  const handleDragStart = (ev, id) => {
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('id', JSON.stringify(id));
  };

  const handleDragOver = (ev) => {
    ev.preventDefault();
  };

  const handleDrop = async (ev, { droppedOn }) => {
    ev.preventDefault();
    let draggedFrom = JSON.parse(ev.dataTransfer.getData('id'));
    console.log(draggedFrom);
    console.log(droppedOn);
    if (draggedFrom.group_id === droppedOn.group_id) {
      return;
    }
    if (draggedFrom.hasOwnProperty('groupObj')) {
      if (droppedOn.levelZero) {
        let top = state.groups.adminHierarchy.find(h => { return h.level === 0; });
        droppedOn.group_id = top.id;
      }
      else if (droppedOn.groupObj.group_type !== 'admin') {
        // public and private groups cannot be dropped on
        updateReactData({
          alert: {
            severity: 'error',
            title: 'Error',
            message: `${droppedOn.groupObj.group_name} is a ${sentenceCase(droppedOn.groupObj.group_type)} group and cannot be a "parent"`
          }
        }, true);
        return;
      }
      // who are my parent and grandparents before the change?
      let targetGroup_formerFamilyTree = [];
      let this_group = myParent(draggedFrom.group_id);
      for (this_group; !!this_group; this_group = myParent(this_group)) {
        targetGroup_formerFamilyTree.push(this_group);
      }
      // dragged now belongs_to dropped
      let UpdateExpression = 'set #b = :b';
      let ExpressionAttributeValues = {
        ':b': droppedOn.group_id
      };
      let ExpressionAttributeNames = {
        '#b': 'belongs_to'
      };
      if (draggedFrom.groupObj.group_type !== 'admin') {  // if this formerly was a public or private group, it will now be an admin type group
        UpdateExpression += ', #t = :t';
        ExpressionAttributeValues[':t'] = 'admin';
        ExpressionAttributeNames['#t'] = 'group_type';
      }
      await dbClient
        .update({
          Key: {
            client_id: pSession.client_id,
            group_id: draggedFrom.group_id
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ExpressionAttributeNames,
          TableName: "Groups",
        })
        .promise()
        .catch(error => {
          console.log(`caught error updating Group; error is: `, error);
        });

      groupsManagedObject[draggedFrom.group_id].level = (groupsManagedObject[droppedOn.group_id]?.level || 0) + 1;

      // who are my parent and grandparents after the change?
      let targetGroup_newFamilyTree = [droppedOn.group_id];
      this_group = myParent(droppedOn.group_id);
      for (this_group; !!this_group; this_group = myParent(this_group)) {
        targetGroup_newFamilyTree.push(this_group);
      }
      for (const former_parent of targetGroup_formerFamilyTree) {
        state.groups.parent_of[former_parent].splice(state.groups.parent_of[former_parent].indexOf(draggedFrom.group_id), 1);
      }
      for (const new_parent of targetGroup_newFamilyTree) {
        if (state.groups.parent_of.hasOwnProperty(new_parent)) {
          state.groups.parent_of[new_parent].push(draggedFrom.group_id);
        }
        else {
          state.groups.parent_of[new_parent] = [draggedFrom.group_id];
        }
      }

      let foundAt = state.groups.adminHierarchy.findIndex(g => { return g.id === draggedFrom.group_id; });
      if (foundAt > -1) {
        state.groups.adminHierarchy[foundAt].belongs_to = droppedOn.group_id;
      }
      else {
        state.groups.adminHierarchy.push({
          belongs_to: droppedOn.group_id,
          id: draggedFrom.group_id,
          level: groupsManagedObject[draggedFrom.group_id].level,
          name: draggedFrom.groupObj.group_name,
          selectable: true
        });
      }
      delete state.groups.publicGroups[draggedFrom.group_id];
      delete state.groups.privateGroups[draggedFrom.group_id];
      dispatch({ type: SET_GROUPS, payload: Object.assign({}, state.groups) });
    }
    else if (draggedFrom.hasOwnProperty('personObj')) {
      if (draggedFrom.hasOwnProperty('personGroup') && (draggedFrom.intent === 'group')) {
        // this was a drag of a group name from the right column;
        // it should only be used drag to the trash can, removing this person from this group
        // handleDrop_removeGroup should have been triggered.
        // Dropping here is an error
        updateReactData({
          alert: {
            severity: 'error',
            title: `You can't drop that there!`,
            message: `You dragged ${groupsManagedObject[draggedFrom.personGroup].group_name} from the right side onto ${groupsManagedObject[droppedOn.group_id].group_name} on left side.  We don't know what to do with that!`
          }
        }, true);
        return;
      }
      // Ask the user whether to Move or Copy
      // Move is not allowed when the source group is the top-level ("ALL") group —
      // removing it would leave the person with no group assignment at all.
      const topLevelGroup = state.groups.adminHierarchy.find(h => h.level === 0);
      const sourceIsTopLevel = topLevelGroup && (draggedFrom.personGroup === topLevelGroup.id);
      updateReactData({
        alert: {
          severity: 'info',
          title: 'Move or Copy?',
          message: `${draggedFrom.personObj.name.first} ${draggedFrom.personObj.name.last} → ${groupsManagedObject[droppedOn.group_id].group_name}`,
          action: [
            {
              text: 'Copy',
              function: async () => { await executeDrop_copyPerson(draggedFrom, droppedOn); }
            },
            ...(sourceIsTopLevel ? [] : [{
              text: 'Move',
              function: async () => { await executeMovePerson(draggedFrom, droppedOn); }
            }])
          ]
        }
      }, true);
    };
  };

  const executeDrop_copyPerson = async (draggedFrom, droppedOn) => {
    const person_id = draggedFrom.personObj.person_id;
    const firstName = draggedFrom.personObj.name?.first || 'This person';

    // guard against dropping on an inactive group
    if (state.session.group_assignments?.inactive?.includes(droppedOn.group_id)) {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Dropped on Inactive Group',
          message: `You dragged ${firstName} to a group of Inactive accounts.  
            For safety, we don't allow that here.
            If you mean to make this account inactive, please tap on ${firstName + "'s"} name.  
            You can make the account inactive in that screen.`
        }
      }, true);
      return;
    }

    // compute the group chain being added (dropped group + all its ancestors) — for alert only
    let addGroupList = [droppedOn.group_id];
    let pg = myParent(droppedOn.group_id);
    for (; !!pg; pg = myParent(pg)) { addGroupList.push(pg); }

    // get current groups from the in-memory accessList cache
    const accessEntry = state.accessList?.[pSession.client_id]?.list?.find(p => p.person_id === person_id);
    const currentGroups = [...(accessEntry?.groups || [])];
    const addedGroups = addGroupList.filter(g => !currentGroups.includes(g));

    if (addedGroups.length === 0) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'Already a member',
          message: `${firstName} was already a member of ${groupsManagedObject[droppedOn.group_id]?.group_name || droppedOn.group_id}`
        }
      }, true);
      return;
    }

    // delegate all DB writes to addMember (People.groups + PeopleGroups chain)
    const newGroupList = await addMember(person_id, pSession.client_id, droppedOn.group_id, { allowParent: true });

    // update in-memory accessList cache (immutable)
    const updatedGroupList = [...currentGroups, ...addedGroups];
    if (state.accessList?.[pSession.client_id]?.list) {
      dispatch({
        type: SET_ACCESSLIST,
        payload: {
          ...state.accessList,
          [pSession.client_id]: {
            ...state.accessList[pSession.client_id],
            list: state.accessList[pSession.client_id].list.map(p =>
              p.person_id === person_id ? { ...p, groups: updatedGroupList } : p
            )
          }
        }
      });
    }
    // if this change affects the current patient, update memberGroupIds
    if (person_id === state.session.patient_id && newGroupList) {
      dispatch({ type: SET_GROUPS, payload: Object.assign({}, state.groups, { memberGroupIds: newGroupList }) });
    }

    // Refresh the current group's member list live (catches rule-triggered side effects)
    let reactUpdObj = {
      updatesMade: true,
      alert: {
        severity: 'success',
        title: 'Success!',
        message: `${firstName} was added to ${listFromArray(addedGroups.map(g => groupsManagedObject[g]?.group_name || g))}`
      }
    };
    if (reactData.selectedGroup_id) {
      const freshMembers = await selectMembers(reactData.selectedGroup_id, { live: true });
      reactUpdObj.selectedGroupMembers = freshMembers;
      reactUpdObj.sortedGroupMembers = sortGroupMembers(freshMembers);
    }
    updateReactData(reactUpdObj, true);
  };

  const executeMovePerson = async (draggedFrom, droppedOn) => {
    const person_id = draggedFrom.personObj.person_id;
    const firstName = draggedFrom.personObj.name?.first || 'This person';

    if (state.session.group_assignments?.inactive?.includes(droppedOn.group_id)) {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Dropped on Inactive Group',
          message: `You dragged ${firstName} to a group of Inactive accounts.  For safety, we don't allow that here.`
        }
      }, true);
      return;
    }

    // compute destination chain for the alert
    let addGroupList = [droppedOn.group_id];
    let pg = myParent(droppedOn.group_id);
    for (; !!pg; pg = myParent(pg)) { addGroupList.push(pg); }

    // get current groups from accessList for alert diff
    const accessEntry = state.accessList?.[pSession.client_id]?.list?.find(p => p.person_id === person_id);
    const currentGroups = [...(accessEntry?.groups || [])];
    const addedGroupNames = addGroupList
      .filter(g => !currentGroups.includes(g))
      .map(g => groupsManagedObject[g]?.group_name || g);

    // delegate DB writes: add destination then remove source (removeMember handles orphan cleanup)
    await addMember(person_id, pSession.client_id, droppedOn.group_id, { allowParent: true });
    const newGroupList = await removeMember(person_id, pSession.client_id, draggedFrom.personGroup);

    // get fresh groups from DB — removeMember may have pruned orphaned ancestors
    const freshPerson = await getPerson(person_id);
    const freshGroupList = freshPerson?.groups || [];
    const removedGroupNames = currentGroups
      .filter(g => !freshGroupList.includes(g))
      .map(g => groupsManagedObject[g]?.group_name || g);

    // update accessList cache (immutable)
    if (state.accessList?.[pSession.client_id]?.list) {
      dispatch({
        type: SET_ACCESSLIST,
        payload: {
          ...state.accessList,
          [pSession.client_id]: {
            ...state.accessList[pSession.client_id],
            list: state.accessList[pSession.client_id].list.map(p =>
              p.person_id === person_id ? { ...p, groups: freshGroupList } : p
            )
          }
        }
      });
    }
    // if this change affects the current patient, update memberGroupIds
    if (person_id === state.session.patient_id && newGroupList) {
      dispatch({ type: SET_GROUPS, payload: Object.assign({}, state.groups, { memberGroupIds: newGroupList }) });
    }

    // Refresh the current group's member list live (catches rule-triggered side effects)
    const freshMembersAfterMove = reactData.selectedGroup_id
      ? await selectMembers(reactData.selectedGroup_id, { live: true })
      : reactData.selectedGroupMembers;
    updateReactData({
      updatesMade: true,
      alert: {
        severity: 'success',
        title: 'Success!',
        message: `${firstName} was ${addedGroupNames.length ? `added to ${listFromArray(addedGroupNames)} and ` : ''}removed from ${listFromArray(removedGroupNames)}`
      },
      selectedGroupMembers: reactData.selectedGroup_id ? freshMembersAfterMove : reactData.selectedGroupMembers,
      sortedGroupMembers: sortGroupMembers(reactData.selectedGroup_id ? freshMembersAfterMove : reactData.selectedGroupMembers),
    }, true);
  };

  const executeRemovePersonFromGroup = async (draggedFrom) => {
    const person_id = draggedFrom.personObj.person_id;
    const firstName = draggedFrom.personObj.name?.first || 'This person';

    // get current groups from accessList for alert diff
    const accessEntry = state.accessList?.[pSession.client_id]?.list?.find(p => p.person_id === person_id);
    const currentGroups = [...(accessEntry?.groups || [])];

    // delegate DB write to removeMember (handles orphan cleanup + PeopleGroups soft-delete)
    const newGroupList = await removeMember(person_id, pSession.client_id, draggedFrom.personGroup);

    // get fresh groups from DB — removeMember may have pruned orphaned ancestors
    const freshPerson = await getPerson(person_id);
    const freshGroupList = freshPerson?.groups || [];
    const removedGroupNames = currentGroups
      .filter(g => !freshGroupList.includes(g))
      .map(g => groupsManagedObject[g]?.group_name || g);

    // update accessList cache (immutable)
    if (state.accessList?.[pSession.client_id]?.list) {
      dispatch({
        type: SET_ACCESSLIST,
        payload: {
          ...state.accessList,
          [pSession.client_id]: {
            ...state.accessList[pSession.client_id],
            list: state.accessList[pSession.client_id].list.map(p =>
              p.person_id === person_id ? { ...p, groups: freshGroupList } : p
            )
          }
        }
      });
    }
    // if this change affects the current patient, update memberGroupIds
    if (person_id === state.session.patient_id && newGroupList) {
      dispatch({ type: SET_GROUPS, payload: Object.assign({}, state.groups, { memberGroupIds: newGroupList }) });
    }

    // Refresh the current group's member list live (catches rule-triggered side effects)
    const freshMembersAfterRemove = reactData.selectedGroup_id
      ? await selectMembers(reactData.selectedGroup_id, { live: true })
      : reactData.selectedGroupMembers;
    updateReactData({
      updatesMade: true,
      alert: removedGroupNames.length > 0 ? {
        severity: 'success',
        title: 'Success!',
        message: `${firstName} was removed from ${listFromArray(removedGroupNames)}`
      } : false,
      selectedGroupMembers: reactData.selectedGroup_id ? freshMembersAfterRemove : reactData.selectedGroupMembers,
      sortedGroupMembers: sortGroupMembers(reactData.selectedGroup_id ? freshMembersAfterRemove : reactData.selectedGroupMembers),
    }, true);
  };

  function sortGroupMembers(unsortedObj) {
    if (!unsortedObj) { return []; }
    if (state.session.client_style.sort_order === 'last_first') {
      return Object.keys(unsortedObj).sort((a, b) => {
        if (unsortedObj[a].name.last === unsortedObj[b].name.last) {
          return (unsortedObj[a].name.first > unsortedObj[b].name.first) ? 1 : -1;
        }
        else
          return (unsortedObj[a].name.last > unsortedObj[b].name.last) ? 1 : -1;
      });
    }
    else {
      return Object.keys(unsortedObj).sort((a, b) => {
        if (unsortedObj[a].name.first === unsortedObj[b].name.first) {
          return (unsortedObj[a].name.last > unsortedObj[b].name.last) ? 1 : -1;
        }
        else
          return (unsortedObj[a].name.first > unsortedObj[b].name.first) ? 1 : -1;
      });
    }
  }

  async function openFieldPicker() {
    const visibleMemberIds = (reactData.lower_people_filter
      ? reactData.sortedGroupMembers?.filter(p => OKtoShow(p))
      : reactData.sortedGroupMembers
    ) || [];

    if (visibleMemberIds.length === 0) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'No people to export',
          message: 'There are no people in the current list to export.'
        }
      }, true);
      return;
    }

    updateReactData({
      showFieldPicker: true,
      loadingExportFields: true,
    }, true);

    const [
      { exportFieldOptions, },
      savedReports
    ] = await Promise.all([
      getExportFieldPickerData({
        sessionId: state?.session?.user_id,
        clientId: pSession?.client_id,
        exportScope: 'group_management',
        excludeFieldKeys: ['person_id', 'id', 'user_id', 'name', 'first_name', 'last_name', 'full_name', 'display_name', 'person_name'],
        logLabel: 'group csv export'
      }),
      listSavedReports({
        clientId: pSession?.client_id,
        exportScope: 'group_management'
      })
    ]);

    updateReactData({
      loadingExportFields: false,
      exportFieldOptions,
      selectedExportFieldNames: [],
      savedReports,
      selectedReportId: null,
      reportNameInput: '',
      hasUnsavedSelections: false,
      showDownloadConfirm: null
    }, true);
  }

  function getVisiblePeopleForDirectory() {
    const visibleMemberIds = (reactData.lower_people_filter
      ? reactData.sortedGroupMembers?.filter(p => OKtoShow(p))
      : reactData.sortedGroupMembers
    ) || [];

    // When explicit group IDs were requested (directoryGroupIds), bypass the accessList.list
    // filter — return raw person_id strings so GroupPhotoDirectory fetches any missing records
    // from the DB directly, showing the full group regardless of the viewer's authorization.
    if (directoryGroupIds && directoryGroupIds.length > 0) {
      return visibleMemberIds;
    }

    return state.accessList[state.session.client_id].list
      .filter((personKey) => visibleMemberIds.includes(personKey.person_id));
  }

  function openPhotoDirectory() {
    const visiblePeople = getVisiblePeopleForDirectory();
    if (visiblePeople.length === 0) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'No people to display',
          message: 'There are no people in the current list for the photo directory.'
        }
      }, true);
      return;
    }

    updateReactData({
      showPhotoDirectory: true,
      photoDirectoryPeople: visiblePeople
    }, true);
  }

  function toggleExportFieldSelection(field_name) {
    const selectedExportFieldNames = reactData.selectedExportFieldNames.includes(field_name)
      ? reactData.selectedExportFieldNames.filter((this_field) => this_field !== field_name)
      : [...reactData.selectedExportFieldNames, field_name];
    updateReactData({
      selectedExportFieldNames,
      hasUnsavedSelections: true
    }, true);
  }

  async function downloadCurrentPeopleListCsv() {
    try {
      const exportData = await buildCurrentPeopleListExportData();
      if (!exportData) {
        return false;
      }

      const {
        header,
        rows,
        safeGroupName
      } = exportData;

      const fileName = `${safeGroupName || 'group'}_people_list.csv`;

      downloadRowsAsCsv({ header, rows, fileName });
      await saveExportFieldSelections({
        sessionId: state?.session?.user_id,
        clientId: pSession?.client_id,
        exportScope: 'group_management',
        selectedFieldNames: reactData.selectedExportFieldNames || [],
        logLabel: 'group export selections'
      });
      return true;
    }
    finally {
      updateReactData({
        exportInProgress: false,
        exportProgressCurrent: 0,
        exportProgressTotal: 0,
        exportProgressLabel: ''
      }, true);
    }
  }

  async function downloadCurrentPeopleListXlsx() {
    try {
      const exportData = await buildCurrentPeopleListExportData();
      if (!exportData) {
        return false;
      }

      const {
        header,
        rows,
        safeGroupName
      } = exportData;

      const fileName = `${safeGroupName || 'group'}_people_list.xlsx`;
      downloadRowsAsXlsx({ header, rows, fileName });
      await saveExportFieldSelections({
        sessionId: state?.session?.user_id,
        clientId: pSession?.client_id,
        exportScope: 'group_management',
        selectedFieldNames: reactData.selectedExportFieldNames || [],
        logLabel: 'group export selections'
      });
      return true;
    }
    finally {
      updateReactData({
        exportInProgress: false,
        exportProgressCurrent: 0,
        exportProgressTotal: 0,
        exportProgressLabel: ''
      }, true);
    }
  }

  async function downloadCurrentPeopleListPdf(resolvedPromptValues = {}) {
    const selectedFieldObjects = reactData.exportFieldOptions.filter(
      f => reactData.selectedExportFieldNames.includes(f.field_key));
    const promptSpecs = collectPromptSpecs(selectedFieldObjects);
    if (promptSpecs.length > 0 && Object.keys(resolvedPromptValues).length === 0) {
      updateReactData({ showExportFilterPrompt: true, exportFilterPromptSpecs: promptSpecs }, true);
      return null;
    }
    try {
      const exportData = await buildCurrentPeopleListExportData();
      if (!exportData) {
        return false;
      }

      const {
        header,
        rows,
        safeGroupName,
        selectedFieldOptions
      } = exportData;

      const fieldMeta = selectedFieldOptions.map(opt => ({ value_type: opt.value_type, filters: opt.filters }));
      const fileName = `${safeGroupName || 'group'}_people_list.pdf`;
      await downloadRowsAsPdf({
        header,
        rows,
        fileName,
        personIdColIndex: 0,
        personNameColIndex: 3,
        identityColCount: 4,
        fieldMeta,
        resolvedPromptValues,
      });
      await saveExportFieldSelections({
        sessionId: state?.session?.user_id,
        clientId: pSession?.client_id,
        exportScope: 'group_management',
        selectedFieldNames: reactData.selectedExportFieldNames || [],
        logLabel: 'group export selections'
      });
      return true;
    }
    finally {
      updateReactData({
        exportInProgress: false,
        exportProgressCurrent: 0,
        exportProgressTotal: 0,
        exportProgressLabel: ''
      }, true);
    }
  }

  async function buildCurrentPeopleListExportData() {
    const visibleMemberIds = (reactData.lower_people_filter
      ? reactData.sortedGroupMembers?.filter(p => OKtoShow(p))
      : reactData.sortedGroupMembers
    ) || [];

    if (visibleMemberIds.length === 0) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'No people to export',
          message: 'There are no people in the current list to export.'
        }
      }, true);
      return false;
    }

    const selectedFieldOptions = reactData.selectedExportFieldNames
      .map(key => reactData.exportFieldOptions.find(opt => opt.field_key === key))
      .filter(Boolean);

    const selectedFieldKeys = selectedFieldOptions.map((fieldRec) => fieldRec.field_key);

    const header = [
      'ID',
      'First Name',
      'Last Name',
      'Full Name',
      ...selectedFieldOptions.map((fieldRec) => fieldRec.description)
    ];

    const rows = visibleMemberIds.map((this_person) => {
      const personRec = reactData.selectedGroupMembers?.[this_person] || {};
      const person_id = personRec.person_id || '';
      const firstName = personRec.name?.first || '';
      const lastName = personRec.name?.last || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return [person_id, firstName, lastName, fullName];
    });

    if (selectedFieldKeys.length > 0) {
      const progressTotal = rows.length;
      updateReactData({
        exportInProgress: true,
        exportProgressCurrent: 0,
        exportProgressTotal: progressTotal,
        exportProgressLabel: 'Preparing your report data...'
      }, true);

      const personIds = rows.map((rowObj) => rowObj[0]);
      const resolvedByPersonId = await resolveSelectedFieldValuesForPeople({
        clientId: pSession.client_id,
        personIds,
        selectedFieldKeys,
        selectedFieldOptions,
        onProgress: ({ completedCount, totalCount }) => {
          updateReactData({
            exportProgressCurrent: completedCount,
            exportProgressTotal: totalCount,
            exportProgressLabel: 'Preparing your report data...'
          }, true);
        }
      });

      rows.forEach((rowObj, rowIndex) => {
        const personId = rowObj[0];
        const selectedFieldValues = resolvedByPersonId[personId] || selectedFieldKeys.map(() => '');
        rows[rowIndex] = [rowObj[0], rowObj[1], rowObj[2], rowObj[3], ...selectedFieldValues];
      });
    } else {
      rows.forEach((rowObj, rowIndex) => {
        rows[rowIndex] = [rowObj[0], rowObj[1], rowObj[2], rowObj[3]];
      });
    }

    const safeGroupName = sanitizeExportBaseName(
      reactData.selectedGroupRec?.group_name || reactData.selectedGroup_id || 'group',
      'group'
    );

    return {
      header,
      rows,
      safeGroupName,
      selectedFieldOptions
    };
  }

  const OKtoShow = (this_person) => {
    if (!reactData.lower_people_filter) { return true; }

    const person = reactData.selectedGroupMembers[this_person];
    if (!person) { return false; }
    const allValues = Object.values(person).flatMap(value =>
      (typeof value === 'object' && value !== null) ? Object.values(value) : value
    );
    const searchString = allValues.filter(v => v != null).join(' ').toLowerCase();

    return searchString.includes(reactData.lower_people_filter);
  };

  const handleDrop_removePerson = async (ev) => {
    ev.preventDefault();
    let draggedFrom = JSON.parse(ev.dataTransfer.getData('id'));
    console.log(draggedFrom);
    if (draggedFrom.hasOwnProperty('personGroup')) {
      await executeRemovePersonFromGroup(draggedFrom);
    }
    else if (draggedFrom.hasOwnProperty('groupObj')) {
      if (Object.keys(reactData.selectedGroupMembers).length > 0) {
        updateReactData({
          alert: {
            severity: 'error',
            title: `${draggedFrom.groupObj.group_name} has members`,
            message: `${draggedFrom.groupObj.group_name} has ${Object.keys(reactData.selectedGroupMembers).length} member${(Object.keys(reactData.selectedGroupMembers).length > 1) ? 's' : ''}.  You can't remove this group unless it is empty.`
          }
        }, true);
      }
      else {
        // we will delete thie group_id;  before we do, look for any direct descendants and change their parent to my parent
        let targetGroup_parent = myParent(draggedFrom.groupObj.group_id);
        if (state.groups.parent_of.hasOwnProperty(draggedFrom.groupObj.group_id)) {
          for (const this_child of state.groups.parent_of[draggedFrom.groupObj.group_id]) {
            if (myParent(this_child) === draggedFrom.groupObj.group_id) {    // if the child is a GRANDchild, don't change its parent
              // take the child and make it a child of the parent of the group we are deleting;
              await dbClient
                .update({
                  Key: {
                    client_id: pSession.client_id,
                    group_id: this_child
                  },
                  UpdateExpression: 'set #b = :b',
                  ExpressionAttributeValues: { ':b': targetGroup_parent },
                  ExpressionAttributeNames: { '#b': 'belongs_to' },
                  TableName: "Groups",
                })
                .promise()
                .catch(error => {
                  console.log(`caught error updating Group; error is: `, error);
                });
              let foundAt = state.groups.adminHierarchy.findIndex(g => { return g.id === this_child; });
              if (foundAt > -1) {
                state.groups.adminHierarchy[foundAt].belongs_to = targetGroup_parent;
              }
            }
            groupsManagedObject[this_child].level--;
          }
        }
        // no children remain; go ahead with the delete
        delete groupsManagedObject[draggedFrom.groupObj.group_id];
        await dbClient
          .delete({
            Key: {
              client_id: pSession.client_id,
              group_id: draggedFrom.groupObj.group_id
            },
            TableName: "Groups",
          })
          .promise()
          .catch(error => {
            console.log(`caught error deleting Group; error is: `, error);
          });
        let reactUpdObj = {
          alert: {
            severity: 'success',
            title: `${draggedFrom.groupObj.group_name} removed`,
            message: `${draggedFrom.groupObj.group_name} was successfully removed.`
          }
        };
        delete state.groups.publicGroups[draggedFrom.groupObj.group_id];
        delete state.groups.privateGroups[draggedFrom.groupObj.group_id];
        dispatch({ type: SET_GROUPS, payload: Object.assign({}, state.groups) });
        const deletedId = draggedFrom.groupObj.group_id;
        if ((reactData.selectedGroupIds || []).includes(deletedId)) {
          const newIds = (reactData.selectedGroupIds || []).filter(id => id !== deletedId);
          const newMembersPerGroup = { ...(reactData.selectedGroupMembersPerGroup || {}) };
          delete newMembersPerGroup[deletedId];
          // Also prune ancestors that no longer have all their descendants selected
          const toPrune = newIds.filter(id =>
            getDescendants(id).some(d => groupsManagedObject[d] && !newIds.includes(d))
          );
          for (const id of toPrune) { delete newMembersPerGroup[id]; }
          const prunedIds = newIds.filter(id => !toPrune.includes(id));
          const newGroupMembers = {};
          for (const id of prunedIds) { Object.assign(newGroupMembers, newMembersPerGroup[id] || {}); }
          const titledIds = prunedIds.filter(id => Object.keys(newMembersPerGroup[id] || {}).length > 0);
          const titleSource = titledIds.length > 0 ? titledIds : prunedIds;
          const singleGroup = titleSource.length === 1;
          reactUpdObj.selectedGroupIds = prunedIds;
          reactUpdObj.selectedGroupMembersPerGroup = newMembersPerGroup;
          reactUpdObj.selectedGroup_id = singleGroup ? titleSource[0] : null;
          reactUpdObj.selectedGroupRec = prunedIds.length === 0
            ? false
            : singleGroup
              ? groupsManagedObject[titleSource[0]]
              : { group_id: null, group_name: 'Multiple Groups', multi: true };
          reactUpdObj.selectedGroupMembers = Object.keys(newGroupMembers).length > 0 ? newGroupMembers : false;
          reactUpdObj.sortedGroupMembers = sortGroupMembers(newGroupMembers);
        }
        updateReactData(reactUpdObj, true);
      }
    };
  };

  const myParent = (this_group) => {
    let groupInfo = state.groups.adminHierarchy.find(g => { return g.id === this_group; });
    if (groupInfo && groupInfo.belongs_to && (!groupInfo.belongs_to.toLowerCase().includes('_top_'))) {
      return groupInfo.belongs_to;
    }
    else {
      return false;
    }
  };

  // Returns all descendant group IDs (children, grandchildren, etc.) that are in groupsManagedObject.
  const getDescendants = (groupId) => {
    const result = [];
    const queue = [...(state.groups.parent_of?.[groupId] || [])];
    while (queue.length > 0) {
      const id = queue.shift();
      if (groupsManagedObject[id]) {
        result.push(id);
        queue.push(...(state.groups.parent_of?.[id] || []));
      }
    }
    return result;
  };

  var rowsDisplayed;

  const canDragManage = !!(pSession?.adminAccount || reactData.administrative_account);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  async function selectMembers(this_group, { live = true } = {}) {
    let response = {};
    if (!live) {
      // Fast path: filter in-memory from accessList cache
      const memberList = await getMemberList(this_group, state.session.client_id, {
        name_and_search: true,
        state,
      });
      for (const this_member of memberList.peopleList) {
        response[this_member.person_id] = this_member;
      }
      return response;
    }
    // Live path: query PeopleGroups status-index (PK: client_group_id, SK: membership_status)
    // Returns only active members for this group — excludes deleted/inactive accounts at DB level
    const cgid = `${state.session.client_id}~${this_group}`;
    let items = [];
    let lastKey;
    do {
      const params = {
        TableName: 'PeopleGroups',
        IndexName: 'status-index',
        KeyConditionExpression: 'client_group_id = :cgid AND membership_status = :active',
        ExpressionAttributeValues: { ':cgid': cgid, ':active': 'active' },
      };
      if (lastKey) { params.ExclusiveStartKey = lastKey; }
      const result = await dbClient.query(params).promise()
        .catch(err => { cl({ 'selectMembers: PeopleGroups query error': err }); return null; });
      if (result?.Items) {
        items.push(...result.Items);
      }
      lastKey = result?.LastEvaluatedKey;
    } while (lastKey);
    // Resolve person details from accessList cache (avoids a second DB scan)
    const cacheById = {};
    for (const p of (state.accessList?.[state.session.client_id]?.list || [])) {
      cacheById[p.person_id] = p;
    }
    for (const item of items) {
      const pid = item.person_id;
      const cached = cacheById[pid];
      if (cached) {
        response[pid] = {
          person_id: pid,
          name: cached.name ?? { last: `Unknown ${pid}` },
          display_name: cached.display_name ?? item.display_name ?? pid,
          search_data: cached.search_data ?? `${cached.name?.first || ''} ${cached.name?.last || ''}`.trim(),
        };
      } else {
        // Not in cache — parse the "Last, First" display_name stored in PeopleGroups
        const parts = (item.display_name || pid).split(',');
        response[pid] = {
          person_id: pid,
          name: { last: parts[0]?.trim() || pid, first: parts[1]?.trim() || '' },
          display_name: item.display_name || pid,
          search_data: item.display_name || pid,
        };
      }
    }

    // Backfill top-level members from cached People records when legacy or partial
    // data has People.groups set but is missing PeopleGroups rows for __TOP__/ALL.
    const normalizedGroup = (this_group || '').toString().toUpperCase();
    if (normalizedGroup === '__TOP__' || normalizedGroup === 'ALL') {
      const acceptableTopGroups = ['__TOP__', 'ALL'];
      for (const cached of Object.values(cacheById)) {
        const pid = cached?.person_id;
        const personGroups = Array.isArray(cached?.groups) ? cached.groups.map(g => `${g}`.toUpperCase()) : [];
        if (!pid || response[pid]) { continue; }
        if (!personGroups.some(g => acceptableTopGroups.includes(g))) { continue; }
        response[pid] = {
          person_id: pid,
          name: cached.name ?? { last: `Unknown ${pid}` },
          display_name: cached.display_name ?? pid,
          search_data: cached.search_data ?? `${cached.name?.first || ''} ${cached.name?.last || ''}`.trim(),
        };
      }
    }

    return response;
  }

  async function initialize() {
    let assignmentList = [];
    if (reactData.assignmentView && reactData.allowAssign && !reactData.assignmentList) {
      // Normalize to one deduplicated group list and fetch members in a single call.
      const assignmentGroupIds = [];
      if (typeof (reactData.allowAssign) === 'string') {
        assignmentGroupIds.push(reactData.allowAssign);
      }
      else {
        for (let this_row of reactData.allowAssign) {
          if (isObject(this_row)) {
            assignmentGroupIds.push(...[(this_row.groups || this_row.group)].flat());
          }
          else {
            assignmentGroupIds.push(...[this_row].flat());
          }
        }
      }
      const uniqueAssignmentGroupIds = [...new Set(assignmentGroupIds.filter(Boolean))];
      if (uniqueAssignmentGroupIds.length > 0) {
        assignmentList.push(...await getGroupMembers({
          groupList: uniqueAssignmentGroupIds,
          short: true
        }));
      }
      if (assignmentList.length > 0) {
        assignmentList = assignmentList.sort((a, b) => {
          if (a.last_name < b.last_name) { return -1; }
          else if (a.last_name > b.last_name) { return 1; }
          else if (a.first_name < b.first_name) { return -1; }
          else { return 1; }
        });
      }
    };
    // Pre-select a group if requested
    let preSelectUpdates = {};
    const preGroups = preSelectedGroup
      ? (Array.isArray(preSelectedGroup) ? preSelectedGroup : [preSelectedGroup]).filter(id => groupsManagedObject[id])
      : [];
    if (preGroups.length > 0) {
      const newMembersPerGroup = {};
      for (const id of preGroups) {
        newMembersPerGroup[id] = await selectMembers(id, { live: true });
      }
      const newGroupMembers = {};
      for (const id of preGroups) { Object.assign(newGroupMembers, newMembersPerGroup[id] || {}); }
      const titledIds = preGroups.filter(id => Object.keys(newMembersPerGroup[id] || {}).length > 0);
      const titleSource = titledIds.length > 0 ? titledIds : preGroups;
      const singleGroup = titleSource.length === 1;
      const selectedGroupRec = singleGroup
        ? groupsManagedObject[titleSource[0]]
        : { group_id: null, group_name: 'Multiple Groups', multi: true };
      const selectedGroup_id = singleGroup ? titleSource[0] : null;
      const sortedGroupMembers = sortGroupMembers(newGroupMembers);
      preSelectUpdates = {
        selectedGroupIds: preGroups,
        selectedGroupMembersPerGroup: newMembersPerGroup,
        selectedGroup_id,
        selectedGroupRec,
        selectedGroupMembers: Object.keys(newGroupMembers).length > 0 ? newGroupMembers : false,
        sortedGroupMembers,
      };
      if (preGroups.length > 0 && preSelectedFunction === 'directory') {
        // When explicit group IDs were requested, bypass accessList.list and pass raw person_id
        // strings — GroupPhotoDirectory fetches any missing records from DB directly.
        const visiblePeople = (directoryGroupIds && directoryGroupIds.length > 0)
          ? sortedGroupMembers
          : state.accessList[state.session.client_id].list.filter(p => sortedGroupMembers.includes(p.person_id));
        preSelectUpdates.showPhotoDirectory = (visiblePeople.length > 0);
        preSelectUpdates.photoDirectoryPeople = visiblePeople;
      } else if (preGroups.length > 0 && preSelectedFunction === 'maintenance') {
        preSelectUpdates.viewGroupMaintenance = preGroups[0];
      }
    }
    updateReactData({ assignmentList, building: 'done', ...preSelectUpdates }, true);
  }

  React.useEffect(() => {
    isMounted.current = true;
    isExiting.current = false;
    initialize();
    window.addEventListener('resize', handleResize);
    return () => {
      isMounted.current = false;
      window.removeEventListener('resize', handleResize);
      clearTimeout(filterTimeoutRef.current);
      clearTimeout(personRowDragResetRef.current);
    };
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

  const dialogContent = (
    <React.Fragment>
      {reactData.building !== 'done'
        ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' style={{ padding: '32px 16px' }}>
          <Typography style={{ marginBottom: 16 }}>{reactData.progressMessage || 'Loading...'}</Typography>
          <LinearProgress style={{ width: '80%' }} />
        </Box>
        : Object.keys(groupsManagedObject).length === 0
        ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Typography
            style={{
              marginTop: 4,
              marginBottom: 2,
              marginLeft: 2,
              marginRight: 2,
              paddingTop: 3,
            }}
          >
            {`No Groups to show for ${pSession.patient_display_name || 'your account'}`}
          </Typography>
        </Box>
        :
        <React.Fragment>
          <Box style={{ borderRadius: '30px 30px 30px 30px', marginRight: '16px' }}
            key={'topRow'}
            display='flex' flexDirection='row' justifyContent='space-between' alignItems='flex-end'
          >
            <Box
              key={'topBox'}
              display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            >
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1.5, right: 1 } })}
                id='scroll-dialog-title'
              >
                {'Manage Groups and People'}
              </Typography>
              <TextField
                style={{
                  marginLeft: '24px',
                  marginRight: '16px',
                  marginBottom: '16px',
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingBottom: '8px',
                  width: '400px',
                  verticalAlign: 'middle',
                  fontSize: 0.4,
                  minHeight: 2.8,
                }}
                id='List Filter'
                key={`filter_${reactData.people_filter_reset}`}
                className={classes.freeInput}
                defaultValue={reactData.lower_people_filter || null}
                onChange={event => (handleChangePersonFilter(event.target.value))}
                helperText={'Filter People'}
                inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
          </Box>

          <Box display='flex' flexDirection={isSmallScreen() ? 'column' : 'row'} style={{ flexGrow: 1, height: '100px' }}>

            {/* LEFT SIDE */}
            {(!isSmallScreen() || !reactData.selectedGroupRec) &&
              <Box display='flex' style={{ width: isSmallScreen() ? '95%' : '44.5%', overflow: 'auto' }}
                flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                marginLeft={'32px'}
              >
                <Typography
                  key={`g_client_name_header`}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={async (e) => {
                    // Keep GroupControl state in place after drag/drop.
                    // Full refresh here clears selectedGroup and right-side list context.
                    await handleDrop(e, {
                      droppedOn: {
                        levelZero: true
                      }
                    });
                  }}
                  style={AVATextStyle({
                    size: 1.5,
                    bold: true,
                    overflow: 'visible',
                    margin: { top: 1, bottom: 1 },
                  })}>
                  {`${state.session.client_name} Groups`}
                </Typography>
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ paddingRight: '8px', scrollbarWidth: 'thin', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    key={`activity-list_${Object.keys(groupsManagedObject).length}`}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {Object.keys(groupsManagedObject).map((listEntry, listIndex) => (
                      <React.Fragment key={`frag_${listIndex}`}>
                        {(((groupsManagedObject[listEntry].level - reactData.minimumGroupLevel) < 3) ||
                          !(reactData.levelHidden[listIndex] ?? reactData.defaultCollapsed)) &&
                          <Box
                            display='flex' flexDirection='row'
                            justifyContent='flex-start'
                            alignItems='center'
                            key={`activity-list_${listIndex}_${((listIndex === focusAt) ? 'selected' : '')}`}
                            draggable={canDragManage && groupsManagedObject[listEntry].group_type !== 'header'}
                            onDragStart={(e) => handleDragStart(e, {
                              group_id: listEntry,
                              groupObj: groupsManagedObject[listEntry],
                              listIndex
                            })}
                            onDragOver={(e) => handleDragOver(e)}
                            onDrop={async (e) => {
                              // Intentionally avoid onRefresh() here so the current
                              // right-side selection/member view does not reset.
                              await handleDrop(e, {
                                droppedOn: {
                                  group_id: listEntry,
                                  groupObj: groupsManagedObject[listEntry],
                                  listIndex
                                }
                              });
                            }}
                            onContextMenu={async (e) => {
                              if (groupsManagedObject[listEntry].group_type === 'header') return;
                              e.preventDefault();
                              updateReactData({
                                viewGroupMaintenance: listEntry
                              }, true);
                            }}
                          >
                            <Typography
                              key={`g_text_${listIndex}_${(listIndex === focusAt) ? 'selected' : ''}`}
                              onClick={async (event) => {
                                if (groupsManagedObject[listEntry].group_type === 'header') return;
                                const currentIds = reactData.selectedGroupIds || [];
                                // Subtree = this group + all its descendants (recursive)
                                const subtree = [listEntry, ...getDescendants(listEntry)];
                                const allSelected = subtree.every(id => currentIds.includes(id));
                                let newIds, newMembersPerGroup, intersectionMode = false;
                                if (event.ctrlKey || event.metaKey) {
                                  intersectionMode = true;
                                  // Ctrl/Cmd+click: intersection — narrow current display to members also in this group's subtree
                                  // PeopleGroups hierarchy: querying the root covers all descendants — no need to loop subtree
                                  const intersectPerGroup = {};
                                  intersectPerGroup[listEntry] = await selectMembers(listEntry, { live: true });
                                  const intersectPersonIds = new Set(Object.keys(intersectPerGroup[listEntry] || {}));
                                  // Filter each currently-selected group's member list to the intersection
                                  const currentPerGroup = reactData.selectedGroupMembersPerGroup || {};
                                  newMembersPerGroup = {};
                                  for (const id of currentIds) {
                                    const filtered = Object.fromEntries(
                                      Object.entries(currentPerGroup[id] || {}).filter(([pid]) => intersectPersonIds.has(pid))
                                    );
                                    if (Object.keys(filtered).length > 0) newMembersPerGroup[id] = filtered;
                                  }
                                  // Add the Ctrl+clicked subtree to selectedGroupIds so it appears highlighted;
                                  // member filtering is driven by newMembersPerGroup, not newIds
                                  newIds = [...new Set([...currentIds, ...subtree])];
                                  // Preserve existing intersectionMode if already active
                                  intersectionMode = true;
                                } else if (event.shiftKey) {
                                  // Shift+click: union/toggle — add this subtree to (or remove from) existing selection
                                  if (allSelected) {
                                    // All in subtree selected → deselect all of them
                                    newIds = currentIds.filter(id => !subtree.includes(id));
                                    newMembersPerGroup = { ...(reactData.selectedGroupMembersPerGroup || {}) };
                                    for (const id of subtree) { delete newMembersPerGroup[id]; }
                                    // Prune any ancestor that no longer has all its descendants selected.
                                    const toPrune = newIds.filter(id =>
                                      getDescendants(id).some(d => groupsManagedObject[d] && !newIds.includes(d))
                                    );
                                    for (const id of toPrune) { delete newMembersPerGroup[id]; }
                                    newIds = newIds.filter(id => !toPrune.includes(id));
                                  } else {
                                    // Some or none selected → add missing subtree members to current selection
                                    // PeopleGroups hierarchy: querying the root covers all descendants — no need to loop subtree
                                    const toAdd = subtree.filter(id => !currentIds.includes(id));
                                    newMembersPerGroup = { ...(reactData.selectedGroupMembersPerGroup || {}) };
                                    if (toAdd.length > 0) {
                                      newMembersPerGroup[listEntry] = await selectMembers(listEntry, { live: true });
                                    }
                                    newIds = [...currentIds, ...toAdd];
                                  }
                                } else {
                                  // Plain click: replace selection with only this subtree
                                  // (toggle off if this subtree is already the entire selection)
                                  const onlyThisSelected = allSelected && currentIds.every(id => subtree.includes(id));
                                  if (onlyThisSelected) {
                                    newIds = [];
                                    newMembersPerGroup = {};
                                  } else {
                                    // PeopleGroups hierarchy: querying the root covers all descendants — no need to loop subtree
                                    newMembersPerGroup = {};
                                    newMembersPerGroup[listEntry] = await selectMembers(listEntry, { live: true });
                                    newIds = [...subtree];
                                  }
                                }
                                // Every selected group contributes its members.
                                // Object.assign deduplicates by person_id, so overlap between
                                // parent and child lists is handled automatically.
                                const newGroupMembers = {};
                                for (const id of newIds) { Object.assign(newGroupMembers, newMembersPerGroup[id] || {}); }
                                // Title reflects which groups have members; if none do yet (all empty),
                                // fall back to all selected groups so the panel still shows.
                                const titledIds = newIds.filter(id => Object.keys(newMembersPerGroup[id] || {}).length > 0);
                                const titleSource = titledIds.length > 0 ? titledIds : newIds;
                                const singleGroup = titleSource.length === 1;
                                const newSelectedGroupRec = newIds.length === 0
                                  ? false
                                  : singleGroup
                                    ? groupsManagedObject[titleSource[0]]
                                    : { group_id: null, group_name: 'Multiple Groups', multi: true };
                                const newSelectedGroup_id = singleGroup ? titleSource[0] : null;
                                updateReactData({
                                  selectedGroupIds: newIds,
                                  selectedGroupMembersPerGroup: newMembersPerGroup,
                                  intersectionMode,
                                  selectedGroup_id: newSelectedGroup_id,
                                  selectedGroupRec: newSelectedGroupRec,
                                  selectedGroupMembers: Object.keys(newGroupMembers).length > 0 ? newGroupMembers : false,
                                  sortedGroupMembers: sortGroupMembers(newGroupMembers),
                                  selectedPerson_id: false,
                                  selectedPersonRec: false,
                                  selectedPersonFirstName: false,
                                  selectedPersonLastName: false,
                                }, true);
                              }}
                              style={AVATextStyle({
                                size: 1.2,
                                color: ((reactData.selectedPersonRec && reactData.selectedPersonRec.groups.includes(listEntry))
                                  ? 'orange'
                                  : (reactData.intersectionMode && [listEntry, ...getDescendants(listEntry)].every(id => (reactData.selectedGroupIds || []).includes(id)))
                                    ? '#c62828'
                                    : null
                                ),
                                weight: (((reactData.selectedPersonRec && reactData.selectedPersonRec.groups.includes(listEntry)) || [listEntry, ...getDescendants(listEntry)].every(id => (reactData.selectedGroupIds || []).includes(id))) ? 'bold' : null),
                                cursor: canDragManage ? 'grab' : null,
                                userSelect: 'none',
                                margin: { left: (groupsManagedObject[listEntry].level ? ((groupsManagedObject[listEntry].level - reactData.minimumGroupLevel) - 1) * 1.5 : 0), top: 0.35, bottom: 0.65, right: 0.8 },
                              })}>
                              {groupsManagedObject[listEntry].group_name}
                            </Typography>
                            {(groupsManagedObject[listEntry].level - reactData.minimumGroupLevel > 1) && hasChildren(listIndex) && (
                              (reactData.levelHidden[listIndex + 1] ?? reactData.defaultCollapsed) ? (
                                <ExpandMoreIcon
                                  style={{ size: 8, fontSize: '1rem' }}
                                  onClick={async () => {
                                    let keyList = Object.keys(groupsManagedObject);
                                    let kLL = keyList.length;
                                    for (let i = listIndex + 1; ((i < kLL) && (groupsManagedObject[keyList[i]].level > groupsManagedObject[listEntry].level)); i++) {
                                      if (groupsManagedObject[keyList[i]].level === (groupsManagedObject[listEntry].level + 1)) {
                                        reactData.levelHidden[i] = false;
                                      }
                                    }
                                    _savedLevelHidden = reactData.levelHidden;
                                    updateReactData({
                                      levelHidden: reactData.levelHidden
                                    }, true);
                                  }}
                                />
                              ) : (
                                <ExpandLessIcon
                                  style={{ size: 8, fontSize: '1rem' }}
                                  onClick={async () => {
                                    let keyList = Object.keys(groupsManagedObject);
                                    let kLL = keyList.length;
                                    for (let i = listIndex + 1; ((i < kLL) && (groupsManagedObject[keyList[i]].level > groupsManagedObject[listEntry].level)); i++) {
                                      reactData.levelHidden[i] = true;
                                    }
                                    _savedLevelHidden = reactData.levelHidden;
                                    updateReactData({
                                      levelHidden: reactData.levelHidden
                                    }, true);
                                  }}
                                />
                              )
                            )}
                          </Box>
                        }
                      </React.Fragment>
                    ))}
                  </Box>
                </Paper>
                <SendIcon
                  classes={{ root: classes.rowButton }}
                  size='medium'
                  style={{ alignSelf: 'center' }}
                  aria-label="trash_icon"
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                    let sendMessage = [];
                    if (draggedFrom.hasOwnProperty('personObj')) {
                      sendMessage.push({
                        person_id: draggedFrom.personObj.person_id,
                        person_name: `${draggedFrom.personObj.name.first} ${draggedFrom.personObj.name.last}`
                      });
                    }
                    else {
                      sendMessage.push({
                        group_id: draggedFrom.group_id,
                        group_name: draggedFrom.groupObj.group_name
                      });
                    }
                    updateReactData({
                      sendMessage
                    }, true);
                  }}
                  edge="start"
                />
              </Box>
            }

            {/* RIGHT SIDE */}
            {reactData.selectedGroupRec &&
              <Box display='flex' style={{ width: isSmallScreen() ? '95%' : '50%', overflow: 'auto' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={isSmallScreen() ? 0 : 2}
                marginLeft='16px'
                paddingLeft={'32px'}
              >
                <Typography
                  key={`g_name`}
                  onClick={reactData.selectedGroupRec.multi ? undefined : () => {
                    updateReactData({
                      viewGroupMaintenance: reactData.selectedGroupRec.group_id
                    }, true);
                  }}
                  style={AVATextStyle({
                    size: 1.5,
                    overflow: 'visible',
                    bold: true,
                    color: reactData.intersectionMode ? '#c62828' : null,
                    cursor: reactData.selectedGroupRec.multi ? 'default' : null,
                    margin: { top: 1, bottom: 0 },
                  })}>
                  {reactData.selectedGroupRec.group_name}
                </Typography>
                <Typography
                  style={AVATextStyle({
                    size: 0.9,
                    margin: { top: 0, bottom: (reactData.lower_people_filter ? 0 : 1.2) },
                    color: 'textSecondary',
                    overflow: 'visible'
                  })}
                >
                  {`${reactData.sortedGroupMembers?.length || 0} ${(reactData.selectedGroupIds || []).length > 1 ? 'people across selected groups' : 'people in the group'}`}
                </Typography>
                {reactData.lower_people_filter &&
                  <Box display='flex' flexDirection='row'
                    justifyContent='flex-start'
                    alignItems='center'
                    style={{ marginBottom: 1.2, marginTop: 0 }}
                    onClick={() => {
                      handleChangePersonFilter('');
                    }}
                  >
                    <Typography
                      style={AVATextStyle({
                        size: 0.9,
                        margin: { top: 0, bottom: 0, right: 1 },
                        color: 'textSecondary',
                        overflow: 'visible'
                      })}
                    >
                      {'This is a filtered subset.  Tap to remove the filter'}
                    </Typography>
                    <HighlightOffIcon />
                  </Box>
                }
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ scrollbarWidth: 'thin', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {(reactData.lower_people_filter
                      ? reactData.sortedGroupMembers?.filter(p => OKtoShow(p))
                      : reactData.sortedGroupMembers
                    )?.filter(p => !!reactData.selectedGroupMembers[p])
                    .map((this_person, cX) => (
                      <Typography
                        key={`g_textpeople-${cX}`}
                        style={AVATextStyle({
                          overflow: 'visible',
                          size: 1.2,
                          cursor: canDragManage ? 'grab' : null,
                          userSelect: 'none',
                          margin: { top: 0, bottom: 0.8 },
                        })}
                        onClick={async () => {
                          if (personRowDragActiveRef.current) {
                            return;
                          }
                          updateReactData({
                            viewPeopleMaintenance: this_person
                          }, true);
                        }}
                        onContextMenu={async (e) => {
                          e.preventDefault();
                          updateReactData({
                            selectedPerson_id: reactData.selectedGroupMembers[this_person].person_id,
                            selectedPersonRec: await getPerson(reactData.selectedGroupMembers[this_person].person_id, '*all', true),
                            selectedPersonFirstName: reactData.selectedGroupMembers[this_person].name.first,
                            selectedPersonLastName: reactData.selectedGroupMembers[this_person].name.last,
                            alert: {
                              severity: 'info',
                              title: `${reactData.selectedGroupMembers[this_person].name.first} ${reactData.selectedGroupMembers[this_person].name.last}`,
                              message: <div>
                                Person ID: <strong>{reactData.selectedGroupMembers[this_person].person_id}</strong></div>
                            }
                          }, true);
                        }}
                        draggable={canDragManage}
                        onDragStart={(e) => {
                          personRowDragActiveRef.current = true;
                          clearTimeout(personRowDragResetRef.current);
                          handleDragStart(e, {
                            personGroup: reactData.selectedGroup_id,
                            personObj: reactData.selectedGroupMembers[this_person],
                            intent: 'person'
                          });
                        }}
                        onDragEnd={() => {
                          clearTimeout(personRowDragResetRef.current);
                          personRowDragResetRef.current = setTimeout(() => {
                            personRowDragActiveRef.current = false;
                          }, 150);
                        }}
                      >
                        {`${reactData.selectedGroupMembers[this_person].name.first} ${reactData.selectedGroupMembers[this_person].name.last}`}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
                <Box
                  display='flex'
                  flexDirection='row'
                  justifyContent='center'
                  alignItems='center'
                  style={{ alignSelf: 'center', marginTop: '6px' }}
                >
                  <PhotoLibraryIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ marginRight: '12px', opacity: (reactData.sortedGroupMembers?.length > 0) ? 1 : 0.4 }}
                    aria-label="open_photo_directory_icon"
                    onClick={() => {
                      if (reactData.sortedGroupMembers?.length > 0) {
                        openPhotoDirectory();
                      }
                    }}
                  />
                  <GetAppIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ marginRight: reactData.administrative_account ? '12px' : 0, opacity: (reactData.sortedGroupMembers?.length > 0) ? 1 : 0.4 }}
                    aria-label="download_csv_icon"
                    onClick={() => {
                      if (reactData.sortedGroupMembers?.length > 0) {
                        openFieldPicker();
                      }
                    }}
                  />
                  {reactData.administrative_account &&
                    <DeleteIcon
                      classes={{ root: classes.rowButton }}
                      size='medium'
                      style={{ alignSelf: 'center' }}
                      aria-label="trash_icon"
                      onDragOver={(e) => handleDragOver(e)}
                      onDrop={async (e) => {
                        // Same rule for removals: apply local updates only,
                        // do not force a full dialog refresh.
                        await handleDrop_removePerson(e);
                      }}
                      edge="start"
                    />
                  }
                </Box>
              </Box>
            }
          </Box>

        </React.Fragment>
      }
      {reactData.showFieldPicker &&
        <Dialog
          open={reactData.showFieldPicker}
          PaperProps={{ style: { borderRadius: '30px', display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'hidden' } }}
          onClose={() => {
            updateReactData({
              showFieldPicker: false
            }, true);
          }}
          maxWidth='sm'
          fullWidth
        >
          <Box px={2} pt={2} pb={1} style={{ flexShrink: 0 }}>
            <Typography
              style={AVATextStyle({ size: 1.3, bold: true, margin: { bottom: 0.5 } })}
            >
              {'Choose fields to include in the output file'}
            </Typography>
            <Typography
              style={AVATextStyle({ size: 0.9, color: 'textSecondary', margin: { bottom: 1 } })}
            >
              Select data to include in export columns.<br />(Report always includes User ID and Name.)
            </Typography>

            <Box display='flex' flexDirection='row' alignItems='center' flexWrap='wrap' mb={1.5} style={{ gap: '8px' }}>
              <TextField
                select
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                label='Saved report'
                value={reactData.selectedReportId || ''}
                onChange={(e) => {
                  const reportId = e.target.value;
                  if (!reportId) {
                    updateReactData({ selectedReportId: null, reportNameInput: '', selectedExportFieldNames: [], hasUnsavedSelections: false }, true);
                    return;
                  }
                  const report = reactData.savedReports.find(r => r.report_id === reportId);
                  if (report) {
                    const validFields = report.selected_fields.filter(f =>
                      reactData.exportFieldOptions.some(opt => opt.field_key === f)
                    );
                    updateReactData({
                      selectedReportId: reportId,
                      reportNameInput: report.report_name,
                      selectedExportFieldNames: validFields,
                      hasUnsavedSelections: false
                    }, true);
                  }
                }}
                size='small'
                variant='outlined'
                style={{ minWidth: '180px' }}
              >
                <option value=''>— Select saved report —</option>
                {reactData.savedReports.map(r => (
                  <option key={r.report_id} value={r.report_id}>{r.report_name}</option>
                ))}
              </TextField>
              <TextField
                label='Report name'
                value={reactData.reportNameInput || ''}
                onChange={(e) => {
                  updateReactData({ reportNameInput: e.target.value, selectedReportId: null }, true);
                }}
                size='small'
                variant='outlined'
                style={{ minWidth: '160px' }}
              />
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'blue', color: 'white' }}
                size='small'
                disabled={!reactData.reportNameInput?.trim() || reactData.loadingExportFields || reactData.exportInProgress}
                onClick={async () => {
                  const reportName = reactData.reportNameInput.trim();
                  const clientId = pSession?.client_id;
                  const exportScope = 'group_management';
                  const reportId = reactData.selectedReportId
                    || (sanitizeExportBaseName(reportName, 'report') + '_' + Date.now());
                  await saveReport({ clientId, exportScope, reportId, reportName, selectedFieldNames: reactData.selectedExportFieldNames });
                  const savedReports = await listSavedReports({ clientId, exportScope });
                  updateReactData({ savedReports, selectedReportId: reportId, hasUnsavedSelections: false }, true);
                }}
              >
                {'Save Report'}
              </Button>
            </Box>

            {reactData.exportInProgress && (reactData.exportProgressTotal > 0) &&
              <Box mb={1.5}>
                <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 0.4 } })}>
                  {`${reactData.exportProgressLabel || 'Preparing export data...'} ${reactData.exportProgressCurrent}/${reactData.exportProgressTotal}`}
                </Typography>
                <LinearProgress
                  variant='determinate'
                  value={Math.min(100, Math.round((reactData.exportProgressCurrent / reactData.exportProgressTotal) * 100))}
                />
              </Box>
            }
          </Box>
          <Box px={2} pb={1} style={{ flexGrow: 1, overflowY: 'auto' }}>
            {reactData.loadingExportFields
              ?
              <Typography style={AVATextStyle({ size: 1 })}>
                {'Loading field list...'}
              </Typography>
              :
              <Box
                display='flex'
                flexDirection='column'
              >
                {reactData.exportFieldOptions.length === 0
                  ?
                  <Typography style={AVATextStyle({ size: 1 })}>
                    {'No DataDictionary fields were found for this client.'}
                  </Typography>
                  :
                  Object.keys(reactData.exportFieldOptions.reduce((acc, fieldRec) => {
                    const category = fieldRec.category || 'Other';
                    if (!acc[category]) {
                      acc[category] = [];
                    }
                    acc[category].push(fieldRec);
                    return acc;
                  }, {})).sort((a, b) => a.localeCompare(b)).map((categoryKey) => {
                    const groupedFields = reactData.exportFieldOptions.filter((fieldRec) => {
                      return (fieldRec.category || 'Other') === categoryKey;
                    });
                    return (
                      <Box key={`csv_field_group_${categoryKey}`} mb={1}>
                        <Typography
                          style={AVATextStyle({ size: 1, bold: true, margin: { left: 1, top: 0.5, bottom: 0.2 } })}
                        >
                          {categoryKey}
                        </Typography>
                        {groupedFields.map((fieldRec) => {
                            const posIndex = reactData.selectedExportFieldNames.indexOf(fieldRec.field_key);
                            const isChecked = posIndex !== -1;
                            return (
                              <FormControlLabel
                                key={`csv_field_${fieldRec.field_key}`}
                                control={
                                  <Checkbox
                                    color='primary'
                                    style={{ marginLeft: '1rem' }}
                                    checked={isChecked}
                                    disabled={reactData.exportInProgress}
                                    onChange={() => {
                                      toggleExportFieldSelection(fieldRec.field_key);
                                    }}
                                  />
                                }
                                label={
                                  <span>
                                    {fieldRec.description}
                                    {Array.isArray(fieldRec.export_formats) && (
                                      <span style={{
                                        marginLeft: '6px', fontSize: '0.65em', color: 'white',
                                        backgroundColor: (fieldRec.export_formats.includes('pdf') && !fieldRec.export_formats.includes('csv')) ? '#1565C0' : '#2E7D32',
                                        borderRadius: '8px', padding: '1px 5px',
                                      }}>
                                        {(fieldRec.export_formats.includes('pdf') && !fieldRec.export_formats.includes('csv')) ? 'PDF' : 'CSV/XLS'}
                                      </span>
                                    )}
                                    {isChecked &&
                                      <span style={{ marginLeft: '6px', fontSize: '0.75em', color: '#888', fontWeight: 'bold' }}>
                                        {`#${posIndex + 1}`}
                                      </span>
                                    }
                                  </span>
                                }
                              />
                            );
                          })}
                      </Box>
                    );
                  })
                }
              </Box>
            }
          </Box>
          <DialogActions className={classes.buttonArea} style={{ marginBottom: '0' }} >
            {reactData.showDownloadConfirm
              ?
              <Box display='flex' flexDirection='column' alignItems='center' style={{ width: '100%', gap: '8px' }}>
                <Typography style={AVATextStyle({ size: 0.95, bold: true, margin: { bottom: 0.5 } })}>
                  {'These selections haven\u2019t been saved as a report.'}
                </Typography>
                <Box display='flex' flexDirection='row' style={{ gap: '8px' }}>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                    size='small'
                    onClick={() => updateReactData({ showDownloadConfirm: null }, true)}
                  >
                    {'Go back and save'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    onClick={async () => {
                      const fmt = reactData.showDownloadConfirm;
                      updateReactData({ showDownloadConfirm: null }, true);
                      const fn = fmt === 'xlsx' ? downloadCurrentPeopleListXlsx : fmt === 'pdf' ? downloadCurrentPeopleListPdf : downloadCurrentPeopleListCsv;
                      const result = await fn();
                      if (result) updateReactData({ showFieldPicker: false }, true);
                    }}
                  >
                    {`Download ${reactData.showDownloadConfirm === 'xlsx' ? 'Excel' : reactData.showDownloadConfirm === 'pdf' ? 'PDF' : 'CSV'} anyway`}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => updateReactData({ showFieldPicker: false }, true)}
                  >
                    {'Cancel'}
                  </Button>
                </Box>
              </Box>
              :
              (() => {
                const selectedFieldObjects = reactData.exportFieldOptions.filter(
                  f => reactData.selectedExportFieldNames.includes(f.field_key));
                const csvBlockers = selectedFieldObjects
                  .filter(f => Array.isArray(f.export_formats) && !f.export_formats.includes('csv'))
                  .map(f => f.description);
                const xlsxBlockers = selectedFieldObjects
                  .filter(f => Array.isArray(f.export_formats) && !f.export_formats.includes('xlsx'))
                  .map(f => f.description);
                const pdfBlockers = selectedFieldObjects
                  .filter(f => Array.isArray(f.export_formats) && !f.export_formats.includes('pdf'))
                  .map(f => f.description);
                return (
              <React.Fragment>
            <Tooltip placement='top' title={csvBlockers.length > 0 ? `Not available with: ${csvBlockers.join(', ')}` : ''}>
              <span>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: csvBlockers.length > 0 ? '#aaa' : 'green', color: 'white' }}
              size='small'
              onClick={async () => {
                if (reactData.hasUnsavedSelections && reactData.selectedExportFieldNames.length > 0) {
                  updateReactData({ showDownloadConfirm: 'csv' }, true);
                  return;
                }
                const result = await downloadCurrentPeopleListCsv();
                if (result) {
                  updateReactData({
                    showFieldPicker: false
                  }, true);
                }
              }}
              disabled={reactData.loadingExportFields || reactData.exportInProgress || csvBlockers.length > 0}
            >
              {'Download CSV'}
            </Button>
              </span>
            </Tooltip>
            <Tooltip placement='top' title={xlsxBlockers.length > 0 ? `Not available with: ${xlsxBlockers.join(', ')}` : ''}>
              <span>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: xlsxBlockers.length > 0 ? '#aaa' : 'green', color: 'white' }}
              size='small'
              onClick={async () => {
                if (reactData.hasUnsavedSelections && reactData.selectedExportFieldNames.length > 0) {
                  updateReactData({ showDownloadConfirm: 'xlsx' }, true);
                  return;
                }
                const result = await downloadCurrentPeopleListXlsx();
                if (result) {
                  updateReactData({
                    showFieldPicker: false
                  }, true);
                }
              }}
              disabled={reactData.loadingExportFields || reactData.exportInProgress || xlsxBlockers.length > 0}
            >
              {'Download Excel'}
            </Button>
              </span>
            </Tooltip>
            <Tooltip placement='top' title={pdfBlockers.length > 0 ? `Not available with: ${pdfBlockers.join(', ')}` : ''}>
              <span>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: pdfBlockers.length > 0 ? '#aaa' : 'blue', color: 'white' }}
              size='small'
              onClick={async () => {
                if (reactData.hasUnsavedSelections && reactData.selectedExportFieldNames.length > 0) {
                  updateReactData({ showDownloadConfirm: 'pdf' }, true);
                  return;
                }
                const result = await downloadCurrentPeopleListPdf();
                if (result) {
                  updateReactData({
                    showFieldPicker: false
                  }, true);
                }
              }}
              disabled={reactData.loadingExportFields || reactData.exportInProgress || pdfBlockers.length > 0}
            >
              {'Download PDF'}
            </Button>
              </span>
            </Tooltip>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                updateReactData({
                  showFieldPicker: false
                }, true);
              }}
              disabled={reactData.exportInProgress}
            >
              {'Close'}
            </Button>
              </React.Fragment>
                );
              })()
            }
          </DialogActions>
        </Dialog>
      }
      {reactData.showExportFilterPrompt && (
        <ExportFilterPrompt
          promptSpecs={reactData.exportFilterPromptSpecs || []}
          onComplete={async (resolvedValues) => {
            updateReactData({ showExportFilterPrompt: false }, true);
            const result = await downloadCurrentPeopleListPdf(resolvedValues);
            if (result) { updateReactData({ showFieldPicker: false }, true); }
          }}
          onCancel={() => updateReactData({ showExportFilterPrompt: false }, true)}
        />
      )}
      {reactData.showPhotoDirectory &&
        (() => {
          const bypassMode = !!(preSelectedGroup && preSelectedFunction === 'directory');
          const closeDirectory = () => {
            updateReactData({ showPhotoDirectory: false, photoDirectoryPeople: [] }, true);
            if (bypassMode) { onCancel(); }
          };
          return (
        <Dialog
          open={reactData.showPhotoDirectory}
          onClose={closeDirectory}
          fullScreen
          scroll='paper'
          PaperProps={{
            style: {
              margin: 0,
              height: '100%',
              maxHeight: '100%',
              overflow: 'hidden'
            }
          }}
        >
          <Box style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <GroupPhotoDirectory
              options={{
                groupMemberList: reactData.photoDirectoryPeople,
                pClient: pSession.client_id,
                pGroup: reactData.selectedGroup_id,
                    pGroupName: reactData.selectedGroupRec?.group_name || reactData.selectedGroup_id,
                hideContactInfo: reactData.no_contact_directory
              }}
              onReset={closeDirectory}
            />
          </Box>
        </Dialog>
          );
        })()
      }
      {reactData.sendMessage &&
        <MessageForm
          pPerson={state.session.patient_id}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          options={{
            newMessage: true,
            recipients: reactData.sendMessage
          }}
        />
      }
      {reactData.viewPeopleMaintenance &&
        <PeopleMaintenance
          person_id={reactData.viewPeopleMaintenance}
          key={`goForPeople_${reactData.viewPeopleMaintenance}`}
          initialValues={{ color: 'green' }}
          options={{
            sectionToShow: ['snapshot']
          }}
          onClose={async () => {
            let reactUpd = {
              viewPeopleMaintenance: false,
              updatesMade: true,
            };
            if (reactData.selectedGroup_id) {
              // Live DB fetch (bypass cache) so edits are visible immediately
              reactUpd.selectedGroupMembers = await selectMembers(reactData.selectedGroup_id, { live: true });
              reactUpd.sortedGroupMembers = sortGroupMembers(reactUpd.selectedGroupMembers);
            }
            updateReactData(reactUpd, true);
            // Silent background re-check after Lambda has had time to run
            if (reactData.selectedGroup_id) {
              const groupIdAtClose = reactData.selectedGroup_id;
              setTimeout(async () => {
                if (!isMounted.current) return;
                const freshMembers = await selectMembers(groupIdAtClose, { live: true });
                updateReactData({
                  selectedGroupMembers: freshMembers,
                  sortedGroupMembers: sortGroupMembers(freshMembers),
                }, true);
              }, 4000);
            }
          }}
        />
      }
      {reactData.viewGroupMaintenance &&
        <GroupMaintenance
          pK={reactData.viewGroupMaintenance}
          client_id={state.session.client_id}
          overrideValues={null}
          tableName='Groups'
          pKName='group_id'
          options={{
            sectionToShow: null,
            color: 'blue',
            groupsManagedObject,
            minimumGroupLevel: reactData.minimumGroupLevel,

          }}
          onModuleClose={async ({ response = {}, reason }) => {
            console.log(`Exit from GroupMaintenance with reason: `, reason);
            let reactUpd = {};
            if (response.reload) {
              let jumpTo = `${window.location.href.replace('refresh', 'theseus')}?goto=group_management`;
              window.location.replace(jumpTo);
            }
            if (response.refresh) {
              exitGroupControl({
                mode: 'refresh',
                reason: reason || 'group_maintenance_reload',
                payload: {
                  source: 'group_maintenance',
                  restart: true
                }
              });
              return;
            }
            else {
              if (response.rename) {
                groupsManagedObject[reactData.viewGroupMaintenance].group_name = response.rename;
              }
              if (response.membership) {
                reactUpd.updatesMade = true;
                reactUpd.selectedGroupMembers = await selectMembers(reactData.viewGroupMaintenance, { live: true });
                reactUpd.sortedGroupMembers = sortGroupMembers(reactUpd.selectedGroupMembers);
              }
            }
            reactUpd.viewGroupMaintenance = false;
            updateReactData(reactUpd, true);
          }}
        />
      }
      {promptForName &&
        <AVATextInput
          promptText="Enter a Name for the Group you're creating"
          buttonText='Create'
          onCancel={() => { setPromptForName(false); }}
          onSave={async (newGroupName) => {
            setPromptForName(false);
            const newGroupID = await createNewGroup({
              client_id: pSession.client_id,
              group_name: newGroupName,
              adminList: pSession.patient_id,
              memberList: []
            });
            onRefresh({
              newGroupID,
              newGroupName
            });
          }}
        />
      }
      {!promptForName && (rowsDisplayed === 0) &&
        <Box display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
          <Typography
            key={`g_text_end`}
            style={AVATextStyle({
              size: 1.5,
              margin: { bottom: 1 },
            })}>
            {'This Group has no members'}
          </Typography>
        </Box>
      }
      <DialogActions className={classes.buttonArea} >
        {(isSmallScreen() && (reactData.selectedPersonRec || reactData.selectedGroupRec)) &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'white', color: 'blue' }}
            size='small'
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={() => {
              updateReactData({
                showQuickSearch: false,
                selectedGroup_id: false,
                selectedGroupRec: false,
                seletedGroupMembers: false,
                selectedPerson_id: false,
                selectedPersonRec: false,
                selectedPersonFirstName: false,
                selectedPersonLastName: false,
              }, true);
            }}
          >
            {'Back'}
          </Button>
        }
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          startIcon={<CloseIcon fontSize="small" />}
          onClick={() => {
            exitGroupControl({
              mode: 'cancel',
              reason: 'done'
            });
          }}
        >
          {'Done'}
        </Button>
        {pSession?.adminAccount &&
          <Button
            onClick={() => {
              setPromptForName(true);
            }}
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            startIcon={<GroupAddIcon fontSize="small" />}
          >
            {`New Group`}
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
    </React.Fragment>
  );

  if (!renderAsDialog) {
    return dialogContent;
  }

  return (
    <Dialog
      open={true || refreshTrigger}
      maxWidth={false}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
    >
      {dialogContent}
    </Dialog>
  );
};
