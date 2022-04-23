import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import EditObservation from '../forms/EditObservation';
import LoadMenuSpreadsheet from '../forms/LoadMenuSpreadsheet';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';

export default ({ observationList, pClient, keyDate, filter, onReset }) => {

  let filterText = filter ? filter.toLowerCase() : null;

  const [editMode, setEditMode] = React.useState(false);
  const [loadMode, setLoadMode] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(null);
  const [selectedObservation, setSelectedObservation] = React.useState({});

  const { enqueueSnackbar } = useSnackbar();

  if ((observationList.length === 0) || (observationList[observationList.length - 1].observation_code !== '%%add%%')) {
    observationList.push({ observation_code: '%%add%%' });
  }

  function sentenceCase(pString) {
    return pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase();
  }

  const handleEditObservation = async (pObs) => {
    setEditMode(true);
    setSelectedObservation(pObs);
  };

  const handleAddObservation = async () => {
    setEditMode(true);
    let pDate = new Date(keyDate);
    let pYMD = pDate.getFullYear() + '.' + (pDate.getMonth() + 1) + '.' + pDate.getDate();
    let newEntry = {
      "composite_key": `${pClient}~ _${pYMD}`,
      "observation_code": '',
      "sort_order": `${pYMD}_`
    };
    setSelectedObservation(newEntry);
  };

  const handleDeleteObservation = async (pObs) => {
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

    params.Payload = JSON.stringify({
      action: "delete",
      clientId: pObs.composite_key.split(/[~_]/g)[0],
      request: {
        "existing_key": {
          "composite_key": pObs.composite_key,
          "observation_code": pObs.observation_code
        }
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
    observationList?.length > 0 &&
    <Box >
      <Grid item>
        <GridList cellHeight='auto' cols={1} key='gridList'>
          {observationList.map((this_item, index) => (
            (filterText && !this_item.observation_code.toLowerCase().includes(filterText))
              ? null
              :
              <React-fragment key={this_item.composite_key + 'frag' + index} >
                <GridListTile
                  key={this_item.id + 'r' + index}
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
                        <React.Fragment key={`act_box_${this_item.id}`}>
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                            {this_item.observation_code === '%%add%%' ?
                              <React.Fragment key={`add_row_${this_item.id}`}>
                                <Box display='flex' flexGrow={1} flexDirection='column'>
                                  <Typography variant='h5'>{index === 0 ? 'Add something?' : 'Add more?'}</Typography>
                                </Box>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => { handleAddObservation(); }}
                                  edge="end"
                                >
                                  {<AddCircleOutlineIcon />}
                                </IconButton>
                              </React.Fragment>
                              :
                              <React.Fragment key={`normal_row_${this_item.id}`}>
                                <Box display='flex' flexGrow={1} flexDirection='column'>
                                  <Typography variant='h6'>{sentenceCase(this_item.composite_key.split(/[~_]/g).slice(1, -1).join('_'))}</Typography>
                                  <Typography variant='h5'>{this_item.observation_code.replace(/~/g, '')}</Typography>
                                </Box>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => { handleEditObservation(this_item); }}
                                  edge="end"
                                >
                                  {<EditIcon />}
                                </IconButton>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => {
                                    if (deletePending === index) {
                                      setDeletePending(null);
                                      handleDeleteObservation(this_item);
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
                            }

                          </Box>
                        </React.Fragment>
                      </Box>
                    </Box>
                  </Paper>
                </GridListTile>
              </React-fragment>
          ))}
          {editMode &&
            <EditObservation
              observation={selectedObservation}
              showDialog={editMode}
              handleClose={() => {
                setEditMode(false);
                onReset();
              }}
            />
          }
          {loadMode &&
            <LoadMenuSpreadsheet
              showUpload={loadMode}
              handleClose={() => {
                setLoadMode(false);
                onReset();
              }}
            />
          }
        </GridList>
      </Grid>
    </Box>
  );
};