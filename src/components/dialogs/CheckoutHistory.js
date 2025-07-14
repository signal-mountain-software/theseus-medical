import React from 'react';

import Typography from '@material-ui/core/Typography';
import { Box } from '@material-ui/core';

import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues }) => {

  return (
    <Box
      key={`PersonNotesSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {currentValues.peopleRec.checkout_status &&
        <Typography
          style={AVATextStyle({
            size: 1.3,
            bold: true,
            align: 'center',
            margin: {
              bottom: 1.5,
              top: 1
            }
          })}
        >
          {`Currently checked ${currentValues.peopleRec.checkout_status}`}
        </Typography>
      }
      {currentValues.peopleRec.checkout_recent_history &&
        <Typography
          style={AVATextStyle({
            size: 1,
            bold: true,
            align: 'center',
            margin: {
              bottom: 1,
            }
          })}
        >
          {`Recent Activity`}
        </Typography>
      }
      {currentValues.peopleRec.checkout_recent_history
        && currentValues.peopleRec.checkout_recent_history.map((this_note, i) => (
          <Box key={`header_message_${i}`}
            display='flex' flexDirection='row'
            flexWrap={'noWrap'}
            marginTop={1}
            marginBottom={1}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box
              display='flex'
              flexDirection='row'
              flexGrow={1}
              justifyContent={'center'}
            >
              <Typography
                style={AVATextStyle({ size: 1 })}
              >
                {this_note}
              </Typography>
            </Box>
          </Box>
        ))}
    </Box>
  );
};
