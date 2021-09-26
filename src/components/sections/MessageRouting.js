import React from 'react';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';

import Section from '../Section';
 
  const useStyles = makeStyles(theme => ({
    container: {
        maxHeight: 400,
        marginBottom: theme.spacing(2),
        paddingBottom: theme.spacing(2),
        flexGrow: 1
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
    defaultButton: {
      alignSelf: 'end',
      variant: 'outlined',
      verticalAlign: 'end',
      backgroundColor: theme.palette.confirm[theme.palette.type],
    },
    topButton: {
      variant: 'outlined',
      backgroundColor: theme.palette.confirm[theme.palette.type],
    },
    radioText: {
      fontSize: theme.typography.fontSize * 0.8,
      marginLeft: 0,
      paddingLeft: 0,
      paddingRight: 10,
    },
    radioButton: {
      marginTop: 0,
      marginRight: 0,
      marginLeft: 0,
      paddingLeft: 0,
      paddingRight: 5,
    },
  }));

export default ({ person, updateRoutingDay, onChangeToTime, onChangeMethod, numRows }) => {
    const classes = useStyles();
    let prefMethod; 

    const [ruleRows, setRuleRows] = React.useState(person.time_based_rules);
    const [lastEntry, setLastEntry] = React.useState(person.time_based_rules.length - 1)

    const handleAddRule = () => {
        person.time_based_rules.splice(lastEntry, 0, 
          {
            'time_to': '?', 
            'method': '?', 
            'time_from': '?', 
            'day': ''
          });
        setLastEntry(lastEntry + 1);
        setRuleRows(person.time_based_rules);
    }
    
    const onChangeFromTime = tableRow => event => {
      person.time_based_rules[tableRow].from_time = event.target.value;
      setLastEntry(lastEntry - 0.1);
      setRuleRows(person.time_based_rules);
    }

    function formatTimeOut(inTime, fromTime) {
        if (!inTime) { return ( fromTime ? 'midnight' : '11:59pm' ) }
        let tNum = Number(inTime);
        if (isNaN(tNum)) {return inTime};
        let amPM;
        if (tNum > 1159) {
            amPM = 'pm';
            if (tNum > 1259) {tNum -= 1200}
        } 
        else {
            amPM = 'am'
            if (tNum < 100) {tNum += 1200}
        }
        return ((tNum/100).toFixed(2).replace('.',':') + amPM);
    }

  return (
    <Section title='Message Delivery' outlined>
      <TableContainer className={classes.container} component={Paper}>
        <Table size='small' stickyHeader>
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
          { person ? 
            <TableBody>
              { ruleRows.map((route, i) => (
                i < lastEntry ?  
                <React.Fragment>
                <TableRow key={`message_routing_${i}`} style={{borderBottom: 'none'}}>
                  <TableCell style={{ width: 200, borderBottom: 'none' }}>
                    <TextField
                        id={`message_routing_${i}_from`}
                        value={formatTimeOut(route.time_from, true) || ''}
                        onChange={onChangeFromTime(i)}
                    />
                  </TableCell>
                  <TableCell style={{ width: 200, borderBottom: 'none' }}>
                    <TextField
                        id={`message_routing_${i}_to`}
                        value={formatTimeOut(route.time_to, false) || ''}
                        onChange={onChangeToTime(i)}
                    />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('0')}
                        name={`message_routing_${i}_0`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '0', route.day.includes('0'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_0` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('1')}
                        name={`message_routing_${i}_1`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '1', route.day.includes('1'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_1` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('2')}
                        name={`message_routing_${i}_2`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '2', route.day.includes('2'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_2` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('3')}
                        name={`message_routing_${i}_3`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '3', route.day.includes('3'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_3` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('4')}
                        name={`message_routing_${i}_4`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '4', route.day.includes('4'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_4` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('5')}
                        name={`message_routing_${i}_5`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '5', route.day.includes('5'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_5` }}
                      />
                  </TableCell>
                  <TableCell style={{ width: 20, borderBottom: 'none' }}>
                      <Checkbox
                        edge='start'
                        checked={route.day && route.day.includes('6')}
                        name={`message_routing_${i}_6`}
                        disableRipple
                        onChange={ (event) => {
                            updateRoutingDay(i, '6', route.day.includes('6'))
                        }}
                        inputProps={{ 'aria-labelledby': `message_routing_${i}_6` }}
                      />
                  </TableCell>
                </TableRow>
                <TableRow style={{borderTop: 'none'}} colSpan={9}> 
                  <TableCell colSpan={9} style={{borderTop: 'none'}}>
                    <Typography className={classes.radioText}>During these times, I prefer...</Typography>
                    <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row defaultValue={route.method || ''} aria-label={`message_routing_${i}_method`} name="method" value={prefMethod} onChange={onChangeMethod(i)}>
                        <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>phone</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!person.messaging.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                        </RadioGroup>
                    </FormControl>
                  </TableCell>                
                </TableRow>
                </React.Fragment>
             : null
              ))}
              <TableRow colSpan={9} height={'200%'} mt={'100px'}> 
                  <TableCell align='right' style={{borderTopStyle: 'double', borderBottom: 'none'}} colSpan={9} >
                    <Typography className={classes.radioText}>At all other times, use this method...</Typography>
                    <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row defaultValue={person.time_based_rules[lastEntry].method || 'AVA'} aria-label={`message_routing_default_method`} name="method" value={prefMethod} onChange={onChangeMethod(lastEntry)}>
                        <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!person.messaging.sms} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!person.messaging.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!person.messaging.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>phone</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!person.messaging.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                        </RadioGroup>
                    </FormControl>
                  </TableCell>                
                </TableRow>
            </TableBody>
            : null }
        </Table>
      </TableContainer>
      <Button onClick={handleAddRule} mt={2} pt={2} variant='contained' className={classes.topButton}>
        Add a new Rule
      </Button>
    </Section>
  );
};
