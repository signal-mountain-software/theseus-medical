import React from 'react';
import { Box, Typography, TextField, Button, Avatar } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { AVAclasses } from '../../util/AVAStyles';
import AVAUploadFile from '../../util/AVAUploadFile';

import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  let localColor = currentValues.customizationRecs.client_style.customization_value.backgroundColor;

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Box display='flex' alignItems='center'
        justifyContent='flex-start' flexDirection='row'
      >
        <TextField
          id='ClientName'
          autoComplete='off'
          style={{ width: '500px' }}
          onBlur={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_name.customization_value',
                  newData: event.target.value
                }]
            });
          }}
          defaultValue={currentValues.customizationRecs.client_name?.customization_value || ''}
          helperText='Client Name'
        />
      </Box>
      <Box display='flex' alignItems='flex-start'
        justifyContent='flex-start' flexDirection='column'
        marginTop={3}
      >
        <Typography
          style={AVATextStyle({ margin: { right: 0.5 } })}
        >
          {'Background Image'}
        </Typography>
        <Box display='flex' alignItems='center'
          justifyContent='flex-start' flexDirection='row'
          marginTop={1} marginLeft={'8px'}
          key={'bg_area'}
        >
          <Box
            component="img"
            mr={1}
            border={2}
            minWidth={200}
            maxWidth={200}
            alt=''
            src={currentValues.customizationRecs.client_style.customization_value.checkin_image}
          />
          <Box display='flex' alignItems='flex-start'
            justifyContent='center' flexDirection='column'
            marginTop={1} marginLeft={'8px'}
            key={'bg_area_right_column'}
          >
            <Button
              className={AVAClass.AVAButton}
              marginTop={'24px'}
              style={{ width: 'fit-content', marginLeft: '16px' }}
              size='small'
              onClick={() => {
                updateReactData({
                  getBackgroundImage: true
                }, true);
              }}
            >
              <CloudUploadIcon />
              <Typography
                style={AVATextStyle({ size: 0.8, margin: { left: 1, right: 0.5 } })}
              >
                {'Upload a new Image'}
              </Typography>
            </Button>
          </Box>
        </Box>
      </Box>
      <Box display='flex' alignItems='flex-start'
        justifyContent='flex-start' flexDirection='column'
        marginTop={4}
      >
        <Typography
          style={AVATextStyle({ margin: { right: 0.5 } })}
        >
          {'Background Color'}
        </Typography>
        <Typography
          style={AVATextStyle({ size: 0.8, margin: { top: 0, right: 1 } })}
        >
          {'Tap the color box to pick a new color; tap the check to select'}
        </Typography>
        <Box display='flex' alignItems='flex-start'
          justifyContent='flex-start' flexDirection='row'
          marginTop={2}
        >
          <input type="color" id="head" name="head"
            key={`color_picker_bg__${reactData.localColor}`}
            value={localColor}
            onChange={(event) => {
              localColor = event.target.value;
            }}
          />
          <CheckCircleIcon
            key={`color_picker_bg_button_${reactData.localColor}`}
            id={`radio-button_color`}
            style={AVATextStyle({
              size: 1.5,
              margin: { left: 1 },
            })}
            onClick={async () => {
              await updateField({
                updateList:
                  [{
                    tableName: 'customizationRecs',
                    fieldName: 'client_style.customization_value.backgroundColor',
                    newData: localColor
                  }]
              });
            }}
            size='small'
          />
        </Box>
      </Box>
      <Box display='flex' alignItems='flex-start'
        justifyContent='flex-start' flexDirection='column'
        marginTop={4}
      >
        <Typography
          style={AVATextStyle({ margin: { right: 0.5 } })}
        >
          {'Logo'}
        </Typography>
        <Box display='flex' alignItems='center'
          justifyContent='flex-start' flexDirection='row'
          marginTop={0}
          key={'logo_area'}
        >
          <Button
            className={AVAClass.AVAButton}
            marginTop={'24px'}
            style={{ width: 'fit-content', marginLeft: '16px', marginRight: '16px' }}
            size='small'
            onClick={() => {
              updateReactData({
                getLogo: true
              }, true);
            }}
          >
            <CloudUploadIcon />
            <Typography
              style={AVATextStyle({ size: 0.8, margin: { left: 1, right: 0.5 } })}
            >
              {'Upload a new Logo'}
            </Typography>
          </Button>
          <Avatar className={AVAClass.AVAAvatar} src={currentValues.customizationRecs.logo.icon} />
        </Box>
      </Box>
      <Box display='flex' alignItems='center'
        justifyContent='flex-end' flexDirection='row'>
        <Typography
          style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
        >
          {`Client ID: ${currentValues.customizationRecs.client_name.client_id}`}
        </Typography>
      </Box>
      {
        reactData.getBackgroundImage &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: ['Background Image', 'Tap "Choose a File" to select a new image'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              getBackgroundImage: false
            }, true);
          }}
          onLoad={async (response) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.checkin_image',
                  newData: response[0].fLoc
                }],
              reactUpd: {
                getBackgroundImage: false
              }
            });
          }}
        />
      }
      {
        reactData.getLogo &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: ['Background Image', 'Tap "Choose a File" to select a new image'],
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
                  tableName: 'customizationRecs',
                  fieldName: 'logo.icon',
                  newData: response[0].fLoc
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'logo.customization_value',
                  newData: response[0].fLoc
                }],
              reactUpd: {
                getLogo: false
              }
            });
          }}
        />
      }
    </Box >
  );
};
