import React from 'react';
import { titleCase, updateDb, deleteDbRec, sentenceCase, parseNumeric, cl, dbClient } from '../../util/AVAUtilities';
import useSession from '../../hooks/useSession';
import { getObservationKeys, getObservationItems } from '../../util/AVAObservations';
import AVAConfirm from './AVAConfirm';
import { makeDate } from '../../util/AVADateTime';

import GridListTile from '@material-ui/core/GridListTile';
import TextField from '@material-ui/core/TextField';

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
import AddIcon from '@material-ui/icons/PlaylistAdd';

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

  let displayed_ObservationName = '';

  const { state } = useSession();

  const [reactData, setReactData] = React.useState({
    editMode: false,
    addMode: false,
    savedRequestUpdates: [],
    observationItemMode: false,
    oIValues: [],
    oIImage: '',
    oIKey: '',
    ogSelectedObservation: {},
    newObservationName: '',
    loadMode: false,
    deletePending: false,
    selectedObservation: {},
    recipeList: [],
    oiCharacteristics: state.session.observation_item_characteristics || 
      [
        {
          "description": "Calories",
          "uom": "",
          "code": "calories"
        },
        {
          "description": "Cholesterol",
          "uom": "mg",
          "code": "cholesterol"
        },
        {
          "description": "Sodium",
          "uom": "mg",
          "code": "sodium"
        },
        {
          "description": "Total Carbs",
          "uom": "g",
          "code": "total_carb"
        },
        {
          "description": "Total Fat",
          "uom": "g",
          "code": "total_fat"
        }
      ]
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

  async function loadOIValues(OIKey) {
    let OIObj = await getObservationItems(OIKey);
    if (Object.keys(OIObj).length === 0) {
      return [];
    }
    let OIValues = reactData.oiCharacteristics.map(c => {
      let response = '';
      if (OIObj[c.code]) {
        if (OIObj[c.code].value) {
          response = OIObj[c.code].value.toString();
          if (OIObj[c.code].uom) {
            response += ` ${OIObj[c.code].uom}`;
          }
        }
        else if (OIObj[c.code].display_value) {
          response = ` ${OIObj[c.code].display_value}`;
        }
      }
      return response;
    });
    return {
      values: OIValues,
      oIName: (OIObj.hasOwnProperty('observation_name') ? OIObj['observation_name'].display_value : null),
      image: (OIObj.hasOwnProperty('image') ? OIObj['image'].display_value : null)
    };
  }

  async function handleAddOItem(oIName, newDataList) {
    let oKey = reactData.oIKey;
    if (!reactData.oIogName || (reactData.oIogName === `Item ${oKey}`)) {
      let oIRec = {
        observation_key: oKey,
        display_value: oIName,
        characteristic: 'observation_name',
      };
      cl({ 'Put to Observation_Items': oIRec });
      await dbClient
        .put({
          TableName: 'Observation_Items',
          Item: oIRec
        })
        .promise()
        .catch(error => {
          cl(`Bad put to Observation_Items - caught error is: ${error}`);
        });
    }
    for (let n = 0; n < newDataList.length; n++) {
      if (newDataList[n] && (newDataList[n].toString().length > 0)) {
        let oIRec = {
          observation_key: oKey,
          characteristic: reactData.oiCharacteristics[n].code,
        };
        let checkN = parseNumeric(newDataList[n]);
        if (!checkN.isNumeric) {
          oIRec.display_value = newDataList[n];
        }
        else {
          oIRec.value = checkN.value;
          if (checkN.hasText) {
            oIRec.uom = checkN.textValue;
          }
          else if (reactData.oiCharacteristics[n].uom) {
            oIRec.uom = reactData.oiCharacteristics[n].uom;
          }
        }
        cl({ 'Put to Observation_Items': oIRec });
        await dbClient
          .put({
            TableName: 'Observation_Items',
            Item: oIRec
          })
          .promise()
          .catch(error => {
            cl(`Bad put to Observation_Items - caught error is: ${error}`);
          });
      }
    }
    return oKey;
  }

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
    filteredRecipeList.push({
      key: '*** Tap here to add new ***',
      value: '*% select_new %*'
    });
    pObs.listIndex = index;
    updateReactData({
      editMode: true,
      ogSelectedObservation: pObs,
      selectedObservation: pObs,
      filteredRecipeList: filteredRecipeList
    }, true);
  };

  const handleAddObservation = async (pObs_name, index) => {
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
    let obsWords = pObs_name.toLowerCase().trim().split(/\s+/).filter(w => {
      return !((w === 'with') || (w === 'w/'));
    });
    let filteredRecipeList = reactData.recipeList.filter((r, x) => {
      return (obsWords.some(w => {
        return (r.key.toLowerCase().includes(w));
      }));
    });
    filteredRecipeList.push({
      key: '*** Tap here to add new ***',
      value: '*% select_new %*'
    });
    let pObs = {
      listIndex: index,
      observation_code: pObs_name
    };
    let ogSelectedObservation = {};
    if (observationList.length === 0) {
      let this_dataKey = makeDate(keyDate);
      ogSelectedObservation = {
        rightSide: this_dataKey.obs,
        client_id: state.session.client_id,
        date_key: this_dataKey.ymd
      };
    }
    else {
      ogSelectedObservation = {
        rightSide: observationList[observationList.length - 1].composite_key.match(/_(?:.(?!_))+$/gm),
        client_id: observationList[0].client_id,
        date_key: observationList[0].date_key
      }
    }
    updateReactData({
      editMode: true,
      addMode: true,
      ogSelectedObservation: ogSelectedObservation,
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
    let oldRightSide = original_data.rightSide || original_data.composite_key.match(/_(?:.(?!_))+$/gm);
    let newCompositeKey = `${original_data.client_id}~${update_data[1]}${oldRightSide}`;
    if (original_data.composite_key !== newCompositeKey) {
      newData.composite_key = newCompositeKey;
      newData.observation_type = update_data[1];
      newData.sort_order = `${update_data[1]}${oldRightSide}`;
    }
    if (original_data.observation_key !== update_data[2]) {
      newData.observation_key = update_data[2];
    }
    if (original_data.description !== update_data[3]) {
      newData.description = update_data[3];
    }
    if (Object.keys(newData).length > 0) {
      if (original_data.composite_key) {
        updateDb([{
          table: 'Observations',
          key: {
            composite_key: original_data.composite_key || newData.composite_key,
            observation_code: original_data.observation_code || newData.observation_code
          },
          data: newData
        }]);
        Object.assign(observationList[original_data.listIndex], newData);
      }
      else {
        newData.client_id = original_data.client_id;
        newData.date_key = original_data.date_key;
        await dbClient
          .put({
            TableName: 'Observations',
            Item: newData
          })
          .promise()
          .catch(error => {
            console.log(`caught error putting to Observations; error is:`, error);
          });
        observationList.push(Object.assign({}, newData, {
          sort_key: newData.observation_type
        }));
        updateReactData({
          newObservationName: ''
        }, false);
      }
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
                                    <Typography className={classes.recipeCode}>{`Item code ${this_item.observation_key}`}</Typography>
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
              <GridListTile
                key={'new_item.composite_key-r' + observationList.length}
                style={{ marginBottom: '0px', marginTop: '0px' }}
                cols={1}
              >
                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                    <React.Fragment key={`act_box_new_item.id`}>
                      <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                        <React.Fragment key={`new_row_new_item.id`}>
                          <Box className={classes.listItem} display='flex' flexGrow={1} flexDirection='column'>
                            <TextField
                              className={classes.observationLine}
                              inputProps={{ style: { fontSize: `1.5rem` } }}
                              id={`prompt-new`}
                              key={`prompt-new`}
                              value={reactData.newObservationName ? reactData.newObservationName : ''}
                              onChange={(event) => {
                                displayed_ObservationName = event.target.value;
                                updateReactData({
                                  newObservationName: displayed_ObservationName
                                }, true);
                              }}
                              FormHelperTextProps={{ style: { fontSize: '0.75rem', lineHeight: '0.9rem' } }}
                              helperText={`Add something new here`}
                              autoComplete='off'
                            />
                          </Box>
                          <IconButton
                            aria-label="search_icon"
                            onClick={() => {
                              handleAddObservation(reactData.newObservationName, observationList.length);
                            }}
                            edge="end"
                          >
                            {<AddIcon />}
                          </IconButton>
                        </React.Fragment>
                      </Box>
                    </React.Fragment>
                  </Box>
                </Box>
              </GridListTile>
            </React.Fragment>
          }
          {reactData.editMode &&
            <AVATextInput
              titleText={reactData.addMode ? 'Adding an item' : `Update this Item`}
              promptText={['Name', '[select]Type', '[select/edit]Item Code', 'Description']}
              valueText={[
                reactData.selectedObservation.observation_code,
                reactData.selectedObservation.observation_type || reactData.selectedObservation.sort_key,
                reactData.selectedObservation.observation_key,
                reactData.selectedObservation.description
              ]}
              selectionList={[null, state.session.menu_types.sort(), reactData.filteredRecipeList]}
              buttonText={reactData.addMode ? 'Add' : 'Update'}
              onCancel={() => {
                updateReactData({
                  editMode: false
                }, true);
              }}
              onSave={async (requestUpdates) => {
                if (requestUpdates[2] === '*% select_new %*') {
                  let now$ = new Date().getTime().toString();
                  updateReactData({
                    oIKey: `${now$.slice(3, 7)}-${now$.slice(7, 11)}`,
                    oIValues: [],
                    oIImage: null,
                    oIogName: null,
                    savedRequestUpdates: requestUpdates,
                    observationItemMode: true,
                    editMode: false
                  }, true);
                }
                else if (requestUpdates[2].startsWith('*% edit_item %*')) {
                  let OIKey = requestUpdates[2].slice(15).trim();
                  let OIInfo = await loadOIValues(OIKey);
                  updateReactData({
                    oIKey: OIKey,
                    oIValues: OIInfo.values,
                    oIImage: OIInfo.image,
                    oIogName: OIInfo.oIName,
                    savedRequestUpdates: requestUpdates,
                    observationItemMode: true,
                    editMode: false
                  }, true);
                }
                else {
                  await handleUpdateObservation(reactData.ogSelectedObservation, requestUpdates);
                  updateReactData({
                    editMode: false
                  }, true);
                }
              }}
            />
          }
          {reactData.observationItemMode &&
            <AVATextInput
              titleText={reactData.oIogName || reactData.savedRequestUpdates[0]}
              promptText={reactData.oiCharacteristics.map(c => { return `${c.description} ${c.uom ? '(' + c.uom + ')' : ''}`})}
              valueText={reactData.oIValues}
              buttonText={((reactData.oIValues.length === 0) ? 'Add' : 'Update')}
              options={{
                allowAttach: 'Add Image',
                attachmentList: (reactData.oIImage ? [{
                  Key: 'Current Image',
                  Location: reactData.oIImage,
                }] : false)
              }}
              onCancel={() => {
                updateReactData({
                  selectedObservation: Object.assign(
                    {},
                    reactData.ogSelectedObservation,
                    {
                      observation_code: reactData.savedRequestUpdates[0],
                      observation_type: reactData.savedRequestUpdates[1]
                    }),
                  observationItemMode: false,
                  editMode: true
                }, true);
              }}
              onSave={async (newOItemData) => {
                let newOCode = await handleAddOItem(reactData.savedRequestUpdates[0], newOItemData);
                if (!reactData.oIogName) {          // indicates this is a new entry
                  reactData.filteredRecipeList.splice(-1, 0, {
                    value: newOCode,
                    key: `${reactData.savedRequestUpdates[0]} (${newOCode})`
                  });
                  reactData.recipeList.splice(-1, 0, {
                    value: newOCode,
                    key: `${reactData.savedRequestUpdates[0]} (${newOCode})`
                  });
                }
                updateReactData({
                  filteredRecipeList: reactData.filteredRecipeList,
                  selectedObservation: Object.assign(
                    {},
                    reactData.ogSelectedObservation,
                    {
                      observation_code: reactData.savedRequestUpdates[0],
                      observation_type: reactData.savedRequestUpdates[1],
                      observation_key: newOCode
                    }),
                  observationItemMode: false,
                  editMode: true
                }, true);
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