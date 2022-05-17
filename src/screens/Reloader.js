import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import * as serviceWorker from '../serviceWorker';
import useSession from '../hooks/useSession';

export default () => {
    serviceWorker.unregister();
    let jumpTo = window.location.href.replace('refresh', 'theseus');
    const { state } = useSession();
    const { user } = state;
    if (user) { 
        jumpTo += `?user=${user.username}`; 
        if (state.session) {
            jumpTo += `&client=${state.session.client_id}`;
        }
        else if (user.attributes['custom:client']) { 
            jumpTo += `&client=${user.attributes['custom:client']}`;
        };
    }
    console.log('starting ', jumpTo);
    window.location.replace(jumpTo);
    return (
        <Box mt={3}>
            <Typography align='center'>
                {`Loading AVA version 22.5.20${window.location.href.split('//')[1].slice(0, 1)}`}
            </Typography>
        </Box>
    );
};
