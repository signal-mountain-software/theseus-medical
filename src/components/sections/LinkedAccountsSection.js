import React from 'react';

import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Section from '../Section';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';

import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import Checkbox from '@material-ui/core/Checkbox';
import Box from '@material-ui/core/Box';

const useStyles = makeStyles(theme => ({
  container: {
    maxHeight: 400,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

export default ({ groupMemberList, session, updateSession, updateProxy, version }) => {
  const classes = useStyles();

  const [person_filter, setPersonFilter] = React.useState(' ');
  const [person_filter_lower, setPersonFilterLower] = React.useState(' ');
  const [enoughFilterDigits, setenoughFilterDigits] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState();

  let filterCount = 0;
  let nameObj = {};

  let respArray = [];
  if (session) {
    if (!session.hasOwnProperty('responsible_for') || !session.responsible_for) { }
    else if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
    else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
    else { respArray.push(session.responsible_for); }
  };

  const handleChangePersonFilter = event => {
    filterCount = 0;
    if (event.target.value.length === 0) {
      setPersonFilter(' ');
      setPersonFilterLower(' ');
    }
    else {
      setPersonFilter(event.target.value.trim());
      setPersonFilterLower(event.target.value.trim().toLowerCase());
      setenoughFilterDigits(event.target.value.length > 1);
    }
  };

  function filteredPerson(pID, pName = { last: '*$*_null', first: '*$*_null' }) {
    let inTheList = (
      (respArray.includes(pID) ||
        ((enoughFilterDigits) &&
          (pName.last.toLowerCase().includes(person_filter_lower)
            || pName.first.toLowerCase().includes(person_filter_lower))
        ))
      && (session && (pID !== session.session_id))
    );
    if (inTheList || (session && session.patient_id === pID)) {
      nameObj[pID] = `${pName.first.charAt(0).toUpperCase()}${pName.last.charAt(0).toUpperCase()}${pName.last.substring(1)}`;
    }
    if (inTheList) { filterCount++; }
    return inTheList;
  }

  return ((version > -1) &&
    <Section title='Linked Accounts' outlined>
      <Box flexGrow={2} display='flex' flexDirection='column'>
        <TextField
          id='List Filter'
          value={person_filter}
          onChange={handleChangePersonFilter}
          autoComplete='off'
          helperText='Name Search'
        />
      </Box>
      {(groupMemberList && (groupMemberList.length > 0)) ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {version}
          </Typography>
          <List className={classes.root}>
            {groupMemberList.map((this_item, ndx) => (
              (filteredPerson(this_item.person_id, this_item.name)) &&
              <ListItem
                key={'key-resp' + ndx}
                role={undefined}
                dense
                button
                onClick={() => {
                  let foundAt = respArray.indexOf(this_item.person_id);
                  if (foundAt > -1) { respArray.splice(foundAt, 1); }
                  else { respArray.push(this_item.person_id); }
                  console.log(filterCount);
                  setForceRedisplay(!forceRedisplay);
                  updateSession(respArray);
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    edge='start'
                    checked={respArray.includes(this_item.person_id)}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{ 'aria-labelledby': this_item.person_id }}
                  />
                </ListItemIcon>
                <ListItemText id={'id-respName' + ndx} primary={this_item.name.last ? (this_item.name.first + ' ' + this_item.name.last) : this_item.display_name} />
              </ListItem>
            )
            )}
            {(filterCount === 0) && (respArray.length === 0) &&
              <ListItem
                key={'key-nodata'}
                role={undefined}
                dense
              >
                <ListItemText id={'id-nodata'} primary={'Use the Search line to find people to link to'} />
              </ListItem>
            }
          </List>
          {respArray.length > 0 &&
            <React.Fragment>
              <Typography className={classes.radioText}>Active proxy is...</Typography>
              <FormControl className={classes.formControl} component="fieldset">
                <RadioGroup row
                  defaultValue={session.patient_id}
                  aria-label="PrefMethod"
                  name="method"
                  value={session.patient_id}
                  onChange={updateProxy}
                >
                  {respArray.map((presp) => (
                    nameObj[presp] &&
                    <FormControlLabel
                      key={`nameNlinkdaccts+${presp}`}
                      className={classes.formControlLbl}
                      value={presp}
                      control={
                        <Radio disableRipple
                          className={classes.radioButton}
                          size='small' />
                      }
                      label={
                        <Typography
                          className={classes.radioText}>
                          {nameObj[presp]}
                        </Typography>}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </React.Fragment>
          }
        </Box>
        :
        <Box
          display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'
          key={'loadingBox'}
          ml={2} mr={2} mt={2}
        >
          <Typography variant='body1' className={classes.lastName} >{`Loading`}</Typography>
          <CircularProgress />
        </Box>
      }
    </Section>
  );
};