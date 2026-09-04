import React from 'react';

import useSession from '../../hooks/useSession';

import { deepCopy, isMobile, titleCase, listFromArray, isEmpty } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { Box, Button, Chip, TextField, Tooltip, Typography, Dialog, Paper, DialogContentText, DialogActions, Switch } from '@material-ui/core/';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import GroupIcon from '@material-ui/icons/Group';
import PersonIcon from '@material-ui/icons/Person';
import StarIcon from '@material-ui/icons/Star';

const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    padding: '16px',
    maxHeight: '90vh',
  }
}));

/**
 * QuickSearch Component Options Documentation
 * 
 * @param {Object} options - Configuration object for QuickSearch behavior
 * @param {string} [options.title] - Custom title for the search dialog (default: "Quick Search")
 * @param {boolean} [options.withGroups] - Include group selection functionality in the search
 * @param {boolean} [options.restrictGroups] - When true, restricts group visibility to only groups the user is a member of at the lowest level in hierarchy
 * @param {boolean} [options.keepSelections] - Preserve existing selections when initializing the component
 * @param {boolean} [options.showAll] - Display all items without requiring search input (when false, requires 2+ characters to show results)
 * @param {boolean} [options.withSpecialValues] - Include special value entries in the people list
 * @param {boolean} [options.withPreferred] - Display preferred recipients section
 * @param {boolean} [options.hidePeople] - Hide the people section (can be used with groups-only mode)
 * @param {boolean} [options.pickAndGo] - Allow immediate selection/deselection without closing dialog
 * @param {boolean} [options.pickOne] - Close dialog immediately after selecting one item
 * @param {boolean} [options.showGroupList] - When combined with withGroups=true, automatically show the group list on initialization
 * @param {string} [options.buttonColor] - Custom color for the exit button (default: red when no selections, green when selections exist)
 * @param {string|Object} [options.buttonText] - Custom text for the exit button (default: "Select"). Can be a string or an object with 'empty' and 'selected' keys for conditional text based on selections
 * @param {Object} [options.secondaryAction] - Optional extra button shown between Cancel and the main action: { text, onClick }
 * 
 * Behavior Notes:
 * - restrictGroups: Prevents seeing parent/sibling groups, only shows groups where user is a member at lowest hierarchy level
 * - showAll: Controls whether items are visible without search input; when false, requires 2+ character search
 * - pickAndGo vs pickOne: pickAndGo allows multiple selections with immediate feedback, pickOne closes after first selection
 * - withSpecialValues: Adds special system values to the people list for selection
 */


export default ({ reactData, updateReactData, onClose, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isMounted = React.useRef(false);
  const optionsRef = React.useRef(options);
  const searchInputRef = React.useRef(null);
  const administrative_account = (['admin', 'master'].includes(state.user.account_class));

  // Virtual scrolling state
  const [maxPeopleToRender, setMaxPeopleToRender] = React.useState(100);
  // Expand/collapse state for group tree nodes
  const [collapsedGroups, setCollapsedGroups] = React.useState(new Set());
  // Group highlighted by tapping its chip
  const [highlightedGroupId, setHighlightedGroupId] = React.useState(null);
  // Person highlighted by tapping its chip
  const [highlightedPersonId, setHighlightedPersonId] = React.useState(null);
  // Capture initial selections so cancel can restore them
  const initialSelectionsRef = React.useRef(reactData.selections ? [...reactData.selections] : []);

  // Build full breadcrumb path for a group from the flat groupList
  const getGroupPath = (group_id) => {
    const gl = reactData.groupInfo?.groupList;
    if (!gl) { return group_id; }
    const idx = gl.findIndex(g => g.group_id === group_id);
    if (idx < 0) { return group_id; }
    const path = [gl[idx].group_name];
    let checkLevel = gl[idx].level;
    for (let i = idx - 1; i >= 0 && checkLevel > 0; i--) {
      if (gl[i].level < checkLevel) {
        path.unshift(gl[i].group_name);
        checkLevel = gl[i].level;
      }
    }
    return path.join(' / ');
  };

  // Expand all ancestors of a group, show the groups section, and highlight the row
  const expandToGroup = (group_id) => {
    const gl = reactData.groupInfo?.groupList;
    if (!gl) { return; }
    const idx = gl.findIndex(g => g.group_id === group_id);
    if (idx < 0) { return; }
    const next = new Set(collapsedGroups);
    let checkLevel = gl[idx].level;
    for (let i = idx - 1; i >= 0 && checkLevel > 0; i--) {
      if (gl[i].level < checkLevel) {
        next.delete(gl[i].group_id);
        checkLevel = gl[i].level;
      }
    }
    setCollapsedGroups(next);
    setHighlightedGroupId(group_id);
    if (!reactData.showGroupList) {
      updateReactData({ showGroupList: true }, true);
    }
    // Clear highlight after 2 seconds
    window.setTimeout(() => setHighlightedGroupId(null), 2000);
  };

  // Scroll the people list to show and flash-highlight a person by ID
  const scrollToPerson = (person_id) => {
    setMaxPeopleToRender(prev => Math.max(prev, 500));
    setHighlightedPersonId(person_id);
    window.setTimeout(() => setHighlightedPersonId(null), 2000);
  };

  React.useEffect(() => {
    console.log('EFFECT mounted');
  }, [administrative_account]); // should log exactly once (twice in StrictMode dev)

  React.useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 80);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, []);

  React.useEffect(() => {
    function initialize() {
      console.log('QuickSearch initialize() called with options:', options);
      let reactUpd = {};
      reactUpd.preferred_recipients = [];
      if (state.hasOwnProperty('groups') && state.groups.hasOwnProperty('preferred_recipients')) {
        for (let this_group in state.groups.preferred_recipients) {
          if (state.groups.preferred_recipients[this_group].length > 0) {
            for (const this_pref of state.groups.preferred_recipients[this_group]) {
              reactUpd.preferred_recipients.push({
                objText: titleCase((this_pref.objText.toLowerCase().split('message to')).pop()),
                personList: this_pref.personList,
                personNames: this_pref.personNames
              });
            }
          }
        }
      }
      if (optionsRef.current.withGroups && !reactData.groupInfo) {
        if (state.hasOwnProperty('groups')) {
          let groupList = [];
          let groupList_minLevel = 99;
          loadList('__TOP__', state.groups.groupTree['__TOP__'], 0);
          const adminGroupsEndIdx = groupList.length;

          // Collect public groups separately
          const rawPublicGroups = [];
          if (state.groups.publicGroups) {
            for (const [group_id, groupRec] of Object.entries(state.groups.publicGroups)) {
              if (administrative_account ||
                (
                  state?.accessList?.[state.session?.client_id]?.groups &&
                  state?.accessList?.[state.session?.client_id]?.groups.includes(group_id) &&
                  (!options.restrictGroups || state?.patient?.groups?.includes(group_id))
                )
              ) {
                rawPublicGroups.push({ group_id, group_name: groupRec.group_name });
              }
            }
          }

          // Build final list with section headers.
          // For the hierarchy section:
          //   Case 1 (wide open): exactly one level-0 group exists after normalization — that IS
          //   the "ALL" / client-root group. Use its name as the synthetic header and drop it
          //   from the list; real entries start at level 1.
          //   Case 2 (filtered/restricted): use "My Groups" as header and shift all groups +1.
          const finalGroupList = [];

          if (adminGroupsEndIdx > 0) {
            const normalizedPrivate = groupList.slice(0, adminGroupsEndIdx).map(g => ({
              ...g,
              level: g.level - groupList_minLevel
            }));
            const level0Private = normalizedPrivate.filter(g => g.level === 0);
            if (level0Private.length === 1) {
              // Wide-open: absorb the single root as the section label (not force-collapsed)
              finalGroupList.push({
                group_id: '__admin_groups_header__',
                group_name: level0Private[0].group_name,
                level: 0,
                isSection: true
              });
              normalizedPrivate.filter(g => g.level > 0).forEach(g => finalGroupList.push(g));
            } else {
              // Filtered: generic section label, shift groups under it
              finalGroupList.push({
                group_id: '__admin_groups_header__',
                group_name: 'My Groups',
                level: 0,
                isSection: true
              });
              normalizedPrivate.forEach(g => finalGroupList.push({ ...g, level: g.level + 1 }));
            }
          }

          if (rawPublicGroups.length > 0) {
            finalGroupList.push({
              group_id: '__public_groups_header__',
              group_name: 'Public Groups',
              level: 0,
              isHeader: true
            });
            rawPublicGroups.forEach(g => finalGroupList.push({ ...g, level: 1 }));
          }

          // Collect and append private groups (same structure as publicGroups)
          const rawPrivateGroups = [];
          if (state.groups.privateGroups) {
            for (const [group_id, groupRec] of Object.entries(state.groups.privateGroups)) {
              if (administrative_account ||
                (
                  state?.accessList?.[state.session?.client_id]?.groups &&
                  state?.accessList?.[state.session?.client_id]?.groups.includes(group_id) &&
                  (!options.restrictGroups || state?.patient?.groups?.includes(group_id))
                )
              ) {
                rawPrivateGroups.push({ group_id, group_name: groupRec.group_name });
              }
            }
          }
          if (rawPrivateGroups.length > 0) {
            finalGroupList.push({
              group_id: '__private_groups_header__',
              group_name: 'Private Groups',
              level: 0,
              isHeader: true
            });
            rawPrivateGroups.forEach(g => finalGroupList.push({ ...g, level: 1 }));
          }
          function loadList(this_item, my_children, display_level, hidden_ancestors = [], ancestorAuthorized = false) {
            /* I can "see" a group in this list if:
                - I am an administrative account
                  OR
                - I have "view" or higher rights to the group (or an ancestor has those rights and restrictGroups is OFF)
                      AND
                  either restrictGroups is OFF or (if restrictGroups is ON, I am a member of the group and the group is the lowest level in the hierarchy)
                  Note: restrictGroups prevents you from seeing groups that are parents or siblings of a group you are in.
                  Note: when restrictGroups is OFF, access to a parent automatically grants visibility to all its descendants.
                display_level only increments when this node is visible — so a group whose authorized
                ancestors are all hidden appears at the same indent level as its nearest visible ancestor,
                or at level 0 if none of its ancestors are visible.
                hidden_ancestors accumulates names of skipped (not-authorized) ancestors so they can
                be shown as a breadcrumb prefix: "Group 2 / Group 2a / Group 2a1".
            */
            let childDisplayLevel = display_level;
            let childHiddenAncestors = hidden_ancestors;
            const directAccess = state?.accessList?.[state.session?.client_id]?.groups?.includes(this_item);
            const inheritedAccess = !options.restrictGroups && ancestorAuthorized;
            if (administrative_account ||
              (
                (directAccess || inheritedAccess) &&
                (!options.restrictGroups || (state?.patient?.groups?.includes(this_item) && isEmpty(my_children)))
              )
            ) {
              const ownName = state.groups.groupNames[this_item];
              const displayName = hidden_ancestors.length > 0
                ? [...hidden_ancestors, ownName].join(' / ')
                : ownName;
              groupList.push({
                group_id: this_item,
                group_name: displayName,
                level: display_level
              });
              if (groupList_minLevel > display_level) {
                groupList_minLevel = display_level;
              }
              childDisplayLevel = display_level + 1;
              childHiddenAncestors = [];  // reset — visible children don't need the breadcrumb
            } else if (this_item !== '__TOP__') {
              // This node is hidden — replace ancestors with just this name so only the
              // nearest non-authorized ancestor appears as prefix (e.g. "Group 2a / Group 2a1")
              const ownName = state.groups.groupNames[this_item];
              if (ownName) {
                childHiddenAncestors = [ownName];
              }
            }
            if (isEmpty(my_children)) { return; }
            const childAncestorAuthorized = administrative_account || directAccess || inheritedAccess;
            for (let my_child in my_children) {
              loadList(my_child, my_children[my_child], childDisplayLevel, childHiddenAncestors, childAncestorAuthorized);
            }
          }
          reactUpd.groupInfo = Object.assign({}, deepCopy(state.groups), {
            groupList: finalGroupList
          });

          // Seed collapsed state: collapse all parent nodes at level >= 1 (show top two levels by default).
          // Skip seeding entirely when groupsInitiallyExpanded is set — the state is already an empty
          // Set (nothing collapsed), which is exactly "fully expanded".
          if (!optionsRef.current.groupsInitiallyExpanded) {
            const gl = reactUpd.groupInfo.groupList;
            const initialCollapsed = new Set();
            gl.forEach((g, idx) => {
              const isParent = idx + 1 < gl.length && gl[idx + 1].level > g.level;
              // Collapse headers and level>=1 parents on initial display
              if (g.isHeader || (isParent && g.level >= 1)) {
                initialCollapsed.add(g.group_id);
              }
            });
            if (initialCollapsed.size > 0) {
              setCollapsedGroups(initialCollapsed);
            }
          }

          // Auto-show group list if showGroupList option is true
          if (optionsRef.current.showGroupList || optionsRef.current.restrictGroups) {
            reactUpd.showGroupList = true;
          }

        }
      }
      if (optionsRef.current.restrictGroups && !optionsRef.current.hasOwnProperty('showAll')) {
        optionsRef.current.showAll = false;
      }
      if (!reactData.accessList) {
        if (!state.accessList) {
          if (isMounted.current) {
            onClose(initialSelectionsRef.current);
          }
        }
        else {
          reactUpd.selections = (optionsRef.current.keepSelections ? reactData.selections : []);
          reactUpd.accessList = deepCopy(state.accessList[state.session.client_id].list);
        }
      }
      else {
        reactUpd.selections = (optionsRef.current.keepSelections ? reactData.selections : []);
      }
      updateReactData(reactUpd, true);
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
    // eslint-disable-next-line
  }, []);

  const clean = (this_entry) => {
    let work = titleCase(this_entry.replace(/GRP|AVA|TOP|ALL/gm, '').replace(/_/gm, ' ').trim());
    let responseA = [];
    let skip = false;
    for (let char of work) {
      if (skip) {
        responseA.push(char);
        skip = false;
      }
      else if (char === char.toLowerCase()) { responseA.push(char); }
      else if (char === ' ') {
        responseA.push(char);
        skip = true;
      }
      else if (char === char.toUpperCase()) { responseA.push(' ', char); }
      else { responseA.push(char); }
    }
    return responseA.join('');
  };

  const countSelections = () => {
    let selectedPeople_count = 0;
    let selectedPeople_list = [];
    if (reactData.selections) {
      let selectionPeople_obj = {};
      for (let this_selection of reactData.selections) {
        if (this_selection.hasOwnProperty('person_id')) {
          selectionPeople_obj[this_selection.person_id] = true;
        }
        else if (this_selection.hasOwnProperty('personList')) {
          for (let this_person of this_selection.personList) {
            selectionPeople_obj[this_person] = true;
          }
        }
        else if (this_selection.hasOwnProperty('group_id')) {
          for (let this_person of reactData.accessList) {
            if (this_person.groups && this_person.groups.includes(this_selection.group_id)) {
              selectionPeople_obj[this_person.person_id] = true;
            }
          }
        }
      }
      selectedPeople_list = Object.keys(selectionPeople_obj);
      selectedPeople_count = selectedPeople_list.length;
    }
    return { selectedPeople_count, selectedPeople_list };
  };

  const OKtoShowPreferred = (this_object, rIndex) => {
    if (optionsRef.current.restrictGroups) {
      return true;
    }
    return (
      (options.showAll && (isEmpty(reactData.linkedPersonFilter) || reactData.linkedPersonFilter?.raw?.length < 2))
      ||
      ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (this_object.objText.toLowerCase().includes(reactData.linkedPersonFilter.lower)))
      ||
      ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (this_object.personNames.some(p => { return p.toLowerCase().includes(reactData.linkedPersonFilter.lower); })))
    );
  };

  const OKtoShowGroup = (this_group) => {
    if (this_group.isHeader || this_group.isSection) { return true; }
    if (options.restrictGroups) {
      return true;
    }
    return (
      (options.showAll && (isEmpty(reactData.linkedPersonFilter) || reactData.linkedPersonFilter?.raw?.length < 2))
      ||
      ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (this_group.group_name.toLowerCase().includes(reactData.linkedPersonFilter.lower)))
    );
  };

  const OKtoShow = (this_person) => {
    this_person.first = this_person.first || this_person.name?.first || '';
    this_person.last = this_person.last || this_person.name?.last || '';
    return (
      (options.showAll && (isEmpty(reactData.linkedPersonFilter) || reactData.linkedPersonFilter?.raw?.length < 2))
      ||
      (options.withSpecialValues
        && (reactData.special_values.some(this_special => { return (this_special.person_id === this_person.person_id); }))
      )
      ||
      (
        (reactData.selections && (reactData.selections.length > 0) && (reactData.selections.some(s => {
          return s.person_id === this_person.person_id;
        })))
        ||
        ((reactData.linkedPersonFilter?.raw?.length > 1)
          && (`${this_person.last} ${this_person.first}`).toLowerCase().includes(reactData.linkedPersonFilter.lower))
      )
    );
  };

  return (
    <Dialog open={true || reactData.accessList}
      p={2}
      height={250}
      classes={{ paper: classes.clientPopUp }}
      fullWidth
      variant={'elevation'}
      elevation={2}
      onClose={() => { onClose(initialSelectionsRef.current); }}
    >
      <DialogContentText
        id='scroll-dialog-title'
        style={AVATextStyle({
          size: 1.4,
          bold: true,
          margin: { left: 0.5, top: 1 }
        })}
      >
        {options.title || `Quick Search`}
      </DialogContentText>
      <Box display='flex' flexDirection='row' alignItems='center' style={{ marginLeft: '8px', marginRight: '8px' }}>
        <TextField
          style={isMobile ? AVATextStyle({ width: '60%' }) : AVATextStyle({ width: '70%' })}
          key={`key_words`}
          inputRef={searchInputRef}
          autoFocus
          defaultValue={reactData.linkedPersonFilter?.raw || ''}
          onChange={(event) => {
            // Reset virtual scrolling limit when search changes
            setMaxPeopleToRender(100);

            if (event.target.value.length === 0) {
              updateReactData({
                linkedPersonFilter: {
                  raw: '',
                  lower: ''
                }
              }, true);
            }
            else {
              updateReactData({
                linkedPersonFilter: {
                  raw: event.target.value.trim(),
                  lower: event.target.value.trim().toLowerCase()
                }
              }, true);
            }
          }}
          autoComplete='off'
          helperText='Name Search'
        />
      </Box>

      {/* Chip strip — always-visible selection summary */}
      <Box
        display='flex'
        flexDirection='row'
        flexWrap='wrap'
        alignItems='center'
        style={{
          minHeight: 36,
          maxHeight: 96,
          overflowY: 'auto',
          padding: '4px 8px',
          margin: '4px 8px',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          backgroundColor: '#fafafa',
          gap: 6,
        }}
      >
        {(!reactData.selections || reactData.selections.length === 0)
          ? <Typography style={{ color: '#bbb', fontSize: '0.82rem', fontStyle: 'italic' }}>
            {'Nothing selected yet'}
          </Typography>
          : reactData.selections.map((sel, sIndex) => {
            const isGroup = !!sel.group_id;
            const isPref = sel.rIndex !== undefined;
            const resolvedPerson = (!isGroup && !isPref && sel.person_id && !sel.person_name && !sel.listName)
              ? (reactData.accessList || []).find(p => p.person_id === sel.person_id)
              : null;
            const fullLabel = sel.person_name || sel.listName
              || (isGroup ? getGroupPath(sel.group_id) : null)
              || (resolvedPerson ? (`${resolvedPerson.first || ''} ${resolvedPerson.last || ''}`).trim() : null)
              || sel.person_id || sel.group_id || '';
            // Show only the leaf segment in the chip; full breadcrumb path visible on hover
            const chipLabel = (isGroup && fullLabel.includes(' / '))
              ? fullLabel.split(' / ').slice(-1)[0]
              : fullLabel;
            return (
              <Tooltip key={`chip_sel_${sIndex}`} title={fullLabel} placement='top'>
                <Chip
                  size='small'
                  icon={isGroup
                    ? <GroupIcon style={{ fontSize: '0.85rem' }} />
                    : isPref
                      ? <StarIcon style={{ fontSize: '0.85rem' }} />
                      : <PersonIcon style={{ fontSize: '0.85rem' }} />
                  }
                  label={chipLabel}
                  onClick={isGroup ? () => expandToGroup(sel.group_id) : (!isPref && sel.person_id ? () => scrollToPerson(sel.person_id) : undefined)}
                  onDelete={() => {
                    reactData.selections.splice(sIndex, 1);
                    const { selectedPeople_count, selectedPeople_list } = countSelections();
                    updateReactData({ selectedPeople_count, selectedPeople_list, selections: reactData.selections }, true);
                  }}
                  style={{
                    backgroundColor: isGroup ? '#e3f2fd' : isPref ? '#fff3e0' : '#e8f5e9',
                    color: isGroup ? '#1565c0' : isPref ? '#bf360c' : '#1b5e20',
                    fontSize: '0.8rem',
                    maxWidth: '20vw',
                    cursor: (isGroup || (!isPref && sel.person_id)) ? 'pointer' : 'default',
                  }}
                />
              </Tooltip>
            );
          })
        }
      </Box>
      <Paper paddingTop={'8px'} paddingBottom={'8px'} paddingLeft={'8px'} component={Box} elevation={0}
        width='100%' height={250} overflow='auto' square
        onScroll={(e) => {
          // Virtual scrolling: load more people when scrolling near bottom
          const element = e.currentTarget;
          const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 200;

          if (scrolledToBottom && reactData.accessList) {
            const fullPeopleList = (options.withSpecialValues ? reactData.special_values || [] : []).concat(reactData.accessList);
            const filteredCount = fullPeopleList.filter(person => OKtoShow(person)).length;

            if (maxPeopleToRender < filteredCount) {
              console.log(`📜 QuickSearch: Loading more people: ${maxPeopleToRender} → ${maxPeopleToRender + 100}`);
              setMaxPeopleToRender(maxPeopleToRender + 100);
            }
          }
        }}
      >
        {options.withPreferred && reactData.preferred_recipients && (reactData.preferred_recipients.length > 0) &&
          (() => {
            // Check if there are any visible preferred recipients
            const visiblePreferred = reactData.preferred_recipients.filter((recipient, idx) => OKtoShowPreferred(recipient, idx));
            if (visiblePreferred.length === 0) return null;

            return (
              <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  <Typography
                    style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '6.5px', marginBottom: '4px', textWrapStyle: 'balance' }}
                  >
                    {'Preferred Recipients'}
                  </Typography>
                  {/* Show/Hide Toggle */}
                  <Box flexGrow={2} display='flex' alignItems='center'
                    style={{ paddingTop: '2px', marginTop: '4px', marginLeft: '32px', marginBottom: '4px', textWrapStyle: 'balance' }}
                    justifyContent='flex-start' marginBottom={1} flexDirection='row'>
                    <Typography
                      style={AVATextStyle({
                        size: 0.8, margin: { right: -0.4 },
                        bold: !reactData.showPreferredList
                      })}
                    >
                      {'Hide'}
                    </Typography>
                    <Switch
                      checked={reactData.showPreferredList || false}
                      onClick={async (event) => {
                        updateReactData({
                          showPreferredList: !reactData.showPreferredList
                        }, true);
                      }}
                      name="ShowPreferred"
                      color="primary"
                    />
                    <Typography
                      style={AVATextStyle({
                        size: 0.8, margin: { left: -0.4 },
                        bold: reactData.showPreferredList
                      })}
                    >
                      {'Show'}
                    </Typography>
                  </Box>
                </Box>
                <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
                  style={{ marginLeft: '16px' }}
                >

                  {reactData.showPreferredList && reactData.preferred_recipients.map((this_recipient, rIndex) => (
                    OKtoShowPreferred(this_recipient, rIndex) &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      alignItems={'center'}
                      key={`select_group_opt${rIndex}`}
                      style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        updateReactData({
                          alert: {
                            severity: 'info',
                            title: `${this_recipient.objText}`,
                            message: <div>
                              Person IDs: <strong>{listFromArray(this_recipient.personList)}</strong>
                              Person Names: <strong>{listFromArray(this_recipient.personNames)}</strong><br /></div>
                          }
                        }, true);
                      }}
                      onClick={() => {
                        if (options.pickAndGo) {
                          const foundAt = reactData.selections.findIndex(s => { return (s.rIndex === rIndex); });
                          if (foundAt > -1) {
                            reactData.selections.splice(foundAt, 1);
                          }
                          else {
                            reactData.selections.unshift({
                              rIndex,
                              personList: this_recipient.personList,
                              personNames: this_recipient.personNames,
                              listName: this_recipient.objText
                            });
                          }
                          let { selectedPeople_count, selectedPeople_list } = countSelections();
                          updateReactData({
                            selectedPeople_count,
                            selectedPeople_list,
                            selections: reactData.selections
                          }, true);
                        }
                      }}
                    >
                      <Typography
                        style={
                          (reactData.selections && reactData.selections.some(s => { return s.rIndex === rIndex; }))
                            ? AVATextStyle({ bold: true, color: 'green' })
                            : AVATextStyle()
                        }
                      >
                        {this_recipient.objText}
                      </Typography>
                    </Box>
                  )
                  )}
                </Box>
              </Box>
            );
          })()
        }
        {options.withGroups && reactData.groupInfo && (reactData.groupInfo.groupList.length > 0) &&
          (() => {
            // Check if there are any visible groups
            const visibleGroups = reactData.groupInfo.groupList.filter(group => OKtoShowGroup(group));
            if (visibleGroups.length === 0) return null;

            return (
              <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  <Typography
                    style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                  >
                    {'Groups'}
                  </Typography>
                  {(!options.hidePeople || !reactData.showGroupList) &&
                    <Box
                      flexGrow={2} display='flex' alignItems='center'
                      style={{ paddingTop: '2px', marginTop: '4px', marginLeft: '32px', marginBottom: '4px', textWrapStyle: 'balance' }}
                      justifyContent='flex-start' marginBottom={1} flexDirection='row'>
                      <Typography
                        style={AVATextStyle({
                          size: 0.8, margin: { right: -0.4 },
                          bold: !reactData.showGroupList
                        })}
                      >
                        {'Hide'}
                      </Typography>
                      <Switch
                        checked={reactData.showGroupList || false}
                        onClick={async (event) => {
                          updateReactData({
                            showGroupList: !reactData.showGroupList
                          }, true);
                        }}
                        name="ShowGroups"
                        color="primary"
                      />
                      <Typography
                        style={AVATextStyle({
                          size: 0.8, margin: { left: -0.4 },
                          bold: reactData.showGroupList
                        })}
                      >
                        {'Show'}
                      </Typography>
                    </Box>
                  }
                </Box>
                <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
                  style={{ marginLeft: '16px' }}
                >
                  {reactData.showGroupList &&
                    (() => {
                      const groupList = reactData.groupInfo.groupList;
                      const isSearchActive = (reactData.linkedPersonFilter?.raw?.length || 0) > 1;

                      // A group has children if the next entry in the flat list has a higher level
                      const hasChildren = (idx) =>
                        idx + 1 < groupList.length && groupList[idx + 1].level > groupList[idx].level;

                      // A group is visible only when every ancestor in the chain is expanded
                      const isVisible = (idx) => {
                        if (isSearchActive) { return true; } // auto-expand on search
                        let checkLevel = groupList[idx].level;
                        for (let i = idx - 1; i >= 0; i--) {
                          if (groupList[i].level < checkLevel) {
                            // Found the next ancestor up the chain
                            if (collapsedGroups.has(groupList[i].group_id)) { return false; }
                            checkLevel = groupList[i].level; // now look for this ancestor's parent
                            if (checkLevel === 0) { break; } // reached root — no more ancestors
                          }
                        }
                        return true;
                      };

                      // During search, build a set of ancestor IDs for matching groups
                      // so they can be shown as gray context rows
                      const ancestorContextIds = new Set();
                      if (isSearchActive) {
                        groupList.forEach((g, idx) => {
                          if (g.isHeader || g.isSection) { return; }
                          if (g.group_name.toLowerCase().includes(reactData.linkedPersonFilter.lower)) {
                            let checkLevel = g.level;
                            for (let i = idx - 1; i >= 0 && checkLevel > 0; i--) {
                              if (groupList[i].level < checkLevel) {
                                ancestorContextIds.add(groupList[i].group_id);
                                checkLevel = groupList[i].level;
                              }
                            }
                          }
                        });
                      }

                      return groupList.map((this_group, gIndex) => {
                        const isHeader = !!this_group.isHeader;
                        const isSection = !!this_group.isSection;
                        const isNonSelectable = isHeader || isSection;
                        const isAncestorContext = isSearchActive && !isNonSelectable && ancestorContextIds.has(this_group.group_id);
                        const matchesSearch = isSearchActive && !isNonSelectable &&
                          this_group.group_name.toLowerCase().includes(reactData.linkedPersonFilter?.lower || '');

                        // Visibility: during search show matches + their ancestors + headers/sections
                        if (isSearchActive) {
                          if (!isNonSelectable && !matchesSearch && !isAncestorContext) { return null; }
                        } else {
                          if (!OKtoShowGroup(this_group)) { return null; }
                          if (!isVisible(gIndex)) { return null; }
                        }

                        const isParent = isNonSelectable || hasChildren(gIndex);
                        const isCollapsed = collapsedGroups.has(this_group.group_id);
                        const isSelected = !isNonSelectable && reactData.selections && reactData.selections.some(s => s.group_id === this_group.group_id);
                        const indentPx = (this_group.level || 0) * 16;

                        const isHighlighted = this_group.group_id === highlightedGroupId;
                        const toggleCollapse = () => {
                          const next = new Set(collapsedGroups);
                          if (isCollapsed) { next.delete(this_group.group_id); }
                          else { next.add(this_group.group_id); }
                          setCollapsedGroups(next);
                        };
                        return (
                          <Box
                            display='flex'
                            flexDirection='row'
                            alignItems='center'
                            key={`select_group_opt${gIndex}`}
                            ref={isHighlighted ? (el) => { if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } } : undefined}
                            style={{
                              paddingTop: isHeader ? '6px' : '2px',
                              marginTop: isHeader ? '6px' : '2px',
                              marginBottom: '2px',
                              marginLeft: `${indentPx}px`, cursor: 'pointer',
                              borderRadius: 6,
                              backgroundColor: isHighlighted ? '#fff9c4' : 'transparent',
                              transition: 'background-color 0.4s ease',
                            }}
                            onContextMenu={isHeader ? undefined : async (e) => {
                              e.preventDefault();
                              updateReactData({
                                alert: {
                                  severity: 'info',
                                  title: `${this_group.group_name}`,
                                  message: <div>Group ID: <strong>{this_group.group_id}</strong><br /></div>
                                }
                              }, true);
                            }}
                            onClick={() => {
                              if (isNonSelectable) {
                                toggleCollapse();
                                return;
                              }
                              const foundAt = reactData.selections?.findIndex(s => s.group_id === this_group.group_id) ?? -1;
                              if (foundAt > -1) {
                                reactData.selections.splice(foundAt, 1);
                              } else {
                                if (!reactData.selections) { reactData.selections = []; }
                                reactData.selections.unshift({ group_id: this_group.group_id, group_name: this_group.group_name });
                              }
                              const { selectedPeople_count, selectedPeople_list } = countSelections();
                              updateReactData({ selectedPeople_count, selectedPeople_list, selections: reactData.selections }, true);
                              if (options.pickOne) { onClose(reactData.selections); }
                            }}
                          >
                            <Typography
                              style={isNonSelectable
                                ? AVATextStyle({ bold: true, size: 0.85 })
                                : isAncestorContext
                                  ? { color: '#aaa', fontStyle: 'italic', fontSize: '0.88rem' }
                                  : (isSelected ? AVATextStyle({ bold: true, color: 'green' }) : AVATextStyle())
                              }
                            >
                              {this_group.group_name}
                            </Typography>
                            {(isParent || isHeader) && !isSearchActive &&
                              <Box
                                style={{ display: 'flex', alignItems: 'center', marginLeft: 6, flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCollapse();
                                }}
                              >
                                {isCollapsed
                                  ? <ChevronRightIcon style={{ fontSize: '1rem', color: '#aaa' }} />
                                  : <ExpandMoreIcon style={{ fontSize: '1rem', color: '#aaa' }} />
                                }
                              </Box>
                            }
                          </Box>
                        );
                      });
                    })()}
                </Box>
              </Box>
            );
          })()
        }

        {reactData.accessList &&
          !options.hidePeople &&
          ((options.withSpecialValues ? reactData.special_values : []).concat(reactData.accessList).length > 0) &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            <Typography
              style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '6.5px', marginBottom: '4px', textWrapStyle: 'balance' }}
            >
              {(options.showAll ? 'People' : `People (use search above to find ${(reactData.selections && (reactData.selections.length > 0)) ? 'more ' : ''}names)`)}
            </Typography>
            <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
              style={{ marginLeft: '16px' }}
            >
              {(() => {
                // Pre-filter the people list, then apply virtual scrolling
                const fullPeopleList = (options.withSpecialValues ? reactData.special_values || [] : []).concat(reactData.accessList);
                const filteredPeople = fullPeopleList.filter(person => OKtoShow(person));
                const totalFiltered = filteredPeople.length;
                const peopleToShow = filteredPeople.slice(0, maxPeopleToRender);

                // Log virtual scrolling info
                if (totalFiltered > maxPeopleToRender) {
                  console.log(`📊 QuickSearch: Showing ${maxPeopleToRender} of ${totalFiltered} people`);
                }

                return peopleToShow.map((this_item, tIndex) => (
                  <Box
                    display='flex'
                    flexDirection='row'
                    alignItems={'center'}
                    key={`select_person_opt${tIndex}`}
                    ref={this_item.person_id === highlightedPersonId ? (el) => { if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } } : undefined}
                    style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance', borderRadius: 6, backgroundColor: this_item.person_id === highlightedPersonId ? '#fff9c4' : 'transparent', transition: 'background-color 0.4s ease' }}
                    onContextMenu={async (e) => {
                      e.preventDefault();
                      updateReactData({
                        alert: {
                          severity: 'info',
                          title: `${this_item.first} ${this_item.last}`,
                          message: <div>
                            User ID: <strong>{this_item.person_id}</strong><br />
                            Groups: {listFromArray(this_item.groups.map(g => {
                              return clean(g);
                            }), { ignoreBlank: true })}<br /></div>
                        }
                      }, true);
                    }}

                    onClick={() => {
                      if (options.pickAndGo || options.pickOne) {
                        const foundAt = reactData.selections.findIndex(s => { return (s.person_id === this_item.person_id); });
                        if (foundAt > -1) {
                          reactData.selections.splice(foundAt, 1);
                        }
                        else {
                          reactData.selections.unshift({
                            person_id: this_item.person_id,
                            person_name: (`${this_item.first.trim()} ${this_item.last.trim()}`).trim(),
                            person_firstName: this_item.first.trim(),
                            person_lastName: this_item.last.trim()
                          });
                        }
                        let { selectedPeople_count, selectedPeople_list } = countSelections();
                        if (options.pickOne) {
                          onClose(reactData.selections);
                        }
                        else {
                          updateReactData({
                            selectedPeople_count,
                            selectedPeople_list,
                            selections: reactData.selections
                          }, true);
                        }
                      }
                      else {
                        updateReactData({
                          showProfileEdit_id: this_item.person_id
                        }, true);
                      }
                    }}
                  >
                    <Typography
                      style={(reactData.selections && reactData.selections.some(s => { return s.person_id === this_item.person_id; }))
                        ? AVATextStyle({ bold: true, color: 'green' })
                        : (reactData.selectedPeople_list && reactData.selectedPeople_list.includes(this_item.person_id)
                          ? AVATextStyle({ bold: true, color: 'orange' })
                          : AVATextStyle())
                      }
                    >
                      {`${this_item.first} ${this_item.last}`}
                    </Typography>
                  </Box>
                ));
              })()}
            </Box>
          </Box>
        }
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'gray', color: 'white', marginRight: 8 }}
          size='small'
          onClick={() => {
            onClose(initialSelectionsRef.current);
          }}
        >
          {'Cancel'}
        </Button>
        {options.secondaryAction &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'gray', color: 'white', marginRight: 8 }}
            size='small'
            onClick={options.secondaryAction.onClick}
          >
            {options.secondaryAction.text}
          </Button>
        }
        <Button
          className={AVAClass.AVAButton}
          style={{
            backgroundColor: (() => {
              // If a specific buttonColor was provided, use it
              if (options.buttonColor) {
                return options.buttonColor;
              }
              // Otherwise, use green if there are selections, red if none
              const hasSelections = reactData.selections && reactData.selections.length > 0;
              return hasSelections ? 'green' : 'red';
            })(),
            color: 'white'
          }}
          size='small'
          onClick={() => {
            onClose(reactData.selections);
          }}
        >
          {(() => {
            const count = (reactData.selections || []).length;
            if (count === 0) {
              if (typeof options.buttonText === 'object' && options.buttonText?.empty) { return options.buttonText.empty; }
              return typeof options.buttonText === 'string' ? options.buttonText : 'Done';
            }
            if (typeof options.buttonText === 'string') { return `${options.buttonText}`; }
            if (typeof options.buttonText === 'object' && options.buttonText?.selected) { return `${options.buttonText.selected}`; }
            return `Use ${count} selection${count === 1 ? '' : 's'}`;
          })()}
        </Button>
      </DialogActions>
      {
        reactData.showProfileEdit_id &&
        <PeopleMaintenance
          person_id={reactData.showProfileEdit_id}
          options={{ mode: 'view' }}
          onClose={(updatedPerson) => {
            updateReactData({
              showProfileEdit_id: false
            }, true);
          }}
        />
      }
    </Dialog >
  );
};