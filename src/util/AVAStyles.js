import makeStyles from '@material-ui/core/styles/makeStyles';
let remembered = {};

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
        fontSize: theme.typography.fontSize * 1.25,
        fontWeight: 'bold'
    },
    AVABigBoldTitle: {
        fontSize: theme.typography.fontSize * 1.8,
        marginY: 10,
        marginX: 0,
        paddingX: 0,
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
    AVABigBoldText: {
        fontSize: theme.typography.fontSize * 1.8,
        minWidth: '100%',
        marginY: 10,
        marginX: 0,
        paddingX: 0,
    },
    AVALargeText: {
        fontSize: theme.typography.fontSize * 1.25,
        minWidth: '100%',
        marginY: 10,
        marginX: 0,
        paddingX: 0,
    },
    AVAProgressBar: {
        marginBottom: theme.spacing(3),
        backgroundColor: '#a3a0a0',
        color: '#000000',
        transition: 'none',
        height: '5px'
    },
}));

export const AVADefaults = (options = {}) => {
    let returnObj = {};
    for (let key in options) {
        if (options[key] === 'get') { returnObj[key] = remembered[key]; }
        else { remembered[key] = options[key]; }
    }
    let oKey = Object.keys(returnObj);
    switch (oKey.length) {
        case 0: { return null; }
        case 1: { return returnObj[oKey[0]]; }
        default: { return returnObj; }
    }
}

export function AVATextStyle(options = {}) {
    let user_fontSize = AVADefaults({ fontSize: 'get' });
    let returnStyle = {
        fontSize: `${user_fontSize * (options.size || 1)}rem`,
        lineHeight: (Math.max(1.2, user_fontSize * (options.size || 1) * 0.4)),
        overflow: (options.overflow || 'hidden')
    };
    if (options.bold) { returnStyle.fontWeight = 'bold'; }
    if (options.margin) {
        if (options.margin.right) { returnStyle.marginRight = options.margin.right * 16; }
        if (options.margin.left) { returnStyle.marginLeft = options.margin.left * 16; }
        if (options.margin.top) { returnStyle.marginTop = options.margin.top * 16; }
        if (options.margin.bottom) { returnStyle.marginBottom = options.margin.bottom * 16; }
    }
    if (options.align) { returnStyle.textAlign = options.align; }
    if (options.color) { returnStyle.textAlign = options.color; }
    return returnStyle;
}

export function AVATextVariableStyle(outText, options = {}) { 
    let returnStyle = AVATextStyle(options);
    let user_fontSize = AVADefaults({ fontSize: 'get' }) * (options.size || 1);
    returnStyle.fontSize = `${user_fontSize * (50 / Math.max(50, outText.length * user_fontSize * (1000 / window.innerWidth)))}rem`;
    return returnStyle;
}
