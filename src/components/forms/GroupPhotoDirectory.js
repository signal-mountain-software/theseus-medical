import React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import InputAdornment from '@material-ui/core/InputAdornment';

import SearchIcon from '@material-ui/icons/Search';
import CloseIcon from '@material-ui/icons/ExitToApp';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import SendIcon from '@material-ui/icons/Send';
import PictureAsPdfIcon from '@material-ui/icons/PictureAsPdf';

import useSession from '../../hooks/useSession';
import { getImage, getPerson, formatPhone } from '../../util/AVAPeople';
import { AVAclasses } from '../../util/AVAStyles';
import { isEmpty } from '../../util/AVAUtilities';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

const INITIAL_RENDER_COUNT = 30;
const RENDER_BATCH_COUNT = 30;
const PERSON_LOAD_BATCH_SIZE = 20;
const PDF_CAPTURE_SCALE = 1.35;

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
    closeIconButton: {
        flexShrink: 0,
        alignSelf: 'flex-start',
        padding: theme.spacing(0.5),
    },
    titleActions: {
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
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
        flexDirection: 'column',
        overflow: 'hidden',
        border: `2px solid ${theme.palette.text.primary}`,
        borderRadius: theme.spacing(1),
        [theme.breakpoints.down('sm')]: {
            border: `3px solid ${theme.palette.text.primary}`,
        }
    },
    portraitMedia: {
        width: '100%',
        height: theme.spacing(26),
        objectFit: 'cover',
        objectPosition: 'center',
    },
    cardBody: {
        padding: theme.spacing(1.5),
    },
    cardName: {
        fontWeight: 600,
        lineHeight: 1.2,
        marginBottom: 0,
        fontSize: '1.7rem',
    },
    cardSubtext: {
        marginTop: theme.spacing(0.5),
        fontSize: '1.2rem',
        fontWeight: 400,
        opacity: 0.8,
    },
    contactLink: {
        color: 'inherit',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
    },
    contactIcon: {
        fontSize: '0.95rem',
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
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: theme.spacing(1.5),
        paddingBottom: theme.spacing(1.5),
        backgroundColor: theme.palette.background.paper,
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
    const wrapperRef = React.useRef(null);
    const gridScrollerRef = React.useRef(null);

    const AVAClass = AVAclasses();

    const { groupMemberList, pClient, pGroupName, pStyle } = options;

    const [searchValue, setSearchValue] = React.useState('');
    const [personCache, setPersonCache] = React.useState({});
    const [memberOverrides, setMemberOverrides] = React.useState({});
    const [hiddenImagePeople, setHiddenImagePeople] = React.useState({});
    const [renderCount, setRenderCount] = React.useState(INITIAL_RENDER_COUNT);
    const [downloadingPdf, setDownloadingPdf] = React.useState(false);
    const [viewPeopleMaintenance, setViewPeopleMaintenance] = React.useState(false);

    const rawMembers = React.useMemo(() => {
        return normalizeList({ groupMemberList, pClient });
    }, [groupMemberList, pClient]);

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

    async function waitForPaint(delay = 60) {
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    async function downloadDirectoryPdf() {
        if (downloadingPdf || !wrapperRef.current || !gridScrollerRef.current || (directoryPeople.length === 0)) {
            return;
        }

        setDownloadingPdf(true);

        const wrapperEl = wrapperRef.current;
        const gridEl = gridScrollerRef.current;
        const originalRenderCount = renderCount;
        const originalScrollTop = gridEl.scrollTop;

        try {
            setRenderCount(directoryPeople.length);
            await waitForPaint(120);

            gridEl.scrollTop = 0;

            const pdfDoc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();
            const horizontalMargin = 24;
            const verticalMargin = 24;
            const printableWidth = pageWidth - (horizontalMargin * 2);
            const printableHeight = pageHeight - (verticalMargin * 2);

            const scrollerViewportHeight = gridEl.clientHeight;
            const totalScrollableHeight = gridEl.scrollHeight;
            const pageCount = Math.max(1, Math.ceil(totalScrollableHeight / scrollerViewportHeight));

            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                gridEl.scrollTop = pageIndex * scrollerViewportHeight;
                await waitForPaint(60);

                const canvas = await html2canvas(wrapperEl, {
                    scale: PDF_CAPTURE_SCALE,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: wrapperEl.clientWidth,
                    windowHeight: wrapperEl.clientHeight,
                });

                let imageData = canvas.toDataURL('image/jpeg', 0.92);
                if (!imageData.startsWith('data:image/')) {
                    imageData = canvas.toDataURL('image/png');
                }
                const mimeType = imageData.slice(5, imageData.indexOf(';')).toLowerCase();
                const imageFormat = mimeType.includes('png') ? 'PNG' : 'JPEG';
                const imageProps = pdfDoc.getImageProperties(imageData);
                const renderedImageHeight = (imageProps.height * printableWidth) / imageProps.width;

                if (pageIndex > 0) {
                    pdfDoc.addPage();
                }
                pdfDoc.addImage(imageData, imageFormat, horizontalMargin, verticalMargin, printableWidth, Math.min(renderedImageHeight, printableHeight));
                await waitForPaint(20);
            }

            const safeName = `${pGroupName || 'photo_directory'}`
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .slice(0, 60);

            pdfDoc.save(`${safeName || 'photo_directory'}.pdf`);
        }
        finally {
            setRenderCount(originalRenderCount);
            setDownloadingPdf(false);
            await waitForPaint(20);
            gridEl.scrollTop = originalScrollTop;
        }
    }

    return (
        <Box className={classes.wrapper} ref={wrapperRef}>
            <Box className={classes.fixedHeader}>

                <Box className={classes.titleRow}>
                    <Typography variant='h6' className={classes.titleText}>
                        {pGroupName || 'Photo Directory'}
                    </Typography>
                    {false && <Box className={classes.titleActions}>
                        <IconButton
                            className={classes.closeIconButton}
                            aria-label='download directory pdf'
                            onClick={downloadDirectoryPdf}
                            disabled={downloadingPdf || (directoryPeople.length === 0)}
                        >
                            <PictureAsPdfIcon />
                        </IconButton>
                    </Box>}
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
            </Box>

            <Box className={classes.gridScroller} onScroll={handleGridScroll} ref={gridScrollerRef}>
                {directoryPeople.length === 0 && (
                    <Paper className={classes.emptyState} variant='outlined'>
                        <Typography variant='body1'>No people match your search.</Typography>
                    </Paper>
                )}

                <Grid container spacing={2}>
                    {visiblePeople.map(person => {
                        let personLast, addressValue;
                        let imbeddedTitle;
                        [personLast, imbeddedTitle] = person.name?.last?.split('~');
                        const suppressContact = (person?.directory_option === 'no_contact');
                        const rawCellPhoneValue = suppressContact ? '' : (person.contact_info?.cell?.number || person?.messaging?.sms || '');
                        const rawHomePhoneValue = suppressContact ? '' : (person.contact_info?.landline?.number || person?.messaging?.voice || '');
                        const emailValue = suppressContact ? '' : (person?.messaging?.email || '');
                        const cellPhoneValue = suppressContact ? '' : formatPhone(rawCellPhoneValue);
                        const homePhoneValue = suppressContact ? '' : formatPhone(rawHomePhoneValue);
                        const cellPhoneHref = suppressContact ? '' : toTelHref(rawCellPhoneValue);
                        const homePhoneHref = suppressContact ? '' : toTelHref(rawHomePhoneValue);
                        const emailHref = suppressContact ? '' : toMailtoHref(emailValue);
                        const imageSrc = getImage(person.person_id);
                        const showPortraitImage = Boolean(imageSrc) && !hiddenImagePeople[person?.person_id];
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
                            else if (person.city) { returnValue += `<br />${person.city}`; }
                            if (person.address?.state) { returnValue += `, ${person.address.state}`; }
                            else if (person.state) { returnValue += `, ${person.state}`; }
                            if (person.address?.zip) { returnValue += ` ${person.address.zip}`; }
                            else if (person.zip) { returnValue += ` ${person.zip}`; }
                            addressValue = returnValue;
                        }
                        else if (!isEmpty(person.location)) {
                            [addressValue, imbeddedTitle] = person.location.split('~');
                        }
                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={person?.person_id}>
                                <Paper
                                    variant='outlined'
                                    className={classes.card}
                                    onClick={() => {
                                        if (pStyle === 'select' && typeof options?.onSelectPerson === 'function') {
                                            options.onSelectPerson(person);
                                            onReset({ updatesMade: false });
                                            return;
                                        }
                                        setViewPeopleMaintenance(person?.person_id || false);
                                    }}
                                >
                                    {showPortraitImage &&
                                        <Box
                                            component='img'
                                            src={imageSrc}
                                            alt={`${person.name?.first || ''} ${personLast || ''}`.trim()}
                                            className={classes.portraitMedia}
                                            onError={() => hideImageForPerson(person?.person_id)}
                                        />
                                    }
                                    <Box className={classes.cardBody}>
                                        <Typography variant='subtitle1' className={classes.cardName}>
                                            {`${person.name?.first || ''} ${personLast || ''}`}
                                        </Typography>
                                        {imbeddedTitle && (
                                            <Typography variant='caption' color='textSecondary'>
                                                {imbeddedTitle}
                                            </Typography>
                                        )}
                                        {addressValue && (
                                            <Typography variant='caption' color='textSecondary'>
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
        </Box>
    );
}