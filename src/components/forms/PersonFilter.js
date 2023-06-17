import React from 'react';
import { listFromArray, makeArray } from '../../util/AVAUtilities';
import { makeName, getImage } from '../../util/AVAPeople';

import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import CheckIcon from '@material-ui/icons/Check';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/Close';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  freeInput: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 1.8,
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
  idText: {
    paddingTop: 6,
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(1)
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({
  prompt,
  peopleList,
  onCancel,
  onSelect,
  allowRandom,
  multiSelect = false,
  alreadyChecked,
  returnValue = 'ID'        // returnValue = 'object' returns object with {id: name, id: name, ...}
}) => {

  const [person_filter, setPersonFilter] = React.useState('');
  const [visible_filter, setVisibleFilter] = React.useState('');
  const [random_address, setRandomAddress] = React.useState('');
  const [rowLimit, setRowLimit] = React.useState(20);
  const [maxY, setMaxY] = React.useState(0);
  const [previousY, setCurrentY] = React.useState(0);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [checkList, setCheckList] = React.useState({});
  const [selections, setSelections] = React.useState('');
  const [selectedNames, setSelectedNames] = React.useState([]);

  const classes = useStyles();

  const scrollValue = 20;
  var rowsWritten;
  let toggling = false;

  const onScroll = event => {
    if (rowLimit < peopleList.length) {
      let currentY = window.scrollY;
      if (currentY - (previousY + 50)) {
        setCurrentY(currentY);
        let newLimit = rowLimit + scrollValue;
        setRowLimit(newLimit);
        setMaxY(Math.max(maxY, newLimit));
        setForceRedisplay(!forceRedisplay);
      }
    }
  };

  async function toggleCheck(pIn) {
    let [pName, pKey] = pIn.split(':');
    if (!pName) {
      pName = await makeName(pKey);
    }
    let tempNames = [];
    if (isChecked(pKey)) {
      delete checkList[pKey];
      let nList = Object.keys(checkList);
      for (let n = 0; n < nList.length; n++) {
        tempNames.push(pName);
      }
    }
    else {
      checkList[pKey] = pName;
      if (selectedNames.length > 0) { tempNames = [...selectedNames]; }
      tempNames.push(pName);
    }
    setSelectedNames(tempNames);
    setSelections(listFromArray(tempNames));
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

  };

  function okToShow(pLine) {
    if (!pLine) { return false; }
    else if (!person_filter) { return true; }
    else { return pLine.toLowerCase().includes(person_filter); }
  }

  function makeFirstName(pString) {
    let pName = pString.split(':')[0];
    let ans = pName.split(/[:,]/g);
    switch (ans.length) {
      case 3: { return ans[2].trim(); }
      case 2: {
        if (ans[1].startsWith('group=')) { return ''; }
        else { return ans[1].trim(); }
      }
      default: {
        let a = ans[0].trim().split(/[\s]+/); 
        if (a.length === 1) { return ''; }
        a.pop();
        return a.join(' ');
      }
    }
  }

  function makeLastName(pString) {
    let pName = pString.split(':')[0];
    let ans = pName.split(/[:,]/g);
    switch (ans.length) {
      case 3: { return `${ans[0].trim()}, ${ans[1].trim()}`; }
      case 2: {
        if (ans[1].startsWith('group=')) { return ''; }
        else { return ans[0].trim(); }
      }
      default: {
        let a = ans[0].trim().split(/[\s]+/);
        if (a.length === 1) { return a; }
        return a.pop();
      }
    }
  }

  React.useEffect(() => {
    async function initialize() {
      await buildList();
    }
    initialize();
    if (alreadyChecked) {
      let newCheckList = {};
      let theList = makeArray(alreadyChecked);
      theList.forEach(p => { newCheckList[p] = 'true'; })
      setCheckList(newCheckList);
    }
  }, [peopleList]);  // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      height={250}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {prompt}
      </DialogContentText>
      <TextField
        id='Type a few letters to filter the list'
        value={visible_filter}
        onChange={handleChangePersonFilter}
        className={classes.freeInput}
        autoComplete='off'
        variant="standard"
      />
      <Typography variant='h5' className={classes.orSeparator}>
        {`You may filter the list below${!allowRandom ? '' : ', or enter a specific phone number or e-Mail address'}`}
      </Typography>
      {(Object.keys(checkList).length > 0) &&
        <Typography variant='h5' className={classes.orSeparator}>
          {`Selected: ${selections}`}
        </Typography>
      }
      <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
        <List component='nav'>
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {rowsWritten = 0}
          </Typography>
          {peopleList.map((listEntry, x) => (
            ((rowsWritten <= rowLimit) && okToShow(listEntry) &&
              <ListItem
                key={'person-list_' + x}
                onClick={async () => {
                  if (!multiSelect) { onSelect(listEntry); }
                  else {
                    if (!toggling) { await toggleCheck(listEntry); }
                    toggling = false;
                  }
                }}
                button
              >
                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten++}
                </Typography>
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  {multiSelect &&
                    <Checkbox
                      edge='start'
                      mr={1}
                      checked={isChecked(listEntry.split(':')[1])}
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
                  //  ml={1}
                    mr={1}
                    minWidth={50}
                    maxWidth={50}
                    alt=''
                    src={getImage(listEntry.split(':')[1])}
                  />
                  {!listEntry.split(':')[1].startsWith('GRP//') ?
                    <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='flex-start' alignItems='center'>           
                      <Typography variant='h5' className={classes.lastName}>{`${makeLastName(listEntry)}`}</Typography>
                      <Typography variant='h5' className={classes.firstName}>{makeFirstName(listEntry)}</Typography>
                      {(x > 0) && (x < (peopleList.length - 1)) &&
                        ((peopleList[x - 1].split(':')[0] === listEntry.split(':')[0])
                          || (peopleList[x + 1].split(':')[0] === listEntry.split(':')[0])) &&
                        <Typography variant='h5' className={classes.idText}>({listEntry.split(/[:]/)[1]})</Typography>
                      }
                    </Box>
                    :
                    <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='flex-start' alignItems='center'>           
                      <Typography variant='h5' className={classes.groupName}>{listEntry.split(':')[0]}</Typography>
                      <Typography variant='h5' className={classes.idText}>(GROUP)</Typography>
                    </Box>
                  }
                </Box>
              </ListItem>
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
                <Typography variant='h5' className={classes.lastName}>{'Someone new'}</Typography>
                <Typography variant='h5' className={classes.idText}>({random_address})</Typography>
              </Box>
            </ListItem>
          }
        </List>
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={classes.AVAButton}
          style={{ color: 'red' }}
          onClick={() => {
            onCancel();
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Close/Exit'}
        </Button>
        {multiSelect &&
          <Button
            className={classes.AVAButton}
            style={{color: 'green'}}
            onClick={() => {
              if (returnValue === 'object') { onSelect(checkList); }
              else { onSelect(Object.keys(checkList)); }
            }}
            startIcon={<CheckIcon fontSize="small" />}
          >
            {'Save/Confirm'}
          </Button>
        }
      </DialogActions>
    </Dialog>
  );
};
