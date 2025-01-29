import React from 'react';
import useSession from '../../hooks/useSession';

import { dbClient, recordExists, cl } from '../../util/AVAUtilities';
import { AVATextStyle } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';
import { documentDueDate } from '../../util/AVADocuments';
import { getMemberList } from '../../util/AVAGroups';

import { Typography, Box } from '@material-ui/core/';

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import EditIcon from '@material-ui/icons/Edit';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import DynamicFeedIcon from '@material-ui/icons/DynamicFeed';

import FormFillB from '../forms/FormFillB';

export default ({ currentValues, reactData, updateReactData }) => {

  const { state } = useSession();
  const isMounted = React.useRef(false);

  let checkCircleDisplayed = false;
  let redPencilDisplayed = false;
  let orangePencilDisplayed = false;
  let pencilDisplayed = false;
  let addAmendmentDisplayed = false;
  let historyAmendmentDisplayed = false;
  let circleDisplayed = false;
  let orangeCircleDisplayed = false;
  let redCircleDisplayed = false;
  let historyDisplayed = false;

  React.useEffect(() => {
    async function initialize() {
      let myFormListObj = {};
      const { due_date, formRec } = await documentDueDate(state.session.client_id, reactData.selectedForm);
      if (formRec.options?.restricted_access && !reactData.administrative_account) {
        if (formRec.options.restricted_access === 'admin_only') {
          return;    // not authorized
        }
        if (formRec.options.restricted_access === 'view_only') {
          reactData.viewOnly_forms = true;
        }
      }
      // what groups (if any) require this form?
      let groupRecs = await dbClient
        .query({
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': reactData.client_id },
          TableName: "Groups"
        })
        .promise()
        .catch(error => {
          cl(`***ERR reading Groups*** caught error is: ${error}`);
        });
      if (!recordExists(groupRecs)) {
        return;
      }
      // and build myFormListObj with one object each person in any of those groups
      for (let this_group of groupRecs.Items) {
        if (this_group.forms && this_group.forms.includes(reactData.selectedForm)) {
          let memberInfo = await getMemberList(this_group.group_id, state.session.client_id);
          for (let this_person of memberInfo) {
            if (myFormListObj.hasOwnProperty(this_person.person_id)) { continue; }
            myFormListObj[this_person.person_id] = {
              why: this_group.group_name,
              person_id: this_person.person_id,
              person_name: `${this_person.name.first} ${this_person.name.last}`,
              options: formRec.options || {},
              dueDate: due_date,
              view_only: formRec.view_only,
              wipDocs: [],
              assignedDocs: [],
              completedDocs: [],
              isUpdating: false,
              isAmending: false
            };
          }
        }
      }
      // get all Documents for this client and form_type
      let allDocs = await dbClient
        .query({
          KeyConditionExpression: 'client_id = :c and form_type = :f',
          IndexName: 'client_form-index',
          TableName: 'DocumentMaster',
          ExpressionAttributeValues: {
            ':c': reactData.client_id,
            ':f': reactData.selectedForm
          }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading CompletedDocuments; error is ${error}`);
        });
      if (recordExists(allDocs)) {
        for (const this_doc of allDocs.Items) {
          if ((this_doc.restricted_access === 'admin_only') && (!reactData.administrative_account)) {
            continue;    // skip this document
          }
          if (!myFormListObj.hasOwnProperty(this_doc.pertains_to)) {
            let personRec = await dbClient
              .get({
                Key: {
                  person_id: this_doc.pertains_to
                },
                TableName: 'People'
              })
              .promise()
              .catch(error => {
                if (error.code === 'NetworkingError') {
                  cl(`Security Violation or no Internet Connection`);
                }
                cl(`Error reading CompletedDocuments; error is ${error}`);
              });
            let person_name;
            if (recordExists(personRec)) {
              person_name = `${personRec.Item.name?.first} ${personRec.Item.name?.last}`;
            }
            myFormListObj[this_doc.pertains_to] = {
              why: `Assigned by ${this_doc.history[this_doc.history.length - 1].update_by}`,
              person_id: this_doc.pertains_to,
              person_name,
              dueDate: due_date,
              options: formRec.options || {},
              view_only: formRec.view_only,
              wipDocs: [],
              assignedDocs: [],
              completedDocs: [],
              isUpdating: false,
              isAmending: false
            };
          }
          if (this_doc.status === 'complete') {
            const completed_count = myFormListObj[this_doc.pertains_to].completedDocs.length;
            const cObj = {
              document_id: this_doc.document_id,
              location: this_doc.history[0].url,
              last_update: this_doc.history[0].last_update,
              date_completed: makeDate(this_doc.history[0].last_update).relative,
              title: this_doc.title,
              amendments: this_doc.amendments
            };
            if ((completed_count === 0) || (this_doc.history[0].last_update > myFormListObj[this_doc.pertains_to].completedDocs[0].last_update)) {
              myFormListObj[this_doc.pertains_to].completedDocs.unshift(cObj);
            }
            else if (this_doc.history[0].last_update < myFormListObj[this_doc.pertains_to].completedDocs[completed_count - 1].last_update) {
              myFormListObj[this_doc.pertains_to].completedDocs.push(cObj);
            }
            else {
              const foundAt = myFormListObj[this_doc.pertains_to].completedDocs.findIndex(d => {
                return (d.last_update < this_doc.history[0].last_update);
              });
              myFormListObj[this_doc.pertains_to].completedDocs.splice(foundAt, 0, cObj);
            }
          }
          else if (this_doc.status === 'in_process') {
            myFormListObj[this_doc.pertains_to].wipDocs.push({
              document_id: this_doc.document_id,
              last_update: this_doc.history[0].last_update,
              due_date: this_doc.due_date || myFormListObj[this_doc.pertains_to].dueDate,
              title: this_doc.title
            });
          }
          else {
            myFormListObj[this_doc.pertains_to].assignedDocs.push({
              document_id: this_doc.document_id,
              last_update: this_doc.history[0].last_update,
              due_date: this_doc.due_date || myFormListObj[this_doc.pertains_to].dueDate,
              title: this_doc.title
            });
          }
        }
      }
      // done with all the docs - sort them so that:
      //   completedDocs are in reverse last_update sequence
      //   wipDocs and assignedDocs are in ascending due_date sequence with "no due date" last

      updateReactData({
        myFormListObj,
        formsInitialized: true
      }, true);
    }
    initialize();
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const editForm = (this_personID) => {
    if (reactData.myFormListObj[this_personID].wipDocs.length > 0) {
      reactData.myFormListObj[this_personID].isUpdating = reactData.myFormListObj[this_personID].wipDocs[0].document_id;
    }
    else if (reactData.myFormListObj[this_personID].assignedDocs.length > 0) {
      reactData.myFormListObj[this_personID].isUpdating = reactData.myFormListObj[this_personID].assignedDocs[0].document_id;
    }
    else {
      reactData.myFormListObj[this_personID].isUpdating = 'new';
    }
    updateReactData({
      myFormListObj: reactData.myFormListObj
    }, true);
  };

  return (
    <React.Fragment>
      {!reactData.formHistoryMode &&
        <Box
          key={`DocSection_masterBox`}
          flexGrow={2} px={2} pt={'24px'} pb={'8px'} display='flex' flexDirection='column'
        >
          {isMounted.current && reactData.formsInitialized && Object.keys(reactData.myFormListObj).length === 0 &&
            <Typography
              style={AVATextStyle({ margin: { left: 3, top: 1, bottom: 1 } })}
            >
              {`No Forms were found for you.`}
            </Typography>
          }
          {Object.keys(reactData.myFormListObj).map((this_personID, form_index) => (
            <React.Fragment
              key={`wrapperFrag-col_form${form_index}`}
            >
              <Box
                display='flex'
                flexDirection={'row'}
                key={`radio-col_form${form_index}`}
                style={{ marginLeft: '4px', marginRight: '4px', marginTop: '8px', marginBottom: '8px' }}
                justifyContent='space-between'
                alignItems='center'
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  key={`radio-row_form${form_index}`}
                  justifyContent='center'
                  alignItems='center'
                >
                  {((reactData.myFormListObj[this_personID].completedDocs.length > 0) &&
                    (reactData.myFormListObj[this_personID].wipDocs.length === 0)) ?
                    <React.Fragment>
                      <Typography style={{ display: 'none', visibility: 'hidden' }}>
                        {checkCircleDisplayed = true}
                      </Typography>
                      <CheckCircleIcon
                        key={`radio-button_form${form_index}off`}
                        id={`radio-button_form${form_index}off`}
                        style={AVATextStyle({
                          size: 1.5,
                          margin: { right: 0.5 },
                        })}
                        onClick={() => {
                          let nowJ = new Date().getTime();
                          window.open(`${reactData.myFormListObj[this_personID].completedDocs[0].location}?qt=${nowJ.toString()}`
                            , reactData.myFormListObj[this_personID].completedDocs[0].date_completed);
                        }}
                        size='small'
                      />
                    </React.Fragment>
                    :
                    ((!reactData.myFormListObj[this_personID].view_only
                      || (
                        (reactData.myFormListObj[this_personID].wipDocs.length > 0)
                        && reactData.myFormListObj[this_personID].wipDocs[0].hasOwnProperty('assigned_to')
                        && reactData.myFormListObj[this_personID].wipDocs[0].assigned_to.hasOwnProperty(state.session.patient_id)
                        && reactData.myFormListObj[this_personID].wipDocs[0].assigned_to[state.session.patient_id] !== 'view_only'
                      )
                    )
                      ?
                      <React.Fragment>
                        <Typography style={{ display: 'none', visibility: 'hidden' }}>
                          {((reactData.myFormListObj[this_personID].completedDocs.length > 0)
                            ? (pencilDisplayed = true)
                            : (reactData.myFormListObj[this_personID].wipDocs.length > 0) ? (orangePencilDisplayed = true) : (redPencilDisplayed = true))}
                        </Typography>
                        <EditIcon
                          key={`radio-button_form${form_index}edit`}
                          id={`radio-button_form${form_index}edit`}
                          onClick={() => {
                            editForm(this_personID);
                          }}
                          style={AVATextStyle({
                            size: 1.5,
                            margin: { right: 0.5 },
                            color: ((reactData.myFormListObj[this_personID].completedDocs.length > 0)
                              ? null
                              : (reactData.myFormListObj[this_personID].wipDocs.length > 0) ? 'orange' : 'red')
                          })}
                          size='small'
                        />
                      </React.Fragment>
                      :
                      <React.Fragment>
                        <Typography style={{ display: 'none', visibility: 'hidden' }}>
                          {((reactData.myFormListObj[this_personID].completedDocs.length > 0)
                            ? (circleDisplayed = true)
                            : (reactData.myFormListObj[this_personID].wipDocs.length > 0) ? (orangeCircleDisplayed = true) : (redCircleDisplayed = true))}
                        </Typography>
                        <RadioButtonUncheckedIcon
                          key={`radio-button_open_form${form_index}edit`}
                          style={AVATextStyle({
                            size: 1.5,
                            margin: { right: 0.5 },
                            color: ((reactData.myFormListObj[this_personID].completedDocs.length > 0)
                              ? null
                              : (reactData.myFormListObj[this_personID].wipDocs.length > 0) ? 'orange' : 'red')
                          })}
                          size='small'
                        />
                      </React.Fragment>

                    )
                  }
                  <Box display='flex' alignItems='flex-start'
                    justifyContent='center' flexDirection='column'
                    flexWrap='wrap'
                  >
                    <Typography
                      key={`name-col_form${form_index}`}
                      onClick={() => {
                        if (reactData.myFormListObj[this_personID].completedDocs.length > 0) {
                          let nowJ = new Date().getTime();
                          window.open(`${reactData.myFormListObj[this_personID].completedDocs[0].location}?qt=${nowJ.toString()}`
                            , reactData.myFormListObj[this_personID].completedDocs[0].date_completed);
                        }
                        else if (!reactData.myFormListObj[this_personID].view_only) {
                          editForm(this_personID);
                        }
                      }}
                      style={AVATextStyle({
                        size: 1.5,
                        margin: { left: 0 },
                        color: ((reactData.myFormListObj[this_personID].completedDocs.length === 0) ? ((reactData.myFormListObj[this_personID].wipDocs.length > 0) ? 'orange' : 'red') : null)
                      })}
                    >
                      {reactData.myFormListObj[this_personID].form_name}
                    </Typography>
                    {(reactData.myFormListObj[this_personID].dueDate || (reactData.myFormListObj[this_personID].wipDocs.length > 0)) &&
                      (reactData.myFormListObj[this_personID].completedDocs.length === 0) &&
                      <Typography
                        key={`duedate-col_form${form_index}`}
                        style={AVATextStyle({
                          size: 0.8,
                          margin: { top: 0, left: 0 },
                          color: ((reactData.myFormListObj[this_personID].wipDocs.length > 0) ? 'orange' : 'red')
                        })}
                      >
                        {`${((reactData.myFormListObj[this_personID].wipDocs.length > 0) ? 'Started but incomplete. ' : '')}${(reactData.myFormListObj[this_personID].dueDate) ? ('Due by ' + makeDate(reactData.myFormListObj[this_personID].dueDate).relative) : ''}`}
                      </Typography>
                    }
                    {(reactData.myFormListObj[this_personID].completedDocs.length > 0) &&
                      <React.Fragment>
                        <Typography
                          key={`duedate-col_form${form_index}`}
                          style={AVATextStyle({
                            size: 0.8,
                            margin: { top: 0, left: 0 },
                          })}
                        >
                          {reactData.myFormListObj[this_personID].completedDocs[0].title}
                        </Typography>
                        <Typography
                          key={`duedate-col_form${form_index}`}
                          style={AVATextStyle({
                            size: 0.8,
                            margin: { top: 0, left: 0 },
                          })}
                        >
                          {`Completed ${makeDate(reactData.myFormListObj[this_personID].completedDocs[0].last_update).relative}`}
                        </Typography>
                      </React.Fragment>
                    }
                  </Box>
                </Box>
                <Box
                  display='flex'
                  flexDirection='row'
                  key={`radio-row_form__buttons${form_index}`}
                  justifyContent='center'
                  alignItems='center'
                >
                  {(reactData.myFormListObj[this_personID].completedDocs.length > 0) &&
                    <React.Fragment>
                      {reactData.myFormListObj[this_personID].options?.allowAmendments &&
                        reactData.administrative_account &&
                        <React.Fragment>
                          <Typography style={{ display: 'none', visibility: 'hidden' }}>
                            {addAmendmentDisplayed = true}
                          </Typography>
                          <AddCircleIcon
                            style={AVATextStyle({ margin: { right: 0.1 } })}
                            onClick={() => {
                              reactData.myFormListObj[this_personID].isAmending = reactData.myFormListObj[this_personID].completedDocs[0].document_id;
                              updateReactData({
                                isAmendingForm: {
                                  form_id: this_personID,
                                  document_id: reactData.myFormListObj[this_personID].completedDocs[0].document_id
                                },
                                myFormListObj: reactData.myFormListObj
                              }, true);
                            }}
                          />
                        </React.Fragment>
                      }
                      {(reactData.myFormListObj[this_personID].completedDocs.length > 1) &&
                        <React.Fragment >
                          <Typography style={{ display: 'none', visibility: 'hidden' }}>
                            {historyDisplayed = true}
                          </Typography>
                          <DynamicFeedIcon
                            style={AVATextStyle({ margin: { right: 0.1 } })}
                            onClick={() => {
                              updateReactData({
                                formHistoryMode: this_personID
                              }, true);
                            }}
                          />
                        </React.Fragment>
                      }
                      {(reactData.myFormListObj[this_personID].wipDocs.length === 0) &&
                        (reactData.administrative_account || !reactData.myFormListObj[this_personID].view_only) &&
                        <React.Fragment>
                          <Typography style={{ display: 'none', visibility: 'hidden' }}>
                            {pencilDisplayed = true}
                          </Typography>
                          <EditIcon
                            style={AVATextStyle({ margin: { right: 0.1 } })}
                            key={`radio-button_form${form_index}add`}
                            id={`radio-button_form${form_index}add`}
                            onClick={() => {
                              editForm(this_personID);
                            }}
                            size='small'
                          />
                        </React.Fragment>
                      }
                    </React.Fragment>
                  }
                </Box>
              </Box>
              {reactData.myFormListObj[this_personID].isUpdating &&
                <FormFillB
                  key={`docPerson-${this_personID}_update_ffB`}
                  request={(reactData.myFormListObj[this_personID].isUpdating === 'new') ?
                    {
                      form_id: this_personID,
                      person_id: currentValues.peopleRec.person_id,
                      mode: 'new',
                    }
                    :
                    {
                      form_id: this_personID,
                      document_id: reactData.myFormListObj[this_personID].isUpdating,
                      person_id: currentValues.peopleRec.person_id,
                    }}
                  onClose={(ignore_me, statusObj) => {
                    reactData.myFormListObj[this_personID].isUpdating = false;
                    if (statusObj.document_status === 'complete') {
                      reactData.myFormListObj[this_personID].completedDocs.push({
                        document_id: statusObj.recWritten.document_id,
                        location: statusObj.recWritten.history[0].url,
                        date_completed: makeDate(new Date().getTime()).relative,
                        title: statusObj.recWritten.title,
                        amendments: []
                      });
                      let foundAt = reactData.myFormListObj[this_personID].wipDocs.findIndex(d => {
                        return d.document_id === reactData.myFormListObj[this_personID].isUpdating;
                      });
                      if (foundAt > -1) {
                        reactData.myFormListObj[this_personID].wipDocs.splice(foundAt, 1);
                      }
                      else {
                        let foundAt = reactData.myFormListObj[this_personID].assignedDocs.findIndex(d => {
                          return d.document_id === reactData.myFormListObj[this_personID].isUpdating;
                        });
                        if (foundAt > -1) {
                          reactData.myFormListObj[this_personID].assignedDocs.splice(foundAt, 1);
                        }
                      }
                    }
                    else if (statusObj.document_status === 'work_in_process') {
                      reactData.myFormListObj[this_personID].wipDocs.push({
                        document_id: statusObj.recWritten.document_id,
                        due_date: statusObj.recWritten.due_date,
                        title: statusObj.recWritten.title
                      });
                      let foundAt = reactData.myFormListObj[this_personID].assignedDocs.findIndex(d => {
                        return d.document_id === reactData.myFormListObj[this_personID].isUpdating;
                      });
                      if (foundAt > -1) {
                        reactData.myFormListObj[this_personID].assignedDocs.splice(foundAt, 1);
                      }
                    }
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
              {reactData.myFormListObj[this_personID].isPrinting &&
                <FormFillB
                  key={`docPerson-${this_personID}_print_ffB`}
                  request={{
                    form_id: reactData.myFormListObj[this_personID].form_id,
                    mode: 'printEmpty'
                  }}
                  onClose={() => {
                    reactData.myFormListObj[this_personID].isPrinting = false;
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
            </React.Fragment>
          ))}
        </Box >
      }
      {reactData.isAmendingForm &&
        <FormFillB
          key={`docPerson-amending_ffB`}
          request={{
            form_id: reactData.myFormListObj[reactData.isAmendingForm.form_id].options?.allowAmendments || 'amendment_1',
            person_id: currentValues.peopleRec.person_id,
            mode: 'new',
            formData: {
              document_id: reactData.isAmendingForm.document_id,
              doc_reference: reactData.myFormListObj[reactData.isAmendingForm.form_id].completedDocs[0].title
            }
          }}
          onClose={() => {
            reactData.myFormListObj[reactData.isAmendingForm.form_id].isAmending = false;
            updateReactData({
              isAmendingForm: false,
              myFormListObj: reactData.myFormListObj
            }, true);
          }}
        />
      }
      {reactData.formHistoryMode &&
        <Box
          key={`DocHistorySection_masterBox`}
          flexGrow={2} px={2} pt={'24px'} pb={4} display='flex' flexDirection='column'
        >
          <Typography
            key={`name-histry_section`}
            style={AVATextStyle({
              size: 1.5,
              margin: { left: 0, bottom: 1 },
            })}
          >
            {`History - ${reactData.myFormListObj[reactData.formHistoryMode].form_name}`}
          </Typography>
          {reactData.myFormListObj[reactData.formHistoryMode].completedDocs.map((this_doc, docNdx) => (
            <React.Fragment
              key={`historyFrag-col_form${docNdx}`}
            >
              <Box
                display='flex'
                flexDirection='row'
                flexWrap={'nowrap'}
                key={`radio-col_form${docNdx}`}
                style={AVATextStyle({ margin: { left: 1, right: 1, top: 0.5 } })}
                justifyContent='space-between'
                alignItems='center'
              >
                <Box display='flex' alignItems='flex-start'
                  justifyContent='center' flexDirection='column'
                  onClick={() => {
                    let printList = ([this_doc.file_location || this_doc.location]).concat(
                      this_doc.amendments
                        ? this_doc.amendments.map(this_amendment => {
                          return this_amendment.file_location;
                        })
                        : []
                    );
                    printList.forEach((this_document, ndx) => {
                      if (this_document) {
                        window.open(this_document);
                      }
                    });
                  }}
                >
                  <Typography
                    key={`docPerson-${this_doc.document_id}_${docNdx}`}
                    id={`docPerson-${this_doc.document_id}_${docNdx}`}
                    style={AVATextStyle({ size: 1, margin: { right: 0.2 } })}
                  >
                    {this_doc.title}
                  </Typography>
                  <Typography
                    key={`duedate-col_form${this_doc.document_id}_${docNdx}`}
                    style={AVATextStyle({
                      size: 0.8,
                      margin: { top: 0, left: 0 },
                    })}
                  >
                    {`Completed ${this_doc.date_completed}`}
                  </Typography>
                </Box>
                <Box display='flex' alignItems='center'
                  justifyContent='flex-start' flexDirection='row'
                >
                  {reactData.myFormListObj[reactData.formHistoryMode].options?.allowAmendments &&
                    reactData.administrative_account &&
                    <React.Fragment>
                      <Typography style={{ display: 'none', visibility: 'hidden' }}>
                        {historyAmendmentDisplayed = true}
                      </Typography>
                      <AddCircleIcon
                        style={AVATextStyle({ margin: { right: 0.1 } })}
                        onClick={() => {
                          reactData.myFormListObj[reactData.formHistoryMode].isAmending = this_doc.document_id;
                          updateReactData({
                            isAmendingForm: {
                              form_id: reactData.formHistoryMode,
                              document_id: this_doc.document_id
                            },
                            myFormListObj: reactData.myFormListObj
                          }, true);
                        }}
                      />
                    </React.Fragment>
                  }
                </Box>
              </Box>
            </React.Fragment>
          ))}
          <Box display='flex' alignItems='center'
            justifyContent='flex-end' flexDirection='row'
            onClick={() => {
              updateReactData({
                formHistoryMode: false
              }, true);
            }}
          >
            <Typography
              style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
            >
              {`Exit history mode`}
            </Typography>
          </Box>
        </Box>
      }
      {!reactData.formHistoryMode &&
        isMounted.current &&
        reactData.formsInitialized &&
        Object.keys(reactData.myFormListObj).length > 0 &&
        <Box
          display='flex'
          flexDirection='column'
          key={`radio-guide_buttons`}
          marginTop='16px'
          marginBottom='16px'
          marginLeft='20px'
        >
          <Typography
            style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
          >
            {`Icon guide`}
          </Typography>
          {checkCircleDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons`}
            >
              <CheckCircleIcon
                style={AVATextStyle({ margin: { right: 0.1 } })}
                key={`radio-guide_e_button`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
              >
                {`View a completed form`}
              </Typography>
            </Box>
          }
          {(circleDisplayed || redCircleDisplayed || orangeCircleDisplayed) &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2`}
            >
              <RadioButtonUncheckedIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: (redCircleDisplayed ? 'red' : (orangeCircleDisplayed ? 'orange' : null)) })}
                key={`radio-guide_e_button`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: (redCircleDisplayed ? 'red' : (orangeCircleDisplayed ? 'orange' : null)) })}
              >
                {`You will be able to view this form after it is completed`}
              </Typography>
            </Box>
          }
          {redPencilDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2`}
            >
              <EditIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: 'red' })}
                key={`radio-guide_e_button`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: 'red' })}
              >
                {`Start a new form`}
              </Typography>
            </Box>
          }
          {orangePencilDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2`}
            >
              <EditIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: 'orange' })}
                key={`radio-guide_e_button2`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: 'orange' })}
              >
                {`Continue an incomplete form`}
              </Typography>
            </Box>
          }
          {addAmendmentDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons3`}
            >
              <AddCircleIcon
                key={`radio-guide_ac_button3`}
                style={AVATextStyle({ margin: { right: 0.1 } })}
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
              >
                {`Amend a completed form`}
              </Typography>
            </Box>
          }
          {pencilDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons4`}
            >
              <EditIcon
                style={AVATextStyle({ margin: { right: 0.1 } })}
                key={`radio-guide_e_button4`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
              >
                {`Replace a completed form`}
              </Typography>
            </Box>
          }
          {historyDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons5`}
            >
              <DynamicFeedIcon
                style={AVATextStyle({ margin: { right: 0.1 } })}
                key={`radio-guide_e_button5`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
              >
                {`Show history`}
              </Typography>
            </Box>
          }
        </Box>
      }
      {reactData.formHistoryMode &&
        isMounted.current &&
        reactData.formsInitialized &&
        historyAmendmentDisplayed &&
        <Box
          display='flex'
          flexDirection='column'
          key={`radio-guide_buttons`}
          marginTop='16px'
          marginBottom='16px'
          marginLeft='20px'
        >
          <Typography
            style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
          >
            {`Icon guide - History screen`}
          </Typography>
          {historyAmendmentDisplayed &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons3`}
            >
              <AddCircleIcon
                key={`radio-guide_ac_button`}
                style={AVATextStyle({ margin: { right: 0.1 } })}
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8 })}
              >
                {`Amend a completed form`}
              </Typography>
            </Box>
          }
        </Box>
      }
    </React.Fragment>
  );
};