import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import useSession from '../hooks/useSession';

import * as serviceWorker from '../serviceWorker';

export default () => {
    const { state } = useSession();
    const { session } = state;
    serviceWorker.unregister();
   
    let jumpTo = window.location.href.replace('refresh', 'theseus');
    if (session?.url_parameters) {
        let url_variables = {};
        if (typeof (session.url_parameters) === 'string') {
            url_variables = JSON.parse(session.url_parameters);
        }
        else { 
            url_variables = session.url_parameters;
        }
        let link = '?';
        for (let key in url_variables) {
            jumpTo += `${link}${key}=${url_variables[key]}`;
            link = '&';
        }
    }
    window.location.replace(jumpTo);
    
    return (
        <Box mt={3}>
            <Typography align='center'>
                {`Loading AVA version 22.5.20${window.location.href.split('//')[1].slice(0, 1)}`}
            </Typography>
        </Box>
    );
};
