import React from 'react';
import useSession from '../../hooks/useSession';

import { dbClient, cl, makeArray, recordExists, getDb, array_in_array } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import AVATextInput from '../forms/AVATextInput';
import FormFillB from '../forms/FormFillB';

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
import PrintIcon from '@material-ui/icons/Print';

import makeStyles from '@material-ui/core/styles/makeStyles';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import ExpandMoreIcon from '@material-ui/icons/Visibility';

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

export default ({ client, formTypes = '*all', onClose }) => {

  const { state } = useSession();

  var rowsWritten;

  const formType_filter = makeArray(formTypes);

  const [reactData, setReactData] = React.useState({
    formType_filter: formType_filter.includes('*all') ? false : formType_filter,
    client_id: client || state.session.client_id,
    formList: [],
    initialized: false,
    docObj: {},
    deletePending: false,
    spliceAt: -1,
    confirmMessage: '',
    textInput: {},
    editMode: {},
    addAttachment: false,
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
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  async function setFormList() {
    // get all Form Types
    let formList = [];
    let formResult = await dbClient
      .query({
        TableName: 'Forms',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': reactData.client_id }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading Forms id ${error}`);
      });
    if (recordExists(formResult)) {
      formResult.Items.forEach(this_form => {
        if ((!this_form.hasOwnProperty('active') || this_form.active)
          && (!reactData.formType_filter || (reactData.formType_filter.includes(this_form.form_id)))) {
          formList.push(Object.assign((this_form), {
            isExpanded: false
          }));
        }
      });
      if (formList.length === 1) {
        formList[0].isExpanded = true;
      }
      else {
        formList.sort((a, b) => {
          if (a.sequence === b.sequence) {
            return ((a.form_name < b.form_name) ? 1 : -1);
          }
          else {
            return (((a.sequence || 10) < (b.sequence || 10)) ? 1 : -1);
          }
        });
      }
    }
    return { formList };
  }

  async function setDocObj({ formTypes, options }) {
    // get Documents for a form type
    // list will look in DocumentXRef 
    /*
    {
      person_id: '*status',
      document_id,
      status: 'work_in_progress',
      formType: reactData.form_id,
      last_update: new Date().getTime()
    },
    */
    let docObj = {};
    let allForms;
    let formList;
    if (!formTypes) {
      allForms = true;
    }
    else {
      formList = makeArray(formTypes);
      allForms = (formList.includes('*all'));
    }
    for (const this_form of reactData.formList) {
      if (allForms || formList.includes(this_form.form_id)) {
        docObj[this_form.form_id] = {
          docList: []
        };
      }
    }
    let docResult = await dbClient
      .query({
        TableName: 'DocumentXRef',
        KeyConditionExpression: 'person_id = :p',
        ExpressionAttributeValues: { ':p': '*status' }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading DocumentXRef status records ${error}`);
      });
    if (recordExists(docResult)) {
      for (const this_doc of docResult.Items) {
        if (allForms || formList.includes(this_doc.formType)) {
          let docRec = await getDocRec({
            document_id: this_doc.document_id,
            doc_status: this_doc.status
          });
          docObj[this_doc.formType].docList.push(
            Object.assign(docRec, this_doc)
          );
        }
      };
    }
    for (const this_form in docObj) {
      docObj[this_form].docList.sort((a, b) => {
        return ((a.last_update < b.last_update) ? 1 : -1);
      });
    }
    return { docObj };
  }

  const getDocRec = async ({ document_id, doc_status }) => {
    let docFile;
    if (doc_status === 'complete') {
      docFile = 'CompletedDocuments';
    }
    else if (doc_status === 'work_in_process') {
      docFile = 'DocumentsInProcess';
    }
    else if (doc_status === 'assigned') {
      docFile = 'DocumentsAssigned';
    }
    return await getDb({
      Key: {
        client_id: state.session.client_id,
        document_id: document_id
      },
      TableName: docFile
    });
  };

  // **************************

  React.useEffect(() => {
    async function initialize() {
      let { formList } = await setFormList();
      updateReactData({
        formList,
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
        onClose={() => {
          onClose();
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
              {`Document Management`}
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
              {reactData.formList.map((this_form, formNdx) => (
                <React.Fragment key={`form_list-${formNdx}`}>
                  { /* Form Name */}
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={`form_list-box-${formNdx}-titlebox`}
                    id={`form_list-box-${formNdx}-titlebox`}
                    paddingTop={2} paddingBottom={2}
                    marginTop={(rowsWritten > 0) ? 2 : 4}
                    justifyContent='space-between'
                    alignItems='center'
                  >
                    <Box
                      key={`formNameBox_${this_form.form_id}`}
                      display='flex' flexDirection='row'
                      flexGrow={1}
                      alignItems={'center'} justifyContent={'flex-start'}
                      onClick={async () => {
                        reactData.formList[formNdx].isExpanded = !reactData.formList[formNdx].isExpanded;
                        if (!reactData.docObj.hasOwnProperty(this_form.form_id)) {
                          let { docObj } = await setDocObj({ formTypes: [this_form.form_id] });
                          reactData.docObj[this_form.form_id] = docObj[this_form.form_id];
                        }
                        updateReactData({
                          formList: reactData.formList,
                          docObj: reactData.docObj
                        }, true);
                      }}
                    >
                      <Typography
                        key={`form_list-box-${formNdx}-title`}
                        id={`form_list-box-${formNdx}-title`}
                        style={AVATextStyle({ size: 1.3, bold: true, margin: { bottom: 0.8, top: 0 } })}
                      >
                        {this_form.form_name}
                      </Typography>
                      <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                        {rowsWritten++}
                      </Typography>
                    </Box>
                    <Box
                      key={`selectBox_${this_form.form_id}`}
                      display='flex' alignSelf='center' flexDirection='row'
                      alignItems={'center'} justifyContent={'center'}
                    >
                      <CloudUploadIcon
                        classes={{ root: classes.rowButton }}
                        size='medium'
                        aria-label="attach_icon"
                        onClick={() => {
                          updateReactData({
                            uploadDoc: true,
                            pendingInstructions: {
                              action: 'upload',
                              formType: this_form.form_id,
                              formName: this_form.form_name,
                              formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); })
                            }
                          }, true);
                        }}
                        edge="start"
                      />
                      <EditIcon
                        classes={{ root: classes.rowButton }}
                        size='medium'
                        aria-label="penciladd_icon"
                        onClick={() => {
                          updateReactData({
                            addDocPrompt: true,
                            pendingInstructions: {
                              action: 'addNew',
                              formType: this_form.form_id,
                              formName: this_form.form_name,
                              formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); })
                            }
                          }, true);
                        }}
                        edge="start"
                      />
                      <PrintIcon
                        classes={{ root: classes.rowButton }}
                        size='medium'
                        aria-label="penciladd_icon"
                        onClick={() => {
                          updateReactData({
                            printEmptyForm: true,
                            pendingInstructions: {
                              action: 'printEmpty',
                              formType: this_form.form_id,
                              formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); })
                            }
                          }, true);
                        }}
                        edge="start"
                      />
                    </Box>
                  </Box>
                  {this_form.isExpanded &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={`Group-title-box-${this_form.form_id}`}
                      id={`Group-title-box-${this_form.form_id}`}
                      minWidth={'95%'}
                      flexGrow={1}
                      marginBottom={5}
                      justifyContent='flex-start'
                      alignItems='flex-start'
                    >
                      <Box
                        key={`selectBox_${this_form.form_id}`}
                        display='flex' flexGrow={1} flexDirection='column'
                      >
                        { /* Existing items in this Section */}
                        {reactData.docObj[this_form.form_id].docList.map((this_doc, docNdx) => (
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                            key={`row_box_grandparent-${docNdx}`}
                          >
                            <Box display='flex' flexDirection='column' mb={'8px'} width='100%' textOverflow='ellipsis'
                              key={`row_box_parent-${docNdx}`}
                            >
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                                key={`row_box-${docNdx}`}
                              >
                                {this_doc.file_location &&
                                  <ExpandMoreIcon
                                    classes={{ root: classes.rowButton }}
                                    onClick={() => {
                                      let nowJ = new Date().getTime();
                                      window.open(`${this_doc.file_location}?qt=${nowJ.toString()}`, this_doc.document_title);
                                    }}
                                  />
                                }
                                {!this_doc.file_location && (this_doc.status === 'work_in_process') &&
                                  <EditIcon
                                    classes={{ root: classes.rowButton }}
                                    onClick={() => {
                                      updateReactData({
                                        editDoc: true,
                                        pendingInstructions: {
                                          action: 'edit',
                                          formType: this_form.form_id,
                                          formName: this_form.form_name,
                                          formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); }),
                                          document_id: this_doc.document_id,
                                          person_id: this_doc.pertains_to,
                                          docIndex: docNdx
                                        }
                                      }, true);
                                    }}
                                  />
                                }
                                <TextField
                                  className={classes.editInput}
                                  disabled
                                  InputProps={{ disableUnderline: true, className: classes.inputDisplay }}
                                  variant={'standard'}
                                  id={`prompt-${this_doc.document_id}_${docNdx}`}
                                  key={`prompt-${this_doc.document_id}_${docNdx}`}
                                  value={this_doc.document_title}
                                />
                              </Box>
                            </Box>
                          </Box>
                        ))
                        }
                      </Box>
                    </Box>
                  }
                </React.Fragment>
              ))}
            </Box>
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
                  let first_entry = reactData.docList[reactData.group_id][reactData.selectedSection].document_list[0].group_list_index;
                  let updatedLine = [`render.generic~[default=${response[0].fLoc}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`];
                  if (reactData.needsHeader) {
                    updatedLine.unshift(`~~${reactData.selectedSection}`);
                  }
                  reactData.docList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, ...updatedLine);
                  await dbClient
                    .update({
                      Key: {
                        client_id: reactData.client_id,
                        group_id: reactData.group_id
                      },
                      UpdateExpression: 'set #c = :c',
                      ExpressionAttributeValues: {
                        ':c': reactData.docList[reactData.group_id].groupRec.common_activities
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
                  let bbResponse = await setFormList();
                  reactData.textInput[reactData.selectedSection]['new'] = '';
                  updateReactData({
                    docList: bbResponse,
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
                  let first_entry = reactData.docList[reactData.group_id][reactData.selectedSection].document_list[0].group_list_index;
                  let updatedLine = [`render.generic~[default=${response[0]}]~[title=${reactData.textInput[reactData.selectedSection]['new']}]`];
                  if (reactData.needsHeader) {
                    updatedLine.unshift(`~~${reactData.selectedSection}`);
                  }
                  reactData.docList[reactData.group_id].groupRec.common_activities.splice(first_entry, 0, ...updatedLine);
                  await dbClient
                    .update({
                      Key: {
                        client_id: reactData.client_id,
                        group_id: reactData.group_id
                      },
                      UpdateExpression: 'set #c = :c',
                      ExpressionAttributeValues: {
                        ':c': reactData.docList[reactData.group_id].groupRec.common_activities
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
                  let bbResponse = await setFormList();
                  reactData.textInput[reactData.selectedSection]['new'] = '';
                  updateReactData({
                    docList: bbResponse,
                    textInput: reactData.textInput,
                    addLink: false,
                    needsHeader: false,
                    changesMade: true
                  }, true);
                }}
              />
            }
            {reactData.uploadDoc &&
              <AVATextInput
                titleText={`About this Document`}
                promptText={['[select]Who does this pertain to?']}
                valueText={[
                  '',
                ]}
                options={{ allowAttach: true, maxAttach: 1 }}
                selectionList={[
                  state.accessList[state.session.client_id].list.filter(p => {
                    return (!reactData.pendingInstructions.formRec.valid_for
                      || reactData.pendingInstructions.formRec.valid_for.includes('ALL')
                      || (array_in_array(p.groups, reactData.pendingInstructions.formRec.valid_for)));
                  }).map(a => {
                    const label = (!a.name ? a.display_name : (`${a.name.first} ${a.name.last}`).trim());
                    return {
                      label,
                      value: a.person_id
                    };
                  })
                ]}
                buttonText={'Load'}
                onCancel={() => {
                  updateReactData({
                    uploadDoc: false
                  }, true);
                }}
                onSave={async (response) => {
                  const [selectedPerson, selectedName] = response[0].split('%%');
                  const nowTime = makeDate(new Date());
                  const document_id = `${response[0]}_${reactData.pendingInstructions.formType}_${nowTime.timestamp}`;
                  const document_title = `${reactData.pendingInstructions.formName} for ${selectedName} - ${nowTime.absolute}`;
                  let goodPut = true;
                  const completedDocRec = {
                    client_id: state.session.client_id,
                    document_id,
                    document_title,
                    pertains_to: selectedPerson,
                    date_completed: nowTime.timestamp,
                    save_info: {
                      s3Bucket: 'theseus-medical-storage',
                      s3Key: response[1].split('/').pop(),
                      s3Location: response[1]
                    },
                    file_location: response[1]
                  };
                  await dbClient
                    .put({
                      Item: completedDocRec,
                      TableName: 'CompletedDocuments'
                    })
                    .promise()
                    .catch(error => {
                      cl(`Bad put to CompletedDocuments. Error is: ${error}`);
                      goodPut = false;
                    });
                  if (goodPut) {
                    await dbClient
                      .put({
                        Item: {
                          person_id: state.session.user_id,
                          document_id,
                          role: 'completed_by',
                        },
                        TableName: 'DocumentXRef'
                      })
                      .promise()
                      .catch(error => {
                        const messageText = `Bad put to DocumentXRef (completed_by). Error is: ${error}`;
                        cl(messageText);
                        goodPut = false;
                      });
                    await dbClient
                      .put({
                        Item: {
                          person_id: selectedPerson,
                          document_id,
                          role: 'pertains_to',
                        },
                        TableName: 'DocumentXRef'
                      })
                      .promise()
                      .catch(error => {
                        const messageText = `Bad put to DocumentXRef (pertains_to). Error is: ${error}`;
                        cl(messageText);
                        goodPut = false;
                      });
                    var docXRefRec = {
                      person_id: '*status',
                      document_id,
                      status: 'complete',
                      formType: reactData.pendingInstructions.formType,
                      last_update: nowTime.timestamp
                    };
                    await dbClient
                      .put({
                        Item: docXRefRec,
                        TableName: 'DocumentXRef'
                      })
                      .promise()
                      .catch(error => {
                        const messageText = `Bad put to DocumentXRef (status). Error is: ${error}`;
                        cl(messageText);
                        goodPut = false;
                      });
                  }
                  reactData.docObj[reactData.pendingInstructions.formType].docList.unshift(
                    Object.assign(docXRefRec, completedDocRec)
                  );
                  updateReactData({
                    docObj: reactData.docObj,
                    uploadDoc: false,
                    pendingInstructions: false
                  }, true);
                }}
              />
            }
            {reactData.addDocPrompt &&
              <AVATextInput
                titleText={`About this Document`}
                promptText={['[select]Who does this pertain to?']}
                valueText={[
                  '',
                ]}
                selectionList={[
                  state.accessList[state.session.client_id].list.filter(p => {
                    return (!reactData.pendingInstructions.formRec.valid_for
                      || reactData.pendingInstructions.formRec.valid_for.includes('ALL')
                      || (array_in_array(p.groups, reactData.pendingInstructions.formRec.valid_for)));
                  }).map(a => {
                    const label = (!a.name ? a.display_name : (`${a.name.first} ${a.name.last}`).trim());
                    return {
                      label,
                      value: a.person_id
                    };
                  })
                ]}
                buttonText={'Load'}
                onCancel={() => {
                  updateReactData({
                    addDocPrompt: false
                  }, true);
                }}
                onSave={async (response) => {
                  reactData.pendingInstructions.selectedPerson = response[0];
                  updateReactData({
                    addDocPrompt: false,
                    addDocForm: true,
                    pendingInstructions: reactData.pendingInstructions
                  }, true);
                }}
              />
            }
            {reactData.addDocForm &&
              <FormFillB
                request={{
                  form_id: reactData.pendingInstructions.formType,
                  person_id: reactData.pendingInstructions.selectedPerson,
                  mode: 'new'

                }}
                onClose={(ignore_me, statusObj) => {
                  if (statusObj.document_status !== 'aborted') {
                    if (!reactData.docObj.hasOwnProperty(reactData.pendingInstructions.formType)) {
                      reactData.docObj[reactData.pendingInstructions.formType] = {
                        docList: []
                      };
                    }
                    reactData.docObj[reactData.pendingInstructions.formType].docList.unshift(
                      {
                        document_id: statusObj.document_id,
                        document_title: statusObj.document_title,
                        formType: reactData.pendingInstructions.formType,
                        last_update: new Date().getTime(),
                        status: statusObj.document_status
                      }
                    );
                  }
                  updateReactData({
                    docObj: reactData.docObj,
                    addDocPrompt: false,
                    addDocForm: false,
                    pendingInstructions: false
                  }, true);
                }}
              />
            }
            {reactData.printEmptyForm &&
              <FormFillB
                request={{
                  form_id: reactData.pendingInstructions.formType,
                  mode: 'printEmpty'
                }}
                onClose={() => {
                  updateReactData({
                    printEmptyForm: false,
                  }, true);
                }}
              />
            }
            {reactData.editDoc &&
              <FormFillB
                request={{
                  document_id: reactData.pendingInstructions.document_id,
                  person_id: reactData.pendingInstructions.person_id,
                }}
                onClose={(ignore_me, statusObj) => {
                  if (statusObj.document_status !== 'aborted') {
                    if (!reactData.docObj.hasOwnProperty(reactData.pendingInstructions.formType)) {
                      reactData.docObj[reactData.pendingInstructions.formType] = {
                        docList: []
                      };
                    }
                    reactData.docObj[reactData.pendingInstructions.formType].docList[reactData.pendingInstructions.docIndex] =
                      Object.assign(
                        reactData.docObj[reactData.pendingInstructions.formType].docList[reactData.pendingInstructions.docIndex],
                        statusObj.recWritten,
                        { last_update: new Date().getTime(), status: statusObj.document_status }
                      );
                  }
                  updateReactData({
                    docObj: reactData.docObj,
                    editDoc: false,
                    pendingInstructions: false
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
