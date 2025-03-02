import React from 'react';

import Typography from '@material-ui/core/Typography';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { Box, Checkbox, IconButton, TextField, Button } from '@material-ui/core';

import QuickSearch from './QuickSearch';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import { makeTime } from '../../util/AVADateTime';
import { listFromArray } from '../../util/AVAUtilities';

import DeleteIcon from '@material-ui/icons/Delete';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';

export default ({ currentValues, errorList, setError, updateField, updateReactData, reactData }) => {

  const AVAClass = AVAclasses();

  const messageOptions = [
    {
      option: 'hold',
      label: `Hold all messages - message will be sent at the end of the rule's time window`,
      exclusive: false,
      withPeopleList: false
    },
    {
      option: 'block',
      label: `Block all messages - this message will not be sent`,
      exclusive: true,
      withPeopleList: false
    },
    {
      option: 'replace_recipients',
      label: `Send to these recipients instead of the original addressee`,
      exclusive: false,
      withPeopleList: true
    },
    {
      option: 'add_recipients',
      label: `Send to these recipients in addition to the original addressee`,
      exclusive: false,
      withPeopleList: true
    },
    {
      option: 'add_replyTo',
      label: `Add these recipients to the "reply to" list`,
      exclusive: false,
      withPeopleList: true
    }
  ];


  function searchButtonText() {
    if (reactData.selections.length === 0) {
      return 'Exit';
    }
    if (reactData.selections.length > 1) {
      return `Select ${reactData.selections.reduce((total, this_selection) => {
        return (this_selection.peopleList ? (total + this_selection.peopleList.length) : (total + 1));
      }, 0)} people`;
    }
    // options below if only one item selected
    if (reactData.selections[0].hasOwnProperty('person_id')) {
      return `Select ${reactData.selections[0].person_name.split(' ')[0]}`;
    }
    else {
      return `Select`;
    }
  }

  function groupButtonText() {
    if (reactData.selections.length === 0) {
      return 'Exit';
    }
    if (reactData.selections.length > 1) {
      return `Select ${reactData.selections.length} groups`;
    }
    // options below if only one item selected
    if (reactData.selections[0].hasOwnProperty('group_id')) {
      return `Select ${reactData.selections[0].group_name}`;
    }
    else {
      return `Select`;
    }
  }

  return (
    <Box
      key={`MessagePrefSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >

      <Box
        display='flex'
        flexDirection='column'
        alignItems={'flex-start'}
        marginTop={2}
        marginBottom={1}
      >
        <Typography
          style={AVATextStyle({ italic: true, margin: { bottom: 0 } })}
        >
          {`Use Rules to set alternate delivery options based on content, urgency, time of day, and day of week`}
        </Typography>
        {currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules && (currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.length > 1) &&
          <Typography
            style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}
          >
            {`These rules will be evaluated in the order they appear below (the first one that matches "wins")`}
          </Typography>
        }
        <Button
          onClick={async () => {
            if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules) {
              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules = [];
            }
            currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.unshift({
              name: `${currentValues.customizationRecs.client_name?.customization_value} Global Rule #${currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.length + 1}`,
              methods: [],
            });
            await updateField({
              updateList:
                [{
                  tableName: 'customizationRecs',
                  fieldName: 'global_mail_rules.customization_value.time_based_rules',
                  newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                }]
            });
          }}
          className={AVAClass.AVAButton}
          style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
          size='small'
        >
          {'Add a Rule'}
        </Button>
      </Box>

      <React.Fragment>
        {currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
          && currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.map((this_rule, i) => (
            <Box
              style={{
                borderRadius: '30px 30px 30px 30px',
              }}
              border={1}
              p={2}
              marginBottom={1}
              maxWidth={'95%'}
              display='flex' flexDirection='column' key={`message_fragment_${i}`}
            >
              <Box key={`header_message_${i}`}
                display='flex' flexDirection='row'
                flexWrap={'noWrap'}
                marginTop={1}
                marginBottom={1}
                alignItems={'center'}
                justifyContent={'space-between'}
              >
                <Box sx={{ display: 'none', visibility: 'hidden' }} >
                  {!this_rule.rule_id &&
                    <Typography>
                      {this_rule.rule_id = `${new Date().getTime()}_${i}`}
                    </Typography>
                  }
                  {!this_rule.name &&
                    <Typography>
                      {this_rule.name = `${currentValues.customizationRecs.client_name?.customization_value} Global Rule #${i + 1}`}
                    </Typography>
                  }
                </Box>
                <Box
                  display='flex'
                  flexDirection='row'
                  flexGrow={1}
                >
                  <TextField
                    id='ruleName'
                    style={{ width: '-webkit-fill-available' }}
                    key={`rule_name_${i}__${this_rule.name}`}
                    defaultValue={this_rule.name}
                    onBlur={async (event) => {
                      if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                      }
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].name = event.target.value;
                      await updateField({
                        updateList:
                          [{
                            tableName: 'customizationRecs',
                            fieldName: 'global_mail_rules.customization_value.time_based_rules',
                            newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                          }]
                      });
                    }}
                    helperText='Rule Name'
                  />
                </Box>
                <Box
                  display='flex'
                  flexDirection='row'
                  alignItems={'center'}
                  marginLeft={0.5}
                >
                  {(i < (currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.length - 1)) &&
                    <IconButton
                      key={`down_button-${i}`}
                      size={'small'}
                      onClick={async () => {
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.splice(i, 1);
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.splice(i + 1, 0, this_rule);
                        let updateObj = {
                          updateList:
                            [{
                              tableName: 'customizationRecs',
                              fieldName: 'global_mail_rules.customization_value.time_based_rules',
                              newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                            }]
                        };
                        await updateField(updateObj);
                      }}
                    >
                      <ArrowDownwardIcon size={'small'} />
                    </IconButton>
                  }
                  {(i > 0) &&
                    <IconButton
                      key={`up_button-${i}`}
                      size={'small'}
                      onClick={async () => {
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.splice(i, 1);
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.splice(i - 1, 0, this_rule);
                        let updateObj = {
                          updateList:
                            [{
                              tableName: 'customizationRecs',
                              fieldName: 'global_mail_rules.customization_value.time_based_rules',
                              newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                            }]
                        };
                        await updateField(updateObj);
                      }}
                    >
                      <ArrowUpwardIcon size={'small'} />
                    </IconButton>
                  }
                  <IconButton
                    key={`delete_button-${i}`}
                    size={'small'}
                    onClick={async () => {
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules.splice(i, 1);
                      let updateObj = {
                        updateList:
                          [{
                            tableName: 'customizationRecs',
                            fieldName: 'global_mail_rules.customization_value.time_based_rules',
                            newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                          }]
                      };
                      let instructions = [];
                      for (let errorField in errorList) {
                        if (errorField.startsWith('time_based_rules__')) {
                          const errorIndex = Number(errorField.split(/.*(?:_|^)(.*)/gm)[1]);
                          if (errorIndex >= i) {
                            instructions.unshift({
                              errorField,
                              isError: false
                            });
                          }
                          if (errorIndex > i) {
                            instructions.push(Object.assign({},
                              errorList[errorField],
                              { errorField: errorField.replace(`_${errorIndex}`, `_${errorIndex - 1}`) }
                            ));
                          }
                        }
                      }
                      if (instructions.length > 0) {
                        updateObj.errorObj = instructions;
                      }
                      await updateField(updateObj);
                    }}
                  >
                    <DeleteIcon size={'small'} />
                  </IconButton>
                </Box>
              </Box>

              <Box key={`message_times_box_${i}`}>
                <Box >
                  <TextField
                    id='startTime'
                    key={`startTime_${i}__${this_rule.time_from}`}
                    style={{ marginRight: '16px' }}
                    error={errorList.hasOwnProperty(`time_based_rules__time_from_${i}`)}
                    helperText={errorList.hasOwnProperty(`time_based_rules__time_from_${i}`)
                      ? errorList[`time_based_rules__time_from_${i}`].errorMessage
                      : 'From time'
                    }
                    defaultValue={errorList.hasOwnProperty(`time_based_rules__time_from_${i}`)
                      ? errorList[`time_based_rules__time_from_${i}`].errorValue
                      : (this_rule.time_from
                        ? makeTime(this_rule.time_from).time
                        : '12:00 am')
                    }
                    onBlur={async (event) => {
                      let from_time = makeTime(event.target.value);
                      if (from_time.error || from_time.empty) {
                        // This is an error.
                        setError({
                          errorField: `time_based_rules__time_from_${i}`,
                          errorValue: event.target.value,
                          isError: true,
                          errorMessage: `${event.target.value} is not valid`
                        });
                        return;
                      }
                      if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                      }
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].time_from = from_time.time;
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].time_range = {
                        start: from_time.numeric24,
                        end: (this_rule.time_range?.end
                          ? this_rule.time_range.end
                          : (this_rule.time_to
                            ? makeTime(this_rule.time_to).numeric24
                            : 2359)
                        )
                      };
                      let updateObj = {
                        updateList:
                          [{
                            tableName: 'customizationRecs',
                            fieldName: 'global_mail_rules.customization_value.time_based_rules',
                            newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                          }]
                      };
                      if (errorList.hasOwnProperty(`time_based_rules__time_from_${i}`)) {
                        updateObj.errorObj = {
                          errorField: `time_based_rules__time_from_${i}`,
                          isError: false
                        };
                      }
                      await updateField(updateObj);
                    }}
                  />
                  <TextField
                    id='endTime'
                    key={`endTime_${i}__${this_rule.time_to}`}
                    error={errorList.hasOwnProperty(`time_based_rules__time_to_${i}`)}
                    helperText={errorList.hasOwnProperty(`time_based_rules__time_to_${i}`)
                      ? errorList[`time_based_rules__time_to_${i}`].errorMessage
                      : 'To time'
                    }
                    defaultValue={errorList.hasOwnProperty(`time_based_rules__time_to_${i}`)
                      ? errorList[`time_based_rules__time_to_${i}`].errorValue
                      : (this_rule.time_to
                        ? makeTime(this_rule.time_to).time
                        : '11:59 pm')
                    }
                    onBlur={async (event) => {
                      let to_time = makeTime(event.target.value);
                      if (to_time.error || to_time.empty) {
                        // This is an error.
                        setError({
                          errorField: `time_based_rules__time_to_${i}`,
                          errorValue: event.target.value,
                          isError: true,
                          errorMessage: `${event.target.value} is not valid`
                        });
                        return;
                      }
                      if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                        currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                      }
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].time_to = to_time.time;
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].time_range = {
                        end: to_time.numeric24,
                        start: (this_rule.time_range?.start
                          ? this_rule.time_range.start
                          : (this_rule.time_from
                            ? makeTime(this_rule.time_from).numeric24
                            : 0)
                        )
                      };
                      let updateObj = {
                        updateList:
                          [{
                            tableName: 'customizationRecs',
                            fieldName: 'global_mail_rules.customization_value.time_based_rules',
                            newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                          }]
                      };
                      if (errorList.hasOwnProperty(`time_based_rules__time_to_${i}`)) {
                        updateObj.errorObj = {
                          errorField: `time_based_rules__time_to_${i}`,
                          isError: false
                        };
                      }
                      await updateField(updateObj);
                    }}
                  />
                </Box>
                <Box marginLeft={1.5} key={`day_box_${i}__${this_rule.day}`} display={'flex'} flexDirection={'row'} >
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((this_day, day_num) => (
                    <FormControlLabel
                      style={AVATextStyle({ margin: { left: -1 } })}
                      key={`day_control_${i}__${day_num}_${this_rule.day}`}
                      control={
                        <Checkbox
                          checked={this_rule.day?.includes(day_num.toString()) || !this_rule.day}
                          name={`message_routing_${i}_${day_num}`}
                          key={`day_checkbox_${i}_${day_num}_${this_rule.day}`}
                          disableRipple
                          size='small'
                          onClick={async () => {
                            if (!this_rule.day) {
                              this_rule.day = '';
                            }
                            if (this_rule.day?.includes(day_num.toString())) {
                              let s = currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].day;
                              let c = day_num.toString();
                              let l = s.replace(c, "");
                              this_rule.day = l;
                            }
                            else {
                              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].day += day_num.toString();
                            }
                            await updateField({
                              updateList:
                                [{
                                  tableName: 'customizationRecs',
                                  fieldName: 'global_mail_rules.customization_value.time_based_rules',
                                  newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                                }]
                            });
                          }}
                          inputProps={{ 'aria-labelledby': `message_routing_${i}_${day_num}` }}
                        />
                      }
                      label={
                        <Typography
                          style={AVATextStyle({ margin: { left: 0 }, size: 0.6 })}
                        >
                          {this_day}
                        </Typography>}
                      labelPlacement='bottom'
                    />
                  ))}
                </Box>
              </Box>
              <TextField
                multiline
                style={AVATextStyle({ width: '90%', margin: { top: 1 } })}
                key={`keyWords_${i}__${this_rule.keyWords}`}
                defaultValue={this_rule.keyWords || ''}
                onBlur={async (event) => {
                  if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                    currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                  }
                  currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].keyWords = event.target.value;
                  await updateField({
                    updateList:
                      [{
                        tableName: 'customizationRecs',
                        fieldName: 'global_mail_rules.customization_value.time_based_rules',
                        newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                      }]
                  });
                }}
                helperText='During these times, only use this rule if a message contains any of these keywords'
              />



              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`urgent_option__${i}`}
                style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', marginLeft: '-12px', textWrapStyle: 'balance' }}
              >
                <Checkbox
                  aria-label={`urgent_checkbox__${i}`}
                  name={`urgent_checkbox__${i}`}
                  key={`urgent_checkbox__${i}`}
                  size='small'
                  checked={this_rule.when_urgent || false}
                  onClick={async () => {
                    if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                    }
                    currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].when_urgent = !currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].when_urgent;
                    await updateField({
                      updateList:
                        [{
                          tableName: 'customizationRecs',
                          fieldName: 'global_mail_rules.customization_value.time_based_rules',
                          newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                        }]
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
                <Typography
                  style={AVATextStyle({})}
                >
                  {`During these times, only use this rule if a message is marked Urgent`}
                </Typography>
              </Box>










              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`groupOption__${i}`}
                style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', marginLeft: '-12px', textWrapStyle: 'balance' }}
              >
                <Checkbox
                  aria-label={`groupList_checkbox__${i}`}
                  name={`groupList_checkbox__${i}`}
                  key={`groupList_checkbox__${i}`}
                  size='small'
                  checked={(this_rule.groupList && (this_rule.groupList.length > 0)) || false}
                  onClick={async () => {
                    if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i]) {
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i] = this_rule;
                    }
                    if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].groupList) {
                      currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].groupList = [];
                    }
                    await updateField({
                      updateList:
                        [{
                          tableName: 'customizationRecs',
                          fieldName: 'global_mail_rules.customization_value.time_based_rules',
                          newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                        }]
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `groupList_checkbox_3` }}
                />
                <Box
                  display='flex'
                  flexDirection='column'
                  alignItems={'flex-start'}
                  key={`GroupList_header__${i}`}
                  style={{ textWrapStyle: 'balance' }}
                >
                  <Typography
                    style={AVATextStyle({})}
                  >
                    {`Use this rule if the Addressee is a member of one of these selected Groups:`}
                  </Typography>
                  <Box display='flex'
                    key={'newMessage_r6names'}
                    flexDirection='column'
                    flexWrap={'wrap'}
                    alignContent={'flex-start'}
                    onClick={() => {
                      updateReactData({
                        showRuleGroupsQuickSearch: true,
                        showGroupList: true,
                        ruleIndex: i,
                        linkedPersonFilter: '',
                        selections: (this_rule.groupList
                          ? (this_rule.groupList.map((this_group, pX) => {
                            return { group_id: this_group, group_name: this_rule.groupNames[pX] };
                          }))
                          : []
                        )
                      }, true);
                    }}
                  >
                    {(this_rule.hasOwnProperty('groupList')
                      && (this_rule.groupList.length > 0)) &&
                      <Typography
                        style={AVATextStyle({ margin: { left: 1 }, size: 0.8, bold: true })}
                        key={`showGroups__${this_rule.groupList.length}`}
                      >
                        {(this_rule.groupList.length > 3)
                          ? (`${this_rule.groupList.length} groups`)
                          : (`${listFromArray(this_rule.groupNames, {or: true})}`)
                        }
                      </Typography>
                    }
                    <Typography
                      style={AVATextStyle({ margin: { left: 1 }, size: 0.8 })}
                    >
                      {(!this_rule.hasOwnProperty('groupList')
                        || this_rule.groupList.length === 0)
                        ? '(Tap here to select Groups)'
                        : `(Tap here to add/change Groups)`
                      }
                    </Typography>
                  </Box>
                </Box>


              </Box>
              <Box >
                <Typography
                  style={AVATextStyle({ margin: { top: 2, right: 2, bottom: 0.5 } })}
                >
                  {`When this rule applies, the system will automatically...`}
                </Typography>
                <Box
                  display='flex'
                  flexDirection='column'
                  marginLeft={-0.5}
                >
                  {messageOptions.map((this_option, tIndex) => (
                    <Box
                      display='flex'
                      flexDirection='row'
                      alignItems={'center'}
                      key={`MessagePref_option__${tIndex}`}
                      style={{ paddingTop: '6px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                    >
                      <Checkbox
                        aria-label={`MessagePref_option__${tIndex}`}
                        name={`MessagePref_option__${tIndex}`}
                        key={`MessagePref_option__${tIndex}`}
                        size='small'
                        checked={(this_rule.methods && this_rule.methods.includes(this_option.option))}
                        onClick={async () => {
                          if (!this_rule.methods) {
                            this_rule.methods = [];
                          }
                          let optionAt = this_rule.methods.findIndex(this_method => {
                            return (this_method === this_option.option);
                          });
                          if (optionAt === -1) {
                            // wasn't there before; you must have clicked it ON
                            if (this_option.exclusive) {
                              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].methods = [this_option.option];
                            }
                            else {
                              // have to turn off any exclusive option that was previously on
                              let previous_option = messageOptions.find(check_option => {
                                return (this_rule.methods[0] === check_option.option);
                              });
                              if (previous_option && (previous_option.option === 'hold' || previous_option.exclusive)) {
                                currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].methods = [this_option.option];
                              }
                              else {
                                currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].methods.push(this_option.option);
                              }
                            }
                          }
                          else {
                            // was there before; you must have clicked it OFF
                            if (this_rule.methods.length === 1) {
                              // nothing is left?
                              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].methods = [];
                            }
                            else {
                              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[i].methods.splice(optionAt, 1);
                            }
                          }
                          await updateField({
                            updateList:
                              [{
                                tableName: 'customizationRecs',
                                fieldName: 'global_mail_rules.customization_value.time_based_rules',
                                newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                              }]
                          });
                        }}
                        disableRipple
                        inputProps={{ 'aria-labelledby': `message_routing_3` }}
                      />
                      <Box
                        display='flex'
                        flexDirection='column'
                        alignItems={'flex-start'}
                        key={`MessagePref_details__${tIndex}`}
                        style={{ textWrapStyle: 'balance' }}
                      >
                        <Typography
                          style={AVATextStyle({})}
                        >
                          {`${this_option.label}${this_option.enabled || ''}`}
                        </Typography>





                        {this_option.withPeopleList &&
                          <Box display='flex'
                            key={'newMessage_r6names'}
                            flexDirection='column'
                            flexWrap={'wrap'}
                            alignContent={'flex-start'}
                            onClick={() => {
                              updateReactData({
                                showRulesQuickSearch: true,
                                ruleIndex: i,
                                linkedPersonFilter: '',
                                selectedOption: this_option.option,
                                selections: (this_rule.hasOwnProperty(this_option.option)
                                  ? (this_rule[this_option.option].peopleList.map((this_person, pX) => {
                                    return { person_id: this_person, person_name: this_rule[this_option.option].peopleNames[pX] };
                                  }))
                                  : []
                                )
                              }, true);
                            }}
                          >
                            {(this_rule.hasOwnProperty(this_option.option)
                              && this_rule[this_option.option].hasOwnProperty('peopleList')
                              && this_rule[this_option.option].peopleList.length > 0) &&
                              <Typography
                                style={AVATextStyle({ margin: { left: 1 }, size: 0.8, bold: true })}
                                key={`showNames__${this_rule[this_option.option].peopleList.length}`}
                              >
                                {(this_rule[this_option.option].peopleList.length > 4)
                                  ? (`${this_rule[this_option.option].peopleList.length} recipients`)
                                  : (`${listFromArray(this_rule[this_option.option].peopleNames)}`)
                                }
                              </Typography>
                            }
                            <Typography
                              style={AVATextStyle({ margin: { left: 1 }, size: 0.8 })}
                            >
                              {(!this_rule.hasOwnProperty(this_option.option)
                                || !this_rule[this_option.option].hasOwnProperty('peopleList')
                                || this_rule[this_option.option].peopleList.length === 0)
                                ? '(Tap here to select Recipients)'
                                : `(Tap here to add/change Recipients)`
                              }
                            </Typography>
                          </Box>
                        }
                      </Box>


                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                justifyItems={'end'}
              >
                <Typography
                  style={AVATextStyle({ size: 0.5, margin: { top: 1 } })}
                >
                  {`Rule ID: ${this_rule.rule_id}`}
                </Typography>
              </Box>
            </Box>
          ))}



        {reactData.showRulesQuickSearch &&
          <QuickSearch
            reactData={reactData}
            updateReactData={updateReactData}
            options={{
              pickAndGo: true,
              withSpecialValues: true,
              keepSelections: true,
              showAll: true,
              buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
              buttonText: searchButtonText()
            }}
            onClose={async (selections) => {
              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex][reactData.selectedOption] =
              {
                peopleList: [],
                peopleNames: []
              };
              if (selections.length > 0) {
                if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].hasOwnProperty('methods')) {
                  currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].methods = [reactData.selectedOption];
                }
                else if (!currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].methods.includes(reactData.selectedOption)) {
                  currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].methods.push(reactData.selectedOption);
                }
                for (const this_selection of selections) {
                  currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex][reactData.selectedOption].peopleList.push(this_selection.person_id);
                  currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex][reactData.selectedOption].peopleNames.push(this_selection.person_name);
                }
              }             
              
              await updateField({
                updateList:
                  [{
                    tableName: 'customizationRecs',
                    fieldName: 'global_mail_rules.customization_value.time_based_rules',
                    newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                  }],
                reactUpd: {
                  showRulesQuickSearch: false,
                  changesMade: true
                }
              });
            }}
          />
        }

        {reactData.showRuleGroupsQuickSearch &&
          <QuickSearch
            reactData={reactData}
            updateReactData={updateReactData}
            options={{
              pickAndGo: true,
              withGroups: true,
              hidePeople: true,
              showAll: true,
              keepSelections: true,
              buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
              buttonText: groupButtonText()
            }}
            onClose={async (selections) => {
              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].groupList = [];
              currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].groupNames = [];
              if (selections.length > 0) {
                for (const this_selection of selections) {
                  if (this_selection.hasOwnProperty('group_id')) {
                    currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].groupList.push(this_selection.group_id);
                    currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules[reactData.ruleIndex].groupNames.push(this_selection.group_name);
                  }
                }
              }
              await updateField({
                updateList:
                  [{
                    tableName: 'customizationRecs',
                    fieldName: 'global_mail_rules.customization_value.time_based_rules',
                    newData: currentValues.customizationRecs.global_mail_rules.customization_value.time_based_rules
                  }],
                reactUpd: {
                  showRuleGroupsQuickSearch: false,
                  showGroupList: false,
                  changesMade: true
                }
              });
            }}
          />
        }





      </React.Fragment>
    </Box>
  );
};
