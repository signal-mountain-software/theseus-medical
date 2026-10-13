import React from 'react';
import useSession from '../../hooks/useSession';

import {
  Box, Typography, Checkbox, IconButton, CircularProgress, Button, Tooltip
} from '@material-ui/core/';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import { cl, dbClient } from '../../util/AVAUtilities';
import AddMenuItemDialog from '../dialogs/AddMenuItemDialog';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';

const TOP_MENU_ID = '__top__';

// menu_id prefix for a group's own top-level "private" menu (see PRIVATE_MENU_ID below) -
// created on demand the first time an admin adds a private menu item for a group.
const PRIVATE_MENU_PREFIX = 'private:';

/*
  Evaluates whether a MenuV3 item's `available_to` rule array grants access to EVERY member
  of a group whose own-id-plus-ancestor-ids set is `groupChainSet`.

  Deliberately ignores any rule referencing *admin / *support / person:<id> - those can never
  be guaranteed true for every member of a group, only for specific people/account classes.
  Only *all, *none, and group:<id> rules (climbable - see the comment on groupChainSet below)
  are meaningful for a whole-group "is this on for everybody in the group" check.
*/
function isAuthorizedForGroupChain(available_to, groupChainSet) {
  if (!available_to) { return true; }
  if (available_to.length === 0 || available_to.includes('*none')) { return false; }
  const denied = available_to.some(r => {
    if (!r.startsWith('!')) { return false; }
    const raw = r.slice(1);
    if (raw === '*all') { return true; }
    if (raw.startsWith('group:')) { return groupChainSet.has(raw.slice(6)); }
    return false;
  });
  if (denied) { return false; }
  for (const rule of available_to) {
    if (rule.startsWith('!')) { continue; }
    const parts = rule.includes('&&') ? rule.split('&&').map(p => p.trim()) : [rule.trim()];
    const allMet = parts.every(part => {
      const key = part.split(':')[0];
      if (key === '*all') { return true; }
      if (key === 'group') { return groupChainSet.has(part.split(':')[1]); }
      return false;
    });
    if (allMet) { return true; }
  }
  return false;
}

/*
  Computes the new available_to array needed to flip a single group's authorization for one
  MenuV3 item.

  - Checking an item that's off adds `group:<groupId>` (unless removing an existing deny already
    turns it on, e.g. it was blocked by an explicit disallow on this same group).
  - Unchecking an item removes a direct `group:<groupId>` allow rule if one exists; but if the
    item is still authorized afterward (e.g. it's enabled via *all or via an ANCESTOR group's own
    grant), an explicit `!group:<groupId>` disallow rule is added instead, per the app's existing
    disallow convention (see MainMenuV3.js's authorizedToMenuItem) - this is the only way to carve
    out one group from an ancestor's inherited authority.
*/
function computeToggledAvailableTo(available_to, groupId, groupChainSet, desiredChecked) {
  const wasChecked = isAuthorizedForGroupChain(available_to, groupChainSet);
  if (wasChecked === desiredChecked) { return available_to || null; }

  let rules = Array.isArray(available_to) ? [...available_to] : null;

  if (rules === null) {
    // No available_to property at all == unrestricted for everyone. Only reachable when
    // desiredChecked is false - convert to an equivalent explicit grant + this group's disallow,
    // so everyone else keeps access exactly as before.
    return ['*all', `!group:${groupId}`];
  }

  if (desiredChecked) {
    rules = rules.filter(r => {
      if (!r.startsWith('!group:')) { return true; }
      return !groupChainSet.has(r.slice(7));
    });
    if (!isAuthorizedForGroupChain(rules, groupChainSet)) {
      rules.push(`group:${groupId}`);
    }
  }
  else {
    rules = rules.filter(r => r !== `group:${groupId}`);
    if (isAuthorizedForGroupChain(rules, groupChainSet)) {
      rules.push(`!group:${groupId}`);
    }
  }
  return [...new Set(rules)];
}

export default ({ currentValues }) => {
  const { state } = useSession();
  const AVAClass = AVAclasses();

  const client_id = currentValues?.Groups?.client_id;
  const group_id = currentValues?.Groups?.group_id;
  const group_name = currentValues?.Groups?.name;
  const PRIVATE_MENU_ID = group_id ? `${PRIVATE_MENU_PREFIX}${group_id}` : null;

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [menuItemsById, setMenuItemsById] = React.useState({});
  const [expandedIds, setExpandedIds] = React.useState(() => new Set([TOP_MENU_ID]));
  const [savingIds, setSavingIds] = React.useState(() => new Set());
  const [ensuringPrivateMenu, setEnsuringPrivateMenu] = React.useState(false);
  const [showAddDialog, setShowAddDialog] = React.useState(false);

  // Target group id + every ancestor up the belongs_to chain (mirrors GroupControl.js's
  // myParent). This matches the ancestor-chain semantics AVAGroups.js's addMember uses when
  // writing PeopleGroups/People.groups (a member of a group also "carries" every ancestor group
  // id) - which is exactly what makes a parent-group's available_to grant cascade down to its
  // descendants' members, and why "disallow" is needed to carve out one descendant group.
  const groupChainSet = React.useMemo(() => {
    const chain = new Set();
    if (!group_id) { return chain; }
    const adminHierarchy = state.groups?.adminHierarchy || [];
    const myParent = (this_group) => {
      const groupInfo = adminHierarchy.find(g => g.id === this_group);
      if (groupInfo && groupInfo.belongs_to && !groupInfo.belongs_to.toLowerCase().includes('_top_')) {
        return groupInfo.belongs_to;
      }
      return false;
    };
    let current = group_id;
    while (current && !chain.has(current)) {
      chain.add(current);
      current = myParent(current);
    }
    return chain;
  }, [group_id, state.groups]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      if (!client_id) { return; }
      setLoading(true);
      setLoadError(null);
      const result = await dbClient.query({
        TableName: 'MenuV3',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': client_id }
      }).promise().catch(error => {
        cl({ 'GroupMenuOptionsSection: failed to load MenuV3 items': error });
        return null;
      });
      if (cancelled) { return; }
      if (!result) {
        setLoadError('Unable to load the menu structure.');
        setLoading(false);
        return;
      }
      const byId = {};
      (result.Items || []).forEach(item => { byId[item.menu_id] = item; });
      setMenuItemsById(byId);
      setLoading(false);
    }
    loadMenu();
    return () => { cancelled = true; };
  }, [client_id]);

  const toggleExpanded = (menu_id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(menu_id)) { next.delete(menu_id); }
      else { next.add(menu_id); }
      return next;
    });
  };

  // Creates this group's private top-level menu (menu_id = "private:<group_id>") on first use -
  // available ONLY to members of this group (available_to: ['group:<group_id>']) and editable
  // only by whoever creates it plus admins (allow_add). Linked into __top__'s children so
  // MainMenuV3's normal traversal/authorization handles it with no special-casing at runtime.
  const ensurePrivateMenuExists = async () => {
    if (menuItemsById[PRIVATE_MENU_ID]) { return true; }
    setEnsuringPrivateMenu(true);
    const newPrivateMenuRec = {
      client_id,
      menu_id: PRIVATE_MENU_ID,
      description: { short: `${group_name || 'Group'} Options`, long: `${group_name || 'Group'} Options` },
      menu_itemType: 'menu',
      available_to: [`group:${group_id}`],
      allow_add: [`person:${state.session.user_id}`, '*admin'],
      children: []
    };
    const putOk = await dbClient.put({ TableName: 'MenuV3', Item: newPrivateMenuRec }).promise()
      .then(() => true)
      .catch(error => { cl({ 'GroupMenuOptionsSection: failed to create private menu': error }); return false; });
    if (!putOk) { setEnsuringPrivateMenu(false); return false; }

    const topRec = menuItemsById[TOP_MENU_ID];
    const updatedTopChildren = [...new Set([PRIVATE_MENU_ID, ...(topRec?.children || [])])];
    await dbClient.update({
      TableName: 'MenuV3',
      Key: { client_id, menu_id: TOP_MENU_ID },
      UpdateExpression: 'set #c = :c',
      ExpressionAttributeNames: { '#c': 'children' },
      ExpressionAttributeValues: { ':c': updatedTopChildren }
    }).promise().catch(error => { cl({ 'GroupMenuOptionsSection: failed to link private menu under top menu': error }); });

    setMenuItemsById(prev => ({
      ...prev,
      [PRIVATE_MENU_ID]: newPrivateMenuRec,
      [TOP_MENU_ID]: { ...prev[TOP_MENU_ID], children: updatedTopChildren }
    }));
    setEnsuringPrivateMenu(false);
    return true;
  };

  const handleCreatePrivateMenuItem = async () => {
    if (ensuringPrivateMenu || showAddDialog) { return; }
    const ok = await ensurePrivateMenuExists();
    if (!ok) { return; }
    setExpandedIds(prev => new Set(prev).add(TOP_MENU_ID));
    setShowAddDialog(true);
  };

  const handleToggleAuthorization = async (menu_id, desiredChecked) => {
    const item = menuItemsById[menu_id];
    if (!item || savingIds.has(menu_id) || !group_id) { return; }
    const newAvailableTo = computeToggledAvailableTo(item.available_to, group_id, groupChainSet, desiredChecked);
    if (newAvailableTo === (item.available_to || null)) { return; }

    setSavingIds(prev => new Set(prev).add(menu_id));
    const updated = await dbClient.update({
      TableName: 'MenuV3',
      Key: { client_id, menu_id },
      UpdateExpression: 'set available_to = :a',
      ExpressionAttributeValues: { ':a': newAvailableTo }
    }).promise().catch(error => {
      cl({ 'GroupMenuOptionsSection: failed to update available_to': error, menu_id });
      return null;
    });
    setSavingIds(prev => {
      const next = new Set(prev);
      next.delete(menu_id);
      return next;
    });
    if (!updated) { return; }
    setMenuItemsById(prev => ({
      ...prev,
      [menu_id]: { ...prev[menu_id], available_to: newAvailableTo }
    }));
  };

  const renderRow = (menu_id, depth, pathIds) => {
    const item = menuItemsById[menu_id];
    if (!item || pathIds.has(menu_id)) { return null; }
    const nextPathIds = new Set(pathIds);
    nextPathIds.add(menu_id);

    const isMenu = item.menu_itemType === 'menu';
    const hasChildren = isMenu && Array.isArray(item.children) && item.children.length > 0;
    const isExpanded = expandedIds.has(menu_id);
    const checked = isAuthorizedForGroupChain(item.available_to, groupChainSet);
    const isSaving = savingIds.has(menu_id);
    const label = item.description?.short || menu_id;

    return (
      <Box key={`menuopt_${menu_id}_${depth}`}>
        <Box display='flex' alignItems='center' style={{ paddingLeft: (depth * 24) + 'px' }}>
          <IconButton
            size='small'
            disabled={!hasChildren}
            onClick={() => hasChildren && toggleExpanded(menu_id)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {isExpanded ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
          </IconButton>
          {isSaving
            ? <Box style={{ width: 42, display: 'flex', justifyContent: 'center' }}><CircularProgress size={18} /></Box>
            : (
              <Checkbox
                checked={checked}
                onChange={(e) => handleToggleAuthorization(menu_id, e.target.checked)}
              />
            )}
          <Typography style={{ ...AVATextStyle({ size: 0.95 }), opacity: item.hidden ? 0.6 : 1 }}>
            {label}{item.hidden ? ' (hidden)' : ''}
          </Typography>
        </Box>
        {hasChildren && isExpanded && (
          <Box>
            {item.children.map(childId => renderRow(childId, depth + 1, nextPathIds))}
          </Box>
        )}
      </Box>
    );
  };

  if (!group_id || !client_id) {
    return <Typography style={AVATextStyle({ size: 0.9 })}>{'No group selected.'}</Typography>;
  }

  if (loading) {
    return <Box display='flex' justifyContent='center' py={4}><CircularProgress /></Box>;
  }

  if (loadError) {
    return <Typography color='error' style={AVATextStyle({ size: 0.9 })}>{loadError}</Typography>;
  }

  const topItem = menuItemsById[TOP_MENU_ID];
  // Ignore every OTHER group's private menu - only this group's own private menu (if it
  // already exists) is shown alongside the regular tree.
  const topChildren = (topItem?.children || []).filter(id => !id.startsWith(PRIVATE_MENU_PREFIX) || id === PRIVATE_MENU_ID);

  return (
    <Box key='groupMenuOptionsSection_masterBox' flexGrow={2} px={2} py={4} display='flex' flexDirection='column'>
      <Typography style={AVATextStyle({ bold: true, size: 1.2, margin: { bottom: 0.5 } })}>
        {'Menu Options'}
      </Typography>
      <Typography style={AVATextStyle({ size: 0.9 })}>
        {'Check a menu item to grant it to every member of this group. Unchecking an item that\u2019s enabled through a parent group adds a specific block for this group only, without affecting the parent group\u2019s own access.  Changes made here will be saved immediately and automatically.'}
      </Typography>
      <Box display='flex' justifyContent='flex-end' mt={1} mb={1}>
        <Tooltip title='Create a private menu item (available only to members of this group).'>
          <span>
            <Button
              className={AVAClass.AVAButton}
              size='small'
              variant='contained'
              color='primary'
              startIcon={ensuringPrivateMenu ? <CircularProgress size={14} color='inherit' /> : <AddCircleOutlineIcon />}
              onClick={handleCreatePrivateMenuItem}
              disabled={ensuringPrivateMenu || showAddDialog}
            >
              {'Add Private Menu Item'}
            </Button>
          </span>
        </Tooltip>
      </Box>
      {topChildren.length === 0
        ? <Typography style={AVATextStyle({ size: 0.9 })}>{'No menu items found.'}</Typography>
        : topChildren.map(childId => renderRow(childId, 0, new Set([TOP_MENU_ID])))}
      {showAddDialog &&
        <AddMenuItemDialog
          open={showAddDialog}
          client_id={client_id}
          parentMenuId={PRIVATE_MENU_ID}
          onClose={(result) => {
            setShowAddDialog(false);
            if (!result?.success) { return; }
            setMenuItemsById(prev => {
              const next = { ...prev };
              (result.createdItems || []).forEach(({ menu_id, menuItemRec }) => { next[menu_id] = menuItemRec; });
              const parent = next[result.parentMenuId];
              if (parent) {
                const newIds = (result.createdItems || []).map(c => c.menu_id);
                next[result.parentMenuId] = { ...parent, children: [...new Set([...newIds, ...(parent.children || [])])] };
              }
              return next;
            });
            setExpandedIds(prev => new Set(prev).add(PRIVATE_MENU_ID));
          }}
        />
      }
    </Box>
  );
};
