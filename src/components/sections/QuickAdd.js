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
  }
}));

export default ({ onClose, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isMounted = React.useRef(false);
  const dateValidationTimeouts = React.useRef({});

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [reactData, setReactData] = React.useState({
    initialized: false,
    errorList: {},
    new_account_prompts: {},
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    selected_account_type: '',
    selected_account_config: null,
    form_fields: {},
    field_values: {},
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
    existing_family_rec: null // Store existing FamilyGroups record if adding to existing family
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
    function initialize() {
      let reactUpd = {};

      // Grab the new_account_form object from state.session and store as new_account_prompts
      if (state.session?.new_account_form) {
        reactUpd.new_account_prompts = deepCopy(state.session.new_account_form).filter(entry => {
          // If restrict_to_admin is true, only include if user is administrative account
          if (entry.restrict_to_admin && (!reactData.administrative_account || options.source === 'url_parameter')) {
            return false;
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
          client_id: state.session.client_id,
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
      try {
        const formFieldRec = await getDb({
          Key: {
            client_id: state.session.client_id,
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

  const showAlert = ({ severity = 'info', title, message, action = null, autoHide = true }) => {
    setReactData(prev => ({
      ...prev,
      alert: {
        severity,
        title,
        message,
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
    const familyMember = {
      index: reactData.current_member_index,
      account_type: reactData.selected_account_type,
      account_config: reactData.selected_account_config,
      form_fields: reactData.form_fields,
      field_values: reactData.field_values,
      timestamp: new Date().toISOString()
    };

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

    // If family_role is 'none', go directly to complete stage (skip asking for more members)
    const nextStage = reactData.selected_account_config?.family_role === 'none' ? 'complete' : 'ask_for_more';

    // if selected account config includes "on_save" key, store this.  We'll use it on exit.
    if (reactData.selected_account_config?.on_save) {
      setReactData(prev => ({
        ...prev,
        on_save_callback: reactData.selected_account_config.on_save
      }));
    }

    setReactData(prev => ({
      ...prev,
      family_members: [...prev.family_members, familyMember],
      stage: nextStage
    }));
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
    // Otherwise treat as name
    else {
      const wordList = trimmedInput.split(/\s+/);
      if (wordList.length === 1) {
        return { result: 'warning', error_field: 0, reason: 'Please enter both first and last names' };
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

    const validation = await validateUser(enteredName, state.session.client_id);

    setReactData(prev => ({
      ...prev,
      entered_name: enteredName,
      name_validation_result: validation
    }));

    switch (validation.result) {
      case 'match':
        // Single match found - show verification stage
        setReactData(prev => ({
          ...prev,
          candidates: [validation.personRec],
          verification_stage: true,
          verification_message: `${validation.lookupType !== 'email' ? 'e-Mail Address' : ''}${validation.lookupType === 'name' ? ' or ' : ''}${validation.lookupType !== 'phone' ? 'Cell Phone Number' : ''}`,
          select_user: false
        }));
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
        // No matches found - can proceed with new account creation
        // Parse the entered name for pre-filling form fields
        showAlert({
          severity: 'info',
          title: 'No Match Found',
          message: 'We didn\'t find a match.  What would you like to do?',
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
                const nameParts = enteredName.trim().split(/\s+/);
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
            author: state.session.user_id,
            person_id: matchedAccount.person_id,
            preferred_method: sendMethod,
            messageText: `To verify your account, use this code: ${tempPass}`,
            recipientList: [matchedAccount.person_id],
            subject: `Verification code from ${state.session.client_name}`
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
      current_member_index: 0
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
    sessionStorage.removeItem('AVASessionData');
    const baseUrl = window.location.href.split('?')[0];
    let loginUrl = `${baseUrl}?user=${reactData.matched_account.person_id}`;

    if (reactData.on_save_callback && (options.source === 'url_parameter')) { loginUrl += `&${reactData.on_save_callback}=true`; }

    // Small delay to show the success message before redirecting
    setTimeout(() => {
      window.location.replace(loginUrl);
    }, 1000);
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
        client_id: state.session.client_id,
        last_login: "password",
        method: "QuickAdd",
        patient_display_name: memberName,
        patient_id: member.proposed_user_id,
        person_id: member.proposed_user_id,
        requirePassword: false,
        storePassword: true,
        subscription_status: "na",
        user_display_name: memberName,
        user_homeClient: state.session.client_id,
        user_id: member.proposed_user_id,
        last_update: new Date().toISOString()
      };

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
      const groups = ["__TOP__", "ALL"].concat(defaultGroups);

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

      let client_preference = state.session?.client_style?.preferred_communication || 'email';

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
        client_id: state.session.client_id,
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
      Object.entries(reactData.form_fields).forEach(([fieldName, formRec]) => {
        if (fieldValues[fieldName]) {
          let saveAs = formRec.saveAs || formRec.value?.saveAs || formRec.prompt?.saveAs || false;
          if (saveAs) {
            const keys = saveAs.split('.');
            if (keys[0].startsWith('person') || keys[0].startsWith('people')) { keys.shift(); } // remove leading 'person' if present
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
        if (fieldValue && !['first_name', 'firstName', 'fname', 'first name',
          'last_name', 'lastName', 'lname', 'surname', 'last name',
          'email', 'email_address', 'email address',
          'phone', 'phone_number', 'phone number',
          'cell', 'cell_phone', 'cell phone'].includes(fieldName)) {

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

      peopleRecord.created_on = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"
      peopleRecord.last_update = new Date().toISOString();  // Expected output: "2011-10-05T14:48:00.000Z"

      console.log('Saving People record:', peopleRecord);

      // Save to People table
      await putDb({
        TableName: 'People',
        Item: peopleRecord
      });

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
          client_id: state.session.client_id,
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
    const clientId = state.session.client_id;

    let counter = '';
    let proposedId = '';
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    // Check for uniqueness
    while (attempts < maxAttempts) {
      proposedId = `${firstInitial}${cleanLastName}${counter}-${clientId}`.toLowerCase();

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

      showAlert({
        severity: 'success',
        title: 'User IDs Generated',
        message: `User IDs generated: ${userIdList}`
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
      if (reactData.stage !== 'prompt_for_name') {
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
        window.location.replace(`${jumpTo}?client=${state.session.client_id}`);
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
        }
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
            (state.session?.client_name || "Let's Get Started") :
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
        {/* Show client logo on the right side when in prompt_for_name stage */}
        {reactData.stage === 'prompt_for_name' && state.session?.client_logo && (
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
              First, let's check to see if you already have an account. Please enter your name, e-Mail address, or phone number.  If we find a match, we'll ask you to verify your account.  If not, we'll help you create a new one.
            </Typography>
            <TextField
              fullWidth
              label="Name (first and last), e-Mail, or Phone Number"
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
                        label={titleCase(prompt.account_type)}
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
                <Typography variant="h6" style={{ marginBottom: '16px' }}>
                  Enter Information for {titleCase(reactData.selected_account_type)}:
                </Typography>
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

                  const fieldType = fieldData.value?.type || 'text';

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
                              borderColor: 'rgba(0, 0, 0, 0.23)'
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
                              <span style={{
                                paddingLeft: '5px',
                                paddingRight: '5px',
                                display: 'inline-block',
                                fontSize: '1em',
                                marginTop: '-16px',
                                color: 'rgba(0, 0, 0, 0.5)'
                              }}>
                                {fieldLabel} {isRequired && '*'}
                              </span>
                            </legend>
                          </fieldset>
                          <Box style={{ display: 'flex', color: 'rgba(0, 0, 0, 0.5)', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
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
                            <Typography variant="caption" style={{ marginTop: '8px', marginLeft: '14px', marginRight: '14px', display: 'block', color: '#666' }}>
                              {fieldData.prompt.help_text}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }

                  const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                  const isRequired = reactData.selected_account_config?.required?.includes(fieldName) || false;
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
            {/* Tap will return you to Account Type Selection */}
            {reactData.selected_account_type && (
              <Button
                className={AVAClass.AVAButton}
                style={{
                  marginTop: '16px',
                  backgroundColor: 'red',
                  color: 'white'
                }}
                size='small'
                onClick={handleChangeAccountType}
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
                  const presentedFields = reactData.selected_account_config?.field_list || [];
                  const requiredFields = (reactData.selected_account_config?.required || [])
                    .filter(fieldName => presentedFields.includes(fieldName));

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
          </Alert>
        </Snackbar>
      }
    </Dialog>
  );
};