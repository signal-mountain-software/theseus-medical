
import React from 'react';

import { getPerson, getImage } from '../../util/AVAPeople';
import { deepCopy, isEmpty, dbClient, cl, recordExists, switchActiveAccount, titleCase } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, isDark } from '../../util/AVAStyles';
import { determineClass, doesPersonMatchGroupRules } from '../../util/AVAGroups';

import useSession from '../../hooks/useSession';

import ProfileSection from '../sections/ProfileSection';
import AdministrativeSection from '../sections/AdministrativeSection';
import Snapshot from '../sections/Snapshot';
import FormSection from '../sections/FormSection';
import TechInfoSection from '../sections/TechInfoSection';
import MessagePreferencesSection from '../sections/MessagePreferencesSection';
import PersonNotes from './PersonNotes';
import CheckoutHistory from './CheckoutHistory';
import LinkedAccounts from '../sections/LinkedAccounts';
import PersonalizationSection from '../sections/PersonalizationSection';
import GroupAssignments from '../sections/GroupAssignments';

import { Snackbar, Button, Avatar, Box, Dialog, Typography, Menu, MenuList, MenuItem, Paper } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import HomeIcon from '@material-ui/icons/Home';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';

import makeStyles from '@material-ui/core/styles/makeStyles';
const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    margin: 0,
    maxHeight: '98%',
    maxWidth: '800px'
  },
  padRight: {
    marginRight: theme.spacing(2),
  },
}));

export default ({ patient, person_id, personRec, initialValues, options = {}, onClose }) => {

  const isMounted = React.useRef(false);
  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const [reactData, setReactData] = React.useState({
    initialized: false,
    popupMenuOpen: false,
    person_id: person_id || state.session.patient_id,
    accessList: null,
    isMobile: (window.window.innerWidth < 800),
    client_name: state.session.client_name,
    linkedPersonFilter: {},
    mode: options.mode || 'edit',
    sectionList: options.sectionList || false,
    addFamilyMember: false,
    viewFamilyMember: false,
    myFamilyData: [],
    showQuickSearch: false,
    user_id: state.user.person_id,
    focusAt: null,
    formHistoryMode: false,
    isAmendingForm: false,
    recentlyCompletedDocs: [],
    addAccountList: [],
    familyFormsObj: {},
    inactive_groups: (state.session.group_assignments ? state.session.group_assignments.inactive : []),
    new_messaging_required: !state.session.client_style.allow_old_messaging,
    mandatory_passwords: state.session.client_style.mandatory_passwords,
    local_customFields: ((state.session.local_data && (Object.keys(state.session.local_data).length > 0)) ? state.session.local_data : {}),
    user_class: state.user.account_class,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    master_account: (state.user.account_class === 'master'),
    OKtoSave: false,
    saveCompleted: false,
    alert: false,
    myFormListObj: {},
    formsInitialized: false,
    myImage: (options.mode === 'add') ? '' : getImage(person_id || patient?.person_id || personRec?.person_id || state.session.patient_id),
    image_editing: false,
    components: {
      Snapshot: {
        component_id: Snapshot,
      },
      ProfileSection: {
        component_id: ProfileSection,
      },
      AdministrativeSection: {
        component_id: AdministrativeSection,
      },
      MessagePreferencesSection: {
        component_id: MessagePreferencesSection,
      },
      LinkedAccounts: {
        component_id: LinkedAccounts,
      },
      PersonalizationSection: {
        component_id: PersonalizationSection
      },
      GroupAssignments: {
        component_id: GroupAssignments,
      },
      PersonNotes: {
        component_id: PersonNotes,
      },
      CheckoutHistory: {
        component_id: CheckoutHistory
      },
      TechInfoSection: {
        component_id: TechInfoSection
      },
      FormSection: {
        component_id: FormSection,
      },

    },
    og: {
      peopleRec: false,
      sessionRec: false,
      familyRecs: false,
      peopleAccountRecs: false,     // array of objects
      peopleGroups: false,
    },
    current: {
      peopleRec: {},
      sessionRec: {},
      familyRecs: [{}],
      peopleAccountRecs: [{}],
      peopleGroups: [{}],
    },
    errorList: {},
    options
  });

  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    if (isMounted.current) {
      setReactData((prevValues) => (Object.assign(
        prevValues,
        newData
      )));
      if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
    }
  };

  const onExit = (returnObj) => {
    //    AVADefaults({ fontSize: state.user?.customizations?.font_size || 1 });
    onClose(returnObj);
  };

  React.useEffect(() => {
    async function initialize() {
      let reactUpdObj = {
        initialized: true,
      };
      // incoming personRec should tell us who we are editing here
      let parm_personRec = Object.assign({}, { person_id: person_id }, (patient || {}), (personRec || {}));
      reactUpdObj.og = {};
      if (!parm_personRec.person_id || parm_personRec.person_id.startsWith('*NEW~') || options.newPerson) {
        reactUpdObj.mode = 'add';
        reactUpdObj.og.peopleRec = Object.assign({},
          {
            inbound_customizations: {},
            name: { first: '', last: '' }
          },
          initialValues?.peopleRec);
        reactUpdObj.og.sessionRec = Object.assign({},
          {
            customizations: { font_size: 1 },
            forceSetPassword: false,
            resopnsible_for: []
          },
          initialValues?.sessionRec
        );
        reactUpdObj.og.familyRecs = [Object.assign({},
          initialValues?.familyRec
        )];
      }
      else {
        reactUpdObj.person_id = parm_personRec.person_id;
        let foundPeopleRec = await dbClient
          .get({
            Key: { person_id: parm_personRec.person_id },
            TableName: "People"
          })
          .promise()
          .catch(error => {
            cl({ [`in People Maintenance, Error reading ${parm_personRec.person_id}`]: error });
          });
        if (recordExists(foundPeopleRec)) {
          let peopleRec = deepCopy(foundPeopleRec.Item);
          // convert from earlier versions if necessary
          if (!peopleRec.contact_info) {
            peopleRec.contact_info = {
              cell: { number: peopleRec.messaging?.sms },
              landline: { number: peopleRec.messaging?.voice },
              work: { number: peopleRec.messaging?.office },
              email: { address: peopleRec.messaging?.email },
            };
          }
          else if (!peopleRec.contact_info.landline) {
            peopleRec.contact_info.landline = { number: peopleRec.messaging?.voice };
          }
          if (!peopleRec.inbound_customizations) {
            peopleRec.inbound_customizations = {};
          }
          if (!peopleRec.account_class) {
            peopleRec.account_class = determineClass(peopleRec.groups, state.session.group_assignments);
          }
          if (peopleRec.checkout_status) {
            if (['admin', 'staff', 'resident', 'student', 'camper'].includes(peopleRec.account_class)) {
              if (peopleRec.checkout_status === 'out') {
                peopleRec.checkout_message = peopleRec.checkout_recent_history[0];
              }
              else {
                peopleRec.checkout_message = false;
              }
            }
            else {
              if (peopleRec.checkout_status === 'in') {
                peopleRec.checkout_message = peopleRec.checkout_recent_history[0];
              }
              else {
                peopleRec.checkout_message = false;
              }
            }
          }
          else {
            peopleRec.checkout_message = false;
          }

          if (!peopleRec.local_data) {
            peopleRec.local_data = {};
          }
          for (let this_customField in reactData.local_customFields) {
            if (!peopleRec.local_data.hasOwnProperty(this_customField)) {
              if ((reactData.local_customFields[this_customField].type || reactData.local_customFields[this_customField]) !== 'boolean') {
                peopleRec.local_data[this_customField] = '';
              }
              else {
                peopleRec.local_data[this_customField] = false;
              }
            }
          }

          reactUpdObj.og.familyRecs = [];
          reactUpdObj.myFamilyData = [];          
          if (peopleRec.family_groups && (peopleRec.family_groups.length > 0)) {
            for (let i = 0; i < peopleRec.family_groups.length; i++) {
              let familyRec = await dbClient
                .query({
                  KeyConditionExpression: 'family_id = :f',
                  TableName: "FamilyGroups",
                  IndexName: 'family_id-index',
                  ExpressionAttributeValues: {
                    ':f': peopleRec.family_groups[i]
                  }
                })
                .promise()
                .catch(error => { cl({ 'Error reading FamilyGroups': error }); });
              if (recordExists(familyRec)) {
                const myFamilyRec = deepCopy(familyRec.Items[0]);
                reactUpdObj.og.familyRecs[i] = myFamilyRec;
                // Primary contact?
                reactUpdObj.myFamilyData.push(Object.assign({}, myFamilyRec.primary_contact, { primary: true }));
                // Gather other members of my Family Group
                (myFamilyRec.other_members || []).forEach((this_member, member_index) => {
                  reactUpdObj.myFamilyData.push(Object.assign({}, this_member, { primary: false, other_index: member_index }));
                });
              }
              else {
                // this person is not really a member of the family_group at all
                continue;
              }
            }
            peopleRec.myFamilyMembers = reactUpdObj.myFamilyData || [];
          }
          if (!peopleRec.address) {
            peopleRec.address = {};
            if (peopleRec.location) {
              peopleRec.address = { address: peopleRec.location };
            }
          }
          if (!peopleRec.preferred_methods) {
            if (peopleRec.preferred_method) {
              if (Array.isArray(peopleRec.preferred_method)) {
                const x = peopleRec.preferred_method.length - 1;
                peopleRec.preferred_methods = [peopleRec.preferred_method[x].method.toLowerCase()];
              }
              else {
                peopleRec.preferred_methods = [peopleRec.preferred_method.toLowerCase()];
              }
            }
            else {
              peopleRec.preferred_methods = ['ava'];
            }
          }
          if (peopleRec.time_based_rules) {
            peopleRec.time_based_rules = peopleRec.time_based_rules.filter(this_rule => {
              return !this_rule.global_rule;
            });
          }
          if (state.session?.global_mail_rules?.time_based_rules) {
            let start_index = peopleRec.time_based_rules?.length || 0;
            peopleRec.time_based_rules = (peopleRec.time_based_rules || []).concat(state.session?.global_mail_rules?.time_based_rules);
            for (let i = start_index; i < peopleRec.time_based_rules.length; i++) {
              if (peopleRec.time_based_rules[i].name) {
                peopleRec.time_based_rules[i].name += ` (Administrative Rule)`;
              }
              else {
                peopleRec.time_based_rules[i].name = `${reactData.client_name} Administrative Rule`;
              }
              peopleRec.time_based_rules[i].global_rule = true;
            }
          }
          if (!peopleRec.proxy_allowed_from) {
            peopleRec.proxy_allowed_from = {};
          }
          reactUpdObj.og.peopleRec = Object.assign({}, peopleRec, initialValues?.peopleRec);
        }
        else {
          return {
            response_code: 400,
            errorMessage: `AVA doesn't recognize ID ${parm_personRec.person_id} - PeopleRec not found.`
          };
        }
        let sessionRec = await dbClient
          .get({
            Key: { session_id: parm_personRec.person_id },
            TableName: "SessionsV2"
          })
          .promise()
          .catch(error => { cl({ 'Error reading SessionsV2': error }); });
        if (recordExists(sessionRec)) {
          if (!sessionRec.Item.customizations) {
            sessionRec.Item.customizations = {};
          }
          if (!sessionRec.Item.customizations.font_size) {
            sessionRec.Item.customizations.font_size = 1;
          }
          if (!sessionRec.Item.forceSetPassword) {
            sessionRec.Item.forceSetPassword = false;
          }
          if (!sessionRec.Item.responsible_for) {
            sessionRec.Item.responsible_for = [];
          }
          reactUpdObj.og.sessionRec = sessionRec.Item;
        }
        else {
          handleAbort(parm_personRec.person_id);
          return {
            response_code: 400,
            errorMessage: `AVA doesn't recognize ID ${parm_personRec.person_id} - SessionsV2 not found.`
          };
        }
      }
      let formFieldsRec = await dbClient
        .query({
          KeyConditionExpression: 'client_id = :c',
          TableName: 'Form_Fields',
          ExpressionAttributeValues: {
            ':c': reactUpdObj.og.peopleRec.client_id
          }
        })
        .promise()
        .catch(error => { cl({ 'Error reading Form_Fields': error }); });
      reactUpdObj.form_fields = {};
      if (recordExists(formFieldsRec)) {
        for (const this_fieldRec of formFieldsRec.Items) {
          if (this_fieldRec.showOnProfile && this_fieldRec.value.saveAs) {
            if ((this_fieldRec.value.saveAs.startsWith('personRec.')) || (this_fieldRec.value.saveAs.startsWith('peopleRec.'))) {
              this_fieldRec.value.saveAs = this_fieldRec.value.saveAs.replace('personRec.', 'peopleRec.');
            }
            reactUpdObj.form_fields[this_fieldRec.field_name] = {
              fieldRec: this_fieldRec,
              prompt: this_fieldRec.prompt.value,
              value: unresolve({ object: reactUpdObj.og, key: this_fieldRec.value.saveAs.split('.') }),
              snapshot: this_fieldRec.showOnSnapshot || false
            };
          }
        }
      }
      reactUpdObj.sections = [{
        section_name: 'Snapshot',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().some(this_optionSection => { return (this_optionSection.toLowerCase() === 'snapshot'); })) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList && reactData.sectionList.includes('snapshot'))),
        version_id: 0,
        component_name: 'Snapshot'
      },
      {
        section_name: 'Additional Data',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('AdministrativeSection')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('admin') : true)),
        version_id: 0,
        component_name: 'AdministrativeSection'
      },
      {
        section_name: 'Name & Contact info',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('ProfileSection')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('contact') : true)),
        version_id: 0,
        component_name: 'ProfileSection'
      },
      {
        section_name: 'Messaging',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('MessagePreferencesSection')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('messaging') : true)),
        version_id: 0,
        component_name: 'MessagePreferencesSection'
      },
      {
        section_name: 'My Family',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('LinkedAccounts')) : false),
        isAuthorized: (!(reactUpdObj.mode === 'add') &&
          (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('family') : true))),
        version_id: 0,
        component_name: 'LinkedAccounts'
      },
      {
        section_name: 'Photo & Personalization',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('PersonalizationSection')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('personal') : true)),
        version_id: 0,
        component_name: 'PersonalizationSection'
      },
      {
        section_name: 'Groups',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('GroupAssignments')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.administrative_account || (reactData.sectionList && reactData.sectionList.includes('groups')))),
        version_id: 0,
        component_name: 'GroupAssignments'
      },
      {
        section_name: 'Forms & Documents',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('FormSection')) : false),
        isAuthorized: (reactData.sectionList
          ? reactData.sectionList.includes('forms')
          : (state.session.client_style?.suppress_forms_in_profile ? reactData.administrative_account : true)),
        version_id: 0,
        component_name: 'FormSection'
      },
      {
        section_name: 'Notes',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('PersonNotes')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList && reactData.sectionList.includes('notes'))),
        version_id: 0,
        component_name: 'PersonNotes'
      },
      {
        section_name: 'Check-in/Check-out History',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('CheckoutHistory')) : false),
        isAuthorized: (reactData.administrative_account || (reactData.sectionList ? reactData.sectionList.includes('checkout') : true))
          && reactUpdObj.og.peopleRec.checkout_recent_history
          && (reactUpdObj.og.peopleRec.checkout_recent_history.length > 0),
        version_id: 0,
        component_name: 'CheckoutHistory'
      },
      {
        section_name: 'Password & Tech Stuff',
        color: initialValues?.color || 'orange',
        isOpen: (options?.sectionToShow ? ([options.sectionToShow].flat().includes('TechInfoSection')) : false),
        isAuthorized: reactData.administrative_account
          || (reactData.sectionList && reactData.sectionList.includes('tech')),
        version_id: 0,
        component_name: 'TechInfoSection'
      }
      ];

      if (!reactData.groupObj && state.groups && reactUpdObj.og.peopleRec.groups) {
        // check all groups you belong to - we are trying to figure out whether to show the linked account section
        // there are three states:
        //   show_linkedAccounts is ASSUMED to be on
        //   a group can explcitly disable this by including the linked_accounts.isEnabled = false
        //   ANY group with linked_accounts.isEnabled = true will override ALL others despite any other groups having linked_accounts.isEnabled = false
        let isEnabled = false;
        let isDisabled = false;
        let addAccountList = [];
        let set_sectionName = false;
        for (let this_group of reactUpdObj.og.peopleRec.groups) {
          let groupRec = await dbClient
            .get({
              Key: {
                client_id: state.session.client_id,
                group_id: this_group
              },
              TableName: "Groups"
            })
            .promise()
            .catch(error => {
              console.log({ 'Error reading Groups': error });
            });
          if (recordExists(groupRec)) {
            if (groupRec.Item.linked_accounts) {
              if (groupRec.Item.linked_accounts.hasOwnProperty('isEnabled')) {
                if (groupRec.Item.linked_accounts.isEnabled) {
                  isEnabled = true;
                }
                else {
                  isDisabled = true;
                  break;
                }
              }
              if (groupRec.Item.linked_accounts.hasOwnProperty('add_account')) {
                for (let this_type of groupRec.Item.linked_accounts.add_account) {
                  if (!addAccountList.some(existing_type => {
                    return existing_type.account_class === this_type.account_class;
                  })) {
                    addAccountList.push(this_type);
                  }
                }
              }
              if (groupRec.Item.linked_accounts.hasOwnProperty('section_name')) {
                set_sectionName = groupRec.Item.linked_accounts.section_name;
              }
            }
          }
        }
        let foundAt = reactUpdObj.sections.findIndex(this_section => {
          return (this_section.component_name === 'LinkedAccounts');
        });
        if (foundAt > -1) {
          if (isDisabled && !isEnabled) {
            reactUpdObj.sections[foundAt].isAuthorized = false;
          }
          if (set_sectionName) {
            reactUpdObj.sections[foundAt].section_name = set_sectionName;
          }
        }
        if (addAccountList.length > 0) {
          reactUpdObj.addAccountList = addAccountList;
        }
      }
      reactUpdObj.current = {
        peopleRec: deepCopy(reactUpdObj.og.peopleRec),
        sessionRec: deepCopy(reactUpdObj.og.sessionRec),
        familyRecs: deepCopy(reactUpdObj.og.familyRecs)
      };
      updateReactData(reactUpdObj, true);
      window.addEventListener('resize', handleResize);
    };
    function handleResize() {
      updateReactData({
        isMobile: (window.window.innerWidth < 800),
      }, true);
    }
    isMounted.current = true;
    if (!reactData.initialized) {
      initialize();
    }
    return () => {
      isMounted.current = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [reactData.person_id]);  // eslint-disable-line react-hooks/exhaustive-deps

  function renderSection(componentName) {
    const SectionToRender = reactData.components[componentName].component_id;
    return (
      <SectionToRender
        currentValues={reactData.current}
        ogValues={reactData.og}
        errorList={reactData.errorList}
        setError={(errorList) => {
          for (let errorObj of [errorList].flat()) {
            const { errorField, isError } = errorObj;
            if (!isError) {
              delete reactData.errorList[errorField];
            }
            else {
              reactData.errorList[errorField] = errorObj;
            }
          }
          updateReactData({
            errorList: reactData.errorList,
          }, true);
        }}
        updateField={async ({ updateList, errorObj, reactUpd }) => {
          if (reactData.mode !== 'view') {
            let reactUpdObj = {
              OKtoSave: true,
              current: reactData.current,
            };
            if (reactUpd) {
              Object.assign(reactUpdObj, reactUpd);
            };
            if (errorObj) {
              reactUpdObj.errorList = reactData.errorList;
              for (let errorItem of [errorObj].flat()) {
                const { errorField, isError } = errorItem;
                if (!isError) {
                  delete reactUpdObj.errorList[errorField];
                }
                else {
                  reactUpdObj.errorList[errorField] = errorItem;
                }
              }
            }
            for (let this_update of [updateList].flat()) {
              if (this_update) {
                const { tableName, fieldName, newData } = this_update;
                let result = resolve(reactData.current[tableName] || reactData.current[tableName], fieldName.split('.'), newData);
                reactUpdObj.current[tableName] = result;
              }
            }
            updateReactData(reactUpdObj, true);
          }
        }}
        reactData={reactData}
        updateReactData={(newData, force) => {
          updateReactData(newData, force);
        }}
        onClose={onExit}
      />);
  }

  const unresolve = ({ object, key }) => {
    const this_key = key.shift();
    if (!object || !object.hasOwnProperty(this_key)) {
      return null;
    }
    if (key.length === 0) {
      return object[this_key];
    }
    else {
      return unresolve({ object: object[this_key], key });
    }
  };

  const resolve = (object, key, value) => {
    const this_key = key.shift();
    if (key.length === 0) {
      object[this_key] = value;
      return object;
    }
    else if (!object.hasOwnProperty(this_key)) {
      let resolvedObj = resolve({}, key, value);
      object[this_key] = resolvedObj;
      return object;
    }
    else if (isEmpty(object)) {
      let resolvedObj = resolve({}, key, value);
      object = resolvedObj;
      return object;
    }
    else {
      let resolvedObj = resolve(object[this_key], key, value);
      object[this_key] = resolvedObj;
      return object;
    }
  };

  const handleAbort = (id) => {
    updateReactData({
      alert: {
        severity: 'error',
        title: 'ID Corrupted',
        message: `AVA doesn't recognize ID ${id} - SessionsV2 not found.`,
        action: [
          {
            text: `Exit`,
            function: () => {
              onExit(false);
            }
          }
        ]
      }
    }, true);
  };

  const handleExitWarning = () => {
    updateReactData({
      alert: {
        severity: 'warning',
        title: 'Changes are Pending',
        message: `There are unsaved changes.  Exit anyway?`,
        action: [
          {
            text: `Keep editing`,
            function: () => {
              updateReactData({
                alert: false
              }, true);
            }
          },
          {
            text: `Exit`,
            function: () => {
              onExit(false);
            }
          }
        ]
      }
    }, true);
  };

  const saveChanges = async () => {
    const person_id_blank = !reactData.current.peopleRec.person_id;
    const person_id_changed = reactData.current.peopleRec.person_id !== reactData.person_id;
    // Check for errors before moving forward with updates
    if (person_id_blank || person_id_changed) {
      // check person_id just before saving to assure that it hasn't been claimed between setting and saving
      let person_id_exists = false;
      if (!person_id_blank) (
        person_id_exists = await getPerson(reactData.current.peopleRec.person_id, 'validate')
      );
      if (person_id_exists || person_id_blank) {
        // it's a duplicate OR blank; fix it and abort the save with an alert message
        const { proposedID, newID } = await newUserID(reactData.current.peopleRec.person_id);
        reactData.current.peopleRec.person_id = newID;
        reactData.current.sessionRec.session_id = newID;
        reactData.current.sessionRec.user_id = newID;
        reactData.current.sessionRec.person_id = newID;
        reactData.current.sessionRec.patient_id = newID;
        if (reactData.options) {
          delete reactData.options.sectionToShow;
        }
        updateReactData({
          person_id: newID,
          current: reactData.current,
          options: reactData.options,
          alert: {
            severity: 'warning',
            title: 'Your Account ID',
            message: (person_id_blank
              ? `We set your Account ID to ${newID}.  Tap OK, then select Group(s) and make other updates as needed.`
              : `We tried Account ID of ${proposedID}, but that was already taken.  We've assigned ${newID} instead.`
            ),
            action: [
              {
                text: `OK`,
                function: () => {
                  let groupAt = reactData.sections.findIndex(g => { return g.section_name === 'Groups'; });
                  if (groupAt > -1) {
                    reactData.sections[groupAt].isOpen = true;
                  }
                  updateReactData({
                    alert: false,
                    sections: reactData.sections
                  }, true);
                }
              }
            ]
          }
        }, true);
        return false;
      };
    }
    // Evaluate dynamic groups and add/remove as needed
    if (state.groups.dynamicGroups && (state.groups.dynamicGroups.length > 0)) {
      for (let this_group of state.groups.dynamicGroups) {
        if (this_group.group_id && this_group.group_id !== '__TOP__') {
          const doesMatch = await doesPersonMatchGroupRules(state.session.client_id, this_group, reactData.current.peopleRec);
          if (doesMatch) {
            // Add the group if not already present
            if (!reactData.current.peopleRec.groups.includes(this_group.group_id)) {
              reactData.current.peopleRec.groups.push(this_group.group_id);
            }
          } else {
            // Remove the group if present
            const index = reactData.current.peopleRec.groups.indexOf(this_group.group_id);
            if (index > -1) {
              reactData.current.peopleRec.groups.splice(index, 1);
            }
          }
        }
      }
    }
    // validate that at least one group is selected (not including 'All' or '__Top__')
    let groupOK = reactData.current.peopleRec.groups.some(g => { return ((g.toLowerCase() !== 'all') && (g.toLowerCase() !== '__top__')); });
    if (!groupOK) {
      reactData.errorList['groups'] = {
        errorField: 'groups',
        errorValue: '',
        isError: true,
        errorMessage: `You must select at least one Group`
      };
      updateReactData({
        errorList: reactData.errorList,
      }, true);
      return false;
    }
    // are there new accounts that need to be created (would have been in LinkedAccounts - which is Family maintenance)
    if (reactData.current.familyRecs && (reactData.current.familyRecs.length > 0) && reactData.current.familyRecs[0].hasOwnProperty('primary')) {
      for (let this_family of reactData.current.familyRecs) {
        let primaryPersonRec = await getPerson(this_family.primary_contact.id);
        for (let this_member of this_family.other_members) {
          if (this_member.createAccount) {
            // does an account exist with this name already?  (ADD CODE LATER TO VALIDATE)
            // assign a people_id and default groups
            let names = this_member.name.split(' ');
            this_member.firstName = names.shift();
            this_member.lastName = names.join(' ').trim();
            let candidateID = (`${(this_member.firstName || '').charAt(0) || 'X'}${(this_member.lastName || '').replace(/\W/g, '')}-${state.session.client_id}`).toLowerCase();
            const { proposedID, newID } = await newUserID(candidateID);
            this_member.id = newID;
            cl(`Proposed ID ${proposedID} - ID will be ${newID}`);
            this_member.groups = ["__TOP__", "ALL"].concat(state.session.default_groups?.new_family_member || []);
            this_member.address = primaryPersonRec.address;
          }
        }
      }
    }

    reactData.person_id = reactData.current.peopleRec.person_id;

    // if the peopleRec does not have ANY preferred option for messaging, we will default it here.
    if (!reactData.current.peopleRec.preferred_methods) {
      if (reactData.current.peopleRec.preferred_method) {
        reactData.current.peopleRec.preferred_methods = [reactData.current.peopleRec.preferred_method];
      }
      else {
        if (!isEmpty(reactData.current.peopleRec.contact_info?.email?.address)) {
          reactData.current.peopleRec.preferred_methods = ['email'];
          reactData.current.peopleRec.preferred_method = 'email';
        }
        else if (!isEmpty(reactData.current.peopleRec.contact_info?.cell?.number)) {
          reactData.current.peopleRec.preferred_methods = ['sms'];
          reactData.current.peopleRec.preferred_method = 'sms';
        } 
        else if (!isEmpty(reactData.current.peopleRec.contact_info?.alt_email?.address)) {
          reactData.current.peopleRec.preferred_methods = ['alt_email'];
          reactData.current.peopleRec.preferred_method = 'alt_email';
        }
        else if (!isEmpty(reactData.current.peopleRec.contact_info?.landline?.number)) {
          reactData.current.peopleRec.preferred_methods = ['voice'];
          reactData.current.peopleRec.preferred_method = 'voice';
        }
        // set the preference based on an e-Mail first policy.  I
        // If the client preferes text first, we will honor that here
        if (((state.session.client_style.preferred_communication === 'text' ||
          state.session.client_style.preferred_communication === 'sms')) &&
          (!isEmpty(reactData.current.peopleRec.contact_info?.cell?.number))
        ) {
          reactData.current.peopleRec.preferred_methods = ['sms'];
          reactData.current.peopleRec.preferred_method = 'sms';
        }
      }
    }

    // Ensure name object exists before accessing its properties
    if (!reactData.current.peopleRec.name) {
      reactData.current.peopleRec.name = { first: '', last: '' };
    }

    let search_words = [
      titleCase(reactData.current.peopleRec.name.first || ''),
      titleCase(reactData.current.peopleRec.name.last || ''),
      (reactData.current.peopleRec.name.first || '').toLowerCase(),
      (reactData.current.peopleRec.name.last || '').toLowerCase(),
      reactData.current.peopleRec.contact_info?.cell?.number
        ? reactData.current.peopleRec.contact_info.cell.number.slice(-10)
        : (reactData.current.peopleRec.messaging?.sms ? reactData.current.peopleRec.messaging.sms.slice(-10) : ' ')
    ].filter(word => word && word.trim()); // Remove empty strings

    if (!reactData.current.peopleRec.search_data) {
      reactData.current.peopleRec.search_data = search_words.join(' ');
    }
    else {
      for (let this_word of search_words) {
        if (!reactData.current.peopleRec.search_data.includes(this_word)) {
          reactData.current.peopleRec.search_data += ' ' + this_word;
        }
      }
    }

    if (JSON.stringify(reactData.og.peopleRec) !== JSON.stringify(reactData.current.peopleRec)) {
      // **** NEED TO ADD SPECIAL HANDLING FOR CHANGE OF PRIMARY KEY ***  (likely change to inactive account?)
      reactData.current.peopleRec.last_update = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
      if (!reactData.current.peopleRec.created_on) {
        reactData.current.peopleRec.created_on = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
      }
      await dbClient
        .put({
          TableName: 'People',
          Item: reactData.current.peopleRec
        })
        .promise()
        .catch(error => {
          console.log(`caught error putting to People; error is:`, error);
        });
      // update the cross-reference table PeopleAccounts
      // Note here...  we are intentionally NOT removing old records from PeopleAccounts because we want to preserve the history of all accounts that have ever been associated with this person_id
      // This means that a mis-spelled email, phone number, or name will still be a valid cross reference.
      
      // Add new records for all phone numbers and email addresses
      const phoneFields = [
        { field: reactData.current.peopleRec.contact_info?.cell?.number?.slice(-10), type: 'phone_number' },
        { field: reactData.current.peopleRec.contact_info?.landline?.number?.slice(-10), type: 'phone_number' },
        { field: reactData.current.peopleRec.contact_info?.work?.number?.slice(-10), type: 'phone_number' },
        { field: reactData.current.peopleRec.contact_info?.alternate?.number?.slice(-10), type: 'phone_number' }
      ];
      
      const emailFields = [
        { field: reactData.current.peopleRec.contact_info?.email?.address?.toLowerCase(), type: 'eMail' },
        { field: reactData.current.peopleRec.contact_info?.alt_email?.address?.toLowerCase(), type: 'eMail' }
      ];

      const nameFields = [
        { field: (`${reactData.current.peopleRec.name?.first} ${reactData.current.peopleRec.name?.last} ${reactData.current.peopleRec.client_id}`).toLowerCase(), type: 'name' },
      ];
      
      const allFields = [...phoneFields, ...emailFields, ...nameFields];
      
      // Build batch write items for non-empty fields
      const putRequests = allFields
        .filter(accountField => !isEmpty(accountField.field))
        .map(accountField => ({
          PutRequest: {
            Item: {
              person_id: reactData.current.peopleRec.person_id,
              identifier: accountField.field,
              account_type: accountField.type
            }
          }
        }));
      
      // Write all records in a single batch operation
      if (putRequests.length > 0) {
        await dbClient
          .batchWrite({
            RequestItems: {
              'PeopleAccounts': putRequests
            }
          })
          .promise()
          .catch(error => {
            console.log(`caught error batch writing to PeopleAccounts; error is:`, error);
          });
      }
      
    }
    if (JSON.stringify(reactData.og.sessionRec) !== JSON.stringify(reactData.current.sessionRec)) {
      // **** NEED TO ADD SPECIAL HANDLING FOR CHANGE OF PRIMARY KEY ***  (likely change to inactive account?)
      reactData.current.sessionRec.last_update = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
      await dbClient
        .put({
          TableName: 'SessionsV2',
          Item: reactData.current.sessionRec
        })
        .promise()
        .catch(error => {
          console.log(`caught error putting to People; error is:`, error);
        });
    }
    if (reactData.current.familyRecs) {
      for (let i = 0; i < reactData.current.familyRecs.length; i++) {
        if (!reactData.og.familyRecs || !reactData.og.familyRecs[i]
          || (JSON.stringify(reactData.og.familyRecs[i]) !== JSON.stringify(reactData.current.familyRecs[i]))) {
          await dbClient
            .put({
              TableName: 'FamilyGroups',
              Item: reactData.current.familyRecs[i]
            })
            .promise()
            .catch(error => {
              console.log(`caught error putting to FamilyGroups; error is:`, error);
            });
          let memberList = [reactData.current.familyRecs[i].primary_contact].concat(reactData.current.familyRecs[i].other_members || []);
          if (memberList.length > 0) {
            for (let this_member of memberList) {
              if (this_member.createAccount) {
                reactData.current.peopleRec.created_on = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
                await dbClient
                  .put({
                    TableName: 'People',
                    Item: {
                      person_id: this_member.id,
                      clients: {
                        groups: this_member.groups,
                        id: state.session.client_id
                      },
                      client_id: state.session.client_id,
                      display_name: this_member.name,
                      address: this_member.address,
                      family_groups: [
                        reactData.current.familyRecs[i].family_id
                      ],
                      groups: this_member.groups,
                      name: {
                        first: this_member.firstName,
                        last: this_member.lastName
                      },
                      preferred_method: "AVA",
                      preferred_methods: [
                        "AVA"
                      ],
                      search_data: `${this_member.name} ${this_member.name.toLowerCase()} ${this_member.nickname} ${this_member.nickname.toLowerCase()}`,
                    }
                  })
                  .promise()
                  .catch(error => {
                    console.log(`caught error putting to People; error is:`, error);
                  });
                await dbClient
                  .put({
                    TableName: 'SessionsV2',
                    Item: {
                      session_id: this_member.id,
                      client_id: state.session.client_id,
                      last_login: "password",
                      method: "added as Family Member",
                      patient_display_name: this_member.name,
                      patient_id: this_member.id,
                      person_id: this_member.id,
                      requirePassword: false,
                      storePassword: true,
                      subscription_status: "na",
                      user_display_name: this_member.name,
                      user_homeClient: state.session.client_id,
                      user_id: this_member.id,
                    }
                  })
                  .promise()
                  .catch(error => {
                    console.log(`caught error putting to SessionsV2; error is:`, error);
                  });
              }
              else {
                let memberPersonRec = await getPerson(this_member.id);
                if (!memberPersonRec
                  || (memberPersonRec.family_groups && memberPersonRec.family_groups.includes(reactData.current.familyRecs[i].family_id))) {
                  continue;
                }
                else {
                  let updatedFamilyGroups = [];
                  if (!memberPersonRec.family_groups || (memberPersonRec.family_groups.length === 0)) {
                    updatedFamilyGroups = [reactData.current.familyRecs[i].family_id];
                  }
                  else {
                    updatedFamilyGroups = memberPersonRec.family_groups;
                    updatedFamilyGroups.push(reactData.current.familyRecs[i].family_id);
                  }
                  await dbClient
                    .update({
                      Key: {
                        person_id: this_member.id,
                      },
                      UpdateExpression: 'set #f = :f',
                      ExpressionAttributeValues: {
                        ':f': updatedFamilyGroups
                      },
                      ExpressionAttributeNames: {
                        '#f': 'family_groups'
                      },
                      TableName: "People",
                    })
                    .promise()
                    .catch(error => {
                      cl(`caught error updating People; error is: `, error);
                    });
                }
              }
            }
          }
        }
      }
    }
    return reactData.current.peopleRec.person_id;
  };

  async function newUserID(proposedID) {
    let tryAgain;
    let newID, namePart;
    let clientPart = state.session.client_id.toLowerCase();
    let numberPart = 1;
    if (proposedID) {
      namePart = (proposedID.match(/([\w-]*[^\d]+)(\d*)$/))[1];
      newID = proposedID.toLowerCase().replace(/\W/g, '').replace(clientPart, `-${clientPart}`);
    }
    else {
      if (!reactData.current.peopleRec?.name?.last) {
        if (!reactData.current.peopleRec?.name?.first) {
          return reactData.current.peopleRec.person_id;        // neither first nor last exits
        }
        else {
          namePart = reactData.current.peopleRec?.name?.first;     // first but not last
        }
      }
      else if (!reactData.current.peopleRec?.name?.first) {
        namePart = reactData.current.peopleRec?.name?.last;        // last but not first
      }
      else {
        const firstName = reactData.current.peopleRec.name.first || '';
        const lastName = reactData.current.peopleRec.name.last || '';
        namePart = `${firstName.trim().charAt(0) || 'X'}${lastName.trim()}`;
      }
      newID = `${namePart.toLowerCase().replace(/\W/g, '')}-${clientPart}`;
    }
    do {
      tryAgain = false;
      const person_id_exists = await getPerson(newID, 'validate');
      if (person_id_exists) {
        numberPart++;
        if (newID.includes(clientPart)) {
          newID = `${namePart.toLowerCase().split(clientPart)[0].replace('-', '')}${numberPart}-${clientPart}`;
        }
        else {
          newID = `${namePart.toLowerCase()}${numberPart}`;
        }
        tryAgain = true;
      }
    } while (tryAgain);
    return { proposedID, newID };
  }

  return (
    (reactData.initialized || reactData.alert) &&
    <Dialog
      open={(true || refreshTrigger)}
      maxWidth={false}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
      onClose={() => {
        if (reactData.OKtoSave) {
          handleExitWarning();
        }
        else {
          if (!reactData.current.peopleRec.person_id) {
            onExit({
              saveCompleted: false,
              newID: false
            });
          }
          else {
            onExit({
              saveCompleted: reactData.saveCompleted,
              newID: reactData.current.peopleRec.person_id,
              newName: (`${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`).trim()
            });
          }
        }
      }}
    >
      {reactData.initialized &&
        <React.Fragment>
          <Box
            display='flex' flexDirection='row'
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '32px',
              marginBottom: '32px',
              marginLeft: '16px',
              marginRight: '16px',
            }}
            key={'topBox'}
          >
            <Box
              display='flex' flexDirection='row'
              flexGrow={1}
              style={{
                alignItems: 'center',
              }}
              key={'personBox'}
            >
              <Avatar className={AVAClass.AVAAvatar} src={reactData.myImage} alt={reactData.greetingName} />
              <Typography
                key={`personName`}
                style={AVATextStyle({
                  size: 1.8,
                  bold: true,
                  margin: {
                    left: 1.5
                  }
                })}>
                {reactData.current.peopleRec.name ? (`${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`).trim() : 'Welcome!'}
              </Typography>
            </Box>
            {/* Logo and Pop-up Menu */}
            <Box
              display='flex'
              ml={2}
              overflow='auto'
              flexDirection='column'
            >
              <Avatar className={AVAClass.AVAAvatar}
                alt=''
                src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO}
                ml={2}
                mr={2}
                aria-controls='hidden-menu'
                aria-haspopup='true'
                onClick={(event) => {
                  updateReactData({
                    anchorEl: event.currentTarget,
                    popupMenuOpen: true
                  }, true);
                }}
              />

            </Box>
            <Menu
              id='hidden-menu'
              anchorEl={reactData.anchorEl}
              open={reactData.popupMenuOpen}
              classes={{ paper: classes.clientPopUp }}
              onClose={() => {
                updateReactData({
                  popupMenuOpen: false
                }, true);
              }}
              keepMounted
            >
              <MenuList className={classes.popUpMenu}>
                {reactData.administrative_account && (reactData.person_id !== state.session?.patient_id) && (
                  <MenuItem onClick={async () => {
                    updateReactData({
                      popupMenuOpen: false
                    }, true);
                    await switchActiveAccount(
                      state.session,
                      (state.session.client_id || state.session.user_homeClient),
                      {
                        id: reactData.person_id,
                        name: `${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`
                      }
                    );
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'} justifyContent={'center'}
                      key={'switch2self'}
                    >
                      <SwapHorizIcon />
                      <Typography style={AVATextStyle({ size: 0.8, margin: { left: 0.5 } })} >
                        {`Switch to ${reactData.current.peopleRec.name.first || 'User'}`}
                      </Typography>
                    </Box>
                  </MenuItem>
                )}
                {reactData.administrative_account
                  && reactData.current.peopleRec.person_id
                  && (reactData.person_id !== state.session?.user_id)
                  && (
                    <MenuItem onClick={async () => {
                      updateReactData({
                        popupMenuOpen: false
                      }, true);
                      await switchActiveAccount(
                        state.session,
                        (state.session.client_id || state.session.user_homeClient),
                        {
                          id: reactData.person_id,
                          name: `${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`
                        },
                        { resetUser: true }
                      );
                    }}>
                      <Box
                        display='flex' flexDirection='row' alignItems={'center'} justifyContent={'center'}
                        key={'switch2self'}
                      >
                        <HomeIcon />
                        <Typography style={AVATextStyle({ size: 0.8, margin: { left: 0.5 } })} >
                          {`Sign-in as ${reactData.current.peopleRec.name.first || reactData.current.peopleRec.name.last}`}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )}
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'vRowRefresh'}
                    style={AVATextStyle({ size: 0.8 })}
                  >
                    <Typography style={AVATextStyle({ size: 0.8 })}>
                      {`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
                    </Typography>
                    <Typography style={AVATextStyle({ size: 0.8 })}>
                      {`User ${state.session.user_id}${state.session.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}
                    </Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          <Paper component={Box}
            key={`section_frame`} variant='outlined' overflow={'auto'}
          >
            {reactData.sections.map((this_section, sectionNdx) => (
              (this_section.isAuthorized &&
                (!reactData.options?.sectionToShow || reactData.administrative_account
                  || ([reactData.options?.sectionToShow].flat().some(this_optionSection => {
                    return (this_optionSection.toLowerCase() === this_section.component_name.toLowerCase());
                  }))) &&
                (reactData.person_id || (this_section.component_name === 'ProfileSection')) &&
                <Box
                  key={`frag__${sectionNdx}`}
                >
                  <Box
                    display='flex'
                    ml={2} mr={2} mt={'8px'}
                    key={`sectionRow__${sectionNdx}`}
                    style={{
                      borderRadius: (this_section.isOpen ? '30px 30px 0px 0px' : '30px 30px 30px 30px'),
                      marginBottom: (this_section.isOpen ? 0 : '8px'),
                      backgroundColor: this_section.color,
                      textDecoration: 'none',
                      top: '8px',
                      zIndex: 1,
                      opacity: 1
                    }}
                    borderTop={1}
                    borderLeft={1}
                    borderRight={1}
                    borderBottom={!this_section.isOpen ? 1 : 0}
                    justifyContent='center'
                    flexDirection='column'
                    minHeight={80}
                    onClick={async () => {
                      reactData.sections[sectionNdx].isOpen = !reactData.sections[sectionNdx].isOpen;
                      updateReactData({
                        focusAt: (reactData.sections[sectionNdx].isOpen ? this_section.component_name : null),
                        sections: reactData.sections
                      }, true);
                    }}
                  >
                    <Typography
                      style={AVATextStyle({ size: 1.5, bold: true, align: 'center', color: (isDark(this_section.color) ? 'cornsilk' : 'black') })} >
                      {this_section.section_name.trim()}
                    </Typography>
                  </Box>
                  {this_section.isOpen &&
                    <React.Fragment
                      key={`${this_section.section_name}__callFrag`}
                    >
                      <Box
                        border={1}
                        ml={2} mr={2}
                        key={`${this_section.section_name}__renderBoxTop`}
                      >
                        {renderSection(this_section.component_name)}
                      </Box>
                      <Box
                        display='flex'
                        borderTop={0}
                        borderLeft={1}
                        borderRight={1}
                        borderBottom={1}
                        key={`${this_section.section_name}__renderBoxBottom`}
                        style={{
                          borderRadius: '0px 0px 30px 30px',
                          backgroundColor: this_section.color,
                          textDecoration: 'none'
                        }}
                        ml={2} mr={2} mb={1.5}
                        onClick={async () => {
                          if (reactData.options?.sectionToShow !== this_section.component_name) {
                            reactData.sections[sectionNdx].isOpen = !reactData.sections[sectionNdx].isOpen;
                            updateReactData({
                              sections: reactData.sections
                            }, true);
                          }
                        }}
                        justifyContent='center'
                        flexDirection='column'
                        minHeight={30}
                        height={30}
                      />
                    </React.Fragment>
                  }
                </Box>
              )
            ))}
          </Paper>

          <Box
            display='flex'
            flexDirection='row'
            alignItems={'center'}
            marginTop={'16px'}
            marginBottom={'16px'}
            justifyContent={'space-around'}
          >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                if (reactData.OKtoSave) {
                  handleExitWarning();
                }
                else {
                  if (!reactData.current.peopleRec.person_id) {
                    onExit({
                      saveCompleted: false,
                      newID: false
                    });
                  }
                  else {
                    onExit({
                      saveCompleted: reactData.saveCompleted,
                      newID: reactData.current.peopleRec.person_id,
                      newName: (`${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`).trim()
                    });
                  }
                }
              }}
            >
              {'Exit'}
            </Button>
            {(reactData.OKtoSave || (!isEmpty(reactData.errorList))) ?
              (isEmpty(reactData.errorList) ?
                <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
                  <Button
                    onClick={async () => {
                      const result = await saveChanges();
                      if (!!result) {
                        reactData.saveCompleted = true;
                      }
                      updateReactData({
                        saveCompleted: reactData.saveCompleted,
                        OKtoSave: !result
                      }, true);
                    }}
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'lightcyan', color: 'black' }}
                    size='small'
                  >
                    {reactData.isMobile ? 'Save' : 'Save/Continue'}
                  </Button>
                  <Button
                    onClick={async () => {
                      let result = await saveChanges();
                      if (result) {
                        onExit({
                          newID: reactData.current.peopleRec.person_id,
                          newName: (`${reactData.current.peopleRec.name.first || ''} ${reactData.current.peopleRec.name.last || ''}`).trim()
                        });
                      }
                    }}
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                  >
                    {'Save/Finish'}
                  </Button>
                </Box>
                :
                <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
                  <Typography style={{ color: 'red', bold: true }}>
                    {(Object.keys(reactData.errorList).length === 1)
                      ? `${reactData.errorList[Object.keys(reactData.errorList)[0]].errorMessage}`
                      : `${Object.keys(reactData.errorList).length} issues`
                    }
                  </Typography>
                </Box>
              )
              :
              (reactData.current.peopleRec?.name?.first &&
                <Box display='flex' flexDirection='column' justifyContent='flex-end' alignItems='center'>
                  <Typography style={{ size: 1.2, bold: true }}>
                    {`${((reactData.current.peopleRec?.name?.first || 'User') + "'s").replace("s's", "s'")} Profile`}
                  </Typography>
                  {(reactData.mode === 'view') &&
                    <Typography style={{ size: 1.2, bold: true }}>
                      {`** View only **`}
                    </Typography>
                  }
                  {(reactData.mode === 'view') &&
                    <Typography style={{ marginTop: 0, size: 1 }}>
                      {`No Changes allowed`}
                    </Typography>
                  }
                </Box>
              )
            }
          </Box>
        </React.Fragment>
      }
      {reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
          onClose={() => {
            updateReactData({
              alert: false
            }, true);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            key={`alert_box`}
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                mx={1}
                overflow='auto'
                flexDirection='column'
              >
                {([reactData.alert.action].flat()).map((this_action, actionNdx) => (
                  <Button
                    key={`alert_button__${actionNdx}`}
                    className={AVAClass.AVAButton} color="inherit"
                    onClick={() => this_action.function()}
                  >
                    {this_action.text}
                  </Button>
                ))}
              </Box>
              : null
            )}
            variant='filled'
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar >
      }
    </Dialog >
  );
};
