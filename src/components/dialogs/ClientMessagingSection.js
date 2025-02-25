import React from 'react';
import { titleCase, sentenceCase, dbClient, cl, recordExists, isObject, listFromArray } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';

import { Typography } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import EditIcon from '@material-ui/icons/Edit';
import LinkIcon from '@material-ui/icons/Link';
import SaveIcon from '@material-ui/icons/Save';
import CancelIcon from '@material-ui/icons/Cancel';

import makeStyles from '@material-ui/core/styles/makeStyles';
import DeleteIcon from '@material-ui/icons/Delete';
import AVAConfirm from '../forms/AVAConfirm';

import { AVATextStyle } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold'
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    width: '100%',
    marginLeft: 0,
    marginBottom: '10px',
    marginRight: '32px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  editInput: {
    width: '100%',
    color: 'black',
    marginLeft: 0,
    marginRight: '8px',
    paddingLeft: 0,
    paddingRight: 0,
    minHeight: theme.typography.fontSize * 2.8,
  },
  rowButton: {
    marginRight: theme.spacing(1),
    fontSize: '1rem',
    marginBottom: theme.spacing(1),
  },
  rowButtonGreen: {
    marginRight: theme.spacing(1),
    fontSize: '1rem',
    marginBottom: theme.spacing(1),
    color: 'green'
  },
  inputDisplay: {
    '&.Mui-disabled': {
      color: 'black'
    },
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.reject[theme.palette.type],
  },
  dialogBox: {
    paddingTop: 0,
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    overflowX: 'auto',
    //   overflowY: 'hidden'
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  load: {
    backgroundColor: theme.palette.warning[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
}));

export default ({ pGroup = 'ALL', reactData, updateReactData, currentValues }) => {

  var rowsWritten;

  const isMounted = React.useRef(false);
  const classes = useStyles();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });



  async function onCheckEnter(event, section_name, ndx = 'new') {
    if (event.key === 'Enter') {
      await saveNewTitle(section_name, ndx);
    }
  };

  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('id', JSON.stringify(id));
  };

  const handleDragOver = (ev) => {
    ev.preventDefault();
  };

  const handleDrop = async (ev, { droppedOn }) => {
    ev.preventDefault();
    let dragged_id = JSON.parse(ev.dataTransfer.getData('id'));
    let draggedFromIndex = (reactData.bBoardList[dragged_id.group][dragged_id.section_name].generic_activities_list[dragged_id.aNdx]).group_list_index;
    let droppedOnIndex = (reactData.bBoardList[droppedOn.group][droppedOn.section_name].generic_activities_list[droppedOn.aNdx]).group_list_index;
    // add draggedfrom from before droppedon
    // - this will change the position of everything after droppedon
    // - to remove the dragged from: 
    //       if it's position was LESS THAN droppedon, remove it in place
    //       if it's position was GREATER THAN droppedon, add one and then remove it
    let entryToAdd = reactData.bBoardList[dragged_id.group].groupRec.common_activities[draggedFromIndex];
    reactData.bBoardList[dragged_id.group].groupRec.common_activities.splice(droppedOnIndex, 0, entryToAdd);
    if (draggedFromIndex > droppedOnIndex) {
      draggedFromIndex++;
    }
    reactData.bBoardList[dragged_id.group].groupRec.common_activities.splice(draggedFromIndex, 1);
    await dbClient
      .update({
        Key: {
          client_id: currentValues.customizationRecs.client_name.client_id,
          group_id: reactData.group_id
        },
        UpdateExpression: 'set #c = :c',
        ExpressionAttributeValues: {
          ':c': reactData.bBoardList[reactData.group_id].groupRec.common_activities
        },
        ExpressionAttributeNames: {
          '#c': 'common_activities'
        },
        TableName: "Groups",
      })
      .promise()
      .catch(error => {
        cl(`caught error updating Group; error is: `, error);
      });
    let response = await setBBoard();
    updateReactData({
      bBoardList: response,
      changesMade: true
    }, true);
  };


  const handleChangeTextInput = (inputValue, section_name, ndx = 'new') => {
    if (!reactData.textInput.hasOwnProperty(section_name)) {
      reactData.textInput[section_name] = [];
    }
    if (inputValue.length === 1) {
      inputValue = inputValue.toUpperCase();
    }
    reactData.textInput[section_name][ndx] = inputValue;
    updateReactData({
      isError: false,
      textInput: reactData.textInput
    }, true);
  };

  async function saveNewTitle(section_name, ndx = 'new') {
    if (ndx !== 'new') {
      let rowObj = reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx];
      reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx].title = reactData.textInput[section_name][ndx];
      let updateObj = {
        activity_code: 'form.make_message',
        default: {
          recipientID: [reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx].recipient_id].flat(),
          recipientName: [reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx].recipient_name].flat(),
        },
        title: reactData.textInput[section_name][ndx],
      };
      reactData.bBoardList[reactData.group_id].groupRec.common_activities[rowObj.group_list_index] = updateObj;
      await dbClient
        .update({
          Key: {
            client_id: currentValues.customizationRecs.client_name.client_id,
            group_id: reactData.group_id
          },
          UpdateExpression: 'set #c = :c',
          ExpressionAttributeValues: {
            ':c': reactData.bBoardList[reactData.group_id].groupRec.common_activities
          },
          ExpressionAttributeNames: {
            '#c': 'common_activities'
          },
          TableName: "Groups",
        })
        .promise()
        .catch(error => {
          cl(`caught error updating Group; error is: `, error);
        });
      reactData.editMode[section_name][ndx] = false;
      updateReactData({
        bBoardList: reactData.bBoardList,
        editMode: reactData.editMode,
        changesMade: true
      }, true);
    }
  }

  async function setBBoard() {
    let response = await getMessageInfo(currentValues.customizationRecs.client_name.client_id, reactData.group_id);
    if (!response || (!response.hasOwnProperty(reactData.group_id))) {
      response[reactData.group_id] = {
        groupRec: {
          group_id: reactData.group_id,
          common_activities: []
        }
      };
    }
    if (Object.keys(response[reactData.group_id]).length === 1) {   // the only thing there is the groupRec; no activities at all
      if (!response[reactData.group_id].groupRec.hasOwnProperty('common_activities')) {
        reactData.needsHeader = true;
        response[reactData.group_id].groupRec.common_activities = [];
      }
      if ((response[reactData.group_id].groupRec.common_activities.length === 0)
        || !response[reactData.group_id].groupRec.common_activities.some(l => {
          return ((typeof (l) === 'string') && l.startsWith('~~Messages'));
      })) {
        reactData.needsHeader = true;
        response[reactData.group_id]['Messages'] = {
          section_sort: '',
          generic_activities_list: [{
            group_list_index: 0,
            recipient_id: `ava-${currentValues.customizationRecs.client_name.client_id}`,
            recipient_name: 'AVA Support',
            title: `Send a message to AVA Support`
          }]
        };
      }      
    }
    if ((response[reactData.group_id].groupRec.common_activities.length === 0)
      || !response[reactData.group_id].groupRec.common_activities.some(l => {
      return ((typeof(l) === 'string') && l.startsWith('~~AVA Support'));
    })) {
      reactData.needsHeader = true;
      response[reactData.group_id]['AVA Support'] = {
        section_sort: '',
        generic_activities_list: [{
          group_list_index: 0,
          recipient_id: `ava-${currentValues.customizationRecs.client_name.client_id}`,
          recipient_name: 'AVA Support',
          title: `Send a message to AVA Support`
        }]
      };
    }
    return response;
  }


  async function getMessageInfo(pClient, pGroup_id) {
    let response = {
      //  group_id : {
      //    groupRec,
      //    section_name: {
      //       section_sort,
      //       messageList: [{
      //         group_list_index,   
      //         recipient_id,
      //         recipient_name
      //        }, {}, ...]
      //    }
      //  }
    };
    let qQ = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': pClient },
      TableName: "Groups"
    };
    if (pGroup_id) {
      qQ.KeyConditionExpression += ' and group_id = :g';
      qQ.ExpressionAttributeValues[':g'] = pGroup_id;
    }
    let groupRecs = await dbClient
      .query(qQ)
      .promise()
      .catch(error => {
        cl(`***ERR reading Groups*** caught error is: ${error}`, qQ);
      });
    if (!recordExists(groupRecs)) {
      return {};
    }
    groupRecs.Items.forEach(groupRec => {
      let section_name = 'None';
      let section_sort = '';
      response[groupRec.group_id] = {
        groupRec
      };
      if (groupRec.common_activities && (groupRec.common_activities.length > 0)) {
        groupRec.common_activities.forEach((activity_line, aList_index) => {
          if ((typeof (activity_line) === 'string') && (activity_line.startsWith('~~'))) {
            let sectionKeys = activity_line.slice(2).split('~~');
            if (sectionKeys[1]) {
              section_name = sectionKeys[1].split('~')[0];
              section_sort = sectionKeys[0];
            }
            else {
              section_name = sectionKeys[0].split('~')[0];
              section_sort = '';
            }
          }
          else {
            let activity_name, recipient_id, recipient_name, title;
            if (isObject(activity_line)) {
              if (activity_line.hasOwnProperty('default') && activity_line.default.hasOwnProperty('recipientID')) {
                activity_name = activity_line.activity_code;
                recipient_id = activity_line.default.recipientID;
                recipient_name = activity_line.default.recipientName;
                title = activity_line.title;
              }
            }
            else {
              let parsed;
              [activity_name, ...parsed] = activity_line.split('~');
              if (activity_name === 'form.make_message') {
                parsed.forEach(spec => {
                  let [split_type, split_spec] = spec.split('=');
                  if (split_type.includes('default')) {
                    let receipientObj = split_spec.trim().replace(/[\]{}]/gm, '').split(',');
                    for (let this_part of receipientObj) {
                      let [key, value] = this_part.split(':');
                      if (key === 'recipientID') {
                        recipient_id = value;
                      }
                      else if (key === 'recipientName') {
                        recipient_name = value;
                      }
                    }
                  }
                  else if (split_type.includes('title')) {
                    title = split_spec.trim().replace(/[\]{}]/gm, '');
                  }
                });
              }
            }
            if (activity_name === 'form.make_message') {
              let aObj = {
                group_list_index: aList_index,
                recipient_id,
                recipient_name,
                title
              };
              if (!response.hasOwnProperty(groupRec.group_id)) {
                response[groupRec.group_id] = {
                  groupRec,
                  [section_name]: {
                    section_sort,
                    generic_activities_list: [aObj]
                  }
                };
              }
              else if (!response[groupRec.group_id].hasOwnProperty(section_name)) {
                response[groupRec.group_id][section_name] = {
                  section_sort,
                  generic_activities_list: [aObj]
                };
              }
              else {
                response[groupRec.group_id][section_name].generic_activities_list.push(aObj);
              }
            };
          }
        });
      }
    });
    return response;
  };



  // **************************

  React.useEffect(() => {
    async function initialize() {
      let response = await setBBoard();
      updateReactData({
        bBoardList: response,
        MessagingInitialized: true
      }, true);
    }
    isMounted.current = true;
    if (!reactData.MessagingInitialized) {
      initialize();
    }
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    reactData.MessagingInitialized &&
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box
        key={`screen_box-${reactData.group_id}`}
        className={classes.dialogBox}
      >
        { /* Data rows */}
        <Box
          key={`Group-detail-box-outside2`}
          style={{
            paddingLeft: '4px',
          }}
          id='dialog-content'
        >
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {rowsWritten = 0}
          </Typography>
          {Object.keys(reactData.bBoardList[reactData.group_id]).map((section_name, groupNdx) => (
            (section_name !== 'groupRec') &&
            <React.Fragment key={`Group-detail-box-inside-${section_name}`}>
              { /* Group Title - name */}
              <Box
                display='flex'
                flexDirection='row'
                key={`Group-title-box-${section_name}-titlebox`}
                id={`Group-title-box-${section_name}-titlebox`}
                paddingTop={2}
                marginTop={(rowsWritten > 0) ? 8 : 0}
                justifyContent='flex-start'
                alignItems='center'
              >
                <Typography
                  key={`Group-title-box-${section_name}-title`}
                  id={`Group-title-box-${section_name}-title`}
                  style={AVATextStyle({ size: 1.3, bold: true, margin: { bottom: 0.8, top: 0 } })}
                >
                  {section_name.toLowerCase().startsWith('submenu') ? titleCase(section_name.slice(8)) : titleCase(section_name)}
                </Typography>
                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten++}
                </Typography>

              </Box>
              <Box
                display='flex'
                flexDirection='row'
                key={`Group-title-box-${section_name}`}
                id={`Group-title-box-${section_name}`}
                minWidth={'95%'}
                flexGrow={1}
                marginBottom={5}
                justifyContent='flex-start'
                alignItems='flex-start'
              >
                <Box
                  key={`selectBox_${section_name}`}
                  display='flex' flexGrow={1} flexDirection='column'
                >
                  { /* Add row for this Section */}
                  <Box
                    key={`selectBox_${section_name}`}
                    display='flex' flexGrow={1} flexDirection='row'
                    border={((reactData.selectedSection === section_name) && (reactData.isError)) ? 4 : 'none'}
                    borderColor={((reactData.selectedSection === section_name) && (reactData.isError)) ? 'red' : 'gray'}
                    borderRadius={'16px'}
                    paddingLeft={((reactData.selectedSection === section_name) && (reactData.isError)) ? 2 : 0}
                    paddingTop={((reactData.selectedSection === section_name) && (reactData.isError)) ? 2 : 0}
                    marginBottom={((reactData.selectedSection === section_name) && (reactData.isError)) ? 1.5 : 0}
                  >
                    <TextField
                      className={classes.freeInput}
                      variant={'standard'}
                      key={`inputtextprompt_${section_name}`}
                      id={`inputtextprompt_${section_name}`}
                      helperText={((reactData.selectedSection === section_name) && (reactData.isError))
                        ? 'You must assign a Title for this new entry'
                        : 'Title for a New Item'
                      }
                      FormHelperTextProps={((reactData.selectedSection === section_name) && (reactData.isError))
                        ? { style: AVATextStyle({ size: 0.5, bold: true, color: 'red' }) }
                        : {}
                      }
                      onChange={event => {
                        handleChangeTextInput(event.target.value, section_name);
                      }}
                      onKeyPress={async (event) => {
                        await onCheckEnter(event, section_name);
                      }}
                      autoComplete='off'
                      value={(reactData.textInput.hasOwnProperty(section_name) && reactData.textInput[section_name]['new'])
                        ? reactData.textInput[section_name]['new']
                        : ''
                      }
                    />
                    <Box
                      key={`selectBox_${section_name}`}
                      display='flex' mt={1.25} mb={2.75} flexGrow={1} alignSelf='center' flexDirection='row'
                    >
                      <LinkIcon
                        classes={{ root: classes.rowButton }}
                        size='medium'
                        aria-label="attach_icon"
                        onClick={() => {
                          let reactUpdObj = {
                            selectedSection: section_name
                          };
                          if (!reactData.textInput.hasOwnProperty(section_name)
                            || !reactData.textInput[section_name].hasOwnProperty('new')
                            || reactData.textInput[section_name].new.length < 1) {
                            reactUpdObj.isError = true;
                          }
                          else {
                            reactUpdObj.isError = false;
                            reactUpdObj.showQuickSearch = section_name;
                          }
                          updateReactData(reactUpdObj, true);
                        }}
                        edge="start"
                      />
                    </Box>
                  </Box>
                  { /* Existing items in this Section */}
                  {reactData.bBoardList[reactData.group_id][section_name].generic_activities_list.map((aData, aNdx) => (
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, { group: reactData.group_id, section_name, aData, aNdx })}
                      onDragOver={(e) => handleDragOver(e)}
                      onDrop={async (e) => {
                        await handleDrop(e, { droppedOn: { group: reactData.group_id, section_name, aData, aNdx } });
                      }}
                      key={`row_box_grandparent-${aNdx}`}
                    >
                      <Box display='flex' flexDirection='column' mb={'8px'} width='100%' textOverflow='ellipsis'
                        key={`row_box_parent-${aNdx}`}
                      >

                        {(reactData.editMode.hasOwnProperty(section_name) && reactData.editMode[section_name][aNdx])
                          ?
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                            key={`row_box-${aNdx}`}
                          >
                            <CancelIcon
                              classes={{ root: classes.rowButton }}
                              size='small'
                              aria-label="cancel_icon"
                              color='error'
                              onClick={() => {
                                reactData.editMode[section_name][aNdx] = false;
                                updateReactData({
                                  editMode: reactData.editMode
                                }, true);
                              }}
                              edge="start"
                            />
                            <SaveIcon
                              classes={{ root: classes.rowButtonGreen }}
                              size='small'
                              aria-label="save_icon"
                              onClick={async () => {
                                await saveNewTitle(section_name, aNdx);
                              }}
                              edge="start"
                            />
                            <TextField
                              className={classes.editInput}
                              id={`prompt-${section_name}_${aNdx}`}
                              key={`prompt-${section_name}_${aNdx}`}
                              value={reactData.textInput[section_name][aNdx] || ''}
                              onChange={(event) => {
                                handleChangeTextInput(event.target.value, section_name, aNdx);
                              }}
                              onKeyPress={async (event) => {
                                await onCheckEnter(event, section_name, aNdx);
                              }}
                              autoComplete='off'
                            />
                          </Box>
                          :
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                            key={`row_box-${aNdx}`}
                          >
                            <EditIcon
                              classes={{ root: classes.rowButton }}
                              size='small'
                              aria-label="pencil_icon"
                              onClick={() => {
                                if (!reactData.editMode.hasOwnProperty(section_name)) {
                                  reactData.editMode[section_name] = [];
                                  reactData.textInput[section_name] = [];
                                }
                                reactData.editMode[section_name][aNdx] = true;
                                reactData.textInput[section_name][aNdx] = aData.title;
                                updateReactData({
                                  editMode: reactData.editMode
                                }, true);
                              }}
                              edge="start"
                            />
                            <DeleteIcon
                              classes={{ root: classes.rowButton }}
                              size='small'
                              aria-label="trash_icon"
                              onClick={() => {
                                updateReactData({
                                  confirmMessage: `Are you sure you want to remove ${aData.title}?`,
                                  selectedObservation: aNdx,
                                  selectedSection: section_name,
                                  deletePending: true,
                                  spliceAt: aData.group_list_index
                                }, true);
                              }}
                              edge="start"
                            />
                            <Box display='flex' flexDirection='column' flexGrow={1}
                              justifyContent='center' alignItems='flex-start'
                            >
                              <Typography
                                style={AVATextStyle({ size: 1.2, margin: { left: 1 } })}
                              >
                                {aData.title}
                              </Typography>
                              <Typography
                                style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}
                              >
                                {listFromArray([aData.recipient_name].flat())}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      </Box>
                    </Box>
                  ))
                  }
                </Box>
              </Box>
            </React.Fragment>
          ))}
        </Box>
        {reactData.deletePending &&
          <AVAConfirm
            promptText={reactData.confirmMessage}
            onCancel={() => {
              updateReactData({
                deletePending: false
              }, true);
            }}
            onConfirm={async () => {
              reactData.bBoardList[reactData.group_id][reactData.selectedSection].generic_activities_list.splice(reactData.selectedObservation, 1);
              reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(reactData.spliceAt, 1);
              await dbClient
                .update({
                  Key: {
                    client_id: currentValues.customizationRecs.client_name.client_id,
                    group_id: reactData.group_id
                  },
                  UpdateExpression: 'set #c = :c',
                  ExpressionAttributeValues: {
                    ':c': reactData.bBoardList[reactData.group_id].groupRec.common_activities
                  },
                  ExpressionAttributeNames: {
                    '#c': 'common_activities'
                  },
                  TableName: "Groups",
                })
                .promise()
                .catch(error => {
                  cl(`caught error updating Group; error is: `, error);
                });
              let bbResponse = await setBBoard();
              updateReactData({
                bBoardList: bbResponse,
                deletePending: false,
                changesMade: true,
                spliceAt: -1
              }, true);
            }}
          >
          </AVAConfirm>
        }
        {reactData.showQuickSearch &&
          <QuickSearch
            reactData={reactData}
            updateReactData={updateReactData}
            options={{
              pickAndGo: true
            }}
            onClose={async (selections) => {
              if (selections.length > 0) {
                let recipientList = [];
                let recipientNameList = [];
                for (const this_selection of selections) {
                  recipientList.push(this_selection.person_id);
                  recipientNameList.push(this_selection.person_name);
                }
                let first_entry = reactData.bBoardList[reactData.group_id][reactData.selectedSection].generic_activities_list[0].group_list_index;
        //        let updatedLine = [`form.make_message~[default={recipientID:${person_id},recipientName:${person_name}]~[title=Send a message to ${sentenceCase(reactData.textInput[reactData.showQuickSearch].new)}]`];
                let updatedLine = [{
                  activity_code: 'form.make_message',
                  default: {
                    recipientID: recipientList,
                    recipientName: recipientNameList,
                  },
                  title: sentenceCase(reactData.textInput[reactData.showQuickSearch].new),
                }];
                if (reactData.needsHeader) {
                  updatedLine.unshift(`~~${reactData.selectedSection}`);
                }
                reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, ...updatedLine);
                await dbClient
                  .update({
                    Key: {
                      client_id: currentValues.customizationRecs.client_name.client_id,
                      group_id: reactData.group_id
                    },
                    UpdateExpression: 'set #c = :c',
                    ExpressionAttributeValues: {
                      ':c': reactData.bBoardList[reactData.group_id].groupRec.common_activities
                    },
                    ExpressionAttributeNames: {
                      '#c': 'common_activities'
                    },
                    TableName: "Groups",
                  })
                  .promise()
                  .catch(error => {
                    cl(`caught error updating Group; error is: `, error);
                  });
                reactData.textInput[reactData.selectedSection]['new'] = '';
              }
              let bbResponse = await setBBoard();
              updateReactData({
                bBoardList: bbResponse,
                textInput: reactData.textInput,
                addLink: false,
                showQuickSearch: false,
                needsHeader: false,
                changesMade: true
              }, true);
            }}
          />

        }
      </Box >
    </Box>
  );
};
