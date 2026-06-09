/**
 * QuickAdd Component - Multi-Family Member Account Creation
 * 
 * Features:
 * - Dynamic form field loading from Form_Fields table based on account type
 * - Multi-stage workflow: account selection → field input → confirmation → completion
 * - Family ID generation for multiple members: "family_" + timestamp
 * - Unique User ID generation for each member: firstInitial + lastName + counter + "-" + client_id
 *   Example: "jsmith-client123" or "jsmith2-client123" if duplicate exists
 * - Duplicate checking against People table with automatic counter increment
 * - People table record creation following PeopleMaintenance.js patterns
 * - SessionsV2 table record creation with matching session_id = person_id
 * - FamilyGroups table record creation with header and person records
 * - Comprehensive validation and error handling
 * - Professional UI with loading states and success/error alerts
 * 
 * User ID Generation Rules:
 * - Format: firstInitial + cleanLastName + counter + "-" + client_id (all lowercase)
 * - Non-alphabetic characters removed from last name
 * - Counter starts at 2 if duplicate found, incrementing until unique
 * - Maximum 100 attempts to prevent infinite loops
 * - Each generated ID is stored in member.proposed_user_id
 * 
 * People Table Record Structure:
 * - person_id: Generated unique user ID
 * - client_id: Current session client ID
 * - name: {first, last} from form field values
 * - display_name: "First Last"
 * - groups: ["__TOP__", "ALL"] + account_config.default_groups
 * - search_data: Searchable name variations and contact info
 * - preferred_methods/preferred_method: Based on available contact info
 * - contact_info: Email and phone extracted from form fields
 * - family_groups: Array containing family_id (if multiple family members)
 * - account_type: From selected account configuration
 * - Additional field values from form input
 * 
 * SessionsV2 Table Record Structure:
 * - session_id: Same as person_id (unique user ID)
 * - client_id: Current session client ID
 * - person_id/patient_id/user_id: All set to same unique user ID
 * - user_display_name/patient_display_name: Full name from form
 * - method: "QuickAdd"
 * - last_login: "password"
 * - user_homeClient: Current session client ID
 * - requirePassword: false, storePassword: true
 * - subscription_status: "na"
 * 
 * FamilyGroups Table Record Structure (for multiple family members):
 * - Header Record:
 *   - client_id: Current session client ID
 *   - composite_key: same as family_id
 *   - family_id: Generated family ID
 *   - family_name: "The [LastName] Family"
 *   - record_type: "header"
 *   - role: "family"
 * - Person Records (one per family member):
 *   - client_id: Current session client ID
 *   - composite_key: family_id + "%%" + person_id
 *   - family_id: Generated family ID
 *   - person_id: Member's unique user ID
 *   - nickname: Member's first name
 *   - record_type: "person"
 *   - role: "primary" (first member) or "member"
 */
import React from 'react';

import useSession from '../../hooks/useSession';
import { useCookies } from 'react-cookie';

import { deepCopy, titleCase, getDb, putDb, isEmpty, uuid, recordExists, dbClient } from '../../util/AVAUtilities';
import { getGroupAccess, addMember } from '../../util/AVAGroups';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import { sendMessages } from '../../util/AVAMessages';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { Auth } from 'aws-amplify';
import { Box, Button, TextField, Typography, Dialog, DialogContentText, DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Snackbar, Checkbox } from '@material-ui/core/';
import { Alert, AlertTitle } from '@material-ui/lab/';

const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    padding: '16px',
    minHeight: '450px',
    maxHeight: '80vh',
    overflow: 'auto'
  },
  selectFieldset: {
    borderColor: theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
  },
  selectLabel: {
    color: theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)',
  },
  selectOptions: {
    color: theme.palette.text.primary,
  }
}));

export default ({ onClose, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isMounted = React.useRef(false);
  const dateValidationTimeouts = React.useRef({});
  const dialogFocusRef = React.useRef(null);

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [reactData, setReactData] = React.useState({
    initialized: false,
    errorList: {},
    new_account_prompts: {},
    all_account_prompts: [], // Unfiltered prompts, used for auto_next_account_type lookup
    administrative_account: (state?.user ? ['admin', 'support', 'master'].includes(state.user.account_class) : false),
    client_id: state?.session?.client_id || options?.client_id || null,
    selected_account_type: '',
    selected_account_config: null,
    form_fields: {},
    field_values: {},
    password_confirm: '',   // confirmation entry for *password field
    field_validation_errors: {}, // Store validation errors for real-time feedback
    loading_fields: false,
    loading_user_ids: false,
    alert: false,
    exit_confirm: false, // Track if exit confirmation dialog is open
    family_members: [], // Array to store completed family member data
    current_member_index: 0,
    stage: 'select_account_type', // Default to account type selection for normal invocation
    options,
    // New fields for name validation
    entered_name: '',
    name_validation_result: null,
    candidates: [],
    select_user: false,
    // Fields for email/phone verification stage
    verification_stage: false,
    verification_input: '',
    verification_message: '',
    matched_account: null,
    // Fields for pre-filling name fields
    parsed_first_name: '',
    parsed_last_name: '',
    // Fields for verification code
    code_verification_stage: false,
    sent_verification_code: '',
    verification_code_input: '',
    code_sent_to: '',
    code_send_method: '',
    // Family group fields
    family_id: options?.family_id || null, // If passed in options, use existing family_id
    existing_family_rec: null, // Store existing FamilyGroups record if adding to existing family
    available_to_groups: [],
    // Pre-authorization fields
    require_pre_auth: false,      // from client_style: gates URL-driven account creation
    preauth_match_on: null,       // 'name'|'email'|'phone'|'code'
    preauth_code_prompt: 'Enter your authorization code', // label from client_style
    preauth_code_input: '',       // user input on prompt_for_preauth_code stage
    matched_preauth_rec: null,    // PreAuthorization record found; held until account is written
    preauth_person_id: null,      // person_id of existing account found in code-mode name lookup
    preauth_lookup_type: null,    // lookupType used to find the existing account ('user_id'|'name'|'email'|'phone')
    updating_existing_person_id: null, // when set, fill_fields stage updates this existing account
    existing_people_rec: null,         // full People record loaded for pre-filling the update form
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

  React.useEffect(() => {
    async function initialize() {
      let reactUpd = {};

      // Build list of groups this patient is allowed to access, using the same group access rules.
      const patientId = state?.session?.patient_id || state?.session?.person_id || state?.user?.user_id;
      let availableToGroups = Array.isArray(state?.accessList?.[reactData.client_id]?.groups)
        ? [...state.accessList[reactData.client_id].groups]
        : [];

      if (availableToGroups.length === 0 && reactData.client_id && patientId) {
        const [groupsBelongTo = {}, rejectedGroups = {}] = await getGroupAccess(reactData.client_id, patientId)
          .catch(() => [{}, {}]);

        availableToGroups = Object.entries(Object.assign({}, groupsBelongTo, rejectedGroups))
          .filter(([, value]) => value?.is_accessible)
          .map(([groupId]) => groupId);
      }

      reactUpd.available_to_groups = availableToGroups;

      // Grab the new_account_form object from session or Customizations table
      // Also load client_style for pre-auth settings — both reads in parallel
      let newAccountForm = state.session?.new_account_form || null;
      let clientStyle = state?.session?.client_style || null;
      if (reactData.client_id) {
        const [newAccountFormRec, clientStyleRec] = await Promise.all([
          !newAccountForm
            ? dbClient.get({ Key: { client_id: reactData.client_id, custom_key: 'new_account_form' }, TableName: 'Customizations' }).promise().catch(() => null)
            : Promise.resolve(null),
          !clientStyle
            ? dbClient.get({ Key: { client_id: reactData.client_id, custom_key: 'client_style' }, TableName: 'Customizations' }).promise().catch(() => null)
            : Promise.resolve(null),
        ]);
        if (newAccountFormRec?.Item?.customization_value) {
          newAccountForm = newAccountFormRec.Item.customization_value;
        }
        if (clientStyleRec?.Item?.customization_value) {
          clientStyle = clientStyleRec.Item.customization_value;
        }
      }

      // Apply pre-auth settings from client_style.preAuth object
      if (clientStyle?.preAuth) {
        const preAuth = clientStyle.preAuth;
        reactUpd.require_pre_auth = preAuth.require_pre_auth === true;
        reactUpd.preauth_match_on = preAuth.preauth_match_on || null;
        if (preAuth.preauth_code_prompt) {
          reactUpd.preauth_code_prompt = preAuth.preauth_code_prompt;
        }
      }

      if (newAccountForm) {
        reactUpd.all_account_prompts = deepCopy(newAccountForm);
        reactUpd.new_account_prompts = deepCopy(newAccountForm).filter(entry => {
          // If restrict_to_admin is true, only include if user is administrative account
          if (entry.restrict_to_admin && (!reactData.administrative_account || options.source === 'url_parameter')) {
            return false;
          }

          // If restrict_to_groups exists, it must include at least one group in available_to_groups.
          if (entry.restrict_to_groups) {
            const requiredGroups = Array.isArray(entry.restrict_to_groups)
              ? entry.restrict_to_groups
              : [entry.restrict_to_groups];
            const normalizedRequired = requiredGroups
              .map(groupId => String(groupId || '').trim())
              .filter(Boolean);

            if (normalizedRequired.length > 0) {
              const hasMatch = normalizedRequired.some(groupId => availableToGroups.includes(groupId));
              if (!hasMatch) {
                return false;
              }
            }
          }

          return true;
        });
      }

      // If options.family_id is provided, load the existing FamilyGroups record
      if (options?.family_id) {
        loadExistingFamily(options.family_id, reactUpd);
        return; // Exit early; loadExistingFamily will update state
      }

      // Determine initial stage based on how QuickAdd was invoked
      // If invoked via URL parameter (?create=client_id), start with name verification to prevent duplicates
      // Otherwise, skip directly to account type selection for normal admin use
      const invokedViaUrl = options.source === 'url_parameter';

      if (invokedViaUrl) {
        // URL-driven mode (?create=client_id) - start with name verification to prevent duplicates
        reactUpd.stage = 'prompt_for_name';
      } else {
        // Normal invocation - skip directly to account type selection
        reactUpd.stage = 'select_account_type';
      }

      updateReactData(reactUpd, true);
    }
    isMounted.current = true;
    initialize();

    // Capture the current ref value for cleanup
    const timeoutsRef = dateValidationTimeouts.current;

    return () => {
      isMounted.current = false;
      // Clear all date validation timeouts on unmount using captured ref
      Object.values(timeoutsRef).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (dialogFocusRef.current) {
      dialogFocusRef.current.focus();
    }
  }, []);

  /**
   * Load an existing FamilyGroups record when adding members to an existing family
   * Reads the FamilyGroups table and stores the record for later updates
   * @param {string} familyId - The family_id to load
   * @param {object} reactUpd - Initial state updates object to merge
   */
  const loadExistingFamily = async (familyId, reactUpd) => {
    try {
      const result = await getDb({
        Key: {
          client_id: reactData.client_id,
          composite_key: familyId
        },
        TableName: 'FamilyGroups'
      });

      if (result) {
        console.log('Loaded existing FamilyGroups record:', result);
        reactUpd.existing_family_rec = result;
        reactUpd.family_id = familyId;
        reactUpd.stage = 'select_account_type';

        showAlert({
          severity: 'info',
          title: 'Adding to Family',
          message: `Adding new members to existing family: ${result.family_name}`,
          autoHide: true
        });
      } else {
        console.warn('FamilyGroups record not found for family_id:', familyId);
        showAlert({
          severity: 'warning',
          title: 'Family Not Found',
          message: `Could not find family group with ID: ${familyId}`,
          autoHide: false
        });
      }

      updateReactData(reactUpd, true);
    } catch (error) {
      console.error('Error loading existing FamilyGroups record:', error);
      showAlert({
        severity: 'error',
        title: 'Load Error',
        message: `Failed to load family group: ${error.message}`,
        autoHide: false
      });
    }
  };

  const gatherFormFields = async (selectedConfig) => {
    if (!selectedConfig?.field_list || !Array.isArray(selectedConfig.field_list)) {
      console.log('No field_list found in selected configuration');
      showAlert({
        severity: 'error',
        title: 'Configuration Error',
        message: 'No field list found in the selected account type configuration.',
        autoHide: false
      });
      return;
    }

    setReactData(prev => ({ ...prev, loading_fields: true }));

    const fieldData = {};
    let errorCount = 0;

    for (const fieldName of selectedConfig.field_list) {
      // *password is a built-in special field — no DB record needed
      if (fieldName === '*password') {
        fieldData[fieldName] = {
          field_name: '*password',
          prompt: { value: 'Password' },
          value: { type: '*password' },
        };
        continue;
      }
      try {
        const formFieldRec = await getDb({
          Key: {
            client_id: reactData.client_id,
            field_name: fieldName
          },
          TableName: "Form_Fields"
        });

        if (formFieldRec) {
          fieldData[fieldName] = formFieldRec;
        } else {
          console.warn(`Field '${fieldName}' not found in Form_Fields table`);
          fieldData[fieldName] = null;
          errorCount++;
        }
      } catch (error) {
        console.error(`Error fetching field '${fieldName}':`, error);
        fieldData[fieldName] = null;
        errorCount++;
      }
    }

    setReactData(prev => {
      // Pre-fill name fields if we have parsed names from the initial lookup
      const updatedFieldValues = { ...prev.field_values };

      if (prev.parsed_first_name || prev.parsed_last_name) {
        // Look for common first name field variations
        const firstNameFields = ['first_name', 'firstName', 'fname', 'first name'];
        const lastNameFields = ['last_name', 'lastName', 'lname', 'surname', 'last name'];

        // Pre-fill first name fields
        if (prev.parsed_first_name) {
          firstNameFields.forEach(fieldName => {
            if (fieldData[fieldName] && !updatedFieldValues[fieldName]) {
              updatedFieldValues[fieldName] = titleCase(prev.parsed_first_name);
            }
          });
        }

        // Pre-fill last name fields
        if (prev.parsed_last_name) {
          lastNameFields.forEach(fieldName => {
            if (fieldData[fieldName] && !updatedFieldValues[fieldName]) {
              updatedFieldValues[fieldName] = titleCase(prev.parsed_last_name);
            }
          });
        }
      }

      // Pre-fill email fields
      if (prev.parsed_email) {
        const emailFields = ['email', 'eMail', 'email_address', 'emailAddress', 'e-mail', 'e-Mail'];
        emailFields.forEach(fieldName => {
          if (fieldData[fieldName] && !updatedFieldValues[fieldName]) {
            updatedFieldValues[fieldName] = prev.parsed_email;
          }
        });
      }

      if (prev.parsed_phone) {
        // Look for common phone field variations
        const phoneFields = ['phone', 'cell', 'cell_phone', 'phone_number', 'mobile'];
        phoneFields.forEach(fieldName => {
          if (fieldData[fieldName] && !updatedFieldValues[fieldName]) {
            const digitsOnly = prev.parsed_phone.replace(/\D/g, '');
            if (digitsOnly.length === 10) {
              // US 10-digit number: format as (555) 123-4567
              updatedFieldValues[fieldName] = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
              // US 11-digit number starting with 1: format as +1 (555) 123-4567
              const areaCode = digitsOnly.slice(1, 4);
              const exchange = digitsOnly.slice(4, 7);
              const number = digitsOnly.slice(7);
              updatedFieldValues[fieldName] = `+1 (${areaCode}) ${exchange}-${number}`;
            } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
              // International format: minimum 10 digits, keep user's formatting
              updatedFieldValues[fieldName] = digitsOnly; // Keep user's formatting for international numbers
            }
          }
        });
      }

      // Pre-populate fixed values for hidden fields
      Object.entries(fieldData).forEach(([fieldName, fieldRec]) => {
        if (fieldRec && fieldRec.value?.type === 'hidden' && fieldRec.value?.fixed !== undefined) {
          updatedFieldValues[fieldName] = fieldRec.value.fixed;
        }
      });

      // When updating an existing account via preauth, pre-fill fields from the People record
      // using each field's saveAs path — but only for fields not already seeded by preauth data
      if (prev.existing_people_rec) {
        Object.entries(fieldData).forEach(([fieldName, fieldRec]) => {
          if (!fieldRec || updatedFieldValues[fieldName] !== undefined) return;
          const rawSaveAs = fieldRec.saveAs || fieldRec.value?.saveAs || fieldRec.prompt?.saveAs;
          if (!rawSaveAs) return;
          const saveAs = String(rawSaveAs).trim().replace(/^['"]+|['"]+$/g, '').replace(/[;,]+$/g, '');
          const keys = saveAs.split('.');
          const rootKey = (keys[0] || '').toLowerCase();
          if (rootKey.startsWith('session')) return;
          if (rootKey.startsWith('person') || rootKey.startsWith('people')) keys.shift();
          let val = prev.existing_people_rec;
          for (const k of keys) {
            if (!val || typeof val !== 'object') { val = undefined; break; }
            val = val[k];
          }
          if (val !== undefined && val !== null && val !== '') {
            updatedFieldValues[fieldName] = val;
          }
        });
      }

      return {
        ...prev,
        form_fields: fieldData,
        field_values: updatedFieldValues,
        loading_fields: false
      };
    });

    // Show alert if there were errors loading fields
    if (errorCount > 0) {
      showAlert({
        severity: 'warning',
        title: 'Field Loading Issues',
        message: `${errorCount} out of ${selectedConfig.field_list.length} fields could not be loaded from the database.`,
        autoHide: false
      });
    }
  };

  const handleAccountTypeChange = async (event) => {
    const selectedType = event.target.value;
    const selectedConfig = reactData.new_account_prompts.find(prompt => prompt.account_type === selectedType);

    setReactData(prev => ({
      ...prev,
      selected_account_type: selectedType,
      selected_account_config: selectedConfig,
      form_fields: {}, // Clear previous fields
      field_values: {}, // Clear previous values
      field_validation_errors: {}, // Clear validation errors
      stage: 'fill_fields'
    }));

    // Gather form fields for the selected account type
    if (selectedConfig) {
      await gatherFormFields(selectedConfig);
    }
  };

  const handleChangeAccountType = () => {
    setReactData(prev => ({
      ...prev,
      selected_account_type: '',
      selected_account_config: null,
      form_fields: {},
      field_values: {},
      field_validation_errors: {}, // Clear validation errors
      loading_fields: false,
      stage: 'select_account_type'
    }));
  };

  // Returns true if a field should be visible given the current field_values.
  // Checks show_if / ignore_if on the Form_Fields record (same shape as FormFillB).
  const shouldShowField = (fieldData) => {
    if (!fieldData) return false;
    const { show_if: showObj, ignore_if: ignoreObj } = fieldData;
    if (!showObj && !ignoreObj) return true;

    const matchValues = (valToCheck, valuesToMatch) => {
      const normalizedValues = Array.isArray(valuesToMatch)
        ? valuesToMatch.map(v => typeof v === 'string' ? v.toLowerCase() : v)
        : [valuesToMatch].map(v => typeof v === 'string' ? v.toLowerCase() : v);
      if (normalizedValues.includes('*')) {
        if (Array.isArray(valToCheck)) return valToCheck.length > 0;
        return valToCheck !== null && valToCheck !== undefined && valToCheck !== '';
      }
      if ((!valToCheck || (Array.isArray(valToCheck) && valToCheck.length === 0)) && normalizedValues.includes('%%no_data%%')) {
        return true;
      }
      if (typeof valToCheck === 'string' && normalizedValues.includes(valToCheck.toLowerCase())) return true;
      if (Array.isArray(valToCheck) && valToCheck.some(v => normalizedValues.includes(typeof v === 'string' ? v.toLowerCase() : v))) return true;
      return false;
    };

    if (ignoreObj) {
      const testList = Array.isArray(ignoreObj) ? ignoreObj : [ignoreObj];
      const shouldIgnore = testList.some(test => {
        const fieldKey = test.field || test.data?.split('.').slice(-1)[0];
        const val = reactData.field_values[fieldKey] ?? null;
        return matchValues(val, [].concat(test.values || []));
      });
      if (shouldIgnore) return false;
    }

    if (showObj) {
      const testList = Array.isArray(showObj) ? showObj : [showObj];
      const isShown = testList.some(test => {
        const fieldKey = test.field || test.data?.split('.').slice(-1)[0];
        const val = reactData.field_values[fieldKey] ?? null;
        return matchValues(val, [].concat(test.values || []));
      });
      if (!isShown) return false;
    }

    return true;
  };

  const handleFieldValueChange = (fieldName, value) => {
    setReactData(prev => ({
      ...prev,
      field_values: {
        ...prev.field_values,
        [fieldName]: value
      }
    }));
  };

  const handlePhoneFieldChange = (fieldName, value) => {
    // Immediately update the field value for responsive typing
    setReactData(prev => ({
      ...prev,
      field_values: {
        ...prev.field_values,
        [fieldName]: value
      }
    }));

    // Clear any existing timeout for this field
    if (dateValidationTimeouts.current[fieldName]) {
      clearTimeout(dateValidationTimeouts.current[fieldName]);
    }

    // Set a new timeout to validate and format the phone after 500ms of no typing
    dateValidationTimeouts.current[fieldName] = setTimeout(() => {
      if (value && value.trim() !== '') {
        // Remove all non-digit characters for validation
        const digitsOnly = value.replace(/\D/g, '');

        // Validate phone number format
        let formattedDisplay = value;
        let validationError = null;

        if (digitsOnly.length === 10) {
          // US 10-digit number: format as (555) 123-4567
          formattedDisplay = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          // US 11-digit number starting with 1: format as +1 (555) 123-4567
          const areaCode = digitsOnly.slice(1, 4);
          const exchange = digitsOnly.slice(4, 7);
          const number = digitsOnly.slice(7);
          formattedDisplay = `+1 (${areaCode}) ${exchange}-${number}`;
        } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
          // International format: minimum 10 digits, keep user's formatting
          formattedDisplay = value; // Keep user's formatting for international numbers
        } else {
          validationError = 'Please enter a valid phone number (10 digits for US, minimum 10 digits for international)';
        }

        // Update field value with formatted display and store validation result
        setReactData(prev => ({
          ...prev,
          field_values: {
            ...prev.field_values,
            [fieldName]: formattedDisplay
          },
          field_validation_errors: {
            ...prev.field_validation_errors,
            [fieldName]: validationError
          }
        }));
      } else {
        // Clear validation error when field is empty
        setReactData(prev => ({
          ...prev,
          field_validation_errors: {
            ...prev.field_validation_errors,
            [fieldName]: null
          }
        }));
      }
    }, 500);
  };

  const handleEmailFieldChange = (fieldName, value) => {
    // Immediately update the field value for responsive typing
    setReactData(prev => ({
      ...prev,
      field_values: {
        ...prev.field_values,
        [fieldName]: value
      }
    }));

    // Clear any existing timeout for this field
    if (dateValidationTimeouts.current[fieldName]) {
      clearTimeout(dateValidationTimeouts.current[fieldName]);
    }

    // Set a new timeout to validate the email after 500ms of no typing
    dateValidationTimeouts.current[fieldName] = setTimeout(() => {
      if (value && value.trim() !== '') {
        // Comprehensive email validation regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        const isValidEmail = emailRegex.test(value.trim());

        // Store validation result in a separate state for UI feedback
        setReactData(prev => ({
          ...prev,
          field_validation_errors: {
            ...prev.field_validation_errors,
            [fieldName]: isValidEmail ? null : 'Please enter a valid email address'
          }
        }));
      } else {
        // Clear validation error when field is empty
        setReactData(prev => ({
          ...prev,
          field_validation_errors: {
            ...prev.field_validation_errors,
            [fieldName]: null
          }
        }));
      }
    }, 500);
  };

  const handleSelectChange = (fieldName, selectedOption, select_max) => {
    // For select fields, toggle the option in the array
    const currentValue = reactData.field_values[fieldName] || [];
    const isArray = Array.isArray(currentValue);
    let newValue;

    if (isArray) {
      // Toggle: if already selected, remove it; otherwise add it
      if (currentValue.includes(selectedOption)) {
        newValue = currentValue.filter(item => item !== selectedOption);
      } else {
        if (currentValue.length >= select_max) {
          currentValue.splice(0, 1, selectedOption); // Enforce max selection limit
          newValue = currentValue;
        }
        else {
          newValue = [...currentValue, selectedOption];
        }
      }
    } else {
      // Initialize as array if not already
      newValue = [selectedOption];
    }

    setReactData(prev => ({
      ...prev,
      field_values: {
        ...prev.field_values,
        [fieldName]: newValue
      }
    }));
  };

  const showAlert = ({ severity = 'info', title, message, detail = null, action = null, autoHide = true }) => {
    setReactData(prev => ({
      ...prev,
      alert: {
        severity,
        title,
        message,
        detail,
        action,
        autoHide
      }
    }));
  };

  const hideAlert = () => {
    setReactData(prev => ({
      ...prev,
      alert: false
    }));
  };

  const saveCurrentFamilyMember = async () => {
    // Validate *password field if present: both entries must match and be non-empty
    const fieldList = reactData.selected_account_config?.field_list || [];
    if (fieldList.includes('*password')) {
      const pw = reactData.field_values['*password'] || '';
      const confirm = reactData.password_confirm || '';
      if (!pw) {
        showAlert({ severity: 'error', title: 'Password Required', message: 'Please enter a password.', autoHide: false });
        return;
      }
      if (pw !== confirm) {
        showAlert({ severity: 'error', title: 'Passwords Do Not Match', message: 'The password and confirmation do not match. Please re-enter.', autoHide: false });
        return;
      }
    }

    // Compute preauth_extra_fields: keys in preauth_data that are not in this account_type's field_list
    // These will be written directly onto the People record without prompting the user.
    // Only applies to the primary (first) account — subsequent family members only get default_groups.
    let preauthExtraFields = {};
    if (reactData.matched_preauth_rec && reactData.current_member_index === 0) {
      const preauthData = reactData.matched_preauth_rec.preauth_data || {};
      const fieldList = reactData.selected_account_config?.field_list || [];
      const reservedKeys = new Set(['account_type', 'first_name', 'last_name', 'groups']);
      Object.entries(preauthData).forEach(([key, value]) => {
        if (!reservedKeys.has(key) && !fieldList.includes(key)) {
          preauthExtraFields[key] = value;
        }
      });
      // Stash groups separately under a reserved key so savePeopleRecord can merge them
      if (preauthData.groups !== undefined) {
        preauthExtraFields._preauth_groups = preauthData.groups;
      }
    }

    const familyMember = {
      index: reactData.current_member_index,
      account_type: reactData.selected_account_type,
      account_config: reactData.selected_account_config,
      form_fields: reactData.form_fields,
      field_values: reactData.field_values,
      preauth_extra_fields: preauthExtraFields,
      timestamp: new Date().toISOString()
    };

    const proceedWithSave = async () => {
      // For existing-account updates, reuse the known person_id — no new ID needed
      if (reactData.updating_existing_person_id) {
        familyMember.proposed_user_id = reactData.updating_existing_person_id;
        familyMember.is_existing_account = true;
        setReactData(prev => ({
          ...prev,
          family_members: [...prev.family_members, familyMember],
          stage: 'complete'
        }));
        return;
      }

      try {
        familyMember.proposed_user_id = await generateUniqueUserId(familyMember);
      } catch (error) {
        console.error('Failed to generate user ID for member:', familyMember, error);
        showAlert({
          severity: 'error',
          title: 'User ID Generation Failed',
          message: `Failed to generate user ID for ${getFamilyMemberName(familyMember)}: ${error.message}`
        });
        throw error;
      }

      // Determine next stage based on family_role and auto_next_account_type
      const autoNextType = reactData.selected_account_config?.auto_next_account_type;
      // Guard against circular auto_next_account_type (e.g. A→B→A): don't auto-advance
      // to a type that's already been collected in this session.
      const alreadyCollected = new Set((reactData.family_members || []).map(m => m.account_type));
      const nextConfig = autoNextType && !alreadyCollected.has(autoNextType)
        ? (reactData.all_account_prompts || reactData.new_account_prompts || []).find(p => p.account_type === autoNextType) || null
        : null;
      const nextStage = reactData.selected_account_config?.family_role === 'none'
        ? 'complete'
        : nextConfig
          ? 'fill_fields'
          : 'ask_for_more';

      // if selected account config includes "on_save" key, store this.  We'll use it on exit.
      if (reactData.selected_account_config?.on_save) {
        setReactData(prev => ({
          ...prev,
          on_save_callback: reactData.selected_account_config.on_save
        }));
      }

      if (nextConfig) {
        // Auto-advance: skip ask_for_more and go directly to fill_fields for the next account type
        setReactData(prev => ({
          ...prev,
          family_members: [...prev.family_members, familyMember],
          stage: 'fill_fields',
          selected_account_type: autoNextType,
          selected_account_config: nextConfig,
          field_values: {},
          form_fields: {},
          field_validation_errors: {},
          loading_fields: false,
          current_member_index: prev.current_member_index + 1,
          parsed_first_name: '',
          parsed_last_name: ''
        }));
        await gatherFormFields(nextConfig);
      } else {
        setReactData(prev => ({
          ...prev,
          family_members: [...prev.family_members, familyMember],
          stage: nextStage
        }));
      }
    };

    const fieldValues = familyMember.field_values || {};
    const firstName = (fieldValues.first_name || fieldValues.firstName || fieldValues.fname || fieldValues['first name'] || '').trim();
    const lastName = (fieldValues.last_name || fieldValues.lastName || fieldValues.lname || fieldValues.surname || fieldValues['last name'] || '').trim();
    const email = (fieldValues.email || fieldValues.eMail || fieldValues['e-Mail'] || fieldValues.email_address || fieldValues['email address'] || '').trim();
    const phone = (fieldValues.phone || fieldValues.phone_number || fieldValues['phone number'] || fieldValues.cell || fieldValues.cell_phone || fieldValues['cell phone'] || '').trim();
    const clientId = (reactData.client_id || state.session?.client_id || '').trim();

    // For existing-account updates, skip duplicate detection and save immediately
    if (reactData.updating_existing_person_id) {
      await proceedWithSave();
      return;
    }

    if (firstName && lastName && clientId) {
      const nameIdentifier = `${firstName.toLowerCase()} ${lastName.toLowerCase()} ${clientId.toLowerCase()}`;
      const emailIdentifier = email ? email.toLowerCase() : '';
      const phoneIdentifier = phone ? phone.replace(/\D/g, '').slice(-10) : '';

      const queryByIdentifier = async (identifier) => {
        if (!identifier) return null;
        const result = await dbClient
          .query({
            KeyConditionExpression: 'identifier = :i',
            ExpressionAttributeValues: { ':i': identifier },
            TableName: 'PeopleAccounts',
            IndexName: 'alternate_id-index'
          })
          .promise()
          .catch(() => null);
        if (result && Array.isArray(result.Items) && result.Items.length > 0) {
          return result.Items.map(item => item.person_id);
        }
        return [];
      };

      const [nameMatch, emailMatch, phoneMatch] = await Promise.all([
        queryByIdentifier(nameIdentifier),
        queryByIdentifier(emailIdentifier),
        queryByIdentifier(phoneIdentifier)
      ]);

      if (emailMatch || phoneMatch) {
        const matchedExistingId = nameMatch.find(id => emailMatch?.includes(id) || phoneMatch?.includes(id));
        if (matchedExistingId) {
        showAlert({
          severity: 'warning',
          title: 'Account Found',
          message: 'You already have an Account.  Should we use that one instead of creating a new one?',
          autoHide: false,
          action: [
            {
              text: `Use Existing Account`,
              function: () => {
                showAlert({
                  severity: 'info',
                  title: `Existing Account - ${matchedExistingId}`,
                  message: `Your User ID is ${matchedExistingId}.\nYou may continue to create accounts for other people, or tap "Exit" and use ${matchedExistingId} to log in.`,
                  autoHide: false
                });
                updateReactData({
                  stage: 'select_account_type',
                  selected_account_type: '',
                  selected_account_config: null,
                  form_fields: {},
                  field_values: {},
                  field_validation_errors: {},
                  loading_fields: false
                }, true);
              }
            },
            {
              text: `Create New Account`,
              function: async () => {
                updateReactData({ alert: false }, true);
                await proceedWithSave();
              }
            },
            {
              text: `Cancel and Start Over`,
              function: () => {
                updateReactData({
                  alert: false,
                  stage: 'select_account_type',
                  selected_account_type: '',
                  selected_account_config: null,
                  form_fields: {},
                  field_values: {},
                  field_validation_errors: {},
                  loading_fields: false
                }, true);
              }
            }
          ]
        });
        return;
      }
     }
    }
    await proceedWithSave();
  };

  const resetForNextMember = () => {
    setReactData(prev => ({
      ...prev,
      selected_account_type: '',
      selected_account_config: null,
      form_fields: {},
      field_values: {},
      field_validation_errors: {}, // Clear validation errors
      loading_fields: false,
      current_member_index: prev.current_member_index + 1,
      stage: 'select_account_type', // Back to account type selection
      // Clear all name-related fields for new family member
      entered_name: '',
      name_validation_result: null,
      candidates: [],
      select_user: false,
      verification_stage: false,
      verification_input: '',
      verification_message: '',
      matched_account: null,
      parsed_first_name: '',
      parsed_last_name: ''
    }));
  };

  // ── Pre-Authorization helpers ─────────────────────────────────────────────

  /**
   * Fetch a single PreAuthorization record by its normalized key.
   * Table: PreAuthorization  PK: client_id  SK: preauth_key
   */
  const lookupPreAuth = async (preauthKey) => {
    try {
      const result = await dbClient
        .get({
          Key: { client_id: reactData.client_id, preauth_key: preauthKey },
          TableName: 'PreAuthorization'
        })
        .promise()
        .catch(() => null);
      return result?.Item || null;
    } catch (err) {
      console.error('lookupPreAuth error:', err);
      return null;
    }
  };

  /**
   * Apply a successful PreAuthorization record:
   * - Extracts account_type from preauth_data
   * - Seeds field_values with the remaining preauth_data keys
   * - Skips select_account_type and transitions directly to fill_fields
   */
  const applyPreAuthResult = async (preAuthRec) => {
    const preauthData = preAuthRec.preauth_data || {};
    const accountType = preauthData.account_type || '';
    // Search unfiltered prompts so admin-restricted types still work
    const allPrompts = reactData.all_account_prompts || reactData.new_account_prompts || [];
    const selectedConfig = allPrompts.find(p => p.account_type === accountType) || null;

    // Fatal: account_type is required for the create-account flow
    if (!accountType || !selectedConfig) {
      showAlert({
        severity: 'error',
        title: 'Authorization Error',
        message: accountType
          ? `This authorization code specifies account type "${accountType}", which is not available for this client. Please contact support.`
          : 'This authorization code is missing an account type. Please contact support.',
        autoHide: false
      });
      return;
    }

    // Seed values are everything except account_type and groups
    // (groups is handled separately via preauthExtraFields._preauth_groups in saveCurrentFamilyMember)
    const { account_type: _at, groups: _g, ...seedValues } = preauthData;
    updateReactData({
      selected_account_type: accountType,
      selected_account_config: selectedConfig,
      field_values: seedValues,
      form_fields: {},
      field_validation_errors: {},
      loading_fields: false,
      stage: 'fill_fields',
      matched_preauth_rec: preAuthRec,
      alert: false,
      ...(seedValues.first_name ? { parsed_first_name: seedValues.first_name } : {}),
      ...(seedValues.last_name  ? { parsed_last_name:  seedValues.last_name  } : {}),
    }, true);
    await gatherFormFields(selectedConfig);
  };

  /**
   * Append personId to the PreAuthorization record's used_by list.
   * Also stamps used_at on first use.  Non-fatal if this write fails.
   */
  const recordPreAuthUse = async (preAuthRec, personId) => {
    try {
      await dbClient
        .update({
          TableName: 'PreAuthorization',
          Key: { client_id: reactData.client_id, preauth_key: preAuthRec.preauth_key },
          UpdateExpression:
            'SET used_by = list_append(if_not_exists(used_by, :empty), :newEntry), ' +
            'used_at = if_not_exists(used_at, :now)',
          ExpressionAttributeValues: {
            ':newEntry': [personId],
            ':empty':    [],
            ':now':      new Date().toISOString()
          }
        })
        .promise();
    } catch (err) {
      // Non-fatal: account was already created; log but don't surface to user
      console.error('recordPreAuthUse failed (non-fatal):', err);
    }
  };

  // ── End Pre-Authorization helpers ─────────────────────────────────────────

  // Name validation function based on CheckInCheckOut.js validateUser pattern
  const validateUser = async (IDString, client_id, nonRes, restricted_to = false) => {
    if (!IDString) { return { result: 'invalid', error_field: 0, reason: 'The ID field is empty' }; }
    // get candidates from the words entered - all cross references are the PeopleAccounts table, so we can use the same function for both user ID and name lookups

    let lookupString = IDString;
    let lookupType = 'name'; // Default to name lookup

    // Determine if IDString is an email, phone number, or name
    const trimmedInput = IDString.trim();

    // Check if it's an email (contains @ and a domain pattern)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmedInput)) {
      lookupString = trimmedInput.toLowerCase();
      lookupType = 'email';
    }
    // Check if it's a phone number (digits with optional formatting)
    else if (/^[\d\s\-()+.]+$/.test(trimmedInput) && trimmedInput.replace(/\D/g, '').length >= 10) {
      // Strip out all non-digits and take last 10 digits only (removes country code if present)
      const digitsOnly = trimmedInput.replace(/\D/g, '');
      lookupString = digitsOnly.slice(-10);
      lookupType = 'phone';
    }
    // Otherwise treat as name or user_id
    else {
      const wordList = trimmedInput.split(/\s+/);
      if (wordList.length === 1) {
        // Single word — try a direct person_id lookup before giving up
        const directPerson = await getDb({
          Key: { person_id: trimmedInput },
          TableName: 'People'
        });
        if (directPerson && directPerson.client_id === client_id && !directPerson.inactive_account) {
          return { result: 'match', person_id: directPerson.person_id, personRec: directPerson, lookupString: trimmedInput, lookupType: 'user_id' };
        }
        return { result: 'warning', error_field: 0, reason: 'Please enter your name, email, phone, or user ID' };
      }
      else {
        lookupString = (`${wordList.join(' ')} ${client_id}`).toLowerCase();
      }
    }

    let existingPerson = null;
    let gotPerson = await dbClient
      .query({
        KeyConditionExpression: 'identifier = :i',
        ExpressionAttributeValues: { ':i': lookupString },
        TableName: "PeopleAccounts",
        IndexName: 'alternate_id-index'
      })
      .promise()
      .catch(error => { console.log(`getGroup ERROR reading Customizations; caught error is: ${error}`); });
    if (recordExists(gotPerson)) {
      existingPerson = gotPerson.Items[0];
    }

    if (!existingPerson) {
      return { result: 'invalid', error_field: 0, reason: `We didn't find an account for ${IDString}`, lookupString, lookupType };
    }
    else if (existingPerson.inactive_account) {
      return { result: 'invalid', error_field: 0, reason: `We found an inactive account for ${IDString}, but nothing current.`, lookupString, lookupType };
    }
    else {
      return { result: 'match', person_id: existingPerson.person_id, personRec: existingPerson, lookupString, lookupType };
    }

  };

  const handleNameLookup = async (enteredName) => {
    if (!enteredName || enteredName.trim() === '') {
      showAlert({
        severity: 'error',
        title: 'Name Required',
        message: 'Please enter a name to continue.',
        autoHide: true
      });
      return;
    }

    const validation = await validateUser(enteredName, reactData.client_id);

    setReactData(prev => ({
      ...prev,
      entered_name: enteredName,
      name_validation_result: validation
    }));

    switch (validation.result) {
      case 'match':
        if (reactData.require_pre_auth && (reactData.preauth_match_on === 'code' || reactData.preauth_match_on === 'code_strict')) {
          // Code mode: existing account found — capture person_id, then prompt or auto-submit
          updateReactData({
            candidates: [validation.personRec],
            preauth_person_id: validation.person_id,
            preauth_lookup_type: validation.lookupType,
            verification_stage: false,
            alert: false,
          }, false);
          if (options.preauth_code) {
            await handlePreAuthCodeInput(options.preauth_code, validation.person_id);
          } else {
            updateReactData({ stage: 'prompt_for_preauth_code' }, true);
          }
        } else {
          // Default: show verification stage
          setReactData(prev => ({
            ...prev,
            candidates: [validation.personRec],
            verification_stage: true,
            verification_message: `${validation.lookupType !== 'email' ? 'e-Mail Address' : ''}${(validation.lookupType === 'name' || validation.lookupType === 'user_id') ? ' or ' : ''}${validation.lookupType !== 'phone' ? 'Cell Phone Number' : ''}`,
            select_user: false
          }));
        }
        break;
      case 'warning':
        // Not enough information to determine a single match, send message and retry
        showAlert({
          severity: 'info',
          title: 'Not enough information',
          message: 'If trying a name, please enter first and last names',
          autoHide: false
        });
        break;
      case 'invalid':
        // No matches found
        if (reactData.require_pre_auth) {
          if (reactData.preauth_match_on === 'code_strict') {
            // Code-strict mode: name not found — block with error, do not proceed
            showAlert({
              severity: 'error',
              title: 'Name Not Found',
              message: "We couldn't find your name in our records. Please contact us if you believe this is an error.",
              autoHide: false
            });
          } else if (reactData.preauth_match_on === 'code') {
            // Code mode: no existing account — go straight to code prompt
            updateReactData({ preauth_person_id: null, alert: false }, false);
            if (options.preauth_code) {
              await handlePreAuthCodeInput(options.preauth_code);
            } else {
              updateReactData({ stage: 'prompt_for_preauth_code' }, true);
            }
          } else {
            // Non-code pre-auth: use the normalized lookup string as the preauth_key.
            // Strip the client_id suffix that validateUser appended for PeopleAccounts.
            const preauthKey = validation.lookupType === 'name'
              ? validation.lookupString.replace(` ${reactData.client_id.toLowerCase()}`, '').trim()
              : validation.lookupString;
            const preAuthRec = await lookupPreAuth(preauthKey);
            if (!preAuthRec) {
              showAlert({
                severity: 'error',
                title: 'Not Authorized',
                message: "You're not on our authorized list. Please contact us if you believe this is an error.",
                autoHide: false
              });
            } else if (preAuthRec.one_time_use && Array.isArray(preAuthRec.used_by) && preAuthRec.used_by.length > 0) {
              showAlert({
                severity: 'error',
                title: 'Already Used',
                message: 'This invitation has already been used to create an account.',
                autoHide: false
              });
            } else {
              // Valid pre-auth: parse name for pre-fill only if the entry was a name (not email/phone/id)
              const nameParts = validation.lookupType === 'name' ? enteredName.trim().split(/\s+/) : [];
              updateReactData({
                parsed_first_name: nameParts[0] || '',
                parsed_last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
                name_validation_result: validation,
                candidates: [],
                select_user: false
              }, false);
              await applyPreAuthResult(preAuthRec);
            }
          }
        } else {
          // No pre-auth required: offer the standard create-new-account path
          showAlert({
            severity: 'info',
            title: 'No Match Found',
            message: "We didn't find a match.  What would you like to do?",
            autoHide: false,
            action: [
              {
                text: `Try Again`,
                function: () => {
                  setReactData(prev => ({
                    ...prev,
                    entered_name: '',
                    alert: false,
                    name_validation_result: null,
                    candidates: [],
                    verification_stage: false,
                    select_user: false
                  }));
                }
              },
              {
                text: `Create a New Account`,
                function: () => {
                  // Only pre-fill name fields if the entry was actually a name (not email/phone/id)
                  const nameParts = validation.lookupType === 'name' ? enteredName.trim().split(/\s+/) : [];
                  const firstName = nameParts[0] || '';
                  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                  setReactData(prev => ({
                    ...prev,
                    stage: 'select_account_type',
                    verification_stage: false,
                    // Store parsed name parts for pre-filling
                    parsed_first_name: firstName,
                    parsed_last_name: lastName,
                    alert: false,
                    name_validation_result: null,
                    candidates: [],
                    select_user: false
                  }));
                }
              }
            ]
          });
        }
        break;
      default:
        showAlert({
          severity: 'error',
          title: 'Validation Error',
          message: 'An unexpected error occurred during name validation.',
          autoHide: true
        });
    }
  };

  const handleVerificationInput = async (verificationInput) => {
    if (!verificationInput || verificationInput.trim() === '') {
      showAlert({
        severity: 'error',
        title: 'Input Required',
        message: `Please enter your ${reactData.verification_message}.`,
        autoHide: true
      });
      return;
    }

    const input = reactData.verification_input.trim().toLowerCase();

    // Does the candidate person_id have a PeopleAccounts record with email or cell that matches the input?
    let matchedAccount = await getDb({
      Key: {
        person_id: reactData.candidates[0].person_id
      },
      TableName: "People"
    });

    if (matchedAccount) {
      // Generate verification code
      const tempPass = uuid(6);

      // Determine send method and address
      let sendMethod = '';
      let sendAddress = '';

      if (matchedAccount.contact_info.email && matchedAccount.contact_info.email.address &&
        input === matchedAccount.contact_info.email.address.toLowerCase()) {
        sendMethod = 'email';
        sendAddress = matchedAccount.contact_info.email.address;
      } else if (matchedAccount.contact_info.cell && matchedAccount.contact_info.cell.number &&
        input.slice(-10) === matchedAccount.contact_info.cell.number.slice(-10)) {
        sendMethod = 'sms';
        sendAddress = matchedAccount.contact_info.cell.number;
      }

      if (!sendMethod) {
        showAlert({
          severity: 'error',
          title: 'No Match Found',
          message: `The ${reactData.verification_message} you entered doesn't match our records for this account. Please check and try again.`,
          autoHide: true
        });
        return;
      }
      else {
        try {
          // Send verification code
          await sendMessages({
            client: matchedAccount.client_id,
            author: reactData.user_id || 'AVA:Notifications',
            person_id: matchedAccount.person_id,
            preferred_method: sendMethod,
            messageText: `To verify your account, use this code: ${tempPass}`,
            recipientList: [matchedAccount.person_id],
            subject: `Verification code for your account`
          });

          // Show notification and switch to code verification stage
          const notificationMessage = sendMethod === 'email'
            ? `We've sent a verification code to ${sendAddress}. Look for the code in that message and enter it below.  (Make sure to check your spam/junk folder if you don't see the message in a minute or two.)`
            : `We've sent a verification code to ${sendAddress.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4')}. Look for the code in that text message and enter it below.`;

          setReactData(prev => ({
            ...prev,
            matched_account: matchedAccount,
            code_verification_stage: true,
            verification_stage: false,
            sent_verification_code: tempPass,
            code_sent_to: sendAddress,
            code_send_method: sendMethod
          }));

          showAlert({
            severity: 'info',
            title: 'Verification Code Sent',
            message: notificationMessage,
            autoHide: false
          });

        } catch (error) {
          console.error('Error sending verification code:', error);
          showAlert({
            severity: 'error',
            title: 'Send Error',
            message: 'Failed to send verification code. Please try again.',
            autoHide: false
          });
        }
      }
    } else {
      showAlert({
        severity: 'info',
        title: 'No Match Found',
        message: 'That info doesn\'t match any account in our records. You can create a new account below.',
        autoHide: false
      });
    }
  };

  const resetToNamePrompt = () => {
    setReactData(prev => ({
      ...prev,
      stage: 'prompt_for_name',
      entered_name: '',
      name_validation_result: null,
      candidates: [],
      select_user: false,
      verification_stage: false,
      verification_input: '',
      verification_message: '',
      matched_account: null,
      parsed_first_name: '',
      parsed_last_name: '',
      code_verification_stage: false,
      sent_verification_code: '',
      verification_code_input: '',
      code_sent_to: '',
      code_send_method: '',
      selected_account_type: '',
      selected_account_config: null,
      form_fields: {},
      field_values: {},
      field_validation_errors: {},
      loading_fields: false,
      family_members: [],
      current_member_index: 0,
      // Pre-auth reset
      preauth_code_input: '',
      matched_preauth_rec: null,
      preauth_person_id: null,
      preauth_lookup_type: null,
      updating_existing_person_id: null,
      existing_people_rec: null,
    }));
  };

  const handleVerificationCode = async (inputCode) => {
    if (!inputCode || inputCode.length !== 6) {
      showAlert({
        severity: 'error',
        title: 'Invalid Code',
        message: 'Please enter a 6-digit verification code.',
        autoHide: false
      });
      return;
    }

    if (inputCode !== reactData.sent_verification_code) {
      showAlert({
        severity: 'error',
        title: 'Code Mismatch',
        message: 'The code you entered doesn\'t match. Please check and try again.',
        autoHide: false
      });
      return;
    }

    // Code is correct - account verified, log the user in via URL redirect
    showAlert({
      severity: 'success',
      title: 'Account Verified',
      message: `Welcome back, ${reactData.matched_account.name.first} ${reactData.matched_account.name.last}! Logging you in...`,
      autoHide: false
    });

    // Use URL-based login approach (same pattern as TheseusScreen.js)
    // No &password=check here — the user already proved identity via the TFA code above
    sessionStorage.removeItem('AVASessionData');
    const baseUrl = window.location.href.split('?')[0];
    let loginUrl = `${baseUrl}?user=${reactData.matched_account.person_id}`;

    if (reactData.on_save_callback && (options.source === 'url_parameter')) { loginUrl += `&${reactData.on_save_callback}=true`; }

    // Small delay to show the success message before redirecting
    setTimeout(() => {
      window.location.replace(loginUrl);
    }, 1000);
  };

  /**
   * Handle the authorization code entered on the prompt_for_preauth_code stage.
   *
   * Two sub-paths:
   *   a) preauth_person_id is set   → existing account found at prompt_for_name.
   *      Check if already enrolled; if not, stub for future "add to group" work.
   *   b) preauth_person_id is null  → brand-new user path.
   *      Check one-time-use gate, then apply preauth_data to kick off account creation.
   */
  const handlePreAuthCodeInput = async (code, personId = null) => {
    // personId may be passed directly to avoid stale-closure issues with reactData
    if (!code || code.trim() === '') {
      showAlert({
        severity: 'error',
        title: 'Code Required',
        message: 'Please enter an authorization code to continue.',
        autoHide: true
      });
      return;
    }

    const normalizedCode = code.trim().toLowerCase();
    const preAuthRec = await lookupPreAuth(normalizedCode);

    if (!preAuthRec) {
      showAlert({
        severity: 'error',
        title: 'Invalid Code',
        message: 'That code is not recognized. Please check it and try again.',
        autoHide: false
      });
      return;
    }

    const usedBy = Array.isArray(preAuthRec.used_by) ? preAuthRec.used_by : [];
    // Use the passed personId first; fall back to reactData for manual (UI button) path
    const effectivePersonId = personId !== null ? personId : reactData.preauth_person_id;

    if (effectivePersonId) {
      // ── Existing-account path ────────────────────────────────────────────
      if (usedBy.includes(effectivePersonId)) {
        // Already enrolled with this code — skip update and go straight to AVA
        sessionStorage.removeItem('AVASessionData');
        const baseUrl = window.location.href.split('?')[0];
        showAlert({
          severity: 'success',
          title: 'Welcome Back',
          message: 'You\'re already enrolled. Logging you in...',
          autoHide: false
        });
        setTimeout(() => {
          window.location.replace(`${baseUrl}?user=${effectivePersonId}`);
        }, 1000);
        return;
      }
      // Fetch existing People record so gatherFormFields can pre-fill the form
      const existingPeopleRec = await getDb({
        Key: { person_id: effectivePersonId },
        TableName: 'People'
      });
      // Store existing account info before applying the preauth form config
      updateReactData({
        updating_existing_person_id: effectivePersonId,
        existing_people_rec: existingPeopleRec || null,
        parsed_first_name: existingPeopleRec?.name?.first || reactData.parsed_first_name || '',
        parsed_last_name:  existingPeopleRec?.name?.last  || reactData.parsed_last_name  || '',
      }, false);
      await applyPreAuthResult(preAuthRec);
    } else {
      // ── New-account path ─────────────────────────────────────────────────
      // Gate: code is restricted to updating existing accounts only
      if (preAuthRec.no_new_accounts) {
        showAlert({
          severity: 'error',
          title: 'Existing Account Required',
          message: "We couldn't find an existing account matching the name you entered. This code can only be used to update an existing account. Please check that your name is entered exactly as it appears in our records, then try again.",
          autoHide: false
        });
        return;
      }
      if (preAuthRec.one_time_use && usedBy.length > 0) {
        showAlert({
          severity: 'error',
          title: 'Code Already Used',
          message: 'This authorization code has already been used to create an account.',
          autoHide: false
        });
        return;
      }
      // Pre-fill name from preauth_data if available; fall back to entered name
      const nameParts = (reactData.entered_name || '').trim().split(/\s+/);
      updateReactData({
        parsed_first_name: preAuthRec.preauth_data?.first_name || nameParts[0] || '',
        parsed_last_name:  preAuthRec.preauth_data?.last_name  || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
      }, false);
      await applyPreAuthResult(preAuthRec);
    }
  };

  const goBackToEdit = () => {
    // Get the most recently added family member
    const lastMember = reactData.family_members[reactData.family_members.length - 1];

    if (lastMember) {
      // Remove the last family member from the array and restore its data for editing
      setReactData(prev => ({
        ...prev,
        family_members: prev.family_members.slice(0, -1), // Remove last member
        selected_account_type: lastMember.account_type,
        selected_account_config: lastMember.account_config,
        form_fields: lastMember.form_fields,
        field_values: lastMember.field_values,
        field_validation_errors: {}, // Clear validation errors when going back to edit
        loading_fields: false,
        current_member_index: lastMember.index, // Restore original index
        stage: 'fill_fields'
      }));
    }
  };

  /**
   * Save a SessionsV2 table record for a family member
   * Following PeopleMaintenance.js saveChanges routine pattern (lines 924-940)
   * 
   * @param {Object} member - Family member object with proposed_user_id and field_values
   * @returns {Promise<boolean>} - Success status
   */
  const saveSessionsV2Record = async (member) => {
    try {
      const memberName = getFamilyMemberName(member);

      // Build SessionsV2 record following PeopleMaintenance.js pattern
      const sessionRecord = {
        session_id: member.proposed_user_id,
        client_id: reactData.client_id,
        last_login: null,
        method: "QuickAdd",
        patient_display_name: memberName,
        patient_id: member.proposed_user_id,
        person_id: member.proposed_user_id,
        requirePassword: false,
        storePassword: true,
        subscription_status: "na",
        user_display_name: memberName,
        user_homeClient: reactData.client_id,
        user_id: member.proposed_user_id,
        last_update: new Date().toISOString()
      };

      // Apply any form_fields that specify saveAs with a sessionRec. prefix
      const fieldValues = member.field_values || {};
      Object.entries(member.form_fields || {}).forEach(([fieldName, formRec]) => {
        if (!Object.prototype.hasOwnProperty.call(fieldValues, fieldName)) { return; }
        const rawSaveAs = formRec.saveAs || formRec.value?.saveAs || formRec.prompt?.saveAs || false;
        if (!rawSaveAs) { return; }
        const saveAs = (typeof rawSaveAs === 'string')
          ? rawSaveAs.trim().replace(/^['"]+|['"]+$/g, '').replace(/[;,]+$/g, '')
          : String(rawSaveAs);
        const keys = saveAs.split('.');
        const rootKey = (keys[0] || '').toLowerCase();
        if (!rootKey.startsWith('session')) { return; }
        keys.shift(); // remove 'sessionRec' / 'sessionRecord' prefix
        if (keys.length === 0) { return; }
        let obj = sessionRecord;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]]) { obj[keys[i]] = {}; }
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = fieldValues[fieldName];
      });

      // Handle *password special field
      if (Object.prototype.hasOwnProperty.call(fieldValues, '*password') && fieldValues['*password']) {
        sessionRecord.last_login = fieldValues['*password'];
        sessionRecord.requirePassword = true;
        sessionRecord.forceSetPassword = false;
      }

      console.log('Saving SessionsV2 record:', sessionRecord);

      // Save to SessionsV2 table
      await putDb({
        TableName: 'SessionsV2',
        Item: sessionRecord
      });

      return true;
    } catch (error) {
      console.error('Error saving SessionsV2 record for member:', member, error);
      throw error;
    }
  };

  /**
   * Save a People table record for a family member
   * Following PeopleMaintenance.js saveChanges routine pattern
   * 
   * @param {Object} member - Family member object with proposed_user_id and field_values
   * @returns {Promise<boolean>} - Success status
   */
  const savePeopleRecord = async (member) => {
    try {
      // ── Existing-account update path ─────────────────────────────────────────
      if (member.is_existing_account) {
        // Inline phone conversion (mirrors convertPhoneToStorageFormat below)
        const toPhone = (v) => {
          if (!v) return v;
          const d = String(v).replace(/\D/g, '');
          if (d.length === 10) return `+1${d}`;
          if (d.length === 11 && d.startsWith('1')) return `+${d}`;
          if (d.length >= 10 && d.length <= 15) return v.startsWith('+') ? v : `+${d}`;
          return v;
        };

        const existingRecord = await getDb({
          Key: { person_id: member.proposed_user_id },
          TableName: 'People'
        });
        if (!existingRecord) {
          throw new Error(`People record not found for ${member.proposed_user_id}`);
        }

        // Apply form field values via saveAs paths
        const fv = member.field_values || {};
        Object.entries(member.form_fields || {}).forEach(([fieldName, formRec]) => {
          if (!formRec || !Object.prototype.hasOwnProperty.call(fv, fieldName)) return;
          const rawSaveAs = formRec.saveAs || formRec.value?.saveAs || formRec.prompt?.saveAs || false;
          const saveAs = (typeof rawSaveAs === 'string')
            ? rawSaveAs.trim().replace(/^['"]+|['"]+$/g, '').replace(/[;,]+$/g, '')
            : rawSaveAs;
          if (!saveAs) return;
          const keys = String(saveAs).split('.');
          const rootKey = (keys[0] || '').toLowerCase();
          if (rootKey.startsWith('session')) return;
          if (rootKey.startsWith('person') || rootKey.startsWith('people')) keys.shift();
          let obj = existingRecord;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = formRec.value?.type === 'phone'
            ? toPhone(fv[fieldName])
            : fv[fieldName];
        });

        // Merge preauth groups into existing groups array
        const rawPreauthGroups = member.preauth_extra_fields?._preauth_groups;
        let preauthGroups = [];
        if (Array.isArray(rawPreauthGroups)) {
          preauthGroups = rawPreauthGroups.map(g => String(g).trim()).filter(Boolean);
        } else if (typeof rawPreauthGroups === 'string' && rawPreauthGroups.trim()) {
          preauthGroups = rawPreauthGroups.split(',').map(g => g.trim()).filter(Boolean);
        }
        if (preauthGroups.length > 0) {
          const existing = Array.isArray(existingRecord.groups) ? existingRecord.groups : [];
          existingRecord.groups = [...new Set([...existing, ...preauthGroups])];
        }

        // Apply any extra preauth fields (non-group keys not in field_list)
        const extraFields = member.preauth_extra_fields || {};
        Object.entries(extraFields).forEach(([key, value]) => {
          if (key === '_preauth_groups') return;
          if (value !== undefined && value !== null && value !== '') {
            existingRecord[key] = value;
          }
        });

        existingRecord.last_update = new Date().toISOString();
        console.log('Updating existing People record:', existingRecord);
        await putDb({ TableName: 'People', Item: existingRecord });

        if (preauthGroups.length > 0) {
          await addMember(existingRecord.person_id, reactData.client_id, preauthGroups)
            .catch(err => console.error('addMember error during QuickAdd update:', err));
        }

        return true;
      }
      // ── New-account path ──────────────────────────────────────────────────────

      const fieldValues = member.field_values || {};

      // Extract names (same logic as getFamilyMemberName)
      const firstName = fieldValues.first_name ||
        fieldValues.firstName ||
        fieldValues.fname ||
        fieldValues['first name'] ||
        '';

      const lastName = fieldValues.last_name ||
        fieldValues.lastName ||
        fieldValues.lname ||
        fieldValues.surname ||
        fieldValues['last name'] ||
        '';

      if (!firstName || !lastName) {
        throw new Error('First name and last name are required');
      }

      // Get default groups from account_config
      const defaultGroups = member.account_config?.default_groups || [];

      // Merge preauth_data.groups (same normalization as the existing-account enrollment path)
      const rawPreauthGroups = member.preauth_extra_fields?._preauth_groups;
      let preauthGroups = [];
      if (Array.isArray(rawPreauthGroups)) {
        preauthGroups = rawPreauthGroups.map(g => String(g).trim()).filter(Boolean);
      } else if (typeof rawPreauthGroups === 'string' && rawPreauthGroups.trim()) {
        preauthGroups = rawPreauthGroups.split(',').map(g => g.trim()).filter(Boolean);
      }

      const groups = [...new Set(["__TOP__", "ALL", ...defaultGroups, ...preauthGroups])];

      // Extract contact info for preferred methods
      const email = fieldValues.email || fieldValues.eMail || fieldValues['e-Mail'] || fieldValues.email_address || fieldValues['email address'] || '';
      const phone = fieldValues.phone || fieldValues.phone_number || fieldValues['phone number'] || '';
      const cell = fieldValues.cell || fieldValues.cell_phone || fieldValues['cell phone'] || phone;

      // Convert phone numbers to storage format (+12223334444)
      const convertPhoneToStorageFormat = (phoneValue) => {
        if (!phoneValue) return phoneValue;
        const digitsOnly = phoneValue.replace(/\D/g, '');

        if (digitsOnly.length === 10) {
          return `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          return `+${digitsOnly}`;
        } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
          return phoneValue.startsWith('+') ? phoneValue : `+${digitsOnly}`;
        }
        return phoneValue; // Return original if can't convert
      };

      const cellForStorage = convertPhoneToStorageFormat(cell);

      // Determine preferred messaging method
      let preferred_methods = ['AVA'];
      let preferred_method = 'AVA';

      let client_preference = 'email';
      if (reactData.client_id) {
        const clientStyleRec = await dbClient
          .get({
            Key: { client_id: reactData.client_id, custom_key: 'client_style' },
            TableName: 'Customizations'
          })
          .promise()
          .catch(() => null);
        if (clientStyleRec?.Item?.customization_value?.preferred_communication) {
          client_preference = clientStyleRec.Item.customization_value.preferred_communication;
        }
      }

      if (client_preference === 'sms' || client_preference === 'text') {
        if (cellForStorage) {
          preferred_methods = ['sms'];
          preferred_method = 'sms';
        }
        else if (email) {
          preferred_methods = ['email'];
          preferred_method = 'email';
        }
      }
      else {
        if (email) {
          preferred_methods = ['email'];
          preferred_method = 'email';
        }
        else if (cellForStorage) {
          preferred_methods = ['sms'];
          preferred_method = 'sms';
        }
      }

      // Build search data following PeopleMaintenance.js pattern (lines 834-854)
      let search_words = [
        titleCase(firstName),
        titleCase(lastName),
        firstName.toLowerCase(),
        lastName.toLowerCase(),
        cellForStorage ? cellForStorage.slice(-10) : ' '
      ];

      // Build contact_info object
      const contact_info = {};
      const messaging = {};
      if (email) {
        contact_info.email = { address: email };
        messaging.email = email;
      }
      if (cellForStorage) {
        contact_info.cell = { number: cellForStorage };
        messaging.sms = cellForStorage;
      }

      // Build People record following PeopleMaintenance.js pattern
      const peopleRecord = {
        person_id: member.proposed_user_id,
        client_id: reactData.client_id,
        name: {
          first: firstName,
          last: lastName
        },
        display_name: `${firstName} ${lastName}`,
        groups: groups,
        preferred_methods: preferred_methods,
        preferred_method: preferred_method,
        contact_info: contact_info,
        messaging: messaging,
        account_type: member.account_type
      };

      // pick-out form_field instructions and place data properly in People rec
      Object.entries(member.form_fields).forEach(([fieldName, formRec]) => {
        if (Object.prototype.hasOwnProperty.call(fieldValues, fieldName)) {
          const rawSaveAs = formRec.saveAs || formRec.value?.saveAs || formRec.prompt?.saveAs || false;
          const saveAs = (typeof rawSaveAs === 'string')
            ? rawSaveAs.trim().replace(/^['"]+|['"]+$/g, '').replace(/[;,]+$/g, '')
            : rawSaveAs;
          if (saveAs) {
            const keys = String(saveAs).split('.');
            const rootKey = (keys[0] || '').toLowerCase();
            if (rootKey.startsWith('session')) { return; } // sessionRec fields are handled by saveSessionsV2Record
            if (rootKey.startsWith('person') || rootKey.startsWith('people')) { keys.shift(); } // remove leading 'person' if present
            let obj = peopleRecord;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!obj[keys[i]]) obj[keys[i]] = {};
              obj = obj[keys[i]];
            }
            if (formRec.value?.type === 'phone') {
              obj[keys[keys.length - 1]] = convertPhoneToStorageFormat(fieldValues[fieldName]);
            }
            else {
              obj[keys[keys.length - 1]] = fieldValues[fieldName];
            }
          }
        }
      });

      // Set search_data following PeopleMaintenance.js pattern (lines 834-854)
      // First, ensure we join the search_words as the base search_data
      peopleRecord.search_data = search_words.join(' ');

      // Add family_id if it exists
      if (reactData.family_id) {
        peopleRecord.family_groups = [reactData.family_id];
        peopleRecord.family_id = reactData.family_id;
      }

      // Add any additional field values to the record
      Object.entries(fieldValues).forEach(([fieldName, fieldValue]) => {
        // Skip fields that were already handled by the saveAs loop above
        const formRec = member.form_fields[fieldName];
        const hasSaveAs = !!(formRec?.saveAs || formRec?.value?.saveAs || formRec?.prompt?.saveAs);
        if (hasSaveAs) { return; }

        if (fieldValue && !['first_name', 'firstName', 'fname', 'first name',
          'last_name', 'lastName', 'lname', 'surname', 'last name',
          'email', 'email_address', 'email address',
          'phone', 'phone_number', 'phone number',
          'cell', 'cell_phone', 'cell phone',
          'groups'].includes(fieldName)) {

          // Check if this is a date field and convert to numeric$ format for storage
          const fieldData = member.form_fields[fieldName];
          if (fieldData && fieldData.value?.type === 'date') {
            const dateResult = makeDate(fieldValue);
            // Save the numeric$ value (YYYYMMDD format) instead of the display value
            const saveValue = dateResult.error ? fieldValue : dateResult.numeric$;
            console.log(`Converting date field '${fieldName}': '${fieldValue}' -> '${saveValue}'`);
            peopleRecord[fieldName] = saveValue;
          } else if (fieldData && fieldData.value?.type === 'phone') {
            // Convert phone number to +12223334444 format for storage
            const digitsOnly = fieldValue.replace(/\D/g, '');
            let phoneForStorage = fieldValue; // Default to original value if conversion fails

            if (digitsOnly.length === 10) {
              // US 10-digit number: add +1 prefix
              phoneForStorage = `+1${digitsOnly}`;
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
              // US 11-digit number starting with 1: add + prefix
              phoneForStorage = `+${digitsOnly}`;
            } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
              // International format: add + prefix if not present
              if (!fieldValue.startsWith('+')) {
                phoneForStorage = `+${digitsOnly}`;
              }
            }

            console.log(`Converting phone field '${fieldName}': '${fieldValue}' -> '${phoneForStorage}'`);
            peopleRecord[fieldName] = phoneForStorage;
          } else {
            peopleRecord[fieldName] = fieldValue;
          }
        }
      });

      // Write preauth_extra_fields directly onto the People record (fields not in form_fields/field_list)
      // Skip _preauth_groups — already consumed above when building the groups array
      const extraFields = member.preauth_extra_fields || {};
      Object.entries(extraFields).forEach(([key, value]) => {
        if (key === '_preauth_groups') { return; }
        if (value !== undefined && value !== null && value !== '') {
          peopleRecord[key] = value;
        }
      });

      peopleRecord.created_on = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
      peopleRecord.last_update = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"

      console.log('Saving People record:', peopleRecord);

      // Save to People table
      await putDb({
        TableName: 'People',
        Item: peopleRecord
      });

      // Register group memberships via addMember now that the People record exists
      const groupsToAdd = groups.filter(g => g !== '__TOP__' && g !== 'ALL');
      if (groupsToAdd.length > 0) {
        await addMember(peopleRecord.person_id, reactData.client_id, groupsToAdd)
          .catch(err => console.error('addMember error during QuickAdd:', err));
      }

      // update the cross-reference table PeopleAccounts
      // Note here...  we are intentionally NOT removing old records from PeopleAccounts because we want to preserve the history of all accounts that have ever been associated with this person_id
      // This means that a mis-spelled email, phone number, or name will still be a valid cross reference.

      // Add new records for all phone numbers and email addresses
      const phoneFields = [
        { field: peopleRecord.contact_info?.cell?.number?.slice(-10), type: 'phone_number' },
        { field: peopleRecord.contact_info?.landline?.number?.slice(-10), type: 'phone_number' },
        { field: peopleRecord.contact_info?.work?.number?.slice(-10), type: 'phone_number' },
        { field: peopleRecord.contact_info?.alternate?.number?.slice(-10), type: 'phone_number' }
      ];

      const emailFields = [
        { field: peopleRecord.contact_info?.email?.address?.toLowerCase(), type: 'eMail' },
        { field: peopleRecord.contact_info?.alt_email?.address?.toLowerCase(), type: 'eMail' }
      ];

      const nameFields = [
        { field: (`${peopleRecord.name?.first} ${peopleRecord.name?.last} ${peopleRecord.client_id}`).toLowerCase(), type: 'name' },
      ];

      const allFields = [...phoneFields, ...emailFields, ...nameFields];

      // Build batch write items for non-empty fields
      const putRequests = allFields
        .filter(accountField => !isEmpty(accountField.field))
        .map(accountField => ({
          PutRequest: {
            Item: {
              person_id: peopleRecord.person_id,
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
      return true;
    } catch (error) {
      console.error('Error saving People record for member:', member, error);
      throw error;
    }
  };

  /**
   * Save a FamilyGroups table record 
   * Following the pattern from LinkedAccounts.js and PeopleMaintenance.js
   * 
   * Creates both header record and individual person records for the family
   * Based on FamilyMaintenance.js patterns and LinkedAccounts.js family creation
   * 
   * If adding to existing family:
   * - Updates existing FamilyGroups record by appending new members to other_members array
   * - Preserves primary_contact (first member remains primary)
   * 
   * @param {Array} familyMembers - Array of family member objects with proposed_user_id and field_values
   * @param {string} familyId - Generated family ID (e.g., "family_1704067200000") or existing family_id
   * @param {Object} existingFamilyRec - Existing family record if adding to existing family (optional)
   * @returns {Promise<boolean>} - Success status
   */
  const saveFamilyGroupsRecord = async (familyMembers, familyId, existingFamilyRec = null) => {
    try {
      if (!familyId || !Array.isArray(familyMembers) || familyMembers.length === 0) {
        return false; // No family to create
      }

      let familyRecord;

      if (existingFamilyRec) {
        // Adding to existing family - preserve primary_contact and append new members
        console.log('Adding members to existing family:', existingFamilyRec.family_id);
        familyRecord = deepCopy(existingFamilyRec);

        // Append new members to other_members array
        for (let i = 0; i < familyMembers.length; i++) {
          const member = familyMembers[i];
          const fieldValues = member.field_values || {};
          const firstName = fieldValues.first_name ||
            fieldValues.firstName ||
            fieldValues.fname ||
            fieldValues['first name'] || '';
          const lastName = fieldValues.last_name ||
            fieldValues.lastName ||
            fieldValues.lname ||
            fieldValues.surname ||
            fieldValues['last name'] || '';

          familyRecord.other_members.push({
            id: member.proposed_user_id,
            name: `${firstName} ${lastName}`,
            role: member.account_config?.family_role || 'member'
          });
        }
      } else {
        // Creating new family - determine primary contact (first family member)
        const primaryMember = familyMembers[0];
        const primaryFieldValues = primaryMember.field_values || {};
        const primaryLastName = primaryFieldValues.last_name ||
          primaryFieldValues.lastName ||
          primaryFieldValues.lname ||
          primaryFieldValues.surname ||
          primaryFieldValues['last name'] || '';

        // Create family name using primary member's last name
        const familyName = primaryLastName ? `The ${primaryLastName} Family` : 'Family';

        // Create family record (following FamilyMaintenance.js pattern line 204-220)
        familyRecord = {
          client_id: reactData.client_id,
          composite_key: familyId,
          family_id: familyId,
          family_name: familyName,
          primary_contact: {},
          other_members: []
        };

        // Create person records for each family member (following FamilyMaintenance.js pattern line 958-970)
        for (let i = 0; i < familyMembers.length; i++) {
          const member = familyMembers[i];
          const fieldValues = member.field_values || {};
          const firstName = fieldValues.first_name ||
            fieldValues.firstName ||
            fieldValues.fname ||
            fieldValues['first name'] || '';
          const lastName = fieldValues.last_name ||
            fieldValues.lastName ||
            fieldValues.lname ||
            fieldValues.surname ||
            fieldValues['last name'] || '';

          if (member.account_config?.family_role === 'primary') {
            familyRecord.primary_contact = {
              id: member.proposed_user_id,
              name: `${firstName} ${lastName}`
            };
          }
          else {
            familyRecord.other_members.push({
              id: member.proposed_user_id,
              name: `${firstName} ${lastName}`,
              role: member.account_config?.family_role || 'member'
            });
          }
        }
      }

      console.log(`Saving FamilyGroups record:`, familyRecord);

      await putDb({
        TableName: 'FamilyGroups',
        Item: familyRecord
      });

      return true;
    } catch (error) {
      console.error('Error saving FamilyGroups records:', error);
      throw error;
    }
  };

  /**
   * Apply field formatting based on field configuration
   * Supports: sentenceCase
   * 
   * @param {string} value - The field value to format
   * @param {string} formatType - The format type (e.g., "sentenceCase")
   * @returns {string} - The formatted value
   */
  /**
   * Send on_complete_message notifications after a People record is saved.
   * @param {Object} member - The saved family member with proposed_user_id and field_values
   */
  const sendOnCompleteMessages = async (member) => {
    const messages = member.account_config?.on_complete_message;
    if (!messages || !Array.isArray(messages) || messages.length === 0) { return; }

    const person_id = member.proposed_user_id;
    const fieldValues = member.field_values || {};
    const firstName = fieldValues.first_name || fieldValues.firstName || fieldValues.fname || fieldValues['first name'] || '';
    const lastName = fieldValues.last_name || fieldValues.lastName || fieldValues.lname || fieldValues.surname || fieldValues['last name'] || '';
    const fullName = `${firstName} ${lastName}`.trim();

    const resolveText = (text) => {
      if (!text) { return text; }
      // Replace {{user_id}} and {{name}}
      let result = text
        .replace(/\{\{user_id\}\}/gi, person_id)
        .replace(/\{\{name\}\}/gi, fullName);
      // Replace {{href:...}} with an HTML hyperlink
      result = result.replace(/\{\{href:([^}]+)\}\}/gi, (match, url) => {
        return `<a href="${url.trim()}">this link</a>`;
      });
      return result;
    };

    for (const msgInstructions of messages) {
      try {
        const rawRecipients = msgInstructions.recipientList?.people || [];
        const recipientList = rawRecipients.map(r => (r === '*user_id' ? person_id : r));
        if (recipientList.length === 0) { continue; }

        await sendMessages({
          client: reactData.client_id,
          author: msgInstructions.author || state?.session?.user_id || person_id,
          person_id: msgInstructions.author || state?.session?.user_id || person_id,
          messageText: resolveText(msgInstructions.messageText || ''),
          recipientList,
          subject: resolveText(msgInstructions.subject || '')
        });
      } catch (error) {
        console.error('Error sending on_complete_message:', error);
      }
    }
  };

  const applyFieldFormat = (value, formatType) => {
    if (!value || !formatType) {
      return value;
    }

    if (formatType === 'sentenceCase') {
      // Convert to sentence case: first letter uppercase, rest lowercase
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }

    return value;
  };

  /**
   * Generate unique user ID for a family member
   * Format: firstInitial + lastName + "-" + client_id (all lowercase)
   * If duplicate exists, increment counter: firstInitial + lastName + counter + "-" + client_id
   * 
   * @param {Object} member - Family member object with field_values
   * @returns {Promise<string>} - Unique user ID
   */
  const generateUniqueUserId = async (member) => {
    const fieldValues = member.field_values || {};

    // Extract first and last names using same logic as getFamilyMemberName
    const firstName = fieldValues.first_name ||
      fieldValues.firstName ||
      fieldValues.fname ||
      fieldValues['first name'] ||
      '';

    const lastName = fieldValues.last_name ||
      fieldValues.lastName ||
      fieldValues.lname ||
      fieldValues.surname ||
      fieldValues['last name'] ||
      '';

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required to generate user ID');
    }

    const firstInitial = firstName.charAt(0).toLowerCase();
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z]/g, ''); // Remove non-alphabetic characters
    const clientId = reactData.client_id;

    let clientStyle = state?.session?.client_style || null;
    if (!clientStyle && clientId) {
      const clientStyleRec = await dbClient
        .get({
          Key: { client_id: clientId, custom_key: 'client_style' },
          TableName: 'Customizations'
        })
        .promise()
        .catch(() => null);
      if (clientStyleRec?.Item?.customization_value) {
        clientStyle = clientStyleRec.Item.customization_value;
      }
    }
    const rawSuffix = clientStyle?.client_suffix;
    const useNameOnly = (rawSuffix === '*none');
    const customSuffix = (!useNameOnly && rawSuffix) ? rawSuffix : null;

    let counter = '';
    let proposedId = '';
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    // Check for uniqueness
    while (attempts < maxAttempts) {
      if (useNameOnly) {
        proposedId = `${firstInitial}${cleanLastName}${counter}`.toLowerCase();
      } else if (customSuffix) {
        proposedId = `${firstInitial}${cleanLastName}${counter}-${customSuffix}`.toLowerCase();
      } else {
        proposedId = `${firstInitial}${cleanLastName}${counter}-${clientId}`.toLowerCase();
      }

      try {
        // Check if this ID already exists in any family members being created
        let existsInFamily = false;
        for (const m of reactData.family_members) {
          if (m.proposed_user_id === proposedId) {
            existsInFamily = true;
            break;
          }
        }

        if (existsInFamily) {
          // ID already used in this creation session, increment counter
          attempts++;
          counter = attempts + 1; // Start with 2, then 3, 4, etc.
          continue;
        }

        // Check if this ID already exists in People table
        const existingPerson = await getDb({
          Key: { person_id: proposedId },
          TableName: 'People'
        });

        if (!existingPerson) {
          // ID is unique, return it
          return proposedId;
        }

        // ID exists, increment counter
        attempts++;
        counter = attempts + 1; // Start with 2, then 3, 4, etc.
      } catch (error) {
        console.error('Error checking user ID uniqueness:', error);
        throw new Error('Failed to check user ID uniqueness');
      }
    }

    throw new Error(`Could not generate unique user ID after ${maxAttempts} attempts`);
  };

  /**
   * Complete the QuickAdd process and generate family_id if multiple members
   * 
   * Following the pattern from FamilyMaintenance.js and LinkedAccounts.js:
   * - For multiple family members, generates unique family_id using "family_" + timestamp
   * - This family_id will be used for FamilyGroups table entries when accounts are created
   * - Pattern: family_<timestamp> (e.g., "family_1704067200000")
   * - Allows grouping related family members in the database
   * - Generates unique user_id for each family member: firstInitial + lastName + "-" + client_id
   * 
   * If adding to existing family:
   * - Uses existing family_id instead of generating new one
   * - Later updates FamilyGroups record to include new members
   * 
   * References:
   * - FamilyMaintenance.js line 205: const newFamilyID = `family_${new Date().getTime()}`;
   * - LinkedAccounts.js line 343: family_id: `family_${timestamp}`
   */
  const completeProcess = async () => {
    console.log('completeProcess called - current stage:', reactData.stage);
    console.log('Current family_members count:', reactData.family_members.length);
    console.log('Existing family_id:', reactData.family_id);
    console.log('Adding to existing family:', !!reactData.existing_family_rec);

    try {
      setReactData(prev => {
        console.log('Setting loading_user_ids to true, current stage:', prev.stage);
        return {
          ...prev,
          loading_user_ids: true
        };
      });

      console.log('About to set stage to complete with', reactData.family_members.length, 'members');

      setReactData(prev => {
        console.log('Setting stage to complete, prev stage:', prev.stage);
        let updatedData = {
          ...prev,
          loading_user_ids: false,
          stage: 'complete'
        };

        // Generate family_id if multiple family members AND not adding to existing family
        if (prev.family_members.length > 1 && !prev.existing_family_rec) {
          const family_id = `family_${new Date().getTime()}`;
          updatedData.family_id = family_id;
        }

        console.log('Returning updated data with stage:', updatedData.stage);
        return updatedData;
      });

      // Show alerts after state update to avoid interference
      if (reactData.family_members.length > 1) {
        if (reactData.existing_family_rec) {
          showAlert({
            severity: 'success',
            title: 'Adding to Family',
            message: `Adding ${reactData.family_members.length} member(s) to family: ${reactData.existing_family_rec.family_name}`
          });
        } else {
          const family_id = `family_${new Date().getTime()}`;
          showAlert({
            severity: 'success',
            title: 'Family ID Generated',
            message: `Family ID generated for ${reactData.family_members.length} family members: ${family_id}`
          });
        }
      }

      // Show success message with user IDs
      const userIdList = reactData.family_members.map(member =>
        `${getFamilyMemberName(member)}: ${member.proposed_user_id}`
      ).join(', ');

      const primaryAccountConfig = reactData.family_members[0]?.account_config;
      const assignedDetail = primaryAccountConfig?.on_user_assigned || null;

      showAlert({
        severity: 'success',
        title: 'User IDs Generated',
        message: `User IDs generated: ${userIdList}`,
        detail: assignedDetail,
        autoHide: false
      });
    } catch (error) {
      console.error('Error in completeProcess:', error);
      showAlert({
        severity: 'error',
        title: 'Process Failed',
        message: `Failed to complete process: ${error.message}`
      });
      setReactData(prev => ({
        ...prev,
        loading_user_ids: false
      }));
    }
  };

  const goBackToAddMore = () => {
    setReactData(prev => ({
      ...prev,
      stage: 'ask_for_more'
    }));
  };

  const getFamilyMemberName = (member) => {
    if (!member) return 'My Family';
    const fieldValues = member.field_values || {};

    // Look for common first name field variations
    const firstName = fieldValues.first_name ||
      fieldValues.firstName ||
      fieldValues.fname ||
      fieldValues['first name'] ||
      '';

    // Look for common last name field variations
    const lastName = fieldValues.last_name ||
      fieldValues.lastName ||
      fieldValues.lname ||
      fieldValues.surname ||
      fieldValues['last name'] ||
      '';

    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }

    // Fallback: look for a general 'name' field
    const fullName = fieldValues.name || fieldValues.full_name || fieldValues.fullName || '';
    if (fullName) {
      return fullName;
    }

    // If no name fields found, return account type
    return titleCase(member.account_type);
  };

  const hasUnsavedChanges = () => {
    // Check if user has entered any data or is in the middle of creating an account
    const hasEnteredName = reactData.entered_name && reactData.entered_name.trim() !== '';
    const hasFieldValues = Object.values(reactData.field_values).some(val => val && val !== '');
    const hasFamilyMembers = reactData.family_members && reactData.family_members.length > 0;

    return hasEnteredName || hasFieldValues || hasFamilyMembers;
  };

  const handleDialogClose = async () => {
    // If there are unsaved changes, show confirmation
    if (hasUnsavedChanges()) {
      updateReactData({ exit_confirm: true }, true);
      return;
    }

    // No unsaved changes, proceed with close
    await proceedWithExit();
  };

  const proceedWithExit = async () => {
    // Handle dialog close (X button) based on how QuickAdd was invoked
    if (options.source === 'url_parameter') {
      if (reactData.require_pre_auth) {
        // Preauth mode: no going back — there is no valid state to return to.
        // Note: recordPreAuthUse is only called after People records are fully saved,
        // so there is nothing to clean up in the used_by list at this point.
        sessionStorage.removeItem('AVASessionData');
        window.location.replace(`${window.location.origin}/thankyou?client=${reactData.client_id}`);
      } else if (reactData.stage !== 'prompt_for_name') {
        resetToNamePrompt();
      }
      else {
        // URL-driven mode - close the entire application
        sessionStorage.removeItem('AVASessionData');
        removeCookie("AVAuser", { path: '/' });
        try {
          await Auth.signOut();
        } catch (e) {
          console.log('No existing Cognito session to sign out');
        }
        let jumpTo = window.location.origin;
        window.location.replace(`${jumpTo}?client=${reactData.client_id}`);
      }
    } else {
      // Normal admin mode - just close the dialog
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <Dialog open={true || reactData.initialized || refreshTrigger}
      aria-labelledby="scroll-dialog-title"
      p={2}
      classes={{ paper: classes.clientPopUp }}
      fullWidth
      maxWidth="md"
      variant={'elevation'}
      elevation={2}
      scroll="body"
      PaperProps={{
        style: {
          maxHeight: '90vh',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column'
        },
        tabIndex: -1,
        ref: dialogFocusRef
      }}
      onClose={async () => {
        await handleDialogClose();
      }}
    >
      <DialogContentText
        id='scroll-dialog-title'
        style={{
          ...AVATextStyle({
            size: 1.4,
            bold: true,
            margin: { left: 0, top: 1 }
          }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          padding: '16px 24px 8px 16px'
        }}
      >
        <span>
          {reactData.stage === 'prompt_for_name' ?
            "Let's Get Started" :
            reactData.stage === 'prompt_for_preauth_code' ?
              'Authorization Required' :
              reactData.stage === 'ask_for_more' ?
                `${getFamilyMemberName(reactData.family_members[reactData.current_member_index])}` :
                reactData.stage === 'complete' ?
                  (reactData.family_members.length === 1 ?
                    `${getFamilyMemberName(reactData.family_members[0])} Ready` :
                    `All Family Members Ready (${reactData.family_members.length} total)`) :
                  reactData.selected_account_type ?
                    (reactData.current_member_index > 0 ?
                      `${titleCase(reactData.selected_account_type)} - Family Member ${reactData.current_member_index + 1}` :
                      titleCase(reactData.selected_account_type)) :
                    (reactData.current_member_index > 0 ?
                      `Select Account Type - Family Member ${reactData.current_member_index + 1}` :
                      'Select Account Type')
          }
        </span>
        {/* Show client logo on the right side during name/code prompt stages */}
        {(reactData.stage === 'prompt_for_name' || reactData.stage === 'prompt_for_preauth_code') && state.session?.client_logo && (
          <img
            src={state.session.client_logo}
            alt="Client Logo"
            style={{
              height: '40px',
              maxWidth: '120px',
              objectFit: 'contain',
              marginLeft: '16px',
              marginRight: '16px'
            }}
            onError={(e) => {
              // Hide the image if it fails to load
              e.target.style.display = 'none';
            }}
          />
        )}
      </DialogContentText>

      <Box style={{
        padding: '16px',
        flexGrow: 1,
        overflow: 'auto',
        minHeight: 0
      }}>
        {/* Name Prompt Stage */}
        {reactData.stage === 'prompt_for_name' && !reactData.verification_stage && (
          <Box style={{ marginTop: '16px' }}>
            <Typography variant="h6" style={{ marginBottom: '16px' }}>
              {reactData.preauth_match_on === 'name'
                ? `Please enter your full name.`
                : `First, let's check to see if you already have an account. Please enter your name, e-Mail address, phone number, or User ID.  If we find a match, we'll ask you to verify your account.  If not, we'll help you create a new one.`
              }
            </Typography>
            <TextField
              fullWidth
              label={reactData.preauth_match_on === 'name' ? 'Full name (first and last)' : 'Name (first and last), e-Mail, Phone Number, or User ID'}
              value={reactData.entered_name}
              onChange={(event) => {
                const value = event?.target?.value || '';
                setReactData(prev => ({ ...prev, entered_name: value }));
              }}
              style={{ marginBottom: '16px' }}
              onKeyPress={(event) => {
                if (event?.key === 'Enter') {
                  handleNameLookup(reactData.entered_name);
                }
              }}
            />
            <Box style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleNameLookup(reactData.entered_name)}
                disabled={!reactData.entered_name.trim()}
              >
                Continue
              </Button>
              <Button
                variant="contained"
                style={{ backgroundColor: '#9c27b0', color: 'white' }}
                onClick={() => {
                  // If we have family members already, go back to ask_for_more screen
                  if (reactData.family_members && reactData.family_members.length > 0) {
                    setReactData(prev => ({
                      ...prev,
                      stage: 'ask_for_more',
                      entered_name: ''
                    }));
                  } else {
                    // Otherwise close the entire dialog
                    proceedWithExit();
                    // onClose();
                  }
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}

        {/* Pre-Authorization Code Prompt Stage */}
        {reactData.stage === 'prompt_for_preauth_code' && (
          <Box style={{ marginTop: '16px' }}>
            <Typography variant="h6" style={{ marginBottom: '16px' }}>
              {reactData.preauth_code_prompt}
            </Typography>
            <TextField
              fullWidth
              label="Authorization Code"
              value={reactData.preauth_code_input}
              onChange={(event) => {
                const value = event?.target?.value || '';
                setReactData(prev => ({ ...prev, preauth_code_input: value }));
              }}
              style={{ marginBottom: '16px' }}
              onKeyPress={(event) => {
                if (event?.key === 'Enter') {
                  handlePreAuthCodeInput(reactData.preauth_code_input);
                }
              }}
            />
            <Box style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handlePreAuthCodeInput(reactData.preauth_code_input)}
                disabled={!reactData.preauth_code_input.trim()}
              >
                Continue
              </Button>
              {reactData.preauth_person_id && (
                <Button
                  variant="contained"
                  style={{ backgroundColor: '#388e3c', color: 'white' }}
                  onClick={() => {
                    sessionStorage.removeItem('AVASessionData');
                    const baseUrl = window.location.href.split('?')[0];
                    if (reactData.preauth_lookup_type === 'user_id') {
                      window.location.replace(`${baseUrl}?user=${reactData.preauth_person_id}&password=check`);
                    } else {
                      window.location.replace(baseUrl);
                    }
                  }}
                >
                  Log in to AVA
                </Button>
              )}
              <Button
                variant="contained"
                style={{ backgroundColor: '#9c27b0', color: 'white' }}
                onClick={resetToNamePrompt}
              >
                Start Over
              </Button>
            </Box>
          </Box>
        )}

        {/* Email/Phone Verification Stage (when matches found) */}
        {reactData.verification_stage && reactData.candidates && reactData.candidates.length > 0 && (
          <Box style={{ marginTop: '48px' }}>
            <Typography variant="h6" style={{ marginBottom: '16px' }}>
              {`It looks like you may already have an account. Enter your ${reactData.verification_message} and I will double check, or tap "I'm new here" below to create a new account.`}
            </Typography>

            {!reactData.matched_account && (
              <>
                <TextField
                  fullWidth
                  label={reactData.verification_message}
                  onChange={(event) => {
                    const value = event?.target?.value || '';
                    setReactData(prev => ({ ...prev, verification_input: value }));
                  }}
                  style={{ marginBottom: '16px' }}
                  onKeyPress={(event) => {
                    if (event?.key === 'Enter') {
                      handleVerificationInput(reactData.verification_input);
                    }
                  }}
                />
                <Box style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleVerificationInput(reactData.verification_input)}
                    disabled={!reactData.verification_input.trim()}
                  >
                    Check Account
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => {
                      // Proceed to create new account
                      // Parse the entered name for pre-filling form fields

                      let firstName, lastName, email, phone;
                      switch (reactData.name_validation_result.lookupType) {
                        case 'name': {
                          const nameParts = reactData.name_validation_result.lookupString.trim().split(/\s+/);
                          nameParts.pop(); // Remove the last part (assumed to be the last name)
                          firstName = nameParts[0] || '';
                          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                          break;
                        }
                        case 'email': {
                          email = reactData.name_validation_result.lookupString;
                          break;
                        }
                        case 'phone': {
                          phone = reactData.name_validation_result.lookupString;
                          break;
                        }
                        default: { break; }
                      }

                      setReactData(prev => ({
                        ...prev,
                        stage: 'select_account_type',
                        verification_stage: false,
                        candidates: [],
                        verification_input: '',
                        matched_account: null,
                        // Store parsed name parts for pre-filling
                        parsed_first_name: firstName,
                        parsed_last_name: lastName,
                        parsed_email: email,
                        parsed_phone: phone
                      }));
                    }}
                  >
                    I'm new here
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={resetToNamePrompt}
                  >
                    Start Over
                  </Button>
                </Box>
              </>
            )}

            {reactData.matched_account && (
              <Box style={{ marginTop: '16px', textAlign: 'center' }}>
                <Typography variant="body1" style={{ marginBottom: '16px', color: 'green' }}>
                  ✓ Account found for {reactData.matched_account.name.first} {reactData.matched_account.name.last}
                </Typography>
                <Typography variant="body2" style={{ marginBottom: '16px' }}>
                  This account already exists in our system. You cannot create a duplicate account.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={resetToNamePrompt}
                >
                  Start Over
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Verification Code Entry Stage */}
        {reactData.code_verification_stage && (
          <Box style={{ marginTop: '48px' }}>
            <Typography variant="h6" style={{ marginBottom: '16px' }}>
              Enter Verification Code
            </Typography>
            <Typography variant="body1" style={{ marginBottom: '16px' }}>
              We've sent a verification code to {reactData.code_send_method === 'email'
                ? reactData.code_sent_to
                : reactData.code_sent_to.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4')
              }. Please enter the code below to verify your account.
            </Typography>

            <TextField
              fullWidth
              label="Verification Code"
              value={reactData.verification_code_input}
              onChange={(event) => {
                const value = event?.target?.value || '';
                setReactData(prev => ({ ...prev, verification_code_input: value }));
              }}
              style={{ marginBottom: '16px' }}
              placeholder="Enter the 6-digit code..."
              inputProps={{ maxLength: 6 }}
              onKeyPress={(event) => {
                if (event?.key === 'Enter') {
                  handleVerificationCode(reactData.verification_code_input);
                }
              }}
            />

            <Box style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleVerificationCode(reactData.verification_code_input)}
                disabled={!reactData.verification_code_input.trim() || reactData.verification_code_input.length !== 6}
              >
                Verify Code
              </Button>
              <Button
                variant="outlined"
                onClick={resetToNamePrompt}
              >
                Start Over
              </Button>
            </Box>
          </Box>
        )}

        {/* Account Type Selection Stage */}
        {(reactData.stage === 'select_account_type' || reactData.stage === 'fill_fields') && (
          <>
            {/* Show account type selection only if none is selected */}
            {!reactData.selected_account_type && (
              Array.isArray(reactData.new_account_prompts) && reactData.new_account_prompts.length > 0 ? (
                <FormControl component="fieldset" style={{ marginTop: '16px' }}>
                  <FormLabel component="legend" style={{ marginBottom: '16px' }}>Choose the type of account to create:</FormLabel>
                  <RadioGroup
                    value={reactData.selected_account_type}
                    onChange={handleAccountTypeChange}
                    style={{ marginLeft: '16px', marginTop: '8px' }}
                  >
                    {reactData.new_account_prompts.map((prompt, index) => (
                      <FormControlLabel
                        key={index}
                        value={prompt.account_type}
                        control={<Radio />}
                        label={titleCase(prompt.account_description || prompt.account_type)}
                        style={{ marginBottom: '8px' }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              ) : (
                <Typography>No account types available</Typography>
              )
            )}

            {/* Show loading state when gathering fields */}
            {reactData.loading_fields && (
              <Box style={{ marginTop: '16px' }}>
                <Typography>Loading form fields...</Typography>
              </Box>
            )}

            {/* Show form input fields when available */}
            {reactData.selected_account_type && !reactData.loading_fields && Object.keys(reactData.form_fields).length > 0 && (
              <Box style={{ marginTop: '16px', paddingRight: '16px' }}>
                <Typography variant="h6" style={{ marginBottom: reactData.updating_existing_person_id ? '8px' : '16px' }}>
                  {reactData.updating_existing_person_id ? 'Update Information for' : 'Enter Information for'} {titleCase(reactData.selected_account_type)}:
                </Typography>
                {reactData.updating_existing_person_id && (
                  <Typography variant="subtitle2" style={{ marginBottom: '16px', color: '#1976d2' }}>
                    Account ID: <strong>{reactData.updating_existing_person_id}</strong>
                  </Typography>
                )}
                {Object.entries(reactData.form_fields).map(([fieldName, fieldData]) => {
                  if (!fieldData) {
                    return (
                      <Box key={fieldName} style={{ marginBottom: '8px', color: 'red', marginRight: '16px' }}>
                        <Typography variant="body2">
                          Field '{titleCase(fieldName.replace(/_/g, ' '))}' not found in database
                        </Typography>
                      </Box>
                    );
                  }

                  if (!shouldShowField(fieldData)) {
                    return null;
                  }

                  const fieldType = fieldData.value?.type || 'text';

                  // Hidden fields carry a fixed value but render nothing
                  if (fieldType === 'hidden') {
                    return null;
                  }

                  // If field type is header, just display the text
                  if (fieldType === 'header') {
                    const headerText = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                    return (
                      <Box key={fieldName} style={{ marginTop: '16px', marginBottom: '12px', marginRight: '16px' }}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                          {headerText}
                        </Typography>
                      </Box>
                    );
                  }

                  // Handle select field type with checkboxes
                  if (fieldType.startsWith('select')) {
                    const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                    const isRequired = reactData.selected_account_config?.required?.includes(fieldName) || false;
                    const selectOptions = fieldData.value?.selection?.selectionList || [];
                    const select_max = fieldData.value?.selection?.max || 999;
                    let select_min = fieldData.value?.selection?.min || 0;
                    if (isRequired && select_min === 0) {
                      select_min = 1; // If field is required but min is 0, set min to 1 to enforce at least one selection  
                    }
                    const currentValue = reactData.field_values[fieldName] || [];

                    return (
                      <Box key={fieldName} style={{ marginBottom: '16px', marginRight: '16px' }}>
                        <Box
                          style={{
                            position: 'relative',
                            borderRadius: '4px',
                            padding: '8px 14px'
                          }}
                        >
                          <fieldset
                            aria-hidden="true"
                            className={classes.selectFieldset}
                            style={{
                              textAlign: 'left',
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              top: '-5px',
                              left: 0,
                              margin: 0,
                              padding: '0 8px',
                              pointerEvents: 'none',
                              borderRadius: 'inherit',
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              overflow: 'hidden',
                              minWidth: '0%',
                            }}
                          >
                            <legend
                              style={{
                                float: 'unset',
                                width: 'auto',
                                overflow: 'hidden',
                                display: 'block',
                                padding: 0,
                                height: '16px',
                                paddingBottom: '20px',
                                fontSize: '1em',
                                visibility: 'visible',
                                maxWidth: '100%',
                                transition: 'max-width 100ms cubic-bezier(0.0, 0, 0.2, 1) 50ms',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span className={classes.selectLabel} style={{
                                paddingLeft: '5px',
                                paddingRight: '5px',
                                display: 'inline-block',
                                fontSize: '1em',
                                marginTop: '-16px',
                              }}>
                                {fieldLabel} {isRequired && '*'}
                              </span>
                            </legend>
                          </fieldset>
                          <Box className={classes.selectOptions} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
                            {selectOptions.map((option, index) => (
                              <FormControlLabel
                                key={`${fieldName}_${index}`}
                                control={
                                  <Checkbox
                                    checked={currentValue.includes(option)}
                                    onChange={() => handleSelectChange(fieldName, option, select_max)}
                                    size="small"
                                  />
                                }
                                label={<Typography variant="body2">{option}</Typography>}
                              />
                            ))}
                          </Box>
                          {fieldData.prompt?.help_text && (
                            <Typography variant="caption" className={classes.selectLabel} style={{ marginTop: '8px', marginLeft: '14px', marginRight: '14px', display: 'block' }}>
                              {fieldData.prompt.help_text}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }

                  const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                  const isRequired = reactData.selected_account_config?.required?.includes(fieldName) || false;

                  // Password field — double-prompt with confirmation
                  if (fieldType === '*password') {
                    const pw = reactData.field_values[fieldName] || '';
                    const confirm = reactData.password_confirm || '';
                    const mismatch = confirm.length > 0 && pw !== confirm;
                    return (
                      <Box key={fieldName} style={{ marginBottom: '16px', marginRight: '16px' }}>
                        <TextField
                          fullWidth
                          label={fieldLabel}
                          required={isRequired}
                          type='password'
                          autoComplete='new-password'
                          value={pw}
                          onChange={(e) => handleFieldValueChange(fieldName, e.target.value)}
                          variant='outlined'
                          size='small'
                          style={{ marginBottom: '8px' }}
                        />
                        <TextField
                          fullWidth
                          label='Confirm Password'
                          required={isRequired}
                          type='password'
                          autoComplete='new-password'
                          value={confirm}
                          error={mismatch}
                          helperText={mismatch ? 'Passwords do not match' : ''}
                          onChange={(e) => { const val = e.target.value; setReactData(prev => ({ ...prev, password_confirm: val })); }}
                          variant='outlined'
                          size='small'
                          style={{ marginBottom: '8px' }}
                        />
                      </Box>
                    );
                  }

                  const isDateField = fieldType === 'date';
                  const isEmailField = fieldType === 'email';
                  const isPhoneField = fieldType === 'phone';
                  const dateHelperText = isDateField ? 'Enter date (various formats accepted: 12/25/1990, Dec 25 1990, etc.)' : '';
                  const emailHelperText = isEmailField ? 'Enter a valid email address (e.g., user@example.com)' : '';
                  const phoneHelperText = isPhoneField ? 'Enter phone number (10 digits for US: 5551234567, minimum 10 digits for international)' : '';
                  const baseHelperText = fieldData.prompt?.help_text || dateHelperText || emailHelperText || phoneHelperText;

                  // Check for validation errors
                  const validationError = reactData.field_validation_errors?.[fieldName];
                  const finalHelperText = validationError || baseHelperText;
                  const hasError = Boolean(validationError);

                  return (
                    <Box key={fieldName} style={{ marginBottom: '16px', marginRight: '16px' }}>
                      <TextField
                        fullWidth
                        label={fieldLabel}
                        required={isRequired}
                        type={fieldType === 'email' ? 'email' :
                          fieldType === 'phone' ? 'tel' : 'text'}
                        value={reactData.field_values[fieldName] || ''}
                        onChange={(event) => {
                          if (fieldType === 'date') {
                            // For date fields, just update the value without formatting
                            handleFieldValueChange(fieldName, event.target.value);
                          } else if (fieldType === 'email') {
                            handleEmailFieldChange(fieldName, event.target.value);
                          } else if (fieldType === 'phone') {
                            handlePhoneFieldChange(fieldName, event.target.value);
                          } else {
                            handleFieldValueChange(fieldName, event.target.value);
                          }
                        }}
                        onBlur={(event) => {
                          // Format date only when user leaves the field
                          if (fieldType === 'date' && event.target.value) {
                            const dateResult = makeDate(event.target.value);
                            if (!dateResult.error) {
                              handleFieldValueChange(fieldName, dateResult.slashDate);
                            }
                          } else if (event.target.value && fieldData.value?.format) {
                            // Apply field formatting if specified
                            const formattedValue = applyFieldFormat(event.target.value, fieldData.value.format);
                            handleFieldValueChange(fieldName, formattedValue);
                          }
                        }}
                        variant="outlined"
                        size="small"
                        style={{ marginBottom: '8px' }}
                        helperText={finalHelperText}
                        error={hasError}
                        InputLabelProps={isDateField ? { shrink: true } : {}}
                        inputProps={isDateField ? {
                          placeholder: 'Enter date...'
                        } : isEmailField ? {
                          placeholder: 'Enter email address...'
                        } : isPhoneField ? {
                          placeholder: 'Enter phone number...'
                        } : {}}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}

        {/* Ask for More Family Members Stage */}
        {reactData.stage === 'ask_for_more' && (
          <Box style={{ textAlign: 'center', marginTop: '20px' }}>
            <Typography variant="h6" style={{ marginBottom: '16px', color: 'green' }}>
              ✓ {reactData.family_members.length === 1 ?
                `Done - ${getFamilyMemberName(reactData.family_members[0])}` :
                `Family Member ${reactData.current_member_index + 1} Done - ${getFamilyMemberName(reactData.family_members[reactData.current_member_index])}`}
            </Typography>
            {reactData.family_members.length > 1 && (
              <Typography variant="body1" style={{ marginBottom: '20px' }}>
                You have added {reactData.family_members.length} family member{reactData.family_members.length !== 1 ? 's' : ''} so far.
              </Typography>
            )}
            <Typography variant="h6" style={{ marginBottom: '20px' }}>
              Do you want to add another family member?
            </Typography>
            <Box style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={resetForNextMember}
                style={{ backgroundColor: 'green', color: 'white' }}
              >
                Yes, Add Another
              </Button>
              <Button
                variant="contained"
                onClick={goBackToEdit}
                style={{ backgroundColor: 'orange', color: 'black' }}
              >
                Go Back to Edit
              </Button>
              <Button
                variant="contained"
                onClick={completeProcess}
                style={{ backgroundColor: 'blue', color: 'white' }}
              >
                No, I'm Done
              </Button>
            </Box>
          </Box>
        )}

        {/* Complete Stage */}
        {reactData.stage === 'complete' && (
          <Box style={{ textAlign: 'center', marginTop: '20px' }}>
            {reactData.loading_user_ids ? (
              <Box>
                <Typography variant="h6" style={{ marginBottom: '16px', color: 'orange' }}>
                  Generating Unique User IDs...
                </Typography>
                <Typography variant="body1" style={{ marginBottom: '20px' }}>
                  Checking database for unique identifiers for {reactData.family_members.length} family members.
                </Typography>
              </Box>
            ) : (
              <Box>
                {reactData.family_members.length > 1 && (
                  <Typography variant="h6" style={{ marginBottom: '16px', color: 'green' }}>
                    ✓ All Family Members Ready ({reactData.family_members.length} total)
                  </Typography>
                )}
                {reactData.family_members.length > 1 && (
                  <Typography variant="body1" style={{ marginBottom: '20px' }}>
                    Total family members: {reactData.family_members.length}
                  </Typography>
                )}
                {/* Show family_id if generated for multiple members */}
                {reactData.family_id && (
                  <Typography variant="body2" style={{ marginBottom: '20px', color: 'blue', fontWeight: 'bold' }}>
                    Family ID: {reactData.family_id}
                  </Typography>
                )}
                <Box style={{ marginBottom: '20px' }}>
                  {reactData.family_members.map((member, index) => {
                    const memberName = getFamilyMemberName(member);
                    return (
                      <Box key={index} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                          {index + 1}. {titleCase(member.account_type)} - {memberName}
                        </Typography>
                        {member.proposed_user_id && (
                          <Typography variant="body2" style={{ color: 'blue', fontSize: '0.85em' }}>
                            User ID: {member.proposed_user_id}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
                <Typography variant="body1" style={{ marginBottom: '20px' }}>
                  {reactData.family_members.length === 1 ?
                    'Ready to save data to the system.' :
                    'Ready to save all family member data to the system.'}
                </Typography>
                {reactData.family_members[0]?.account_config?.family_role !== 'none' && (
                  <Box style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                    <Button
                      variant="contained"
                      onClick={goBackToAddMore}
                      style={{ backgroundColor: 'orange', color: 'black' }}
                    >
                      {reactData.family_members.length === 1 ? 'Add Family Members' : 'Add More Family Members'}
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>

      <DialogActions style={{
        justifyContent: 'center',
        flexShrink: 0,
        padding: '8px 24px 16px 24px',
        borderTop: '1px solid #e0e0e0'
      }}>
        {/* Buttons for Select Account Type and Fill Fields stages */}
        {(reactData.stage === 'select_account_type' || reactData.stage === 'fill_fields') && (
          <Box style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Exit button - only show when an account type is selected */}
            {/* In preauth flow, exit is game-over; otherwise return to account type selection */}
            {reactData.selected_account_type && (
              <Button
                className={AVAClass.AVAButton}
                style={{
                  marginTop: '16px',
                  backgroundColor: 'red',
                  color: 'white'
                }}
                size='small'
                onClick={reactData.require_pre_auth ? proceedWithExit : handleChangeAccountType}
              >
                Exit
              </Button>
            )}

            {/* Main action button (Exit or Save and Continue) */}
            <Button
              className={AVAClass.AVAButton}
              style={{
                marginTop: '16px',
                backgroundColor: reactData.loading_fields ? 'gray' :
                  (!reactData.selected_account_type || Object.keys(reactData.form_fields).length === 0) ? 'red' :
                    (reactData.selected_account_type && !reactData.loading_fields && Object.keys(reactData.form_fields).length > 0) ? 'green' : 'gray',
                color: 'white'
              }}
              size='small'
              disabled={reactData.loading_fields}
              onClick={async () => {
                // Check if this is an exit action (no account type selected or no form fields)
                const isExitAction = !reactData.selected_account_type || Object.keys(reactData.form_fields).length === 0;

                if (isExitAction) {
                  await proceedWithExit();
                  return;
                }

                if (reactData.selected_account_config && reactData.form_fields) {
                  // Validate required fields - only check fields that are actually presented on screen
                  // and currently visible (not hidden by show_if/ignore_if)
                  const presentedFields = reactData.selected_account_config?.field_list || [];
                  const requiredFields = (reactData.selected_account_config?.required || [])
                    .filter(fieldName =>
                      presentedFields.includes(fieldName) &&
                      shouldShowField(reactData.form_fields[fieldName])
                    );

                  const missingRequiredValues = requiredFields.filter(fieldName => {
                    return isEmpty(reactData.field_values[fieldName]);
                  });

                  if (missingRequiredValues.length > 0) {
                    // Convert field names to user-friendly prompts
                    const missingFieldPrompts = missingRequiredValues.map(fieldName => {
                      const fieldData = reactData.form_fields[fieldName];
                      return fieldData?.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                    });

                    showAlert({
                      severity: 'warning',
                      title: 'Required Fields Missing',
                      message: `Please fill in all required fields: ${missingFieldPrompts.join(', ')}`,
                      autoHide: false
                    });
                    return;
                  }

                  // Validate date fields
                  const invalidDateFields = [];
                  Object.entries(reactData.form_fields).forEach(([fieldName, fieldData]) => {
                    if (fieldData && fieldData.value?.type === 'date') {
                      const fieldValue = reactData.field_values[fieldName];
                      if (fieldValue && fieldValue.trim() !== '') {
                        // Use makeDate to validate the date
                        const dateResult = makeDate(fieldValue);

                        if (dateResult.error) {
                          const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                          invalidDateFields.push(fieldLabel);
                        }
                      }
                    }
                  });

                  if (invalidDateFields.length > 0) {
                    showAlert({
                      severity: 'warning',
                      title: 'Invalid Date Fields',
                      message: `Please enter valid dates for the following fields: ${invalidDateFields.join(', ')}. Try formats like: 12/25/1990, Dec 25 1990, or 25-Dec-1990.`,
                      autoHide: false
                    });
                    return;
                  }

                  // Validate email fields
                  const invalidEmailFields = [];
                  Object.entries(reactData.form_fields).forEach(([fieldName, fieldData]) => {
                    if (fieldData && fieldData.value?.type === 'email') {
                      const fieldValue = reactData.field_values[fieldName];
                      if (fieldValue && fieldValue.trim() !== '') {
                        // Use comprehensive email validation regex
                        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                        const isValidEmail = emailRegex.test(fieldValue.trim());

                        if (!isValidEmail) {
                          const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                          invalidEmailFields.push(fieldLabel);
                        }
                      }
                    }
                  });

                  if (invalidEmailFields.length > 0) {
                    showAlert({
                      severity: 'warning',
                      title: 'Invalid Email Fields',
                      message: `Please enter valid email addresses for the following fields: ${invalidEmailFields.join(', ')}. Example: user@example.com`,
                      autoHide: false
                    });
                    return;
                  }

                  // Validate phone fields
                  const invalidPhoneFields = [];
                  Object.entries(reactData.form_fields).forEach(([fieldName, fieldData]) => {
                    if (fieldData && fieldData.value?.type === 'phone') {
                      const fieldValue = reactData.field_values[fieldName];
                      if (fieldValue && fieldValue.trim() !== '') {
                        // Remove all non-digit characters for validation
                        const digitsOnly = fieldValue.replace(/\D/g, '');

                        // Validate phone number format - be more strict
                        const isValidPhone = (digitsOnly.length === 10) ||
                          (digitsOnly.length === 11 && digitsOnly.startsWith('1')) ||
                          (digitsOnly.length >= 10 && digitsOnly.length <= 15);

                        if (!isValidPhone) {
                          const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                          invalidPhoneFields.push(fieldLabel);
                        }
                      }
                    }
                  });

                  if (invalidPhoneFields.length > 0) {
                    showAlert({
                      severity: 'warning',
                      title: 'Invalid Phone Fields',
                      message: `Please enter valid phone numbers for the following fields: ${invalidPhoneFields.join(', ')}. Use 10 digits for US numbers or minimum 10 digits for international format.`,
                      autoHide: false
                    });
                    return;
                  }

                  // Save current family member and proceed to ask for more
                  await saveCurrentFamilyMember();
                }
              }}
            >
              {reactData.loading_fields
                ? 'Loading...'
                : (!reactData.selected_account_type || Object.keys(reactData.form_fields).length === 0)
                  ? 'Exit'
                  : 'Save and Continue'
              }
            </Button>
          </Box>
        )}

        {/* Buttons for Complete stage */}
        {reactData.stage === 'complete' && !reactData.loading_user_ids && (
          <Box style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Button
              className={AVAClass.AVAButton}
              style={{
                marginTop: '16px',
                backgroundColor: 'red',
                color: 'white'
              }}
              size='small'
              onClick={() => {
                updateReactData({ exit_confirm: true }, true);
              }}
            >
              Exit
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{
                marginTop: '16px',
                backgroundColor: 'orange',
                color: 'white'
              }}
              size='small'
              onClick={() => {
                setReactData(prev => ({
                  ...prev,
                  stage: 'ask_for_more',
                  current_member_index: prev.current_member_index - 1
                }));
              }}
            >
              Back
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{
                marginTop: '16px',
                backgroundColor: 'blue',
                color: 'white'
              }}
              size='small'
              onClick={async () => {
                try {
                  // Show loading state
                  showAlert({
                    severity: 'info',
                    title: 'Saving Data',
                    message: reactData.family_members.length === 1 ?
                      'Saving data to People and SessionsV2 tables...' :
                      'Saving all family member data to People, SessionsV2, and FamilyGroups tables...',
                    autoHide: false
                  });

                  // All members should already have proposed_user_id set by completeProcess()
                  // If any don't, generate them now
                  const membersWithUserIds = [];
                  for (const member of reactData.family_members) {
                    if (!member.proposed_user_id) {
                      try {
                        const userId = await generateUniqueUserId(member);
                        membersWithUserIds.push({
                          ...member,
                          proposed_user_id: userId
                        });
                      } catch (error) {
                        console.error('Failed to generate user ID for member:', member, error);
                        showAlert({
                          severity: 'error',
                          title: 'User ID Generation Failed',
                          message: `Failed to generate user ID for ${getFamilyMemberName(member)}: ${error.message}`
                        });
                        throw error;
                      }
                    } else {
                      membersWithUserIds.push(member);
                    }
                  }

                  // Save People and SessionsV2 records for each family member
                  const savedMembers = [];
                  const failedMembers = [];

                  for (const member of membersWithUserIds) {
                    try {
                      // Save People record first
                      await savePeopleRecord(member);

                      // Send on_complete_message notifications if configured
                      await sendOnCompleteMessages(member);

                      // Then save SessionsV2 record
                      await saveSessionsV2Record(member);

                      savedMembers.push(getFamilyMemberName(member));
                    } catch (error) {
                      console.error('Failed to save member:', member, error);
                      failedMembers.push(`${getFamilyMemberName(member)}: ${error.message}`);
                    }
                  }

                  // Save FamilyGroups records if:
                  // 1. Creating new family (family_id exists and multiple members), OR
                  // 2. Adding to existing family (existing_family_rec exists)
                  let familyGroupsSaved = false;
                  if ((reactData.family_id && reactData.family_members.length > 1) || reactData.existing_family_rec) {
                    try {
                      familyGroupsSaved = await saveFamilyGroupsRecord(
                        membersWithUserIds,
                        reactData.family_id,
                        reactData.existing_family_rec // Pass existing family record if adding to existing family
                      );
                      if (familyGroupsSaved) {
                        console.log('FamilyGroups records saved successfully');
                      }
                    } catch (error) {
                      console.error('Failed to save FamilyGroups records:', error);
                      // Don't add to failedMembers since this is a family-level operation
                    }
                  }

                  // Record pre-authorization use for both new-account and existing-account preauth paths
                  if (reactData.matched_preauth_rec && membersWithUserIds.length > 0) {
                    await recordPreAuthUse(reactData.matched_preauth_rec, membersWithUserIds[0].proposed_user_id);
                  }

                  // Final summary data for logging
                  const userIdSummary = membersWithUserIds.map(member => ({
                    name: getFamilyMemberName(member),
                    account_type: member.account_type,
                    proposed_user_id: member.proposed_user_id,
                    groups: member.account_config?.default_groups || []
                  }));

                  console.log('Save Results (People, SessionsV2 & FamilyGroups):', {
                    family_members: membersWithUserIds,
                    family_id: reactData.family_id || null,
                    family_groups_saved: familyGroupsSaved,
                    total_members: reactData.family_members.length,
                    saved_members: savedMembers,
                    failed_members: failedMembers,
                    user_id_summary: userIdSummary
                  });

                  // Show results
                  if (failedMembers.length > 0) {
                    showAlert({
                      severity: 'error',
                      title: 'Partial Save Failure',
                      message: `Saved ${savedMembers.length} members. Failed: ${failedMembers.join(', ')}`,
                      autoHide: false
                    });
                  } else {
                    let message = reactData.family_members.length === 1 ?
                      `Successfully saved data in AVA.` :
                      `Successfully saved ${savedMembers.length} family member(s) in AVA.`;
                    if (reactData.family_id) {
                      if (familyGroupsSaved) {
                        message += ` FamilyGroups table updated with Family ID: ${reactData.family_id}`;
                      } else {
                        message += ` Family ID: ${reactData.family_id}`;
                      }
                    }

                    // Add user IDs to success message
                    const userIds = membersWithUserIds
                      .filter(member => member.proposed_user_id)
                      .map(member => `${getFamilyMemberName(member)}: ${member.proposed_user_id}`)
                      .join(', ');
                    if (userIds) {
                      message += ` User IDs: ${userIds}`;
                    }

                    showAlert({
                      severity: 'success',
                      title: reactData.family_members.length === 1 ? 'Data Saved Successfully' : 'All Data Saved Successfully',
                      message: message
                    });

                    // Close dialog after successful save
                    if (onClose) {
                      // Pass the created person IDs to the onClose callback
                      const createdPersonIds = membersWithUserIds
                        .filter(member => member.proposed_user_id)
                        .map(member => member.proposed_user_id);
                      if (options.source === 'url_parameter') {
                        onClose(createdPersonIds, (reactData.on_save_callback || null));
                      } else {
                        onClose(createdPersonIds);
                      }
                    }
                  }

                } catch (error) {
                  console.error('Error in final save process:', error);
                  showAlert({
                    severity: 'error',
                    title: 'Save Failed',
                    message: reactData.family_members.length === 1 ?
                      `Failed to save data: ${error.message}` :
                      `Failed to save family member data: ${error.message}`,
                    autoHide: false
                  });
                }
              }}
            >
              {reactData.family_members.length === 1 ? 'Save Data' : 'Save All Family Data'}
            </Button>
          </Box>
        )}
      </DialogActions>

      {/* Exit Confirmation Dialog */}
      {reactData.exit_confirm &&
        <Dialog
          open={reactData.exit_confirm}
          onClose={() => updateReactData({ exit_confirm: false }, true)}
          aria-labelledby="exit-dialog-title"
        >
          <Box style={{ padding: '24px', minWidth: '300px' }}>
            <Typography id="exit-dialog-title" variant="h6" style={{ marginBottom: '16px', fontWeight: 'bold' }}>
              Exit?
            </Typography>
            <Typography variant="body2" style={{ marginBottom: '20px', color: '#666' }}>
              You have unsaved changes. Are you sure you want to exit without saving?
            </Typography>
            <Box style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => {
                  updateReactData({ exit_confirm: false }, true);
                  // Return to fill_fields stage for the last member being worked on
                  setReactData(prev => ({
                    ...prev,
                    stage: 'fill_fields',
                    // Remove the most recent entry from family_members since it will be re-added on save
                    family_members: prev.family_members.slice(0, -1)
                  }));
                }}
                style={{ backgroundColor: 'blue', color: 'white' }}
              >
                Keep Working
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  updateReactData({ exit_confirm: false }, true);
                  proceedWithExit();
                }}
                style={{ backgroundColor: 'red', color: 'white' }}
              >
                Exit
              </Button>
            </Box>
          </Box>
        </Dialog>
      }

      {/* Alert/Snackbar for error and success messages */}
      {reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={reactData.alert.autoHide !== false ? (
            (reactData.alert.severity === 'success') ? 5000 :
              (reactData.alert.severity === 'info') ? 15000 : null
          ) : null}
          onClose={() => hideAlert()}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            key={`alert_box`}
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
            action={(reactData.alert.action ?
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
                    className={AVAClass.AVAButton}
                    color="inherit"
                    onClick={() => this_action.function()}
                  >
                    {this_action.text}
                  </Button>
                ))}
              </Box>
              : null
            )}
            variant='filled'
            onClose={() => hideAlert()}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
            {reactData.alert.detail && (
              <div
                style={{ marginTop: 6 }}
                dangerouslySetInnerHTML={{ __html: reactData.alert.detail }}
              />
            )}
          </Alert>
        </Snackbar>
      }
    </Dialog>
  );
};