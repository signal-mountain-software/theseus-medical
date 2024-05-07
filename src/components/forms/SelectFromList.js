import React from 'react';
import { makeArray, cl, isMobile } from '../../util/AVAUtilities';

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
    marginLeft: theme.spacing(2),
    marginRight: 1,
    marginBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
    width: '95%',
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
    marginLeft: theme.spacing(6),
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
  selectionsList,
  onCancel,
  onSelect,
  options
}) => {

  const [rowLimit, setRowLimit] = React.useState(20);
  const [maxY, setMaxY] = React.useState(0);

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

  const [reactData, setReactData] = React.useState({
    choiceList: selectionsList,
    enteredNote: '',
    requestor_checked: {}
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const updateReactData = (newData, force = false) => {
    for (let oKey in newData) {
      setReactData((prevValues) => ({
        ...prevValues,
        [oKey]: newData[oKey],
      }));
    }
    if (force) {
      setForceRedisplay(forceRedisplay => !forceRedisplay);
    }
  };

  const handleChangeTextField = (vText) => {
    updateReactData({
      enteredNote: vText
    }, true);
  };

  function toggleCheck(pX) {
    if (!reactData.choiceList[pX].checked) {
      reactData.choiceList[pX].checked = true;
      if (!options.multiSelect) {
        reactData.choiceList.forEach((c, x) => {
          if (x !== pX) {
            reactData.choiceList[x].checked = false;
          }
        });
      }
    }
    else {
      let somethingElseIsChecked = reactData.choiceList.some((c, x) => {
        return ((x !== pX) && reactData.choiceList[x].checked);
      });
      if (somethingElseIsChecked) {
        reactData.choiceList[pX].checked = false;
      }
    }
    updateReactData({
      choiceList: reactData.choiceList
    }, true);
  }

  let filterTimeOut;
  const handleChangeFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        updateReactData({
          filterTextLower: ''
        });
      }
      else {
        updateReactData({
          filterTextLower: vCheck.toLowerCase()
        });
      }
    }, 500);
  };

  const buildList = async () => {
    reactData.choiceList.forEach((c, x) => {
      reactData.choiceList[x].checked = false;
    });
    if (options.alreadyChecked) {
      let preCheck = makeArray(options.alreadyChecked);
      preCheck.forEach(valueToPreCheck => {
        if (!isNaN(Number(valueToPreCheck))) {
          reactData.choiceList[Number(valueToPreCheck)].checked = true;
        }
        else {
          let foundAt = reactData.choiceList.findIndex(choiceObj => {
            return ((choiceObj.display === valueToPreCheck) || (choiceObj.value === valueToPreCheck));
          });
          if (foundAt > -1) {
            reactData.choiceList[Number(foundAt)].checked = true;
          }
        }
      });
    }
    updateReactData({
      choiceList: reactData.choiceList
    }, false);
  };

  function okToShow(pX) {
    if (!pX) {
      return false;
    }
    else if (!reactData.filterTextLower) {
      return true;
    }
    else {
      return reactData.choiceList[pX].display.toLowerCase().includes(reactData.filterTextLower);
    }
  }

  React.useEffect(() => {
    async function initialize() {
      await buildList();
    }
    initialize();
  }, [selectionsList]);  // eslint-disable-line react-hooks/exhaustive-deps


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
          {prompt[0]}
        </Typography>
        {/* Text Filter */}
        {options.allowFilter &&
          <TextField
            id='List Filter'
            onChange={event => (handleChangeFilter(event.target.value))}
            className={classes.freeInput}
            helperText={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
            inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
            FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
            variant={'standard'}
            autoComplete='off'
          />
        }
      </React.Fragment>
      <Paper component={Box} overflow='auto' variant={'elevation'} elevation={0} mb={2}>
        <List>
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {rowsWritten = 0}
          </Typography>
          {reactData.choiceList.map((listEntry, x) => (
            ((rowsWritten <= rowLimit) && okToShow(listEntry) &&
              <Paper
                key={'person-list_' + x}
                onClick={() => {
                  if (!toggling) {
                    toggleCheck(x);
                  }
                  toggling = false;
                }}
                variant={'elevation'} elevation={0} overflow='auto' square
              >
                <Typography className={classes.noDisplay}
                  key={'rWritten_' + x}
                  sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten++}
                </Typography>
                <Box display='flex' flexDirection='row'
                  key={'outerBox_' + x}
                  justifyContent='flex-start' alignItems='center' className={classes.listItem}>
                  <Checkbox
                    edge='start'
                    mr={1}
                    checked={(listEntry.checked ? true : false)}
                    disableRipple
                    key={'checkbox' + x}
                    onClick={() => {
                      toggling = true;
                      toggleCheck(x);
                    }}
                  />
                  {listEntry.image &&
                    <Box
                    component="img"
                    key={'imageBox_' + x}
                      border={1}
                      mr={1}
                      minWidth={50}
                      maxWidth={50}
                      minHeight={50}
                      maxHeight={50}
                      alt=''
                      src={listEntry.image}
                    />
                  }
                  <Box display='flex'
                    key={'entryBox_' + x}
                    flexWrap='wrap' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                    <Typography
                      key={'entryLine_' + x}
                      style={(AVATextVariableStyle(listEntry.display), { bold: true })}>
                      {listEntry.display}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )
          ))}
          {options.allowNote &&
            <React.Fragment>
              {prompt[1] &&
                <Typography
                  style={AVATextStyle({ size: 1.3, margin: { top: 1.5, left: 2, right: 2 }, width: '400px', bold: true, overflow: 'visible' })}
                  id='scroll-dialog-title'
                >
                  {prompt[1]}
                </Typography>
              }
              <Box display='flex'
                marginLeft={2}
                marginTop={2}
                paddingRight={0.5}
                borderRadius={'32px'}
                border={(reactData.enteredNote ? 1 : 0)}
                borderColor={'black'}
                paddingBottom={1}
                paddingTop={1.5}
                paddingLeft={0.5}
                alignItems={'center'}
                marginBottom={0.5}
                flexBasis={'content'}
                flexDirection='row' width='95%' key={'midLeft'}
              >
                <TextField
                  className={classes.freeInput}
                  variant={'standard'}
                  key={`inputtextprompt_`}
                  id={`inputtextprompt_`}
                  helperText={options.allowNote}
                  multiline
                  inputProps={{ style: { fontSize: `${user_fontSize * 1}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                  onChange={event => {
                    handleChangeTextField(event.target.value);
                  }}
                  FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                  autoComplete='off'
                  value={reactData.enteredNote}
                />
              </Box>
            </React.Fragment>
          }
          {options.allowNotify &&
            <React.Fragment>
              {(prompt[2] || prompt[1]) &&
                <Typography
                  style={AVATextStyle({ size: 1.3, margin: { top: 1.5, left: 2, right: 2 }, width: '400px', bold: true, overflow: 'visible' })}
                  id='scroll-dialog-title'
                >
                  {(prompt[2] || prompt[1])}
                </Typography>
              }
              <Paper
                key={'notifyList'}
                variant={'elevation'} elevation={0} overflow='auto' square
              >
                {Object.keys(options.allowNotify).map((notifyID, x) => (
                  <Box display='flex'
                    key={`checkbox_outer_${x}`}
                    flexDirection='row' justifyContent='flex-start' alignItems='center' className={classes.listItem}>
                    <Checkbox
                      edge='start'
                      mr={1}
                      checked={reactData.requestor_checked[notifyID] || false}
                      disableRipple
                      key={`checkbox_requestor_${x}`}
                      onClick={() => {
                        if (reactData.requestor_checked.hasOwnProperty[notifyID]) {
                          reactData.requestor_checked[notifyID] = !reactData.requestor_checked[notifyID];
                        }
                        else {
                          reactData.requestor_checked[notifyID] = true;
                        }
                        updateReactData({
                          requestor_checked: reactData.requestor_checked
                        }, true);
                      }}
                    />
                    <Box
                      display='flex'
                      flexWrap='wrap'
                      flexDirection='column'
                      justifyContent='center'
                      alignItems='flex-start'
                      key={`checkbox_rtext_${x}`}
                    >
                      <Typography
                        key={`notif_line_${x}`}
                        style={(AVATextVariableStyle(options.allowNotify[notifyID].name), { bold: true })}>
                        {`${options.allowNotify[notifyID].name} ${(options.allowNotify[notifyID].count > 1) ? '(' + options.allowNotify[notifyID].count + ')' : ''}`}
                      </Typography>
                    </Box>
                  </Box>
                ))}                
              </Paper>
            </React.Fragment>
          }
        </List>
      </Paper >
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
          {'Close/Exit'}
        </Button>
        {(rowsWritten > 0) &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => {
              onSelect(
                {
                  selections: (reactData.choiceList.filter(c => {
                    return c.checked;
                  }) || []),
                  enteredNote: reactData.enteredNote,
                  notify: [...Object.keys(reactData.requestor_checked).filter(k => {
                    return reactData.requestor_checked[k]
                  })]
                }
              );
            }}
            startIcon={<CheckIcon fontSize="small" />}
          >
            {'Save/Confirm'}
          </Button>
        }
      </DialogActions>
    </Dialog >
  );
};
