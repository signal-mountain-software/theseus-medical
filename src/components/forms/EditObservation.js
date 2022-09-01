import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';

import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Button from '@material-ui/core/Button';

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
}));

export default ({ observation, showDialog, handleClose, handleCancel }) => {

  const classes = useStyles();

  let oCode = observation.composite_key.split(/[~_]/g);
  const [observationType, setObservationType] = React.useState(oCode.slice(1, -1).join('_').trim());
  const [observationCode, setObservationCode] = React.useState(observation.observation_code);
  const [observationKey, setObservationKey] = React.useState(observation.observation_key);
  const [changeDetected, setChangeDetected] = React.useState(false);
  const observationClient = oCode[0];
  const observationDate = oCode.pop();
  let oD = observationDate.split('.');
  const observationLongDate = oD[0] + '.' + ((Number(oD[1]) + 100).toString()).substring(1) + '.' + ((Number(oD[2]) + 100).toString()).substring(1);

  let editMode = (observationType || observationCode);

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

  const entryTypes = ['', 'header', 'message', 'entree', 'soft_entree', 'AL_lunch_entree', 'AL_dinner_entree', 'soup', 'salad', 'side', 'bread', 'dessert'];

  const onChangeType = event => {
    setObservationType(event.target.value);
    setChangeDetected(true);
  };

  const onChangeCode = event => {
    setObservationCode(event.target.value);
    setChangeDetected(true);
  };

  const onChangeKey = event => {
    setObservationKey(event.target.value);
    setChangeDetected(true);
  };

  const handleSave = async () => {
    params.Payload = JSON.stringify({
      action: "update",
      clientId: observationClient,
      request: {
        "existing_key": {
          "composite_key": observation.composite_key,
          "observation_code": observation.observation_code
        },
        "new_code": `${observationType === 'header' ? '~~' : ''}${observationCode}`,
        "new_key": `${observationClient}~${observationType}_${observationDate}`,
        "new_oKey": observationKey,
        "new_date": observationLongDate,
        "new_sort": `${observationDate}${observationType !== 'header' ? observationType : ''}`
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while updating that item.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    handleClose(
      {
        "observation_code": `${observationType === 'header' ? '~~' : ''}${observationCode}`,
        "composite_key": `${observationClient}~${observationType}_${observationDate}`,
        "observation_key": `${observationKey}`,
      }
    );
  };

  function sentenceCase(pString) {
    return pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase();
  }

  React.useEffect(() => {
  }, [observation]);  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <Dialog open={showDialog} fullWidth className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {editMode ? 'Change this Item' : 'Add a new Item'}
        </DialogContentText>
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <Box
            display='flex'
            grow={1}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <TextField
              classes={{ root: classes.idText }}
              id={'obs-type'}
              select
              defaultValue="" 
              fullWidth
              label={'Type'}
              value={observationType || ''}
              onChange={onChangeType}
            >
              {entryTypes.map((eType) => (
                <MenuItem key={eType} value={eType}>
                  {sentenceCase(eType).replace(/_/g, " ")}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              classes={{ root: classes.idText }}
              id={'obs-code'}
              label={'Item'}
              fullWidth
              value={observationCode}
              onChange={onChangeCode}
            />
            <TextField
              classes={{ root: classes.idText }}
              id={'obs-key'}
              label={'Recipe key'}
              fullWidth
              value={observationKey}
              onChange={onChangeKey}
            />
          </Box>
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleCancel}>
            Cancel
          </Button>
          {changeDetected &&
            <Button variant='contained' color='primary' size='small' onClick={handleSave}>
              Save
            </Button>
          }
        </DialogActions>
      </Box>
    </Dialog>
  );
};