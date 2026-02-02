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
    jumpTo = jumpTo.split('?')[0].split('#')[0];
    if (session?.url_parameters) {
        let link = '?';
        for (let key in session.url_parameters) {
            jumpTo += `${link}${key}=${session.url_parameters[key]}`;
            link = '&';
        }
    }
    window.location.replace(jumpTo);

    return (
        <Box mt={3}>
            <Typography align='center'>
                {`Loading AVA version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
            </Typography>
        </Box>
    );
};
