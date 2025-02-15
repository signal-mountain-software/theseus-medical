import React from 'react';

import useSession from '../../hooks/useSession';

import { createNewGroup, getGroupMembers, getMemberList } from '../../util/AVAGroups';
import { dbClient, sentenceCase, isObject, recordExists, deepCopy, listFromArray } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';
import { getPerson, getImage } from '../../util/AVAPeople';
import AVATextInput from '../forms/AVATextInput';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloseIcon from '@material-ui/icons/ExitToApp';
import DeleteIcon from '@material-ui/icons/Delete';
import PeopleIcon from '@material-ui/icons/People';
import SettingsIcon from '@material-ui/icons/Settings';
import SendIcon from '@material-ui/icons/Send';

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

  const { state } = useSession();

  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');
  const [promptForName, setPromptForName] = React.useState(false);

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: 1,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    // from defaults
    agendaView: defaults.agendaView,
    allowAssign: defaults.allowAssign,
    assignmentList: defaults.assignmentList,
    assignmentView: defaults.assignmentView,
    viewOnly: defaults.viewOnly,




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
    groupsManagedObject: [],
    groupMemberList: [],
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
    loading: false,
    needRef: false,
    newGroups: {},
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


  function handleResize() {
    updateReactData({
      window_width: Math.min(((window.window.innerWidth - 220) / 1400), 1),
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
        state.groups.parent_of[new_parent].push(draggedFrom.group_id);
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
          name: draggedFrom.grouObj.groupName,
          selectable: true
        });
      }
      if (reactData.selectedPersonRec) {
        let newGroupList = deepCopy(reactData.selectedPersonRec.groups);
        for (let this_group of targetGroup_formerFamilyTree) {
          if (newGroupList.includes(this_group)) {
            newGroupList.splice(newGroupList.indexOf(this_group), 1);
          }
        }
        for (let this_group of targetGroup_newFamilyTree) {
          if (!newGroupList.includes(this_group)) {
            newGroupList.push(this_group);
          }
        }
        updateReactData({
          selectedPersonRec: Object.assign({}, reactData.selectedPersonRec, { groups: newGroupList })
        }, true);
      }
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
            message: `Something's not right... we couldn't find ${droppedOn.personObj.first_name} in the database.  Contact Support for more assistance`
          }
        }, true);
        return;
      }
      // good peopleRec
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
      if (reactData.selectedPersonRec) {
        reactUpdObj.selectedPersonRec = Object.assign({}, peopleRec.Item, { groups: newGroupList });
      }
      else if (reactData.selectedGroupRec) {
        if (newGroupList.includes(reactData.selectedGroup_id)) {
          if (!reactData.selectedGroupMembers.hasOwnProperty(draggedFrom.personObj.person_id)) {
            reactData.selectedGroupMembers[draggedFrom.personObj.AVAclassesperson_id] = peopleRec.Item;
          };
          reactUpdObj.selectedGroupMembers = reactData.selectedGroupMembers;
        }
      }
      updateReactData(reactUpdObj, true);
    };
  };


  const handleDrop_removeGroup = async (ev) => {
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
      // we are removing the draggedFrom.personGroup from the group list for draggedFrom.person_id;  get the current group list
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
        selectedPersonRec: Object.assign({}, peopleRec.Item, { groups: newGroupList })
      }, true);
    };
  };

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

  const placeholderImage =
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/tboone.jpg';

  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };

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
        selectedGroupMembers: reactData.selectedGroupMembers
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
        if (reactData.selectedGroup_id === draggedFrom.groupObj.group_id) {
          reactUpdObj.selectedGroupRec = false;
          reactUpdObj.selectedGroup_id = false;
          reactUpdObj.selectedGroupMembers = false;
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

          {/*   TOP SECTION PEOPLE WITH IMAGES
          {reactData.assignmentList && (reactData.assignmentList.length > 0) &&
            <Paper component={Box} variant='outlined' style={{ scrollbarWidth: 'thin' }} height={'130px'} minHeight={'fit-content'} width='100%' overflow='auto' square>
              <List component={'nav'} >
                <Box
                  key={`candidates`}
                  mx={1}
                  display='flex'
                  justifyContent='flex-start'
                  alignItems='center'
                  flexDirection='row'
                >
                  {reactData.assignmentList && reactData.assignmentList.map((this_candidate, cX) => (
                    <Box
                      key={`candidate-${cX}`}
                      mx={1}
                      display='flex'
                      justifyContent='center'
                      alignItems='center'
                      flexDirection='column'
                      borderRadius={'45px 45px 45px 45px'}
                      paddingTop={'8px'}
                      paddingRight={'4px'}
                      paddingBottom={'16px'}
                      paddingLeft={'4px'}
                      draggable={pSession?.adminAccount}
                      onDragStart={(e) => handleDragStart(e, {
                        person_id: this_candidate.person_id,
                        personObj: this_candidate,
                        listIndex: cX
                      })}
                      onClick={async () => {
                        updateReactData({
                          selectedGroup_id: false,
                          selectedGroupRec: false,
                          seletedGroupMembers: false,
                          selectedPerson_id: this_candidate.person_id,
                          selectedPersonRec: await getPerson(this_candidate.person_id),
                          selectedPersonFirstName: this_candidate.first_name,
                          selectedPersonLastName: this_candidate.last_name,
                        }, true);
                      }}
                    >
                      <Avatar className={classes.assignment_avatar}
                        style={((this_candidate.person_id === reactData.selectedPerson_id) || (reactData.selectedGroup_id && (reactData.selectedGroupMembers.hasOwnProperty(this_candidate.person_id))))
                          ? {
                            borderRadius: '20px',
                            boxShadow: '0 0 20px 5px rgba(255, 145, 0, 0.7)'
                          }
                          : {}
                        }
                        src={getImage(this_candidate.person_id)}
                      >
                        {`${this_candidate.first_name.slice(0, 1)}${this_candidate.last_name.slice(0, 1)}`}
                      </Avatar>
                      <React.Fragment>
                        <Typography
                          noWrap={true}
                          className={classes.dragNamesFirst}
                        >
                          {this_candidate.first_name}
                        </Typography>
                        <Typography
                          noWrap={true}
                          className={classes.dragNamesLast}
                        >
                          {this_candidate.last_name}
                        </Typography>
                      </React.Fragment>
                    </Box>
                  ))}
                </Box>
              </List>
            </Paper>
          }
          */}

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
                style={{ scrollbarWidth: 'none' }}
              >
                <Box display='flex' flexDirection='column'
                  justifyContent='center'
                  alignItems='flex-start'
                >
                  {Object.keys(groupsManagedObject).map((listEntry, listIndex) => (
                    (OKtoShow(groupsManagedObject[listEntry]) &&
                      <React.Fragment key={`frag_${listIndex}`}>
                        <Box
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
                          onClick={async () => {
                            updateReactData({
                              selectedGroup_id: listEntry,
                              selectedGroupRec: groupsManagedObject[listEntry],
                              selectedGroupMembers: await selectMembers(listEntry),
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
                                title: groupsManagedObject[listEntry].group_name,
                                message: <div>
                                  Group ID: <strong>{listEntry}</strong></div>
                              }
                            }, true);
                          }}
                        >
                          <Typography
                            key={`g_text_${listIndex}_${(listIndex === focusAt) ? 'selected' : ''}`}
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
                              margin: { left: (groupsManagedObject[listEntry].level ? ((groupsManagedObject[listEntry].level - minimumGroupLevel) - 1) * 1.5 : 0), top: 0, bottom: 0.8 },
                            })}>
                            {groupsManagedObject[listEntry].group_name}
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

            {/* RIGHT SIDE */}
            {reactData.selectedPersonRec &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
                paddingLeft={'32px'}
              >
                <Box display='flex' flexDirection='row'
                  justifyContent='space-between'
                  alignItems='center'
                  onDragStart={(e) => handleDragStart(e, {
                    person_id: reactData.selectedPerson_id,
                    personObj: reactData.selectedPersonRec,
                  })}
                  style={{ width: '100%' }}
                >
                  <Box display='flex' flexDirection='row'
                    flexGrow={1}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    <Typography
                      key={`g_text_end-last_name`}
                      draggable={true}
                      style={AVATextStyle({
                        size: 1.5,
                        overflow: 'visible',
                        bold: true,
                        margin: { top: 1, bottom: 1, right: 0 },
                      })}>
                      {`${reactData.selectedPersonFirstName} ${reactData.selectedPersonLastName.trim()}`}
                    </Typography>
                    <Typography
                      key={`g_text_end-last_tag`}
                      style={AVATextStyle({
                        size: 1.5,
                        overflow: 'visible',
                        bold: true,
                        margin: { top: 1, bottom: 1, left: 0 },
                      })}>
                      {`'${reactData.selectedPersonLastName.trim().endsWith('s') ? '' : 's'} Groups`}
                    </Typography>
                  </Box>
                  <Box
                    key={'my_image_box'}
                    style={{ marginRight: '16px' }}
                    onClick={() => {
                      updateReactData({
                        viewPeopleMaintenance: reactData.selectedPerson_id
                      }, true);
                    }}
                  >
                    <img
                      key={'my_image'}
                      draggable={true}
                      className={classes.myImageArea}
                      alt={''}
                      onError={onImageError}
                      src={getImage(reactData.selectedPerson_id)}
                    />
                    <SettingsIcon style={{ marginLeft: '-26px' }} />
                  </Box >
                </Box>
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {Object.keys(groupsManagedObject).map((this_group, gX) => (
                      reactData.selectedPersonRec.groups.includes(this_group) &&
                      <Typography
                        key={`g_text_end_group-${gX}`}
                        style={AVATextStyle({
                          size: 1.2,
                          margin: { top: 0, bottom: 0.8 },
                        })}
                        onClick={async () => {
                          updateReactData({
                            selectedGroup_id: this_group,
                            selectedGroupRec: groupsManagedObject[this_group],
                            selectedGroupMembers: await selectMembers(this_group),
                            selectedPerson_id: false,
                            selectedPersonRec: false,
                            selectedPersonFirstName: false,
                            selectedPersonLastName: false,
                          }, true);
                        }}
                        draggable={pSession?.adminAccount}
                        onDragStart={(e) => handleDragStart(e, {
                          personGroup: this_group,
                          personObj: reactData.selectedPersonRec,
                          intent: 'group'
                        })}
                      >
                        {groupsManagedObject[this_group].group_name}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
                {pSession.adminAccount &&
                  <DeleteIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ alignSelf: 'center' }}
                    aria-label="trash_icon"
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={async (e) => {
                      await handleDrop_removeGroup(e);
                      onRefresh();
                    }}
                    edge="start"
                  />
                }
              </Box>
            }
            {reactData.selectedGroupRec &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
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
                  style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.selectedGroupMembers && Object.keys(reactData.selectedGroupMembers).sort((a, b) => {
                      if (reactData.selectedGroupMembers[a].name.last === reactData.selectedGroupMembers[b].name.last) {
                        return (reactData.selectedGroupMembers[a].name.first > reactData.selectedGroupMembers[b].name.first) ? 1 : -1;
                      }
                      else {
                        return (reactData.selectedGroupMembers[a].name.last > reactData.selectedGroupMembers[b].name.last) ? 1 : -1;
                      }
                    }).map((this_person, cX) => (
                      <Typography
                        key={`g_textpeople-${cX}`}
                        style={AVATextStyle({
                          overflow: 'visible',
                          size: 1.2,
                          margin: { top: 0, bottom: 0.8 },
                        })}
                        onClick={async () => {
                          updateReactData({
                            selectedGroup_id: false,
                            selectedGroupRec: false,
                            seletedGroupMembers: false,
                            selectedPerson_id: this_person,
                            selectedPersonRec: await getPerson(this_person),
                            selectedPersonFirstName: reactData.selectedGroupMembers[this_person].name.first,
                            selectedPersonLastName: reactData.selectedGroupMembers[this_person].name.last,
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
                {pSession.adminAccount &&
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
      {reactData.sendMessage &&
        <MessageForm
          pPerson={state.session.person_id}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          options={{
            newMessage: reactData.sendMessage
          }}
        />
      }
      {reactData.viewPeopleMaintenance &&
        <PeopleMaintenance
          person_id={reactData.viewPeopleMaintenance}
          initialValues={{ color: 'green' }}
          options={{}}
          onClose={() => {
            updateReactData({
              viewPeopleMaintenance: false
            }, true);
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
            {!lower_activity_filter ? 'This Group has no members' : 'No members match that filter'}
          </Typography>
        </Box>
      }
      <DialogActions className={classes.buttonArea} >
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
