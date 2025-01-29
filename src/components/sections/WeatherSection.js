import React from 'react';
import { Box, Typography, Button } from '@material-ui/core/';
import { restAPI, isEmpty } from '../../util/AVAUtilities';
import { useGeolocated } from "react-geolocated";

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import TextField from '@material-ui/core/TextField';

export default ({ currentValues, reactData, updateField }) => {

  const AVAClass = AVAclasses();

  const {
    coords,
    getPosition,
    isGeolocationAvailable,
    isGeolocationEnabled,
    positionError,
  } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: true,
    },
    userDecisionTimeout: 5000,
    watchLocationPermissionChange: true,
  });

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <TextField
        id='Latitude'
        autoComplete='off'
        key={`lat_${currentValues.customizationRecs.client_weather.customization_value.latitude}`}
        style={{ width: '100px' }}
        onBlur={async (event) => {
          let updateList =
            [{
              tableName: 'customizationRecs',
              fieldName: 'client_weather.customization_value.latitude',
              newData: event.target.value
            }];
          if (currentValues.customizationRecs.client_weather.customization_value.longitude && event.target.value) {
            let nws_info = await restAPI({
              hostname: 'api.weather.gov',
              path: `/points/${event.target.value},${currentValues.customizationRecs.client_weather.customization_value.longitude}`,
              method: 'GET',
              headers: {
                "User-Agent": "(AVASeniorConnect.com, rsteele@avaseniorconnect.com)"
              }
            }, '');
            if (nws_info.hasOwnProperty('properties')) {
              updateList.push(...[
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_office',
                  newData: nws_info.properties.gridId
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_x',
                  newData: nws_info.properties.gridX
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_y',
                  newData: nws_info.properties.gridY
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_place',
                  newData: `${nws_info.properties.relativeLocation?.properties?.city}, ${nws_info.properties.relativeLocation?.properties?.state}`
                }]);
            }
          }
          await updateField({ updateList });
        }}
        defaultValue={currentValues.customizationRecs.client_weather.customization_value.latitude}
        helperText='Latitude'
      />
      <TextField
        id='Longitude'
        autoComplete='off'
        key={`lon_${currentValues.customizationRecs.client_weather.customization_value.longitude}`}
        style={{ width: '100px' }}
        onBlur={async (event) => {
          let updateList =
            [{
              tableName: 'customizationRecs',
              fieldName: 'client_weather.customization_value.longitude',
              newData: `-${Math.abs(Number(event.target.value))}`
            }];
          if (currentValues.customizationRecs.client_weather.customization_value.latitude && event.target.value) {
            let nws_info = await restAPI({
              hostname: 'api.weather.gov',
              path: `/points/${currentValues.customizationRecs.client_weather.customization_value.latitude},-${Math.abs(Number(event.target.value))}`,
              method: 'GET',
              headers: {
                "User-Agent": "(AVASeniorConnect.com, rsteele@avaseniorconnect.com)"
              }
            }, '');
            if (nws_info.hasOwnProperty('properties')) {
              updateList.push(...[
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_office',
                  newData: nws_info.properties.gridId
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_x',
                  newData: nws_info.properties.gridX
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_y',
                  newData: nws_info.properties.gridY
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_place',
                  newData: `${nws_info.properties.relativeLocation?.properties?.city}, ${nws_info.properties.relativeLocation?.properties?.state}`
                }]);
            }
          }
          await updateField({ updateList });
        }}
        defaultValue={currentValues.customizationRecs.client_weather.customization_value.longitude}
        helperText='Longitude'
      />
      <TextField
        id='Place'
        autoComplete='off'
        key={`loc_${currentValues.customizationRecs.client_weather.customization_value.place_name}`}
        style={{ width: '300px' }}
        onBlur={async (event) => {
          await updateField({
            updateList:
              [{
                tableName: 'customizationRecs',
                fieldName: 'client_weather.customization_value.place_name',
                newData: event.target.value
              }]
          });
        }}
        defaultValue={currentValues.customizationRecs.client_weather.customization_value.place_name}
        helperText='Place Name'
      />
      <Button
        className={AVAClass.AVAButton}
        style={{ width: 'fit-content', marginTop: '32px', marginLeft: '16px', marginRight: '16px' }}
        size='small'
        onClick={async () => {
          let updateList;
          getPosition();
          let newText;
          if (!isEmpty(positionError)) {
            newText = `Location Error ${JSON.stringify(positionError)}`;
          }
          else if (!isGeolocationAvailable) {
            newText = "Device doesn't support location ID";
          }
          else if (!isGeolocationEnabled) {
            newText = `User blocked location ID`;

          }
          if (newText) {
            updateList = {
              tableName: 'customizationRecs',
              fieldName: 'client_weather.customization_value.place_name',
              newData: newText
            };
          }
          else {
            updateList =
              [{
                tableName: 'customizationRecs',
                fieldName: 'client_weather.customization_value.longitude',
                newData: ((Math.round(coords.longitude * 100)) / 100)
              },
              {
                tableName: 'customizationRecs',
                fieldName: 'client_weather.customization_value.latitude',
                newData: ((Math.round(coords.latitude * 100)) / 100)
              }];
            let nws_info = await restAPI({
              hostname: 'api.weather.gov',
              path: `/points/${(Math.round(coords.latitude * 100)) / 100},${(Math.round(coords.longitude * 100)) / 100}`,
              method: 'GET',
              headers: {
                "User-Agent": "(AVASeniorConnect.com, rsteele@avaseniorconnect.com)"
              }
            }, '');
            if (nws_info) {
              updateList.push(...[
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_office',
                  newData: nws_info.properties.gridId
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_x',
                  newData: nws_info.properties.gridX
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_y',
                  newData: nws_info.properties.gridY
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.nws_place',
                  newData: `${nws_info.properties.relativeLocation?.properties?.city}, ${nws_info.properties.relativeLocation?.properties?.state}`
                },
                {
                  tableName: 'customizationRecs',
                  fieldName: 'client_weather.customization_value.place_name',
                  newData: `${nws_info.properties.relativeLocation?.properties?.city}, ${nws_info.properties.relativeLocation?.properties?.state}`
                }]);
            }
          }
          await updateField({ updateList });
        }}
      >
        <Typography
          style={AVATextStyle({ size: 0.8, margin: { left: 1, right: 0.5 } })}
        >
          {'Use my Location'}
        </Typography>
      </Button>
      <Box display='flex' alignItems='flex-end'
        justifyContent='flex-end' flexDirection='column'>
        <Typography
          style={AVATextStyle({ opacity: '40%', margin: { top: 1, right: 0.5 } })}
        >
          {`Location: ${currentValues.customizationRecs.client_weather.customization_value.nws_place}`}
        </Typography>
        <Typography
          style={AVATextStyle({ size: 0.8, opacity: '40%', margin: { top: 0.5, right: 0.5 } })}
        >
          {`NWS Office: ${currentValues.customizationRecs.client_weather.customization_value.nws_office}`}
        </Typography>
        <Typography
          style={AVATextStyle({ size: 0.8, opacity: '40%', margin: { top: 0.5, right: 0.5 } })}
        >
          {`NWS Grid: ${currentValues.customizationRecs.client_weather.customization_value.nws_x}/${currentValues.customizationRecs.client_weather.customization_value.nws_y}`}
        </Typography>
      </Box>
    </Box>
  );
};
