import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Typography, Paper, Checkbox } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import AVAUploadFile from '../../util/AVAUploadFile';
import { getGroupAccess } from '../../util/AVAGroups';

import ExpandMoreIcon from '@material-ui/icons/Visibility';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const { state } = useSession();


  const propList = [{
    prop_title: 'UI style',
    fieldName: 'ui_tiles',
    on_value: true,
    off_value: false,
    off_text: 'Menu',
    on_text: 'Tiles'
  },
  {
    prop_title: 'Messaging Version',
    fieldName: 'allow_old_messaging',
    on_value: true,
    off_value: false,
    off_text: 'New Required',
    on_text: 'Legacy Allowed'
  },
  {
    prop_title: 'When User doesn\'t specify a choice, prefer which messaging method?',
    fieldName: 'preferred_communication',
    on_value: 'text',
    off_value: 'email',
    off_text: 'e-Mail Preferred',
    on_text: 'Text Messages Preferred'
  },
  {
    prop_title: 'Mandatory Passwords',
    fieldName: 'mandatory_passwords',
    on_value: true,
    off_value: false,
    off_text: 'Passwords Optional',
    on_text: 'Password Mandatory'
  },
  {
    prop_title: 'Show Forms section in Profile',
    fieldName: 'suppress_forms_in_profile',
    on_value: true,
    off_value: false,
    off_text: 'Show',
    on_text: 'Hide'
  }];

  for (let this_prop of propList) {
    if (currentValues.Groups?.group_style?.hasOwnProperty(this_prop.fieldName)) {
      this_prop.current_value = currentValues.Groups.group_style[this_prop.fieldName] === this_prop.on_value;
    }
    else if (state.session.client_style?.hasOwnProperty(this_prop.fieldName)) {
      this_prop.current_value = state.session.client_style?.[this_prop.fieldName] === this_prop.on_value;
    }
    else {
      this_prop.current_value = this_prop.off_value;
    }
  }

  React.useEffect(() => {

    async function initialize() {
      // This is going to deliver a list of all groups that a generic member of this group has permission to
      const [groups_person_belongsTo, rejectObject, classList] =
        await getGroupAccess(
          reactData.client_id,
          'fake_bad_person_id',
          {
            personRec: {
              person_id: 'fake_bad_person_id',
              groups: [currentValues.Groups.group_id]
            }
          });
      console.log(groups_person_belongsTo, rejectObject, classList);

      // this will determine what groups this group has granted access to
      let may_access = new Set();
      // if there are groups you belongs to that you ALSO have authority to, go ahead and mark may_access
      for (let group_id in groups_person_belongsTo) {
        if (groups_person_belongsTo[group_id].is_accessible) {
          may_access.add(group_id);
        }
      }
      for (let this_access_rule of (currentValues.Groups.accessible_to || [])) {
        switch (this_access_rule.split(':')[0].trim()) {
          case '*support': { may_access.add('*support'); break; }
          case '*self': { may_access.add(currentValues.Groups.group_id); break; }
          case 'person': { may_access.add(`person:${this_access_rule.split(':')[1].trim()}`); break; }
          case 'group': { may_access.add(this_access_rule.split(':')[1].trim()); break; }
          default: { }
        }
      }

      // third pass finds children and grandchildren of groups I belong to and marks me as belonging to them as well; this will allow the fourth pass to recognize that I have access to those descendant groups by virtue of my membership in the parent group
      for (const good_group of may_access) {
        let findChildren = (parent_id) => {
          state.groups.adminHierarchy.forEach(g => {
            if (g.belongs_to === parent_id) {
              may_access.add(g.id);
              findChildren(g.id);
            }
          });
        };
        findChildren(good_group);
      }
      updateReactData({
        accessObj: Object.assign({}, groups_person_belongsTo, rejectObject),
        may_access: Array.from(may_access)
      }, true);
    }

    initialize();
    return () => {
      // clean up function
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps


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
          style={AVATextStyle({ margin: { top: 1, right: 0.5 } })}
        >
          <div>
            <p>Use the orange boxes to grant or deny permissions for others to access this group<br /><br />
              Administrators will always have access to all groups<br /><br />
              Groups in <strong>bold</strong> indicate that the group has granted access to members of {state.session.client_name}</p>
          </div>
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
                  <Checkbox                   
                    checked={reactData.may_access
                      ? reactData.may_access.includes(reactData.groupsManagedObject[listEntry].group_id)
                      : false
                    }
                    name={`cbox1_${listIndex}`}
                    style={{color: 'orange'}}
                    disableRipple
                    onChange={async () => {
                      const this_group = reactData.groupsManagedObject[listEntry].group_id;
                      const current_checkState = reactData.may_access
                        ? reactData.may_access.includes(this_group)
                        : false;
                      // find every group that is a child/grandchild/etc of thie group
                      let my_family = new Set([]);
                      const findChildren = (parent_id) => {
                        state.groups.adminHierarchy.forEach(g => {
                          if (g.belongs_to === parent_id) {
                            my_family.add(g.id);
                            findChildren(g.id);
                          }
                        });
                      };
                      findChildren(this_group);
                      let newAccessList = new Set(currentValues.Groups?.accessible_to || []);
                      let newMayAccess = new Set(reactData.may_access || []);
                      if (!current_checkState) {
                        // add this group and all its children to the access list
                        newAccessList.add(`group:${this_group}`);
                        newMayAccess.add(this_group);
                        my_family.forEach(g => {
                          newAccessList.add(`group:${g}`);
                          newMayAccess.add(g);
                        });
                      }
                      else {
                        // remove this group and all its children from the access list
                        newAccessList.delete(`group:${this_group}`);
                        newMayAccess.delete(this_group);
                        my_family.forEach(g => {
                          newAccessList.delete(`group:${g}`);
                          newMayAccess.delete(g);
                        });
                      }
                      await updateField({
                        updateList:
                          [{
                            tableName: 'Groups',
                            fieldName: 'accessible_to',
                            newData: Array.from(newAccessList)
                          }],
                        reactUpd: {
                          may_access: Array.from(newMayAccess)
                        }
                      });

                      console.log('tapped checkbox for group ', reactData.groupsManagedObject[listEntry].group_name);
                    }}
                  />
                  <Typography
                    key={`g_text_${listIndex}`}
                    onClick={async () => {
                    }}
                    style={AVATextStyle({
                      size: 1.2,
                      margin: { top: 0.2 },
                      color: reactData.accessObj?.[reactData.groupsManagedObject[listEntry].group_id]?.is_accessible ? 'orange' : null,
                      bold: reactData.accessObj?.[reactData.groupsManagedObject[listEntry].group_id]?.is_accessible ?? false,
                    })}>
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
      </Paper>

      {
        reactData.getLogo &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: ['Logo', 'Tap "Choose a File" to select a new image'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              getLogo: false
            }, true);
          }}
          onLoad={async (response) => {
            await updateField({
              updateList:
                [{
                  tableName: 'Groups',
                  fieldName: 'logo',
                  newData: response[0].fLoc
                }],
              reactUpd: {
                getLogo: false
              }
            });
          }}
        />
      }
    </Box >
  );
};
