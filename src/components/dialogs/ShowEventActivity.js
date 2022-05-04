import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';
import { API, graphqlOperation } from 'aws-amplify';

import { getActivityData } from '../../graphql/queries';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import EventActivityForm from '../forms/EventActivityForm';
import ActivityFilter from '../forms/ActivityFilter';

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

export default ({ pSession, pEvent_id, pName, showList, onClose }) => {
  const [eventActivityList, setEventActivityList] = React.useState([]);
  const [showEventSelect, setShowEventSelect] = React.useState(false);
  const [entireActivityList, setEntireActivityList] = React.useState();
  const [menuName, setMenuName] = React.useState('');

  const [entireActivityObject, setEntireActivityObject] = React.useState();

  const classes = useStyles();

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
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:EventActivityMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar } = useSnackbar();

  const getEventActivitiesList = async (pEvent) => {
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "get_activities",
      clientId: pSession.client_id,
      request: {
        "event_id": pEvent,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving activity list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let getEventActivities = JSON.parse(fResp.Payload);
      if (getEventActivities.status === 200) {
        setEventActivityList(getEventActivities.body);
        return eventActivityList;
      }
    };
    return [];
  };

  const getEventListFromMenu = async (pMenu) => {
    let listForEdit = entireActivityObject[pMenu].map(aRec => {
      return {
        activity_code: aRec.aCode,
        activity_name: aRec.aName,
        client_event_id: 'na'
      };
    });
    setEventActivityList(listForEdit);
    return eventActivityList;
  };

  const buildDetailedMenuList = async () => {
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "build_menu",
      clientId: pSession.client_id,
      request: {
        "person_id": pSession.patient_id,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving activity list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let getActivityMenus = JSON.parse(fResp.Payload);
      if (getActivityMenus.status === 200) {
        setEntireActivityList(Object.keys(getActivityMenus.body).sort());
        setEntireActivityObject(getActivityMenus.body);
        setShowEventSelect(true);
      }
    };
  };

  const handleAbort = () => {
    setChanges(false);
    setShowEventSelect(true);
    // onClose();
  };

  // **************************

  React.useEffect(() => {
    let aList = [];
    let response = (
      async () => {
        aList = await getEventActivitiesList(pEvent_id);
      }
    );
    if (!eventActivityList || eventActivityList.length === 0) {
      if (pEvent_id) {
        response();
        console.log(aList);
      }
      else { 
        buildDetailedMenuList();
      }
    }
  }, [pEvent_id]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (showList &&
      <Dialog
        open={showList}
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
              {menuName || `Activity Maintenance`}
            </DialogContentText>
            <DialogContentText className={classes.subDescriptionText}>
              {eventActivityList.length === 0 ? 'Getting Activities' : ``}
            </DialogContentText>
          </Box>
        </Box>
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <EventActivityForm
            eventActivityList={eventActivityList}
            pClient={pSession.client_id}
            onReset={async () => {
              await getEventActivitiesList(pEvent_id);
            }}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleAbort}>
            {'Done'}
          </Button>
        </DialogActions>
        {showEventSelect &&
          <ActivityFilter
            activityList={entireActivityList}
            activityObject={entireActivityObject}
            onCancel={() => {
              setShowEventSelect(false);
              onClose();
            }}
            onSelect={(selectedActivity) => {
              setShowEventSelect(false);
              setMenuName(selectedActivity);
              getEventListFromMenu(selectedActivity);
            }}
          >
          </ActivityFilter>
        }
      </Dialog>
    )
  );
};
