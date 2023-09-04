import makeStyles from '@material-ui/core/styles/makeStyles';


export const AVAclasses = makeStyles(theme => ({
    AVAButton: {
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        paddingLeft: '16px',
        paddingRight: '16px',
        borderRadius: '16px',
        variant: 'outlined',
        border: '0.75px solid gray',
        textTransform: 'none',
        textDecoration: 'none',
        textWrap: 'nowrap',
        fontWeight: 'bold',
        size: 'small',
    },
    AVATitle: {
        marginTop: theme.spacing(3),
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(2),
        marginBottom: 0,
        fontSize: '1.3rem',
        fontWeight: 'bold'
    },
    AVABox: {
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
        minWidth: '100%',
    },
    AVABoxCentered: {
        display: 'flex',
        flexDirection: 'row',
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
        minWidth: '100%',
        justifyContent: 'center'
    },
    AVASmallText: {
        fontSize: theme.typography.fontSize * 0.8,
        minWidth: '100%',
        marginY: 10,
        marginX: 0,
        paddingX: 0,
    },
}));
