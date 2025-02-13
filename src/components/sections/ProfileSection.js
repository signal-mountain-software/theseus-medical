import React from 'react';
import { Box, Typography } from '@material-ui/core/';
import { formatPhone } from '../../util/AVAPeople';
import { isEmpty } from '../../util/AVAUtilities';

import { AVATextStyle } from '../../util/AVAStyles';
import TextField from '@material-ui/core/TextField';

export default ({ currentValues, ogValues, errorList, setError, updateField }) => {

  const makeLocation = () => {
    if (currentValues.peopleRec.hasOwnProperty('address')) {
      return Object.values(currentValues.peopleRec.address).join(' ');
    }
    else {
      return '';
    }
  }

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'>
        <TextField
          id='FirstName'
          autoComplete='off'
          onBlur={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'name.first',
                  newData: event.target.value
                },
                {
                  tableName: 'sessionRec',
                  fieldName: 'user_display_name',
                  newData: (`${event.target.value} ${currentValues.peopleRec?.name?.last}`).trim()
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'display_name',
                  newData: (`${event.target.value} ${currentValues.peopleRec?.name?.last}`).trim()
                }]
            });
          }}
          defaultValue={currentValues.peopleRec.name ? currentValues.peopleRec?.name?.first : ''}
          helperText='First'
        />
        <TextField
          id='LastName'
          style={{ marginLeft: 20 }}
          autoComplete='off'
          error={errorList.hasOwnProperty('last_name')}
          helperText={errorList.hasOwnProperty('last_name') ? errorList.last_name.errorMessage : 'Last'}
          onBlur={async (event) => {
            if (isEmpty(event.target.value) && isEmpty(currentValues.peopleRec.name?.first)) {
              // No name at all.  This is an error.
              setError({
                errorField: 'last_name',
                errorValue: '',
                isError: true,
                errorMessage: `Please enter a name`
              });
              return;
            }
            // all good
            // do we need to set a user ID?
            if (ogValues.peopleRec.person_id) {}
            // update the data
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'name.last',
                  newData: event.target.value
                },
                {
                  tableName: 'sessionRec',
                  fieldName: 'user_display_name',
                  newData: (`${currentValues.peopleRec?.name.first} ${event.target.value}`).trim()
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'display_name',
                  newData: (`${currentValues.peopleRec?.name.first} ${event.target.value}`).trim()
                }]
            };
            if (errorList.hasOwnProperty('last_name')) {
              updateObj.errorObj = {
                errorField: 'last_name',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={currentValues.peopleRec.name ? currentValues.peopleRec.name?.last : ''}
        />
      </Box>
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'
        flexWrap={'wrap'}
      >
        <TextField
          style={{ marginRight: 20 }}
          id='Phone_cell'
          key={`profileSection__phone_cell__${currentValues?.peopleRec?.messaging?.sms}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('cell_phone')}
          helperText={errorList.hasOwnProperty('cell_phone') ? errorList.cell_phone.errorMessage : 'Cell Phone'}
          onBlur={async (event) => {
            let number_part = event.target.value.replace(/\D/g, '');
            let storage_format;
            if (number_part.length > 0) {
              if (number_part.length <= 6) {
                // Invalid phone number.  This is an error.
                setError({
                  errorField: 'cell_phone',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid phone number.`
                });
                return;
              }
              else {
                storage_format = `+1${number_part}`;
              }
            }
            else {
              storage_format = ``;
            }
            // all good
            // update the data
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'messaging.sms',
                  newData: storage_format
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.cell.number',
                  newData: storage_format
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('cell_phone')) {
              updateObj.errorObj = {
                errorField: 'cell_phone',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('cell_phone')) && (errorList.cell_phone.errorValue))
            ? errorList.cell_phone.errorValue
            : (formatPhone(currentValues.peopleRec?.contact_info?.cell?.number
              ? currentValues.peopleRec.contact_info.cell.number
              : (currentValues.peopleRec?.messaging?.sms
                ? currentValues.peopleRec?.messaging?.sms
                : ''
              ))
            )
          }
        />
        <TextField
          style={{ marginRight: 20 }}
          id='Phone_landline'
          key={`profileSection__phone_landline__${currentValues?.peopleRec?.messaging?.voice}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('landline_phone')}
          helperText={errorList.hasOwnProperty('landline_phone') ? errorList.landline_phone.errorMessage : 'Landline Phone'}
          onBlur={async (event) => {
            let number_part = event.target.value.replace(/\D/g, '');
            let storage_format;
            if (number_part.length > 0) {
              if (number_part.length <= 6) {
                // Invalid phone number.  This is an error.
                setError({
                  errorField: 'landline_phone',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid phone number.`
                });
                return;
              }
              else {
                storage_format = `+1${number_part}`;
              }
            }
            else {
              storage_format = ``;
            }
            // all good
            // update the data
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'messaging.voice',
                  newData: storage_format
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.landline.number',
                  newData: storage_format
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('landline_phone')) {
              updateObj.errorObj = {
                errorField: 'landline_phone',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('landline_phone')) && (errorList.landline_phone.errorValue))
            ? errorList.landline_phone.errorValue
            : (formatPhone(currentValues?.peopleRec?.contact_info?.landline?.number
              ? currentValues?.peopleRec?.contact_info?.landline.number
              : (currentValues?.peopleRec?.messaging?.voice
                ? currentValues.peopleRec.messaging?.voice
                : ''
              ))
            )
          }
        />
        <TextField
          style={{ marginRight: 20 }}
          id='Phone_work'
          key={`profileSection__phone_work__${currentValues?.peopleRec?.messaging?.office}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('work_phone')}
          helperText={errorList.hasOwnProperty('work_phone') ? errorList.work_phone.errorMessage : 'Work Phone'}
          onBlur={async (event) => {
            let number_part = event.target.value.replace(/\D/g, '');
            let storage_format;
            if (number_part.length > 0) {
              if (number_part.length <= 6) {
                // Invalid phone number.  This is an error.
                setError({
                  errorField: 'work_phone',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid phone number.`
                });
                return;
              }
              else {
                storage_format = `+1${number_part}`;
              }
            }
            else {
              storage_format = ``;
            }
            // all good
            // update the data
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'messaging.office',
                  newData: storage_format
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.work.number',
                  newData: storage_format
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('work_phone')) {
              updateObj.errorObj = {
                errorField: 'work_phone',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('work_phone')) && (errorList.work_phone.errorValue))
            ? errorList.work_phone.errorValue
            : (formatPhone(currentValues.peopleRec.contact_info?.work?.number
              ? currentValues.peopleRec.contact_info?.work.number
              : (currentValues.peopleRec.messaging?.office
                ? currentValues.peopleRec.messaging?.office
                : ''
              ))
            )
          }
        />
        <TextField
          id='Phone_alternate'
          key={`profileSection__phone_alternate__${currentValues.peopleRec.contact_info?.alternate?.number || 0}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('alternate_phone')}
          helperText={errorList.hasOwnProperty('alternate_phone') ? errorList.alternate_phone.errorMessage : 'Alternate Phone'}
          onBlur={async (event) => {
            let number_part = event.target.value.replace(/\D/g, '');
            let storage_format;
            if (number_part.length > 0) {
              if (number_part.length <= 6) {
                // Invalid phone number.  This is an error.
                setError({
                  errorField: 'alternate_phone',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid phone number.`
                });
                return;
              }
              else {
                storage_format = `+1${number_part}`;
              }
            }
            else {
              storage_format = ``;
            }
            // all good
            // update the data
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.alternate.number',
                  newData: storage_format
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('alternate_phone')) {
              updateObj.errorObj = {
                errorField: 'alternate_phone',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('alternate_phone')) && (errorList.alternate_phone.errorValue))
            ? errorList.alternate_phone.errorValue
            : (formatPhone(currentValues.peopleRec.contact_info?.alternate?.number
              ? currentValues.peopleRec.contact_info?.alternate.number
              : (currentValues.peopleRec.messaging?.alternate
                ? currentValues.peopleRec.messaging?.alternate
                : ''
              ))
            )
          }
        />
      </Box>
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'>
        <TextField style={{ width: '400px' }}
          id='email'
          key={`profileSection__email__${currentValues.peopleRec.messaging?.email}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('email')}
          onBlur={async (event) => {
            if (event.target.value !== '') {
              let [, domain] = event.target.value.split('@');
              let valid = false;
              if (domain) {
                valid = ((domain.split('.')).length > 1);
              }
              if (!valid) {
                // Invalid eMail.  This is an error.
                setError({
                  errorField: 'email',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid e-Mail address.`
                });
                return;
              }
            }
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'messaging.email',
                  newData: event.target.value
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.email.address',
                  newData: event.target.value
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('email')) {
              updateObj.errorObj = {
                errorField: 'email',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('email')) && (errorList.email.errorValue))
            ? errorList.email.errorValue
            : (currentValues.peopleRec?.contact_info?.email?.address || currentValues.peopleRec.messaging?.email || '')
          }
          helperText={errorList.hasOwnProperty('email') ? errorList.email.errorMessage : 'e-Mail'}
        />
      </Box>
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'>
        <TextField style={{ width: '400px' }}
          id='email'
          key={`profileSection__alt_email__${currentValues.peopleRec.contact_info?.alt_email?.address || 0}`}
          autoComplete='off'
          error={errorList.hasOwnProperty('email')}
          onBlur={async (event) => {
            if (event.target.value !== '') {
              let [, domain] = event.target.value.split('@');
              let valid = false;
              if (domain) {
                valid = ((domain.split('.')).length > 1);
              }
              if (!valid) {
                // Invalid eMail.  This is an error.
                setError({
                  errorField: 'email',
                  errorValue: event.target.value,
                  isError: true,
                  errorMessage: `${event.target.value} isn't a valid e-Mail address.`
                });
                return;
              }
            }
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'contact_info.alt_email.address',
                  newData: event.target.value
                }]
            };
            // clear error if one existed
            if (errorList.hasOwnProperty('alt_email')) {
              updateObj.errorObj = {
                errorField: 'alt_email',
                isError: false
              };
            }
            await updateField(updateObj);
          }}
          defaultValue={((errorList.hasOwnProperty('alt_email')) && (errorList.alt_email.errorValue))
            ? errorList.alt_email.errorValue
            : (currentValues.peopleRec?.contact_info?.alt_email?.address || '')
          }
          helperText={errorList.hasOwnProperty('alt_email') ? errorList.alt_email.errorMessage : 'Alternate e-Mail'}
        />
      </Box>
      <TextField style={{ width: '550px', maxWidth: '100%' }}
        id='email'
        multiline
        key={`profileSection__street1__${currentValues.peopleRec.address?.address || 0}`}
        autoComplete='off'
        onBlur={async (event) => {
          currentValues.peopleRec.address.address = event.target.value;
          let updateObj = {
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'address.address',
                newData: event.target.value
              },
              {
                tableName: 'peopleRec',
                fieldName: 'location',
                newData: makeLocation()
              }]
          };
          await updateField(updateObj);
        }}
        defaultValue={currentValues.peopleRec?.address?.address || ''}
        helperText={'Address'}
      />
      <TextField style={{ width: '550px', maxWidth: '100%' }}
        id='email'
        multiline
        key={`profileSection__street2__${currentValues.peopleRec.address?.address2 || 0}`}
        autoComplete='off'
        onBlur={async (event) => {
          currentValues.peopleRec.address.address2 = event.target.value;
          let updateObj = {
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'address.address2',
                newData: event.target.value
              },
              {
                tableName: 'peopleRec',
                fieldName: 'location',
                newData: makeLocation()
              }]
          };
          await updateField(updateObj);
        }}
        defaultValue={currentValues.peopleRec?.address?.address2 || ''}
        helperText={'Address Line 2'}
      />
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'>
        <TextField style={{ width: '200px' }}
          id='email'
          key={`profileSection__city__${currentValues.peopleRec.address?.city || 0}`}
          autoComplete='off'
          onBlur={async (event) => {
            currentValues.peopleRec.address.city = event.target.value;
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'address.city',
                  newData: event.target.value
                },
                  {
                    tableName: 'peopleRec',
                    fieldName: 'location',
                    newData: makeLocation()
                  }]
            };
            await updateField(updateObj);
          }}
          defaultValue={currentValues.peopleRec?.address?.city || ''}
          helperText={'City'}
        />
        <TextField style={{ marginLeft: '16px', width: '100px' }}
          id='email'
          key={`profileSection__state__${currentValues.peopleRec.address?.state || 0}`}
          autoComplete='off'
          onBlur={async (event) => {
            currentValues.peopleRec.address.state = event.target.value;
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'address.state',
                  newData: event.target.value
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'location',
                  newData: makeLocation()
                }]
            };
            await updateField(updateObj);
          }}
          defaultValue={currentValues.peopleRec?.address?.state || ''}
          helperText={'State'}
        />
        <TextField style={{ marginLeft: '16px', width: '80px' }}
          id='email'
          key={`profileSection__zip__${currentValues.peopleRec.address?.zip_code || 0}`}
          autoComplete='off'
          onBlur={async (event) => {
            currentValues.peopleRec.address.zip_code = event.target.value;
            let updateObj = {
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'address.zip_code',
                  newData: event.target.value
                },
                {
                  tableName: 'peopleRec',
                  fieldName: 'location',
                  newData: makeLocation()
                }]
            };
            await updateField(updateObj);
          }}
          defaultValue={currentValues.peopleRec?.address?.zip_code || ''}
          helperText={'Zip'}
        />
      </Box>
      <TextField style={{ width: '550px', maxWidth: '100%' }}
        id='email'
        multiline
        key={`profileSection__eContact1__${currentValues.peopleRec.emergency_contact?.contact1 || 0}`}
        autoComplete='off'
        onBlur={async (event) => {
          if (!currentValues.peopleRec.hasOwnProperty('emergency_contact')) {
            currentValues.peopleRec.emergency_contact = {};
          }
          currentValues.peopleRec.emergency_contact.contact1 = event.target.value;
          let updateObj = {
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'emergency_contact.contact1',
                newData: event.target.value
              }]
          };
          await updateField(updateObj);
        }}
        defaultValue={currentValues.peopleRec.emergency_contact?.contact1 || ''}
        helperText={'Emergency Contact 1 - Name & Phone'}
      />
      <TextField style={{ width: '550px', maxWidth: '100%' }}
        id='email'
        multiline
        key={`profileSection__eContact2__${currentValues.peopleRec.emergency_contact?.contact2 || 0}`}
        autoComplete='off'
        onBlur={async (event) => {
          if (!currentValues.peopleRec.hasOwnProperty('emergency_contact')) {
            currentValues.peopleRec.emergency_contact = {};
          }
          currentValues.peopleRec.emergency_contact.contact2 = event.target.value;
          let updateObj = {
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'emergency_contact.contact2',
                newData: event.target.value
              }]
          };
          await updateField(updateObj);
        }}
        defaultValue={currentValues.peopleRec.emergency_contact?.contact2 || ''}
        helperText={'Emergency Contact 2 - Name & Phone'}
      />
      <Box display='flex' alignItems='center'
        justifyContent='flex-end' flexDirection='row'>
        <Typography
          style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
        >
          {`User ID: ${currentValues.peopleRec.person_id}`}
        </Typography>
      </Box>
    </Box>
  );
};
