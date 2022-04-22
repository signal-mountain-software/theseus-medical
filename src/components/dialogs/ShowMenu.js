import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import MenuForm from '../forms/MenuForm';
import LoadMenuSpreadsheet from '../forms/LoadMenuSpreadsheet';

import useMediaQuery from '@material-ui/core/useMediaQuery';

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
  const [observationList, setObservationList] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState();
  const [loadMode, setLoadMode] = React.useState(false);

  const classes = useStyles();

  const entryTypes = ['header', 'message', 'entree', 'soft_entree', 'AL_lunch_entree', 'AL_dinner_entree', 'soup', 'salad', 'side', 'bread', 'dessert'];

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  if (isMobile) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:ObservationMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar } = useSnackbar();

  const getObservations = async (pDate) => {
    let invokeFailed = false;
    if (!(pDate instanceof Date) || isNaN(pDate)) {
      pDate = new Date(pDate);
    }
    let pYMD = pDate.getFullYear() + '.' + (pDate.getMonth() + 1) + '.' + pDate.getDate();

    params.Payload = JSON.stringify({
      action: "get_by_sort_date",
      clientId: pClient,
      request: {
        "sort_date": pYMD.toString(),
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving that menu.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let getObservations = JSON.parse(fResp.Payload);
      if (getObservations.status === 200) {
        getObservations.body.forEach(o => { o.sort_order = getSort(o); });
        getObservations.body.sort((a, b) => { return (a.sort_order > b.sort_order ? 1 : -1); });
        setObservationList(getObservations.body);
      }
    };
    return getObservations.body;
  };

  function getSort(pKey) {
    let oType = pKey.composite_key.split(/[~_]/g).slice(1, -1).join('_').trim();
    return (entryTypes.indexOf(oType) + 100).toString() + pKey.observation_code;
  }

  const handleLoad = async () => {
    setLoadMode(true);
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
      getObservations(goodDate);
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

  if (!selectedDate) {
    setSelectedDate(new Date().toDateString());
    getObservations(new Date().toDateString());
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
              {observationList.length === 0 ? 'Loading the Menu' : `Menu for ${selectedDate}`}
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
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <MenuForm
            observationList={observationList}
            pClient={pClient}
            keyDate={selectedDate}
            filter={''}
            onReset={() => {
              getObservations(selectedDate);
            }}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleAbort}>
            {'Done'}
          </Button>
          <Button className={classes.load} size='small' variant='contained' onClick={handleLoad}>
            {'Load'}
          </Button>
        </DialogActions>
        {loadMode &&
          <LoadMenuSpreadsheet
            pClient={pClient}
            showUpload={loadMode}
            handleClose={() => {
              setLoadMode(false);
              getObservations(selectedDate);
            }}
          />
        }
      </Dialog>
    )
  );
};
