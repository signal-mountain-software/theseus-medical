import React from 'react';
import { Box, Typography, Checkbox, FormControlLabel, Input, Switch } from '@material-ui/core/';
import { isEmpty, deepCopy } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';

import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, ogValues, errorList, setError, reactData, updateField }) => {

  const focusedSection = React.useRef(null);

  const handleMakeSelection = async (props) => {
    let response = deepCopy(reactData.form_fields[props.prop].value || []);
    if (isEmpty(response)) {
      response = [props.clickText];
    }
    else {
      if (!Array.isArray(response)) {
        // if the original value wans't an array, make it an array before checking the new value
        response = [response];
      }
      let foundAt = response.indexOf(props.clickText);
      if (foundAt < 0) {   // not there?  add it
        response.push(props.clickText);
        if (reactData.form_fields[props.prop].fieldRec.value.selection.max
          && (response.length > reactData.form_fields[props.prop].fieldRec.value.selection.max)) {
          response.shift();
        }
      }
      else {   // already there?  remove it
        response.splice(foundAt, 1);
      }
    }
    return response;
  };

  React.useEffect(() => {
    if (focusedSection && focusedSection.current) {
      focusedSection.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []);

  return (
    <Box
      key={`administrativeSection_masterBox`}
      ref={focusedSection}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      {(Object.keys(reactData.form_fields).length > 0) && Object.keys(reactData.form_fields).map((this_formField, cFNdx) => (
        (reactData.form_fields[this_formField].adminSection !== false) &&
        (reactData.administrative_account || reactData.form_fields[this_formField].fieldRec.options?.non_admin) &&
        <React.Fragment
          key={`mainFrag_${cFNdx}`}
        >
          {(reactData.form_fields[this_formField].fieldRec.value.type.startsWith('select')) &&
            <Box
              display='flex'
              mb={0}
              flexDirection='row'
              justifyContent='flex-start'
              alignItems='center'
            >
              <Box flexDirection='column' key={`Box__${this_formField}`} style={{
                marginTop: 0,
                paddingTop: 0,
              }}>
                <Typography style={Object.assign({},
                  {
                    margin: 0,
                    marginLeft: 0,
                    marginRight: '2px',
                    marginBottom: '8px',
                    paddingTop: '16px',
                    paddingBottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 0,
                  },
                  (AVATextStyle({ size: 1, bold: true })))
                }>
                  {reactData.form_fields[this_formField].fieldRec.prompt.value}
                </Typography>
                <Box
                  flexDirection='row'
                  key={`CheckGroup__${this_formField}`}
                >
                  <React.Fragment
                    key={`groupFrag__${this_formField}`}
                  >
                    {(reactData.form_fields[this_formField].fieldRec.value.selection.selectionList).map((text, tIndex) => (
                      <FormControlLabel
                        style={{
                          margin: 0,
                          marginLeft: '-8px',
                          marginRight: '2px',
                          height: 1,
                          fontSize: 0.8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '10px',
                          marginBottom: '25px',
                        }}
                        key={`${this_formField}_${tIndex}`}
                        control={
                          <Checkbox
                            aria-label={`${this_formField}_${tIndex}`}
                            name={`${this_formField}_${tIndex}`}
                            key={`CheckGroup__${this_formField}_${tIndex}`}
                            size='small'
                            checked={reactData.form_fields[this_formField].value && reactData.form_fields[this_formField].value.includes(text)}
                            onClick={async () => {
                              let newValue = await handleMakeSelection({
                                clickText: text,
                                prop: this_formField
                              });
                              let splitSave = reactData.form_fields[this_formField].fieldRec.value.saveAs.split('.');
                              reactData.form_fields[this_formField].value = newValue;
                              await updateField({
                                updateList:
                                  [{
                                    tableName: splitSave.shift(),
                                    fieldName: splitSave.join('.'),
                                    newData: newValue
                                  }],
                                reactUpd: {
                                  fields: reactData.form_fields
                                }
                              });
                            }}
                            disableRipple
                            inputProps={{ 'aria-labelledby': `message_routing_3` }}
                          />
                        }
                        label={
                          <Typography style={{
                            marginLeft: '-8px',
                            marginRight: '16px',
                            '&.MuiInputBaseInput': {
                              paddingBottom: '0px'
                            }
                          }}>
                            {text}
                          </Typography>
                        }
                        labelPlacement='end'
                      />
                    ))}
                  </React.Fragment>
                </Box>
              </Box>
            </Box>
          }

          {(reactData.form_fields[this_formField].fieldRec.value.type === 'text') &&
            Array.isArray(reactData.form_fields[this_formField].value) &&
            <Box
              key={`local_box__${cFNdx}`}
              display='flex' flexDirection='column'
              alignItems={'flex-start'}
            >
              <Typography
                key={`local_prompt__${cFNdx}`}
                style={AVATextStyle({ size: 1, margin: { top: 1 }, bold: true })}
              >
                {`${reactData.form_fields[this_formField].prompt} `}
              </Typography>
              <React.Fragment
                key={`groupFrag__${this_formField}`}
              >
                {reactData.form_fields[this_formField].value.map((this_value, this_valueNDX) => (
                  <Input
                    id={`field__${this_formField}-${this_valueNDX}`}
                    key={`field__${this_formField}-${this_valueNDX}`}
                    variant={'outlined'}
                    disabled={reactData.form_fields[this_formField].fieldRec.options?.viewOnly}
                    style={AVATextStyle({
                      lineHeight: 1,
                      width: `${reactData.form_fields[this_formField].fieldRec.prompt.width || 200}px`,
                      maxWidth: '90%',
                      size: 0.95,
                      color: 'black',
                      margin: { top: 0.5, bottom: 0.5, left: 1.5, right: 3 }
                    })}
                    autoComplete='off'
                    defaultValue={this_value || ''}
                    onBlur={async (event) => {
                      let newValue = event.target.value;
                      let splitSave = reactData.form_fields[this_formField].fieldRec.value.saveAs.split('.');
                      reactData.form_fields[this_formField].value[this_valueNDX] = newValue;
                      await updateField({
                        updateList:
                          [{
                            tableName: splitSave.shift(),
                            fieldName: splitSave.join('.'),
                            newData: reactData.form_fields[this_formField].value
                          }],
                        reactUpd: {
                          fields: reactData.form_fields
                        }
                      });
                    }}
                  />
                ))}
              </React.Fragment>
            </Box>
          }

          {(reactData.form_fields[this_formField].fieldRec.value.type === 'text') &&
            !Array.isArray(reactData.form_fields[this_formField].value) &&
            <Box
              key={`local_box__${cFNdx}`}
              display='flex' flexDirection='row'
              alignItems={'center'}
            >
              <Typography
                key={`local_prompt__${cFNdx}`}
                style={AVATextStyle({ size: 1, margin: { top: 0.25 }, bold: true })}
              >
                {`${reactData.form_fields[this_formField].prompt}: `}
              </Typography>
              <Input
                id={`field__${this_formField}`}
                key={`field__${this_formField}`}
                variant={'outlined'}
                disabled={reactData.form_fields[this_formField].fieldRec.options?.viewOnly || Array.isArray(reactData.form_fields[this_formField].value)}
                multiline={Array.isArray(reactData.form_fields[this_formField].value)}
                style={AVATextStyle({
                  lineHeight: 1,
                  width: `${reactData.form_fields[this_formField].fieldRec.prompt.width || 200}px`,
                  maxWidth: '90%',
                  size: 0.95,
                  color: 'black',
                  margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                })}
                autoComplete='off'
                defaultValue={Array.isArray(reactData.form_fields[this_formField].value)
                  ? reactData.form_fields[this_formField].value.join('\n')
                  : (reactData.form_fields[this_formField].value || '')
                }
                onBlur={async (event) => {
                  if (Array.isArray(reactData.form_fields[this_formField].value)) {
                    return;
                  }
                  let newValue = event.target.value;
                  let splitSave = reactData.form_fields[this_formField].fieldRec.value.saveAs.split('.');
                  reactData.form_fields[this_formField].value = newValue;
                  await updateField({
                    updateList:
                      [{
                        tableName: splitSave.shift(),
                        fieldName: splitSave.join('.'),
                        newData: newValue
                      }],
                    reactUpd: {
                      fields: reactData.form_fields
                    }
                  });
                }}
              //             helperText={reactData.form_fields[this_formField].fieldRec.prompt.value}
              />
            </Box>
          }

          {(reactData.form_fields[this_formField].fieldRec.value.type === 'date') &&
            <Box
              display='flex'
              flexDirection='column'
              id={`dateBox__${this_formField}`}
              key={`datebox__${cFNdx}`}
              justifyContent='flex-start'
              marginLeft={0}
              paddingBottom={'16px'}
              alignItems='flex-start'
            >
              <Typography style={Object.assign({},
                {
                  margin: 0,
                  marginLeft: 0,
                  marginRight: '2px',
                  marginBottom: '8px',
                  paddingTop: '16px',
                  paddingBottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 0,
                },
                (AVATextStyle({ size: 1, bold: true })))
              }>
                {reactData.form_fields[this_formField].prompt}
              </Typography>
              <input
                type="date"
                id={`field__${cFNdx}`}
                key={`field__${cFNdx}`}
                min={reactData.form_fields[this_formField].fieldRec.prompt.min}
                max={reactData.form_fields[this_formField].fieldRec.prompt.max}
                value={(reactData.form_fields[this_formField].value)
                  ? makeDate(reactData.form_fields[this_formField].value).input
                  : ''
                }
                onChange={async (event) => {
                  if (event.target.value) {
                    let dObj = makeDate(event.target.value, { noTime: true, noYearCorrection: true });
                    if (!dObj.error) {
                      let newValue = dObj.numeric;
                      let splitSave = reactData.form_fields[this_formField].fieldRec.value.saveAs.split('.');
                      reactData.form_fields[this_formField].value = newValue;
                      await updateField({
                        updateList:
                          [{
                            tableName: splitSave.shift(),
                            fieldName: splitSave.join('.'),
                            newData: newValue
                          }],
                        reactUpd: {
                          fields: reactData.form_fields
                        }
                      });
                    }
                  }
                }}
              />
            </Box>
          }

          {(reactData.form_fields[this_formField].fieldRec.value.type === 'boolean') &&
            <Box
              display='flex'
              flexDirection='column'
              id={`switchBox__${this_formField}`}
              key={`switchbox__${cFNdx}`}
              justifyContent='flex-start'
              marginLeft={0}
              paddingBottom={0}
              alignItems='flex-start'
            >
              <Typography style={Object.assign({},
                {
                  margin: 0,
                  marginLeft: 0,
                  marginRight: '2px',
                  marginBottom: 0,
                  paddingTop: '16px',
                  paddingBottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 0,
                },
                (AVATextStyle({ size: 1, bold: true })))
              }>
                {reactData.form_fields[this_formField].prompt}
              </Typography>
              <Box flexGrow={2} display='flex' alignItems='center'
                justifyContent='flex-start' marginBottom={1} flexDirection='row'>
                <Typography
                  style={AVATextStyle({
                    size: 0.8, margin: { right: 0.8 },
                    bold: (!reactData.form_fields[this_formField].value || (typeof reactData.form_fields[this_formField].value === 'string' && reactData.form_fields[this_formField].value.toLowerCase() === 'no'))
                  })}
                >
                  {'No'}
                </Typography>
                <Switch
                  checked={(reactData.form_fields[this_formField].value && (typeof reactData.form_fields[this_formField].value !== 'string' || reactData.form_fields[this_formField].value.toLowerCase() !== 'no'))}
                  onClick={async () => {
                    const newValue = !reactData.form_fields[this_formField].value;
                    let splitSave = reactData.form_fields[this_formField].fieldRec.value.saveAs.split('.');
                    reactData.form_fields[this_formField].value = newValue;
                    await updateField({
                      updateList:
                        [{
                          tableName: splitSave.shift(),
                          fieldName: splitSave.join('.'),
                          newData: newValue
                        }],
                      reactUpd: {
                        fields: reactData.form_fields
                      }
                    });
                  }}
                  name={`field__${cFNdx}`}
                  color="primary"
                />
                <Typography
                  style={AVATextStyle({
                    size: 0.8, margin: { left: 0.8 },
                    bold: (reactData.form_fields[this_formField].value && (typeof reactData.form_fields[this_formField].value !== 'string' || reactData.form_fields[this_formField].value.toLowerCase() !== 'no'))
                  })}
                >
                  {'Yes'}
                </Typography>
              </Box>
            </Box>

          }
        </React.Fragment>
      ))
      }
    </Box >
  );
};
