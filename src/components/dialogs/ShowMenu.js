import React from 'react';
import { getObservations } from '../../util/AVAObservations';

import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';
import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';
import FileCopyIcon from '@material-ui/icons/FileCopy';

import CopyMenu from '../forms/CopyMenu';

import MenuForm from '../forms/MenuForm';
import LoadMenuSpreadsheet from '../forms/LoadMenuSpreadsheet';

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  pageHead: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    marginLeft: 0,
    marginBottom: '10px',
    marginRight: '2px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  load: {
    backgroundColor: theme.palette.warning[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pClient, showMenu, onClose }) => {
  const [observationList, setObservationList] = React.useState();
  const [selectedDate, setSelectedDate] = React.useState(new Date().toDateString());
  const [loadMode, setLoadMode] = React.useState(false);
  const [copyMode, setCopyMode] = React.useState(false);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const buildObservationList = async (pDate) => {
    let [obsList,] = await getObservations(pClient, '', { date: pDate, sort: true, return: 'records' });
    setObservationList(obsList);
    return obsList;
  };

  const handleLoad = async () => {
    setLoadMode(true);
  };

  const handleCopy = async () => {
    setCopyMode(true);
  };

  const handleDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = new Date(event.target.value);
      if (isNaN(goodDate)) {
        let tNext = event.target.value.trim().toLowerCase().startsWith('next');
        if (tNext) {
          let dayWord = event.target.value.split(' ')[1].trim();
          event.target.value = dayWord;
        }
        let tDate = event.target.value.substr(0, 3).toLowerCase();
        let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
        goodDate = new Date(Date.now());
        if (dOfw > -1) {
          if ((goodDate.getDay() > dOfw) && tNext) {
            tNext = false;
          }
          goodDate.setDate(goodDate.getDate() + ((7 - (goodDate.getDay() - dOfw)) % 7) + (tNext ? 7 : 0));
        }
        else if (tDate === 'tom') {
          goodDate.setDate(goodDate.getDate() + 1);
        }
        else if (tDate !== 'tod') {
          goodDate = new Date(event.target.value);
        }
      }
      let current = new Date(Date.now());
      current.setHours(0, 0, 0, 0);
      if (goodDate < current) {
        let yyyy = current.getFullYear();
        goodDate.setFullYear(yyyy);
        if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
      };
      setSelectedDate(goodDate.toDateString());
      buildObservationList(goodDate);
    }
  };

  const handleChangeDate = event => {
    setSelectedDate(event.target.value);
  };

  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  // **************************

  if (!observationList) {
 //   setSelectedDate(new Date().toDateString());
    buildObservationList(new Date().toDateString());
  }

  return (
    (showMenu &&      
      <Dialog
        open={showMenu}
        onClose={handleAbort}
        TransitionComponent={Transition}
        className={classes.pageHead}
        fullScreen
      >
        <Box
          display='flex'
          mb={0}
          flexDirection='row'
          className={classes.pageHead}
          justifyContent='flex-start'
          alignItems='center'
        >
          <Box
            display='flex'
            grow={1}
            style={{ width: '90%' }}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {`Dining Menu Maintenance`}
            </DialogContentText>
            <DialogContentText className={classes.subDescriptionText}>
              {(!observationList || (observationList.length === 0)) ? 'Loading the Menu' : `Menu for ${selectedDate}`}
            </DialogContentText>
          </Box>
          <Box
            flexDirection='row'
            display='flex'
            width={'100%'}
            justifyContent='flex-start'
            alignItems='baseline'>
            <TextField
              className={classes.freeInput}
              id={'date-selection'}
              label={'Date selection'}
              variant={'standard'}
              fullWidth
              autoComplete='off'
              onKeyPress={handleDateExit}
              onChange={handleChangeDate}
              onBlur={handleDateExit}
              value={selectedDate || ''}
            />
          </Box>
        </Box>
        {observationList &&
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            <MenuForm
              observationList={observationList}
              pClient={pClient}
              keyDate={selectedDate}
              filter={''}
              onReset={() => {
                buildObservationList(selectedDate);
              }}
              handleAbort={handleAbort}
              handleLoad={handleLoad}
            />
          </DialogContent>
        }
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={handleAbort}
            startIcon={<CloseIcon size="small" />}
          >
            {'Done'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={handleLoad}
            startIcon={<LoadIcon size="small" />}
          >
            {'Load'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'brown', color: 'white' }}
            size='small'
            onClick={() => { handleCopy(); }}
            startIcon={<FileCopyIcon size="small" />}
          >
            {'Copy'}
          </Button>
        </DialogActions>
        {loadMode &&
          <LoadMenuSpreadsheet
            pClient={pClient}
            showUpload={loadMode}
            handleClose={() => {
              setLoadMode(false);
              buildObservationList(selectedDate);
            }}
          />
        }
        {copyMode &&
          <CopyMenu
            pClient={pClient}
            showUpload={copyMode}
            handleClose={() => {
              setCopyMode(false);
            }}
          />
        }
      </Dialog>
    )
  );
};
