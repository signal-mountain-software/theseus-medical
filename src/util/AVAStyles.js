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
    }
}));
