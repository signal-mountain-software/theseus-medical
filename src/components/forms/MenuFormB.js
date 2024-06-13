import React from 'react';
import { titleCase, updateDb, deleteDbRec, sentenceCase, parseNumeric, cl, dbClient, makeArray, deepCopy } from '../../util/AVAUtilities';
import useSession from '../../hooks/useSession';
import { getObservationItems } from '../../util/AVAObservations';
import AVAConfirm from './AVAConfirm';
import { makeDate, addDays } from '../../util/AVADateTime';
import { AVATextStyle } from '../../util/AVAStyles';
import { buildQualifiers } from '../../util/AVAActivityLoader';
import Select from "react-dropdown-select";

import { useSnackbar } from 'notistack';

import { Collapse, Radio } from '@material-ui/core';

import AVATextInput from './AVATextInput';
import LoadMenuSpreadsheet from './LoadMenuSpreadsheet';

import { DialogContent, Box, Typography, IconButton } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';

import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import ExpandLessIcon from '@material-ui/icons/VisibilityOff';
import ExpandMoreIcon from '@material-ui/icons/Visibility';

const useStyles = makeStyles(theme => ({
  listItem: {
    justifyContent: 'space-between',
  },
  typeOfLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginBottom: 0,
  },
  dialogBox: {
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    minHeight: '100%',
  },
  innerBox: {
    paddingLeft: '4px',
    minHeight: '500px',
    //   maxHeight: '90%'
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

export default ({ observationList, recipeList, keyDate, onReset }) => {

  const classes = useStyles();

  const { state } = useSession();
  let local_service_details = {};
  const defaultCharacteristics = [
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
  ];

  const { enqueueSnackbar } = useSnackbar();

  const [reactData, setReactData] = React.useState({
    addMode: false,
    savedRequestUpdates: [],
    observationItemMode: false,
    oIValues: [],
    oIImage: '',
    oIKey: '',
    ogSelectedObservation: {},
    loadMode: false,
    deletePending: false,
    selectedObservation: {},
    recipeList: [],
    rowOpen: [],
    parm_keyDate: keyDate,
    visible_y: window.window.innerHeight,
    dateKey: makeDate(keyDate),
    oiCharacteristics: state.session.observation_item_characteristics || defaultCharacteristics,
    selectedMealType: null,
    selectedDateKey: null,
    selectedMenu: null,
    selectedArea: null,
    service_details: menuTypeList(),
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

  /*
  if (keyDate !== reactData.parm_keyDate) {
    getMenuDetails(makeDate(keyDate).obs);
    updateReactData({
      parm_keyDate: keyDate,
      dateKey: makeDate(keyDate),
    }, true);
  }
  */

  async function loadOIValues(OIKey) {
    let OIObj = await getObservationItems(OIKey);
    if (Object.keys(OIObj).length === 0) {
      return {
        values: [],
        oIName: null,
        image: null
      };
    }
    let OIValues = reactData.oiCharacteristics.map(c => {
      let response = '';
      if (OIObj[c.code]) {
        if (OIObj[c.code].value) {
          response = OIObj[c.code].value.toString();
          if (OIObj[c.code].uom) {
            if (OIObj[c.code].uom === '$') {
              response = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(OIObj[c.code].value);
            }
            else {
              response += ` ${OIObj[c.code].uom}`;
            }
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

  async function handleAddOItem(oKey, newDataList, newAttachmentList) {
    // newDataList[0] is observation_code
    let this_observationCode = newDataList.shift();
    if (!reactData.oIogName
      || (reactData.oIogName === `Item ${oKey}`)
      || (reactData.oIogName !== this_observationCode)
    ) {
      await dbClient
        .put({
          TableName: 'Observation_Items',
          Item: {
            observation_key: oKey,
            display_value: (this_observationCode && (this_observationCode.trim() !== '')) ? this_observationCode : reactData.selectedObservation.observation_code,
            characteristic: 'observation_name',
          }
        })
        .promise()
        .catch(error => {
          console.log(`Bad put to Observation_Items (Name) - caught error is: ${error}`);
        });
    }

    // newDataList[1] is item description
    let this_itemDescription = newDataList.shift();
    // all other entries in newDataList map to the oiCharacteristics array
    let new_MoreInfo = {};
    let OIwritten = 0;
    for (let n = 0; n < reactData.oiCharacteristics.length; n++) {
      if (newDataList[n] && (newDataList[n].toString().length > 0)) {
        let oIRec = {
          observation_key: oKey,
          characteristic: reactData.oiCharacteristics[n].code,
        };
        new_MoreInfo[reactData.oiCharacteristics[n].code] = newDataList[n];
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
        OIwritten++;
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
    // deal with attachments (images); use the first one only
    if (newAttachmentList && newAttachmentList.length > 0) {
      OIwritten++;
      await dbClient
        .put({
          TableName: 'Observation_Items',
          Item: {
            observation_key: oKey,
            characteristic: 'image',
            display_value: newAttachmentList[0]
          }
        })
        .promise()
        .catch(error => {
          cl(`Bad put to Observation_Items - caught error is: ${error}`);
        });
      new_MoreInfo['image'] = newAttachmentList[0];
    }
    else if (reactData.oIImage) {   // there was an image, but there isn't now
      await dbClient
        .delete({
          TableName: 'Observation_Items',
          Key: {
            observation_key: oKey,
            characteristic: 'image',
          }
        })
        .promise()
        .catch(error => {
          cl(`Bad delete on Observation_Items image for key ${oKey} - caught error is: ${error}`);
        });
    }
    // now update the Observation itself, adding the oKey and updating the description
    let this_observation = Object.assign(
      {},
      reactData.selectedObservation,
      {
        description: this_itemDescription,
      }
    );
    if (reactData.selectedObservation.observation_code !== this_observationCode) {
      this_observation.observation_code = this_observationCode;
    }
    if (OIwritten === 0) {
      delete this_observation.observation_key;
    }
    else {
      this_observation.observation_key = oKey;
    }
    if (this_observation.listIndex > -1) {
      Object.assign(observationList[this_observation.listIndex],
        this_observation,
      );
      observationList[this_observation.listIndex].moreInfo = new_MoreInfo;
    }
    delete this_observation.listIndex;
    delete this_observation.moreInfo;
    updateDb([{
      table: 'Observations',
      key: {
        composite_key: reactData.selectedObservation.composite_key,
        observation_code: reactData.selectedObservation.observation_code
      },
      data: this_observation
    }]);
    if (reactData.addMode) {
      // new style observations are composite_key as <client_id>~<category(entree, side, etc)>_<menu(date)>_<meal(dinner, lunch, etc)>_<room>
      observationList.unshift(this_observation);
    }
    return oKey;
  }

  function filterRecipeList(menu_category) {
    let response = recipeList.filter(this_recipe => {
      return (this_recipe.type && this_recipe.type.includes(menu_category));
    });
    return response;
  }

  function menuTypeList() {
    let dining_area = state.session.dining_structure.dining_area;
    /*
    let dining_area = {
      'Evergreen Room': {
        value: 'main',
        display_value: ['Evergreen', 'Room'],
        meal_service: {
          "lunch": {
            value: 'lunch',
            categories: ['entree', 'side', 'soup', 'salad', 'bread', 'dessert'],
            display_value: ['Lunch']
          },
          "dinner": {
            value: 'dinner',
            categories: ['entree', 'side', 'soup', 'salad', 'bread', 'dessert'],
            display_value: ['Dinner']
          },
          "all_day": {
            value: 'all-day',
            categories: ['entree', 'side', 'soup', 'salad', 'bread', 'dessert'],
            display_value: ['All', 'Day'],
            format: 'category_date'
          },
        }
      },
      'Village Square': {
        value: 'village',
        display_value: ['Village', 'Square'],
        meal_service: {
          "breakfast": {
            value: 'breakfast',
            categories: ['entree', 'side'],
            display_value: ['Breakfast']
          },
          "lunch": {
            value: 'lunch',
            categories: ['entree', 'side', 'soup', 'salad', 'bread', 'dessert'],
            display_value: ['Lunch']
          }
        }
      }
    };
    */
    let dates = {};
    for (let d = 0; d < 7; d++) {
      let this_date = makeDate(addDays(keyDate, d));
      dates[this_date.ymd] = {
        value: this_date.obs,
        ymd: this_date.ymd,
        display_value: this_date.dateOnly,
        display_value_day: (this_date.relative === 'Today' ? 'Today' : this_date.absolute.slice(0, 3))
      };
    }
    let menus = {
      'special': {
        value: '%date%',
        display_value: ['Daily', 'Specials']
      },
      'everyday': {
        value: 'always',
        display_value: ['Everyday', 'Options']
      }
    };
    local_service_details = {
      dining_area,
      dates,
      menus
    };
    return local_service_details;
  };

  React.useEffect(() => {
    async function initialize() {
      let updateObj = {
        service_details: menuTypeList()
      };
      if (!reactData.recipeList || (reactData.recipeList.length === 0)) {
        updateObj.recipeList = recipeList;
      }
      updateReactData(updateObj, true);
    }
    if (!reactData.parm_keyDate || (reactData.parm_keyDate !== keyDate)) {
      initialize();
    }
  }, [keyDate]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewObservation = async (values, menu_category) => {
    // new style observations are composite_key as Client~entree_2024.5.22_lunch_bistro (client_id!category_date_meal_room)
    let meal_type = selectedMealType('value');
    let useDate = selectedMenu('value');
    let menu_date = ((useDate === '%date%') ? selectedDate('value') : useDate);
    let newCompositeKey = `${state.session.client_id}~${menu_category}_${menu_date}_${meal_type}`;
    let room = selectedArea('value');
    if (room && (room !== '')) {
      newCompositeKey += `_${room}`;
    }
    let selected_okey = (Array.isArray(values) ? values[0].value : values.value);
    if (!selected_okey || (selected_okey.trim() === '')) {
      selected_okey = null;
    }
    let new_okey = `OKey_${new Date().getTime()}`;
    let pObs = {
      composite_key: newCompositeKey,
      observation_code: sentenceCase((Array.isArray(values) ? values[0].label : values.label)),
      observation_key: new_okey,
      date_key: ((useDate === '%date%') ? selectedDate('ymd') : useDate),
      client_id: state.session.client_id,
      observation_type: `${meal_type}_${menu_category}`,
      sort_order: `${meal_type}_${menu_category}`
    };
    updateReactData({
      addMode: true,
      oIKey: null,
      oIValues: null,
      oIImage: null,
      oIogName: null,
      observationItemMode: false,
      ogSelectedObservation: pObs,
      selectedObservation: pObs,
    }, false);
    let dataList = [pObs.observation_code, ''];
    if (selected_okey) {
      let OIInfo = await loadOIValues(selected_okey);
      dataList.push(...OIInfo.values);
    }
    await handleAddOItem(
      new_okey,
      dataList,
      []
    );
  };

  const handleEditObservation = async (pObs, index, menu, type) => {
    let obsWords = pObs.observation_code.toLowerCase().trim().split(/\s+/).filter(w => {
      return !((w === 'with') || (w === 'w/'));
    });
    let filteredRecipeList = recipeList.filter((r, x) => {
      return ((r.value === pObs.observation_key) || (obsWords.some(w => {
        return (r.label.toLowerCase().includes(w));
      })));
    });
    pObs.listIndex = index;
    pObs.observation_type = `${menu}_${type}`;
    let OIInfo = (pObs.observation_key ? await loadOIValues(pObs.observation_key) : {});
    updateReactData({
      addMode: (index === -1),
      oIKey: pObs.observation_key,
      oIValues: OIInfo.values,
      oIImage: OIInfo.image,
      oIogName: OIInfo.oIName,
      observationItemMode: true,
      ogSelectedObservation: pObs,
      selectedObservation: pObs,
      filteredRecipeList: filteredRecipeList
    }, true);
  };

  const selectedMealType = (return_type = 'key') => {
    // AKA "meal" - lunch, dinner, breakfast, allday, ...
    // return_type is 'key', 'display', or 'value'
    let check_key;
    if (reactData.selectedMealType
      && !reactData.service_details['dining_area'][selectedArea()]['meal_service'].hasOwnProperty(reactData.selectedMealType)) {
      check_key = Object.keys(reactData.service_details['dining_area'][selectedArea()]['meal_service'])[0];
    }
    else {
      check_key = reactData.selectedMealType || Object.keys(reactData.service_details['dining_area'][selectedArea()]['meal_service'])[0];
    }
    if (return_type === 'key') {
      return check_key;
    }
    else if (return_type === 'value') {
      return local_service_details['dining_area'][selectedArea()]['meal_service'][check_key].value;
    }
    else if (return_type === 'categories') {
      return local_service_details['dining_area'][selectedArea()]['meal_service'][check_key].categories;
    }
    else {
      let resp = local_service_details['dining_area'][selectedArea()]['meal_service'][check_key].display_value;
      if (Array.isArray(resp)) {
        return resp.join(' ');
      }
      else {
        return resp;
      }
    };
  };

  const selectedDate = (return_type = 'key') => {
    // AKA "menu" - always, weekend, tuesday, 2024.5.22, ...
    // return_type is 'key', 'display', or 'value'
    let check_key = reactData.selectedDateKey;
    if (!reactData.selectedDateKey) {
      if (return_type === 'display') {
        return 'Always Available';
      }
      else {
        check_key = Object.keys(local_service_details['dates'])[0];
      }
    }
    if (return_type === 'key') {
      return check_key;
    }
    else if (return_type === 'value') {
      return local_service_details['dates'][check_key].value;
    }
    else if (return_type === 'ymd') {
      return local_service_details['dates'][check_key].ymd;
    }
    else {
      return local_service_details['dates'][check_key].display_value;
    };
  };

  const selectedMenu = (return_type = 'key') => {
    // AKA "menu" - always, date
    // return_type is 'key', 'display', or 'value'
    let check_key = reactData.selectedMenu || Object.keys(local_service_details['menus'])[0];
    if (return_type === 'key') {
      return check_key;
    }
    else if (return_type === 'value') {
      return local_service_details['menus'][check_key].value;
    }
    else {
      return local_service_details['menus'][check_key].display_value;
    };
  };

  const selectedArea = (return_type = 'key') => {
    // AKA "room" - main, pool, bistro, ...
    // return_type is 'key', 'display', or 'value'
    let check_key = reactData.selectedArea || Object.keys(reactData.service_details['dining_area'])[0];
    if (return_type === 'key') {
      return check_key;
    }
    else if (return_type === 'value') {
      return local_service_details['dining_area'][check_key].value;
    }
    else {
      return local_service_details['dining_area'][check_key].display_value;
    };
  };

  function OKtoShow(this_observation, displayed_category) {
    let useDate = (selectedMenu('value') === '%date%');
    let [, cKey] = this_observation.composite_key.split('~');
    let s = cKey.replace('all_day', '%RESTORE%').split('_');
    let p = s.map(e => {
      return (e === '%RESTORE%' ? 'all_day' : e);
    });
    if (p[0] === displayed_category) {
      if (p[1] === (useDate ? selectedDate('value') : selectedMenu('value'))) {
        // Client~entree_2024.5.22_lunch_bistro  OR  Client~entree_2024.5.22
        if (p.length < 3) {
          return (['all-day', 'all_day', 'allDay'].includes(selectedMealType('value')));   // if !meal, then room will also be missing and we can fast forward to true
        }
        else if (p[2] !== selectedMealType('value')) {  // third parm is present?  it needs to match the meal
          return false;
        }
        return ((p.length < 4) || (p[3] === selectedArea('value')));
      }
      else if (p[1] === selectedMealType('value')) {
        // Client~entree_lunch_2024.5.22_bistro 
        if (p.length < 3) {
          return (['all-day', 'all_day', 'allDay'].includes(selectedMealType('value')));   // if !meal, then room will also be missing and we can fast forward to true
        }
        else if (p[2] !== (useDate ? selectedDate('value') : selectedMenu('value'))) {  // third parm is present?  it needs to match the date
          return false;
        }
        return ((p.length < 4) || (p[3] === selectedArea('value')));
      }
    }
    else if (p[0] === (useDate ? selectedDate('value') : selectedMenu('value'))) {   // check for Client~always_lunch_entree or Client~2024.5.22_lunch_entree or Client~always_entree or Client~2024.5.22_entree
      if (p[1] === selectedMealType('value')) {
        return (p[2] === displayed_category);
      }
      else {
        return (p[1] === displayed_category);
      }
    }
    else {    // Client~lunch_entree_2024.5.22
      if ((p[0] === selectedMealType('value')) && (p[1] === displayed_category)) {
        return (p[2] === (useDate ? selectedDate('value') : selectedMenu('value')));
      }
      return false;
    }
  }

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
      <Box key={`screen_box-${selectedMealType()}-${reactData.dateKey.obs}`} className={classes.dialogBox}>
        {!reactData.observationItemMode && !reactData.loadMode && !reactData.deletePending &&
          <React.Fragment>
            { /* Selection Row */}
            <DialogContent
              key={`category-detail-box-outside_${selectedMenu('value')}`}
              style={{
                position: 'sticky',
                top: 0,
                opacity: 1,
                zIndex: 1100,
                backgroundColor: 'white',
                color: ' black',
                marginBottom: 1,
                borderBottom: 2,
                marginLeft: '-10px',
                paddingLeft: '16px',
                paddingTop: '10px',
                minHeight: `100px`,
                //            maxHeight: `${reactData.visible_y - ((selectedMenu('value') === '%date%') ? 425 : 350)}px`
              }}
              id='dialog-content'
            >
              {(Object.keys(reactData.service_details).length > 1) &&
                <Box display='flex'
                  flexDirection='column'
                  marginRight={2}
                  marginLeft={0}
                  marginTop={0}
                  marginBottom={1}
                  borderBottom={2}
                  paddingTop={1}
                  paddingBottom={2}
                  justifyContent='flex-start'
                  alignItems='flex-start'
                  key={`selectionBox-${selectedMealType()}-${reactData.dateKey.obs}`}
                  id={`selectionBox-${selectedMealType()}-${reactData.dateKey.obs}`}
                >
                  { /* Dining Rooms */
                    (Object.keys(reactData.service_details['dining_area']).length > 1) &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={'row_diningarea'}
                      marginBottom={2}
                      overflow={(Object.keys(reactData.service_details['dining_area']).length > 5) ? 'scroll' : null}
                      justifyContent='flex-start'
                      alignItems='center'
                    >
                      <Box
                        display='flex'
                        flexDirection='column'
                        marginLeft={0}
                        width={'60px'}
                        justifyContent='flex-start'
                        key={`radiobox-diningarea`}
                        alignItems='flex-start'
                      >
                        <Typography key={`selectDiningWord_a`}
                          style={AVATextStyle({ margin: { bottom: -0.2 } })}
                        >
                          {'Dining'}
                        </Typography>
                        <Typography key={`selectDiningWord_b`}>
                          {'Room'}
                        </Typography>
                      </Box>
                      {Object.keys(reactData.service_details['dining_area']).map((areaType_key, aTNdx) => (
                        <Box
                          display='flex'
                          flexDirection='row'
                          marginLeft={5}
                          key={`radiobox-areahead-${aTNdx}`}
                          justifyContent='center'
                          alignItems='center'
                        >
                          <Typography key={`radiobox-areahead-${aTNdx}-title`}
                            style={AVATextStyle({ size: 1 })}
                          >
                            {titleCase(`${local_service_details['dining_area'][areaType_key].display_value[0]} ${local_service_details['dining_area'][areaType_key].display_value[1] || ''}`)}
                          </Typography>
                          <Radio
                            key={`radiobox-areahead-${aTNdx}-${reactData.dateKey.obs}-radio`}
                            checked={(selectedArea() === areaType_key)}
                            value={(selectedArea() === areaType_key)}
                            onClick={() => {
                              updateReactData({
                                selectedArea: areaType_key
                              }, true);
                            }}
                            disableRipple
                            className={classes.radioButton}
                            size='small'
                          />
                        </Box>
                      ))}
                    </Box>
                  }

                  { /* Menu - "Daily Special" or "Everyday" */
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={`row_dates_menus`}
                      marginBottom={2}
                      justifyContent='flex-start'
                      alignItems='center'
                    >
                      <Box
                        display='flex'
                        flexDirection='column'
                        marginLeft={0}
                        width={'60px'}
                        key={`radiobox-menus-colhead`}
                        justifyContent='flex-start'
                        alignItems='flex-start'
                      >
                        <Typography key={`selectWord_dates_a`}>
                          {'Menu'}
                        </Typography>
                      </Box>
                      {Object.keys(local_service_details['menus']).map((menuType_key, menuNDX) => (
                        <Box
                          display='flex'
                          flexDirection='row'
                          marginLeft={5}
                          key={`radiobox-menuhead-${menuType_key}-${reactData.parm_keyDate}`}
                          justifyContent='center'
                          alignItems='center'
                        >
                          <Typography key={`radiobox-menuhead-${menuType_key}-title`}
                            style={AVATextStyle({ size: 1 })}
                          >
                            {titleCase(`${local_service_details['menus'][menuType_key].display_value[0]} ${local_service_details['menus'][menuType_key].display_value[1] || ''}`)}
                          </Typography>
                          <Radio
                            key={`radiobox-datehead-${menuType_key}-${reactData.parm_keyDate}-radio`}
                            checked={(selectedMenu() === menuType_key)}
                            value={(selectedMenu() === menuType_key)}
                            onClick={() => {
                              updateReactData({
                                selectedMenu: menuType_key
                              }, true);
                            }}
                            disableRipple
                            className={classes.radioButton}
                            size='small'
                          />
                        </Box>
                      ))}
                    </Box>
                  }

                  { /* Date */
                    (selectedMenu('value') === '%date%') &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      marginBottom={2}
                      key={`row_dates_${reactData.parm_keyDate}`}
                      justifyContent='flex-start'
                      alignItems='center'
                    >
                      <Box
                        display='flex'
                        flexDirection='column'
                        marginLeft={0}
                        key={`radiobox-dates-colhead`}
                        width={'60px'}
                        justifyContent='flex-start'
                        alignItems='flex-start'
                      >
                        <Typography key={`selectWord_dates_a`}>
                          {'Date'}
                        </Typography>

                      </Box>
                      <Box
                        display='flex'
                        flexDirection='row'
                        flexWrap={'no-wrap'}
                        key={`row_dates_${reactData.parm_keyDate}_c2`}
                        justifyContent='flex-start'
                        alignItems='center'
                      >
                        {Object.keys(local_service_details['dates']).map((menuDate_key, menuNDX) => (
                          <Box
                            display='flex'
                            flexDirection='column'
                            marginLeft={5}
                            mt={0.5}
                            key={`radiobox-datehead-${menuDate_key}-${reactData.parm_keyDate}`}
                            justifyContent='space-between'
                            alignItems='center'
                          >
                            <Typography key={`radiobox-datehead-${menuDate_key}-${reactData.parm_keyDate}-title`}
                              style={AVATextStyle({ size: 1, margin: { bottom: -0.2 }, wrap: 'nowrap' })}
                            >
                              {titleCase(local_service_details['dates'][menuDate_key].display_value_day)}
                            </Typography>
                            <Typography key={`radiobox-datehead-${menuDate_key}-${reactData.parm_keyDate}-title`}
                              style={AVATextStyle({ size: 1, margin: { bottom: -0.2 }, wrap: 'nowrap' })}
                            >
                              {titleCase(local_service_details['dates'][menuDate_key].display_value)}
                            </Typography>
                            <Radio
                              key={`radiobox-datehead-${menuDate_key}-${reactData.parm_keyDate}-radio`}
                              checked={(selectedDate() === menuDate_key)}
                              value={(selectedDate() === menuDate_key)}
                              onClick={() => {
                                updateReactData({
                                  selectedDateKey: menuDate_key
                                }, true);
                              }}
                              disableRipple
                              className={classes.radioButton}
                              size='small'
                            />
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  }

                  { /* Meal - AKA "meal" - lunch, dinner, breakfast, allday, ... */
                    (Object.keys(reactData.service_details['dining_area'][selectedArea()]['meal_service']).length > 1) &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={'row_mealservice'}
                      overflow={(Object.keys(reactData.service_details['dining_area'][selectedArea()]['meal_service']).length > 5) ? 'scroll' : null}
                      justifyContent='flex-start'
                      alignItems='flex-start'
                    >
                      <Box
                        display='flex'
                        flexDirection='column'
                        marginLeft={0}
                        width={'60px'}
                        key={`radiobox-type-colhead`}
                        justifyContent='flex-start'
                        alignItems='flex-start'
                      >
                        <Typography key={`selectWord_a`}
                          style={AVATextStyle({ margin: { bottom: -0.2 } })}
                        >
                          {'Meal'}
                        </Typography>
                        <Typography key={`selectWord_b`}>
                          {'Type'}
                        </Typography>
                      </Box>
                      {Object.keys(reactData.service_details['dining_area'][selectedArea()]['meal_service']).map((menu_type, mtNDX) => (
                        <Box
                          display='flex'
                          flexDirection='row'
                          marginLeft={5}
                          key={`radiobox-typehead-${mtNDX}-${reactData.parm_keyDate}`}
                          justifyContent='center'
                          alignItems='center'
                        >
                          <Typography key={`radiobox-typehead-${mtNDX}-title`}
                            style={AVATextStyle({ size: 1 })}
                          >
                            {titleCase(`${local_service_details['dining_area'][selectedArea()]['meal_service'][menu_type].display_value[0]} ${local_service_details['dining_area'][selectedArea()]['meal_service'][menu_type].display_value[1] || ''}`)}
                          </Typography>
                          <Radio
                            key={`radiobox-typehead-${mtNDX}-${reactData.dateKey.obs}-radio`}
                            checked={(selectedMealType() === menu_type)}
                            value={(selectedMealType() === menu_type)}
                            onClick={() => {
                              updateReactData({
                                selectedMealType: menu_type
                              }, true);
                            }}
                            disableRipple
                            className={classes.radioButton}
                            size='small'
                          />
                        </Box>
                      ))}
                    </Box>
                  }

                </Box>
              }
            </DialogContent>

            { /* Data rows */}
            <Box
              key={`category-detail-box-outside2`}
              style={{
                paddingLeft: '4px',
                minHeight: `${Math.min(reactData.visible_y - 400, 350)}px`,
              }}
              id='dialog-content'
            >
              {reactData.service_details['dining_area'][selectedArea()]['meal_service'][selectedMealType()].categories.map((menu_category, catNdx) => (
                <React.Fragment key={`category-detail-box-inside-${menu_category}`}>
                  { /* Category Title - name */}
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={`category-title-box-${menu_category}-titlebox`}
                    id={`category-title-box-${menu_category}-titlebox`}
                    borderTop={(catNdx > 0) ? 1 : 0}
                    paddingTop={(catNdx > 0) ? 2 : 1}
                    marginTop={(catNdx > 0) ? 1 : 0}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    <Typography
                      key={`category-title-box-${menu_category}-title`}
                      id={`category-title-box-${menu_category}-title`}
                      style={AVATextStyle({ size: 1.3, bold: true, margin: { bottom: 0.8, top: 0 } })}
                    >
                      {titleCase(menu_category.replace('_', ' ').trim())}
                    </Typography>
                  </Box>
                  { /* Add row for this category */}
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={`category-title-box-${menu_category}`}
                    id={`category-title-box-${menu_category}`}
                    minWidth={'95%'}
                    flexGrow={1}
                    marginBottom={((catNdx + 1) < reactData.service_details['dining_area'][selectedArea()]['meal_service'][selectedMealType()].categories.length) ? 0 : 40}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    <Box
                      key={`selectBox_${menu_category}_${selectedDate()}_${observationList.length}`}
                      display='flex' flexGrow={1} flexDirection='column'
                    >
                      <Select
                        options={filterRecipeList(menu_category)}
                        searchBy={'label'}
                        dropdownHandle={false}
                        clearOnSelect={true}
                        clearOnBlur={true}
                        key={`select_${menu_category}_${selectedDate()}_${observationList.length}`}
                        searchable={true}
                        create={true}
                        closeOnClickInput={true}
                        closeOnSelect={true}
                        style={{ lineHeight: `2.2rem`, fontSize: `1.8rem`, marginLeft: 0, marginBottom: 1, borderWidth: 0 }}
                        noDataLabel={"No matches found"}
                        placeholder={`Tap to add a${(['a', 'e', 'i', 'o', 'u'].includes(menu_category[0].toLowerCase())) ? 'n' : ''} ${titleCase(menu_category.replace('_', ' ').trim())}`}
                        onChange={async (values) => {
                          if ((values.length > 0) && !reactData.addMode) {
                            await handleNewObservation(values, menu_category);
                            updateReactData({
                              selectedObservation: {},
                              addMode: false
                            }, true);
                          }
                        }}
                        onCreateNew={async (values) => {
                          await handleNewObservation(values, menu_category);
                          updateReactData({
                            selectedObservation: {},
                            addMode: false
                          }, true);
                        }}
                      />
                      { /* Existing observations in this category */}
                      {
                        observationList.map((this_item, this_index) => (
                          OKtoShow(this_item, menu_category)
                          &&
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                            <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                                key={`row_box_${this_item.id}-reactData.rowOpen[this_index]`}
                              >
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => {
                                    handleEditObservation(deepCopy(this_item), this_index, selectedMealType(), menu_category);
                                  }}
                                  edge="start"
                                >
                                  {<EditIcon />}
                                </IconButton>
                                <IconButton
                                  aria-label="search_icon"
                                  onClick={() => {
                                    this_item.listIndex = this_index;
                                    updateReactData({
                                      confirmMessage: `Confirm removing ${this_item.observation_code.replace(/~/g, '')} from the ${titleCase(selectedDate('display'))} ${selectedMealType('display')} menu?`,
                                      selectedObservation: this_item,
                                      deletePending: true
                                    }, true);
                                  }}
                                  edge="start"
                                >
                                  <DeleteIcon />
                                </IconButton>
                                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'
                                  onClick={async () => {
                                    reactData.rowOpen[this_index] = !reactData.rowOpen[this_index];
                                    if (this_item.observation_key) {
                                      let OIInfo = await loadOIValues(this_item.observation_key);
                                      if (OIInfo) {
                                        observationList[this_index].moreInfo = {
                                          image: OIInfo.image,
                                        };
                                      }
                                      reactData.oiCharacteristics.forEach((c, x) => {
                                        if (OIInfo.values[x]) {
                                          observationList[this_index].moreInfo[c.description] = OIInfo.values[x];
                                        }
                                      });
                                    }
                                    else if (!this_item.description || (this_item.description.trim() === '')) {
                                      observationList[this_index].moreInfo = {
                                        'Additional Item info': 'None loaded.  Tap the pencil icon to add.',
                                      };
                                    }
                                    let qualResponse = await buildQualifiers(this_item.observation_key);
                                    if (qualResponse.data && (Object.keys(qualResponse.data).length > 0)) {
                                      observationList[this_index].qualData = deepCopy(qualResponse.data);
                                    }
                                    updateReactData({
                                      rowOpen: reactData.rowOpen
                                    }, true);
                                  }}
                                  onContextMenu={async (e) => {
                                    e.preventDefault();
                                    enqueueSnackbar(<div>
                                      Composite_Key={this_item.composite_key}<br />
                                      Observation_key={this_item.observation_key}<br />
                                      Date_Key={this_item.date_key}
                                    </div>, { variant: 'info', persist: true });
                                  }}
                                >
                                  <Typography style={AVATextStyle({
                                    margin: { top: 0, right: 2 },
                                    size: 1.8
                                  })}>
                                    {this_item.observation_code.replace(/~/g, '')}
                                  </Typography>
                                  {(this_item.observation_key || (this_item.description && (this_item.description.trim() !== ''))) &&
                                    (!reactData.rowOpen[this_index] ? <ExpandMoreIcon /> : <ExpandLessIcon />)
                                  }
                                </Box>
                              </Box>
                              <Collapse in={reactData.rowOpen[this_index]} timeout="auto" unmountOnExit>
                                <Box
                                  key={`moreInfo-${menu_category}-${this_index}`}
                                  id={`moreInfo-${menu_category}-${this_index}`}
                                  display="flex"
                                  style={AVATextStyle({
                                    margin: { top: -0.5 },
                                    padding: { bottom: 1 }
                                  })}
                                  flexDirection='column'
                                  justifyContent="center"
                                >
                                  <Box display='flex' flexDirection='row' justifyContent='space-between'
                                    key={`optionbox_moreInfo-${menu_category}-${this_index}`}
                                    id={`optionbox_moreInfo-${menu_category}-${this_index}`}
                                    alignItems='center' flexWrap='nowrap'
                                  >
                                    <Box display='flex' flexDirection='column' justifyContent='center'
                                      key={`qualbox_moreInfo-${menu_category}-${this_index}`}
                                      id={`qualbox_moreInfo-${menu_category}-${this_index}`}
                                      alignItems='flex-start'>
                                      {this_item.description &&
                                        <Typography
                                          key={`description-${menu_category}-${this_index}`}
                                          id={`description-${menu_category}-${this_index}`}
                                          style={AVATextStyle({ margin: { left: 1 } })}
                                        >
                                          {`Description: ${this_item.description}`}
                                        </Typography>
                                      }
                                      {this_item.moreInfo &&
                                        Object.keys(this_item.moreInfo).map((opt, oX) => (
                                          <React.Fragment
                                            key={`optionbox_moreInfo-${menu_category}-${this_index}-${oX}-wrapper`}
                                          >
                                            {(opt !== 'image') && (opt !== 'restriction') &&
                                              <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                                key={`optionbox_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                id={`optionbox_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                style={AVATextStyle({ margin: { right: 3 } })}
                                                alignItems='center'
                                              >
                                                <Typography
                                                  key={`optionchecktext_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                  id={`optionchecktext_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                  style={AVATextStyle({ margin: { left: 1 } })}
                                                >
                                                  {`${sentenceCase(opt.replace('_', ' '))}${this_item.moreInfo[opt].trim() ? (': ' + this_item.moreInfo[opt]) : ''}`}
                                                </Typography>
                                              </Box>
                                            }
                                            {(opt === 'restriction')
                                              && (state?.groups?.belongsTo?.[this_item.moreInfo[opt].trim()].group_name)
                                              &&
                                              <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                                key={`option_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                id={`option_moreInfo-${menu_category}-${this_index}-${oX}`}
                                                style={AVATextStyle({ margin: { right: 3 } })}
                                                alignItems='center'
                                              >
                                                <Typography
                                                  key={`optionchecktext_${selectedMealType()}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                                  id={`optionchecktext_${selectedMealType()}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                                  style={AVATextStyle({ color: 'red', margin: { left: 1 } })}
                                                >
                                                  {`Show warning for ${state?.groups?.belongsTo?.[this_item.moreInfo[opt].trim()].group_name}`}
                                                </Typography>
                                              </Box>
                                            }
                                          </React.Fragment>
                                        ))}
                                      {this_item.qualData
                                        && makeArray(this_item.qualData).map((qR, qRndx) => (
                                          <Box display='flex' flexDirection='column' justifyContent='flex-start'
                                            key={`qualBox-${menu_category}-${this_index}-${qRndx}`}
                                            id={`qualBox-${menu_category}-${this_index}-${qRndx}`}
                                            style={AVATextStyle({ margin: { right: 3 } })}
                                            alignItems='flex-start'
                                          >
                                            <Typography
                                              key={`qualBoxText-${menu_category}-${this_index}-${qRndx}`}
                                              id={`qualBoxText-${menu_category}-${this_index}-${qRndx}`}
                                              style={AVATextStyle({ margin: { left: 1 } })}
                                            >
                                              {((qR.max_allowed === 1) || (qR.option.length === 1)) ?
                                                (`You ${(qR.min_required > 0) ? 'must' : 'may'} select one ${qR.title} option`)
                                                :
                                                (`${(qR.min_required > 0) ? 'You must select from' + qR.min_required : 'You may choose up'} to ${(qR.max_allowed > 20) ? qR.option.length : qR.max_allowed} ${qR.title} options`)
                                              }
                                            </Typography>
                                            {qR.option.map((qROpt, qROx) => (
                                              <Typography
                                                key={`qualBoxOptText-${menu_category}-${this_index}-${qRndx}-${qROx}`}
                                                id={`qualBoxOptText-${menu_category}-${this_index}-${qRndx}-${qROx}`}
                                                style={AVATextStyle({ margin: { left: 2 }, size: 0.8 })}
                                              >
                                                {qROpt.display}
                                              </Typography>
                                            ))}
                                          </Box>
                                        ))
                                      }
                                    </Box>
                                    {this_item.moreInfo &&
                                      this_item.moreInfo.image &&
                                      <Box
                                        component="img"
                                        key={`obs_image-${menu_category}-${this_index}`}
                                        mt={0}
                                        mb={0}
                                        mr={2}
                                        alignSelf={'center'}
                                        border={1}
                                        minWidth={50}
                                        maxWidth={50}
                                        minHeight={50}
                                        maxHeight={50}
                                        alt=''
                                        src={this_item.moreInfo.image}
                                      />
                                    }
                                  </Box>
                                </Box>
                              </Collapse>
                            </Box>
                          </Box>
                        ))
                      }
                    </Box>
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          </React.Fragment>
        }
        {
          reactData.observationItemMode &&
          <AVATextInput
            titleText={`Edit ${reactData.selectedObservation.observation_code}`}
            promptText={['Item', 'Description'].concat(reactData.oiCharacteristics.map(c => { return `${c.description} ${c.uom ? '(' + c.uom + ')' : ''}`; }))}
            valueText={[reactData.selectedObservation.observation_code, reactData.selectedObservation.description].concat(reactData.oIValues)}
            buttonText={[(reactData.addMode ? 'Add' : 'Update'), 'Cancel']}
            options={{
              allowAttach: 'Image',
              attachmentList: (reactData.oIImage ? [{
                Key: 'Current Image',
                Location: reactData.oIImage,
              }] : false)
            }}
            onCancel={() => {
              updateReactData({
                selectedObservation: {},
                observationItemMode: false,
                addMode: false
              }, true);
            }}
            onSave={async (newOItemData, buttonPressed, newAttachmentList) => {
              if (buttonPressed === 0) {   // add/update/save
                await handleAddOItem(
                  ((reactData.addMode || !reactData.selectedObservation.observation_key) ? `OKey_${new Date().getTime()}` : reactData.selectedObservation.observation_key),
                  newOItemData,
                  newAttachmentList
                );
                updateReactData({
                  selectedObservation: {},
                  observationItemMode: false,
                  addMode: false
                }, true);
              }
              else if (buttonPressed === 2) {   // edit options

              }
            }}
          />
        }
        {
          reactData.loadMode &&
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
        {
          reactData.deletePending &&
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
      </Box >
    ));
};