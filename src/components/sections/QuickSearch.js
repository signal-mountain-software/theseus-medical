import React from 'react';

import useSession from '../../hooks/useSession';

import { deepCopy, isMobile, titleCase, listFromArray, isEmpty } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { Box, Button, TextField, Typography, Dialog, Paper, DialogContentText, DialogActions, Switch } from '@material-ui/core/';

const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    padding: '16px',
    height: '450px'
  }
}));

export default ({ reactData, updateReactData, onClose, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    async function initialize() {
      let reactUpd = {};
      reactUpd.preferred_recipients = [];
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
      if (options.withGroups && !reactData.groupInfo) {
        if (state.hasOwnProperty('groups')) {
          let groupList = [];
          loadList('__TOP__', state.groups.groupTree['__TOP__'], 0);
          function loadList(this_item, my_children, this_level) {
            groupList.push({
              group_id: this_item,
              group_name: state.groups.groupNames[this_item],
              level: this_level
            });
            if (isEmpty(my_children)) { return; }
            else {
              let next_level = this_level + 1;
              for (let my_child in my_children) {
                loadList(my_child, my_children[my_child], next_level);
              }
            }
          }
          reactUpd.groupInfo = Object.assign({}, deepCopy(state.groups), { groupList: deepCopy(groupList) });
        }
      }
      if (!reactData.accessList) {
        if (!state.accessList) {
          if (isMounted.current) {
            onClose();
          }
        }
        else {
          reactUpd.selections = (options.keepSelections ? reactData.selections : []);
          reactUpd.accessList = deepCopy(state.accessList[state.session.client_id].list);
        }
      }
      else {
        reactUpd.selections = (options.keepSelections ? reactData.selections : []);
      }
      updateReactData(reactUpd, true);
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
              selectionPeople_obj[this_person] = true;
            }
          }
        }
      }
      selectedPeople_list = Object.keys(selectionPeople_obj);
      selectedPeople_count = selectedPeople_list.length;
    }
    return { selectedPeople_count, selectedPeople_list };
  };

  const OKtoShowPreferred = (this_object) => {
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
    if (this_group.level === 0) {
      return false;
    }
    return (
      (options.showAll && (isEmpty(reactData.linkedPersonFilter) || reactData.linkedPersonFilter?.raw?.length < 2))
      ||
      ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (this_group.group_name.toLowerCase().includes(reactData.linkedPersonFilter.lower)))
    );
  };

  const OKtoShow = (this_person) => {
    return (
      (options.showAll && (isEmpty(reactData.linkedPersonFilter) || reactData.linkedPersonFilter?.raw?.length < 2))
      ||
      (options.withSpecialValues
        && (reactData.special_values.some(this_special => { return (this_special.person_id === this_person.person_id); }))
      )
      ||
      (
        ((reactData.selections.length > 0) && (reactData.selections.some(s => {
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
      onClose={() => { onClose(); }}
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
      <TextField
        style={isMobile ? AVATextStyle({ width: '90%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
        key={`key_words`}
        defaultValue={reactData.linkedPersonFilter?.raw || ''}
        onChange={(event) => {
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
      <Paper paddingTop={'8px'} paddingBottom={'8px'} paddingLeft={'8px'} component={Box} elevation={0}
        width='100%' height={250} overflow='auto' square
      >
        {reactData.showAll && reactData.selections && (reactData.selections.length > 0) &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            style={{ marginBottom: '20px' }}
          >
            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
              <Typography
                style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
              >
                {'Selected'}
              </Typography>
            </Box>
            <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
              style={{ marginLeft: '16px' }}
            >
              {reactData.selections.map((this_selection, sIndex) => (
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  key={`select_group_opt${sIndex}`}
                  style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                  onClick={() => {
                    if (options.pickAndGo) {
                      reactData.selections.splice(sIndex, 1);
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
                    style={AVATextStyle({ bold: true, color: 'green' })}
                  >
                    {this_selection.person_name || this_selection.listName || this_selection.group_name}
                  </Typography>
                </Box>
              )
              )}
            </Box>
          </Box>
        }
        {options.withPreferred && (reactData.preferred_recipients.length > 0) &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
              <Typography
                style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '6.5px', marginBottom: '4px', textWrapStyle: 'balance' }}
              >
                {'Preferred Recipients'}
              </Typography>
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
                  name="ShowGroups"
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
                OKtoShowPreferred(this_recipient) &&
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
                    style={Object.assign({},
                      (reactData.selections.some(s => { return s.rIndex === rIndex; }))
                        ? AVATextStyle({ bold: true, color: 'green' })
                        : AVATextStyle()
                    )}
                  >
                    {this_recipient.objText}
                  </Typography>
                </Box>
              )
              )}
            </Box>
          </Box>
        }
        {options.withGroups && reactData.groupInfo &&
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
              {reactData.showGroupList && reactData.groupInfo.groupList.map((this_group, gIndex) => (
                OKtoShowGroup(this_group) &&
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  key={`select_group_opt${gIndex}`}
                  style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                  onContextMenu={async (e) => {
                    e.preventDefault();
                    updateReactData({
                      alert: {
                        severity: 'info',
                        title: `${this_group.group_name}`,
                        message: <div>
                          Group ID: <strong>{this_group.group_id}</strong><br /></div>
                      }
                    }, true);
                  }}
                  onClick={() => {
                    if (options.pickAndGo) {
                      const foundAt = reactData.selections.findIndex(s => { return (s.group_id === this_group.group_id); });
                      if (foundAt > -1) {
                        reactData.selections.splice(foundAt, 1);
                      }
                      else {
                        reactData.selections.unshift({
                          group_id: this_group.group_id,
                          group_name: this_group.group_name
                        });
                      }
                      let { selectedPeople_count, selectedPeople_list } = countSelections();
                      updateReactData({
                        selectedPeople_count,
                        selectedPeople_list,
                        selections: reactData.selections
                      }, true);
                    }
                    else {
                      updateReactData({
                        showGroupEdit_id: this_group.group_id
                      }, true);
                    }
                  }}
                >
                  <Typography
                    style={Object.assign({},
                      (reactData.selections.some(s => { return s.group_id === this_group.group_id; }))
                        ? AVATextStyle({ bold: true, color: 'green' })
                        : AVATextStyle(),
                      { marginLeft: `${((this_group.level - 1) * 10)}px` }
                    )}
                  >
                    {this_group.group_name}
                  </Typography>
                </Box>
              )
              )}
            </Box>
          </Box>
        }

        {reactData.accessList && !options.hidePeople &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            <Typography
              style={{ fontWeight: 'bold', paddingTop: '2px', marginTop: '6.5px', marginBottom: '4px', textWrapStyle: 'balance' }}
            >
              {(options.showAll ? 'People' : `People (use search above to find ${(reactData.selections && (reactData.selections.length > 0)) ? 'more ' : ''}names)`)}
            </Typography>
            <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
              style={{ marginLeft: '16px' }}
            >
              {((options.withSpecialValues ? reactData.special_values : []).concat(reactData.accessList)).map((this_item, tIndex) => (
                OKtoShow(this_item) &&
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  key={`select_person_opt${tIndex}`}
                  style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
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
                      updateReactData({
                        selectedPeople_count,
                        selectedPeople_list,
                        selections: reactData.selections
                      }, true);
                      if (options.pickOne) {
                        onClose(reactData.selections);
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
                    style={(reactData.selections.some(s => { return s.person_id === this_item.person_id; }))
                      ? AVATextStyle({ bold: true, color: 'green' })
                      : AVATextStyle()
                    }
                  >
                    {`${this_item.first} ${this_item.last}`}
                  </Typography>
                </Box>
              )
              )}
            </Box>
          </Box>
        }
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: (options.buttonColor || 'red'), color: 'white' }}
          size='small'
          onClick={() => {
            onClose(reactData.selections);
          }}
        >
          {options.buttonText || 'Exit'}
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