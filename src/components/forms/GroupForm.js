import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Button from '@material-ui/core/Button';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';

import PatientDialog from '../dialogs/PatientDialog';
import PersonFilter from '../forms/PersonFilter';
import AVAConfirm from './AVAConfirm';
import AVATextInput from '../forms/AVATextInput';

const useStyles = makeStyles(theme => ({
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
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  redBackground: {
    background: 'red',
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  firstName: {
    marginLeft: theme.spacing(1),
  },
  lastName: {
    fontWeight: 'bold',
  }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ groupMemberList, peopleList, pPatient, pClient, pGroup, pGroupName, onReset }) => {

  const classes = useStyles();

  const [person_filter, setPersonFilter] = React.useState('');
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [workingMemberList, setGroupMemberList] = React.useState(groupMemberList);
  const [editIndex, setEditIndex] = React.useState();

  const [deletePending, setDeletePending] = React.useState(false);
  const [personRec, setPersonRec] = React.useState();
  const [showPatientDialog, setShowPatientDialog] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmPerson, setConfirmPerson] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();

  const { enqueueSnackbar } = useSnackbar();

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const handleChangePersonFilter = event => {
    setPersonFilter(event.target.value);
  };

  const handleAddPersonToGroup = async (pPerson, pGroup) => {
    let invokeFailed = false;

    params.Payload = JSON.stringify({
      action: "add_person_to_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": workingMemberList
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let workingMemberList = JSON.parse(fResp.Payload);
      if (workingMemberList.status === 200) {
        setGroupMemberList(workingMemberList.body);
        return workingMemberList;
      }
    };
    return [];
  };

  const handleRemoveGroupMember = async (pPerson, pIndex) => {
    params.Payload = JSON.stringify({
      action: "remove_person_from_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": workingMemberList
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while deleting that item.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    let tempMemberList = workingMemberList;
    tempMemberList.splice(pIndex, 1);
    setGroupMemberList(tempMemberList);
    setForceRedisplay(true);
    return tempMemberList;
  };

  const handlePrintDirectory = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:printDirectory';
    params.Payload = JSON.stringify({
      "body": {
        "client_id": pClient,
        "requestor": pPatient,
        "report_title": pGroupName,
        "showImages": true,
        "group_id": pClient + '~' + pGroup
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Directory.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    enqueueSnackbar(`Directory Print request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const handlePrintRoster = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:group_roster';
    params.Payload = JSON.stringify({
      "body": {
        "person_id": pPatient,
        "values": pGroupName + ':group=' + pClient + '~' + pGroup,
        "showCognito": "true"
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Roster.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    enqueueSnackbar(`Roster report request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const handleSendMessage = async (pMessage, pRecipient = null) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    if (!pRecipient) { pRecipient = pGroupName + ':group=' + pClient + '~' + pGroup }
    params.Payload = JSON.stringify({
      "body": {
        "client": pClient,
        "author": pPatient,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    enqueueSnackbar(`Sent "${pMessage}" to everyone in ${pGroupName}.`, {
      variant: 'success'
    });
  };

  const handlePatientEdit = async (pPerson, pIndex) => {
    let invokeFailed = false;
    setEditIndex(pIndex);

    params.Payload = JSON.stringify({
      action: "get_person_details",
      clientId: pClient,
      request: {
        "person_id": pPerson,
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedPerson = JSON.parse(lambdaResponse.Payload);
      if (returnedPerson.status === 200) {
        setPersonRec(returnedPerson.body);
        setShowPatientDialog(true);
        return returnedPerson.body;
      }
    };
  };


  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      height={250}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      {workingMemberList && workingMemberList.length > 0 &&
        <React.Fragment>
          <DialogContentText
            className={classes.title}
            id='scroll-dialog-title'
          >
            {`Members of the ${pGroupName}${pGroupName.includes('roup') ? '' : ' Group'}`}
          </DialogContentText>
          <TextField
            id='Type a few letters to filter the list'
            value={person_filter}
            onChange={handleChangePersonFilter}
            className={classes.freeInput}
            label='Type a few letters to filter the list'
            variant={'standard'}
            autoComplete='off'
          />
          <Paper component={Box} variant='outlined' overflow='auto' square>
            <Box >
              <Grid item>
                <GridList cellHeight='auto' cols={1} key='gridList'>
                  {workingMemberList.map((this_item, index) => (
                    (!this_item.search_data ||
                      this_item.search_data.includes(person_filter.toLowerCase()) ?
                      <React-fragment key={this_item.person_id + 'frag' + index} >
                        <GridListTile
                          key={this_item.person_id + 'r' + index}
                          style={{ marginBottom: '0px', marginTop: '0px' }}
                          cols={1}
                        >
                          <Paper
                            component={Box}
                            p={2}
                            mt={0} mb={1}
                            style={{ marginBottom: '0px', marginTop: '5px' }}
                            textAlign='left'
                            onClick={() => {

                            }}
                            square>
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                              <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                                <React.Fragment key={`act_box_${this_item.person_id}`}>
                                  <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                    <React.Fragment key={`normal_row_${this_item.person_id}`}>
                                      <Box display='flex' flexGrow={1} flexDirection='column'>
                                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                          <Typography variant='h5' className={classes.lastName} >{this_item.last || this_item.display_name}</Typography>
                                          <Typography variant='h5' className={classes.firstName}>{this_item.first}</Typography>
                                        </Box>
                                        <Typography variant='body1'>{this_item.location}</Typography>
                                        {!this_item.search_data &&
                                          <Typography variant='body1'>{'No Search Data'}</Typography>
                                        }
                                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                          {(this_item.preferred_method === 'sms' ?
                                            <Typography className={classes.preferenceLine} >{`prefers text at ${this_item.cell}`}</Typography>
                                            :
                                            (this_item.preferred_method === 'voice' ?
                                              <Typography className={classes.preferenceLine} >{`prefers voice call to ${this_item.home}`}</Typography>
                                              :
                                              (this_item.preferred_method === 'email' ?
                                                <Typography className={classes.preferenceLine} >{`prefers e-Mail at ${this_item.email}`}</Typography>
                                                :
                                                (this_item.preferred_method === 'time_based' ?
                                                  <Typography className={classes.preferenceLine} >{`preference varies by time`}</Typography>
                                                  :
                                                  null))))
                                          }
                                        </Box>
                                      </Box>
                                      <IconButton
                                        onClick={() => { handlePatientEdit(this_item.person_id, index); }}
                                        variant='contained'
                                        size='small'>
                                        <EditIcon />
                                      </IconButton>
                                      <IconButton
                                        onClick={() => {
                                          setConfirmMessage(`Confirm removing ${this_item.first} ${this_item.last || this_item.display_name} from the ${pGroupName} ${pGroupName.includes('roup') ? '' : ' Group'}`);
                                          setConfirmPerson(this_item.person_id);
                                          setConfirmIndex(index);
                                          setDeletePending(true);
                                          setForceRedisplay(false);
                                        }}
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                      <IconButton
                                        onClick={() => {
                                          setPromptForMessage(true);
                                          setMessageType(this_item.preferred_method);
                                          setRecipient(`${this_item.first} ${this_item.last || this_item.display_name}:` + this_item.person_id);
                                        }}
                                        variant='contained'
                                        size='small'>
                                        <SendIcon />
                                      </IconButton>
                                    </React.Fragment>
                                  </Box>
                                </React.Fragment>
                              </Box>
                            </Box>
                          </Paper>
                        </GridListTile>
                      </React-fragment>
                      : null
                    )
                  ))}
                </GridList>
              </Grid>
              {showPatientDialog &&
                <PatientDialog
                  patient={personRec}
                  picture={""}
                  open={true}
                  onClose={(updatedPerson) => {
                    if (updatedPerson) {
                      workingMemberList[editIndex].preferred_method = updatedPerson.prefMethod;
                      workingMemberList[editIndex].home = updatedPerson.voice;
                      workingMemberList[editIndex].cell = updatedPerson.sms;
                      workingMemberList[editIndex].email = updatedPerson.email;
                      workingMemberList[editIndex].last = updatedPerson.last;
                      workingMemberList[editIndex].first = updatedPerson.first;
                      workingMemberList[editIndex].location = updatedPerson.location;
                      workingMemberList[editIndex].search_data = updatedPerson.search_data.toLowerCase();
                    }
                    setShowPatientDialog(false);
                  }}
                />
              }
              {showAddPrompt &&
                <PersonFilter
                  peopleList={peopleList}
                  onCancel={() => {
                    setShowAddPrompt(false);
                  }}
                  onSelect={(selectedPerson) => {
                    setShowAddPrompt(false);
                    handleAddPersonToGroup(selectedPerson.split(':')[1], pGroup);
                  }}
                >
                </PersonFilter>
              }
              {deletePending &&
                <AVAConfirm
                  promptText={confirmMessage}
                  onCancel={() => {
                    setDeletePending(false);
                  }}
                  onConfirm={() => {
                    handleRemoveGroupMember(confirmPerson, confirmIndex);
                    setDeletePending(false);
                  }}
                >
                </AVAConfirm>
              }
              {promptForMessage &&
                <AVATextInput
                  promptText={`What should your ${messageType === 'time_based' ? '' : (messageType === 'sms' ? 'text' : messageType)} message to ${recipient.split(':')[0]} say?`}
                buttonText='Send'  
                onCancel={() => { setPromptForMessage(false); }}
                  onSave={(messageText) => {
                    setPromptForMessage(false);
                    handleSendMessage(messageText, recipient, messageType);
                  }}
                />
              }
            </Box>
          </Paper>
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Button className={classes.reject} size='small' variant='contained' onClick={onReset}>
              {'Done'}
            </Button>
            <Button
              className={classes.confirm}
              size='small'
              variant='contained'
              onClick={() => {
                setShowAddPrompt(true);
              }}>
              {'Add Member'}
            </Button>
            <IconButton
              onClick={() => { handlePrintDirectory(pGroup); }}
              variant='contained'
              size='small'>
              <PrintIcon />
            </IconButton>
            <IconButton
              onClick={() => { handlePrintRoster(pGroup); }}
              variant='contained'
              size='small'>
              <StorageOutlined />
            </IconButton>
            <IconButton
              onClick={() => {
                setPromptForMessage(true);
                setMessageType('Group');
                setRecipient(pGroupName + ':group=' + pClient + '~' + pGroup)
              }}
              variant='contained'
              size='small'>
              <SendIcon />
            </IconButton>
          </DialogActions>
        </React.Fragment>
      }
    </Dialog>
  );
};