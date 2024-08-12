import React from 'react';
import { titleCase, dbClient, cl } from '../../util/AVAUtilities';
import { getBulletinBoard } from '../../util/AVAObservations';
import AVATextInput from '../forms/AVATextInput';

import { Typography } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import LinkIcon from '@material-ui/icons/Link';

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
    width: '80%',
    marginLeft: 0,
    marginBottom: '10px',
    marginRight: '32px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
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

export default ({ pClient, inGroup = 'ALL', onClose }) => {

  var rowsWritten;

  const [reactData, setReactData] = React.useState({
    group_id: (Array.isArray(inGroup) ? ((inGroup.length > 0) ? inGroup[0] : 'ALL') : 'ALL'),
    initialized: false,
    bBoardList: {},
    deletePending: false,
    spliceAt: -1,
    confirmMessage: '',
    textInput: {},
    editMode: {},
    addAttachment: false,
    addLink: false
  });
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };


  async function onCheckEnter(event, section_name, ndx = 'new') {
    if (event.key === 'Enter') {
      await saveNewTitle(section_name, ndx);
    }
  };

  const handleChangeTextInput = (inputValue, section_name, ndx = 'new') => {
    if (!reactData.textInput.hasOwnProperty(section_name)) {
      reactData.textInput[section_name] = [];
    }
    reactData.textInput[section_name][ndx] = inputValue;
    updateReactData({
      textInput: reactData.textInput
    }, true);
  };

  async function saveNewTitle(section_name, ndx = 'new') {
    if (ndx !== 'new') {
      let rowObj = reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx];
      reactData.bBoardList[reactData.group_id][section_name].generic_activities_list[ndx].link_title = reactData.textInput[section_name][ndx];
      let updatedLine = `render.generic~[default=${rowObj.link_address}]~[title=${reactData.textInput[section_name][ndx]}]`;
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
        editMode: reactData.editMode
      }, true);
    }
  }

  async function setBBoard() {
    let response = await getBulletinBoard(pClient, reactData.group_id);
    if (Object.keys(response[reactData.group_id]).length === 1) {
      response[reactData.group_id]['Community Information'] = {
        section_sort: '',
        generic_activities_list: [{
          group_list_index: 0,
          link_address: 'https://www.avaseniorconnect.com',
          link_title: 'AVA Senior Connect Web Site'
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
    if (!reactData.initialized) {
      initialize();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (reactData.initialized &&
      <Dialog
        open={true || forceRedisplay}
        onClose={onClose}
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
                      {titleCase(section_name)}
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
                      >
                        <TextField
                          className={classes.freeInput}
                          variant={'standard'}
                          key={`inputtextprompt_${section_name}`}
                          id={`inputtextprompt_${section_name}`}
                          helperText={'Title for a New Item'}
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
                        {reactData.textInput.hasOwnProperty(section_name)
                          && reactData.textInput[section_name]['new']
                          && reactData.textInput[section_name]['new'].length > 0
                          &&
                          <Box
                            key={`selectBox_${section_name}`}
                            display='flex' mb={2} flexGrow={1} flexDirection='row'
                          >
                            <IconButton
                              aria-label="attach_icon"
                              onClick={() => {
                                updateReactData({
                                  addAttachment: true,
                                  selectedSection: section_name
                                }, true);
                              }}
                              edge="start"
                            >
                              {<CloudUploadIcon />}
                            </IconButton>
                            <IconButton
                              aria-label="attach_icon"
                              onClick={() => {
                                updateReactData({
                                  addLink: true,
                                  selectedSection: section_name
                                }, true);
                              }}
                              edge="start"
                            >
                              {<LinkIcon />}
                            </IconButton>
                          </Box>
                        }
                      </Box>
                      { /* Existing items in this Section */}
                      {reactData.bBoardList[reactData.group_id][section_name].generic_activities_list.map((aData, aNdx) => (
                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                          key={`row_box_grandparent-${aNdx}`}
                        >
                          <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'
                            key={`row_box_parent-${aNdx}`}
                          >
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                              key={`row_box-${aNdx}`}
                            >
                              <IconButton
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
                              >
                                {<EditIcon />}
                              </IconButton>
                              <IconButton
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
                              >
                                <DeleteIcon />
                              </IconButton>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                              >
                                {(reactData.editMode.hasOwnProperty(section_name) && reactData.editMode[section_name][aNdx])
                                  ?
                                  <TextField
                                    className={classes.idText}
                                    id={`prompt-${section_name}_${aNdx}`}
                                    key={`prompt-${section_name}_${aNdx}`}
                                    multiline
                                    value={reactData.textInput[section_name][aNdx] || ''}
                                    onChange={(event) => {
                                      handleChangeTextInput(event.target.value, section_name, aNdx);
                                    }}
                                    onKeyPress={async (event) => {
                                      await onCheckEnter(event, section_name, aNdx);
                                    }}
                                    autoComplete='off'
                                  />
                                  :
                                  <Typography style={AVATextStyle({
                                    margin: { top: 0, right: 2 },
                                  })}>
                                    {aData.link_title}
                                  </Typography>
                                }
                                <ExpandMoreIcon
                                  onClick={() => {
                                    let nowJ = new Date().getTime();
                                    window.open(`${aData.link_address}?qt=${nowJ.toString()}`, aData.link_title);  // intentionally fall through to the message case
                                  }}
                                />
                              </Box>
                            </Box>
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
                  updateReactData({
                    bBoardList: reactData.bBoardList,
                    deletePending: false,
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
                  title: 'Link this menu option to what file?',
                  oneOnly: true
                }}
                onCancel={() => {
                  updateReactData({
                    addAttachment: false
                  }, true);
                }}
                onLoad={async (response) => {
                  // where is the first entry on this section?
                  let first_entry = reactData.bBoardList[reactData.group_id][reactData.selectedSection].generic_activities_list[0].group_list_index;
                  let updatedLine = `render.generic~[default=${response[0].fLoc}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`;
                  reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, updatedLine);
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
                    addAttachment: false
                  }, true);
                }}
              />
            }
            {reactData.addLink &&
              <AVATextInput
                titleText={'Link this menu option to what web address?'}
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
                  let updatedLine = `render.generic~[default=${response[0]}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`;
                  reactData.bBoardList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, updatedLine);
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
                    addLink: false
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
            onClick={onClose}
            startIcon={<PlaylistAddCheckIcon size="small" />}
          >
            {'Done'}
          </Button>
        </DialogActions>

      </Dialog>
    )
  );
};
