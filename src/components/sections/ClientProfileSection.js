import React from 'react';
import { Box, Typography, TextField, Button, Avatar, Switch, RadioGroup, Radio, FormControlLabel } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { AVAclasses } from '../../util/AVAStyles';
import AVAUploadFile from '../../util/AVAUploadFile';

import * as XLSX from 'xlsx';
import { dbClient } from '../../util/AVAUtilities';

import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const AVAClass = AVAclasses();
  const [localColor, setLocalColor] = React.useState(
    currentValues.customizationRecs?.client_style?.customization_value?.backgroundColor || '#ffffff'
  );

  const preauthFileInputRef = React.useRef(null);
  const [preauthImportStatus, setPreauthImportStatus] = React.useState(null);

  const generateLogoThumbFromUrl = React.useCallback((imageUrl) => {
    return new Promise((resolve) => {
      if (!imageUrl || typeof imageUrl !== 'string') { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const THUMB_SIZE = 64;
          const canvas = document.createElement('canvas');
          canvas.width = THUMB_SIZE;
          canvas.height = THUMB_SIZE;
          const ctx = canvas.getContext('2d');
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        }
        catch (_e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }, []);

  const handlePreauthUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';  // allow re-selecting same file
    const clientId = currentValues.customizationRecs.client_name?.client_id;
    setPreauthImportStatus('Reading file\u2026');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        const rawKey = row['preauth_key'];
        const preauth_key = rawKey != null ? String(rawKey).trim() : '';
        if (!preauth_key) { skipped++; continue; }
        const rawOTU = row['one_time_use'];
        const one_time_use = /^(y(es)?|true|1)$/i.test(String(rawOTU ?? '').trim());
        const preauth_data = {};
        for (const [key, value] of Object.entries(row)) {
          if (key === 'preauth_key' || key === 'one_time_use') continue;
          if (value !== '') preauth_data[key] = value;
        }
        await dbClient.put({
          TableName: 'PreAuthorization',
          Item: { client_id: clientId, preauth_key, one_time_use, preauth_data }
        }).promise();
        imported++;
      }
      setPreauthImportStatus(`Done: ${imported} imported, ${skipped} skipped.`);
    } catch (err) {
      console.error('PreAuth import error:', err);
      setPreauthImportStatus(`Error: ${err.message}`);
    }
  };

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
            src={currentValues.customizationRecs.client_style?.customization_value?.checkin_image}
          />
          <Box display='flex' alignItems='flex-start'
            justifyContent='center' flexDirection='column'
            marginTop={1} marginLeft={'8px'}
            key={'bg_area_right_column'}
          >
            <Button
              className={AVAClass.AVAButton}
              style={{ width: 'fit-content', marginTop: '8px', marginBottom: '8px', marginLeft: '16px' }}
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
              setLocalColor(event.target.value);
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
            style={{ width: 'fit-content', marginTop: '8px', marginBottom: '8px', marginLeft: '16px', marginRight: '16px' }}
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
          <Avatar className={AVAClass.AVAAvatar} src={currentValues.customizationRecs.logo?.icon} />
        </Box>
      </Box>







      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'UI style'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.ui_tiles
          })}
        >
          {'Menu'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.ui_tiles || false}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.ui_tiles',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.ui_tiles
                }]
            });
          }}
          name="UIStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.ui_tiles
          })}
        >
          {'Tiles'}
        </Typography>
      </Box>




      {currentValues.customizationRecs.client_style?.customization_value?.ui_tiles &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ margin: { top: 1 } })}
          >
            {'Show Image Thumbnails on Tiles'}
          </Typography>
          <Box flexGrow={2} display='flex' alignItems='center'
            justifyContent='flex-start' marginBottom={1} flexDirection='row'>
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { right: 0.8 },
                bold: !currentValues.customizationRecs.client_style?.customization_value?.suppress_card_image
              })}
            >
              {'Show Images'}
            </Typography>
            <Switch
              checked={currentValues.customizationRecs.client_style?.customization_value?.suppress_card_image || false}
              onClick={async (event) => {
                await updateField({
                  updateList:
                    [{
                      tableName: 'customizationRecs',
                      fieldName: 'client_style.customization_value.suppress_card_image',
                      newData: !currentValues.customizationRecs.client_style?.customization_value?.suppress_card_image
                    }]
                });
              }}
              name="UIStyle"
              color="primary"
            />
            <Typography
              style={AVATextStyle({
                size: 0.8, margin: { left: 0.8 },
                bold: currentValues.customizationRecs.client_style?.customization_value?.suppress_card_image
              })}
            >
              {'Hide Images'}
            </Typography>
          </Box>
        </React.Fragment>
      }

      



<Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Use New Menu'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.ui_v3Dev
          })}
        >
          {'Legacy'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.ui_v3Dev || false}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.ui_v3Dev',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.ui_v3Dev
                }]
            });
          }}
          name="UIStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.ui_v3Dev
          })}
        >
          {'V3 version'}
        </Typography>
      </Box>





      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'People Maintenance version'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: currentValues.customizationRecs.useOldVersion?.customization_value
          })}
        >
          {'Legacy'}
        </Typography>
        <Switch
          checked={!(currentValues.customizationRecs.useOldVersion?.customization_value)}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'useOldVersion',
                  newData: {
                    client_id: currentValues.customizationRecs.client_name?.client_id,
                    custom_key: 'useOldVersion',
                    customization_value: !currentValues.customizationRecs.useOldVersion?.customization_value
                  }
                }]
            });
          }}
          name="UIStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: !currentValues.customizationRecs.useOldVersion?.customization_value
          })}
        >
          {'New'}
        </Typography>
      </Box>





      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Messaging Version'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.allow_old_messaging
          })}
        >
          {'Legacy Allowed'}
        </Typography>
        <Switch
          checked={!(currentValues.customizationRecs.client_style?.customization_value?.allow_old_messaging)}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.allow_old_messaging',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.allow_old_messaging
                }]
            });
          }}
          name="MessagingStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.allow_old_messaging
          })}
        >
          {'New Required'}
        </Typography>
      </Box>




      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'When User doesn\'t specify a choice, prefer which messaging method?'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.preferred_communication ||
              currentValues.customizationRecs.client_style?.customization_value?.preferred_communication !== 'text'
          })}
        >
          {'e-Mail Preferred'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.preferred_communication === 'text'}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.preferred_communication',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.preferred_communication ? 'email' :
                    (currentValues.customizationRecs.client_style?.customization_value?.preferred_communication === 'text' ? 'email' : 'text')
                }]
            });
          }}
          name="MessagingStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.preferred_communication === 'text'
          })}
        >
          {'Text Messages Preferred'}
        </Typography>
      </Box>


      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Mandatory Passwords'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.mandatory_passwords
          })}
        >
          {'Passwords Optional'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.mandatory_passwords}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.mandatory_passwords',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.mandatory_passwords
                }]
            });
          }}
          name="PasswordStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.mandatory_passwords
          })}
        >
          {'Password Mandatory'}
        </Typography>
      </Box>




      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Scrolling Marquee'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.marquee_critical_only
          })}
        >
          {'Show Marquee'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.marquee_critical_only}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.marquee_critical_only',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.marquee_critical_only
                }]
            });
          }}
          name="MarqueeStyle"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.marquee_critical_only
          })}
        >
          {'Hide Unless Critical/Urgent'}
        </Typography>
      </Box>





      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'People Lists - Sort Order'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.sort_order !== 'last_first'
          })}
        >
          {'First Last'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.sort_order === 'last_first'}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.sort_order',
                  newData: currentValues.customizationRecs.client_style?.customization_value?.sort_order === 'last_first' ? 'first_last' : 'last_first'
                }]
            });
          }}
          name="SortOrder"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.sort_order === 'last_first'
          })}
        >
          {'Last, First'}
        </Typography>
      </Box>





      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Show Forms section in Profile'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.suppress_forms_in_profile
          })}
        >
          {'Show'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.suppress_forms_in_profile}
          onClick={async (event) => {
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.suppress_forms_in_profile',
                  newData: !currentValues.customizationRecs.client_style?.customization_value?.suppress_forms_in_profile
                }]
            });
          }}
          name="ShowFFormsInProfile"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.suppress_forms_in_profile
          })}
        >
          {'Hide'}
        </Typography>
      </Box>






      <Typography
        style={AVATextStyle({ margin: { top: 1 } })}
      >
        {'Web Account Registration'}
      </Typography>
      <Box flexGrow={2} display='flex' alignItems='center'
        justifyContent='flex-start' marginBottom={1} flexDirection='row'>
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { right: 0.8 },
            bold: !currentValues.customizationRecs.client_style?.customization_value?.preAuth?.require_pre_auth
          })}
        >
          {'Open to Anyone'}
        </Typography>
        <Switch
          checked={currentValues.customizationRecs.client_style?.customization_value?.preAuth?.require_pre_auth || false}
          onClick={async () => {
            const currentPreAuth = currentValues.customizationRecs.client_style?.customization_value?.preAuth || {};
            await updateField({
              updateList: [{
                tableName: 'customizationRecs',
                fieldName: 'client_style.customization_value.preAuth',
                newData: { ...currentPreAuth, require_pre_auth: !currentPreAuth.require_pre_auth }
              }]
            });
          }}
          name="PreAuthRequired"
          color="primary"
        />
        <Typography
          style={AVATextStyle({
            size: 0.8, margin: { left: 0.8 },
            bold: currentValues.customizationRecs.client_style?.customization_value?.preAuth?.require_pre_auth
          })}
        >
          {'Pre-Authorization Required'}
        </Typography>
      </Box>

      {currentValues.customizationRecs.client_style?.customization_value?.preAuth?.require_pre_auth &&
        <React.Fragment>
          <Typography
            style={AVATextStyle({ size: 0.8, margin: { left: 0.5, top: 0.5, bottom: -0.3 } })}
          >
            {'Authorize by matching the applicant on:'}
          </Typography>
          <RadioGroup
            value={currentValues.customizationRecs.client_style?.customization_value?.preAuth?.preauth_match_on || 'code'}
            onChange={async (event) => {
              const currentPreAuth = currentValues.customizationRecs.client_style?.customization_value?.preAuth || {};
              await updateField({
                updateList: [{
                  tableName: 'customizationRecs',
                  fieldName: 'client_style.customization_value.preAuth',
                  newData: { ...currentPreAuth, preauth_match_on: event.target.value }
                }]
              });
            }}
            style={{ marginLeft: '16px', marginBottom: '8px', flexDirection: 'row' }}
          >
            {[['code', 'Code'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone']].map(([val, label]) => (
              <FormControlLabel key={val} value={val} control={<Radio color='primary' size='small' />} label={
                <Typography style={AVATextStyle({ size: 0.8, margin: { left: -0.5, top: 0.175 } })}>{label}</Typography>
              } />
            ))}
          </RadioGroup>

          {(currentValues.customizationRecs.client_style?.customization_value?.preAuth?.preauth_match_on || 'code') === 'code' &&
            <TextField
              autoComplete='off'
              style={{ width: '60%', marginBottom: '16px', marginLeft: '8px' }}
              defaultValue={currentValues.customizationRecs.client_style?.customization_value?.preAuth?.preauth_code_prompt || ''}
              helperText='Prompt text shown to applicant when asking for their code'
              onBlur={async (event) => {
                const currentPreAuth = currentValues.customizationRecs.client_style?.customization_value?.preAuth || {};
                await updateField({
                  updateList: [{
                    tableName: 'customizationRecs',
                    fieldName: 'client_style.customization_value.preAuth',
                    newData: { ...currentPreAuth, preauth_code_prompt: event.target.value }
                  }]
                });
              }}
            />
          }

          <Box display='flex' alignItems='center' style={{ marginLeft: '8px', marginTop: '4px', marginBottom: '8px' }}>
            <input
              type='file'
              accept='.csv,.xlsx,.xls,.ods'
              ref={preauthFileInputRef}
              style={{ display: 'none' }}
              onChange={handlePreauthUpload}
            />
            <Button
              variant='outlined'
              size='small'
              startIcon={<CloudUploadIcon />}
              onClick={() => preauthFileInputRef.current?.click()}
              style={AVATextStyle({ size: 0.8 })}
            >
              {'Import Pre-Auth Records'}
            </Button>
            {preauthImportStatus &&
              <Typography style={AVATextStyle({ size: 0.75, margin: { left: 1 } })}>
                {preauthImportStatus}
              </Typography>
            }
          </Box>
        </React.Fragment>
      }

      <Box display='flex' alignItems='center'
        justifyContent='flex-end' flexDirection='row'>
        <Typography
          style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
        >
          {`Client ID: ${currentValues.customizationRecs.client_name?.client_id}`}
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
            title: ['Logo', 'Tap "Choose a File" to select a new image'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              getLogo: false
            }, true);
          }}
          onLoad={async (response) => {
            const logoUrl = response?.[0]?.fLoc || null;
            const logoThumb = await generateLogoThumbFromUrl(logoUrl);
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'logo.icon',
                  newData: logoUrl
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'logo.customization_value',
                  newData: logoUrl
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'logo.icon_thumb',
                  newData: logoThumb
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'logo.icon_updated_at',
                  newData: new Date().toISOString()
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
