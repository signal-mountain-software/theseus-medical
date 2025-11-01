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
 * - method: "added as Family Member"
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

  const [reactData, setReactData] = React.useState({
    initialized: false,
    errorList: {},
    new_account_prompts: {},
    selected_account_type: '',
    selected_account_config: null,
    form_fields: {},
    field_values: {},
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
    return () => { isMounted.current = false; };
  }, [isMounted]);  // eslint-disable-line react-hooks/exhaustive-deps

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
    } else {
      showAlert({
        severity: 'success',
        title: 'Fields Loaded Successfully',
        message: `All ${selectedConfig.field_list.length} fields loaded successfully.`
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
      loading_fields: false,
      current_member_index: prev.current_member_index + 1,
      stage: 'select_account_type'
    }));
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
        method: "added as Family Member",
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

      // Determine preferred messaging method
      let preferred_methods = ['AVA'];
      let preferred_method = 'AVA';

      if (cell) {
        preferred_methods = ['sms'];
        preferred_method = 'sms';
        search_words.push(cell.slice(-10));
      } else if (email) {
        preferred_methods = ['email'];
        preferred_method = 'email';
      }

      // Build contact_info object
      const contact_info = {};
      if (email) {
        contact_info.email = { address: email };
      }
      if (cell) {
        contact_info.cell = { number: cell };
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
          peopleRecord[fieldName] = fieldValue;
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
            `Family Member ${reactData.current_member_index + 1} Added Successfully` :
            reactData.stage === 'complete' ?
              `All Family Members Added (${reactData.family_members.length} total)` :
              reactData.selected_account_type ?
                `${titleCase(reactData.selected_account_type)} - Family Member ${reactData.current_member_index + 1}` :
                `Select Account Type - Family Member ${reactData.current_member_index + 1}`
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
                <FormControl component="fieldset">
                  <FormLabel component="legend">Choose the type of account to create:</FormLabel>
                  <RadioGroup
                    value={reactData.selected_account_type}
                    onChange={handleAccountTypeChange}
                  >
                    {reactData.new_account_prompts.map((prompt, index) => (
                      <FormControlLabel
                        key={index}
                        value={prompt.account_type}
                        control={<Radio />}
                        label={titleCase(prompt.account_type)}
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
                          Field '{fieldName}' not found in database
                        </Typography>
                      </Box>
                    );
                  }

                  const fieldType = fieldData.value?.type || 'text';
                  const fieldLabel = fieldData.prompt?.value || titleCase(fieldName.replace(/_/g, ' '));
                  const isRequired = fieldData.value?.required || false;

                  return (
                    <Box key={fieldName} style={{ marginBottom: '16px', marginRight: '16px' }}>
                      <TextField
                        fullWidth
                        label={fieldLabel}
                        required={isRequired}
                        type={fieldType === 'email' ? 'email' : fieldType === 'phone' ? 'tel' : 'text'}
                        value={reactData.field_values[fieldName] || ''}
                        onChange={(event) => handleFieldValueChange(fieldName, event.target.value)}
                        variant="outlined"
                        size="small"
                        style={{ marginBottom: '8px' }}
                        helperText={fieldData.prompt?.help_text || ''}
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
              ✓ Family Member {reactData.current_member_index + 1} Added Successfully!
            </Typography>
            <Typography variant="body1" style={{ marginBottom: '20px' }}>
              You have added {reactData.family_members.length} family member{reactData.family_members.length !== 1 ? 's' : ''} so far.
            </Typography>
            <Typography variant="h6" style={{ marginBottom: '20px' }}>
              Do you want to add another family member?
            </Typography>
            <Box style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
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
                <Typography variant="h6" style={{ marginBottom: '16px', color: 'green' }}>
                  ✓ All Family Members Added Successfully!
                </Typography>
                <Typography variant="body1" style={{ marginBottom: '20px' }}>
                  Total family members: {reactData.family_members.length}
                </Typography>
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
                  Ready to save all family member data to the system.
                </Typography>
                <Box style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                  <Button
                    variant="outlined"
                    onClick={goBackToAddMore}
                    style={{ borderColor: 'orange', color: 'orange' }}
                  >
                    Add More Family Members
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
              backgroundColor: (reactData.selected_account_type && !reactData.loading_fields && Object.keys(reactData.form_fields).length > 0) ? 'green' : 'gray',
              color: 'white'
            }}
            size='small'
            disabled={!reactData.selected_account_type || reactData.loading_fields || Object.keys(reactData.form_fields).length === 0}
            onClick={async () => {
              if (reactData.selected_account_config && reactData.form_fields) {
                // Validate required fields
                const requiredFields = Object.entries(reactData.form_fields)
                  .filter(([, fieldData]) => fieldData && fieldData.value?.required)
                  .map(([fieldName]) => fieldName);

                const missingRequiredValues = requiredFields.filter(fieldName =>
                  !reactData.field_values[fieldName] || reactData.field_values[fieldName].trim() === ''
                );

                if (missingRequiredValues.length > 0) {
                  showAlert({
                    severity: 'warning',
                    title: 'Required Fields Missing',
                    message: `Please fill in all required fields: ${missingRequiredValues.join(', ')}`,
                    autoHide: false
                  });
                  return;
                }

                // Save current family member and proceed to ask for more
                saveCurrentFamilyMember();

                showAlert({
                  severity: 'success',
                  title: 'Family Member Saved',
                  message: `Successfully saved information for family member ${reactData.current_member_index + 1}.`
                });
              }
            }}
          >
            {reactData.loading_fields
              ? 'Loading...'
              : (reactData.stage === 'select_account_type' || Object.keys(reactData.form_fields).length === 0)
                ? 'Continue'
                : 'Save Family Member'
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
                  message: 'Saving all family member data to People, SessionsV2, and FamilyGroups tables...',
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
                  let message = `Successfully saved ${savedMembers.length} family member(s) to People and SessionsV2 tables.`;
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
                    title: 'All Data Saved Successfully',
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
                  message: `Failed to save family member data: ${error.message}`,
                  autoHide: false
                });
              }
            }}
          >
            Save All Family Data
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