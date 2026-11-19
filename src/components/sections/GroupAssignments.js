import React from 'react';
import useSession from '../../hooks/useSession';

import { deepCopy, isMobile } from '../../util/AVAUtilities';
import { addMember, removeMember, expandGroupIdsWithAncestors } from '../../util/AVAGroups';

import { Typography, Checkbox, Box } from '@material-ui/core';
import { AVATextStyle } from '../../util/AVAStyles';
// Same "eyeball" convention GroupControl's hierarchy trees use: Visibility = children are
// hidden, tap to reveal; VisibilityOff = children are showing, tap to hide them again.
import ExpandMoreIcon from '@material-ui/icons/Visibility';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';

// Stands out against the plain-text color used for non-member rows, without being so dark it
// reads as an error/warning color in either light or dark mode.
const MEMBER_HIGHLIGHT_COLOR = '#bd2ca5';

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

  // Which admin-hierarchy group ids currently have their children revealed in the selection
  // list below - mirrors GroupControl's move-group picker scheme: the top 2 levels always
  // show, anything deeper requires every ancestor down the chain to be individually expanded.
  const [expandedGroups, setExpandedGroups] = React.useState(() => new Set());

  const isAdminRowVisible = (gObj, byId, minLevel) => {
    const relLevel = gObj.level - minLevel;
    if (relLevel < 2) { return true; }
    const parent = gObj.belongs_to && byId.get(gObj.belongs_to);
    if (!parent) { return true; }
    return expandedGroups.has(parent.id) && isAdminRowVisible(parent, byId, minLevel);
  };

  return (
    <Box
      key={`GroupSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {reactData.groupObj && <React.Fragment>
        {(() => {
          const adminHierarchy = reactData.groupObj.adminHierarchy;
          const memberIds = new Set(currentValues.peopleRec.groups || []);
          // Everything the person actually belongs to, plus every ancestor of those groups -
          // the ancestors are included even though they're not bolded/highlighted below, purely
          // so a membership deep in the tree still shows its parent chain for context instead
          // of looking like an orphaned top-level entry.
          const referenceIds = expandGroupIdsWithAncestors(
            adminHierarchy.filter(g => memberIds.has(g.id)).map(g => g.id),
            adminHierarchy
          );
          const referenceRows = adminHierarchy.filter(g => referenceIds.has(g.id));

          return (
            <React.Fragment>
              <Typography style={
                AVATextStyle({
                  size: 1.2,
                  margin: { left: 0 },
                  padding: { left: 0 }
                })}
              >
                {`Current Groups`}
              </Typography>
              <Box display='flex'
                marginLeft='0px'
                marginTop='8px'
                flexDirection='column' justifyContent='center' alignItems='flex-start'
              >
                {(referenceRows.length === 0)
                  ? <Typography style={AVATextStyle({ size: 0.9, color: 'gray' })}>
                    {'Not currently a member of any administrative group.'}
                  </Typography>
                  : referenceRows.map((gObj, ndx) => {
                    const isMember = memberIds.has(gObj.id);
                    return (
                      <Box
                        display='flex'
                        style={{ height: 32, marginLeft: `${gObj.level * (isMobile() ? 16 : 24)}px` }}
                        flexDirection='row' justifyContent='flex-start'
                        alignItems='center'
                        key={`reference-${ndx}`}
                      >
                        <Typography style={AVATextStyle({
                          margin: { left: 0 },
                          padding: { left: 0 },
                          bold: isMember,
                          color: isMember ? MEMBER_HIGHLIGHT_COLOR : 'gray'
                        })}
                        >
                          {gObj.name}
                        </Typography>
                      </Box>
                    );
                  })
                }
              </Box>
            </React.Fragment>
          );
        })()}
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { top: 2, left: 0 },
            padding: { left: 0 }
          })}
        >
          {`Update Group Memberships below`}
        </Typography>
        <Box display='flex'
          marginLeft='0px'
          marginTop='8px'
          flexDirection='column' justifyContent='center' alignItems='flex-start'
        >
          {(() => {
            const adminHierarchy = reactData.groupObj.adminHierarchy;
            const byId = new Map(adminHierarchy.map(g => [g.id, g]));
            const minLevel = adminHierarchy.length ? Math.min(...adminHierarchy.map(g => g.level)) : 0;
            return adminHierarchy
              .filter(gObj => isAdminRowVisible(gObj, byId, minLevel))
              .map((gObj, ndx) => {
                const isMember = currentValues.peopleRec.groups && currentValues.peopleRec.groups.includes(gObj.id);
                // A row's own children are only gated by expandedGroups once they'd fall past
                // the always-visible top 2 levels - at the top (minLevel) level, its immediate
                // children sit at relLevel 1, which is always shown regardless of expand state,
                // so the icon would toggle nothing and is hidden rather than shown as dead UI.
                const hasCollapsibleChildren = !gObj.selectable && (gObj.level > minLevel);
                const isExpanded = expandedGroups.has(gObj.id);
                return (
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
                        checked={isMember}
                      />
                    }
                    <Typography style={AVATextStyle({
                      margin: { left: 0 },
                      padding: { left: 0 },
                      bold: isMember,
                      color: isMember ? MEMBER_HIGHLIGHT_COLOR : null
                    })}
                    >
                      {gObj.name}
                    </Typography>
                    {hasCollapsibleChildren && (
                      isExpanded ? (
                        <ExpandLessIcon
                          style={{ fontSize: '1.1rem', marginLeft: '0.4rem', cursor: 'pointer' }}
                          onClick={() => {
                            setExpandedGroups(prev => {
                              const next = new Set(prev);
                              next.delete(gObj.id);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <ExpandMoreIcon
                          style={{ fontSize: '1.1rem', marginLeft: '0.4rem', cursor: 'pointer' }}
                          onClick={() => {
                            setExpandedGroups(prev => new Set(prev).add(gObj.id));
                          }}
                        />
                      )
                    )}
                  </Box>
                );
              });
          })()}
        </Box>
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { top: 2, left: 0 },
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