import React from 'react';
import { lambda } from '../../util/AVAUtilities';
import { useSnackbar } from 'notistack';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import TextField from '@material-ui/core/TextField';

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

export default ({ pClient, activity, showDialog, handleClose }) => {

  const classes = useStyles();

  const [activityName, setActivityName] = React.useState(activity.activity_name);
  const [changeDetected, setChangeDetected] = React.useState(false);
  const activityClient = pClient;

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:EventActivityMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar } = useSnackbar();

  const onChangeName = event => {
    setActivityName(event.target.value);
    setChangeDetected(true);
  };

  const handleSave = async () => {
    params.Payload = JSON.stringify({
      action: "update",
      clientId: activityClient,
      request: {
        "activity_code": activity.activity_code,
        "new_name": activityName,
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
    handleClose();
  };

  React.useEffect(() => {
  }, [activity]);  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <Dialog open={showDialog} fullWidth className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {'Change this Item'}
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
              id={'obs-name'}
              label={'Item'}
              fullWidth
              value={activityName}
              onChange={onChangeName}
            />
          </Box>
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleClose}>
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