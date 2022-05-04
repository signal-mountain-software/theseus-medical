import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import EditActivity from '../forms/EditActivity';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';

export default ({ eventActivityList, pClient, onReset }) => {

  const [editMode, setEditMode] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(null);
  const [selectedEventActivity, setSelectedEventActivity] = React.useState({});

  const { enqueueSnackbar } = useSnackbar();

  const handleEditEventActivity = async (pObs) => {
    setEditMode(true);
    setSelectedEventActivity(pObs);
  };

  const handleDeleteEventActivity = async (pObs) => {
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

    params.Payload = JSON.stringify({
      action: "delete",
      clientId: pObs.client_event_id.split(/[~_]/g)[0],
      request: {
        "activity_code": pObs.activity_code,
        "event_id": pObs.client_event_id
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

  return (
    eventActivityList?.length > 0 &&
    <Box >
      <Grid item>
        <GridList cellHeight='auto' cols={1} key='gridList'>
          {eventActivityList.map((this_item, index) => (
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
                              <Typography variant='h5'>{this_item.activity_name}</Typography>
                            </Box>
                            <IconButton
                              aria-label="search_icon"
                              onClick={() => { handleEditEventActivity(this_item); }}
                              edge="end"
                            >
                              {<EditIcon />}
                            </IconButton>
                            <IconButton
                              aria-label="search_icon"
                              onClick={() => {
                                if (deletePending === index) {
                                  setDeletePending(null);
                                  handleDeleteEventActivity(this_item);
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
          {editMode &&
            <EditActivity
              pClient={pClient}
              activity={selectedEventActivity}
              showDialog={editMode}
              handleClose={() => {
                setEditMode(false);
                onReset();
              }}
            />
          }
        </GridList>
      </Grid>
    </Box>
  );
};