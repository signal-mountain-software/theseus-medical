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
    AVAMicroButton: {
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(0),
        marginBottom: theme.spacing(0),
        borderRadius: '16px',
        paddingLeft: '16px',
        paddingRight: '16px',
        variant: 'outlined',
        textTransform: 'none',
        textDecoration: 'none',
        border: '0.75px solid gray',
        size: 'small',
        fontSize: theme.typography.fontSize * 0.8
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
    AVAClientBackground: {
        backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).backgroundColor : null,
        borderRadius: '30px',
        padding: 5
    },
    AVAPromptBackground: {
        backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).promptBackgroundColor : null,
        borderRadius: '30px',
        padding: 5
    }
}));

export const AVADefaults = (options = {}) => {
    let returnObj = {};
    for (let key in options) {
        if (options[key] === 'get') {
            returnObj[key] = remembered[key];
        }
        else if (options[key] === 'getURL') {
            returnObj[key] = new URL(remembered[key]);
        }
        else {
            remembered[key] = options[key];
        }
    }
    let oKey = Object.keys(returnObj);
    switch (oKey.length) {
        case 0: { return null; }
        case 1: { return returnObj[oKey[0]]; }
        default: { return returnObj; }
    }
};

export function AVATextStyle(options = {}) {
    let user_fontSize = AVADefaults({ fontSize: 'get' }) || 1.5;
    let returnStyle = {
        fontSize: `${user_fontSize * (options.size || 1)}rem`,
        lineHeight: 1.2,
        overflow: (options.overflow || 'hidden'),
    };
    Object.keys(options).forEach(optionKey => {
        switch (optionKey) {
            case "bold": {
                if (options.bold) {
                    returnStyle.fontWeight = 'bold';
                }
                break;
            }
            case "italic": {
                if (options.italic) {
                    returnStyle.fontStyle = 'italic';
                }
                break;
            }
            case "weight": {
                returnStyle.fontWeight = options.weight;
                break;
            }
            case "wrap": {
                returnStyle.textWrap = options.wrap;
                break;
            }
            case "color": {
                returnStyle.color = options.color;
                break;
            }
            case "margin": {
                if (Array.isArray(options.margin)) {
                    if (options[0]) { returnStyle.marginLeft = options[0] * 16; }
                    if (options[1]) { returnStyle.marginRight = options[1] * 16; }
                    if (options[2]) { returnStyle.marginTop = options[2] * 16; }
                    if (options[3]) { returnStyle.marginBottom = (options[3] * 16) - (2 * user_fontSize * (options.size || 1)); }
                }
                else {
                    if (options.margin.right) { returnStyle.marginRight = options.margin.right * 16; }
                    if (options.margin.left) { returnStyle.marginLeft = options.margin.left * 16; }
                    if (options.margin.top) { returnStyle.marginTop = options.margin.top * 16; }
                    if (options.margin.bottom) { returnStyle.marginBottom = (options.margin.bottom * 16) - (2 * user_fontSize * (options.size || 1)); }
                }
                break;
            }
            case "marginTop":
            case "paddingTop": {
                returnStyle.marginTop = options[optionKey] * 16;
                break;
            }
            case "paddingBottom":
            case "marginBottom": {
                returnStyle.marginBottom = (options.marginBottom * 16) - (2 * user_fontSize * (options.size || 1));;
                break;
            }
            case "paddingLeft":
            case "marginLeft": {
                returnStyle.marginLeft = options[optionKey] * 16;
                break;
            }
            case "paddingRight":
            case "marginRight": {
                returnStyle.marginRight = options[optionKey] * 16;
                break;
            }
            case "padding": {
                if (Array.isArray(options.padding)) {
                    if (options[0]) { returnStyle.paddingLeft = options[0] * 16; }
                    if (options[1]) { returnStyle.paddingRight = options[1] * 16; }
                    if (options[2]) { returnStyle.paddingTop = options[2] * 16; }
                    if (options[3]) { returnStyle.paddingBottom = (options[3] * 16); }
                }
                else {
                    if (options.padding.right) { returnStyle.paddingRight = options.padding.right * 16; }
                    if (options.padding.left) { returnStyle.paddingLeft = options.padding.left * 16; }
                    if (options.padding.top) { returnStyle.paddingTop = options.padding.top * 16; }
                    if (options.padding.bottom) { returnStyle.paddingBottom = (options.padding.bottom * 16); }
                }
                break;
            }
            case "align": {
                returnStyle.textAlign = options.align;
                break;
            }
            default: {
                returnStyle[optionKey] = options[optionKey];
            }
        }
    });
    return returnStyle;
}

export function AVATextVariableStyle(outText, options = {}) {
    let returnStyle = AVATextStyle(options);
    let user_fontSize = AVADefaults({ fontSize: 'get' }) * (options.size || 1);
    returnStyle.fontSize = `${user_fontSize * (50 / Math.max(50, (outText ? outText.length : 1) * user_fontSize * (600 / window.innerWidth)))}rem`;
    return returnStyle;
}

export function hexToRgb(hex, opacity = 1) {
    var c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${opacity})`;
    }
    throw new Error('Bad Hex');
}

export function isDark(hex) {    // report if this hex color is dark (to correct overlaid content when necessary)
    var h = hex.substring(1);      // strip #
    var rgb = parseInt(h, 16);   // convert rrggbb to decimal
    var r = (rgb >> 16) & 0xff;  // extract red
    var g = (rgb >> 8) & 0xff;  // extract green
    var b = (rgb >> 0) & 0xff;  // extract blue

    var luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
    return (luma < 126);
}