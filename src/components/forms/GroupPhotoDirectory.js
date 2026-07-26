import React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import InputAdornment from '@material-ui/core/InputAdornment';

import SearchIcon from '@material-ui/icons/Search';
import CloseIcon from '@material-ui/icons/ExitToApp';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import SendIcon from '@material-ui/icons/Send';
import PrintIcon from '@material-ui/icons/Print';

import useSession from '../../hooks/useSession';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { getImage, getPerson, formatPhone } from '../../util/AVAPeople';
import { AVAclasses } from '../../util/AVAStyles';
import { isEmpty, sentenceCase, getObject, lambda } from '../../util/AVAUtilities';
import { determineClass, getRole } from '../../util/AVAGroups';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import MakeMessage from './MakeMessage';
import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';

const INITIAL_RENDER_COUNT = 30;
const RENDER_BATCH_COUNT = 30;
const PERSON_LOAD_BATCH_SIZE = 20;

const useStyles = makeStyles(theme => ({
    wrapper: {
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    fixedHeader: {
        flexShrink: 0,
        position: 'sticky',
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(2),
        marginTop: theme.spacing(2),

        zIndex: 2,
        backgroundColor: theme.palette.background.paper,
    },
    titleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
        flexWrap: 'nowrap',
    },
    titleText: {
        fontWeight: 'bold',
        fontSize: '1.4rem',
        marginBottom: 0,
        flex: 1,
        minWidth: 0,
        overflowWrap: 'anywhere',
    },
    topBar: {
        marginBottom: theme.spacing(2),
    },
    searchField: {
        width: '100%',
        maxWidth: 420,
    },
    resultCount: {
        marginTop: theme.spacing(0),
        marginBottom: theme.spacing(0),
    },
    card: {
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
        border: `2px solid ${theme.palette.text.primary}`,
        borderRadius: theme.spacing(1),
        [theme.breakpoints.down('sm')]: {
            border: `3px solid ${theme.palette.text.primary}`,
        }
    },
    portraitSlot: {
        alignSelf: 'center',
        width: 94,
        minWidth: 94,
        maxWidth: 94,
        height: 94,
        backgroundColor: theme.palette.action.hover,
        borderRight: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        [theme.breakpoints.down('sm')]: {
            width: 92,
            minWidth: 92,
            maxWidth: 92,
            height: 92,
        }
    },
    portraitMedia: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
    },
    portraitPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.default,
    },
    cardBody: {
        padding: theme.spacing(1),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minWidth: 0,
        flex: 1,
    },
    cardName: {
        fontWeight: 600,
        lineHeight: 1.2,
        marginBottom: theme.spacing(0.125),
        fontSize: '1.425rem',
    },
    cardSubtext: {
        marginTop: theme.spacing(0.125),
        fontSize: '0.88rem',
        fontWeight: 400,
        opacity: 0.8,
        lineHeight: 1.2,
    },
    contactLink: {
        color: 'inherit',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
    },
    contactIcon: {
        fontSize: '0.85rem',
    },
    emptyState: {
        padding: theme.spacing(4),
        textAlign: 'center',
    },
    gridScroller: {
        flex: 1,
        minHeight: 0,
        marginTop: theme.spacing(2),
        marginLeft: theme.spacing(2),
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: theme.spacing(1),
    },
    bottomActionBar: {
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        paddingTop: theme.spacing(1.5),
        paddingBottom: theme.spacing(1.5),
        backgroundColor: theme.palette.background.paper,
    },
    superSizeLast: {
        marginTop: theme.spacing(0),
        fontWeight: 'bold',
        fontSize: theme.typography.fontSize * 2.8,
    },
    superSizeFirst: {
        marginTop: theme.spacing(-2.5),
        fontSize: theme.typography.fontSize * 2.8,
    },
    upSizeLast: {
        marginTop: theme.spacing(0),
        fontSize: theme.typography.fontSize * 2.0,
    },
    upSizeLocation: {
        marginTop: theme.spacing(2),
        fontSize: theme.typography.fontSize * 2.0,
        flexGrow: 1,
        textAlign: 'center',
        lineHeight: `${theme.spacing(3)}px`,
    },
    upSizePreferenceBox: {
        marginTop: theme.spacing(2),
        lineHeight: `${theme.spacing(3)}px`,
    },
    superSizePreferenceLine2: {
        marginTop: theme.spacing(0.5),
        lineHeight: `${theme.spacing(3)}px`,
        fontSize: theme.typography.fontSize * 2.0,
        fontWeight: 'bold',
    },
    superSizePreferenceLine3: {
        marginTop: 0,
        lineHeight: `${theme.spacing(3)}px`,
        fontSize: theme.typography.fontSize * 1.5,
        fontWeight: 'bold',
        marginBottom: theme.spacing(0.5),
    },
    adName: {
        fontSize: '1.1rem',
    },
    giveSpace: {
        marginTop: theme.spacing(2),
    },
    giveSpaceBoth: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
    },
    giveMoreSpace: {
        marginTop: theme.spacing(4),
    },
    superSizeArea: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingLeft: 0,
        paddingRight: 0,
    },
}));

const normalizeList = ({ groupMemberList, pClient }) => {
    if (Array.isArray(groupMemberList)) {
        return groupMemberList;
    }
    if (groupMemberList && pClient && Array.isArray(groupMemberList?.[pClient]?.list)) {
        return groupMemberList[pClient].list;
    }
    if (groupMemberList && Array.isArray(groupMemberList?.list)) {
        return groupMemberList.list;
    }
    return [];
};

const getSearchBlob = (person) => {
    const values = [
        person?.person_id,
        person?.display_name,
        person?.name?.first,
        person?.name?.last,
        person?.location,
        person?.messaging?.sms,
        person?.messaging?.voice,
        person?.messaging?.office,
        person?.messaging?.email,
    ];
    return values.filter(Boolean).join(' ').toLowerCase();
};

const toTelHref = (phoneValue = '') => {
    const digitsOnly = `${phoneValue}`.replace(/\D/g, '');
    if (!digitsOnly) {
        return '';
    }
    return `tel:${digitsOnly}`;
};

const toMailtoHref = (emailValue = '') => {
    const cleanEmail = `${emailValue}`.trim();
    if (!cleanEmail) {
        return '';
    }
    return `mailto:${cleanEmail}`;
};

export default function GroupPhotoDirectory({ options = {}, onReset = () => { } }) {
    const classes = useStyles();
    const { state } = useSession();
    const { enqueueSnackbar } = useSnackbar();
    const gridScrollerRef = React.useRef(null);

    const AVAClass = AVAclasses();

    const { groupMemberList, pClient, pGroupName, pStyle, pRole, pPatient, pPatientName } = options;
    const directoryTitle = pGroupName || 'Photo Directory';
    const showContactInfo = !(
        options?.showContactInfo === false
        || options?.withContactInfo === false
        || options?.hideContactInfo === true
    );

    const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm'));

    const adminAccount =
        ['master', 'support', 'admin'].includes(state.profile.account_class)
        || (pRole === 'admin')
        || (pRole === 'responsible');

    const [searchValue, setSearchValue] = React.useState('');
    const [personCache, setPersonCache] = React.useState({});
    const [memberOverrides, setMemberOverrides] = React.useState({});
    const [hiddenImagePeople, setHiddenImagePeople] = React.useState({});
    const [renderCount, setRenderCount] = React.useState(INITIAL_RENDER_COUNT);
    const [viewPeopleMaintenance, setViewPeopleMaintenance] = React.useState(false);
    const [showSuperSize, setShowSuperSize] = React.useState(false);
    const [superSizeData, setSuperSizeData] = React.useState(false);
    const [promptForMessage, setPromptForMessage] = React.useState(false);
    const [recipient, setRecipient] = React.useState('');
    const [messageType, setMessageType] = React.useState('');
    const [requestingPrint, setRequestingPrint] = React.useState(false);

    const rawMembers = React.useMemo(() => {
        return normalizeList({ groupMemberList, pClient });
    }, [groupMemberList, pClient]);

    const requestedPersonIDs = React.useMemo(() => {
        return rawMembers
            .map((member) => {
                if (typeof member === 'string') {
                    return member.trim();
                }
                return `${member?.person_id || ''}`.trim();
            })
            .filter(Boolean);
    }, [rawMembers]);

    const preloadedList = state?.accessList?.[pClient]?.list;

    const preloadedPeopleByID = React.useMemo(() => {
        const response = {};
        if (!Array.isArray(preloadedList)) {
            return response;
        }
        preloadedList.forEach((personRec) => {
            const personID = personRec?.person_id;
            if (personID && (typeof personRec === 'object')) {
                response[personID] = personRec;
            }
        });
        return response;
    }, [preloadedList]);

    React.useEffect(() => {
        let active = true;
        const missingPersonIDs = rawMembers
            .filter(member => typeof member === 'string')
            .filter(personID => !personCache[personID]);

        if (missingPersonIDs.length === 0) {
            return () => {
                active = false;
            };
        }

        const preloadedMatches = missingPersonIDs
            .filter((personID) => preloadedPeopleByID[personID])
            .map((personID) => [personID, preloadedPeopleByID[personID]]);

        if (preloadedMatches.length > 0) {
            setPersonCache((prev) => {
                const next = { ...prev };
                preloadedMatches.forEach(([personID, personRec]) => {
                    next[personID] = personRec;
                });
                return next;
            });
        }

        const unresolvedPersonIDs = missingPersonIDs.filter((personID) => !preloadedPeopleByID[personID]);

        if (unresolvedPersonIDs.length === 0) {
            return () => {
                active = false;
            };
        }

        const loadPeople = async () => {
            for (let index = 0; index < unresolvedPersonIDs.length; index += PERSON_LOAD_BATCH_SIZE) {
                const thisBatch = unresolvedPersonIDs.slice(index, index + PERSON_LOAD_BATCH_SIZE);
                const loaded = await Promise.all(
                    thisBatch.map(async personID => {
                        try {
                            const personRec = await getPerson(personID, '*all');
                            return [personID, personRec || { person_id: personID }];
                        }
                        catch (error) {
                            return [personID, { person_id: personID }];
                        }
                    })
                );

                if (!active) {
                    return;
                }

                setPersonCache(prev => {
                    let next = { ...prev };
                    loaded.forEach(([personID, personRec]) => {
                        next[personID] = personRec;
                    });
                    return next;
                });
            }
        };

        loadPeople();

        return () => {
            active = false;
        };
    }, [rawMembers, personCache, preloadedPeopleByID]);

    const directoryPeople = React.useMemo(() => {
        const records = rawMembers
            .map(member => {
                if (typeof member === 'string') {
                    return memberOverrides[member] || personCache[member] || { person_id: member };
                }
                const memberID = member?.person_id;
                if (memberID && memberOverrides[memberID]) {
                    return memberOverrides[memberID];
                }
                return member;
            })
            .filter(Boolean)
            .filter((personRec) => personRec?.directory_option !== 'exclude');

        records.sort((a, b) => {
            const aLast = (a?.name?.last || '').toLowerCase();
            const bLast = (b?.name?.last || '').toLowerCase();
            if (aLast < bLast) { return -1; }
            if (aLast > bLast) { return 1; }
            const aFirst = (a?.name?.first || '').toLowerCase();
            const bFirst = (b?.name?.first || '').toLowerCase();
            if (aFirst < bFirst) { return -1; }
            if (aFirst > bFirst) { return 1; }
            return (a?.person_id || '').localeCompare(b?.person_id || '');
        });

        if (!searchValue.trim()) {
            return records;
        }

        const lowerSearch = searchValue.trim().toLowerCase();
        return records.filter(person => getSearchBlob(person).includes(lowerSearch));
    }, [rawMembers, personCache, memberOverrides, searchValue]);

    const peopleByID = React.useMemo(() => {
        const response = {
            ...preloadedPeopleByID,
            ...personCache,
            ...memberOverrides,
        };
        rawMembers.forEach((member) => {
            if (member && (typeof member === 'object') && member.person_id && !response[member.person_id]) {
                response[member.person_id] = member;
            }
        });
        return response;
    }, [preloadedPeopleByID, personCache, memberOverrides, rawMembers]);

    const refreshDirectoryPerson = React.useCallback(async (personID) => {
        if (!personID) {
            return false;
        }
        try {
            const refreshedPerson = await getPerson(personID, '*all');
            if (!refreshedPerson) {
                return false;
            }
            setPersonCache((prev) => ({
                ...prev,
                [personID]: refreshedPerson
            }));
            setMemberOverrides((prev) => ({
                ...prev,
                [personID]: refreshedPerson
            }));
            return true;
        }
        catch {
            // no-op: keep existing row data if refresh fails
            return false;
        }
    }, []);

    React.useEffect(() => {
        setRenderCount(INITIAL_RENDER_COUNT);
    }, [searchValue, directoryPeople.length]);

    const visiblePeople = React.useMemo(() => {
        return directoryPeople.slice(0, renderCount);
    }, [directoryPeople, renderCount]);

    function makeContactLines(pMessaging, pPreference, pPerson) {
        let returnArray = [];
        for (const msgType in pMessaging) {
            switch (msgType) {
                case 'sms': {
                    if (pMessaging.sms && (!pMessaging.sms_private || adminAccount)) {
                        returnArray.push({
                            action: [`sms:${pMessaging.sms}`, `tel:${pMessaging.sms}`],
                            button: ['Send Text', 'Call Cell'],
                            type: 'cell',
                            display: [formatPhone(pMessaging.sms)],
                            private: pMessaging.sms_private
                        });
                    }
                    break;
                }
                case 'voice': {
                    if (pMessaging.voice && (!pMessaging.voice_private || adminAccount)) {
                        returnArray.push({
                            action: [`tel:${pMessaging.voice}`],
                            button: ['Call Home'],
                            type: 'home',
                            display: [formatPhone(pMessaging.voice)],
                            private: pMessaging.voice_private
                        });
                    }
                    break;
                }
                case 'office': {
                    if (pMessaging.office && (!pMessaging.office_private || adminAccount)) {
                        returnArray.push({
                            action: [`tel:${pMessaging.office}`],
                            button: ['Call Work'],
                            type: 'work',
                            display: [formatPhone(pMessaging.office)],
                            private: pMessaging.office_private
                        });
                    }
                    break;
                }
                case 'email': {
                    if (pMessaging.email && (!pMessaging.email_private || adminAccount)) {
                        returnArray.push({
                            action: [`mailto:${pMessaging.email}`],
                            button: ['e-Mail'],
                            type: 'e-Mail',
                            display: (((pMessaging.email.length < 20) || !isMobile) ? [pMessaging.email] : pMessaging.email.split('@')),
                            private: pMessaging.email_private
                        });
                    }
                    break;
                }
                default: { break; }
            }
        }
        return returnArray;
    }

    /*
    function formatLocalData(ldKey, inData) {
        switch (state.session.local_data?.[ldKey]) {
            case 'phone': { return formatPhone(inData); }
            case 'boolean': { return (inData ? 'Yes' : 'No'); }
            case 'date': { return makeDate(inData).dateOnly; }
            case 'fulldate': { return makeDate(inData).absolute; }
            default: { return inData; }
        }
    }
    */

    function handleGridScroll(event) {
        const target = event.currentTarget;
        const nearBottom = (target.scrollTop + target.clientHeight) >= (target.scrollHeight - 120);
        if (nearBottom && (renderCount < directoryPeople.length)) {
            setRenderCount((previousCount) => {
                return Math.min(previousCount + RENDER_BATCH_COUNT, directoryPeople.length);
            });
        }
    }

    function stopCardClick(event) {
        event.stopPropagation();
    }

    function hideImageForPerson(personID) {
        if (!personID) {
            return;
        }
        setHiddenImagePeople((previousMap) => {
            if (previousMap[personID]) {
                return previousMap;
            }
            return {
                ...previousMap,
                [personID]: true,
            };
        });
    }

    async function handlePrintDirectory() {
        if (requestingPrint) {
            return;
        }

        if (!pClient || requestedPersonIDs.length === 0) {
            enqueueSnackbar('No accounts are available to print for this directory.', {
                variant: 'warning'
            });
            return;
        }

        const invokeParams = {
            FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:printDirectory',
            Payload: JSON.stringify({
                body: {
                    client_id: pClient,
                    requestor: pPatient,
                    report_title: directoryTitle,
                    paperSize: (state?.session?.directory_format?.paperSize || [563, 750]),
                    showImages: true,
                    person_id: requestedPersonIDs,
                }
            })
        };

        setRequestingPrint(true);
        await lambda
            .invoke(invokeParams)
            .promise()
            .then(() => {
                enqueueSnackbar(`Directory print request for ${directoryTitle} has been submitted.`, {
                    variant: 'success'
                });
            })
            .catch((error) => {
                enqueueSnackbar(`AVA encountered an error while requesting a Group Directory. Error is ${error.message}`, {
                    variant: 'error'
                });
            });
        setRequestingPrint(false);
    }

    return (
        <Box className={classes.wrapper}>
            {!showSuperSize && <Box className={classes.fixedHeader}>

                <Box className={classes.titleRow}>
                    <Typography variant='h6' className={classes.titleText}>
                        {directoryTitle}
                    </Typography>
                    {false && <Box className={classes.titleActions} />}
                </Box>

                <Box className={classes.topBar} display='flex' alignItems='center'>
                    <TextField
                        className={classes.searchField}
                        label='Search & Filter'
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        variant='outlined'
                        size='small'
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon fontSize='small' />
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>

                <Typography variant='body2' className={classes.resultCount}>
                    {rawMembers.length} people in this directory
                </Typography>
                {searchValue.trim() && (
                    <Typography variant='body2' className={classes.resultCount}>
                        This is a filtered list. {directoryPeople.length} match{directoryPeople.length !== 1 ? 'es' : ''} found.
                    </Typography>
                )}
            </Box>}

            {!showSuperSize &&
                <Box className={classes.gridScroller} onScroll={handleGridScroll} ref={gridScrollerRef}>
                    {directoryPeople.length === 0 && (
                        <Paper className={classes.emptyState} variant='outlined'>
                            <Typography variant='body1'>No people match your search.</Typography>
                        </Paper>
                    )}

                    <Grid container spacing={1}>
                        {visiblePeople.map(person => {
                            let personLast, addressValue;
                            let imbeddedTitle;
                            const personFirst = (person.name?.first || '').trim();
                            [personLast, imbeddedTitle] = (person.name?.last || '').split('~');
                            personLast = (personLast || '').trim();
                            const displayName = `${personFirst} ${personLast}`.trim() || (person.display_name || '').trim();
                            if (!displayName) {
                                return null;
                            }
                            const suppressContact = (!showContactInfo || (person?.directory_option === 'no_contact'));
                            const rawCellPhoneValue = suppressContact ? '' : (person.contact_info?.cell?.number || person?.messaging?.sms || '');
                            const rawHomePhoneValue = suppressContact ? '' : (person.contact_info?.landline?.number || person?.messaging?.voice || '');
                            const rawWorkPhoneValue = suppressContact ? '' : (person.contact_info?.work?.number || person?.messaging?.office || '');
                            const emailValue = suppressContact ? '' : (person?.messaging?.email || '');
                            const cellPhoneValue = suppressContact ? '' : formatPhone(rawCellPhoneValue);
                            const homePhoneValue = suppressContact ? '' : formatPhone(rawHomePhoneValue);
                            const workPhoneValue = suppressContact ? '' : formatPhone(rawWorkPhoneValue);
                            const cellPhoneHref = suppressContact ? '' : toTelHref(rawCellPhoneValue);
                            const homePhoneHref = suppressContact ? '' : toTelHref(rawHomePhoneValue);
                            const workPhoneHref = suppressContact ? '' : toTelHref(rawWorkPhoneValue);
                            const emailHref = suppressContact ? '' : toMailtoHref(emailValue);
                            const imageSrc = getImage(person, { allowS3Fallback: false, allowS3Backfill: false });
                            const showPortraitImage = Boolean(imageSrc) && !hiddenImagePeople[person?.person_id];
                            const roleOrTitle = (person?.role_or_title || '').trim();
                            const directoryPartnerId = `${person?.directory_partner || ''}`.trim();
                            let mergePartnerLabel = '';
                            if ((person?.directory_option === 'merge') && directoryPartnerId) {
                                const partnerRec = peopleByID[directoryPartnerId];
                                const partnerFirst = (partnerRec?.name?.first || '').trim();
                                let partnerLast = ((partnerRec?.name?.last || '').split('~')[0] || '').trim();
                                if (partnerLast && personLast && (partnerLast.toLowerCase() === personLast.toLowerCase())) {
                                    partnerLast = '';
                                }
                                const partnerName = [partnerFirst, partnerLast].filter(Boolean).join(' ').trim();
                                if (partnerName) {
                                    mergePartnerLabel = `(and ${partnerName})`;
                                }
                            }
                            if (!isEmpty(person.address)) {
                                let returnValue = '';
                                let splitAddress = person.address?.address?.split('~') || [''];
                                if (splitAddress) {
                                    returnValue = splitAddress[0];
                                    if (splitAddress.length > 1) {
                                        imbeddedTitle = splitAddress[1];
                                    };
                                }
                                if (person.address?.address2) { returnValue += `; ${person.address.address2}`; }
                                if (person.address?.city) { returnValue += `<br/ >${person.address.city}`; }
                                if (person.address?.state) { returnValue += `, ${person.address.state}`; }
                                else if (person.state) { returnValue += `, ${person.state}`; }
                                if (person.address?.zip_code || person.address?.zip) { returnValue += ` ${person.address.zip_code || person.address.zip}`; }
                                else if (person.zip) { returnValue += ` ${person.zip}`; }
                                addressValue = returnValue;
                            }
                            else if (!isEmpty(person.location)) {
                                [addressValue, imbeddedTitle] = person.location.split('~');
                            }
                            return (
                                <Grid
                                    item
                                    key={person?.person_id}
                                    xs={12}
                                    sm={6}
                                    md={6}
                                    lg={4}
                                    xl={3}
                                >
                                    <Paper
                                        variant='outlined'
                                        className={classes.card}
                                        onClick={async () => {
                                            if (pStyle === 'select' && typeof options?.onSelectPerson === 'function') {
                                                options.onSelectPerson(person);
                                                onReset({ updatesMade: false });
                                                return;
                                            }
                                            if (adminAccount) {
                                                setViewPeopleMaintenance(person?.person_id || false);
                                            } else {
                                                const personData = { ...person };
                                                personData.role = await getRole(options.pGroup, person.person_id);
                                                if (!personData.account_class) {
                                                    personData.account_class = determineClass(personData.groups, state.session.group_assignments);
                                                }
                                                setSuperSizeData(personData);
                                                setShowSuperSize(true);
                                            }
                                        }}
                                    >
                                        <Box className={classes.portraitSlot}>
                                            {showPortraitImage
                                                ? <Box
                                                    component='img'
                                                    src={imageSrc}
                                                    alt={`${person.name?.first || ''} ${personLast || ''}`.trim()}
                                                    className={classes.portraitMedia}
                                                    onError={() => hideImageForPerson(person?.person_id)}
                                                />
                                                : <Box className={classes.portraitPlaceholder} />
                                            }
                                        </Box>
                                        <Box className={classes.cardBody}>
                                            <Typography variant='subtitle1' className={classes.cardName}>
                                                {`${person.name?.first || ''} ${personLast || ''}`}
                                            </Typography>
                                            {roleOrTitle && (
                                                <Typography variant='caption' color='textSecondary' style={{ marginTop: '-4px', fontWeight: 700 }}>
                                                    {roleOrTitle}
                                                </Typography>
                                            )}
                                            {mergePartnerLabel && (
                                                <Typography variant='caption' color='textSecondary' className={classes.cardSubtext}>
                                                    {mergePartnerLabel}
                                                </Typography>
                                            )}
                                            {imbeddedTitle && (
                                                <Typography variant='caption' color='textSecondary' className={classes.cardSubtext}>
                                                    {imbeddedTitle}
                                                </Typography>
                                            )}
                                            {addressValue && (
                                                <Typography variant='caption' color='textSecondary' className={classes.cardSubtext}>
                                                    {addressValue}
                                                </Typography>
                                            )}
                                            {cellPhoneValue &&
                                                <Typography variant='body2' color='textSecondary' className={classes.cardSubtext}>
                                                    <a href={cellPhoneHref} className={classes.contactLink} onClick={stopCardClick}>
                                                        <PhoneInTalkIcon className={classes.contactIcon} />
                                                        {`Cell: ${cellPhoneValue}`}
                                                    </a>
                                                </Typography>
                                            }
                                            {homePhoneValue &&
                                                <Typography variant='body2' color='textSecondary' className={classes.cardSubtext}>
                                                    <a href={homePhoneHref} className={classes.contactLink} onClick={stopCardClick}>
                                                        <PhoneInTalkIcon className={classes.contactIcon} />
                                                        {`Home: ${homePhoneValue}`}
                                                    </a>
                                                </Typography>
                                            }
                                            {workPhoneValue &&
                                                <Typography variant='body2' color='textSecondary' className={classes.cardSubtext}>
                                                    <a href={workPhoneHref} className={classes.contactLink} onClick={stopCardClick}>
                                                        <PhoneInTalkIcon className={classes.contactIcon} />
                                                        {`Work: ${workPhoneValue}`}
                                                    </a>
                                                </Typography>
                                            }
                                            {emailValue &&
                                                <Typography variant='body2' color='textSecondary' className={classes.cardSubtext}>
                                                    <a href={emailHref} className={classes.contactLink} onClick={stopCardClick}>
                                                        <SendIcon className={classes.contactIcon} />
                                                        {emailValue}
                                                    </a>
                                                </Typography>
                                            }
                                        </Box>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            }

            {showSuperSize && superSizeData &&
                <List classes={{ root: classes.superSizeArea }}>
                    <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
                        <Box>
                            <Box
                                component="img"
                                mt={5}
                                minWidth={250}
                                maxWidth={250}
                                alt=''
                                src={getObject(superSizeData.person_id, 'image') || getImage(superSizeData.person_id)}
                            />
                        </Box>
                        <Typography className={classes.superSizeLast}>{superSizeData.name?.last || superSizeData.display_name}</Typography>
                        <Typography className={classes.superSizeFirst}>{superSizeData.name?.first}</Typography>
                        {(superSizeData.member_of) &&
                            <Typography key='member_of-superSize' className={classes.upSizeLast}>{superSizeData.member_of}</Typography>
                        }
                        {superSizeData.location && superSizeData.location.split('~').map((locLine, locIndex) => (
                            <Typography key={`locationLine-superSize_${locIndex}`} className={classes.upSizeLocation}>{locLine.trim()}</Typography>
                        ))}
                        {(superSizeData.directory_option === 'exclude') &&
                            <Typography key='excluded-superSize' className={classes.upSizeLocation}>{'** Excluded from Directory **'}</Typography>
                        }
                        {(showContactInfo ? makeContactLines(superSizeData.messaging, superSizeData.preferred_method, superSizeData) : [])
                            .map((prefLine, prefIndex) => (
                                <a href={prefLine.action[0]}
                                    key={`prefLink-superSize.${prefIndex}`}
                                    style={{ color: 'inherit', textDecoration: 'none' }}>
                                    <Box className={classes.upSizePreferenceBox} display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
                                        <Typography key={`prefLine-superSize.${prefIndex}a`} className={classes.adName}>
                                            {sentenceCase(prefLine.type)}
                                        </Typography>
                                        <Typography key={`prefLine-superSize.${prefIndex}b`} className={classes.superSizePreferenceLine2}>
                                            {(!adminAccount && prefLine.private) ? 'unpublished' : prefLine.display[0]}
                                        </Typography>
                                    </Box>
                                    {(prefLine.display.length > 1) && (adminAccount || !prefLine.private) &&
                                        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
                                            <Typography key={`prefLine-superSize.${prefIndex}c`} className={classes.superSizePreferenceLine2}>
                                                @{prefLine.display[1]}
                                            </Typography>
                                        </Box>
                                    }
                                </a>
                            ))}
                        <Box display='flex' className={classes.giveMoreSpace} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Button
                                className={AVAClass.AVAButton}
                                style={{ backgroundColor: 'red', color: 'white' }}
                                size='small'
                                startIcon={<CloseIcon size="small" />}
                                onClick={() => {
                                    setShowSuperSize(false);
                                }}
                            >
                                {'Back'}
                            </Button>
                            {showContactInfo &&
                                <Button
                                    className={AVAClass.AVAButton}
                                    style={{ backgroundColor: 'blue', color: 'white' }}
                                    size='small'
                                    startIcon={<SendIcon size="small" />}
                                    onClick={() => {
                                        setPromptForMessage(true);
                                        setMessageType('');
                                        let rKey = `${superSizeData.name?.first} ${superSizeData.name?.last}:${superSizeData.person_id}`;
                                        setRecipient(rKey.trim());
                                    }}
                                >
                                    {`AVA Msg`}
                                </Button>
                            }
                        </Box>
                        <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                            {(showContactInfo ? makeContactLines(superSizeData.messaging, superSizeData.preferred_method, superSizeData) : [])
                                .map((prefLine, prefIndex) => (
                                    <React.Fragment key={`Frag_${prefIndex}`}>
                                        <a href={prefLine.action[0]}
                                            key={`aRefButtonLine0.${prefIndex}`}
                                            style={{ textDecoration: 'none' }}>
                                            <Button
                                                className={AVAClass.AVAButton}
                                                style={{ backgroundColor: 'blue', color: 'white' }}
                                                size='small'
                                            >
                                                {prefLine.button[0]}
                                            </Button>
                                        </a>
                                        {(prefLine.action.length > 1) &&
                                            <a href={prefLine.action[1]}
                                                key={`aRefButtonLine1.${prefIndex}`}
                                                style={{ textDecoration: 'none' }}>
                                                <Button
                                                    className={AVAClass.AVAButton}
                                                    style={{ backgroundColor: 'blue', color: 'white' }}
                                                    size='small'
                                                >
                                                    {prefLine.button[1]}
                                                </Button>
                                            </a>
                                        }
                                    </React.Fragment>
                                ))}
                        </Box>
                    </Box>
                </List>
            }

            <Box className={classes.bottomActionBar}>
                <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    startIcon={<CloseIcon fontSize="small" />}
                    onClick={() => onReset({ updatesMade: false })}
                >
                    Exit
                </Button>
                <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                    size='small'
                    startIcon={<PrintIcon fontSize='small' />}
                    onClick={handlePrintDirectory}
                    disabled={requestingPrint || requestedPersonIDs.length === 0}
                >
                    {requestingPrint ? 'Submitting...' : 'Print'}
                </Button>
            </Box>

            {viewPeopleMaintenance &&
                <PeopleMaintenance
                    person_id={viewPeopleMaintenance}
                    key={`goForPeople_${viewPeopleMaintenance}`}
                    initialValues={{ color: 'green' }}
                    options={{
                        sectionToShow: ['snapshot']
                    }}
                    onClose={async (returnObj) => {
                        if (returnObj && returnObj.changesMade) {
                            const refreshed = await refreshDirectoryPerson(viewPeopleMaintenance);
                            if (!refreshed && (returnObj.directory_option === 'exclude')) {
                                setMemberOverrides((prev) => ({
                                    ...prev,
                                    [viewPeopleMaintenance]: {
                                        person_id: viewPeopleMaintenance,
                                        directory_option: 'exclude'
                                    }
                                }));
                            }
                        }
                        setViewPeopleMaintenance(false);
                    }}
                />
            }
            {promptForMessage &&
                <MakeMessage
                    titleText={(messageType && messageType.includes('URGENT')) ? 'AVA will attempt to voice call all phones' : null}
                    promptText={['Subject', `What should your message to ${recipient ? recipient.split(':')[0] : ''} say?`, `(Optional) Alternate message if leaving Voice Mail`]}
                    promptUse={['subject', 'message', 'voicemail']}
                    buttonText={'Send'}
                    sender={{
                        "client_id": pClient,
                        "patient_id": pPatient,
                        "patient_display_name": pPatientName
                    }}
                    pRecipientID={recipient ? recipient.split(':')[1] : ''}
                    pRecipientName={recipient ? recipient.split(':')[0] : ''}
                    onCancel={() => { setPromptForMessage(false); }}
                    onComplete={() => { setPromptForMessage(false); }}
                    setMethod={(messageType === 'AVA') ? 'AVA' : (messageType && messageType.includes('URGENT') ? 'voice' : null)}
                    allowCancel={true}
                />
            }
        </Box>
    );
}