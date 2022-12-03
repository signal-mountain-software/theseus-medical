import React from 'react';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TimePicker from 'react-time-picker';

import Input from '@material-ui/core/Input';

import Typography from '@material-ui/core/Typography';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import DeleteIcon from '@material-ui/icons/Delete';

import RadioGroup from '@material-ui/core/RadioGroup';

import Section from '../Section';

const useStyles = makeStyles(theme => ({
  container: {
    // maxHeight: 400,
    flexGrow: 1,
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
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  idText: {
    display: 'inline',
    marginRight: theme.spacing(1),
  },
  inputRule: {
    display: 'inline',
    fontSize: theme.typography.fontSize,
    padding: 0,
    width: theme.spacing(3),
    margin: 0,
  },
  inputRuleWide: {
    display: 'inline',
    fontSize: theme.typography.fontSize,
    padding: 0,
    width: theme.spacing(30),
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
    marginLeft: 0,
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    fontSize: theme.typography.fontSize * 0.8,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
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
    marginBottom: -25,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextBig: {
    fontSize: theme.typography.fontSize * 1.2,
    fontWeight: 'bold',
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextMoreTop: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginTop: 10,
    paddingLeft: 0,
    paddingRight: 10,
    fontWeight: 'bold',
  },
  radioTextLeft: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginRight: theme.spacing(1),
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
  let prefMethod;
  let waitTime;
  let escalationType, escalationData;
  let keyWords;
  let keyWordType, keyWordData;

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
    if (ruleRows[tableRow].escalationType === 'altID') { getLinkedAccounts(); }
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  const handleChangeKeyWordType = tableRow => event => {
    person.time_based_rules[tableRow].keyWordType = event.target.value;
    person.time_based_rules[tableRow].keyWordData = '';
    if (ruleRows[tableRow].keyWordType === 'altID') { getLinkedAccounts(); }
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
    if (removeEntry) { person.time_based_rules[tableRow].day.replace(dayValue, ''); }
    else { person.time_based_rules[tableRow].day += dayValue; };
    setRuleRows(person.time_based_rules);
    setViewVersion(viewVersion + 1);
    updateSetChange();
  };

  async function getLinkedAccounts() {
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

  return (
    <Section title='Message Delivery' outlined>
      <TableContainer className={classes.container} component={Paper}>
        <Table size='small' stickyHeader>
          {(lastEntry > 0) &&
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 200 }}>From</TableCell>
                <TableCell style={{ width: 200 }}>To</TableCell>
                <TableCell style={{ width: 20 }}>Su</TableCell>
                <TableCell style={{ width: 20 }}>M</TableCell>
                <TableCell style={{ width: 20 }}>Tu</TableCell>
                <TableCell style={{ width: 20 }}>W</TableCell>
                <TableCell style={{ width: 20 }}>Th</TableCell>
                <TableCell style={{ width: 20 }}>F</TableCell>
                <TableCell style={{ width: 20 }}>Sa</TableCell>
              </TableRow>
            </TableHead>
          }
          {(person && viewVersion > 0) &&
            <TableBody>
              {ruleRows.map((route, i) => (
                <React.Fragment key={`message_fragment_${i}`}>
                  {(i < lastEntry) &&
                    <React.Fragment key={`header_message_${i}`}>
                      <TableRow key={`message_greeting`} style={{ marginLeft: '20px', borderTop: 'none', borderBottom: 'none' }} colSpan={9}>
                        <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
                          <Typography className={classes.radioTextHeader}>Set a time frame for this rule</Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow key={`message_routing_${i}`}>
                        <TableCell style={{ width: 200, borderBottom: 'none' }} key={`message_routing_${i}_from`}>
                          <TimePicker
                            value={route.time_from || '0:00'}
                            clearIcon={null}
                            clockIcon={null}
                            disableClock={true}
                            onChange={onChangeFromTime(i)}
                          />
                        </TableCell>
                        <TableCell style={{ width: 200, borderBottom: 'none' }} key={`message_routing_${i}_to`}>
                          <TimePicker
                            value={route.time_to || '23:59'}
                            clearIcon={null}
                            clockIcon={null}
                            disableClock={true}
                            onChange={onChangeToTime(i)}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('0')}
                            name={`message_routing_${i}_0`}
                            disableRipple
                            onChange={(event) => {
                              updateRoutingDay(i, '0', route?.day?.includes('0'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_0` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('1')}
                            name={`message_routing_${i}_1`}
                            disableRipple
                            onChange={(event) => {
                              updateRoutingDay(i, '1', route?.day?.includes('1'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_1` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('2')}
                            name={`message_routing_${i}_2`}
                            disableRipple
                            onClick={(event) => {
                              console.log('checkbox 2 tapped');
                              updateRoutingDay(i, '2', route?.day?.includes('2'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_2` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('3')}
                            name={`message_routing_${i}_3`}
                            disableRipple
                            onChange={(event) => {
                              console.log('checkbox 3 tapped');
                              updateRoutingDay(i, '3', route?.day?.includes('3'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_3` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('4')}
                            name={`message_routing_${i}_4`}
                            disableRipple
                            onChange={(event) => {
                              updateRoutingDay(i, '4', route?.day?.includes('4'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_4` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('5')}
                            name={`message_routing_${i}_5`}
                            disableRipple
                            onChange={(event) => {
                              updateRoutingDay(i, '5', route?.day?.includes('5'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_5` }}
                          />
                        </TableCell>
                        <TableCell style={{ width: 20, borderBottom: 'none' }}>
                          <Checkbox
                            edge='start'
                            checked={route?.day?.includes('6')}
                            name={`message_routing_${i}_6`}
                            disableRipple
                            onChange={(event) => {
                              updateRoutingDay(i, '6', route?.day?.includes('6'));
                            }}
                            inputProps={{ 'aria-labelledby': `message_routing_${i}_6` }}
                          />
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  }
                  <TableRow key={`message_selection_${i}`} style={{ borderTop: 'none', borderBottom: 'none' }} colSpan={9}>
                    <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
                      {(lastEntry === 0) &&
                        <Typography className={classes.radioTextBold}>I prefer to receive communications via...</Typography>
                      }
                      {(lastEntry > 0) && (i < lastEntry) &&
                        <Typography className={classes.radioTextBold}>During these times, I prefer...</Typography>
                      }
                      {(lastEntry > 0) && (i === lastEntry) &&
                        <Typography className={classes.radioTextMoreTop}>At all other times, use this method...</Typography>
                      }
                      <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row defaultValue={route.method || ''} aria-label={`message_routing_${i}_method`} name="method" value={prefMethod} onChange={onChangeMethod(i)}>
                          <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>home phone</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="office" control={<Radio disabled={!person.messaging.office} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>work phone</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!person.messaging.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                        </RadioGroup>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
                      <Box alignItems="flex-end" justifyContent="flex-start" display='flex' flexDirection='row'>
                        <Typography className={classes.radioTextLeft}>For urgent messages, give me</Typography>
                        <Input classes={{ root: classes.idText, input: classes.inputRule }} key={`wait_time_${i}`} defaultValue={route.waitTime || '15'} value={waitTime} onChange={onChangeWaitTime(i)} />
                        <Typography className={classes.radioTextRight}>minutes to respond, then...</Typography>
                      </Box>
                      <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row
                          defaultValue={route.escalationType || 'noAction'}
                          value={escalationType}
                          aria-label={`message_routing_${i}_escalation`}
                          name="escalation"
                          onChange={handleChangeEscalationType(i)}
                        >
                          <FormControlLabel className={classes.formControlLbl} value="retry" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try again</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="altMethod" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try another method</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="altID" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send it to one of my linked accounts</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="altAddress" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>try another address or phone number</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="noAction" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>do nothing</Typography>} />
                        </RadioGroup>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                  {(route.escalationType && (route.escalationType !== 'noAction')) &&
                    <TableRow>
                      <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
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
                          <Box alignItems="flex-end" justifyContent="flex-start" display='flex' flexDirection='row'>
                            <Typography className={classes.radioText}>Use this alternate e-Mail address or phone number</Typography>
                            <Input classes={{ root: classes.idText, input: classes.inputRuleWide }}
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
                                defaultValue={route.escalationData || ''}
                                value={escalationData}
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
                                defaultValue={route.escalationData || ''}
                                value={escalationData}
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
                      </TableCell>
                    </TableRow>
                  }
                  <TableRow>
                    <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
                      <Box alignItems="flex-end" justifyContent="flex-start" display='flex' flexDirection='row'>
                        <Typography className={classes.radioTextLeft}>Look for any of these words:</Typography>
                        <Input classes={{ root: classes.idText, input: classes.inputRuleWide }} key={`key_words_${i}`} defaultValue={route.keyWords || ''} value={keyWords} onChange={onChangeKeyWords(i)} />
                      </Box>
                      <Typography className={classes.radioTextLeft}>If found, ignore other rules and...</Typography>
                      <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row
                          defaultValue={route.keyWordType || ''}
                          value={keyWordType}
                          aria-label={`message_routing_${i}_keywordtype`}
                          name="keywordType"
                          onChange={handleChangeKeyWordType(i)}
                        >
                          <FormControlLabel className={classes.formControlLbl} value="altMethod" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>use a different method</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="altID" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send to one of my linked accounts</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="altAddress" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>send to a different address or phone number</Typography>} />
                        </RadioGroup>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} style={{ borderTop: 'none', borderBottom: 'none' }}>
                      {(route.kewWordType === 'altAddress') &&
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
                              defaultValue={route.keyWordData || ''}
                              value={keyWordData}
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
                              defaultValue={route.keyWordData || ''}
                              value={keyWordData}
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
                    </TableCell>
                  </TableRow>
                  <TableRow key={`message_default`} colSpan={9} style={{ borderBottomStyle: 'double', borderBottomColor: 'black', borderBottomWidth: '5px' }}>
                    <TableCell colSpan={9} style={{ borderBottomStyle: (((i < lastEntry) && (lastEntry > 0)) ? 'double' : 'none'), borderBottomColor: 'black', borderBottomWidth: '2px' }} >
                      {(i !== lastEntry) &&
                        <Box alignItems="flex-start" justifyContent="flex-start" display='flex' flexDirection='row'>
                          <Button
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
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          }
        </Table>
      </TableContainer>
      <Button onClick={handleAddRule} className={classes.topButton}>
        Add a new Rule
      </Button>
    </Section >
  );
};
