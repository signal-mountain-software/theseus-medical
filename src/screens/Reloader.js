import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import * as serviceWorker from '../serviceWorker';
// import useSession from '../hooks/useSession';

export default () => {
    serviceWorker.unregister();
    let jumpTo = window.location.href.replace('refresh', 'theseus');
    // const { state } = useSession();
    console.log('starting ', jumpTo);
    // alert(`starting ${jumpTo}`);
    window.location.replace(jumpTo);
    return (
        <Box mt={3}>
            <Typography align='center'>
                {`Loading AVA version v22.5.11${window.location.href.split('//')[1].slice(0, 1)}`}
            </Typography>
        </Box>
    );
};
