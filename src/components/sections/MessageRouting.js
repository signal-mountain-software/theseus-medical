import React from 'react';
import Paper from '@material-ui/core/Paper';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TimePicker from 'react-time-picker';

import Input from '@material-ui/core/Input';

import Typography from '@material-ui/core/Typography';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';

import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import DeleteIcon from '@material-ui/icons/Delete';

import RadioGroup from '@material-ui/core/RadioGroup';

import Section from '../Section';

const useStyles = makeStyles(theme => ({
  container: {
    flexGrow: 1,
    marginLeft: '-24px',
    marginRight: '-24px',
    marginTop: '-12px',
    marginBottom: theme.spacing(2)
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  formControlFrom: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  formControlOn: {
    margin: 0,
    paddingTop: 0,
    marginRight: theme.spacing(1),
    height: theme.spacing(2.5),
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formControlDayRow: {
    display: 'flex',
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1)
  },
  formControlTo: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing(1)
  },
  formControlDays: {
    margin: 0,
    marginLeft: '-8px',
    marginRight: '2px',
    paddingTop: 0,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0
  },
  centerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -12
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  idText: {
    display: 'inline',
    marginTop: -5,
    marginRight: theme.spacing(1),
  },
  idTextNoSpacing: {
    display: 'inline',
  },
  inputRule: {
    display: 'inline',
    fontSize: theme.typography.fontSize * 0.8,
    padding: 0,
    maxWidth: theme.spacing(3),
    margin: 0,
  },
  inputRuleWide: {
    display: 'inline',
    fontSize: theme.typography.fontSize * 0.8,
    padding: 0,
    maxWidth: theme.spacing(30),
    margin: 0,
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    fontSize: theme.typography.fontSize * 0.8,
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    outline: '1px solid black',
    size: 'small',
    fontSize: theme.typography.fontSize * 0.8,
    color: theme.palette.reject[theme.palette.type],
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextNoSpacing: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 2,
  },
  radioDays: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 2,
    marginLeft: 0,
  },
  radioTextBold: {
    fontSize: theme.typography.fontSize * 0.8,
    fontWeight: 'bold',
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextHeader: {
    fontSize: theme.typography.fontSize * 0.8,
    fontWeight: 'bold',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 10,
  },
  fullBody: {
    marginLeft: theme.spacing(2),
  },
  radioTextBig: {
    fontSize: theme.typography.fontSize * 1.2,
    fontWeight: 'bold',
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  topicBox: {
    marginTop: theme.spacing(2),
  },
  buttonBox: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderBottom: '2px solid'
  },
  topicBoxwithHoverBorder: {
    marginTop: theme.spacing(2),
    padding: 2,
    '&:hover': {
      border: '2px solid',
    },
  },
  radioTextTop: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginTop: theme.spacing(1.5),
    paddingLeft: 0,
    paddingRight: 0,
  },
  radioTextTopRight: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
    marginTop: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
  },
  radioTextRight: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default ({ person, updateSetChange, onChangeMethod, onChangeEscalationType, onChangeWaitTime, onChangeKeyWords, onChangeEscalationData, numRows, session }) => {
  const classes = useStyles();
  let waitTime;
  let escalationData;
  let keyWords;
  let keyWordData;

  let l = person.time_based_rules?.length || 0;
  if (l === 0) {
    person.time_based_rules = [
      {
        'time_to': null,
        'method': ' ',
        'time_from': null,
        'day': ''
      },
      {
        'method': person.preferred_method
      }
    ];

  }

  const [ruleRows, setRuleRows] = React.useState(person.time_based_rules || []);
  const [lastEntry, setLastEntry] = React.useState((person.time_based_rules?.length || 1) - 1);
  const [viewVersion, setViewVersion] = React.useState(1);
  const [linkedAccounts, setLinkedAccounts] = React.useState([]);

  const handleAddRule = () => {
    person.time_based_rules.splice(lastEntry, 0,
      {
        'time_to': null,
        'method': ' ',
        'time_from': null,
        'day': ''
      });
    setLastEntry(lastEntry + 1);
    setRuleRows(person.time_based_rules);
    updateSetChange();
  };

  const handleRemoveRule = (pIndex) => {
    person.time_based_rules.splice(pIndex, 1);
    setLastEntry(lastEntry - 1);
    setRuleRows(person.time_based_rules);
    updateSetChange();
  };

  const handleChangeEscalationType = tableRow => event => {
    person.time_based_rules[tableRow].escalationType = event.target.value;
    person.time_based_rules[tableRow].escalationData = '';
    if (event.target.value === 'altID') { getLinkedAccounts(); }
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const handleChangeMethod = tableRow => event => {
    person.time_based_rules[tableRow].method = event.target.value;
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const handleChangeKeyWordType = tableRow => event => {
    person.time_based_rules[tableRow].keyWordType = event.target.value;
    person.time_based_rules[tableRow].keyWordData = '';
    if (event.target.value === 'altID') { getLinkedAccounts(); }
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const handleChangeEscalationData = tableRow => event => {
    person.time_based_rules[tableRow].escalationData = event.target.value;
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const handleChangeKeyWordData = tableRow => event => {
    person.time_based_rules[tableRow].keyWordData = event.target.value;
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const onChangeFromTime = tableRow => event => {
    person.time_based_rules[tableRow].time_from = event;
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const onChangeToTime = tableRow => event => {
    person.time_based_rules[tableRow].time_to = event;
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const updateRoutingDay = (tableRow, dayValue, removeEntry) => {
    if (removeEntry) {
      let newString = person.time_based_rules[tableRow].day.replace(dayValue, '');
      person.time_based_rules[tableRow].day = newString;
    }
    else { person.time_based_rules[tableRow].day += dayValue; };
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  async function getLinkedAccounts() {
    if (!linkedAccounts || (linkedAccounts.length === 0)) {
      let respArray = [];
      if (session) {
        if (!session.hasOwnProperty('responsible_for') || !session.responsible_for) { }
        else if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
        else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
        else { respArray.push(session.responsible_for); }
      };
      let accountArray = [];
      for (let r = 0; r < respArray.length; r++) {
        let p = respArray[r];
        let pR = await dbClient
          .get({
            Key: { person_id: p },
            TableName: "People"
          })
          .promise()
          .catch(error => {
            console.log({ 'Bad get on People - caught error is': error });
          });
        if (pR && pR.Item && pR.Item.name) { accountArray.push(`${pR.Item.name.first} ${pR.Item.name.last} (${p})`); }
      };
      setLinkedAccounts(accountArray);
    }
  }

  return (
    <Section title='Message Delivery' outlined>
      <Box className={classes.container} component={Paper}>
        {(person && viewVersion > 0) &&
          <React.Fragment>
            {ruleRows.map((route, i) => (
              <Box display='flex' flexDirection='column' className={classes.fullBody} key={`message_fragment_${i}`}>
                {(i < lastEntry) &&
                  <Box key={`header_message_${i}`}>
                    <Typography className={classes.radioTextHeader}>{`Message Handling Rule ${i + 1}`}</Typography>
                    <Box >
                      <FormControl className={classes.formControl} component="fieldset">
                        <FormGroup row aria-label={`message_route_${i}_method`} name="method">
                          <FormControlLabel
                            className={classes.formControlFrom}
                            value="AVA"
                            control={
                              <TimePicker
                                value={route.time_from || '0:00'}
                                clearIcon={null}
                                clockIcon={null}
                                disableClock={true}
                                onChange={onChangeFromTime(i)}
                              />
                            }
                            label={<Typography className={classes.radioText}>From</Typography>}
                            labelPlacement='start'
                          />
                          <FormControlLabel
                            className={classes.formControlTo}
                            value="AVA"
                            control={
                              <TimePicker
                                value={route.time_to || '23:59'}
                                clearIcon={null}
                                clockIcon={null}
                                disableClock={true}
                                onChange={onChangeToTime(i)}
                              />
                            }
                            label={<Typography className={classes.radioText}>To</Typography>}
                            labelPlacement='start'
                          />
                        </FormGroup>
                      </FormControl>
                    </Box>
                    <Box display={'flex'}  flexDirection={'row'} className={classes.formControlDayRow} flexWrap={'wrap'} >
                      <FormControl className={classes.formControl} component="fieldset">
                        <FormGroup row aria-label={`message_routedays_${i}_method`} name="method">
                          <FormControlLabel
                            className={classes.formControlDays}
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('0')}
                                name={`message_routing_${i}_0`}
                                disableRipple
                                onChange={() => updateRoutingDay(i, '0', route?.day?.includes('0'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_0` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Sun</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('1')}
                                name={`message_routing_${i}_1`}
                                disableRipple
                                onClick={() => updateRoutingDay(i, '1', route?.day?.includes('1'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_1` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Mon</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            value="AVA"
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('2')}
                                name={`message_routing_${i}_2`}
                                disableRipple
                                onChange={() => updateRoutingDay(i, '2', route?.day?.includes('2'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_2` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Tue</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            value="AVA"
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('3')}
                                name={`message_routing_${i}_3`}
                                disableRipple
                                onClick={() => updateRoutingDay(i, '3', route?.day?.includes('3'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_3` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Wed</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            value="AVA"
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('4')}
                                name={`message_routing_${i}_4`}
                                disableRipple
                                onClick={() => updateRoutingDay(i, '4', route?.day?.includes('4'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_4` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Thu</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            value="AVA"
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('5')}
                                name={`message_routing_${i}_5`}
                                disableRipple
                                onChange={() => updateRoutingDay(i, '5', route?.day?.includes('5'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_5` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Fri</Typography>}
                            labelPlacement='bottom'
                          />
                          <FormControlLabel
                            className={classes.formControlDays}
                            value="AVA"
                            control={
                              <Checkbox
                                className={classes.centerCenter}
                                checked={route?.day?.includes('6')}
                                name={`message_routing_${i}_6`}
                                disableRipple
                                onClick={() => updateRoutingDay(i, '6', route?.day?.includes('6'))}
                                inputProps={{ 'aria-labelledby': `message_routing_${i}_6` }}
                              />
                            }
                            label={<Typography className={classes.radioDays}>Sat</Typography>}
                            labelPlacement='bottom'
                          />
                        </FormGroup>
                      </FormControl>
                    </Box>
                  </Box>
                }
                <Box className={classes.topicBox} >
                  {(lastEntry === 0) &&
                    <Typography className={classes.radioText}>I prefer to receive communications via...</Typography>
                  }
                  {(lastEntry > 0) && (i < lastEntry) &&
                    <Typography className={classes.radioText}>During these times, I prefer...</Typography>
                  }
                  {(lastEntry > 0) && (i === lastEntry) &&
                    <Typography className={classes.radioText}>At all other times, use this method...</Typography>
                  }
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup row aria-label={`message_routing_${i}_method`} name="method" value={route.method} onChange={handleChangeMethod(i)}>
                      <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>home phone</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="office" control={<Radio disabled={!person.messaging.office} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>work phone</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!person.messaging.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="hold" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>hold all non-urgent messages</Typography>} />
                    </RadioGroup>
                  </FormControl>
                </Box>
                <Box className={classes.topicBox} >
                  <Box alignItems="flex-start" justifyContent="flex-start" display='flex' flexDirection='row'>
                    {(route.method === 'hold') ?
                      <Typography className={classes.radioText}>{`For urgent messages`}</Typography>
                      :
                      <FormControl className={classes.formControl} component="fieldset">
                        <FormControlLabel className={classes.formControlLbl}
                          control={<Input classes={{ root: classes.idTextNoSpacing, input: classes.inputRule }} key={`wait_time_${i}`} defaultValue={route.waitTime || '15'} value={waitTime} onChange={onChangeWaitTime(i)} />}
                          label={<Typography className={classes.radioTextNoSpacing}>{`For urgent messages, wait how many minutes?:`}</Typography>}
                          labelPlacement={'start'}
                        />
                        <Typography className={classes.radioText}>Then...</Typography>
                      </FormControl>
                    }
                  </Box>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup row
                      value={route.escalationType}
                      aria-label={`message_routing_${i}_escalation`}
                      name="escalation"
                      onChange={handleChangeEscalationType(i)}
                    >
                      {(route.method !== 'hold') && <FormControlLabel className={classes.formControlLbl} value="retry" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try again</Typography>} />}
                      <FormControlLabel className={classes.formControlLbl} value="altMethod" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try another method</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="altID" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send it to one of my linked accounts</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="altAddress" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try another address or phone number</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="noAction" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>do nothing</Typography>} />
                    </RadioGroup>
                  </FormControl>
                  {(route.escalationType && (route.escalationType !== 'noAction')) &&
                    <Box className={classes.radioTextTopRight}>
                      {(route.escalationType === 'retry') &&
                        <Box alignItems="flex-end" justifyContent="flex-start" display='flex' flexDirection='row'>
                          <Typography className={classes.radioText}>Retry no more than</Typography>
                          <Input classes={{ root: classes.idText, input: classes.inputRule }}
                            key={`escData_${i}`}
                            defaultValue={route.escalationData || ''}
                            value={escalationData}
                            onChange={handleChangeEscalationData(i)}
                          />
                          <Typography className={classes.radioText}>times</Typography>
                        </Box>
                      }
                      {(route.escalationType === 'altAddress') &&
                        <Box sx={{ marginTop: '5px', maxWidth: '40px' }} display='flex' flexDirection='column'>
                          <Typography className={classes.radioText}>Use this alternate e-Mail address or phone number</Typography>
                          <Input classes={{ root: classes.idText, underline: classes.inputRuleWide, input: classes.inputRuleWide }}
                            key={`escData_${i}`}
                            defaultValue={route.escalationData || ''}
                            value={escalationData}
                            onChange={handleChangeEscalationData(i)}
                          />
                        </Box>
                      }
                      {(route.escalationType === 'altMethod') &&
                        <Box alignItems="flex-start" justifyContent="flex-start" display='flex' flexDirection='column'>
                          <Typography className={classes.radioText}>Try to reach me via</Typography>
                          <FormControl className={classes.formControl} component="fieldset">
                            <RadioGroup row
                              aria-label={`message_routing_${i}_method`}
                              name="method"
                              value={route.escalationData}
                              onChange={handleChangeEscalationData(i)}
                            >
                              {(route.method !== 'sms') && <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />}
                              {(route.method !== 'email') && <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />}
                              {(route.method !== 'voice') && <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>home phone</Typography>} />}
                              {(route.method !== 'office') && <FormControlLabel className={classes.formControlLbl} value="office" control={<Radio disabled={!person.messaging.office} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>work phone</Typography>} />}
                            </RadioGroup>
                          </FormControl>
                        </Box>
                      }
                      {(route.escalationType === 'altID') &&
                        <React.Fragment>
                          <Typography className={classes.radioText}>Select a linked account to send to</Typography>
                          <FormControl className={classes.formControl} component="fieldset">
                            <RadioGroup row
                              aria-label="altIDselection"
                              name="method"
                              value={route.escalationData}
                              onChange={handleChangeEscalationData(i)}
                            >
                              {linkedAccounts.map((presp) => (
                                <FormControlLabel
                                  key={`nameNlinkdaccts+${presp}`}
                                  className={classes.formControlLbl}
                                  value={presp.split('(')[1].replace(')', '').trim()}
                                  control={<Radio disableRipple className={classes.radioButton} size='small' />}
                                  label={<Typography className={classes.radioText}>{presp}</Typography>}
                                />
                              ))
                              }
                            </RadioGroup>
                          </FormControl>
                        </React.Fragment>
                      }
                    </Box>
                  }
                </Box>
                <Box className={classes.topicBox} >
                  <Box alignItems="flex-start" justifyContent="flex-start" display='flex' flexDirection='row'>
                    <FormControl className={classes.formControl} component="fieldset">
                      <FormControlLabel className={classes.formControlLbl}
                        control={<Input
                          classes={{ root: classes.idText, underline: classes.inputRuleWide, input: classes.inputRuleWide }}
                          key={`key_words_${i}`}
                          defaultValue={route.keyWords || ''}
                          value={keyWords}
                          onChange={onChangeKeyWords(i)}
                        />}
                        label={<Typography className={classes.radioText}>If message has keywords</Typography>}
                        labelPlacement={'start'}
                      />
                      <Typography className={classes.radioText}>Ignore other rules and...</Typography>
                    </FormControl>
                  </Box>

                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup row
                      value={route.keyWordType}
                      aria-label={`message_routing_${i}_keywordtype`}
                      name="keywordType"
                      onChange={handleChangeKeyWordType(i)}
                    >
                      <FormControlLabel className={classes.formControlLbl} value="altMethod" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>use a different method</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="altID" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send to one of my linked accounts</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="altAddress" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send to a different address or phone number</Typography>} />
                    </RadioGroup>
                  </FormControl>
                  <Box className={classes.radioTextTopRight}>
                    {(route.keyWordType === 'altAddress') &&
                      <Box alignItems="flex-end" justifyContent="flex-start" display='flex' flexDirection='row'>
                        <Typography className={classes.radioText}>Send to this e-Mail address or phone number instead</Typography>
                        <Input classes={{ root: classes.idText, input: classes.inputRuleWide }}
                          key={`escData_${i}`}
                          defaultValue={route.keyWordData || ''}
                          value={keyWordData}
                          onChange={handleChangeKeyWordData(i)}
                        />
                      </Box>
                    }
                    {(route.keyWordType === 'altMethod') &&
                      <Box alignItems="flex-start" justifyContent="flex-start" display='flex' flexDirection='column'>
                        <Typography className={classes.radioText}>This is the method to use</Typography>
                        <FormControl className={classes.formControl} component="fieldset">
                          <RadioGroup row
                            aria-label={`message_routing_${i}_method`}
                            name="method"
                            value={route.keyWordData}
                            onChange={handleChangeKeyWordData(i)}
                          >
                            {(route.method !== 'sms') && <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />}
                            {(route.method !== 'email') && <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />}
                            {(route.method !== 'voice') && <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>home phone</Typography>} />}
                            {(route.method !== 'office') && <FormControlLabel className={classes.formControlLbl} value="office" control={<Radio disabled={!person.messaging.office} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>work phone</Typography>} />}
                          </RadioGroup>
                        </FormControl>
                      </Box>
                    }
                    {(route.keyWordType === 'altID') &&
                      <React.Fragment>
                        <Typography className={classes.radioText}>Send to this account instead</Typography>
                        <FormControl className={classes.formControl} component="fieldset">
                          <RadioGroup row
                            aria-label="altIDselection"
                            name="method"
                            value={route.keyWordData}
                            onChange={handleChangeKeyWordData(i)}
                          >
                            {linkedAccounts.map((presp) => (
                              <FormControlLabel
                                key={`nameNlinkdaccts+${presp}`}
                                className={classes.formControlLbl}
                                value={presp.split('(')[1].replace(')', '').trim()}
                                control={<Radio disableRipple className={classes.radioButton} size='small' />}
                                label={<Typography className={classes.radioText}>{presp}</Typography>}
                              />
                            ))
                            }
                          </RadioGroup>
                        </FormControl>
                      </React.Fragment>
                    }
                  </Box>

                </Box>
                {(i !== lastEntry) &&
                  <Box className={classes.buttonBox} display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                    <Button
                      key={`delete_button-${i}`}
                      onClick={() => {
                        handleRemoveRule(i);
                      }}
                      className={classes.rowButtonRed}
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Remove this rule
                    </Button>
                  </Box>
                }
                <Box className={classes.topicBox} />
              </Box>
            ))}
          </React.Fragment>
        }
      </Box >
      <Button onClick={handleAddRule} className={classes.topButton}>
        Add a new Rule
      </Button>
    </Section >
  );
};
