import React from 'react';

import { Box, Typography, TextField, Button, IconButton } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';

export default ({ currentValues, updateField }) => {

  const AVAClass = AVAclasses();

  const locations = currentValues.customizationRecs.campus_locations?.customization_value || [];

  const commitLocations = async (newLocations) => {
    currentValues.customizationRecs.campus_locations.customization_value = newLocations;
    await updateField({
      updateList:
        [{
          tableName: 'customizationRecs',
          fieldName: 'campus_locations.customization_value',
          newData: newLocations
        }]
    });
  };

  return (
    <Box
      key={`campusLocationsSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      <Box
        display='flex'
        flexDirection='column'
        alignItems={'flex-start'}
        marginTop={2}
        marginBottom={1}
      >
        <Typography
          style={AVATextStyle({ italic: true, margin: { bottom: 0 } })}
        >
          {'These locations will be available anywhere a Campus Location can be selected (such as calendar event locations)'}
        </Typography>
        <Button
          onClick={async () => {
            await commitLocations([...locations, '']);
          }}
          className={AVAClass.AVAButton}
          style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
          size='small'
        >
          {'Add a Location'}
        </Button>
      </Box>

      {locations.length === 0 &&
        <Typography style={AVATextStyle({ italic: true })}>
          {'No Campus Locations have been added yet'}
        </Typography>
      }

      {locations.map((this_location, i) => (
        <Box
          key={`location_row_${i}`}
          display='flex'
          flexDirection='row'
          alignItems='center'
          marginBottom={1}
          maxWidth={'95%'}
        >
          <TextField
            id={`campusLocation_${i}`}
            autoComplete='off'
            style={{ width: '400px' }}
            key={`location_field_${i}__${this_location}`}
            defaultValue={this_location}
            onBlur={async (event) => {
              if (event.target.value === this_location) { return; }
              const newLocations = [...locations];
              newLocations[i] = event.target.value;
              await commitLocations(newLocations);
            }}
          />
          <IconButton
            key={`delete_location_${i}`}
            size={'small'}
            onClick={async () => {
              const newLocations = [...locations];
              newLocations.splice(i, 1);
              await commitLocations(newLocations);
            }}
          >
            <DeleteIcon fontSize={'small'} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
};
