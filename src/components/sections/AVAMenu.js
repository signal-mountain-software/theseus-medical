import React from 'react';
import { Lambda } from 'aws-sdk';
import { Auth } from '@aws-amplify/auth';
import { useSnackbar } from 'notistack';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { useCookies } from 'react-cookie';

import useSession from '../../hooks/useSession';
import SwitchPatientDialog from '../dialogs/SwitchPatientDialog';
import NewFactDialog from '../dialogs/NewFactDialog';
import AVAConfirm from '../forms/AVAConfirm';

import List from '@material-ui/core/List';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import FavoriteIcon from '@material-ui/icons/FavoriteBorder';
import HelpIcon from '@material-ui/icons/HelpOutline';
import FaceIcon from '@material-ui/icons/Face';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import CircularProgress from '@material-ui/core/CircularProgress';

import Tooltip from '@material-ui/core/Tooltip';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
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
  avatar: {
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  verticalMenuButton: {
    marginTop: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  title: {
    marginTop: 0,
    marginLeft: 0,
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  hello: {
    marginTop: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  messageScroll: {
    maxHeight: 100,
    marginTop: 0,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'contained',
    size: 'small'
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  sectionHeader: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  messageArea: {
    alignItems: 'flex-start',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  vertMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  logoDisplay: {
    maxWidth: '600px',
  },

  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  makeIconStyle: {
    marginRight: theme.spacing(1),
  },
  locationLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  firstName: {

  },
  lastName: {
    fontWeight: 'bold',
    marginRight: theme.spacing(1),
  }
}));

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAR2O24AQ2HGHS4SFF',
  secretAccessKey: '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'
});

export default ({ pPerson, pClient, isMobile, onReset }) => {

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const { state } = useSession();
  const { roles, session } = state;

  const [selected, setSelected] = React.useState(null);

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [mainMenu, setMainMenu] = React.useState([]);
  const [messageText, setMessageText] = React.useState('');
  const [imageURL, setImageURL] = React.useState('');
  const [greetingName, setGreetingName] = React.useState('');
  const [greetingTime, setGreetingTime] = React.useState('');
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [pendingFact, setPendingFact] = React.useState('');

  const [sectionOpen, setSectionOpen] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(false);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(false);
  const [toggleClick, setToggleClick] = React.useState(false);
  const [rowOpen, setRowOpen] = React.useState([]);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [loading, setLoading] = React.useState(true);

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  let currentSection = '';

  const imageBucket = 'theseus-medical-storage';
  const imageURI = 'public/patients/[person_id].jpg';

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:MakeAVAMenu',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const buildMenu = async (pFlavor = 'retrieve') => {
    setLoading(true);
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:MakeAVAMenu';
    params.Payload = JSON.stringify({
      test: false,
      action: pFlavor,
      client_id: pClient,
      request: {
        person_id: pPerson,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Menu.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let MakeAVAMenuResponse = JSON.parse(fResp.Payload);
      if (MakeAVAMenuResponse.status === 200) {
        if (!sectionOpen) {
          let tempSectionOpen = {};
          tempSectionOpen[MakeAVAMenuResponse.body[0].section_name] = true;
          setSectionOpen(tempSectionOpen);
        }
        else {
          sectionOpen[MakeAVAMenuResponse.body[0].section_name] = true;
          setSectionOpen(sectionOpen);
        }
        setMainMenu(MakeAVAMenuResponse.body);
        setLoading(false);
        return MakeAVAMenuResponse.body;
      }
    };
    return [];
  };

  const getMessage = async (pPerson) => {
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:MakeAVAMenu';
    params.Payload = JSON.stringify({
      test: false,
      action: 'get_last_message',
      client_id: pClient,
      request: {
        person_id: pPerson,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Messages.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let MakeAVAMenuResponse = JSON.parse(fResp.Payload);
      if (MakeAVAMenuResponse.status === 200) {
        setMessageText(MakeAVAMenuResponse.body);
        return MakeAVAMenuResponse.body;
      }
    };
    return [];
  };

  async function putMedia(newFact) {
    let newName = newFact.value?.freeText?.Title || newFact.value.mediaData.Key;
    if (newFact.value?.mediaData?.ContentType?.includes('video') || newFact.value?.mediaData?.Body?.type?.includes('video')) {
      let fileExtension = newFact.value.mediaData.Key.split('.').pop();
      let destinationName = newName.trim().replace(/[\s/]/g, '_').split('.')[0];
      newFact.value.mediaData.Key = destinationName + '.' + fileExtension;
    }
    let mediaData = newFact.value.mediaData;
    enqueueSnackbar(`AVA is saving ${newName}...`, { variant: 'info', persist: true });
    let uploadOK = true;
    let uploadResult = await s3
      .putObject(mediaData)
      .promise()
      .catch(err => {
        uploadOK = false;
        enqueueSnackbar(`Uh oh!  AVA couldn't save that.  The reason is ${err.message}`,
          { variant: 'error', persist: true });
      });
    if (uploadOK) {
      enqueueSnackbar(`${newName} is saved!`, { variant: 'success', persist: false });
      return uploadResult.Key;
    };
    return null;
  }

  const onSaveFact = async (pFact, pFactName) => {
    if (typeof (pFact.value) === 'string') { putFact(pFact, pFactName); }
    else {
      let factFlavor = pFact.activity_key.split('.')[0];
      if (factFlavor === 'action' || !pFact.value.hasOwnProperty('selected')) { }
      else {
        setPendingFact(pFact);
        let foundText = [];
        let valueArray = pFact.value.selected.map(selection => {
          if (pFact.value.freeText.hasOwnProperty(selection)) {
            let freeText = pFact.value.freeText[selection];
            foundText.push(selection);
            return `${selection} = ${freeText}`;
          }
          else {
            return selection;
          }
        });
        for (const key in pFact.value.freeText) {
          if (key !== '%filter%' && !foundText.includes(key)) {
            valueArray.push(`${key} = ${pFact.value.freeText[key]}`);
          }
        }
        let isMedia = (pFact.value.hasOwnProperty('mediaData'));
        let isForm = (factFlavor === 'form' || factFlavor === 'message');
        if (isMedia) {
          let fileName = await putMedia(pFact);
          valueArray.unshift(`s3file=${fileName}`, 'Video', `userTag=${pFact.value.tag}`);
        }
        else if (isForm && pFact.status !== 'confirmed') {
          let cMessage = [
            'Review & Confirm please',
            pFactName];
          if (valueArray.length > 0) {
            cMessage.push(
              '~~~~',
              'Your selections are:',
              ...valueArray
            );
          }
          setConfirmMessage(cMessage);
          setNeedsConfirmation(true);
          return;
        }
        pFact.value = (isForm ? 'form_selections' : (isMedia ? 'file_details' : 'selection')) + '.' + valueArray.join(' ~ ');
        if (pFact.value.hasOwnProperty('qualifiers') && Object.keys(pFact.value.qualifiers).length > 0) {
          pFact.qualifier = Object.keys(pFact.value.qualifiers).map(k => {
            return `${k}:${pFact.value.qualifiers[k]}`;
          });
        }
        putFact(pFact, pFactName);
        enqueueSnackbar(`${pFactName} successfully completed!`, { variant: 'success' });
      }
    };
    setShowNewFactDialog(false);
    setForceRedisplay(!forceRedisplay);
  };

  const onNextFact = async () => {
    setShowNewFactDialog(false);
    setForceRedisplay(!forceRedisplay);
  };

  React.useEffect(() => {
    let response = (
      async () => {
        getImage(session.patient_id);
        makeName(session.patient_display_name);
        makeGreeting();
        await getMessage(session.patient_id);
        await buildMenu('retrieve');
      }
    );
    if (mainMenu.length === 0) {
      setLoading(true);
      response();
    }
  }, [pPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  const accessLog = async (pUser, pPwd, pMessage) => {
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        'attempted_user': pUser,
        'attempted_password': pPwd,
        'result': pMessage
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:AccessLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  const activityLog = (pUser, pCode, pName) => {
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        user_id: pUser,
        activity_code: pCode,
        activity_name: pName,
        AVA_version: `22.8.31${window.location.href.split('//')[1].slice(0, 1)}`
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:ActivityLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Activity log call failed.  Error is', JSON.stringify(err));
      });
  };

  const putFact = async (pFact, pFactName) => {
    var payload =
    {
      patient_id: pFact.patient_id,
      activity_key: pFact.activity_key,
      value: pFact.value,
      session: pFact.session,
      status: 'recorded'
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:theseus-putFact',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .then(() => {
        activityLog(pFact.patient_id, pFact.activity_key, pFactName);
      })
      .catch(err => {
        console.log('Fact write failed.  Error is', JSON.stringify(err));
      });
  };

  const getActivityDetail = async (pActivity) => {
    let invokeFailed = false;
    var payload =
    {
      'test': false,
      'body': {
        "clientId": pClient,
        "personId": pPerson,
        "activityType": `$$${pActivity}`,
        "limit": 100,
        "fact_data": false,
        "historyOnly": false,
        "use_short_date": true,
        "kiosk_mode": false
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:thesesus-activityList',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call for Activity details failed.  Error is', JSON.stringify(err));
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let activityResponse = JSON.parse(fResp.Payload);
      if (activityResponse.status === 200) {
        setSelected(activityResponse.body.activityData[0]);
        return activityResponse.body.activityData[0];
      }
    };
    return [];
  };

  function getImage(pPerson) {
    setImageURL(s3.getSignedUrl('getObject', {
      Bucket: imageBucket,
      Key: imageURI.replace('[person_id]', pPerson),
      Expires: 3600
    }));
  }

  function makeName(pString) {
    let nameParts = pString.split(',');
    let response = '';
    if (nameParts[1]) { response = nameParts[1].split(/,|\(|#|~/g)[0].trim(); }
    else { response = nameParts[0].split(' ')[0].trim(); }
    setGreetingName(response);
    return response;
  }

  function makeGreeting() {
    let current_hour = Number(new Date().toTimeString().split(':')[0]);
    let response = '';
    if (current_hour < 12) { response = 'morning'; }
    else if (current_hour < 17) { response = 'afternoon'; }
    else { response = 'evening'; }
    setGreetingTime(response);
    return response;
  }

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };

  // ******************

  return (
    <Dialog
      open={mainMenu && mainMenu.length > 0 && (true || forceRedisplay)}
      p={2}
      fullScreen
    >
      <React.Fragment>
        {/* Header with Avatar, Message, and VertMenu */}
        <Box
          display='flex' flexDirection='row'
          className={classes.messageArea}
          key={'topBox'}
        >
          <Tooltip
            className={classes.avatar}
            title={
              <Typography variant='caption'>
                {session?.kiosk_mode ? 'View/Update not available' : `View/Update ${greetingName}'${greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
              </Typography>
            }
            placement='bottom-start'>
            <Avatar src={imageURL}>
              <FaceIcon />
            </Avatar>
          </Tooltip>
          <Box
            flexGrow={1}
            display='flex'
            overflow='auto'
            flexDirection='column'>
            <Typography
              className={classes.hello}
              id='scroll-dialog-title'
            >
              {`Good ${greetingTime}, ${greetingName}!`}
            </Typography>
            <Typography
              className={classes.messageScroll}
              id='scroll-dialog-title'
            >
              {messageText}
            </Typography>
          </Box>
          <IconButton
            className={classes.verticalMenuButton}
            aria-controls='hidden-menu'
            aria-haspopup='true'
            onClick={(event) => {
              handleClick(event);
              setPopupMenuOpen(true);
            }}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            id='hidden-menu'
            anchorEl={anchorEl}
            open={popupMenuOpen}
            onClose={() => { setPopupMenuOpen(false); }}
            keepMounted>
            <MenuList dense={true}>
              {session?.responsible_for && (
                <MenuItem onClick={() => {
                  setPopupMenuOpen(false);
                  setShowPersonSelect(true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSwitch'}
                  >
                    <SwapHorizIcon />
                    <Typography className={classes.vertMenuRow} >{'Switch Account'}</Typography>
                  </Box>
                </MenuItem>
              )}
              <MenuItem onClick={async () => {
                await accessLog(session.user_id, `*na*`, `Manual sign-out`);
                removeCookie("AVAuser");
                Auth.signOut().then(() => {
                  let jumpTo = window.location.origin;
                  window.location.replace(jumpTo);
                });
              }}>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowSignOut'}
                >
                  <ExitToAppIcon />
                  <Typography className={classes.vertMenuRow} >{'Sign Out'}</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={async () => {
                setPopupMenuOpen(false);
                makeGreeting();
                await getMessage(session.patient_id);
                await buildMenu('main_menu');
                setForceRedisplay(!forceRedisplay);
              }
              }>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <AutorenewIcon />
                  <Typography className={classes.vertMenuRow} >{'Refresh'}</Typography>
                </Box>
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
        {/* Loading spinner */}
        {loading &&
          <Box
            border={2}
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={2} mr={2}
          >
            <Typography variant='h5' className={classes.lastName} >{`Loading AVA`}</Typography>
            <Typography variant='caption' >{`version 22.8.31${window.location.href.split('//')[1].slice(0, 1)}`}</Typography>
            <CircularProgress />
          </Box>
        }
        {/* AVA Menu */}
        {mainMenu && mainMenu.length > 0 && !loading &&
          <Paper component={Box} variant='outlined' overflow='auto'>
            <Box
              border={2}
              display='flex' flexDirection='row' justifyContent='center' alignItems='center'
              key={'logoBox'}
              ml={2} mr={2}
            >
              <Box
                component="img"
                maxWidth={isMobile ? 250 : 450}
                alt=''
                src={session?.client_icon || 'https://ava-icons.s3.amazonaws.com/AVA-logo.jpg'}
              />
            </Box>
            <List >
              {mainMenu.map((this_row, index) => (
                <React.Fragment
                  key={this_row.activity_code + 'fragment' + index}
                >
                  {currentSection !== this_row.section_name &&
                    <Paper mt={1.5} component={Box} variant='outlined' key={this_row.activity_code + 'section' + index} >
                      <Box
                        display='flex'
                        style={{ backgroundColor: this_row.section_color, textDecoration: 'none' }}
                        ml={2} mr={2}
                        justifyContent='center'
                        flexDirection='column'
                        minHeight={80}
                        onClick={() => {
                          sectionOpen[this_row.section_name] = !sectionOpen[this_row.section_name];
                          setSectionOpen(sectionOpen);
                          setForceRedisplay(!forceRedisplay);
                        }}
                      >
                        <Box
                          display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                          key={this_row.activity_code + 'r' + index}
                          className={classes.sectionHeader}
                        >
                          <Avatar
                            src={this_row.section_icon}
                            sx={{ width: 30, height: 30 }}
                            alt=""
                            variant="square"
                          />
                          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                            {(currentSection = this_row.section_name)}
                          </Typography>
                          <Box display='flex' ml={2} mr={5} flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                <Typography variant='h5' className={classes.lastName} >{this_row.section_name}</Typography>
                              </Box>
                            </Box>
                          </Box>
                          {index > 0 &&
                            <IconButton
                              aria-label='showActivities'
                              size='small'
                            >
                              {!sectionOpen[this_row.section_name] ? 'Show' : 'Hide'}
                            </IconButton>
                          }
                        </Box>
                      </Box>
                    </Paper>
                  }
                  {sectionOpen[this_row.section_name] &&
                    <Paper component={Box}
                      variant='outlined' key={this_row.activity_code + 'detail' + index} >
                      <Box
                        display='flex'
                        style={{ backgroundColor: this_row.row_color, textDecoration: 'none' }}
                        ml={2} mr={2}
                        justifyContent='center'
                        flexDirection='column'
                        minHeight={80}
                      >
                        <Box
                          display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                          key={this_row.activity_code + 'detailrow' + index}
                          className={classes.listItem}
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            enqueueSnackbar(`AVA function=${this_row.activity_code} type=${this_row.row_type} user=${session.user_id}`, { variant: 'info', persist: true });
                          }}
                          onClick={async () => {
                            if (!toggleClick && (this_row.row_type !== 'document')) {
                              await getActivityDetail(this_row.activity_code);
                              setShowNewFactDialog(true);
                            }
                            setToggleClick(false);
                          }}
                        >
                          <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            {this_row.row_type === 'document' ?
                              <a href={this_row.default_value + (!this_row.default_value?.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                                <Typography variant='h5' className={classes.firstName}>{this_row.activity_name}</Typography>
                              </a>
                              :
                              <Typography variant='h5' className={classes.firstName}>{this_row.activity_name}</Typography>
                            }
                          </Box>
                          <IconButton
                            aria-label='showActivities'
                            size='small'
                            onClick={() => {
                              setToggleClick(true);
                              rowOpen[index] = !rowOpen[index];
                              setRowOpen(rowOpen);
                              setForceRedisplay(!forceRedisplay);
                            }}
                          >
                            {!rowOpen[index] ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                          </IconButton>
                        </Box>
                      </Box>
                      <Collapse in={rowOpen[index]} timeout="auto" unmountOnExit>
                        <Box
                          style={{ backgroundColor: this_row.row_color, textDecoration: 'none' }}
                          display='flex'
                          ml={2} mr={2}
                          flexDirection='row' paddingTop={1} paddingBottom={1} justifyContent='center' alignItems='center'
                        >
                          <Button
                            onClick={() => {
                              // Make this a favorite
                            }}
                            className={classes.rowButtonGreen}
                            startIcon={<FavoriteIcon fontSize="small" />}
                          >
                            Make Favorite?
                          </Button>
                          <Button
                            onClick={() => {
                              // Ask for Help
                            }}
                            className={classes.rowButtonDefault}
                            startIcon={<HelpIcon fontSize="small" />}
                          >
                            Ask for Help
                          </Button>
                        </Box>
                      </Collapse>
                    </Paper>
                  }
                </React.Fragment>
              ))}
            </List>
          </Paper>
        }
        {showPersonSelect &&
          <SwitchPatientDialog
            open={showPersonSelect}
            roles={roles}
            onClose={() => {
              setShowPersonSelect(false);
            }}
          />
        }
        {/* Launch Children */}
        {showNewFactDialog &&
          <NewFactDialog
            fact={selected}
            session={session}
            open={showNewFactDialog}
            fromHome={false}
            onClose={async (oopsieMessage = null) => {
              oopsieMessage && (enqueueSnackbar(oopsieMessage, { variant: 'error', persist: true }));
              setShowNewFactDialog(false);
              if (session?.url_parameters.hasOwnProperty('activity')) {
                let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
                jumpTo += `?user=${session.url_parameters.user}`;
                window.location.replace(jumpTo);
              }
            }}
            onSave={
              (pResult) => {
                onSaveFact(pResult, selected.name);
              }
            }
            onNext={onNextFact}
            onSelected={() => { }}
          />
        }
        {/* Confirm Fact before saving */
          needsConfirmation &&
          <AVAConfirm
            promptText={confirmMessage}
            onCancel={() => {
              setNeedsConfirmation(false);
              setForceRedisplay(!forceRedisplay);
            }}
            onConfirm={() => {
              pendingFact.status = 'confirmed';
              onSaveFact(pendingFact, selected.name);
              setNeedsConfirmation(false);
            }}
          >
          </AVAConfirm>
        }
      </React.Fragment >
    </Dialog >
  );
};;