import React from 'react';
import useSession from '../../hooks/useSession';

import { dbClient, recordExists, cl, deepCopy, array_in_array } from '../../util/AVAUtilities';
import { AVATextStyle } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';

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

  const checkCircleDisplayed = React.useRef(false);
  const circleDisplayed = React.useRef(false);
  const orangeCircleDisplayed = React.useRef(false);
  const redCircleDisplayed = React.useRef(false);

  const redPencilDisplayed = React.useRef(false);
  const orangePencilDisplayed = React.useRef(false);
  const greenPencilDisplayed = React.useRef(false);
  const pencilDisplayed = React.useRef(false);

  const addAmendmentDisplayed = React.useRef(false);
  const historyAmendmentDisplayed = React.useRef(false);
  const historyDisplayed = React.useRef(false);

  async function initialize() {
    let masterFormList = {};
    if (!reactData.groupObj) {
      if (!state.groups) {
        if (isMounted.current) {
          updateReactData({
            alert: {
              severity: 'warning',
              title: 'Still loading Group information',
              message: `AVA is still loading.  Wait just a moment and try again, please.`
            }
          }, true);
          return;
        }
      }
      else {
        updateReactData({
          groupObj: deepCopy(state.groups)
        }, true);
      }
    }
    // get all the groups that this person belongs to
    // and build myFormListObj with one object for each form assigned to members of this person's groups
    let my_form_people = [currentValues.peopleRec.person_id];

    // If I'm the primary contact for a family, then I need to get the forms for all the family members as well.
    if ((currentValues.peopleRec.myFamilyMembers || []).length > 0) {
      if (currentValues.peopleRec.myFamilyMembers.some(this_person => {
        if (this_person.id === currentValues.peopleRec.person_id) {
          return this_person.primary;
        }
        else {
          return false;
        }
      })) {
        my_form_people = [];
        currentValues.peopleRec.myFamilyMembers.forEach(this_person => {
          my_form_people.push(this_person.id);
        });
      }
    }

    // my_form_people is now an array of person_ids that I need to get forms for.  Loop through each one and build the masterFormList object

    // myFormListObj is an object; each key is a form_id (form type)
    // For each form_id, the value is an object with the formRec, the form_name, the options, and...
    // Since you may have one or many finished documents that are of this form type, there are arrays for wipDocs, assignedDocs, and completedDocs

    // we're building a masterFormList object; each key is a person_id, 
    // The value is an object with the person's name and their myFormListObj

    // Along the course of this looping, we're going tmake a list of the Categories of Forms that are in the list
    // If we end up with more than one Category, we're going to display the Forms by Category, then Person, then Form, then Document List
    let categoryList = new Set();

    for (let this_person of my_form_people) {
      let myFormListObj = {};
      let myPersonRec = await dbClient
        .get({
          Key: {
            person_id: this_person
          },
          TableName: "People"
        })
        .promise()
        .catch(error => {
          console.log({ 'Error reading People': error });
        });
      if (recordExists(myPersonRec)) {
        for (let this_groupID of myPersonRec.Item.groups) {
          // get all the forms that are assigned people in this group 
          let this_group;
          let groupRec = await dbClient
            .get({
              Key: {
                client_id: state.session.client_id,
                group_id: this_groupID
              },
              TableName: "Groups"
            })
            .promise()
            .catch(error => {
              console.log({ 'Error reading Groups': error });
            });
          if (recordExists(groupRec)) {
            this_group = groupRec.Item;
          }
          if (this_group && this_group.forms) {
            for (let this_form of this_group.forms) {
              let view_only = false;
              const formRec = await getForm(this_form);
              if (formRec) {
                if (formRec?.options?.restricted_access && !reactData.administrative_account) {
                  if (formRec.options.restricted_access === 'admin_only') {
                    continue;
                  }
                  if (formRec.options.restricted_access === 'view_only') {
                    view_only = true;
                  }
                }
                myFormListObj[this_form] = Object.assign({}, formRec, {
                  why: this_group.group_name,
                  form_id: this_form,
                  form_name: formRec.form_name,
                  formRec: formRec,
                  options: formRec.options || {},
                  //             dueDate: formData.due_date,
                  view_only,
                  wipDocs: [],
                  assignedDocs: [],
                  completedDocs: [],
                  isUpdating: false,
                  isAmending: false
                });
                categoryList.add((formRec.category || 'Uncategorized').trim());
              }
            }
          }
        }
        // get all Documents for this person
        let allDocs = await dbClient
          .query({
            KeyConditionExpression: 'pertains_to = :p',
            IndexName: 'person_form-index',
            TableName: 'DocumentMaster',
            ExpressionAttributeValues: {
              ':p': this_person
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
            if (!myFormListObj.hasOwnProperty(this_doc.form_type)) {
              let view_only = false;
              const formRec = await getForm(this_doc.form_type);
              if (formRec?.options?.restricted_access && !reactData.administrative_account) {
                if (formRec.options.restricted_access === 'admin_only') {
                  continue;
                }
                if (formRec.options.restricted_access === 'view_only') {
                  view_only = true;
                }
              }
              myFormListObj[this_doc.form_type] = Object.assign({}, formRec, {
                why: `Assigned by ${this_doc.history[this_doc.history.length - 1].update_by}`,
                form_id: this_doc.form_type,
                form_name: formRec.form_name || this_doc.form_type,
                //            dueDate: formData.due_date,
                options: formRec.options || {},
                view_only,
                wipDocs: [],
                assignedDocs: [],
                completedDocs: [],
                isUpdating: false,
                isAmending: false
              });
              categoryList.add((formRec.category || 'Uncategorized').trim());
            }
            if ((this_doc.status === 'complete') || (this_doc.status === 'save_final')) {
              // does this have an occerrence date?
              let occDate;
              if (this_doc.occurrence) {
                occDate = this_doc.occurrence;
              }
              else {
                let splitter = this_doc.document_id.split('#');
                let candidate = Number(splitter[splitter.length - 1]);
                if (!isNaN(candidate)) {
                  occDate = candidate;
                }
                else {
                  occDate = 0;
                }
              }
              const cObj = {
                document_id: this_doc.document_id,
                location: this_doc.history[0].url,
                last_update: this_doc.history[0].last_update,
                date_completed: makeDate(this_doc.history[0].last_update).relative,
                title: this_doc.title,
                amendments: this_doc.amendments,
                occDate: occDate
              };
              myFormListObj[this_doc.form_type].completedDocs.push(cObj);
            }
            else if ((this_doc.status === 'in_process') || (this_doc.status === 'pending')) {
              const wipDoc = {
                document_id: this_doc.document_id,
                last_update: this_doc.history[0].last_update,
                field_values: this_doc.field_values,
                doc_status: await setPersonalStatus({ docRec: this_doc, formRec: myFormListObj[this_doc.form_type].formRec }),
                due_date: this_doc.due_date || myFormListObj[this_doc.form_type].dueDate,
                title: this_doc.title
              };
              const shouldUnshift = (myFormListObj[this_doc.form_type].wipDocs.length > 0) && (myFormListObj[this_doc.form_type].wipDocs[0].last_update < this_doc.history[0].last_update);
              myFormListObj[this_doc.form_type].wipDocs[shouldUnshift ? 'unshift' : 'push'](wipDoc);
            }
            else {
              myFormListObj[this_doc.form_type].assignedDocs.push({
                document_id: this_doc.document_id,
                last_update: this_doc.history[0].last_update,
                field_values: this_doc.field_values,
                due_date: this_doc.due_date || myFormListObj[this_doc.form_type].dueDate,
                title: this_doc.title
              });
            }
          }
        }
        for (let this_type in myFormListObj) {
          myFormListObj[this_type].completedDocs.sort((a, b) => {
            return ((a.occDate > b.occDate) ? -1 : 1);
          });
        }
        masterFormList[myPersonRec.Item.person_id] = {
          person_id: myPersonRec.Item.person_id,
          person_first_name: myPersonRec.Item.name.first,
          myFormListObj
        };
      }
    }
    updateReactData({
      masterFormList,
      masterCategoryList: Array.from(categoryList),
      showCategoryList: categoryList.size > 1,
      formsInitialized: true
    }, true);
  }

  async function getForm(form_id) {
    let formRecIn = await dbClient
      .get({
        Key: {
          client_id: state.session.client_id,
          form_id: form_id
        },
        TableName: "Forms"
      })
      .promise()
      .catch(error => {
        cl({ [`Error reading Forms key=${form_id}`]: error });
      });
    if (recordExists(formRecIn)) {
      return formRecIn.Item;
    }
    else { return false; }
  }

  const okToShowSection = ({ this_sectionObj, docRec }) => {
    if (this_sectionObj.hasOwnProperty('show_if')) {
      return (this_sectionObj.show_if.some(this_test => {
        if (this_test.hasOwnProperty('pertainsTo_memberOf')) {
          // in this unique case, the section will show or not show regardless of who the current user is
          // therefore, it won't influence any per-user status
          // we need to ignore this section for the overall status, and therefore return false
          return false;
        }
        else if (this_test.hasOwnProperty('memberOf')) {
          return state.patient.groups.some(g => {
            return [this_test.memberOf].flat().includes(g);
          });
        }
        else {
          const this_value = docRec.field_values?.[this_test.field]?.value;
          return (array_in_array(this_test.values, this_value));
        }
      }));
    }
    else {
      return true;
    }
  };

  const setPersonalStatus = async ({ docRec, formRec }) => {
    // The goal here is to figure out what status shuold be displayed for this specific user.
    // If the document has multiple stages, this user may have finished all the stages they have access to,
    //       There may be other people that have to complete other stages.
    //       So we need to look at the document stages and see if there are any stages that this user has access to that are incomplete.
    //      If so, the status is incomplete.
    // This helper will return one of these values: 'complete', 'incomplete', 'pending_review', 'not_started'
    if (!docRec) { return 'not_started'; }
    if (docRec.status === 'complete') {
      return 'complete';
    }
    // not complete, but there IS a document, so it has been started... is it pending review?
    // get the form definition

    if (!formRec) { return 'not_started'; }

    // get the document stages
    let docStages = formRec.stages || [];

    // Ensure 'default' is first and 'complete' is last
    // Remove any existing 'default' and 'complete' entries
    docStages = docStages.filter(stage => !['default', 'complete'].includes(stage?.stage_name));

    // Build final stages array with default first and complete last
    const finalStages = [{ stage_name: 'default' }];

    // Add any stages from formRec that aren't default or complete
    for (const stage of docStages) {
      if (!finalStages.some(s => s.stage_name === stage.stage_name)) {
        finalStages.push(stage);
      }
    }

    // Ensure 'complete' is always last
    finalStages.push({ stage_name: 'complete' });
    docStages = finalStages;

    // Now, for each stage, determine if this user has access to it
    // the document itself stores its highest completed stage in docRec.form_stage, we will check this in a moment
    // find the index of that stage in the docStages array
    let docCurrentStageIndex = docStages.findIndex(s => s.stage_name === (docRec.form_stage || 'default'));
    for (const this_section of formRec.sections) {
      if (okToShowSection({ this_sectionObj: this_section, docRec })) {
        // so... we have a section that matters.   Does that section belong to a stage that is AFTER the document's stage?
        // what is the index of the belongs to stage in the docStages array?
        let stageIndex = docStages.findIndex(s => s.stage_name === (this_section.belongs_to_stage || 'default'));
        // Note: if belongs_to_stage doesn't exist in the finalStages array, we'll not consider it for incomplete...
        // does this stage come after the document's current stage?
        // If it DOES, then there are still stages that this user needs to complete - return incomplete 
        if (stageIndex > docCurrentStageIndex) {
          return 'incomplete';
        }
      }
    }
    return 'pending_review';
  };


  const setPencilColor = (rObj) => {
    // rObj is coming from myDocs
    if (rObj && rObj.wipDocs.length > 0) {
      if ((rObj.wipDocs[0].doc_status === 'incomplete') || (rObj.wipDocs[0].doc_status.startsWith('pending'))) {
        orangePencilDisplayed.current = true;
        return 'orange';
      }
      else {
        greenPencilDisplayed.current = true;
        return 'green';
      }
    }
    else if (!rObj || (rObj.completedDocs.length > 0)) {
      greenPencilDisplayed.current = true;
      return 'green';
    }
    else {
      redPencilDisplayed.current = true;
      return 'red';
    }
  };

  const setCheckCircleColor = (rObj) => {
    if (!rObj) {
      checkCircleDisplayed.current = true;
      return 'green';
    }
    else if (rObj.completedDocs && (rObj.completedDocs.length > 0)) {
      circleDisplayed.current = true;
      return 'green';
    }
    else if (rObj.wipDocs.length > 0) {
      orangeCircleDisplayed.current = true;
      return 'orange';
    }
    else {
      redCircleDisplayed.current = true;
      return 'red';
    }
  };

  const setRefTrue = (refToSet) => {
    if (refToSet) {
      refToSet.current = true;
    }
    return null;
  };

  React.useEffect(() => {
    initialize();
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const editForm = (this_person_id, this_formID) => {
    if (reactData.masterFormList[this_person_id].myFormListObj[this_formID].wipDocs.length > 0) {
      reactData.masterFormList[this_person_id].myFormListObj[this_formID].isUpdating = reactData.masterFormList[this_person_id].myFormListObj[this_formID].wipDocs[0].document_id;
    }
    else if (reactData.masterFormList[this_person_id].myFormListObj[this_formID].assignedDocs.length > 0) {
      reactData.masterFormList[this_person_id].myFormListObj[this_formID].isUpdating = reactData.masterFormList[this_person_id].myFormListObj[this_formID].assignedDocs[0].document_id;
    }
    else {
      reactData.masterFormList[this_person_id].myFormListObj[this_formID].isUpdating = 'new';
    }
    updateReactData({
      masterFormList: reactData.masterFormList
    }, true);
  };

  return (
    <React.Fragment
      key={`master_frag`}
    >
      {!reactData.formHistoryMode && reactData.formsInitialized &&
        <Box
          key={`DocSection_masterBox`}
          flexGrow={2} px={2} pt={'24px'} pb={'8px'} display='flex' flexDirection='column'
        >
          {isMounted.current && reactData.formsInitialized && Object.keys(reactData.masterFormList).length === 0 &&
            <Typography
              style={AVATextStyle({ margin: { left: 3, top: 1, bottom: 1 } })}
            >
              {`No Forms were found for you.`}
            </Typography>
          }
          {(reactData.masterCategoryList || ['Uncategorized']).map((this_category, cat_index) => {
            this_category = this_category.trim() || 'Uncategorized';
            return (
              <React.Fragment key={`category_frag${cat_index}`}>
                {(reactData.showCategoryList || state.session.form_category_text?.[this_category]?.text) &&
                  <Typography
                    key={`myCat_${cat_index}`}
                    style={AVATextStyle({
                      size: 1.3,
                      italic: true,
                      margin: { top: 1, left: 0 },
                    })}
                  >
                    {state.session.form_category_text?.[this_category]?.text || this_category}
                  </Typography>
                }
                {Object.values(reactData.masterFormList).map(({
                  person_id,
                  person_first_name,
                  myFormListObj }, pIndex) => (
                  <React.Fragment key={`person_filter${cat_index}_${pIndex}`}>
                    {Object.keys(myFormListObj).some((this_formID) => {
                      const myDocs = reactData.masterFormList[person_id].myFormListObj[this_formID];
                      return (((myDocs.category || '').trim() === this_category) || !reactData.showCategoryList);
                    }) &&
                      <React.Fragment
                        key={`myName_frag${pIndex}`}
                      >

                        <Typography
                          key={`myName_${cat_index}_${pIndex}`}
                          style={AVATextStyle({
                            size: 1.35,
                            bold: true,
                            margin: { top: 1, left: 0 },
                          })}
                        >
                          {`${person_first_name}'s Forms`}
                        </Typography>
                        {
                          Object.keys(myFormListObj).map((this_formID, form_index) => {
                            const myDocs = reactData.masterFormList[person_id].myFormListObj[this_formID];
                            if (((myDocs.category || '').trim() === this_category) || !reactData.showCategoryList) {
                              return (
                                <React.Fragment
                                  key={`wrapperFrag-col_form${cat_index}_${pIndex}_${form_index}`}
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
                                      {((myDocs.completedDocs.length > 0) &&
                                        (myDocs.wipDocs.length === 0)) ?
                                        <React.Fragment>
                                          <CheckCircleIcon
                                            key={`radio-button_form${form_index}off`}
                                            id={`radio-button_form${form_index}off`}
                                            style={AVATextStyle({
                                              color: setCheckCircleColor(),
                                              size: 1.5,
                                              margin: { right: 0.5 },
                                            })}
                                            onClick={() => {
                                              editForm(person_id, this_formID);
                                            }}
                                            size='small'
                                          />
                                        </React.Fragment>
                                        :
                                        ((!myDocs.view_only
                                          || (
                                            (myDocs.wipDocs.length > 0)
                                            && myDocs.wipDocs[0].hasOwnProperty('assigned_to')
                                            && myDocs.wipDocs[0].assigned_to.hasOwnProperty(state.session.patient_id)
                                            && myDocs.wipDocs[0].assigned_to[state.session.patient_id] !== 'view_only'
                                          )
                                        )
                                          ?
                                          <React.Fragment>
                                            <EditIcon
                                              key={`radio-button_form${form_index}edit`}
                                              id={`radio-button_form${form_index}edit`}
                                              onClick={() => {
                                                editForm(person_id, this_formID);
                                              }}
                                              style={AVATextStyle({
                                                size: 1.5,
                                                margin: { right: 0.5 },
                                                color: setPencilColor(myDocs)
                                              })}
                                              size='small'
                                            />
                                          </React.Fragment>
                                          :
                                          <React.Fragment>
                                            <RadioButtonUncheckedIcon
                                              key={`radio-button_open_form${form_index}edit`}
                                              style={AVATextStyle({
                                                size: 1.5,
                                                margin: { right: 0.5 },
                                                color: setCheckCircleColor(myDocs)
                                              })}
                                              size='small'
                                            />
                                          </React.Fragment>

                                        )
                                      }
                                      {(() => {
                                        const pencilColor = setPencilColor(myDocs);
                                        return (
                                          <Box display='flex' alignItems='flex-start'
                                            justifyContent='center' flexDirection='column'
                                            flexWrap='wrap'
                                          >
                                            <Typography
                                              key={`name-col_form${form_index}`}
                                              onClick={() => {
                                                editForm(person_id, this_formID);
                                              }}
                                              style={AVATextStyle({
                                                size: 1.5,
                                                margin: { left: 0 },
                                                color: (pencilColor || null),
                                              })}
                                            >
                                              {myDocs.form_name}
                                            </Typography>
                                            {(myDocs.dueDate || (myDocs.wipDocs.length > 0)) &&
                                              <Typography
                                                key={`duedate-col_form${form_index}t1`}
                                                style={AVATextStyle({
                                                  size: 0.8,
                                                  margin: { top: 0, left: 0 },
                                                  color: (pencilColor || null),
                                                })}
                                              >
                                                {(myDocs.wipDocs.length > 0)
                                                  ? `${((pencilColor === 'green') ? 'Your sections are Complete!' : 'Started but incomplete')}`
                                                  : `Not started`
                                                }
                                                {(myDocs.dueDate) &&
                                                  ` - Due by ${makeDate(myDocs.dueDate).relative}`
                                                }
                                              </Typography>
                                            }
                                            {(myDocs.completedDocs.length > 0) &&
                                              <React.Fragment>
                                                <Typography
                                                  key={`duedate-col_form${form_index}t2`}
                                                  style={AVATextStyle({
                                                    size: 0.8,
                                                    margin: { top: 0, left: 0 },
                                                  })}
                                                >
                                                  {myDocs.completedDocs[0].title}
                                                </Typography>
                                                <Typography
                                                  key={`duedate-col_form${form_index}t3`}
                                                  style={AVATextStyle({
                                                    size: 0.8,
                                                    margin: { top: 0, left: 0 },
                                                  })}
                                                >
                                                  {`${((myDocs.dueDate || (myDocs.wipDocs.length > 0)) ? 'Previously c' : 'C')}ompleted ${makeDate(myDocs.completedDocs[0].last_update).relative}`}
                                                </Typography>
                                              </React.Fragment>
                                            }
                                          </Box>
                                        );
                                      })()}
                                    </Box>
                                    <Box
                                      display='flex'
                                      flexDirection='row'
                                      key={`radio-row_form__buttons${form_index}`}
                                      justifyContent='center'
                                      alignItems='center'
                                    >
                                      {(myDocs.completedDocs.length > 0) &&
                                        <React.Fragment>
                                          {myDocs.options?.allowAmendments &&
                                            reactData.administrative_account &&
                                            <React.Fragment>
                                              <AddCircleIcon
                                                style={AVATextStyle({ margin: { right: 0.1 }, color: setRefTrue(addAmendmentDisplayed) })}
                                                onClick={() => {
                                                  myDocs.isAmending = myDocs.completedDocs[0].document_id;
                                                  updateReactData({
                                                    isAmendingForm: {
                                                      person_id,
                                                      form_id: this_formID,
                                                      document_id: myDocs.completedDocs[0].document_id
                                                    },
                                                    myFormListObj: reactData.masterFormList[person_id].myFormListObj
                                                  }, true);
                                                }}
                                              />
                                            </React.Fragment>
                                          }
                                          {(myDocs.completedDocs.length > 1) &&
                                            <React.Fragment >
                                              <DynamicFeedIcon
                                                style={AVATextStyle({ margin: { right: 0.1 }, color: setRefTrue(historyDisplayed) })}
                                                onClick={() => {
                                                  updateReactData({
                                                    formHistoryMode: {
                                                      person_id,
                                                      this_formID
                                                    }
                                                  }, true);
                                                }}
                                              />
                                            </React.Fragment>
                                          }
                                          {(myDocs.wipDocs.length === 0) &&
                                            (reactData.administrative_account || !myDocs.view_only) &&
                                            <React.Fragment>
                                              <EditIcon
                                                style={AVATextStyle({ margin: { right: 0.1 }, color: setPencilColor() })}
                                                key={`radio-button_form${form_index}add`}
                                                id={`radio-button_form${form_index}add`}
                                                onClick={() => {
                                                  editForm(person_id, this_formID);
                                                }}
                                                size='small'
                                              />
                                            </React.Fragment>
                                          }
                                        </React.Fragment>
                                      }
                                    </Box>
                                  </Box>
                                  {myDocs.isUpdating &&
                                    <FormFillB
                                      key={`docPerson-${this_formID}_update_ffB`}
                                      request={(myDocs.isUpdating === 'new') ?
                                        {
                                          form_id: this_formID,
                                          person_id: person_id || currentValues.peopleRec.person_id,
                                          mode: 'new',
                                        }
                                        :
                                        {
                                          form_id: this_formID,
                                          document_id: myDocs.isUpdating,
                                          person_id: person_id || currentValues.peopleRec.person_id,
                                        }}
                                      onClose={async (ignore_me, statusObj) => {
                                        myDocs.isUpdating = false;
                                        updateReactData({
                                          masterFormList: reactData.masterFormList
                                        }, false);
                                        await initialize();
                                      }}
                                    />
                                  }
                                  {myDocs.isPrinting &&
                                    <FormFillB
                                      key={`docPerson-${this_formID}_print_ffB`}
                                      request={{
                                        form_id: myDocs.form_id,
                                        mode: 'printEmpty'
                                      }}
                                      onClose={() => {
                                        myDocs.isPrinting = false;
                                        updateReactData({
                                          masterFormList: reactData.masterFormList
                                        }, true);
                                      }}
                                    />
                                  }
                                </React.Fragment>
                              );
                            }
                            else {
                              return null;
                            }
                          })
                        }
                      </React.Fragment>
                    }
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
        </Box >
      }
      {reactData.isViewingForm &&
        <FormFillB
          key={`docPerson-viewing_ffB`}
          request={{
            form_id: reactData.isViewingForm.form_id,
            person_id: currentValues.peopleRec.person_id,
            mode: 'viewOnly',
            viewOnly: true,
            formRec: reactData.masterFormList[reactData.isViewingForm.person_id].myFormListObj[reactData.isViewingForm.form_id].formRec,
            options: { viewOnly: true },
          }}
          onClose={() => {
            reactData.masterFormList[reactData.isViewingForm.person_id].myFormListObj[reactData.isViewingForm.form_id].isViewing = false;
            updateReactData({
              isViewingForm: false,
              masterFormList: reactData.masterFormList
            }, true);
          }}
        />
      }

      {reactData.isAmendingForm &&
        <FormFillB
          key={`docPerson-amending_ffB`}
          request={{
            form_id: reactData.masterFormList[reactData.isAmendingForm.person_id][reactData.isAmendingForm.form_id].options?.allowAmendments || 'amendment_1',
            person_id: currentValues.peopleRec.person_id,
            mode: 'new',
            formData: {
              document_id: reactData.isAmendingForm.document_id,
              doc_reference: reactData.masterFormList[reactData.isAmendingForm.person_id][reactData.isAmendingForm.form_id].completedDocs[0].title
            }
          }}
          onClose={() => {
            reactData.masterFormList[reactData.isAmendingForm.person_id][reactData.isAmendingForm.form_id].isAmending = false;
            updateReactData({
              isAmendingForm: false,
              masterFormList: reactData.masterFormList
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
            {`History - ${reactData.masterFormList[reactData.formHistoryMode.person_id].myFormListObj[reactData.formHistoryMode.this_formID].form_name}`}
          </Typography>
          {reactData.masterFormList[reactData.formHistoryMode.person_id].myFormListObj[reactData.formHistoryMode.this_formID].completedDocs.map((this_doc, docNdx) => (
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
                  {reactData.masterFormList[reactData.formHistoryMode.person_id].myFormListObj[reactData.formHistoryMode.this_formID].options?.allowAmendments &&
                    reactData.administrative_account &&
                    <React.Fragment>
                      <AddCircleIcon
                        style={AVATextStyle({ margin: { right: 0.1 }, color: setRefTrue(historyAmendmentDisplayed) })}
                        onClick={() => {
                          reactData.masterFormList[reactData.formHistoryMode.person_id].myFormListObj[reactData.formHistoryMode.this_formID].isAmending = this_doc.document_id;
                          updateReactData({
                            isAmendingForm: {
                              form_id: reactData.formHistoryMode,
                              document_id: this_doc.document_id
                            },
                            masterFormList: reactData.masterFormList
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
        Object.keys(reactData.masterFormList).length > 0 &&
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
          {checkCircleDisplayed.current &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons_complete`}
            >
              <CheckCircleIcon
                style={AVATextStyle({ color: 'green', margin: { right: 0.1 } })}
                key={`radio-guide_e_button_complete`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ color: 'green', margin: { right: 1 }, size: 0.8 })}
              >
                {`View a completed form`}
              </Typography>
            </Box>
          }
          {(circleDisplayed.current || redCircleDisplayed.current || orangeCircleDisplayed.current) &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2_noview`}
            >
              <RadioButtonUncheckedIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: (redCircleDisplayed.current ? 'red' : (orangeCircleDisplayed.current ? 'orange' : null)) })}
                key={`radio-guide_e_button_noview`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: (redCircleDisplayed.current ? 'red' : (orangeCircleDisplayed.current ? 'orange' : null)) })}
              >
                {`You will be able to view this form after it is completed`}
              </Typography>
            </Box>
          }
          {redPencilDisplayed.current &&
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
          {orangePencilDisplayed.current &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2_orange`}
            >
              <EditIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: 'orange' })}
                key={`radio-guide_e_button2`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: 'orange' })}
              >
                {`Update an incomplete or pending form`}
              </Typography>
            </Box>
          }
          {greenPencilDisplayed.current &&
            <Box display='flex'
              flexDirection='row'
              key={`radio-guide_e_buttons2_green`}
            >
              <EditIcon
                style={AVATextStyle({ margin: { right: 0.1 }, color: 'green' })}
                key={`radio-guide_e_button2`}
                size='small'
              />
              <Typography
                style={AVATextStyle({ margin: { right: 1 }, size: 0.8, color: 'green' })}
              >
                {`Make changes to a form you already completed`}
              </Typography>
            </Box>
          }
          {addAmendmentDisplayed.current &&
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
          {pencilDisplayed.current &&
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
          {historyDisplayed.current &&
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
        historyAmendmentDisplayed.current &&
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
          {historyAmendmentDisplayed.current &&
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