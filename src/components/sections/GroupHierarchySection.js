import React from 'react';

import { Box, Typography, Paper, TextField } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import AVAConfirm from '../forms/AVAConfirm';

import SaveIcon from '@material-ui/icons/Save';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const [tempName, setTempName] = React.useState("");
  const [tempBelongsTo, setTempBelongsTo] = React.useState(null);
  const [confirmParentTarget, setConfirmParentTarget] = React.useState(null);

  React.useEffect(() => {

    async function initialize() {
      // 
    }

    initialize();
    return () => {
      // clean up function
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function rebuildGroupsManagedObject({ source, target }) {

    let OGGroupList = Object.keys(reactData.groupsManagedObject);
    let sourceAt = OGGroupList.indexOf(source);
    let sourceOGLevel = reactData.groupsManagedObject[source].level;

    // first, gather up everything form the source location until - but not including the next item at the same or high level than the source is at
    let sourceHierarchyLength = 1;
    for (let i = sourceAt + 1; i < OGGroupList.length; i++) {
      if (reactData.groupsManagedObject[OGGroupList[i]].level <= sourceOGLevel) {
        break;
      }
      sourceHierarchyLength++;
    }
    let beforeSourceHierarchy = OGGroupList.slice(0, sourceAt);
    let sourceHierarchy = OGGroupList.slice(sourceAt, sourceAt + sourceHierarchyLength);
    let afterSourceHierarchy = OGGroupList.slice(sourceAt + sourceHierarchyLength);

    let targetAt = OGGroupList.indexOf(target);
    if (targetAt > sourceAt && targetAt < (sourceAt + sourceHierarchyLength)) {
      // This is a problem.  An item cannot be moved to become its own child.  Do not update the group hierarchy and instead just return.
      return false;
    }

    // we need to reset the level numbers for all groups in the source hierarchy.
    const target_level = reactData.groupsManagedObject[OGGroupList[targetAt]].level;  // first, get the target's level
    const source_level = reactData.groupsManagedObject[OGGroupList[sourceAt]].level;  // now, get the source's level
    const level_diff = target_level - source_level + 1;  // now, we can loop through the source hierarchy and update the level numbers for each item in the source hierarchy
    sourceHierarchy.forEach((group_id) => {
      reactData.groupsManagedObject[group_id].level += level_diff;
    });

    let newGroupObject = {};
    let newGroupList = [];
    if (targetAt < sourceAt) {
      let upToTarget = beforeSourceHierarchy.slice(0, targetAt + 1);
      let afterTarget = beforeSourceHierarchy.slice(targetAt + 1);
      // new list is upToTarget + sourceHierarchy + afterTarget + afterSourceHierarchy
      newGroupList = upToTarget.concat(sourceHierarchy).concat(afterTarget).concat(afterSourceHierarchy);
    }
    else {  // we already ruled out target being IN the sourceHieracrhy, so the target must be after the source hierarchy.  In this case, we want to insert the source hierarchy after the target item, which means we want everything up to and including the target, then the source hierarchy, then everything after the target until we get to the source hierarchy, then everything after the source hierarchy.
      targetAt = targetAt - beforeSourceHierarchy.length - sourceHierarchy.length;  // we need to adjust the target index to account for the fact that the source hierarchy will be removed from the list before being reinserted at the target location.
      let upToTarget = afterSourceHierarchy.slice(0, targetAt + 1);
      let afterTarget = afterSourceHierarchy.slice(targetAt + 1);
      // new list is beforeSourceHierarchy + upToTarget + sourceHierarchy + afterTarget
      newGroupList = beforeSourceHierarchy.concat(upToTarget).concat(sourceHierarchy).concat(afterTarget);
    }

    // now, we need to full replace the groupsManagedObject with a new object that has the same items but in the new order and with the updated level numbers for the source hierarchy.
    newGroupList.forEach((group_id) => {
      newGroupObject[group_id] = reactData.groupsManagedObject[group_id];
    });
    return newGroupObject;

  }

  async function reassignParentGroup(targetGroupID) {
    // Tapping the group name will make that group the parent of the current group
    let newGroupObject = rebuildGroupsManagedObject({ source: currentValues.Groups.group_id, target: targetGroupID });
    if (!newGroupObject) {
      // This means the user attempted to move a group to become a child of itself, which is not allowed.  Do not update the group hierarchy and instead just return.
      await updateField({
        reactUpd: {
          alert: {
            severity: 'warning',
            title: 'Circular Reference',
            message: `A group cannot be a child of itself.`,
          }
        }
      });
    }
    else {
      await updateField({
        updateList:
          [{
            tableName: 'Groups',
            fieldName: 'belongs_to',
            newData: targetGroupID,
            refresh_onExit: true
          }],
        reactUpd: {
          groupsManagedObject: newGroupObject
        }
      });
    }
  }

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='flex-start' marginBottom={2}
        justifyContent='flex-start' flexDirection='column'>
        <Typography
          style={AVATextStyle({ bold: true, size: 1.2, margin: { top: 0, right: 0.5 } })}
        >
          Use this screen to change {currentValues.Groups.name}'s parent group and to add new children<br /><br />
        </Typography>
        <Typography
          style={AVATextStyle({ margin: { top: 0, right: 0.5 } })}
        >
          Tap on the
          <AddCircleOutlineIcon style={{ fontSize: '1rem', verticalAlign: 'text-bottom', marginBottom: '0.1rem', marginLeft: '0.2rem', marginRight: '0.2rem' }} />
          to add a new child below {currentValues.Groups.name}.<br /><br />
        </Typography>        
        <Typography
          style={AVATextStyle({ margin: { top: 0, right: 0.5 } })}
        >
          The group you are viewing ({currentValues.Groups.name}) is highlighted in <strong style={{ color: 'blue' }}>blue</strong>.<br />
          {currentValues.Groups.name}'s parent is highlighted in <strong style={{ color: 'orange' }}>orange</strong>.<br />
          Newly added groups will be highlighted in <strong style={{ color: 'green' }}>green</strong> until you save changes.<br /><br />
        </Typography>
      </Box>

      <Paper component={Box} elevation={0} overflow='auto' square
        style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
      >
        <Box display='flex' flexDirection='column'
          key={`groupsManagedBox`}
          justifyContent='flex-start'
          alignItems='flex-start'
        >
          {Object.keys(reactData.groupsManagedObject).map((listEntry, listIndex) => (
            <React.Fragment key={`frag_${listIndex}`}>
              {(((reactData.groupsManagedObject[listEntry].level - reactData.minimumGroupLevel) < 3) ||
                !(reactData.levelHidden?.[listIndex] ?? false)) &&
                <Box
                  display='flex' flexDirection='column'
                  justifyContent='center'
                  alignItems='flex-start'
                  style={{
                    marginLeft: (reactData.groupsManagedObject[listEntry].level ? ((reactData.groupsManagedObject[listEntry].level - reactData.minimumGroupLevel) - 1) * 1.5 : 0) + 'rem',
                    marginTop: 0.5, marginBottom: 0.5,
                  }}
                  key={`group-list_${listIndex}`}
                >
                  <Box display='flex' flexDirection='row' alignItems='center'>
                    <Typography
                      key={`g_text_${listIndex}`}
                      onClick={async () => {
                        if (tempBelongsTo !== null) {
                          return;
                        }
                        setConfirmParentTarget(listEntry);
                      }}
                      style={AVATextStyle({
                        size: 1.2,
                        margin: { top: 0.2 },
                        ...(currentValues.Groups.belongs_to === listEntry
                          ? { color: 'orange', bold: true }
                          : (currentValues.Groups.group_id === listEntry
                            ? { color: 'blue', bold: true }
                            : (((reactData.groupsToAdd || []).some((groupObj) => (groupObj.group_id === listEntry)))
                              ? { color: 'green', bold: true }
                              : {}
                            )
                          )
                        ),
                      })}
                    >
                      {reactData.groupsManagedObject[listEntry].group_name}
                    </Typography>
                    {((listEntry === currentValues.Groups.group_id)
                      || (reactData.pendingAddIconGroups || []).includes(listEntry)
                      || ((reactData.groupsToAdd || []).some((groupObj) => (groupObj.group_id === listEntry))))
                      && (tempBelongsTo !== listEntry) &&
                      <AddCircleOutlineIcon
                        style={{ fontSize: '1rem', marginLeft: '0.4rem', marginTop: '0.25rem', cursor: 'pointer' }}
                        onClick={(e) => {
                          if (tempBelongsTo !== null) {
                            return;
                          }
                          e.stopPropagation();
                          setTempBelongsTo(listEntry);
                        }}
                      />
                    }
                  </Box>
                  {tempBelongsTo === listEntry &&
                    <Box
                      display='flex' flexDirection='row'
                      justifyContent='flex-start'
                      alignItems='center'
                      style={{
                        marginLeft: '1.5rem',
                        marginTop: 0.5, marginBottom: 0.5,
                      }}
                      key={`group-list_${listIndex}`}
                    >
                      <TextField
                        key={`g_input_${listIndex}`}
                        defaultValue={""}
                        onChange={(e) => {
                          setTempName(e.target.value);
                        }}
                        style={AVATextStyle({ size: 1.0, margin: { top: -0.2, bottom: 0 } })}
                      />
                      <SaveIcon
                        style={{ fontSize: '0.9rem', marginLeft: '0.5rem', cursor: 'pointer' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          // We will save the new name for the current group, but only if the tempName is not empty and is different from the current name.  If those conditions are not met, we will not make the update and instead just return.
                          if (tempName && tempName.trim() !== '') {
                            let timestamp = new Date().getTime();
                            const new_GroupID = `${tempName.toLowerCase().replace(/\s/g, '_')}_${timestamp}`;  // create a new group_id by taking the tempName, converting to lowercase, and replacing spaces with underscores
                            const newAdminSet = new Set(reactData.groupsManagedObject[listEntry].admin_list || []);
                            newAdminSet.add(reactData.user_id);  // add the current user to the admin list for the new group, since they are creating the new group and should have admin permissions for it 
                            newAdminSet.add(reactData.person_id);  // also add the current person to the admin list for the new group, since they are creating the new group and should have admin permissions for it
                            const newGroupObject = {
                              group_id: new_GroupID,
                              "name": tempName,
                              group_name: tempName,
                              client_id: reactData.client_id,
                              belongs_to: listEntry,
                              group_type: 'admin',
                              admin_list: Array.from(newAdminSet),
                              level: reactData.groupsManagedObject[listEntry].level + 1,
                            };
                            reactData.groupsToAdd.push(newGroupObject);  // we need to add a new entry to the groupsToAdd array for the new group we are creating, which will be added to the database when the user clicks "Save Changes".  We can just push an empty object here because the group_id and name will be the same as the current group, which is being updated rather than a new group being created.  The important thing is that we are adding an entry to the groupsToAdd array so that the backend knows to update the group hierarchy for this group when we save changes.
                            const pendingAddIconGroups = [
                              ...(reactData.pendingAddIconGroups || []),
                              new_GroupID
                            ].filter((groupID, idx, arr) => arr.indexOf(groupID) === idx);
                            // Now, insert this group into the groupsManagedObject in the correct location based on its level number, which is one level below the current group.  To do this, we can loop through the groupsManagedObject and find the correct location to insert the new group based on its level number.  We want to insert it after the last group that has a level number less than or equal to the new group's level number.
                            // now, we need to full replace the groupsManagedObject with a new object that has the same items but in the new order and with the updated level numbers for the source hierarchy.
                            let newGroupManagedObject = {};
                            for (let i = 0; i <= listIndex; i++) {
                              let this_groupID = Object.keys(reactData.groupsManagedObject)[i];
                              newGroupManagedObject[this_groupID] = reactData.groupsManagedObject[this_groupID];
                            }
                            newGroupManagedObject[new_GroupID] = newGroupObject;
                            for (let i = listIndex + 1; i < Object.keys(reactData.groupsManagedObject).length; i++) {
                              let this_groupID = Object.keys(reactData.groupsManagedObject)[i];
                              newGroupManagedObject[this_groupID] = reactData.groupsManagedObject[this_groupID];
                            }
                            setTempBelongsTo(null);
                            setTempName("");
                            await updateField({
                              reactUpd: {
                                groupsManagedObject: newGroupManagedObject,
                                groupsToAdd: reactData.groupsToAdd,
                                pendingAddIconGroups,
                              }
                            });
                          }
                        }}
                      />
                      <HighlightOffIcon
                        style={{ fontSize: '0.9rem', marginLeft: '0.4rem', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempBelongsTo(null);
                          setTempName("");
                        }}
                      />
                    </Box>
                  }
                </Box>
              }
            </React.Fragment>
          ))}
        </Box>
      </Paper >

      {(confirmParentTarget !== null) &&
        <AVAConfirm
          promptText={[
            'Are you sure?',
            `Set ${currentValues.Groups.name}'s parent to ${(reactData.groupsManagedObject?.[confirmParentTarget]?.group_name || 'this group')}?`
          ]}
          cancelText={'Cancel'}
          confirmText={'Proceed'}
          onCancel={() => {
            setConfirmParentTarget(null);
          }}
          onConfirm={async () => {
            const targetGroupID = confirmParentTarget;
            setConfirmParentTarget(null);
            await reassignParentGroup(targetGroupID);
          }}
        />
      }

    </Box >
  );
};
