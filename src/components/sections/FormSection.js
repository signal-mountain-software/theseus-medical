import React from 'react';

import { dbClient, recordExists, cl } from '../../util/AVAUtilities';
import { AVATextStyle } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';

import { Typography, Box } from '@material-ui/core/';

import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import EditIcon from '@material-ui/icons/Edit';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import PrintIcon from '@material-ui/icons/Print';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import VisibilityIcon from '@material-ui/icons/Visibility';

import AVAUploadFile from '../../util/AVAUploadFile';
import FormFillB from '../forms/FormFillB';

export default ({ currentValues, reactData, updateReactData }) => {

  const isMounted = React.useRef(false);

  React.useEffect(() => {
    async function initialize() {
      let myFormListObj = {};

      // in a minute, we're going to need the names of all the forms that are found.
      // we'll grab them all here.
      let formNames = {};
      let dueDates = {};
      let formResult = await dbClient
        .query({
          TableName: 'Forms',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': currentValues.peopleRec.client_id }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading Forms id ${error}`);
        });
      if (recordExists(formResult)) {
        for (let this_form of formResult.Items) {
          formNames[this_form.form_id] = this_form.form_name;
          dueDates[this_form.form_id] = this_form.due_by ? this_form.due_by[0] : null;
        }
      }

      // get all the groups that this person belongs to
      // and build myFormListObj with one object for each form assigned to members of this person's groups
      for (let this_group of currentValues.peopleRec.groups) {
        let groupRec = await dbClient
          .get({
            Key: {
              client_id: currentValues.peopleRec.client_id,
              group_id: this_group
            },
            TableName: "Groups"
          })
          .promise()
          .catch(error => {
            console.log({ 'Error reading Groups': error });
          });

        // get all the forms that are assigned people in this group 
        if (recordExists(groupRec) && groupRec.Item.forms) {
          for (let this_form of groupRec.Item.forms) {
            if (!myFormListObj.hasOwnProperty(this_form)) {
              myFormListObj[this_form] = {
                form_id: this_form,
                form_name: formNames[this_form],
                dueDate: dueDates[this_form],
                completed: false,
                wip: false,
                isViewing: false,
                document_list: []
              };
            }
          }
        }
      }

      // get all the completed documents for this person
      let recentlyCompletedDocs = await dbClient
        .query({
          KeyConditionExpression: 'pertains_to = :p',
          ScanIndexForward: false,
          IndexName: 'pertains_to-formType_date-index',
          Limit: 40,
          TableName: 'CompletedDocuments',
          ExpressionAttributeValues: {
            ':p': currentValues.peopleRec.person_id
          }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading CompletedDocuments; error is ${error}`);
        });
      if (recordExists(recentlyCompletedDocs)) {
        for (let this_doc of recentlyCompletedDocs.Items) {
          if (!myFormListObj.hasOwnProperty(this_doc.formType)) {
            myFormListObj[this_doc.formType] = {
              form_id: this_doc.formType,
              form_name: formNames[this_doc.formType],
              dueDate: dueDates[this_doc.formType],
              completed: true,
              wip: false,
              isViewing: false,
              document_list: []
            };
          }
          myFormListObj[this_doc.formType].completed = true;
          myFormListObj[this_doc.formType].document_list.push({
            document_id: this_doc.document_id,
            isComplete: true,
            location: this_doc.file_location,
            date_completed: makeDate(this_doc.date_completed).relative
          });
        }
      }

      // Check for an exising WIP form
      let wipDocuments = await dbClient
        .query({
          KeyConditionExpression: 'pertains_to = :p',
          ScanIndexForward: false,
          TableName: 'DocumentsInProcess',
          IndexName: 'pertains_to-formType_date-index',
          ExpressionAttributeValues: {
            ':p': currentValues.peopleRec.person_id,
          }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading DocumentsInProcess; error is ${error}`);
        });
      if (recordExists(wipDocuments)) {
        for (let this_doc of wipDocuments.Items) {
          if (!myFormListObj.hasOwnProperty(this_doc.formType)) {
            myFormListObj[this_doc.formType] = {
              form_id: this_doc.formType,
              form_name: formNames[this_doc.formType],
              dueDate: dueDates[this_doc.formType],
              completed: false,
              wip: true,
              isViewing: false,
              document_list: []
            };
          }
          myFormListObj[this_doc.formType].wip = true;
          myFormListObj[this_doc.formType].document_list.push({
            document_id: this_doc.document_id,
            isComplete: false,
          });
        }
      }
      updateReactData({
        myFormListObj,
        recentlyCompletedDocs: recentlyCompletedDocs?.Items || []
      }, true);
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <React.Fragment>
      {!reactData.formHistoryMode &&
        <Box
          key={`DocSection_masterBox`}
          flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
        >
          {isMounted.current && Object.keys(reactData.myFormListObj).length === 0 &&
            <Typography
              style={AVATextStyle({ italic: true, margin: { top: 1, bottom: 0.4 } })}
            >
              {`No Forms were found for you.`}
            </Typography>
          }
          {Object.keys(reactData.myFormListObj).map((this_formID, form_index) => (
            <React.Fragment
              key={`wrapperFrag-col_form${form_index}`}
            >
              <Box
                display='flex'
                flexDirection={reactData.isMobile ? 'column' : 'row'}
                key={`radio-col_form${form_index}`}
                style={AVATextStyle({ margin: { left: 0, right: 1, top: 1 } })}
                justifyContent='flex-start'
                alignItems='flex-start'
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  key={`radio-row_form${form_index}`}
                  justifyContent='flex-start'
                  alignItems='center'
                >
                  {reactData.myFormListObj[this_formID].completed &&
                    <CheckCircleIcon
                      key={`radio-button_form${form_index}off`}
                      id={`radio-button_form${form_index}off`}
                      style={AVATextStyle({
                        size: 1.5,
                        margin: { right: 0.5 },
                      })}
                      onClick={() => {
                        let nowJ = new Date().getTime();
                        window.open(`${reactData.myFormListObj[this_formID].document_list[0].location}?qt=${nowJ.toString()}`
                          , reactData.myFormListObj[this_formID].date_completed);
                      }}
                      size='small'
                    />
                  }
                  {!reactData.myFormListObj[this_formID].completed &&
                    <RadioButtonUncheckedIcon
                      key={`radio-button_form${form_index}on`}
                      id={`radio-button_form${form_index}on`}
                      style={AVATextStyle({
                        size: 1.5,
                        margin: { right: 0.5 },
                        color: 'red'
                      })}
                      onClick={() => {
                        reactData.myFormListObj[this_formID].isViewing = true;
                        updateReactData({
                          myFormListObj: reactData.myFormListObj
                        }, true);
                      }}
                      size='small'
                    />
                  }
                  {reactData.myFormListObj[this_formID].wip &&
                    <EditIcon
                      key={`radio-button_form${form_index}edit`}
                      id={`radio-button_form${form_index}edit`}
                      onClick={() => {
                        reactData.myFormListObj[this_formID].isViewing = true;
                        updateReactData({
                          myFormListObj: reactData.myFormListObj
                        }, true);
                      }}
                      style={AVATextStyle({
                        size: 1.5,
                        margin: { right: 0.5 },
                        color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                      })}
                      size='small'
                    />
                  }
                  {!reactData.myFormListObj[this_formID].wip &&
                    <AddCircleIcon
                      key={`radio-button_form${form_index}addnew`}
                      id={`radio-button_form${form_index}addnew`}
                      onClick={() => {
                        reactData.myFormListObj[this_formID].makeNewDocument = true;
                        updateReactData({
                          myFormListObj: reactData.myFormListObj
                        }, true);
                      }}
                      style={AVATextStyle({
                        size: 1.5,
                        margin: { right: 0.5 },
                        color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                      })}
                      size='small'
                    />
                  }
                  <PrintIcon
                    key={`radio-button_form${form_index}print`}
                    id={`radio-button_form${form_index}print`}
                    style={AVATextStyle({
                      size: 1.5,
                      margin: { right: 0.5 },
                      color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                    })}
                    onClick={() => {
                      reactData.myFormListObj[this_formID].isPrinting = true;
                      updateReactData({
                        myFormListObj: reactData.myFormListObj
                      }, true);
                    }}
                    size='small'
                  />
                  <CloudUploadIcon
                    key={`radio-button_form${form_index}upload`}
                    id={`radio-button_form${form_index}upload`}
                    style={AVATextStyle({
                      size: 1.5,
                      margin: { right: 0.5 },
                      color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                    })}
                    onClick={() => {
                      reactData.myFormListObj[this_formID].uploadDoc = true;
                      updateReactData({
                        myFormListObj: reactData.myFormListObj
                      }, true);
                    }}
                    size='small'
                  />
                </Box>
                <Box display='flex' alignItems='center'
                  justifyContent='flex-start' flexDirection='row'
                  flexWrap='wrap'
                >
                  <Typography
                    key={`name-col_form${form_index}`}
                    onClick={() => {
                      if (reactData.myFormListObj[this_formID].completed) {
                        let nowJ = new Date().getTime();
                        window.open(`${reactData.myFormListObj[this_formID].document_list[0].location}?qt=${nowJ.toString()}`
                          , reactData.myFormListObj[this_formID].date_completed);
                      }
                      else {
                        reactData.myFormListObj[this_formID].isViewing = true;
                        updateReactData({
                          myFormListObj: reactData.myFormListObj
                        }, true);
                      }
                    }}
                    style={AVATextStyle({
                      size: 1.5,
                      margin: { left: 0 },
                      color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                    })}
                  >
                    {reactData.myFormListObj[this_formID].form_name}
                  </Typography>
                  {reactData.myFormListObj[this_formID].dueDate &&
                    !reactData.myFormListObj[this_formID].completed &&
                    <Typography
                      key={`duedate-col_form${form_index}`}
                      style={AVATextStyle({
                        size: 1,
                        margin: { top: 0.2, left: 0.5 },
                        color: (!reactData.myFormListObj[this_formID].completed ? 'red' : null)
                      })}
                    >
                      {`(due by ${makeDate(reactData.myFormListObj[this_formID].dueDate).relative})`}
                    </Typography>
                  }
                </Box>
              </Box>
              {reactData.myFormListObj[this_formID].isViewing &&
                <FormFillB
                  request={{
                    form_id: reactData.myFormListObj[this_formID].form_id,
                    document_id: (reactData.myFormListObj[this_formID].document_id
                      ? reactData.myFormListObj[this_formID].document_id[0]
                      : null
                    ),
                    person_id: currentValues.peopleRec.person_id
                  }}
                  onClose={(ignore_me, statusObj) => {
                    reactData.myFormListObj[this_formID].isViewing = false;
                    reactData.myFormListObj[this_formID].completed = (statusObj.document_status === 'complete');
                    if (statusObj.location) {
                      if (!reactData.myFormListObj[this_formID].document_list
                        || !Array.isArray(reactData.myFormListObj[this_formID].document_list)
                      ) {
                        reactData.myFormListObj[this_formID].document_list = [];
                      }
                      reactData.myFormListObj[this_formID].document_list.unshift(statusObj.location);
                    }
                    reactData.myFormListObj[this_formID].wip = (statusObj.document_status === 'work_in_process');
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
              {reactData.myFormListObj[this_formID].isPrinting &&
                <FormFillB
                  request={{
                    form_id: reactData.myFormListObj[this_formID].form_id,
                    mode: 'printEmpty'
                  }}
                  onClose={() => {
                    reactData.myFormListObj[this_formID].isPrinting = false;
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
              {reactData.myFormListObj[this_formID].makeNewDocument &&
                <FormFillB
                  request={{
                    form_id: reactData.myFormListObj[this_formID].form_id,
                    person_id: currentValues.peopleRec.person_id,
                    mode: 'new',
                  }}
                  onClose={() => {
                    reactData.myFormListObj[this_formID].makeNewDocument = false;
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
              {reactData.myFormListObj[this_formID].uploadDoc &&
                <AVAUploadFile
                  options={{
                    buttonText: ['Choose', 'Save & Continue'],
                    title: [reactData.myFormListObj[this_formID].file_name, 'Tap "Choose a File" to select the content to upload'],
                    oneOnly: true
                  }}
                  onCancel={() => {
                    reactData.myFormListObj[this_formID].uploadDoc = false;
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                  onLoad={async (response) => {
                    let selectedName = (`${currentValues.peopleRec.name?.first} ${currentValues.peopleRec.name?.last}`).trim();
                    const nowTime = makeDate(new Date());
                    const newDocument_id = `${reactData.myFormListObj[this_formID].form_id}_${nowTime.timestamp}`;
                    let goodPut = true;
                    await dbClient
                      .put({
                        Item: {
                          client_id: currentValues.peopleRec.client_id,
                          document_id: `${reactData.myFormListObj[this_formID].form_id}_${nowTime.timestamp}`,
                          document_title: `${reactData.myFormListObj[this_formID].form_name} for ${selectedName || currentValues.peopleRec.client_id} - ${nowTime.absolute}`,
                          pertains_to: currentValues.peopleRec.person_id,
                          date_completed: nowTime.timestamp,
                          formType: reactData.myFormListObj[this_formID].form_id,
                          formType_date: `${reactData.myFormListObj[this_formID].form_id}%%${new Date().getTime()}`,
                          fields: null,
                          save_info: {
                            s3Bucket: 'theseus-medical-storage',
                            s3Key: response[0].split('/').pop(),
                            s3Location: response[0]
                          },
                          file_location: response[0]
                        },
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
                            person_id: reactData.user_id,
                            document_id: newDocument_id,
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
                            person_id: currentValues.peopleRec.person_id,
                            document_id: newDocument_id,
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
                        client_id: currentValues.peopleRec.client_id,
                        document_id: newDocument_id,
                        status: 'complete',
                        formType: reactData.myFormListObj[this_formID].form_id,
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
                    reactData.myFormListObj[this_formID].uploadDoc = false;
                    updateReactData({
                      myFormListObj: reactData.myFormListObj
                    }, true);
                  }}
                />
              }
            </React.Fragment>
          ))}
          {(reactData.recentlyCompletedDocs.length > 0) &&
            <Box display='flex' alignItems='center'
              justifyContent='flex-end' flexDirection='row'
              onClick={() => {
                updateReactData({
                  formHistoryMode: true
                }, true);
              }}
            >
              <Typography
                style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
              >
                {`Click here for history of completed forms`}
              </Typography>
            </Box>
          }
        </Box >
      }
      {reactData.formHistoryMode &&
        <Box
          key={`DocHistorySection_masterBox`}
          flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
        >
          {reactData.recentlyCompletedDocs.map((this_doc, docNdx) => (
            <React.Fragment
              key={`historyFrag-col_form${docNdx}`}
            >
              <Box
                display='flex'
                flexDirection='row'
                flexWrap={'nowrap'}
                key={`radio-col_form${docNdx}`}
                style={AVATextStyle({ margin: { left: 1, right: 1, top: 0.5 } })}
                justifyContent='flex-start'
                alignItems='center'
              >
                <VisibilityIcon
                  style={AVATextStyle({ margin: { right: 0.5 } })}
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
                />
                <AddCircleIcon
                  style={AVATextStyle({ margin: { right: 0.5 } })}
                  onClick={() => {
                    reactData.recentlyCompletedDocs[docNdx].amendmentPending = true;
                    updateReactData({
                      recentlyCompletedDocs: reactData.recentlyCompletedDocs
                    }, true);
                    /*
                    updateReactData({
                      addDocPrompt: false,
                      addDocForm: true,
                      pendingInstructions: {
                        selectedPerson: this_doc.pertains_to,
                        selectedPerson_index: personNdx,
                        action: 'amendment',
                        parentFormType: this_form.form_id,
                        docIndex: docNdx,
                        formType: this_form.amedment_form_id || 'amendment_1',
                        formData: {
                          document_id: this_doc.document_id,
                          doc_reference: `${this_doc.document_title} for ${this_doc.pertains_to_name}; completed on ${makeDate(this_doc.last_update).absolute}`
                        }
                      }
                    }, true);
                */
                  }}
                />
                <Box display='flex' alignItems='center'
                  justifyContent='flex-start' flexDirection='row'
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
                    style={AVATextStyle({ size: 0.8, margin: { right: 0.2 } })}
                  >
                    {this_doc.document_title}
                  </Typography>
                  <Typography
                    key={`docDate-${this_doc.document_id}_${docNdx}`}
                    id={`docDate-${this_doc.document_id}_${docNdx}`}
                    style={AVATextStyle({ size: 0.8 })}
                  >
                    {makeDate(this_doc.docDate).dateOnly}
                  </Typography>
                </Box>
              </Box>
              {this_doc.amendmentPending &&
                <FormFillB
                  request={{
                    form_id: this_doc.amedment_form_id || 'amendment_1',
                    person_id: currentValues.peopleRec.person_id,
                    mode: 'new',
                    formData: {
                      document_id: this_doc.document_id,
                      doc_reference: `${this_doc.document_title}`
                    }
                  }}
                  onClose={() => {
                    reactData.recentlyCompletedDocs[docNdx].amendmentPending = false;
                    updateReactData({
                      recentlyCompletedDocs: reactData.recentlyCompletedDocs
                    }, true);
                  }}
                />
              }
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
    </React.Fragment>
  );
};;