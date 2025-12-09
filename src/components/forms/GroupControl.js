import React from 'react';

import useSession from '../../hooks/useSession';

import { createNewGroup, getGroupMembers, getMemberList } from '../../util/AVAGroups';
import { dbClient, sentenceCase, isObject, recordExists, deepCopy, listFromArray, cl } from '../../util/AVAUtilities';
import AVATextInput from '../forms/AVATextInput';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import { getPerson } from '../../util/AVAPeople';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloseIcon from '@material-ui/icons/ExitToApp';
import DeleteIcon from '@material-ui/icons/Delete';
import SendIcon from '@material-ui/icons/Send';
import ExpandMoreIcon from '@material-ui/icons/Visibility';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

import { SET_GROUPS } from '../../contexts/Session/actions';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import MessageForm from './MessageForm';

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

export default ({ defaults, pSession, groupsManagedObject, focusAt, onCancel, onSelect, onRefresh }) => {

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
    levelHidden: [],
    loading: false,
    needRef: false,
    newGroups: {},
    people_filter: null,
    lower_people_filter: null,
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
    selectedGroupRec: false,
    selectedGroupMembers: false,
    sortedGroupMembers: [],
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

  const isSmallScreen = () => {
    return (reactData.window_width < 800);
  };

  let filterTimeOut;
  async function handleChangePersonFilter(vCheck) {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(async () => {
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
        let memberList = await selectMembers(listEntry);
        reactUpdObj.selectedGroup_id = listEntry;
        reactUpdObj.selectedGroupRec = groupsManagedObject[listEntry];
        reactUpdObj.selectedGroupMembers = memberList;
        reactUpdObj.sortedGroupMembers = sortGroupMembers(memberList);
      };
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
  const [minimumGroupLevel,] = React.useState(calcMinimumGroupLevel() - 1);

  function hasChildren(this_index) {
    try {
      return (groupsManagedObject[reactData.groupsManagedObject[this_index + 1]].level > groupsManagedObject[reactData.groupsManagedObject[this_index]].level);
    }
    catch {
      return false;
    }
  }

  const handleDragStart = (ev, id) => {
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
      // get my peopleRec
      let peopleRec = await dbClient
        .get({
          TableName: 'People',
          Key: { person_id: draggedFrom.personObj.person_id }
        })
        .promise()
        .catch(error => {
          console.log(`caught error reading People; error is: `, error);
        });
      if (!recordExists(peopleRec)) {
        updateReactData({
          alert: {
            severity: 'error',
            title: 'Error',
            message: `Something's not right... we couldn't find ${draggedFrom.personObj.name?.first || 'this person'} in the database.  Contact Support for more assistance`
          }
        }, true);
        return;
      }
      // good peopleRec
      // are you trying to drag this person to an inactive group?   if so, give an error and send them to PeopleMaintenance
      if (state.session.group_assignments?.inactive && state.session.group_assignments.inactive.includes(droppedOn.group_id)) {
        updateReactData({
          alert: {
            severity: 'error',
            title: 'Dropped on Inactive Group',
            message: `You dragged ${peopleRec.Item.name?.first || 'someone'} to a group of Inactive accounts.  
              For safety, we don't allow that here.
              If you mean to make this account inactive, please tap on ${(peopleRec.Item.name?.first + "'s") || 'their'} name.  
              You can make the account inactive in that screen.`
          }
        }, true);
        return;
      }
      // we are adding the dropped on groups and all its parents to the groupList for this person. Get that list
      let addGroupList = [droppedOn.group_id];
      let this_group = myParent(droppedOn.group_id);
      for (this_group; !!this_group; this_group = myParent(this_group)) {
        addGroupList.push(this_group);
      }
      let newGroupList = deepCopy([peopleRec.Item.groups].flat());
      let addedGroups = [];
      for (let this_group of addGroupList) {
        if (!newGroupList.includes(this_group)) {
          newGroupList.push(this_group);
          addedGroups.push(groupsManagedObject[this_group].group_name);
        }
      }
      let reactUpdObj = {};
      if (addedGroups.length === 0) {
        reactUpdObj.alert = {
          severity: 'info',
          title: `Already a member`,
          message: `${draggedFrom.personObj.name.first} was already a member of ${groupsManagedObject[droppedOn.group_id].group_name}`
        };
      }
      else {
        reactUpdObj.alert = {
          severity: 'success',
          title: `Success!`,
          message: `${draggedFrom.personObj.name.first} was added to ${listFromArray(addedGroups)}`
        };
      }
      // make the update
      let newClientGroupsObj;
      if (peopleRec.Item.clients) {
        newClientGroupsObj = deepCopy(peopleRec.Item.clients);
      }
      else {
        newClientGroupsObj = {
          id: pSession.client_id,
          groups: newGroupList
        };
      }
      if (newClientGroupsObj.hasOwnProperty('id')) {     // expected and standard
        if (newClientGroupsObj.id !== pSession.client_id) {     // but we are in a client other than the typical one (this should be very rare)
          newClientGroupsObj[newClientGroupsObj.id] = Object.assign({}, newClientGroupsObj);
          newClientGroupsObj[pSession.client_id] = {
            id: pSession.client_id,
            groups: newGroupList
          };
        }
        newClientGroupsObj.groups = newGroupList;
        newClientGroupsObj.id = pSession.client_id;
      }
      else {
        newClientGroupsObj[pSession.client_id] = {
          id: pSession.client_id,
          groups: newGroupList
        };
      }
      let UpdateExpression = 'set #g = :g, #c = :c';
      let ExpressionAttributeValues = {
        ':g': newGroupList,
        ':c': newClientGroupsObj
      };
      let ExpressionAttributeNames = {
        '#g': 'groups',
        '#c': 'clients'
      };
      await dbClient
        .update({
          Key: {
            person_id: draggedFrom.personObj.person_id
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ExpressionAttributeNames,
          TableName: "People",
        })
        .promise()
        .catch(error => {
          console.log(`caught error updating Group; error is: `, error);
        });
      if (reactData.selectedGroupRec) {
        if (newGroupList.includes(reactData.selectedGroup_id)) {
          if (!reactData.selectedGroupMembers.hasOwnProperty(draggedFrom.personObj.person_id)) {
            reactData.selectedGroupMembers[draggedFrom.personObj.AVAclassesperson_id] = peopleRec.Item;
          };
          reactUpdObj.selectedGroupMembers = reactData.selectedGroupMembers;
          reactUpdObj.sortedGroupMembers = sortGroupMembers(reactData.selectedGroupMembers);
        }
      }
      updateReactData(reactUpdObj, true);
    };
  };

  function sortGroupMembers(unsortedObj) {
    if (!unsortedObj) { return []; }
    return Object.keys(unsortedObj).sort((a, b) => {
      if (unsortedObj[a].name.last === unsortedObj[b].name.last) {
        return (unsortedObj[a].name.first > unsortedObj[b].name.first) ? 1 : -1;
      }
      else {
        return (unsortedObj[a].name.last > unsortedObj[b].name.last) ? 1 : -1;
      }
    });
  }

  function removeChildren(this_group, newGroupList) {
    if (!state.groups.parent_of.hasOwnProperty(this_group)) {
      return newGroupList;
    }
    for (let this_child of state.groups.parent_of[this_group]) {
      let foundAt = newGroupList.indexOf(this_child);
      if (foundAt > -1) {
        newGroupList.splice(foundAt, 1);
      }
      newGroupList = removeChildren(this_child, newGroupList);
    }
    return newGroupList;
  }

  function checkEmptyParent(this_group, newGroupList) {
    let this_parent = myParent(this_group);
    if (!this_parent) {
      return newGroupList;
    }
    let foundAt = newGroupList.indexOf(this_parent);
    if ((foundAt > -1) && !state.groups.parent_of[this_parent].some(this_child => {
      return newGroupList.includes(this_child);
    })) {
      newGroupList.splice(foundAt, 1);   // remove if no children remaining
    }
    newGroupList = checkEmptyParent(this_parent, newGroupList);
    return newGroupList;
  }

  const handleDrop_removePerson = async (ev) => {
    ev.preventDefault();
    let draggedFrom = JSON.parse(ev.dataTransfer.getData('id'));
    console.log(draggedFrom);
    if (draggedFrom.hasOwnProperty('personGroup')) {
      // get my peopleRec
      let peopleRec = await dbClient
        .get({
          TableName: 'People',
          Key: { person_id: draggedFrom.personObj.person_id }
        })
        .promise()
        .catch(error => {
          console.log(`caught error reading People; error is: `, error);
        });
      if (!recordExists(peopleRec)) {
        updateReactData({
          alert: {
            severity: 'error',
            title: 'Error',
            message: `Something's not right... we couldn't find ${draggedFrom.personObj.name?.first} in the database.  Contact Support for more assistance`
          }
        }, true);
        return;
      }
      // good peopleRec
      // we are removing the draggedFrom.personGroup from the group list for draggedFrom.personObj.person_id;  get the current group list
      let newGroupList = deepCopy([peopleRec.Item.groups].flat());
      let foundAt = newGroupList.indexOf(draggedFrom.personGroup);
      if (foundAt > -1) {
        newGroupList.splice(foundAt, 1);
      }
      // if I am removing a group that has children, remove the chlidren
      newGroupList = removeChildren(draggedFrom.personGroup, newGroupList);

      // if what is left contains a parent of this group and that parent now has no children remaining, remove it
      newGroupList = checkEmptyParent(draggedFrom.personGroup, newGroupList);

      // make the update
      let newClientGroupsObj = deepCopy(peopleRec.Item.clients);
      if (newClientGroupsObj.hasOwnProperty('id')) {     // expected and standard
        if (newClientGroupsObj.id !== pSession.client_id) {     // but we are in a client other than the typical one (this should be very rare)
          newClientGroupsObj[newClientGroupsObj.id] = Object.assign({}, newClientGroupsObj);
          newClientGroupsObj[pSession.client_id] = {
            id: pSession.client_id,
            groups: newGroupList
          };
        }
        newClientGroupsObj.groups = newGroupList;
        newClientGroupsObj.id = pSession.client_id;
      }
      else {
        newClientGroupsObj[pSession.client_id] = {
          id: pSession.client_id,
          groups: newGroupList
        };
      }
      let UpdateExpression = 'set #g = :g, #c = :c';
      let ExpressionAttributeValues = {
        ':g': newGroupList,
        ':c': newClientGroupsObj
      };
      let ExpressionAttributeNames = {
        '#g': 'groups',
        '#c': 'clients'
      };
      await dbClient
        .update({
          Key: {
            person_id: draggedFrom.personObj.person_id
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ExpressionAttributeNames,
          TableName: "People",
        })
        .promise()
        .catch(error => {
          console.log(`caught error updating Group; error is: `, error);
        });
      delete reactData.selectedGroupMembers[draggedFrom.personObj.person_id];
      let removedGroups = [peopleRec.Item.groups].flat().filter(g => { return !newGroupList.includes(g); });
      let alertMessage = false;
      if (removedGroups.length > 0) {
        alertMessage = {
          severity: 'success',
          title: `Success!`,
          message: `${draggedFrom.personObj.name.first} was removed from ${listFromArray(removedGroups.map(g => { return groupsManagedObject[g].group_name; }))}`
        };
      }
      updateReactData({
        alert: alertMessage,
        selectedGroupMembers: reactData.selectedGroupMembers,
        sortedGroupMembers: sortGroupMembers(reactData.selectedGroupMembers)
      }, true);
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
        if (reactData.selectedGroup_id === draggedFrom.groupObj.group_id) {
          reactUpdObj.selectedGroupRec = false;
          reactUpdObj.selectedGroup_id = false;
          reactUpdObj.selectedGroupMembers = false;
          reactUpdObj.sortedGroupMembers = [];
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

  // const autoFocus = (element) => element?.focus();

  var rowsDisplayed;

  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  async function selectMembers(this_group) {
    let response = {};
    let memberList = await getMemberList(this_group, state.session.client_id, { "exclude": false });
    for (const this_member of memberList.peopleList) {
      response[this_member.person_id] = this_member;
    }
    return response;
  }

  async function initialize() {
    let assignmentList = [];
    if (reactData.assignmentView && reactData.allowAssign && !reactData.assignmentList) {
      if (typeof (reactData.allowAssign) === 'string') {         // string - what is listed is a group ID
        assignmentList.push(...await getGroupMembers({
          groupList: [reactData.allowAssign].flat(),
          short: true
        }));
      }
      else {         // array (of objects) - what is listed is an array of group ID objects
        for (let this_row of reactData.allowAssign) {
          if (isObject(this_row)) {
            assignmentList.push(...await getGroupMembers({
              groupList: [(this_row.groups || this_row.group)].flat(),
              short: true
            }));
          }
          else {
            assignmentList.push(...await getGroupMembers({
              groupList: [this_row].flat(),
              short: true
            }));
          }
        }
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
    updateReactData({ assignmentList }, true);
  }

  React.useEffect(() => {
    initialize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

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
      {Object.keys(groupsManagedObject).length === 0
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
            {`No Groups to show for ${pSession.user_display_name}`}
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
                className={classes.freeInput}
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
                    await handleDrop(e, {
                      droppedOn: {
                        levelZero: true
                      }
                    });
                    onRefresh();
                  }}
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
                    key={`activity-list_${Object.keys(groupsManagedObject).length}`}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {Object.keys(groupsManagedObject).map((listEntry, listIndex) => (
                      <React.Fragment key={`frag_${listIndex}`}>
                        {((groupsManagedObject[listEntry].level < 3) ||
                        !(reactData.levelHidden[listIndex] ?? reactData.defaultCollapsed)) &&
                          <Box
                            display='flex' flexDirection='row'
                            justifyContent='flex-start'
                            alignItems='center'
                            key={`activity-list_${listIndex}_${((listIndex === focusAt) ? 'selected' : '')}`}
                            draggable={pSession?.adminAccount}
                            onDragStart={(e) => handleDragStart(e, {
                              group_id: listEntry,
                              groupObj: groupsManagedObject[listEntry],
                              listIndex
                            })}
                            onDragOver={(e) => handleDragOver(e)}
                            onDrop={async (e) => {
                              await handleDrop(e, {
                                droppedOn: {
                                  group_id: listEntry,
                                  groupObj: groupsManagedObject[listEntry],
                                  listIndex
                                }
                              });
                              onRefresh();
                            }}
                            onContextMenu={async (e) => {
                              e.preventDefault();
                              updateReactData({
                                alert: {
                                  severity: 'info',
                                  title: groupsManagedObject[listEntry].group_name,
                                  message: <div>
                                    Group ID: <strong>{listEntry}</strong></div>
                                }
                              }, true);
                            }}
                          >
                            <Typography
                              key={`g_text_${listIndex}_${(listIndex === focusAt) ? 'selected' : ''}`}
                              onClick={async () => {
                                let selectedGroupMembers = await selectMembers(listEntry);
                                updateReactData({
                                  selectedGroup_id: listEntry,
                                  selectedGroupRec: groupsManagedObject[listEntry],
                                  selectedGroupMembers,
                                  sortedGroupMembers: sortGroupMembers(selectedGroupMembers),
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
                                  : null
                                ),
                                weight: (((reactData.selectedPersonRec && reactData.selectedPersonRec.groups.includes(listEntry)) || (reactData.selectedGroup_id === listEntry)) ? 'bold' : null),
                                margin: { left: (groupsManagedObject[listEntry].level ? ((groupsManagedObject[listEntry].level - minimumGroupLevel) - 1) * 1.5 : 0), top: 0.35, bottom: 0.65, right: 0.8 },
                              })}>
                              {groupsManagedObject[listEntry].group_name}
                            </Typography>
                            {(groupsManagedObject[listEntry].level > 1) && hasChildren(listIndex) && (
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
                paddingLeft={'32px'}
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
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ scrollbarWidth: 'thin', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.sortedGroupMembers && reactData.sortedGroupMembers.map((this_person, cX) => (
                      (!reactData.lower_people_filter
                        || (`${reactData.selectedGroupMembers[this_person].name.first} ${reactData.selectedGroupMembers[this_person].name.last}`).toLowerCase().includes(reactData.lower_people_filter)) &&
                      <Typography
                        key={`g_textpeople-${cX}`}
                        style={AVATextStyle({
                          overflow: 'visible',
                          size: 1.2,
                          margin: { top: 0, bottom: 0.8 },
                          weight: (reactData.selectedPerson_id === reactData.selectedGroupMembers[this_person].person_id
                            ? 'bold'
                            : null
                          ),
                          color: (reactData.selectedPerson_id === reactData.selectedGroupMembers[this_person].person_id
                            ? 'orange'
                            : null
                          ),
                        })}
                        onClick={async () => {
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
                        draggable={pSession?.adminAccount}
                        onDragStart={(e) => handleDragStart(e, {
                          personGroup: reactData.selectedGroup_id,
                          personObj: reactData.selectedGroupMembers[this_person],
                          intent: 'person'
                        })}
                      >
                        {`${reactData.selectedGroupMembers[this_person].name.first} ${reactData.selectedGroupMembers[this_person].name.last}`}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
                {reactData.administrative_account &&
                  <DeleteIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ alignSelf: 'center' }}
                    aria-label="trash_icon"
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={async (e) => {
                      await handleDrop_removePerson(e);
                      onRefresh();
                    }}
                    edge="start"
                  />
                }
              </Box>
            }
          </Box>

        </React.Fragment>
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
              viewPeopleMaintenance: false
            };
            if (reactData.selectedGroup_id) {
              reactUpd.selectedGroupMembers = await selectMembers(reactData.selectedGroup_id);
              reactUpd.sortedGroupMembers = sortGroupMembers(reactUpd.selectedGroupMembers);
            }
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
            onCancel();
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
    </Dialog>
  );
};
