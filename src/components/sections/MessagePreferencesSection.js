import React from 'react';

import Typography from '@material-ui/core/Typography';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { Box, Checkbox, IconButton, TextField, Button } from '@material-ui/core';

import { formatPhone } from '../../util/AVAPeople';
import { isEmpty, isMobile, lambda, dbClient } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import { isPushSupported, isPushOptedIn, initPushNotifications, unsubscribeFromPush, unsubscribeFromPushAllDevices, syncAlertDeliveryMethod } from '../../util/AVAPushNotifications';
import { makeTime } from '../../util/AVADateTime';

import DeleteIcon from '@material-ui/icons/Delete';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';

export default ({ currentValues, errorList, setError, updateField, updateReactData, reactData }) => {

  const AVAClass = AVAclasses();

  const profilePersonId = currentValues.peopleRec?.person_id || null;
  const isSelf = !!profilePersonId && (profilePersonId === reactData?.user_id);

  const [pushStatus, setPushStatus] = React.useState({ checked: false, activeCount: 0, optedInHere: false });

  React.useEffect(() => {
    let cancelled = false;
    async function checkPushStatus() {
      const optedInHere = isSelf ? isPushOptedIn(profilePersonId) : false;
      let activeCount = 0;
      try {
        const result = await dbClient.query({
          TableName: 'PushSubscriptions',
          IndexName: 'person-index',
          KeyConditionExpression: 'person_id = :pid',
          FilterExpression: 'sub_status = :active',
          ExpressionAttributeValues: { ':pid': profilePersonId, ':active': 'active' },
        }).promise();
        activeCount = result.Items?.length || 0;
      } catch (_) { /* silent — push status is informational only */ }
      if (!cancelled) {
        setPushStatus({ checked: true, activeCount, optedInHere });
      }
    }
    if (profilePersonId) { checkPushStatus(); }
    return () => { cancelled = true; };
  }, [profilePersonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFamilyMember = currentValues.familyRecs && currentValues.familyRecs.some(famRec => {
    return (famRec.hasOwnProperty('primary_contact'));
  }); 
  const isPrimaryContact = isFamilyMember && currentValues.familyRecs.some(famRec => {
    return (famRec?.primary_contact?.id === currentValues.peopleRec.person_id);
  });

  const messageOptions = [
    {
      option: 'ava',
      label: 'AVA',
      enabled: ' only',
      show: true,
      exclusive: true
    },
    {
      option: 'sms',
      label: `Text message`,
      enabled: (isEmpty(currentValues.peopleRec.contact_info?.cell?.number) ? false : ` to ${formatPhone(currentValues.peopleRec.contact_info.cell.number)}`),
      show: !isEmpty(currentValues.peopleRec.contact_info?.cell?.number),
      exclusive: false
    },
    {
      option: 'email',
      label: `e-Mail`,
      enabled: (isEmpty(currentValues.peopleRec.contact_info?.email?.address) ? false : ` to ${currentValues.peopleRec.contact_info.email.address}`),
      show: !isEmpty(currentValues.peopleRec.contact_info?.email?.address),
      exclusive: false
    },
    {
      option: 'alt_email',
      label: `e-Mail`,
      enabled: (isEmpty(currentValues.peopleRec.contact_info?.alt_email?.address) ? false : ` to ${currentValues.peopleRec.contact_info.alt_email.address}`),
      show: !isEmpty(currentValues.peopleRec.contact_info?.alt_email?.address),
      exclusive: false
    },
    {
      option: 'voice',
      label: `Phone call`,
      enabled: (isEmpty(currentValues.peopleRec.contact_info?.landline?.number) ? false : ` to ${formatPhone(currentValues.peopleRec.contact_info.landline.number)}`),
      show: !isEmpty(currentValues.peopleRec.contact_info?.landline?.number),
      exclusive: false
    },
    {
      option: 'voice_cell',
      label: `Phone call`,
      enabled: ` to ${formatPhone(currentValues.peopleRec.contact_info?.cell?.number)}`,
      show: !isEmpty(currentValues.peopleRec.contact_info?.cell?.number) && (currentValues.peopleRec.contact_info?.cell.number !== currentValues.peopleRec.contact_info?.landline?.number),
      exclusive: false
    },
    {
      option: 'voice_work',
      label: `Phone call`,
      enabled: ` to Work at ${formatPhone(currentValues.peopleRec.contact_info?.work?.number)}`,
      show: !isEmpty(currentValues.peopleRec.contact_info?.work?.number),
      exclusive: false
    },
    {
      option: 'text_alternate',
      label: `Text message`,
      enabled: ` to ${formatPhone(currentValues.peopleRec.contact_info?.alternate?.number)}`,
      show: !isEmpty(currentValues.peopleRec.contact_info?.alternate?.number),
      exclusive: false
    },
    {
      option: 'voice_alternate',
      label: `Phone call`,
      enabled: ` to ${formatPhone(currentValues.peopleRec.contact_info?.alternate?.number)}`,
      show: !isEmpty(currentValues.peopleRec.contact_info?.alternate?.number),
      exclusive: false
    },
    {
      option: 'family_primary',
      label: `Message`,
      enabled: ` to Primary Family Contact (${isFamilyMember ? currentValues.familyRecs[0].primary_contact.name : 'Primary Contact'})`,
      show: isFamilyMember && !isPrimaryContact,
      exclusive: false
    },
    {
      option: 'family_all',
      label: `Message`,
      enabled: ` to All Family Members`,
      show: isFamilyMember,
      exclusive: false
    }
  ];

  const proxyOptions = () => {
    let response = [{
      option: 'hold',
      label: `Hold`,
      enabled: ` all messages`,
      show: true,
      exclusive: true
    }];
    if (currentValues.peopleRec.proxy_allowed_from) {
      for (let proxy_id in currentValues.peopleRec.proxy_allowed_from) {
        response.unshift({
          option: `person_id:${proxy_id}`,
          label: `Send to `,
          enabled: currentValues.peopleRec.proxy_allowed_from[proxy_id],
          show: true,
          exclusive: false
        });
      }
    }
    return response;
  };

  const normalizeRuleDays = (dayValue) => {
    if (!dayValue) {
      return '';
    }
    const uniqueDays = Array.from(new Set(String(dayValue).split('').filter(day => /[0-6]/.test(day))));
    uniqueDays.sort();
    return uniqueDays.join('');
  };

  const getRuleRange = (rule) => {
    const start = (rule?.time_range?.start !== undefined)
      ? Number(rule.time_range.start)
      : (rule?.time_from ? makeTime(rule.time_from).numeric24 : 0);
    const end = (rule?.time_range?.end !== undefined)
      ? Number(rule.time_range.end)
      : (rule?.time_to ? makeTime(rule.time_to).numeric24 : 2359);
    return {
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : 2359
    };
  };

  const isTwentyFourSevenRule = (rule) => {
    if (!rule) {
      return false;
    }
    const normalizedDays = normalizeRuleDays(rule.day);
    const fullWeek = normalizedDays.length === 7;
    const { start, end } = getRuleRange(rule);
    return fullWeek && (start === 0) && (end === 2359);
  };

  const updateRuleScheduleWithGuard = async ({ ruleIndex, previousRuleSnapshot }) => {
    const proposedRule = currentValues.peopleRec.time_based_rules?.[ruleIndex];
    const becameTwentyFourSeven = isTwentyFourSevenRule(proposedRule) && !isTwentyFourSevenRule(previousRuleSnapshot);

    const saveRuleUpdate = async () => {
      await updateField({
        updateList:
          [{
            tableName: 'peopleRec',
            fieldName: 'time_based_rules',
            newData: currentValues.peopleRec.time_based_rules
          }]
      });
    };

    if (!becameTwentyFourSeven) {
      await saveRuleUpdate();
      return;
    }

    updateReactData({
      alert: {
        severity: 'warning',
        title: '24/7 Rule Confirmation',
        message: 'This rule will apply 24 hours a day, 7 days a week. Tap Acknowledged to continue.',
        action: [
          {
            text: 'Acknowledged',
            function: async () => {
              updateReactData({ alert: false }, true);
              await saveRuleUpdate();
            }
          }
        ]
      }
    }, true);
  };

  return (
    <Box
      key={`MessagePrefSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      <Typography
        style={AVATextStyle({ italic: true, margin: { top: 1, bottom: 0.4 } })}
      >
        {`Typically, I prefer to receive communications via...`}
      </Typography>
      <Box
        display='flex'
        flexDirection='column'
        marginLeft={-0.5}
      >
        {messageOptions.map((this_option, tIndex) => (
          this_option.show &&
          <Box
            display='flex'
            flexDirection='row'
            alignItems={'center'}
            key={`MessagePref_option__${tIndex}`}
            style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
          >
            <Checkbox
              aria-label={`MessagePref_option__${tIndex}`}
              name={`MessagePref_option__${tIndex}`}
              key={`MessagePref_option__${tIndex}`}
              size='small'
              checked={currentValues.peopleRec.preferred_methods && currentValues.peopleRec.preferred_methods.includes(this_option.option)}
              onClick={async () => {
                if (!currentValues.peopleRec.preferred_methods) {
                  currentValues.peopleRec.preferred_methods = [];
                }
                else if (!Array.isArray(currentValues.peopleRec.preferred_methods)) {
                  currentValues.peopleRec.preferred_methods = [currentValues.peopleRec.preferred_methods];
                }
                let optionAt = currentValues.peopleRec.preferred_methods.findIndex(this_method => {
                  return (this_method === this_option.option);
                });
                if (optionAt === -1) {

                  // wasn't there before; you must have clicked it ON
                  // if this is an exclusive option OR the previous option was an exclusive option, use this option only
                  if ((this_option.exclusive) || (messageOptions.some(check_option => {
                    return (check_option.exclusive && currentValues.peopleRec.preferred_methods.includes(check_option.option));
                  }
                  ))) {
                    currentValues.peopleRec.preferred_methods = [this_option.option];
                  }
                  else {
                    // otherwise, add this option to the list
                    currentValues.peopleRec.preferred_methods.push(this_option.option);
                  }
                }
                else {
                  currentValues.peopleRec.preferred_methods.splice(optionAt, 1);
                }
                await updateField({
                  updateList:
                    [{
                      tableName: 'peopleRec',
                      fieldName: 'preferred_method',
                      newData: this_option.option
                    },
                    {
                      tableName: 'peopleRec',
                      fieldName: 'preferred_methods',
                      newData: currentValues.peopleRec.preferred_methods
                    }]
                });
              }}
              disableRipple
              inputProps={{ 'aria-labelledby': `message_routing_3` }}
            />
            <Typography
              style={AVATextStyle({})}
            >
              {`${this_option.label}${this_option.enabled || ''}`}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        style={AVATextStyle({ italic: true, margin: { top: 2, bottom: 0.4 } })}
      >
        {`You may add keywords here that automatically flag an incoming message as urgent.`}
      </Typography>
      <TextField
        multiline
        style={isMobile ? AVATextStyle({ width: '90%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
        key={`key_words`}
        defaultValue={currentValues.peopleRec.urgent_keyWords || ''}
        onBlur={async (event) => {
          await updateField({
            updateList:
              [{
                tableName: 'peopleRec',
                fieldName: 'urgent_keyWords',
                newData: event.target.value
              }]
          });
        }}
        helperText='Treat a message as urgent if it contains any of these keywords'
      />

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
        {currentValues.peopleRec.time_based_rules && (currentValues.peopleRec.time_based_rules.length > 1) &&
          <Typography
            style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}
          >
            {`These rules will be evaluated in the order they appear below (the first one that matches "wins")`}
          </Typography>
        }
        <Button
          onClick={async () => {
            if (!currentValues.peopleRec.time_based_rules) {
              currentValues.peopleRec.time_based_rules = [];
            }
            currentValues.peopleRec.time_based_rules.unshift({
              name: `${(currentValues.peopleRec.name?.first ? (currentValues.peopleRec.name?.first + "'s").replace("s's", "s'") : 'My')} New Rule`,
              methods: ['ava'],
              method: 'ava',
              day: ''
            });
            await updateField({
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'time_based_rules',
                  newData: currentValues.peopleRec.time_based_rules
                }]
            });
          }}
          className={AVAClass.AVAButton}
          style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
          size='small'
        >
          {'Add a Rule'}
        </Button>

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
            {`Missing e-Mails? Tap here to check and remove ${currentValues.peopleRec.contact_info?.email?.address} from the "blocked" list.`}
          </Typography>
          <Button
            onClick={async () => {
              let params = {
                FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:RemoveUserFromSESSuppressionList',
                InvocationType: 'RequestResponse',
                LogType: 'Tail',
                Payload: ''
              };
              params.Payload = JSON.stringify({
                body: { email: currentValues.peopleRec.contact_info?.email?.address }
              });
              let invokeFailed = false;
              let fResp = await lambda
                .invoke(params)
                .promise()
                .catch(err => {
                  console.log("AVA couldn't complete the query.  Error is", JSON.stringify(err));
                  updateReactData({
                    alert: {
                      severity: 'error',
                      title: 'Sorry... There was a problem',
                      message: `We had a problem with that request.  The error is ${JSON.stringify(err)}`,
                      open: true
                    }
                  }, true);
                  invokeFailed = true;
                });
              if (!invokeFailed) {
                let fullResponse = JSON.parse(fResp.Payload);
                                  let mBody = JSON.parse(fullResponse.body);

                if (fullResponse.body.length > 0) {
                  let alert = {
                      severity: 'info',
                      title: 'Blocked List Check',
                      message: mBody.error ? `Error: ${mBody.error}` : mBody.message,
                      open: true
                    }
                  if (mBody.removed) {
                    alert.severity = 'success';
                    alert.message = `${currentValues.peopleRec.contact_info?.email?.address} has been removed from the blocked list. You should start receiving messages again shortly.`;
                  }
                  updateReactData({ alert }, true);
                }
              }
            }}
            className={AVAClass.AVAButton}
            style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
            size='small'
          >
            {'Check Blocked List'}
          </Button>
        </Box>
      </Box>

      {pushStatus.checked && (() => {
        const supported = isPushSupported();
        const denied = supported && 'Notification' in window && Notification.permission === 'denied';
        const { activeCount, optedInHere } = pushStatus;
        const otherCount = activeCount - (optedInHere ? 1 : 0);

        let deviceLine;
        if (!supported) {
          deviceLine = activeCount > 0
            ? `Alert notifications are not available on this device, but active on ${activeCount} other device${activeCount > 1 ? 's' : ''}.`
            : 'Alert notifications are not available on this device.';
        } else if (denied) {
          deviceLine = activeCount > 0
            ? `Alert notifications are blocked by your browser settings, but active on ${activeCount} other device${activeCount > 1 ? 's' : ''}.`
            : 'Alert notifications are blocked by your browser settings.';
        } else if (optedInHere) {
          deviceLine = otherCount > 0
            ? `Alert notifications are active on this device and ${otherCount} other${otherCount > 1 ? 's' : ''}.`
            : 'Alert notifications are active on this device.';
        } else {
          deviceLine = activeCount > 0
            ? `Alert notifications are active on ${activeCount} other device${activeCount > 1 ? 's' : ''}, but not this device.`
            : 'Alert notifications are not currently active on any device.';
        }

        // Syncs the 'alert' entry in preferred_methods to match whether push is active anywhere.
        // updateField keeps the in-memory state consistent with a pending Save;
        // syncAlertDeliveryMethod does a fresh DB read-modify-write so no dirty changes leak through.
        async function syncAlertPreference(willBeActiveAnywhere) {
          const methods = currentValues.peopleRec.preferred_methods || [];
          const hasAlert = methods.includes('alert');
          if (willBeActiveAnywhere && !hasAlert) {
            const newMethods = [...methods, 'alert'];
            await updateField({ updateList: [{ tableName: 'peopleRec', fieldName: 'preferred_methods', newData: newMethods }] });
          } else if (!willBeActiveAnywhere && hasAlert) {
            const newMethods = methods.filter(m => m !== 'alert');
            await updateField({ updateList: [{ tableName: 'peopleRec', fieldName: 'preferred_methods', newData: newMethods }] });
          }
          await syncAlertDeliveryMethod(profilePersonId, willBeActiveAnywhere);
        }

        const showButtons = isSelf && supported && !denied;

        return (
          <Box
            display='flex'
            flexDirection='column'
            alignItems='flex-start'
            marginTop={0}
            marginBottom={1}
          >
            <Typography style={AVATextStyle({ italic: true, margin: { bottom: 0 } })}>
              {deviceLine}
            </Typography>
            {showButtons &&
              <Box display='flex' flexDirection='row' flexWrap='wrap' style={{ gap: '8px', marginTop: '8px' }}>
                {/* Enable on this device — shown when not opted in here */}
                {!optedInHere &&
                  <Button
                    onClick={async () => {
                      const result = await initPushNotifications(profilePersonId);
                      if (result.success) {
                        const newCount = activeCount + 1;
                        setPushStatus(prev => ({ ...prev, optedInHere: true, activeCount: newCount }));
                        await syncAlertPreference(true);
                        updateReactData({ alert: { severity: 'success', message: 'Alert messaging is now enabled for your account on this device.' } }, true);
                      } else {
                        const message = result.reason === 'storage_error'
                          ? 'Push notification storage needs to be cleared. In Chrome: click the lock icon → Site settings → Clear data, then reload AVA and try again.'
                          : 'Notifications could not be enabled. Please check your browser settings and try again.';
                        updateReactData({ alert: { severity: 'warning', message } }, true);
                      }
                    }}
                    className={AVAClass.AVAButton}
                    style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                    size='small'
                  >
                    {'Enable on this device'}
                  </Button>
                }
                {/* Disable on this device — shown when opted in here */}
                {optedInHere &&
                  <Button
                    onClick={async () => {
                      await unsubscribeFromPush(profilePersonId);
                      const newCount = Math.max(0, activeCount - 1);
                      setPushStatus(prev => ({ ...prev, optedInHere: false, activeCount: newCount }));
                      await syncAlertPreference(newCount > 0);
                      updateReactData({ alert: { severity: 'info', message: 'Alert messaging has been disabled for your account on this device.' } }, true);
                    }}
                    className={AVAClass.AVAButton}
                    style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                    size='small'
                  >
                    {'Disable on this device'}
                  </Button>
                }
                {/* Disable on all devices — shown when any device is active */}
                {activeCount > 0 &&
                  <Button
                    onClick={async () => {
                      await unsubscribeFromPushAllDevices(profilePersonId);
                      setPushStatus(prev => ({ ...prev, optedInHere: false, activeCount: 0 }));
                      await syncAlertPreference(false);
                      updateReactData({ alert: { severity: 'info', message: 'Alert messaging has been disabled for your account on all devices.' } }, true);
                    }}
                    className={AVAClass.AVAButton}
                    style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
                    size='small'
                  >
                    {'Disable on all devices'}
                  </Button>
                }
              </Box>
            }
          </Box>
        );
      })()}

      <React.Fragment>
        {currentValues.peopleRec.time_based_rules
          && currentValues.peopleRec.time_based_rules.map((this_rule, i) => (
            !this_rule.global_rule &&
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
                      {this_rule.name = `${(currentValues.peopleRec.name?.first ? (currentValues.peopleRec.name?.first + "'s").replace("s's", "s'") : 'My')} Rule #${i + 1}`}
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
                    disabled={this_rule.global_rule}
                    key={`rule_name_${i}__${this_rule.name}`}
                    defaultValue={this_rule.name}
                    onBlur={async (event) => {
                      if (!currentValues.peopleRec.time_based_rules[i]) {
                        currentValues.peopleRec.time_based_rules[i] = this_rule;
                      }
                      currentValues.peopleRec.time_based_rules[i].name = event.target.value;
                      await updateField({
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'time_based_rules',
                            newData: currentValues.peopleRec.time_based_rules
                          }]
                      });
                    }}
                    helperText='Rule Name'
                  />
                </Box>
                {(!this_rule.global_rule) &&
                  <Box
                    display='flex'
                    flexDirection='row'
                    alignItems={'center'}
                    marginLeft={0.5}
                  >
                    {(i < (currentValues.peopleRec.time_based_rules.length - 1)) && (!currentValues.peopleRec.time_based_rules[i + 1].global_rule) &&
                      <IconButton
                        key={`down_button-${i}`}
                        size={'small'}
                        onClick={async () => {
                          currentValues.peopleRec.time_based_rules.splice(i, 1);
                          currentValues.peopleRec.time_based_rules.splice(i + 1, 0, this_rule);
                          let updateObj = {
                            updateList:
                              [{
                                tableName: 'peopleRec',
                                fieldName: 'time_based_rules',
                                newData: currentValues.peopleRec.time_based_rules
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
                          currentValues.peopleRec.time_based_rules.splice(i, 1);
                          currentValues.peopleRec.time_based_rules.splice(i - 1, 0, this_rule);
                          let updateObj = {
                            updateList:
                              [{
                                tableName: 'peopleRec',
                                fieldName: 'time_based_rules',
                                newData: currentValues.peopleRec.time_based_rules
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
                        currentValues.peopleRec.time_based_rules.splice(i, 1);
                        let updateObj = {
                          updateList:
                            [{
                              tableName: 'peopleRec',
                              fieldName: 'time_based_rules',
                              newData: currentValues.peopleRec.time_based_rules
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
                }
              </Box>

              <Box key={`message_times_box_${i}`}>
                <Box >
                  <TextField
                    id='startTime'
                    key={`startTime_${i}__${this_rule.time_from}`}
                    style={{ marginRight: '16px' }}
                    disabled={this_rule.global_rule}
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
                      const previousRuleSnapshot = Object.assign({}, currentValues.peopleRec.time_based_rules?.[i] || this_rule);
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
                      if (!currentValues.peopleRec.time_based_rules[i]) {
                        currentValues.peopleRec.time_based_rules[i] = this_rule;
                      }
                      currentValues.peopleRec.time_based_rules[i].time_from = from_time.time;
                      currentValues.peopleRec.time_based_rules[i].time_range = {
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
                            tableName: 'peopleRec',
                            fieldName: 'time_based_rules',
                            newData: currentValues.peopleRec.time_based_rules
                          }]
                      };
                      if (errorList.hasOwnProperty(`time_based_rules__time_from_${i}`)) {
                        updateObj.errorObj = {
                          errorField: `time_based_rules__time_from_${i}`,
                          isError: false
                        };
                        await updateField(updateObj);
                        return;
                      }
                      await updateRuleScheduleWithGuard({
                        ruleIndex: i,
                        previousRuleSnapshot
                      });
                    }}
                  />
                  <TextField
                    id='endTime'
                    key={`endTime_${i}__${this_rule.time_to}`}
                    disabled={this_rule.global_rule}
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
                      const previousRuleSnapshot = Object.assign({}, currentValues.peopleRec.time_based_rules?.[i] || this_rule);
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
                      if (!currentValues.peopleRec.time_based_rules[i]) {
                        currentValues.peopleRec.time_based_rules[i] = this_rule;
                      }
                      currentValues.peopleRec.time_based_rules[i].time_to = to_time.time;
                      currentValues.peopleRec.time_based_rules[i].time_range = {
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
                            tableName: 'peopleRec',
                            fieldName: 'time_based_rules',
                            newData: currentValues.peopleRec.time_based_rules
                          }]
                      };
                      if (errorList.hasOwnProperty(`time_based_rules__time_to_${i}`)) {
                        updateObj.errorObj = {
                          errorField: `time_based_rules__time_to_${i}`,
                          isError: false
                        };
                        await updateField(updateObj);
                        return;
                      }
                      await updateRuleScheduleWithGuard({
                        ruleIndex: i,
                        previousRuleSnapshot
                      });
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
                          checked={this_rule.day?.includes(day_num.toString()) || false}
                          name={`message_routing_${i}_${day_num}`}
                          key={`day_checkbox_${i}_${day_num}_${this_rule.day}`}
                          disableRipple
                          disabled={this_rule.global_rule}
                          size='small'
                          onClick={async () => {
                            const previousRuleSnapshot = Object.assign({}, currentValues.peopleRec.time_based_rules?.[i] || this_rule);
                            const dayErrorField = `time_based_rules__day_${i}`;
                            if (!this_rule.day) {
                              this_rule.day = '';
                            }
                            if (this_rule.day?.includes(day_num.toString())) {
                              let s = currentValues.peopleRec.time_based_rules[i].day;
                              let c = day_num.toString();
                              let l = s.replace(c, "");
                              console.log(l);
                              this_rule.day = l;
                              console.log(currentValues.peopleRec.time_based_rules[i].day);
                            }
                            else {
                              currentValues.peopleRec.time_based_rules[i].day += day_num.toString();
                            }
                            currentValues.peopleRec.time_based_rules[i].day = normalizeRuleDays(currentValues.peopleRec.time_based_rules[i].day);
                            if (!currentValues.peopleRec.time_based_rules[i].day) {
                              setError({
                                errorField: dayErrorField,
                                errorValue: '',
                                isError: true,
                                errorMessage: 'Select at least one day for this rule.'
                              });
                            }
                            else if (errorList.hasOwnProperty(dayErrorField)) {
                              setError({
                                errorField: dayErrorField,
                                isError: false
                              });
                            }
                            await updateRuleScheduleWithGuard({
                              ruleIndex: i,
                              previousRuleSnapshot
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
                {errorList.hasOwnProperty(`time_based_rules__day_${i}`) && (
                  <Typography
                    style={AVATextStyle({ margin: { left: 1.5, top: 0.25 }, size: 0.6, color: 'red' })}
                  >
                    {errorList[`time_based_rules__day_${i}`].errorMessage}
                  </Typography>
                )}
              </Box>
              <TextField
                multiline
                style={AVATextStyle({ width: '90%', margin: { top: 1 } })}
                disabled={this_rule.global_rule}
                key={`keyWords_${i}__${this_rule.keyWords}`}
                defaultValue={this_rule.keyWords || ''}
                onBlur={async (event) => {
                  if (!currentValues.peopleRec.time_based_rules[i]) {
                    currentValues.peopleRec.time_based_rules[i] = this_rule;
                  }
                  currentValues.peopleRec.time_based_rules[i].keyWords = event.target.value;
                  await updateField({
                    updateList:
                      [{
                        tableName: 'peopleRec',
                        fieldName: 'time_based_rules',
                        newData: currentValues.peopleRec.time_based_rules
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
                  disabled={this_rule.global_rule}
                  size='small'
                  checked={this_rule.when_urgent || false}
                  onClick={async () => {
                    if (!currentValues.peopleRec.time_based_rules[i]) {
                      currentValues.peopleRec.time_based_rules[i] = this_rule;
                    }
                    currentValues.peopleRec.time_based_rules[i].when_urgent = !currentValues.peopleRec.time_based_rules[i].when_urgent;
                    await updateField({
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'time_based_rules',
                          newData: currentValues.peopleRec.time_based_rules
                        }]
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
                <Typography
                  style={this_rule.global_rule
                    ? AVATextStyle({ opacity: '40%' })
                    : AVATextStyle({})
                  }
                >
                  {`During these times, only use this rule if a message is marked Urgent`}
                </Typography>
              </Box>
              <Box >
                <Typography
                  style={this_rule.global_rule
                    ? AVATextStyle({ opacity: '40%', margin: { top: 1, right: 2 } })
                    : AVATextStyle({ margin: { top: 1, right: 2 } })
                  }
                >
                  {this_rule.global_rule
                    ? `When this rule applies, adminstrators force communications via...`
                    : `When this rule applies, I prefer communications via...`
                  }
                </Typography>
                <Box
                  display='flex'
                  flexDirection='column'
                  marginLeft={-0.5}
                >
                  {(messageOptions.concat(proxyOptions())).map((this_option, tIndex) => (
                    this_option.show &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      alignItems={'center'}
                      key={`MessagePref_option__${tIndex}`}
                      style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                    >
                      <Checkbox
                        aria-label={`MessagePref_option__${tIndex}`}
                        name={`MessagePref_option__${tIndex}`}
                        key={`MessagePref_option__${tIndex}`}
                        disabled={this_rule.global_rule}
                        size='small'
                        checked={(this_rule.methods
                          ? this_rule.methods.includes(this_option.option)
                          : (this_rule.method
                            ? (this_rule.method === this_option.option)
                            : (currentValues.peopleRec.preferred_methods && currentValues.peopleRec.preferred_methods.includes(this_option.option)))
                        )}
                        onClick={async () => {
                          if (!this_rule.methods) {
                            this_rule.methods = (this_rule.method
                              ? [this_rule.method]
                              : currentValues.peopleRec.preferred_methods);
                          }
                          let optionAt = this_rule.methods.findIndex(this_method => {
                            return (this_method === this_option.option);
                          });
                          if (optionAt === -1) {
                            // wasn't there before; you must have clicked it ON
                            if (this_option.exclusive) {
                              currentValues.peopleRec.time_based_rules[i].methods = [this_option.option];
                            }
                            else {
                              // have to turn off any exclusive option that was previously on
                              let previous_option = messageOptions.find(check_option => {
                                return (check_option.option === this_rule.method);
                              });
                              if (this_rule.method === 'hold' || previous_option?.exclusive) {
                                currentValues.peopleRec.time_based_rules[i].methods = [this_option.option];
                              }
                              else {
                                currentValues.peopleRec.time_based_rules[i].methods.push(this_option.option);
                              }
                            }
                            currentValues.peopleRec.time_based_rules[i].method = this_option.option;   // older style, single method only
                          }
                          else {
                            // was there before; you must have clicked it OFF
                            if (this_rule.methods.length === 1) {
                              // nothing is left?
                              currentValues.peopleRec.time_based_rules[i].methods = currentValues.peopleRec.preferred_methods;
                              currentValues.peopleRec.time_based_rules[i].method = currentValues.peopleRec.preferred_methods[0];
                            }
                            else {
                              currentValues.peopleRec.time_based_rules[i].methods.splice(optionAt, 1);
                              currentValues.peopleRec.time_based_rules[i].method = this_rule.methods[this_rule.methods.length - 1];
                            }
                          }
                          await updateField({
                            updateList:
                              [{
                                tableName: 'peopleRec',
                                fieldName: 'time_based_rules',
                                newData: currentValues.peopleRec.time_based_rules
                              }]
                          });
                        }}
                        disableRipple
                        inputProps={{ 'aria-labelledby': `message_routing_3` }}
                      />
                      <Typography
                        style={this_rule.global_rule
                          ? AVATextStyle({ opacity: '40%' })
                          : AVATextStyle({})
                        }
                      >
                        {`${this_option.label}${this_option.enabled || ''}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                justifyItems={'end'}
              >
                <Typography
                  style={this_rule.global_rule
                    ? AVATextStyle({ opacity: '40%', size: 0.5, margin: { top: 1 } })
                    : AVATextStyle({ size: 0.5, margin: { top: 1 } })
                  }
                >
                  {`Rule ID: ${this_rule.rule_id}`}
                </Typography>
              </Box>
            </Box>
          ))}
      </React.Fragment>
    </Box >
  );
};
