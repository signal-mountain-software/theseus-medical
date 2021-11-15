import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import * as serviceWorker from '../serviceWorker';

export default () => {
    serviceWorker.unregister();
    let jumpTo = window.location.href.replace('refresh', 'theseus');
    console.log('starting ', jumpTo);
    // alert(`starting ${jumpTo}`);
    window.location.replace(jumpTo);
    return (  
        <Box mt={3}>
            <Typography align='center'>
                { `Loading AVA version v21.11.15${process.env.NODE_ENV.slice(0,1)}` }
            </Typography>
        </Box>
    )
};
