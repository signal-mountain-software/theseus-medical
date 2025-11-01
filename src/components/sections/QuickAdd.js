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

import { deepCopy, titleCase, getDb, putDb } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { Box, Button, TextField, Typography, Dialog, DialogContentText, DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, IconButton, Tooltip, Snackbar } from '@material-ui/core/';
import { Edit as EditIcon } from '@material-ui/icons';
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

  const [reactData, setReactData] = React.useState({
    initialized: false,
    errorList: {},
    new_account_prompts: {},
    selected_account_type: '',
    selected_account_config: null,
    form_fields: {},
    field_values: {},
    field_validation_errors: {}, // Store validation errors for real-time feedback
    loading_fields: false,
    loading_user_ids: false,
    alert: false,
    family_members: [], // Array to store completed family member data
    current_member_index: 0,
    stage: 'select_account_type', // 'select_account_type', 'fill_fields', 'ask_for_more', 'complete'
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

  React.useEffect(() => {
    function initialize() {
      let reactUpd = {};

      // Grab the new_account_form object from state.session and store as new_account_prompts
      if (state.session?.new_account_form) {
        reactUpd.new_account_prompts = deepCopy(state.session.new_account_form);
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

    setReactData(prev => ({
      ...prev,
      form_fields: fieldData,
      loading_fields: false
    }));

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

  const handleDateFieldChange = (fieldName, value) => {
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

    // Set a new timeout to validate and format the date after 500ms of no typing
    dateValidationTimeouts.current[fieldName] = setTimeout(() => {
      if (value && value.trim() !== '') {
        const dateResult = makeDate(value);
        const displayValue = dateResult.error ? value : dateResult.slashDate;

        setReactData(prev => ({
          ...prev,
          field_values: {
            ...prev.field_values,
            [fieldName]: displayValue
          }
        }));
      }
    }, 500);
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

  const saveCurrentFamilyMember = () => {
    const familyMember = {
      index: reactData.current_member_index,
      account_type: reactData.selected_account_type,
      account_config: reactData.selected_account_config,
      form_fields: reactData.form_fields,
      field_values: reactData.field_values,
      timestamp: new Date().toISOString()
    };

    setReactData(prev => ({
      ...prev,
      family_members: [...prev.family_members, familyMember],
      stage: 'ask_for_more'
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
      stage: 'select_account_type'
    }));
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
        user_id: member.proposed_user_id
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

      // Build search data
      const search_words = [
        titleCase(firstName),
        titleCase(lastName),
        firstName.toLowerCase(),
        lastName.toLowerCase()
      ];

      // Extract contact info for preferred methods
      const email = fieldValues.email || fieldValues.email_address || fieldValues['email address'] || '';
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

      if (cellForStorage) {
        preferred_methods = ['sms'];
        preferred_method = 'sms';
        // Use last 10 digits for search (removing country code)
        const searchDigits = cellForStorage.replace(/\D/g, '').slice(-10);
        search_words.push(searchDigits);
      } else if (email) {
        preferred_methods = ['email'];
        preferred_method = 'email';
      }

      // Build contact_info object
      const contact_info = {};
      if (email) {
        contact_info.email = { address: email };
      }
      if (cellForStorage) {
        contact_info.cell = { number: cellForStorage };
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
        search_data: search_words.join(' '),
        preferred_methods: preferred_methods,
        preferred_method: preferred_method,
        contact_info: contact_info,
        account_type: member.account_type
      };

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

      console.log('Saving People record:', peopleRecord);

      // Save to People table
      await putDb({
        TableName: 'People',
        Item: peopleRecord
      });

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
   * @param {Array} familyMembers - Array of family member objects with proposed_user_id and field_values
   * @param {string} familyId - Generated family ID (e.g., "family_1704067200000")
   * @returns {Promise<boolean>} - Success status
   */
  const saveFamilyGroupsRecord = async (familyMembers, familyId) => {
    try {
      if (!familyId || !Array.isArray(familyMembers) || familyMembers.length === 0) {
        return false; // No family to create
      }

      // Determine primary contact (first family member)
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
      const familyRecord = {
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
   * References:
   * - FamilyMaintenance.js line 205: const newFamilyID = `family_${new Date().getTime()}`;
   * - LinkedAccounts.js line 343: family_id: `family_${timestamp}`
   */
  const completeProcess = async () => {
    console.log('completeProcess called - current stage:', reactData.stage);
    console.log('Current family_members count:', reactData.family_members.length);

    try {
      setReactData(prev => {
        console.log('Setting loading_user_ids to true, current stage:', prev.stage);
        return {
          ...prev,
          loading_user_ids: true
        };
      });

      // Generate unique user IDs for all family members
      const familyMembersWithUserIds = [];
      for (const member of reactData.family_members) {
        try {
          const userId = await generateUniqueUserId(member);
          familyMembersWithUserIds.push({
            ...member,
            proposed_user_id: userId
          });
          console.log('Generated user ID for member:', getFamilyMemberName(member), 'ID:', userId);
        } catch (error) {
          console.error('Error generating user ID for member:', member, error);
          showAlert('error', `Failed to generate user ID for ${getFamilyMemberName(member)}: ${error.message}`);

          // Reset loading state and return to prevent getting stuck
          setReactData(prev => ({
            ...prev,
            loading_user_ids: false
          }));
          return;
        }
      }

      console.log('About to set stage to complete with', familyMembersWithUserIds.length, 'members');

      setReactData(prev => {
        console.log('Setting stage to complete, prev stage:', prev.stage);
        let updatedData = {
          ...prev,
          family_members: familyMembersWithUserIds,
          loading_user_ids: false,
          stage: 'complete'
        };

        // Generate family_id if multiple family members (following FamilyMaintenance.js pattern)
        if (prev.family_members.length > 1) {
          const family_id = `family_${new Date().getTime()}`;
          updatedData.family_id = family_id;
        }

        console.log('Returning updated data with stage:', updatedData.stage);
        return updatedData;
      });

      // Show alerts after state update to avoid interference
      if (reactData.family_members.length > 1) {
        const family_id = `family_${new Date().getTime()}`;
        showAlert('success', `Family ID generated for ${reactData.family_members.length} family members: ${family_id}`);
      }

      // Show success message with user IDs
      const userIdList = familyMembersWithUserIds.map(member =>
        `${getFamilyMemberName(member)}: ${member.proposed_user_id}`
      ).join(', ');

      showAlert('success', `User IDs generated: ${userIdList}`);
    } catch (error) {
      console.error('Error in completeProcess:', error);
      showAlert('error', `Failed to complete process: ${error.message}`);
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

  return (
    <Dialog open={true || reactData.initialized || refreshTrigger}
      aria-labelledby="scroll-dialog-title"
      p={2}
      classes={{ paper: classes.clientPopUp }}
      fullWidth
      maxWidth="md"
      variant={'elevation'}
      elevation={2}
      onClose={() => {
        if (onClose) { onClose(); }
        else { return; }
      }}
    >
      <DialogContentText
        id='scroll-dialog-title'
        style={{
          ...AVATextStyle({
            size: 1.4,
            bold: true,
            margin: { left: 0.5, top: 1 }
          }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>
          {reactData.stage === 'ask_for_more' ?
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
        {reactData.selected_account_type && (reactData.stage === 'select_account_type' || reactData.stage === 'fill_fields') && (
          <Tooltip title="Change Account Type" placement="left">
            <IconButton
              size="small"
              onClick={handleChangeAccountType}
              style={{
                color: '#666',
                backgroundColor: 'transparent',
                marginLeft: '8px'
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </DialogContentText>

      <Box style={{ padding: '16px' }}>
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
              <Box style={{ marginTop: '16px', maxHeight: '400px', overflow: 'auto', paddingRight: '16px' }}>
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
                            handleDateFieldChange(fieldName, event.target.value);
                          } else if (fieldType === 'email') {
                            handleEmailFieldChange(fieldName, event.target.value);
                          } else if (fieldType === 'phone') {
                            handlePhoneFieldChange(fieldName, event.target.value);
                          } else {
                            handleFieldValueChange(fieldName, event.target.value);
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
                variant="outlined"
                onClick={goBackToEdit}
                style={{ borderColor: 'orange', color: 'orange' }}
              >
                Go Back to Edit
              </Button>
              <Button
                variant="outlined"
                onClick={completeProcess}
                style={{ borderColor: 'blue', color: 'blue' }}
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
                <Box style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                  <Button
                    variant="outlined"
                    onClick={goBackToAddMore}
                    style={{ borderColor: 'orange', color: 'orange' }}
                  >
                    {reactData.family_members.length === 1 ? 'Add Family Members' : 'Add More Family Members'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <DialogActions style={{ justifyContent: 'center' }}>
        {/* Buttons for Select Account Type and Fill Fields stages */}
        {(reactData.stage === 'select_account_type' || reactData.stage === 'fill_fields') && (
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
                // Exit the dialog completely
                if (onClose) {
                  onClose();
                }
                return;
              }

              if (reactData.selected_account_config && reactData.form_fields) {
                // Validate required fields - only check fields that are actually presented on screen
                const presentedFields = reactData.selected_account_config?.field_list || [];
                const requiredFields = (reactData.selected_account_config?.required || [])
                  .filter(fieldName => presentedFields.includes(fieldName));

                const missingRequiredValues = requiredFields.filter(fieldName =>
                  !reactData.field_values[fieldName] || reactData.field_values[fieldName].trim() === ''
                );

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
                saveCurrentFamilyMember();
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
        )}

        {/* Button for Complete stage */}
        {reactData.stage === 'complete' && !reactData.loading_user_ids && (
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

                // Save People and SessionsV2 records for each family member
                const savedMembers = [];
                const failedMembers = [];

                for (const member of reactData.family_members) {
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

                // Save FamilyGroups records if family_id exists (multiple members)
                let familyGroupsSaved = false;
                if (reactData.family_id && reactData.family_members.length > 1) {
                  try {
                    familyGroupsSaved = await saveFamilyGroupsRecord(reactData.family_members, reactData.family_id);
                    if (familyGroupsSaved) {
                      console.log('FamilyGroups records saved successfully');
                    }
                  } catch (error) {
                    console.error('Failed to save FamilyGroups records:', error);
                    // Don't add to failedMembers since this is a family-level operation
                  }
                }

                // Final summary data for logging
                const userIdSummary = reactData.family_members.map(member => ({
                  name: getFamilyMemberName(member),
                  account_type: member.account_type,
                  proposed_user_id: member.proposed_user_id,
                  groups: member.account_config?.default_groups || []
                }));

                console.log('Save Results (People, SessionsV2 & FamilyGroups):', {
                  family_members: reactData.family_members,
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
                  const userIds = reactData.family_members
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
                  setTimeout(() => {
                    if (onClose) onClose();
                  }, 3000);
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
        )}
      </DialogActions>

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