import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Typography, TextField, Button, Avatar, Switch } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { AVAclasses } from '../../util/AVAStyles';
import AVAUploadFile from '../../util/AVAUploadFile';
import { listFromArray } from '../../util/AVAUtilities';

import QuickSearch from '../sections/QuickSearch';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  const { state } = useSession();


  const propList = [{
    prop_title: 'UI style',
    fieldName: 'ui_tiles',
    on_value: true,
    off_value: false,
    off_text: 'Menu',
    on_text: 'Tiles'
  },
  {
    prop_title: 'Messaging Version',
    fieldName: 'allow_old_messaging',
    on_value: true,
    off_value: false,
    off_text: 'New Required',
    on_text: 'Legacy Allowed'
  },
  {
    prop_title: 'When User doesn\'t specify a choice, prefer which messaging method?',
    fieldName: 'preferred_communication',
    on_value: 'text',
    off_value: 'email',
    off_text: 'e-Mail Preferred',
    on_text: 'Text Messages Preferred'
  },
  {
    prop_title: 'Mandatory Passwords',
    fieldName: 'mandatory_passwords',
    on_value: true,
    off_value: false,
    off_text: 'Passwords Optional',
    on_text: 'Password Mandatory'
  },
  {
    prop_title: 'Show Forms section in Profile',
    fieldName: 'suppress_forms_in_profile',
    on_value: true,
    off_value: false,
    off_text: 'Show',
    on_text: 'Hide'
  }];

  for (let this_prop of propList) {
    if (currentValues.Groups?.group_style?.hasOwnProperty(this_prop.fieldName)) {
      this_prop.current_value = currentValues.Groups.group_style[this_prop.fieldName] === this_prop.on_value;
    }
    else if (state.session.client_style?.hasOwnProperty(this_prop.fieldName)) {
      this_prop.current_value = state.session.client_style?.[this_prop.fieldName] === this_prop.on_value;
    }
    else {
      this_prop.current_value = this_prop.off_value;
    }
  }

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'
      >
        <TextField
          id='GroupName'
          autoComplete='off'
          style={{ width: '500px' }}
          onChange={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'Groups',
                  fieldName: 'name',
                  newData: event.target.value,
                  keyChange: true
                }]
            });
          }}
          defaultValue={currentValues.Groups?.name || ''}
          helperText='Group Name'
        />
      </Box>

      <Box display='flex' alignItems='flex-start'
        justifyContent='flex-start' flexDirection='column'
        marginTop={4}
      >
        <Typography
          style={AVATextStyle({ margin: { right: 0.5, bottom: 0.5 } })}
        >
          {'Logo / Image'}
        </Typography>
        <Box display='flex' alignItems='center'
          justifyContent='flex-start' flexDirection='row'
          marginTop={0}
          key={'logo_area'}
        >
          <Avatar className={AVAClass.AVAAvatar} src={currentValues.Groups?.group_style?.logo} />
          <Button
            className={AVAClass.AVAButton}
            style={{ width: 'fit-content', marginTop: '8px', marginBottom: '8px', marginLeft: '4px', marginRight: '16px' }}
            size='small'
            onClick={() => {
              updateReactData({
                getLogo: true
              }, true);
            }}
          >
            <CloudUploadIcon />
            <Typography
              style={AVATextStyle({ size: 0.8, margin: { left: 0.5, right: 0.5 } })}
            >
              {'New Image'}
            </Typography>
          </Button>
        </Box>
      </Box>


      <Box display='flex' alignItems='center'
        flexDirection='row'
        marginTop={4}
      >
        <Typography
          style={AVATextStyle({ margin: { right: 0.5 } })}
        >
          <div><p>Owners/Administrators of this group<br />
            <strong>{listFromArray(reactData.admin_names) || 'None'}</strong></p></div>
        </Typography>
        <Button
          className={AVAClass.AVAButton}
          style={{ width: 'fit-content', marginTop: '8px', marginBottom: '8px', marginLeft: '4px', marginRight: '16px' }}
          size='small'
          onClick={() => {
            updateReactData({
              showQuickSearch: true
            }, true);
          }}
        >
          <Typography
            style={AVATextStyle({ size: 0.8, margin: { left: 0, right: 0 } })}
          >
            {'Update'}
          </Typography>
        </Button>
      </Box>


      {propList.map((this_prop, listIndex) => (
        <React.Fragment key={listIndex}>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {this_prop.prop_title}
          </Typography>
          <Box flexGrow={2} display='flex' alignItems='center'
            justifyContent='flex-start' marginBottom={1} flexDirection='row'>
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { right: 0.8 },
                color: state.session.client_style?.[this_prop.fieldName] !== this_prop.on_value ? 'red' : null,
                bold: this_prop.current_value !== this_prop.on_value
              })}
            >
              {this_prop.off_text}
            </Typography>
            <Switch
              checked={this_prop.current_value === this_prop.on_value}
              onClick={async (event) => {
                await updateField({
                  updateList:
                    [{
                      tableName: 'Groups',
                      fieldName: `group_style.${this_prop.fieldName}`,
                      newData: (this_prop.current_value === this_prop.on_value)
                        ? this_prop.off_value
                        : this_prop.on_value
                    }]
                });
              }}
              name={this_prop.prop_title}
              color="primary"
            />
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { left: 0.8 },
                color: state.session.client_style?.[this_prop.fieldName] === this_prop.on_value ? 'red' : null,
                bold: this_prop.current_value === this_prop.on_value
              })}
            >
              {this_prop.on_text}
            </Typography>
          </Box>
        </React.Fragment>
      ))}

      <Box display='flex' alignItems='center'
        justifyContent='flex-end' flexDirection='row'>
        <Typography
          style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
        >
          <div><p>Items in red are the default settings for {state.session.client_name}<br />
            <strong>{currentValues.Groups?.group_id}</strong></p></div>
        </Typography>
      </Box>

      {reactData.getLogo &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: ['Logo', 'Tap "Choose a File" to select a new image'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              getLogo: false
            }, true);
          }}
          onLoad={async (response) => {
            await updateField({
              updateList:
                [{
                  tableName: 'Groups',
                  fieldName: 'logo',
                  newData: response[0].fLoc
                }],
              reactUpd: {
                getLogo: false
              }
            });
          }}
        />
      }
      {reactData.showQuickSearch &&
        <QuickSearch
          reactData={reactData}
          updateReactData={updateReactData}
          options={{
            keepSelections: true,
            withGroups: false,
            withPreferred: false,
            hidePeople: false,
            pickAndGo: true,
            buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
            buttonText: 'Select',
            showAll: true,
            title: 'Select Owners/Administrators for this Group'
          }}
          onClose={async (selections) => {
            await updateField({
              updateList:
                [{
                  tableName: 'Groups',
                  fieldName: 'admin_list',
                  newData: selections.map(s => s.person_id) || [state.session.person_id]
                }],
              reactUpd: {
                showQuickSearch: false,
                admin_names: selections.map(s => s.person_name) || [state.session.person_display_name]
              }
            });
          }}
        />
      }
    </Box >
  );
};
