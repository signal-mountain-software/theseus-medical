import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import * as serviceWorker from '../serviceWorker';

export default () => {
    serviceWorker.unregister();
    window.location.replace(window.location.href.replace('refresh', 'theseus'));
    return (  
    <Box mt={3}>
        <Typography variant='h3' align='center'>
        Loading new program version
        </Typography>
    </Box>
)
};
