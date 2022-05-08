import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';

import PatientDialog from '../dialogs/PatientDialog';

const useStyles = makeStyles(theme => ({
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  redBackground: {
    background: 'red',
  },
  firstName: {
    marginLeft: theme.spacing(1),
  },
  lastName: {
    fontWeight: 'bold',
  }
}));


export default ({ groupMemberList, pClient, pGroup, onReset }) => {

  const classes = useStyles();

  const [deletePending, setDeletePending] = React.useState(null);
  const [personRec, setPersonRec] = React.useState();
  const [showPatientDialog, setShowPatientDialog] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const handleRemoveGroupMember = async (pPerson) => {
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

    params.Payload = JSON.stringify({
      action: "remove_person_from_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": groupMemberList
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
    onReset();
  };

  const handlePatientEdit = async (pPerson) => {
    let invokeFailed = false;
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
    groupMemberList?.length > 0 &&
    <Box >
      <Grid item>
        <GridList cellHeight='auto' cols={1} key='gridList'>
          {groupMemberList.map((this_item, index) => (
            <React-fragment key={this_item.activity_code + 'frag' + index} >
              <GridListTile
                key={this_item.activity_code + 'r' + index}
                style={{ marginBottom: '0px', marginTop: '0px' }}
                cols={1}
              >
                <Paper
                  component={Box}
                  p={2}
                  mt={0} mb={1}
                  variant='outlined'
                  style={{ marginBottom: '0px', marginTop: '5px' }}
                  textAlign='left'
                  onClick={() => {

                  }}
                  square>
                  <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                    <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                      <React.Fragment key={`act_box_${this_item.activity_code}`}>
                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                          <React.Fragment key={`normal_row_${this_item.activity_code}`}>
                            <Box display='flex' flexGrow={1} flexDirection='column'>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                <Typography variant='h5' className={classes.lastName} >{this_item.last || this_item.display_name}</Typography>
                                <Typography variant='h5' className={classes.firstName}>{this_item.first}</Typography>
                              </Box>
                              <Typography variant='body1'>{this_item.location}</Typography>
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
                              onClick={() => { handlePatientEdit(this_item.person_id); }}
                              variant='contained'
                              size='small'>
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              aria-label="search_icon"
                              className={deletePending === index ? classes.redBackground : null}
                              onClick={() => {
                                if (deletePending === index) {
                                  setDeletePending(null);
                                  handleRemoveGroupMember(this_item.person_id);
                                }
                                else {
                                  setDeletePending(index);
                                }
                              }}
                              edge="end"
                            >
                              {deletePending === index ? <DeleteForeverIcon /> : <DeleteIcon />}
                            </IconButton>
                          </React.Fragment>
                        </Box>
                      </React.Fragment>
                    </Box>
                  </Box>
                </Paper>
              </GridListTile>
            </React-fragment>
          ))}
        </GridList>
        </Grid>
        {showPatientDialog &&
          <PatientDialog
            patient={personRec}
            picture={""}
            open={true}
            onClose={() => {
              setShowPatientDialog(false);
              onReset();
            }}
          />
        }
    </Box>
  );
};