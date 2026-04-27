import React from 'react';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';

import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import useSession from '../hooks/useSession';

import { useCookies } from 'react-cookie';
import { dbClient } from '../util/AVAUtilities';

const useStyles = makeStyles(theme => ({
    formControl: {
        margin: theme.spacing(1),
        [theme.breakpoints.down('xs')]: {
            width: '100%',
            minWidth: 64,
        },
    },
    title: {
        margin: theme.spacing(1),
    },
    appBar: {
        position: 'relative',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        zIndex: 1,
    },
    gridList: {
        fontWeight: 'bold',
        marginTop: 10,
        justifyContent: 'center',
        maxWidth: '600px',
    },
    noDisplay: {
        display: 'none',
        visibility: 'hidden'
    },
    logoDisplay: {
        maxWidth: '600px',
        marginBottom: '15px'
    },
    mainPaper: {
    },
    defaultButton: {
        borderRadius: 50,
        marginLeft: 0,
        paddingLeft: 13,
        paddingRight: 10,
        backgroundColor: theme.palette.info[theme.palette.type],
        variant: 'outlined',
        fontSize: theme.typography.fontSize * 0.6,
        color: theme.palette.info[theme.palette.type],
        height: theme.typography.fontSize * 1.8,
    },
    confirm: {
        backgroundColor: theme.palette.confirm[theme.palette.type],
    },
    reject: {
        backgroundColor: theme.palette.reject[theme.palette.type],
    },
    inputRoot: {
        color: 'inherit',
    },
    inputInput: {
        padding: theme.spacing(1, 1, 1, 0),
        paddingLeft: 3,
        transition: theme.transitions.create('width'),
        [theme.breakpoints.up('md')]: {
            width: '20ch',
        },
    },
    descriptionText: {
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
    },
    activityText: {
        marginLeft: theme.spacing(3),
    },
}));

export default () => {

    const classes = useStyles();
    const { state } = useSession();
    const { session } = state;

    const [, , removeCookie] = useCookies(['AVAuser', 'AVAaction']);

    const [clientIcon, setClientIcon] = React.useState(null);
    const [clientName, setClientName] = React.useState(null);

    React.useEffect(() => {
        removeCookie('AVAuser', { path: '/' });
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('client');
        if (clientId) {
            Promise.all([
                dbClient.get({ Key: { client_id: clientId, custom_key: 'logo' }, TableName: 'Customizations' }).promise().catch(() => null),
                dbClient.get({ Key: { client_id: clientId, custom_key: 'client_name' }, TableName: 'Customizations' }).promise().catch(() => null),
            ]).then(([logoRec, nameRec]) => {
                if (logoRec?.Item?.customization_value) { setClientIcon(logoRec.Item.customization_value); }
                if (nameRec?.Item?.customization_value) { setClientName(nameRec.Item.customization_value); }
            });
        }
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const resolvedIcon = clientIcon || session?.client_icon || 'https://ava-icons.s3.amazonaws.com/AVA-logo.jpg';
    const resolvedName = clientName || session?.client_name || '';

    return (
        <Box
            display='flex' marginTop='64px' flexDirection='column' justifyContent='center' alignItems='center'
            width='100%'
        >
            <Grid item>
                <Card
                    className={classes.logoDisplay}
                    raised={false}
                    variant='elevation' elevation={0}
                >
                    <CardMedia
                        component="img"
                        image={resolvedIcon}
                        alt='AVA'
                    />
                </Card>
                <Box display='flex' className={classes.gridList} flexDirection='row' justifyContent='center' alignItems='center'>
                    <Typography  variant='h5'>
                        {`Thank you${resolvedName ? ` from ${resolvedName}` : ''}!`}
                    </Typography>
                </Box>
            </Grid>
        </Box>
    );
};
