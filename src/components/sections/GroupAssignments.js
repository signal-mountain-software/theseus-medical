import React from 'react';
import useSession from '../../hooks/useSession';

import { deepCopy, isMobile } from '../../util/AVAUtilities';
import { addMember, removeMember } from '../../util/AVAGroups';

import { Typography, Checkbox, Box } from '@material-ui/core';
import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, updateField, reactData, updateReactData }) => {

  const { state } = useSession();

  const isMounted = React.useRef(false);

  const updateGroupList = async (clicked_group) => {
    const reactUpdObj = null;
    const personId = currentValues.peopleRec.person_id;
    const clientId = currentValues.peopleRec.client_id || state.session.client_id;
    const groupId = clicked_group.id || clicked_group.group_id;
    const currentGroupList = Array.isArray(currentValues.peopleRec.groups)
      ? [...currentValues.peopleRec.groups]
      : [];
    let nextGroupList = [...currentGroupList];
    const isInactiveGroup = reactData.inactive_groups.includes(groupId);
    const isMember = currentGroupList.includes(groupId);

    if (isInactiveGroup) {
      if (!isMember) {
        // Remember the prior state so a second click can restore it.
        updateReactData({ remembered_groupList: deepCopy(currentGroupList) }, true);
        await removeMember(personId, clientId, currentGroupList.filter(g => g !== groupId));
        nextGroupList = await addMember(personId, clientId, groupId, { allowParent: true });
        currentValues.peopleRec.inactive_account = true;
      }
      else {
        if (reactData.remembered_groupList) {
          const remembered = deepCopy(reactData.remembered_groupList);
          const groupsToRemove = currentGroupList.filter(g => !remembered.includes(g));
          const groupsToAdd = remembered.filter(g => !currentGroupList.includes(g));
          if (groupsToRemove.length > 0) {
            await removeMember(personId, clientId, groupsToRemove);
          }
          if (groupsToAdd.length > 0) {
            await addMember(personId, clientId, groupsToAdd, { allowParent: true });
          }
          nextGroupList = remembered;
          updateReactData({ remembered_groupList: null }, true);
        }
        else {
          nextGroupList = await removeMember(personId, clientId, groupId);
        }
        currentValues.peopleRec.inactive_account = false;
      }
    }
    else if (!isMember) {
      nextGroupList = await addMember(personId, clientId, groupId, { allowParent: true });
    }
    else {
      nextGroupList = await removeMember(personId, clientId, groupId);
    }

    currentValues.peopleRec.groups = nextGroupList || currentGroupList;
    currentValues.peopleRec.clients = Object.assign({}, currentValues.peopleRec.clients || {}, {
      groups: currentValues.peopleRec.groups,
      id: currentValues.peopleRec.client_id || clientId,
    });
    await updateField({
      updateList:
        [{
          tableName: 'peopleRec',
          fieldName: 'groups',
          newData: currentValues.peopleRec.groups
        },
        {
          tableName: 'peopleRec',
          fieldName: 'clients.groups',
          newData: currentValues.peopleRec.groups
        },
        {
          tableName: 'peopleRec',
          fieldName: 'clients.id',
          newData: currentValues.peopleRec.client_id
        }],
      reactUpd: reactUpdObj,
      errorObj: {
        errorField: 'groups',
        isError: false
      }
    });
  };

  React.useEffect(() => {
    async function initialize() {
      if (!reactData.groupObj) {
        if (!state.groups) {
          if (isMounted.current) {
            updateReactData({
              alert: {
                severity: 'warning',
                title: 'Still loading Group information',
                message: `AVA is still loading.  Wait just a moment and try again, please.`
              }
            }, true);
          }
        }
        else {
          updateReactData({
            groupObj: deepCopy(state.groups)
          }, true);
        }
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      key={`GroupSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {reactData.groupObj && <React.Fragment>
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { left: 0 },
            padding: { left: 0 }
          })}
        >
          {`Administrative Groups`}
        </Typography>
        <Box display='flex'
          marginLeft='0px'
          marginTop='8px'
          flexDirection='column' justifyContent='center' alignItems='flex-start'
        >
          {reactData.groupObj.adminHierarchy.map((gObj, ndx) => (
            <Box
              display='flex'
              style={{ height: 40, marginLeft: `${gObj.level * (isMobile() ? 16 : 24) - (gObj.selectable ? 8 : 0)}px` }}
              flexDirection='row' justifyContent='flex-start'
              alignItems='center'
              key={`admin-${ndx}`}
            >
              {gObj.selectable &&
                <Checkbox
                  size="small"
                  onClick={async () => { await updateGroupList(gObj); }}
                  checked={currentValues.peopleRec.groups && currentValues.peopleRec.groups.includes(gObj.id)}
                />
              }
              <Typography style={AVATextStyle({
                margin: { left: 0 },
                padding: { left: 0 },
                bold: (currentValues.peopleRec.groups && currentValues.peopleRec.groups.includes(gObj.id))
              })}
              >
                {gObj.name}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { top: 1, left: 0 },
            padding: { left: 0 }
          })}
        >
          {`Public (optional) Groups`}
        </Typography>
        <Typography style={
          AVATextStyle({
            size: 0.8,
            margin: { top: 0.5, left: 0 },
            padding: { left: 0 }
          })}
        >
          {(Object.keys(reactData.groupObj.publicGroups).length > 0)
            ? `Choose any from this list you're interested in`
            : `No Public Groups are available at this time`
          }
        </Typography>
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          {Object.keys(reactData.groupObj.publicGroups).map((gID, ndx) => (
            <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
              alignItems='center' flexWrap='wrap' key={`public-${ndx}`}
            >
              <Checkbox
                size="small"
                onClick={async () => { await updateGroupList(reactData.groupObj.publicGroups[gID]); }}
                checked={currentValues.peopleRec.groups.includes(gID)}
              />
              <Typography style={
                AVATextStyle({
                  margin: { left: 0.5 },
                  padding: { left: 0 },
                  bold: reactData.groupObj.publicGroups[gID].role.startsWith('resp')
                })
              }>
                {reactData.groupObj.publicGroups[gID].group_name}
              </Typography>
            </Box>
          ))}
        </Box>
      </React.Fragment>}
    </Box>
  );
};