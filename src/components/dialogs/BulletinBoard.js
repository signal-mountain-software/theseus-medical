import React from 'react';
import { titleCase, sentenceCase, dbClient, cl } from '../../util/AVAUtilities';
import { getBulletinBoard } from '../../util/AVAObservations';
import AVATextInput from '../forms/AVATextInput';
import useSession from '../../hooks/useSession';

import { Typography } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import EditIcon from '@material-ui/icons/Edit';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import LinkIcon from '@material-ui/icons/Link';
import SaveIcon from '@material-ui/icons/Save';
import CancelIcon from '@material-ui/icons/Cancel';

import makeStyles from '@material-ui/core/styles/makeStyles';
import DeleteIcon from '@material-ui/icons/Delete';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import ExpandMoreIcon from '@material-ui/icons/Visibility';
import AVAConfirm from '../forms/AVAConfirm';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import AVAUploadFile from '../../util/AVAUploadFile';

const useStyles = makeStyles(theme => ({
  pageHead: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
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

export default ({ pClient, pGroup = 'ALL', onClose }) => {

  var rowsWritten;
  const { state } = useSession();

  const isMounted = React.useRef(false);
  const [reactData, setReactData] = React.useState({
    group_id: (Array.isArray(pGroup) ? ((pGroup.length > 0) ? pGroup[0] : 'ALL') : pGroup),
    initialized: false,
    bBoardList: {},
    deletePending: false,
    spliceAt: -1,
    confirmMessage: '',
    textInput: {},
    editMode: {},
    addAttachment: false,
    isError: false,
    addLink: false,
    needsHeader: false,
    changesMade: false
  });
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    if (isMounted.current) {
      setReactData((prevValues) => (Object.assign(
        prevValues,
        newData
      )));
      if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
    }
  };


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
          client_id: pClient,
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
      reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx].link_title = reactData.textInput[section_name][ndx];
      let updatedLine = `render.generic~[default=${rowObj.link_address}]~[title=${sentenceCase(reactData.textInput[section_name][ndx])}]`;
      reactData.bBoardList[reactData.group_id].groupRec.common_activities[rowObj.group_list_index] = updatedLine;
      await dbClient
        .update({
          Key: {
            client_id: pClient,
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
    let response = await getBulletinBoard(pClient, reactData.group_id);
    if (!response || (!response.hasOwnProperty(reactData.group_id))) {
      response[reactData.group_id] = {
        groupRec: {
          group_id: reactData.group_id,
          common_activities: []
        }
      };
    }
    if (Object.keys(response[reactData.group_id]).length === 1) {
      if (!response[reactData.group_id].groupRec.hasOwnProperty('common_activities')) {
        reactData.needsHeader = true;
        response[reactData.group_id].groupRec.common_activities = [];
      }
      if (!response[reactData.group_id].groupRec.common_activities.some(l => {
        return (l.startsWith('~~Community Information'));
      })) {
        reactData.needsHeader = true;
      }
      response[reactData.group_id]['Community Information'] = {
        section_sort: '',
        generic_activities_list: [{
          group_list_index: 0,
          link_address: 'https://www.avaseniorconnect.com',
          link_title: 'Sample - AVA Senior Connect Web Site'
        }]
      };
    }
    return response;
  }


  // **************************

  React.useEffect(() => {
    async function initialize() {
      let response = await setBBoard();
      updateReactData({
        bBoardList: response,
        initialized: true
      }, true);
    }
    isMounted.current = true;
    if (!reactData.initialized) {
      initialize();
    }
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (reactData.initialized &&
      <Dialog
        open={true || forceRedisplay}
        onClose={() => {
          if (reactData.changesMade) {
            sessionStorage.removeItem('AVASessionData');
            window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
          }
          else {
            onClose();
          }
        }}
        className={classes.pageHead}
        fullScreen
      >
        <Box
          display='flex'
          mb={0}
          flexDirection='row'
          className={classes.pageHead}
          justifyContent='flex-start'
          alignItems='center'
        >
          <Box
            display='flex'
            grow={1}
            style={{ width: '90%' }}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {`Update/Add Links`}
            </DialogContentText>
          </Box>
        </Box>

        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
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
                          <CloudUploadIcon
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
                                reactUpdObj.addAttachment = true;
                              }
                              updateReactData(reactUpdObj, true);
                            }}
                            edge="start"
                          />
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
                                reactUpdObj.addLink = true;
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
                                    reactData.textInput[section_name][aNdx] = aData.link_title;
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
                                      confirmMessage: `Are you sure you want to remove ${aData.link_title}?`,
                                      selectedObservation: aNdx,
                                      selectedSection: section_name,
                                      deletePending: true,
                                      spliceAt: aData.group_list_index
                                    }, true);
                                  }}
                                  edge="start"
                                />
                                <Box display='flex' flexDirection='row' flexGrow={1} justifyContent='flex-start' alignItems='center'
                                >
                                  <TextField
                                    className={classes.editInput}
                                    disabled
                                    InputProps={{ disableUnderline: true, className: classes.inputDisplay }}
                                    variant={'standard'}
                                    id={`prompt-${section_name}_${aNdx}`}
                                    key={`prompt-${section_name}_${aNdx}`}
                                    value={aData.link_title}
                                  />
                                  <ExpandMoreIcon
                                    classes={{ root: classes.rowButton }}
                                    onClick={() => {
                                      let nowJ = new Date().getTime();
                                      window.open(`${aData.link_address}?qt=${nowJ.toString()}`, aData.link_title);  // intentionally fall through to the message case
                                    }}
                                  />
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
                        client_id: pClient,
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
            {reactData.addAttachment &&
              <AVAUploadFile
                options={{
                  buttonText: ['Choose', 'Save & Continue'],
                  title: [reactData.textInput[reactData.selectedSection].new],
                  oneOnly: true,
                  calledFrom: 'BulletinBoard'
                }}
                onCancel={async () => {
                  dbClient
                    .put({
                      TableName: 'ActivityLog',
                      Item: {
                        timestamp: new Date().getTime(),
                        user_id: state.session.patient_id || 'error-no_patient_id',
                        activity_code: `BulletinBoard`,
                        activity_name: `Cancel/Exit tapped - no update to menu`,
                        cookieValues: 'n/a',
                        errorInfo: null,
                        AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
                      }
                    })
                    .promise()
                    .catch(putError => {
                      console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
                    });
                  updateReactData({
                    addAttachment: false
                  }, true);
                }}
                onLoad={async (response) => {
                  // where is the first entry on this section?
                  let first_entry = reactData.bBoardList[reactData.group_id][reactData.selectedSection].generic_activities_list[0].group_list_index;
                  let updatedLine = [`render.generic~[default=${response[0].fLoc}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`];
                  if (reactData.needsHeader) {
                    updatedLine.unshift(`~~${reactData.selectedSection}`);
                  }
                  reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, ...updatedLine);
                  let activityLogMsg = `Save tapped - loaded ${updatedLine}`;
                  let activityLogError = null;
                  await dbClient
                    .update({
                      Key: {
                        client_id: pClient,
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
                      activityLogMsg = `Save tapped but load failed for ${updatedLine}`;
                      activityLogError = error;
                    });
                  dbClient
                    .put({
                      TableName: 'ActivityLog',
                      Item: {
                        timestamp: new Date().getTime(),
                        user_id: state.session.patient_id || 'error-no_patient_id',
                        activity_code: `BulletinBoard`,
                        activity_name: activityLogMsg,
                        cookieValues: 'n/a',
                        errorInfo: activityLogError,
                        AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
                      }
                    })
                    .promise()
                    .catch(putError => {
                      console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
                    });
                  let bbResponse = await setBBoard();
                  reactData.textInput[reactData.selectedSection]['new'] = '';
                  updateReactData({
                    bBoardList: bbResponse,
                    textInput: reactData.textInput,
                    addAttachment: false,
                    needsHeader: false,
                    changesMade: true
                  }, true);
                }}
              />
            }
            {reactData.addLink &&
              <AVATextInput
                titleText={[reactData.textInput[reactData.selectedSection].new, 'Link this menu option to what web address?']}
                promptText={['Web address']}
                buttonText={'Add Link & Save'}
                onCancel={() => {
                  updateReactData({
                    addLink: false
                  }, true);
                }}
                onSave={async (response) => {
                  // where is the first entry on this section?
                  if (!response[0].startsWith('http')) {
                    response[0] = `https://${response[0]}`;
                  }
                  let first_entry = reactData.bBoardList[reactData.group_id][reactData.selectedSection].generic_activities_list[0].group_list_index;
                  let updatedLine = [`render.generic~[default=${response[0]}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`];
                  if (reactData.needsHeader) {
                    updatedLine.unshift(`~~${reactData.selectedSection}`);
                  }
                  reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, ...updatedLine);
                  await dbClient
                    .update({
                      Key: {
                        client_id: pClient,
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
                  reactData.textInput[reactData.selectedSection]['new'] = '';
                  updateReactData({
                    bBoardList: bbResponse,
                    textInput: reactData.textInput,
                    addLink: false,
                    needsHeader: false,
                    changesMade: true
                  }, true);
                }}
              />
            }
          </Box >
        </DialogContent>

        <DialogActions style={{ justifyContent: 'center' }}>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => {
              if (reactData.changesMade) {
                sessionStorage.removeItem('AVASessionData');
                window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
              }
              else {
                onClose();
              }
            }}
            startIcon={<PlaylistAddCheckIcon size="small" />}
          >
            {'Done'}
          </Button>
        </DialogActions>

      </Dialog>
    )
  );
};
