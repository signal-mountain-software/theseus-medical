import React from 'react';
import { lambda } from '../../util/AVAUtilities';
import { useSnackbar } from 'notistack';

import AVAConfirm from './AVAConfirm';

import GridListTile from '@material-ui/core/GridListTile';

import List from '@material-ui/core/List';

import EditObservation from '../forms/EditObservation';
import LoadMenuSpreadsheet from '../forms/LoadMenuSpreadsheet';

import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';

const useStyles = makeStyles(theme => ({
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  typeOfLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginBottom: 0,
  },
  observationLine: {
    marginTop: 0,
    fontSize: theme.typography.fontSize * 1.8,
  },
}));

export default ({ observationList, pClient, keyDate, filter, onReset, handleAbort, handleLoad }) => {

  const classes = useStyles();

  let filterText = filter ? filter.toLowerCase() : null;

  const [editMode, setEditMode] = React.useState(false);
  const [loadMode, setLoadMode] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(null);
  const [deleteObs, setDeleteObs] = React.useState();
  const [selectedObservation, setSelectedObservation] = React.useState({});
  const [confirmMessage, setConfirmMessage] = React.useState('');

  const { enqueueSnackbar } = useSnackbar();

  function sentenceCase(pString) {
    return pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase();
  }

  const handleEditObservation = async (pObs) => {
    setEditMode(true);
    setSelectedObservation(pObs);
  };

  const handleDeleteObservation = async (pObs) => {
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
      <List >
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
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                    <React.Fragment key={`act_box_${this_item.id}`}>
                      <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                        <React.Fragment key={`normal_row_${this_item.id}`}>
                          <Box className={classes.listItem} display='flex' flexGrow={1} flexDirection='column'>
                            <Typography className={classes.typeOfLine}>{sentenceCase(this_item.composite_key.split(/[~_]/g).slice(1, -1).join('_'))}</Typography>
                            <Typography className={classes.observationLine}>{this_item.observation_code.replace(/~/g, '')}</Typography>
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
                              setConfirmMessage(`Confirm removing ${this_item.observation_code.replace(/~/g, '')} from the ${keyDate} menu?`);
                              setDeleteObs(this_item);
                              setDeletePending(true);
                            }}
                            edge="end"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </React.Fragment>
                      </Box>
                    </React.Fragment>
                  </Box>
                </Box>
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
            handleCancel={() => {
              setEditMode(false);
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
        {deletePending &&
          <AVAConfirm
            promptText={confirmMessage}
            onCancel={() => {
              setDeletePending(false);
            }}
            onConfirm={() => {
              handleDeleteObservation(deleteObs);
              setDeletePending(false);
            }}
          >
          </AVAConfirm>
        }
      </List>
    </Box>
  );
};