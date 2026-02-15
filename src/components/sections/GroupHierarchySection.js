import React from 'react';

import { Box, Typography, Paper } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';

import ExpandMoreIcon from '@material-ui/icons/Visibility';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  React.useEffect(() => {

    async function initialize() {
      // 
    }

    initialize();
    return () => {
      // clean up function
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function rebuildGroupsManagedObject(source, target) {

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
      let afterTarget = beforeSourceHierarchy.slice(targetAt +1);
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

  function hasChildren(this_index) {
    try {
      return (reactData.groupsManagedObject[reactData.groupsManagedObject[this_index + 1]].level > reactData.groupsManagedObject[reactData.groupsManagedObject[this_index]].level);
    }
    catch {
      return false;
    }
  }

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='flex-start'
        justifyContent='flex-start' flexDirection='row'>
        <Typography
          style={AVATextStyle({ margin: { top: 0, right: 0.5 } })}
        >
          <div>
            <p style={{ fontSize: '1.3em' }}><strong>This screen sets permissions for access to the {currentValues.Groups.name} group</strong>.</p>
            <p>Use the orange check boxes to grant or deny permission to members of specific groups.<br /><br />
              Administrators will always have access to all groups<br /><br />
              If a group's name appears <strong style={{ color: 'orange' }}>this way</strong>, the owner of that group has granted access to members of the {currentValues.Groups.name} group.</p>
          </div>
          {currentValues.Groups.may_access &&
            <div><p style={{ color: 'red' }}>NOTE: There are aditional permissions granted to members of the {currentValues.Groups.name} group through a special "may_access" code.<br />
              Contact AVA Support to update this setting.</p></div>
          }
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
                  display='flex' flexDirection='row'
                  justifyContent='flex-start'
                  alignItems='center'
                  style={{
                    marginLeft: (reactData.groupsManagedObject[listEntry].level ? ((reactData.groupsManagedObject[listEntry].level - reactData.minimumGroupLevel) - 1) * 1.5 : 0) + 'rem',
                    marginTop: 0.5, marginBottom: 0.5,
                  }}
                  key={`group-list_${listIndex}`}
                >
                  <Typography
                    key={`g_text_${listIndex}`}
                    onClick={async () => {
                      // Tapping the group name will make that group the parent of the current group
                      let newGroupObject = rebuildGroupsManagedObject(currentValues.Groups.group_id, listEntry);
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
                              newData: listEntry,
                              refresh_onExit: true
                            }],
                          reactUpd: {
                            groupsManagedObject: newGroupObject
                          }
                        });
                      }


                    }}
                    style={AVATextStyle({
                      size: 1.2,
                      margin: { top: 0.2 },
                      ...(currentValues.Groups.belongs_to === listEntry
                        ? { color: 'orange', bold: true }
                        : (currentValues.Groups.group_id === listEntry ? { color: 'blue' } : {})),
                    })}
                  >
                    {reactData.groupsManagedObject[listEntry].group_name}
                  </Typography>
                  {(reactData.groupsManagedObject[listEntry].level - reactData.minimumGroupLevel > 1) && hasChildren(listIndex) && (
                    (reactData.levelHidden[listIndex + 1] ?? true) ? (
                      <ExpandMoreIcon
                        style={{ size: 8, fontSize: '1rem', }}
                        onClick={async () => {
                          let keyList = Object.keys(reactData.groupsManagedObject);
                          let kLL = keyList.length;
                          for (let i = listIndex + 1; ((i < kLL) && (reactData.groupsManagedObject[keyList[i]].level > reactData.groupsManagedObject[listEntry].level)); i++) {
                            if (reactData.groupsManagedObject[keyList[i]].level === (reactData.groupsManagedObject[listEntry].level + 1)) {
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
                          let keyList = Object.keys(reactData.groupsManagedObject);
                          let kLL = keyList.length;
                          for (let i = listIndex + 1; ((i < kLL) && (reactData.groupsManagedObject[keyList[i]].level > reactData.groupsManagedObject[listEntry].level)); i++) {
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
      </Paper >

    </Box >
  );
};
