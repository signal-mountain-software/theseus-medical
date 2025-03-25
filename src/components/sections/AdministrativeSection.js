import React from 'react';
import { Box, Typography } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, ogValues, errorList, setError, reactData, updateField }) => {

  const focusedSection = React.useRef(null);
  const autoFocus = (element) => {
    if (reactData.focusAt === 'Administrative Data') {
      focusedSection.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  return (
    <Box
      key={`administrativeSection_masterBox`}
      ref={autoFocus}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      {(Object.keys(reactData.form_fields).length > 0) && Object.keys(reactData.form_fields).map((this_formField, cFNdx) => (
        <Box display='flex' alignItems='center'
          key={`local_box__${cFNdx}`}
          ref={focusedSection}
          justifyContent='flex-start' flexDirection='row'
        >
          {reactData.form_fields[this_formField].value &&
            <Box
              key={`local_box__${cFNdx}`}
              display='flex' flexDirection='row'
              style={{ }}
            >
              <Typography
                key={`local_prompt__${cFNdx}`}
                style={AVATextStyle({ size: 1})}
              >
                {`${reactData.form_fields[this_formField].prompt}: `}
              </Typography>
              <Typography
                key={`local_prompt__${cFNdx}`}
                style={AVATextStyle({ size: 1, margin: { left: 0.5 }, bold: true })}
              >
                {reactData.form_fields[this_formField].value}
              </Typography>
            </Box>
          }
        </Box>
      ))}
    </Box>
  );
};
