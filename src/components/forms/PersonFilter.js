import React from 'react';
import { makeArray, isObject, deepCopy } from '../../util/AVAUtilities';
import { getImage } from '../../util/AVAPeople';

import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import CheckIcon from '@material-ui/icons/Check';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/Close';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import { AVAclasses, AVATextStyle, AVATextVariableStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  dialogPaper: {
    minHeight: '80vh',
    maxHeight: '80vh',
    minWidth: '600px',
    marginTop: '8vh'
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  firstName: {
    marginLeft: theme.spacing(1),
  },
  lastName: {
    fontWeight: 'bold',
  },
  groupName: {
    fontWeight: 'bold',
    color: 'red'
  },
  orSeparator: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontSize: theme.typography.fontSize * 0.8,
  },
  listItem: {
    justifyContent: 'flex-start',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  idText: {
    paddingTop: 6,
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(1)
  },
}));

export default ({
  prompt,
  peopleList,
  onCancel,
  onSelect,
  allowRandom,
  multiSelect = false,
  splitter = ':',
  alreadyChecked,
  options,
  returnValue = 'ID'        // returnValue = 'object' returns object with {id: name, id: name, ...}
}) => {

  const [person_filter, setPersonFilter] = React.useState('');
  const [visible_filter, setVisibleFilter] = React.useState('');
  const [random_address, setRandomAddress] = React.useState('');
  const [rowLimit, setRowLimit] = React.useState(20);
  const [maxY, setMaxY] = React.useState(0);
  const [checkList, setCheckList] = React.useState({});
 // const [selectedNames, setSelectedNames] = React.useState([]);

  const [reactData, setReactData] = React.useState({
    peopleList: peopleList || []
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const scrollValue = 20;
  var rowsWritten;
  let toggling = false;

  const user_fontSize = AVADefaults({ fontSize: 'get' });

  const onScroll = event => {
    let newLimit = rowLimit + scrollValue;
    setRowLimit(newLimit);
    setMaxY(Math.max(maxY, newLimit));
    setForceRedisplay(!forceRedisplay);
  };

  async function toggleCheck(pIn) {
 //   let tempNames = [];
    if (isChecked(pIn.person_id)) {
      delete checkList[pIn.person_id];
 //     let nList = Object.keys(checkList);
 //     for (let n = 0; n < nList.length; n++) {
 //       tempNames.push(pIn.display_name);
 //     }
    }
    else {
      checkList[pIn.person_id] = pIn.display_name;
 //     if (selectedNames.length > 0) { tempNames = [...selectedNames]; }
 //     tempNames.push(pIn.display_name);
    }
 //   setSelectedNames(tempNames);
    setCheckList(checkList);
    setForceRedisplay(!forceRedisplay);
  }

  function isChecked(pKey) {
    if (pKey in checkList) { return true; }
    else { return false; }
  }

  function formatPhone(match) {
    let formatted = '';
    if (match.length > 7) { formatted += match.slice(-10, -7) + ' '; }
    if (match.length > 4) { formatted += match.slice(-7, -4) + '-'; }
    if (match.length > 0) { formatted += match.slice(-4); }
    return formatted;
  }

  const handleChangePersonFilter = event => {
    setVisibleFilter(event.target.value);
    if (!event.target.value) {
      setPersonFilter(null);
      setRandomAddress('');
    }
    let filterInput = event.target.value.trim();
    if (filterInput.includes('@')) {      // e-Mail address
      setPersonFilter(filterInput.toLowerCase());
      setRandomAddress(filterInput);
      return;
    }
    var filterNumbers = '' + filterInput.replace(/\D/g, '').substr(-10);    // last 10 digits
    if (filterNumbers.length > 6) {    // this will be treated as a phone number
      setPersonFilter(filterNumbers);
      setRandomAddress(formatPhone(filterNumbers));
      return;
    }
    setPersonFilter(filterInput.toLowerCase());
    setRandomAddress('');
    return;
  };

  const buildList = async () => {
    let peopleListObj = peopleList.map(this_person => {
      let pObj;
      if (isObject(this_person)) {
        pObj = deepCopy(this_person);
      }
      else {
        let parts = this_person.split(splitter);
        pObj = {
          display_name: parts[0],
          person_id: parts[1],
          searchString: parts[2] || this_person
        };
      }
      if (!pObj.hasOwnProperty('last_name')) {
        let ans = pObj.display_name.split(',');
        switch (ans.length) {
          case 3: {
            pObj.last_name = `${ans[0].trim()}, ${ans[1].trim()}`;
            pObj.first_name = ans[2].trim();
            break;
          }
          case 2: {
            if (ans[1].startsWith('group=')) {
              break;
            }
            else {
              pObj.last_name = ans[0].trim();
              pObj.first_name = ans[1].trim();
              break;
            }
          }
          default: {
            let split_on_whitespace = ans[0].trim().split(/[\s]+/);
            if (split_on_whitespace.length === 1) {
              pObj.last_name = split_on_whitespace[0];
              pObj.first_name = '';
            }
            else {
              pObj.first_name = split_on_whitespace.shift();
              pObj.last_name = split_on_whitespace.join(' ');
            }
          }
        }
      }
      return pObj;
    });
    updateReactData({
      peopleList: peopleListObj
    }, true);
  };

  function okToShow(pLine) {
    if (!pLine) { return false; }
    else if (!isObject(pLine)) { return false; }
    else if (!person_filter || (person_filter.trim() === '')) { return true; }
    else if (pLine.searchString) {
      return (pLine.searchString.toLowerCase().includes(person_filter));
    }
    else if (pLine.search_data) {
      return (pLine.search_data.toLowerCase().includes(person_filter));
    }
    else {
      return true;
    }
  }

  React.useEffect(() => {
    async function initialize() {
      if (alreadyChecked) {
        let initial_checklist = {};
        makeArray(alreadyChecked).toReversed().forEach(preselected_person => {
          let foundAt = peopleList.findIndex(this_person => {
            return (this_person.person_id === preselected_person);
          });
          if (foundAt > -1) {
            let foundPerson = deepCopy(peopleList[foundAt]);
            initial_checklist[preselected_person] = peopleList[foundAt].display_name;
            peopleList.splice(foundAt, 1);
            peopleList.unshift(foundPerson);
          }
          else {
            initial_checklist[preselected_person] = 'true';
          }
        });
        setCheckList(initial_checklist);
      }
      await buildList();
    }
    initialize();
  }, [peopleList]);  // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll} fullWidth
      variant={'elevation'} elevation={2}
      id='person_filter-dialog'
      p={2}
    >
      <React.Fragment>
        <Typography
          style={AVATextStyle({ size: 1.3, margin: { top: 1.5, left: 2, right: 2 }, width: '400px', bold: true, overflow: 'visible' })}
          id='scroll-dialog-title'
        >
          {prompt}
        </Typography>
        <TextField
          id='List Filter'
          onChange={event => (handleChangePersonFilter(event))}
          value={visible_filter}
          className={classes.freeInput}
          helperText={'Search for...'}
          inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
          FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
          variant={'standard'}
          autoComplete='off'
        />
      </React.Fragment>
      <Paper component={Box} variant='outlined' overflow='auto' square>
        <List>
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {rowsWritten = 0}
          </Typography>
          {reactData.peopleList.map((listEntry, x) => (
            ((rowsWritten <= rowLimit) && okToShow(listEntry) &&
              <Paper
                key={'person-list_' + x}
                onClick={async () => {
                  if (!multiSelect) {
                    if (returnValue === 'id') {
                      onSelect(listEntry.person_id);
                    }
                    else {
                      onSelect(`${listEntry.display_name}%%${listEntry.person_id}%%${listEntry.searchString}`);
                    }
                  }
                  else {
                    if (!toggling) { await toggleCheck(listEntry); }
                    toggling = false;
                  }
                }}
                variant='outlined' overflow='auto' square
              >
                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten++}
                </Typography>
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center' className={classes.listItem}>
                  {multiSelect &&
                    <Checkbox
                      edge='start'
                      mr={1}
                      checked={isChecked(listEntry.person_id)}
                      disableRipple
                      key={'checkbox' + x}
                      onClick={async () => {
                        toggling = true;
                        await toggleCheck(listEntry);
                      }}
                    />
                  }
                  <Box
                    component="img"
                    border={1}
                    mr={1}
                    minWidth={50}
                    maxWidth={50}
                    minHeight={50}
                    maxHeight={50}
                    alt=''
                    src={getImage(listEntry.person_id)}
                  />
                  {!listEntry.person_id.startsWith('GRP//') ?
                    <Box display='flex' flexWrap='wrap' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                      <Typography style={AVATextVariableStyle(listEntry.last_name, { bold: true })}>
                        {listEntry.last_name}
                      </Typography>
                      <Typography style={AVATextVariableStyle(listEntry.first_name, { size: 0.8 })}>
                        {listEntry.first_name}
                      </Typography>
                      {(x > 0) && (x < (peopleList.length - 1)) &&
                        ((peopleList[x - 1].display_name === listEntry.display_name)
                          || (peopleList[x + 1].display_name === listEntry.display_name)) &&
                        <Typography style={AVATextVariableStyle(listEntry.person_id, { size: 0.8 })}>
                          ({listEntry.person_id})
                        </Typography>
                      }
                      {listEntry.conflict && listEntry.conflict.map((conflictEntry, c) => (
                        <Typography style={AVATextVariableStyle(listEntry.conflict, { size: 0.5, color: 'red' })}>
                          {conflictEntry}
                        </Typography>
                      ))}
                    </Box>
                    :
                    <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='flex-start'>
                      <Typography style={AVATextVariableStyle(listEntry.display_name, { bold: true })}>
                        {listEntry.display_name}
                      </Typography>
                    </Box>
                  }
                </Box>
              </Paper>
            )
          ))}
          {(rowsWritten === 0) && (random_address) &&
            <ListItem
              key={'person-list_new'}
              onClick={() => {
                onSelect(`*new:address=${random_address}`);
              }}
              button
            >
              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                <Typography style={AVATextStyle({ bold: true })}>{'Someone new'}</Typography>
                <Typography style={AVATextStyle({ size: 0.8, margin: { top: 0.5, left: 1 } })}>({random_address})</Typography>
              </Box>
            </ListItem>
          }
          {(rowsWritten === 0) && (!random_address) && (peopleList.length === 0) &&
            <ListItem
              key={'person-list_new'}
            >
              <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                <Typography style={AVATextStyle({ bold: true, margin: { left: 1 } })}>
                  {'AVA is still loading'}
                </Typography>
                <Typography style={AVATextStyle({ size: 0.8, margin: { top: 0.5, left: 1 } })}>
                  {'Please try again in a moment.'}
                </Typography>
              </Box>
            </ListItem>
          }
          {(rowsWritten === 0) && (!random_address) && (peopleList.length > 0) &&
            <ListItem
              key={'person-list_new'}
            >
              <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
                <Typography style={AVATextStyle({ bold: true })}>
                  {'No names found'}
                </Typography>
              </Box>
            </ListItem>
          }
        </List>
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            onCancel();
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Exit'}
        </Button>
        {multiSelect && (rowsWritten > 0) &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => {
              if (returnValue === 'object') { onSelect(checkList); }
              else { onSelect(Object.keys(checkList)); }
            }}
            startIcon={<CheckIcon fontSize="small" />}
          >
            {'Continue'}
          </Button>
        }
      </DialogActions>
    </Dialog>
  );
};
