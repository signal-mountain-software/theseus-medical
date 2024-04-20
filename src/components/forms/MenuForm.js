import React from 'react';
import { titleCase, updateDb, deleteDbRec, sentenceCase } from '../../util/AVAUtilities';
import useSession from '../../hooks/useSession';
import { getObservationKeys } from '../../util/AVAObservations';
import AVAConfirm from './AVAConfirm';

import GridListTile from '@material-ui/core/GridListTile';

import List from '@material-ui/core/List';

// import EditObservation from '../forms/EditObservation';
import AVATextInput from './AVATextInput';
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
  recipeCode: {
    fontSize: theme.typography.fontSize * 0.8,
    marginBottom: 0,
    marginLeft: theme.spacing(2)
  },
  observationLine: {
    marginTop: 0,
    fontSize: theme.typography.fontSize * 1.8,
  },
}));

export default ({ observationList, pClient, keyDate, filter, onReset, handleAbort, handleLoad }) => {

  const classes = useStyles();

  let filterText = filter ? filter.toLowerCase() : null;

  const { state } = useSession();

  const [reactData, setReactData] = React.useState({
    editMode: false,
    loadMode: false,
    deletePending: false,
    selectedObservation: {},
    recipeList: []
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(forceRedisplay => !forceRedisplay);
    }
  };

  const handleEditObservation = async (pObs, index) => {
    if (reactData.recipeList.length === 0) {
      let recipeRecs = await getObservationKeys({ characteristic: 'observation_name' });
      let unsortedRecipeList = recipeRecs.map(r => {
        return {
          key: `${sentenceCase(r.display_value)} (${r.observation_key})`,
          value: r.observation_key
        };
      });
      updateReactData({
        recipeList: unsortedRecipeList.sort((a, b) => {
          return ((a.key < b.key) ? -1 : 1);
        }),
      });
    }
    let obsWords = pObs.observation_code.toLowerCase().trim().split(/\s+/).filter(w => {
      return !((w === 'with') || (w === 'w/'));
    });
    let filteredRecipeList = reactData.recipeList.filter((r, x) => {
      return ((r.value === pObs.observation_key) || (obsWords.some(w => {
        return (r.key.toLowerCase().includes(w));
      })));
    });
    pObs.listIndex = index;
    updateReactData({
      editMode: true,
      selectedObservation: pObs,
      filteredRecipeList: filteredRecipeList
    }, true);
  };

  const handleUpdateObservation = async (original_data, update_data) => {
    // pData in the form {["table": <tablename>, "key": {"key1": "keydata1", etc...}, "data": {"field_name1": "new value", "field_name2", "new value", ...}]}
    let newData = {};
    if (original_data.observation_code !== update_data[0]) {
      newData.observation_code = update_data[0];
    }
    let oldRightSide = original_data.composite_key.match(/_(?:.(?!_))+$/gm);
    let newCompositeKey = `${original_data.client_id}~${update_data[1]}${oldRightSide}`;
    if (original_data.composite_key !== newCompositeKey) {
      newData.composite_key = newCompositeKey;
      newData.sort_key = update_data[1];
      newData.sort_order = `${oldRightSide}${update_data[1]}`;
    }
    if (original_data.observation_key !== update_data[2]) {
      newData.observation_key = update_data[2];
    }
    if (Object.keys(newData).length > 0) {
      updateDb([{
        table: 'Observations',
        key: {
          composite_key: original_data.composite_key,
          observation_code: original_data.observation_code
        },
        data: newData
      }]);
      Object.assign(observationList[original_data.listIndex], newData);
    }
  };

  const handleDeleteObservation = async (original_data) => {
    // pData in the form {["table": <tablename>, "key": {"key1": "keydata1", etc...}]
    deleteDbRec([{
      table: 'Observations',
      key: {
        composite_key: original_data.composite_key,
        observation_code: original_data.observation_code
      },
    }]);
    observationList.splice(original_data.listIndex, 1);
  };

  return (
    ((forceRedisplay || true) &&
      (observationList?.length > 0) &&
      <Box >
        <List >
          {!reactData.editMode && !reactData.loadMode && !reactData.deletePending &&
            <React.Fragment>
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
                                  <Typography className={classes.typeOfLine}>{titleCase(this_item.composite_key.replace(this_item.client_id, '').split(/[~_]/g).slice(1, -1).join(' '))}</Typography>
                                  <Typography className={classes.observationLine}>{this_item.observation_code.replace(/~/g, '')}</Typography>
                                  {this_item.observation_key && (this_item.observation_key !== '') && (this_item.observation_key !== '0') &&
                                    <Typography className={classes.recipeCode}>{`Recipe code ${this_item.observation_key}`}</Typography>
                                  }
                                </Box>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => { handleEditObservation(this_item, index); }}
                                  edge="end"
                                >
                                  {<EditIcon />}
                                </IconButton>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => {
                                    this_item.listIndex = index;
                                    updateReactData({
                                      confirmMessage: `Confirm removing ${this_item.observation_code.replace(/~/g, '')} from the ${keyDate} menu?`,
                                      selectedObservation: this_item,
                                      deletePending: true
                                    }, true);
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
            </React.Fragment>
          }
          {reactData.editMode &&
            <AVATextInput
              titleText={`Update this Item`}
              promptText={['Description', '[select]Type', '[select=0]Recipe Code']}
              valueText={[reactData.selectedObservation.observation_code, reactData.selectedObservation.sort_key, reactData.selectedObservation.observation_key]}
              selectionList={[null, state.session.menu_types.sort(), reactData.filteredRecipeList]}
              buttonText='Update'
              onCancel={() => {
                updateReactData({
                  editMode: false
                }, true);
              }}
              onSave={async (requestUpdates) => {
                updateReactData({
                  editMode: false
                }, true);
                await handleUpdateObservation(reactData.selectedObservation, requestUpdates);
              }}
            />
          }
          {reactData.loadMode &&
            <LoadMenuSpreadsheet
              showUpload={reactData.loadMode}
              handleClose={() => {
                updateReactData({
                  loadMode: false
                }, true);
                onReset();
              }}
            />
          }
          {reactData.deletePending &&
            <AVAConfirm
              promptText={reactData.confirmMessage}
              onCancel={() => {
                updateReactData({
                  deletePending: false
                }, true);
              }}
              onConfirm={() => {
                handleDeleteObservation(reactData.selectedObservation);
                updateReactData({
                  deletePending: false
                }, true);
              }}
            >
            </AVAConfirm>
          }
        </List>
      </Box>
    ));
};