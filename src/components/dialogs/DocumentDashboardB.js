import React from 'react';
import useSession from '../../hooks/useSession';

import { dbClient, cl, makeArray, recordExists, getDb, array_in_array, listFromArray, switchActiveAccount } from '../../util/AVAUtilities';
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
import DeleteIcon from '@material-ui/icons/Delete';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import PrintIcon from '@material-ui/icons/Print';

import makeStyles from '@material-ui/core/styles/makeStyles';
import ExpandMoreIcon from '@material-ui/icons/Visibility';
import TextureIcon from '@material-ui/icons/Texture';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';

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

export default ({ client, formTypes = '*all', options, onClose }) => {

  const { state } = useSession();

  var rowsWritten;
  var completed_and_displayed = [];

  const formType_filter = makeArray(formTypes);

  const [reactData, setReactData] = React.useState({
    filter: {
      formType: formType_filter.includes('*all') ? false : formType_filter,
      title_words: false,
      document_status: false,
      time_frame: false,
      person: false
    },
    filtered_results: !formType_filter.includes('*all'),
    filter_description: 'Documents',
    client_id: client || state.session.client_id,
    formList: [],
    initialized: false,
    docObj: {},
    options: options || {},
    deletePending: false,
    recentlyExpandedForm: null,
    textInput: {},
    setFilter: false,
    documentStatusOptions: [
      { label: 'Complete', value: 'complete%%Complete' },
      { label: 'In Process', value: 'work_in_process%%In Process' },
      { label: 'Not Started', value: 'assigned%%Not Started' },
    ],
    filterTimeFrames: [
      { label: 'This Week', value: 'sunday - 7' },
      { label: 'Last 10 days', value: 'today - 10' },
      { label: 'This Month', value: '1st' },
    ]
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

  const formRowRef = React.useRef(null);

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
        if (this_form.active || reactData.options.viewInactive) {
          formList.push(Object.assign({}, (this_form), {
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

  async function printAll({ document_list }) {
    let w = [];
    document_list.forEach((this_document, ndx) => {
      try {
        w[ndx] = window.open(
          this_document,
          `Print Document ${ndx}`,
          `name=Print Document - ${ndx + 1} of ${document_list.length}, left=${(ndx * 40) + 10}, top=${(ndx * 20) + 10}, height=400, width=600`
        );
        w[ndx].addEventListener("afterprint", (e) => {
          console.log("After print");
        });
        w[ndx].print();
        w[ndx].focus();
        w[ndx].onafterprint = (e) => {
          console.log("onAfterprint");
        };
      }
      catch (er) {
        console.log(`caught error ${er} on ${ndx}`);
      }
    });
  }

  async function setDocObj({ formTypes, options }) {
    // get Documents for a form type
    // list will look in DocumentXRef 
    /*
    {
      person_id: '*status',
      client_id: state.session.client_id,
      document_id,
      status: 'work_in_process',
      formType: reactData.form_id,
      last_update: new Date().getTime()
    },
    */
    let docObj = {};
    let formList = [];
    if (formTypes) {
      formList = makeArray(formTypes);
    }
    for (const this_form of formList) {
      docObj[this_form.form_id] = {
        docList: []
      };
    }
    let docResult = await dbClient
      .query({
        TableName: 'DocumentXRef',
        KeyConditionExpression: 'person_id = :p',
        ExpressionAttributeValues: { ':p': '*status', ':c': state.session.client_id },
        FilterExpression: 'client_id = :c'
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
        if (this_doc.status !== 'deleted') {
          let docRec = await getDocRec({
            document_id: this_doc.document_id,
            doc_status: this_doc.status
          });
          if (docRec && (docObj.hasOwnProperty(this_doc.formType))) {
            docObj[this_doc.formType].docList.push(
              Object.assign({}, docRec, this_doc)
            );
          }
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

  React.useEffect(() => {
    if (formRowRef && formRowRef.current) {
      formRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [reactData.recentlyExpandedForm, formRowRef]);

  const okToShowForm = (this_form) => {
    if (!reactData.filtered_results) { return true; }
    if (!reactData.filter.formType || (reactData.filter.formType.includes(this_form.form_id))) {
      return reactData.docObj[this_form.form_id].docList.some(this_doc => {
        return okToShowDoc(this_doc);
      });
    }
    return false;
  };

  const okToShowDoc = (this_doc) => {
    if (!reactData.filtered_results) { return true; }
    /* 
      title_words: false,
      document_status: false,
      time_frame: false,
      person: false
    */
    if (reactData.filter.title_words && (!(this_doc.document_title || this_doc.title || ' ').toLowerCase().includes(reactData.filter.title_words))) {
      return false;
    }
    if (reactData.filter.document_status && (!reactData.filter.document_status.includes(this_doc.status))) {
      return false;
    }
    if (reactData.filter.time_frame && (this_doc.last_update < reactData.filter.time_frame.timestamp)) {
      return false;
    }
    if (reactData.filter.person && (this_doc.pertains_to !== reactData.filter.person.id)) {
      return false;
    }
    return true;
  };


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
        formList
      }, false);
      let { docObj } = await setDocObj({ formTypes: formList });
      updateReactData({
        formList,
        docObj,
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
            {reactData.filtered_results &&
              <Typography
                key={`filter_words-box-title`}
                id={`filter_words-box-title`}
                style={AVATextStyle({ size: 1, margin: { left: 1, bottom: 0.8, top: 0 } })}
              >
                {reactData.filter_description}
              </Typography>
            }
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
                {completed_and_displayed = []}
              </Typography>
              {reactData.formList.map((this_form, formNdx) => (
                (okToShowForm(this_form) &&
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
                      ref={(this_form.form_id === reactData.recentlyExpandedForm) ? formRowRef : null}
                    >
                      <Box
                        key={`formNameBox_${this_form.form_id}`}
                        display='flex' flexDirection='row'
                        flexGrow={1}
                        alignItems={'center'} justifyContent={'flex-start'}
                        onClick={async () => {
                          reactData.formList[formNdx].isExpanded = !reactData.formList[formNdx].isExpanded;
                          updateReactData({
                            formList: reactData.formList,
                            docObj: reactData.docObj,
                            recentlyExpandedForm: this_form.form_id
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
                            if (this_form?.options?.anonymous) {
                              updateReactData({
                                addDocPrompt: false,
                                addDocForm: true,
                                pendingInstructions: {
                                  action: 'addNew',
                                  formType: this_form.form_id,
                                  selectedPerson: null,
                                  formName: this_form.form_name,
                                  formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); })
                                }
                              }, true);
                            }
                            else {
                              updateReactData({
                                addDocPrompt: true,
                                pendingInstructions: {
                                  action: 'addNew',
                                  formType: this_form.form_id,
                                  formName: this_form.form_name,
                                  formRec: reactData.formList.find(l => { return (l.form_id === this_form.form_id); })
                                }
                              }, true);
                            }
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
                    {(this_form.isExpanded || reactData.filtered_results) &&
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
                            (okToShowDoc(this_doc) &&
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                                key={`row_box_grandparent-${docNdx}`}
                              >
                                {(this_doc.status === 'complete') && (reactData.filtered_results) &&
                                  <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                                    {completed_and_displayed.push(this_doc.file_location || this_doc.location)}
                                  </Typography>
                                }
                                <Box display='flex' flexDirection='column' mb={'8px'} width='100%' textOverflow='ellipsis'
                                  key={`row_box_parent-${docNdx}`}
                                >
                                  <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                                    key={`row_box-${docNdx}`}
                                  >
                                    {this_doc.file_location &&
                                      <React.Fragment>
                                        <ExpandMoreIcon
                                          classes={{ root: classes.rowButton }}
                                          onClick={() => {
                                            let nowJ = new Date().getTime();
                                            window.open(`${this_doc.file_location}?qt=${nowJ.toString()}`, this_doc.document_title);
                                          }}
                                        />
                                        <PrintIcon
                                          classes={{ root: classes.rowButton }}
                                          onClick={() => {
                                            printAll({ document_list: [this_doc.file_location || this_doc.location] });
                                          }}
                                        />
                                      </React.Fragment>
                                    }
                                    {!this_doc.file_location &&
                                      <React.Fragment>
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
                                                document_title: this_doc.title || this_doc.document_title,
                                                person_id: this_doc.pertains_to,
                                                docIndex: docNdx
                                              }
                                            }, true);
                                          }}
                                        />
                                        <DeleteIcon
                                          classes={{ root: classes.rowButton }}
                                          onClick={async () => {
                                            await dbClient
                                              .update({
                                                Key: {
                                                  person_id: '*status',
                                                  document_id: this_doc.document_id
                                                },
                                                UpdateExpression: 'set #s = :d',
                                                ExpressionAttributeValues: { ':d': 'deleted' },
                                                ExpressionAttributeNames: { '#s': 'status' },
                                                TableName: 'DocumentXRef'
                                              })
                                              .promise()
                                              .catch(error => { cl(`caught error updating Documents; error is: `, error); });
                                            reactData.docObj[this_form.form_id].docList.splice(docNdx, 1);
                                            updateReactData({
                                              docObj: reactData.docObj
                                            }, true);
                                          }}
                                        />
                                      </React.Fragment>
                                    }
                                    <TextField
                                      className={classes.editInput}
                                      disabled
                                      InputProps={{ disableUnderline: true, className: classes.inputDisplay }}
                                      variant={'standard'}
                                      id={`prompt-${this_doc.document_id}_${docNdx}`}
                                      key={`prompt-${this_doc.document_id}_${docNdx}`}
                                      value={this_doc.document_title || this_doc.title}
                                    />
                                  </Box>
                                </Box>
                              </Box>
                            )
                          ))
                          }
                        </Box>
                      </Box>
                    }
                  </React.Fragment>
                )
              ))}
              {(rowsWritten === 0) &&
                <Box
                  display='flex'
                  marginTop={3}
                  flexDirection='row'
                  justifyContent='center'
                  alignItems='center'
                >
                  <Typography
                    key={`nothing_found`}
                    id={`nothing_found`}
                    style={AVATextStyle({ size: 1.2, bold: true, margin: { left: 1, bottom: 0.8, top: 0 } })}
                  >
                    {reactData.filtered_results
                      ? `No Documents match that search`
                      : `Nothing found`
                    }
                  </Typography>
                </ Box>
              }
            </Box>
            {reactData.setFilter &&
              <AVATextInput
                titleText={'Filter Entries'}
                promptText={['Words in Title', '[selectmulti]Document Status', '[select]Pertains To', '[select]Time Frame']}
                buttonText={['Set Filter', 'Cancel/Go Back', 'Clear Filter',]}
                valueText={[
                  reactData.filter.title_words,
                  (reactData.filter.document_status
                    ? reactData.documentStatusOptions
                      .filter(d => { return (reactData.filter.document_status.includes(d.value.split('%%')[0])); })
                      .map(d => { return d.value; })
                    : false
                  ),
                  (reactData.filter.person
                    ? `${reactData.filter.person.id}%%${reactData.filter.person.name}`
                    : false
                  ),
                  (reactData.filter.time_frame
                    ? reactData.filter.time_frame.selectValue
                    : false
                  )
                ]}
                selectionList={[
                  '',
                  reactData.documentStatusOptions,
                  state.accessList[state.session.client_id].list.map(a => {
                    const label = (!a.name ? a.display_name : (`${a.name.last} ${a.name.first}`).trim());
                    return {
                      label,
                      value: `${a.person_id}%%${label}`
                    };
                  }),
                  reactData.filterTimeFrames
                ]}
                onCancel={() => {
                  updateReactData({
                    setFilter: false
                  }, true);
                }}
                onSave={async (response, buttonPressed) => {
                  let reactUpdObj = {
                    setFilter: false,
                    filter: {
                      formType: reactData.filter.formType,
                      title_words: false,
                      document_status: false,
                      time_frame: false,
                      person: false
                    },
                    filtered_results: !!reactData.filter.formType,
                    filter_description: 'Documents'
                  };
                  if (buttonPressed !== 2) {
                    if (!!response[0]) {
                      reactUpdObj.filter.title_words = response[0].toLowerCase();
                      reactUpdObj.filtered_results = true;
                    }
                    if (!!response[1]) {
                      reactUpdObj.filter.document_status = [];
                      let wordList = [];
                      makeArray(response[1]).forEach(status_response => {
                        let [status_key, status_descripition] = status_response.split('%%');
                        reactUpdObj.filter.document_status.push(status_key);
                        wordList.push(status_descripition);
                      });
                      reactUpdObj.filter_description = `${listFromArray(wordList)} ${reactUpdObj.filter_description}`;
                      reactUpdObj.filtered_results = true;
                    }
                    if (!!response[2]) {
                      let [id, name] = response[2].split('%%');
                      reactUpdObj.filter.person = {
                        id,
                        name
                      };
                      reactUpdObj.filtered_results = true;
                      reactUpdObj.filter_description += ` for ${name}`;
                    }
                    if (!!response[3]) {
                      let sinceDate = makeDate(response[3], { noFuture: true });
                      reactUpdObj.filter.time_frame = Object.assign({}, sinceDate, { selectValue: response[3] });
                      reactUpdObj.filtered_results = true;
                      reactUpdObj.filter_description += ` since ${sinceDate.absolute}`;
                    }
                  }
                  updateReactData(reactUpdObj, true);
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
                    formType: reactData.form_id,
                    formType_date: `${reactData.form_id}%%${new Date().getTime()}`,
                    fields: reactData.fields,
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
                      client_id: state.session.client_id,
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
                    Object.assign({}, docXRefRec, completedDocRec)
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
                onClose={async(ignore_me, statusObj) => {
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
                        file_location: statusObj.file_location || null,
                        formType: reactData.pendingInstructions.formType,
                        last_update: new Date().getTime(),
                        status: statusObj.document_status
                      }
                    );
                    if (statusObj.nextAction) {
                      if (statusObj.nextAction.action === 'switchTo') {
                        await switchActiveAccount(
                          state.session,
                          state.session.client_id,
                          {
                            id: statusObj.nextAction.target,
                          }
                        );
                      }
                      else if (statusObj.nextAction.action === 'logIn') {
                        sessionStorage.removeItem('AVASessionData');
                        let jumpTo = window.location.href.replace('refresh', 'theseus');
                        window.location.replace(jumpTo);
                      }
                    }
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
                  document_title: reactData.pendingInstructions.document_title,
                  person_id: reactData.pendingInstructions.person_id,
                }}
                onClose={async (ignore_me, statusObj) => {
                  if (statusObj.document_status !== 'aborted') {
                    if (!reactData.docObj.hasOwnProperty(reactData.pendingInstructions.formType)) {
                      reactData.docObj[reactData.pendingInstructions.formType] = {
                        docList: []
                      };
                    }
                    if (statusObj.recWritten) {
                      reactData.docObj[reactData.pendingInstructions.formType].docList[reactData.pendingInstructions.docIndex] =
                        Object.assign({},
                          reactData.docObj[reactData.pendingInstructions.formType].docList[reactData.pendingInstructions.docIndex],
                          statusObj.recWritten || {},
                          { last_update: new Date().getTime(), status: statusObj.document_status }
                        );
                    }
                    if (statusObj.nextAction) {
                      if (statusObj.nextAction.action === 'switchTo') {
                        await switchActiveAccount(
                          state.session,
                          state.session.client_id,
                          {
                            id: statusObj.nextAction.target,
                          }
                        );
                      }
                    }
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
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={() => {
              onClose();
            }}
          >
            {'Exit'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'gray', color: 'black' }}
            size='small'
            startIcon={<TextureIcon fontSize="small" />}
            onClick={() => {
              updateReactData({
                setFilter: true,
              }, true);
            }}
          >
            {'Filter'}
          </Button>
          {(completed_and_displayed.length > 0) &&
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'blue', color: 'white', paddingRight: (reactData.isMobile ? '4px' : '') }}
              size='small'
              onClick={async () => {
                await printAll({ document_list: completed_and_displayed });
              }}
              startIcon={<PrintIcon size="small" />}
            >
              {`Print ${completed_and_displayed.length}`}
            </Button>
          }
        </DialogActions>

      </Dialog>
    )
  );
};
