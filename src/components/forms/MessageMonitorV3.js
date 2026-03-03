import React from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    Paper,
    Typography,
    TextField,
    MenuItem,
    Button,
    List,
    ListItem,
    ListItemText,
    Divider,
    CircularProgress
} from '@material-ui/core';
import { Alert } from '@material-ui/lab/';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Slide from '@material-ui/core/Slide';

import CloseIcon from '@material-ui/icons/ExitToApp';

import useSession from '../../hooks/useSession';
import { dbClient } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import QuickSearch from '../sections/QuickSearch';



const useStyles = makeStyles(theme => ({
    dialogBox: {
        minWidth: '100%',
        height: '100%',
        minHeight: 0,
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
    },
    wrapper: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        boxSizing: 'border-box'
    },
    topBar: {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(2),
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    filters: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing(2),
        alignItems: 'end',
        marginTop: theme.spacing(1)
    },
    scrollArea: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: theme.spacing(2)
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: theme.spacing(1),
    },
    bottomBar: {
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(1, 2, 2, 2),
        borderTop: `1px solid ${theme.palette.divider}`,
    },
    listPaper: {
        width: '100%'
    },
    muted: {
        opacity: 0.7
    },
    flagRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(0.5),
        marginTop: theme.spacing(0.6)
    },
    flagPill: {
        minWidth: 'auto',
        padding: theme.spacing(0.15, 0.8),
        fontSize: '0.68rem',
        lineHeight: 1.2,
        textTransform: 'none',
        borderRadius: 999,
        opacity: 0.8
    }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

function getDefaultDateRange() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    return {
        dateFrom: toDateInputValue(sevenDaysAgo),
        dateTo: toDateInputValue(now)
    };
}

function toDateInputValue(input) {
    if (!input) { return ''; }
    let dateObj;
    if (input instanceof Date) {
        dateObj = input;
    }
    else if ((typeof input === 'string') && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
        return input.trim();
    }
    else {
        const tryNative = new Date(input);
        if (!Number.isNaN(tryNative.getTime())) {
            dateObj = tryNative;
        }
        else {
            const normalized = makeDate(input);
            if (!normalized?.date || Number.isNaN(normalized.date.getTime())) {
                return '';
            }
            dateObj = normalized.date;
        }
    }
    const yyyy = dateObj.getFullYear();
    const mm = `${dateObj.getMonth() + 1}`.padStart(2, '0');
    const dd = `${dateObj.getDate()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function normalizeReceivers(message) {
    if (message.deliver_to != null) {
        if (typeof message.deliver_to === 'string') {
            const recipient = message.deliver_to.trim();
            return recipient ? [recipient] : [];
        }
        if (Array.isArray(message.deliver_to)) {
            return message.deliver_to
                .map(r => String(r || '').trim())
                .filter(r => r !== '');
        }
        const recipient = String(message.deliver_to).trim();
        return recipient ? [recipient] : [];
    }
    if (Array.isArray(message.recipientList)) {
        return message.recipientList.map(r => String(r));
    }
    if (Array.isArray(message.recipients)) {
        return message.recipients.map(r => String(r));
    }
    if (message.recipient) {
        return [String(message.recipient)];
    }
    if (message.receiver) {
        return [String(message.receiver)];
    }
    return [];
}

function normalizeStatus(message) {
    return (
        message.status
        || message.delivery_status
        || message.send_status
        || 'unknown'
    ).toString().toLowerCase();
}

function normalizeResultText(resultEntry) {
    if ((typeof resultEntry === 'string') || (typeof resultEntry === 'number')) {
        return String(resultEntry).toLowerCase();
    }
    if (!resultEntry || (typeof resultEntry !== 'object')) {
        return '';
    }
    return [
        resultEntry.result,
        resultEntry.status,
        resultEntry.message,
        resultEntry.text,
        resultEntry.note,
        resultEntry.description
    ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase())
        .join(' ');
}

function getResultFlags(message) {
    const resultsList = [message?.results].flat().filter(Boolean);
    const resultTextList = resultsList.map(normalizeResultText).filter(Boolean);
    const combinedText = resultTextList.join(' ');
    const resultValueList = resultsList
        .map((resultEntry) => {
            if ((typeof resultEntry === 'string') || (typeof resultEntry === 'number')) {
                return String(resultEntry).trim().toLowerCase();
            }
            if (!resultEntry || (typeof resultEntry !== 'object')) {
                return '';
            }
            return String(resultEntry.result || '').trim().toLowerCase();
        })
        .filter(Boolean);
    const avaOnly = (resultValueList.length > 0) && resultValueList.every(resultValue => resultValue === 'submitted');
    const wasRespondedTo = resultValueList.some(resultValue => {
        return (resultValue === 'response') || resultValue.includes('reply');
    });
    const callNotAnswered = resultTextList.some(resultText => resultText.includes('no answer')) || combinedText.includes('no answer');
    const emailOpened = resultsList.some((resultEntry) => {
        if (!resultEntry || (typeof resultEntry !== 'object')) {
            return false;
        }
        return String(resultEntry.result || '').toLowerCase() === 'open';
    });
    const acceptedByCarrier = resultsList.some((resultEntry) => {
        if (!resultEntry || (typeof resultEntry !== 'object')) {
            return false;
        }
        const resultValue = String(resultEntry.result || '').toLowerCase();
        const providerResponse = String(resultEntry?.info?.providerResponse || '').toLowerCase();
        return (resultValue === 'delivered') && providerResponse.includes('accepted');
    });
    const machineAnswered = resultTextList.some((resultText) => {
        return resultText.includes('machine') && resultText.includes('answer');
    }) || (combinedText.includes('machine') && combinedText.includes('answer'));
    const personAnswered = resultTextList.some((resultText) => {
        return resultText.includes('person') && resultText.includes('answer');
    }) || (combinedText.includes('person') && combinedText.includes('answer'));

    return {
        machine_answered: machineAnswered,
        person_answered: personAnswered,
        accepted_by_carrier: acceptedByCarrier,
        email_opened: emailOpened,
        call_not_answered: callNotAnswered,
        ava_only: avaOnly,
        was_responded_to: wasRespondedTo
    };
}

function getRecipientFlags(message) {
    const recipientList = message?.recipient_list;
    if (!recipientList || (typeof recipientList !== 'object')) {
        return {
            message_was_held: false,
            held_for_hold_reason: false,
            held_for_blocked_reason: false,
            held_for_replaced_reason: false,
            rule_used_values: [],
            rule_used_value: null
        };
    }

    const methodValue = String(recipientList.method || '').trim().toLowerCase();
    const holdReasonValue = String(recipientList.hold_reason || '').trim().toLowerCase();
    const messageWasHeld = methodValue === 'hold';

    const ruleUsedValues = [recipientList.rule_used]
        .flat()
        .map((ruleValue) => String(ruleValue || '').trim())
        .filter((ruleValue) => ruleValue !== '');

    const attachments = message?.content?.current?.attachments;
    const hasAttachment = (() => {
        if (typeof attachments === 'string') {
            return attachments.trim() !== '';
        }
        if (Array.isArray(attachments)) {
            return attachments.some((attachmentValue) => String(attachmentValue || '').trim() !== '');
        }
        return false;
    })();

    return {
        message_was_held: messageWasHeld,
        held_for_hold_reason: messageWasHeld && (holdReasonValue === 'hold'),
        held_for_blocked_reason: messageWasHeld && (holdReasonValue === 'blocked'),
        held_for_replaced_reason: messageWasHeld && (holdReasonValue === 'replaced'),
        rule_used_values: Array.from(new Set(ruleUsedValues)),
        rule_used_value: ruleUsedValues[0] || null,
        has_attachment: hasAttachment
    };
}

function getEnabledFlagLabels(derivedFlags = {}) {
    const flagMap = [
        ['machine_answered', 'Machine'],
        ['person_answered', 'Person'],
        ['accepted_by_carrier', 'Carrier OK'],
        ['email_opened', 'Opened'],
        ['call_not_answered', 'No Answer'],
        ['ava_only', 'AVA Only'],
        ['was_responded_to', 'Responded'],
        ['has_attachment', 'Attachment'],
        ['message_was_held', 'Held'],
        ['held_for_blocked_reason', 'Blocked'],
        ['held_for_replaced_reason', 'Replaced'],
        ['held_for_hold_reason', 'Hold']
    ];

    return flagMap
        .filter(([flagKey]) => !!derivedFlags[flagKey])
        .map(([, label]) => label);
}

function getMessageSubject(message) {
    return message?.subject_line || message?.subject || message?.title || 'No subject';
}

function getMessageText(message) {
    const contentCurrent = message?.content?.current || {};
    if (contentCurrent?.en?.text != null) {
        return String(contentCurrent.en.text);
    }
    if (contentCurrent?.original?.text != null) {
        return String(contentCurrent.original.text);
    }
    return '';
}

function normalizeDateValue(message) {
    return message.created_time || message.message_date || message.created_at || message.sent_at || message.timestamp || null;
}

function formatMessageDate(dateValue) {
    if (!dateValue) { return 'unknown date'; }
    const asNumber = Number(dateValue);
    if (!Number.isNaN(asNumber) && `${asNumber}`.length >= 8) {
        return makeDate(asNumber).absolute;
    }
    const asDate = new Date(dateValue);
    if (Number.isNaN(asDate.getTime())) { return String(dateValue); }
    return asDate.toLocaleString();
}

function normalizeIdList(value) {
    if (!value) { return []; }
    if (Array.isArray(value)) {
        return value
            .map(v => String(v || '').trim())
            .filter(v => v !== '');
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(v => v.trim())
            .filter(v => v !== '');
    }
    return [];
}

function parseDateInputAsLocalDate(input) {
    if (!input) { return null; }
    if (input instanceof Date) {
        return new Date(input.getTime());
    }
    if (typeof input === 'string') {
        const trimmed = input.trim();
        const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ymdMatch) {
            const [, y, m, d] = ymdMatch;
            return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
        return null;
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function getWeekNumberFromMessageTime(messageTime) {
    const ms = Number(messageTime);
    if (Number.isNaN(ms)) {
        return null;
    }

    const date = new Date(ms);
    const utcDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
    ));

    const isoDay = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDay);

    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

    return ((isoYear % 100) * 100) + isoWeek;
}

function toEpochMsString(dateInput, endOfDay = false) {
    if (!dateInput) { return ''; }
    const dateObj = parseDateInputAsLocalDate(dateInput);
    if (Number.isNaN(dateObj.getTime())) { return ''; }
    if (endOfDay) {
        dateObj.setHours(23, 59, 59, 999);
    }
    else {
        dateObj.setHours(0, 0, 0, 0);
    }
    return `${dateObj.getTime()}`;
}

function buildMessageWeekList(dateFromInput, dateToInput) {
    const fromDate = parseDateInputAsLocalDate(dateFromInput);
    const toDate = parseDateInputAsLocalDate(dateToInput);
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return [];
    }

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const weeks = new Set();
    for (let cursor = new Date(fromDate); cursor <= toDate; cursor.setDate(cursor.getDate() + 1)) {
        const weekNum = getWeekNumberFromMessageTime(cursor.getTime());
        if (weekNum !== null) {
            weeks.add(weekNum);
        }
    }
    return Array.from(weeks);
}

export default function MessageMonitorV3({ defaults = {}, onClose = () => { } }) {
    const classes = useStyles();
    const { state } = useSession();

    const AVAClass = AVAclasses();
    const myPatientId = state?.patient?.patient_id || state?.session?.patient_id || '';
    const currentClientId = state?.session?.client_id;
    const accessListReady = !!(state?.accessList && state?.accessList?.[currentClientId]);
    const accessList = state?.accessList?.[currentClientId]?.list || [];
    const quickSearchSpecialValues = React.useMemo(() => {
        return [
            { person_id: '*anyone', first: '*anyone', last: '', groups: [] },
            { person_id: '*me', first: '*me', last: '', groups: [] }
        ];
    }, []);

    React.useEffect(() => {
        if (!accessListReady) {
            onClose({
                message: 'AVA is still loading.  Please wait a moment.'
            });
        }
    }, [accessListReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const initialSenderIds = (() => {
        const explicit = normalizeIdList(defaults.senderIds || defaults.sender_ids);
        if (explicit.length > 0) { return explicit; }
        if ((defaults.sender || '').toLowerCase() === '*me') {
            return myPatientId ? [myPatientId] : [];
        }
        return [];
    })();

    const initialReceiverIds = normalizeIdList(defaults.receiverIds || defaults.receiver_ids);

    const defaultDates = getDefaultDateRange();
    const [filters, setFilters] = React.useState({
        senderIds: initialSenderIds,
        receiverIds: initialReceiverIds,
        senderDisplay: defaults.senderDisplay || defaults.sender_display || defaults.sender || '*me',
        receiverDisplay: defaults.receiverDisplay || defaults.receiver_display || defaults.receiver || '*anyone',
        dateFrom: toDateInputValue(defaults.dateFrom) || defaultDates.dateFrom,
        dateTo: toDateInputValue(defaults.dateTo) || defaultDates.dateTo,
        status: defaults.status || '*all'
    });
    const [loading, setLoading] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [messages, setMessages] = React.useState([]);
    const [selectedMessage, setSelectedMessage] = React.useState(null);
    const [showSenderQuickSearch, setShowSenderQuickSearch] = React.useState(false);
    const [showReceiverQuickSearch, setShowReceiverQuickSearch] = React.useState(false);
    const [senderQuickSearchData, setSenderQuickSearchData] = React.useState({
        selections: [],
        accessList,
        special_values: quickSearchSpecialValues,
    });
    const [receiverQuickSearchData, setReceiverQuickSearchData] = React.useState({
        selections: [],
        accessList,
        special_values: quickSearchSpecialValues,
    });

    const statusOptions = ['*all', 'machine_answered', 'person_answered', 'accepted_by_carrier', 'email_opened', 'call_not_answered', 'ava_only', 'was_responded_to', 'has_attachment'];

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const openSenderPicker = () => {
        if (!accessListReady) {
            onClose({
                message: 'AVA is still loading.  Please wait a moment.'
            });
            return;
        }
        setShowSenderQuickSearch(true);
    };

    const openReceiverPicker = () => {
        if (!accessListReady) {
            onClose({
                message: 'AVA is still loading.  Please wait a moment.'
            });
            return;
        }
        setShowReceiverQuickSearch(true);
    };

    React.useEffect(() => {
        setSenderQuickSearchData(prev => ({
            ...prev,
            accessList,
            special_values: quickSearchSpecialValues
        }));
        setReceiverQuickSearchData(prev => ({
            ...prev,
            accessList,
            special_values: quickSearchSpecialValues
        }));
    }, [accessList, quickSearchSpecialValues]);

    const personNameFromAccessList = (personId) => {
        const normalizedPersonId = String(personId || '').trim();
        if (!normalizedPersonId) { return ''; }
        const found = accessList.find(p => String(p.person_id || '').trim() === normalizedPersonId)
            || accessList.find(p => String(p.person_id || '').trim().toLowerCase() === normalizedPersonId.toLowerCase());
        if (!found) { return personId; }
        const first = found.first || found?.name?.first || '';
        const last = found.last || found?.name?.last || '';
        const full = `${first} ${last}`.trim();
        return full || found.display_name || normalizedPersonId;
    };

    const summarizeSelectionDisplay = (selections, personIds, type) => {
        if (!selections || selections.length === 0) {
            return (type === 'sender') ? '*me' : '*anyone';
        }
        if (selections.length === 1) {
            const [firstSelection] = selections;
            if (firstSelection.person_id) {
                if ((type === 'sender') && (firstSelection.person_id === myPatientId)) {
                    return '*me';
                }
                return firstSelection.person_name || personNameFromAccessList(firstSelection.person_id);
            }
            if (firstSelection.listName) {
                return firstSelection.listName;
            }
            if (firstSelection.group_name) {
                return firstSelection.group_name;
            }
        }
        return `${personIds.length} selected`;
    };

    const extractPersonIds = (selections) => {
        const selectedIds = new Set();
        for (const selection of (selections || [])) {
            if (selection.person_id) {
                selectedIds.add(selection.person_id);
            }
            if (Array.isArray(selection.personList)) {
                selection.personList.forEach(personId => selectedIds.add(personId));
            }
            if (selection.group_id) {
                accessList.forEach(person => {
                    if (person?.groups?.includes(selection.group_id)) {
                        selectedIds.add(person.person_id);
                    }
                });
            }
        }
        return Array.from(selectedIds);
    };

    const applyQuickSearchSelections = (type, selections) => {
        const personIds = extractPersonIds(selections);
        const display = summarizeSelectionDisplay(selections, personIds, type);
        if (type === 'sender') {
            setFilters(prev => ({
                ...prev,
                senderIds: personIds,
                senderDisplay: display,
            }));
        }
        else {
            setFilters(prev => ({
                ...prev,
                receiverIds: personIds,
                receiverDisplay: display,
            }));
        }
    };

    const updateSenderQuickSearchData = (newData, force = false) => {
        setSenderQuickSearchData(prev => ({ ...prev, ...newData }));
        if (newData?.selections) {
            applyQuickSearchSelections('sender', newData.selections);
        }
        if (force) { }
    };

    const updateReceiverQuickSearchData = (newData, force = false) => {
        setReceiverQuickSearchData(prev => ({ ...prev, ...newData }));
        if (newData?.selections) {
            applyQuickSearchSelections('receiver', newData.selections);
        }
        if (force) { }
    };

    const runSearch = async () => {
        setLoading(true);
        setErrorText('');
        try {
            const senderMatch = (filters.senderDisplay || '').trim().toLowerCase();
            const receiverMatch = (filters.receiverDisplay || '').trim().toLowerCase();
            const senderIdMatch = (filters.senderIds || []).map(v => String(v).toLowerCase());
            const receiverIdMatch = (filters.receiverIds || []).map(v => String(v).toLowerCase());
            const myIdentityList = [state?.session?.patient_id]
                .filter(Boolean)
                .map(v => String(v).toLowerCase());
            const senderHasAnyone = senderIdMatch.includes('*anyone') || (senderMatch === '*anyone');
            const receiverHasAnyone = receiverIdMatch.includes('*anyone') || (receiverMatch === '*anyone');
            const senderHasMe = senderIdMatch.includes('*me') || (senderMatch === '*me');
            const receiverHasMe = receiverIdMatch.includes('*me') || (receiverMatch === '*me');
            const fromDate = filters.dateFrom ? parseDateInputAsLocalDate(filters.dateFrom) : null;
            const toDate = filters.dateTo ? parseDateInputAsLocalDate(filters.dateTo) : null;
            if (toDate) {
                toDate.setHours(23, 59, 59, 999);
            }

            const effectiveSenderIds = (() => {
                if (senderIdMatch.length > 0) {
                    return senderIdMatch;
                }
                if (senderMatch === '*me') {
                    return myIdentityList;
                }
                return [];
            })();

            const effectiveReceiverIds = (() => {
                if (receiverIdMatch.length > 0) {
                    return receiverIdMatch;
                }
                if (receiverMatch === '*me') {
                    return myIdentityList;
                }
                return [];
            })();

            const querySenderIds = Array.from(new Set(
                effectiveSenderIds.flatMap(id => {
                    if (id === '*anyone') { return []; }
                    if (id === '*me') { return myIdentityList; }
                    return [id];
                })
            ));

            const queryReceiverIds = Array.from(new Set(
                effectiveReceiverIds.flatMap(id => {
                    if (id === '*anyone') { return []; }
                    if (id === '*me') { return myIdentityList; }
                    return [id];
                })
            ));

            const canUseSenderWeekIndex = (!senderHasAnyone && (querySenderIds.length > 0));
            const canUseReceiverWeekIndex = (!canUseSenderWeekIndex && !receiverHasAnyone && (queryReceiverIds.length > 0));
            let scanResults = [];

            if (canUseSenderWeekIndex) {
                const weekList = buildMessageWeekList(filters.dateFrom, filters.dateTo);
                const startEpochMs = toEpochMsString(filters.dateFrom, false);
                const endEpochMs = toEpochMsString(filters.dateTo, true);

                for (const senderId of querySenderIds) {
                    for (const messageWeek of weekList) {
                        let lastKey;
                        let pageGuard = 0;
                        do {
                            const response = await dbClient
                                .query({
                                    TableName: 'TheseusMessages',
                                    IndexName: 'delivery_sender_week',
                                    KeyConditionExpression: 'sent_from = :sf AND messageWeek = :mw AND created_time BETWEEN :start AND :end',
                                    ExpressionAttributeValues: {
                                        ':sf': senderId,
                                        ':mw': Number(messageWeek),
                                        ':start': startEpochMs,
                                        ':end': endEpochMs,
                                        ':rt': 'delivery'
                                    },
                                    FilterExpression: 'record_type = :rt',
                                    ExclusiveStartKey: lastKey,
                                    ScanIndexForward: false,
                                    Limit: 250
                                })
                                .promise();
                            if (Array.isArray(response?.Items) && response.Items.length > 0) {
                                scanResults.push(...response.Items);
                            }
                            lastKey = response?.LastEvaluatedKey;
                            pageGuard++;
                        } while (lastKey && pageGuard < 20);
                    }
                }
            }
            else if (canUseReceiverWeekIndex) {
                const weekList = buildMessageWeekList(filters.dateFrom, filters.dateTo);
                const startEpochMs = toEpochMsString(filters.dateFrom, false);
                const endEpochMs = toEpochMsString(filters.dateTo, true);

                for (const receiverId of queryReceiverIds) {
                    for (const messageWeek of weekList) {
                        let lastKey;
                        let pageGuard = 0;
                        do {
                            const response = await dbClient
                                .query({
                                    TableName: 'TheseusMessages',
                                    IndexName: 'delivery_receiver_week',
                                    KeyConditionExpression: 'deliver_to = :rtcv AND messageWeek = :mw AND created_time BETWEEN :start AND :end',
                                    ExpressionAttributeValues: {
                                        ':rtcv': receiverId,
                                        ':mw': Number(messageWeek),
                                        ':start': startEpochMs,
                                        ':end': endEpochMs,
                                        ':rt': 'delivery'
                                    },
                                    FilterExpression: 'record_type = :rt',
                                    ExclusiveStartKey: lastKey,
                                    ScanIndexForward: false,
                                    Limit: 250
                                })
                                .promise();
                            if (Array.isArray(response?.Items) && response.Items.length > 0) {
                                scanResults.push(...response.Items);
                            }
                            lastKey = response?.LastEvaluatedKey;
                            pageGuard++;
                        } while (lastKey && pageGuard < 20);
                    }
                }
            }
            else {
                let lastKey;
                let pageCount = 0;
                do {
                    const response = await dbClient
                        .scan({
                            TableName: 'TheseusMessages',
                            ExclusiveStartKey: lastKey,
                            Limit: 250
                        })
                        .promise();
                    if (Array.isArray(response?.Items) && response.Items.length > 0) {
                        scanResults.push(...response.Items);
                    }
                    lastKey = response?.LastEvaluatedKey;
                    pageCount++;
                } while (lastKey && pageCount < 8);
            }

            const dedupeMap = {};
            for (const record of scanResults) {
                const dedupeKey = `${record.thread_id || ''}::${record.composite_key || record.created_time || Math.random()}`;
                dedupeMap[dedupeKey] = record;
            }
            scanResults = Object.values(dedupeMap);

            const logFilteredOut = (reason, message, details = {}) => {
                console.log('[MessageMonitorV3] Filtered out message', {
                    reason,
                    thread_id: message?.thread_id,
                    composite_key: message?.composite_key,
                    sent_from: message?.sent_from,
                    deliver_to: message?.deliver_to,
                    created_time: message?.created_time,
                    ...details
                });
            };

            const filtered = scanResults.filter(message => {
                const resultFlags = {
                    ...getResultFlags(message),
                    ...getRecipientFlags(message)
                };
                const sender = message.sent_from;
                if (!senderHasAnyone) {
                    if (senderIdMatch.length > 0) {
                        const senderIdFilters = new Set(
                            senderIdMatch.flatMap(id => (id === '*me' ? myIdentityList : (id === '*anyone' ? [] : [id])))
                        );
                        if (senderHasMe) {
                            myIdentityList.forEach(id => senderIdFilters.add(id));
                        }
                        if (!senderIdFilters.has(sender)) {
                            logFilteredOut('senderIdMatch_miss', message, {
                                sender,
                                senderIdMatch,
                                senderIdFilters: Array.from(senderIdFilters)
                            });
                            return false;
                        }
                    }
                    else if (senderMatch) {
                        if (senderMatch === '*me') {
                            if ((myIdentityList.length > 0) && !myIdentityList.some(myId => (sender === myId) || sender.includes(myId))) {
                                logFilteredOut('senderMatch_me_miss', message, {
                                    sender,
                                    myIdentityList
                                });
                                return false;
                            }
                        }
                        else if (!sender.includes(senderMatch)) {
                            logFilteredOut('senderMatch_text_miss', message, {
                                sender,
                                senderMatch
                            });
                            return false;
                        }
                    }
                }

                const receivers = normalizeReceivers(message).map(r => r.toLowerCase());
                if (!receiverHasAnyone) {
                    if (receiverIdMatch.length > 0) {
                        const receiverIdFilters = new Set(
                            receiverIdMatch.flatMap(id => (id === '*me' ? myIdentityList : (id === '*anyone' ? [] : [id])))
                        );
                        if (receiverHasMe) {
                            myIdentityList.forEach(id => receiverIdFilters.add(id));
                        }
                        if (!receivers.some(r => receiverIdFilters.has(r))) {
                            logFilteredOut('receiverIdMatch_miss', message, {
                                receivers,
                                receiverIdMatch,
                                receiverIdFilters: Array.from(receiverIdFilters)
                            });
                            return false;
                        }
                    }
                    else if (receiverMatch) {
                        if ((receiverMatch === '*me') && !receivers.some(r => myIdentityList.includes(r))) {
                            logFilteredOut('receiverMatch_me_miss', message, {
                                receivers,
                                myIdentityList
                            });
                            return false;
                        }
                        if ((receiverMatch !== '*me') && !receivers.some(r => r.includes(receiverMatch))) {
                            logFilteredOut('receiverMatch_text_miss', message, {
                                receivers,
                                receiverMatch
                            });
                            return false;
                        }
                    }
                }

                const status = normalizeStatus(message);
                if (filters.status === 'machine_answered') {
                    if (!resultFlags.machine_answered) {
                        logFilteredOut('machine_answered_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'person_answered') {
                    if (!resultFlags.person_answered) {
                        logFilteredOut('person_answered_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'accepted_by_carrier') {
                    if (!resultFlags.accepted_by_carrier) {
                        logFilteredOut('accepted_by_carrier_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'email_opened') {
                    if (!resultFlags.email_opened) {
                        logFilteredOut('email_opened_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'call_not_answered') {
                    if (!resultFlags.call_not_answered) {
                        logFilteredOut('call_not_answered_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'ava_only') {
                    if (!resultFlags.ava_only) {
                        logFilteredOut('ava_only_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'was_responded_to') {
                    if (!resultFlags.was_responded_to) {
                        logFilteredOut('was_responded_to_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if (filters.status === 'has_attachment') {
                    if (!resultFlags.has_attachment) {
                        logFilteredOut('has_attachment_miss', message, {
                            resultFlags
                        });
                        return false;
                    }
                }
                else if ((filters.status !== '*all') && (status !== filters.status.toLowerCase())) {
                    logFilteredOut('status_miss', message, {
                        status,
                        expectedStatus: filters.status
                    });
                    return false;
                }

                const dateValue = normalizeDateValue(message);
                if (fromDate || toDate) {
                    if (!dateValue) {
                        logFilteredOut('date_missing', message, {
                            fromDate,
                            toDate
                        });
                        return false;
                    }
                    let compareDate;
                    const asNumber = Number(dateValue);
                    if (!Number.isNaN(asNumber) && `${asNumber}`.length >= 8) {
                        compareDate = makeDate(asNumber).date;
                    }
                    else {
                        compareDate = new Date(dateValue);
                    }
                    if (Number.isNaN(compareDate?.getTime?.())) {
                        logFilteredOut('date_invalid', message, {
                            dateValue
                        });
                        return false;
                    }
                    if (fromDate && compareDate < fromDate) {
                        logFilteredOut('date_before_from', message, {
                            compareDate,
                            fromDate
                        });
                        return false;
                    }
                    if (toDate && compareDate > toDate) {
                        logFilteredOut('date_after_to', message, {
                            compareDate,
                            toDate
                        });
                        return false;
                    }
                }

                return true;
            });

            const withDerivedFlags = filtered.map((message) => ({
                ...message,
                derived_flags: {
                    ...getResultFlags(message),
                    ...getRecipientFlags(message)
                }
            }));

            withDerivedFlags.sort((a, b) => {
                const aValue = normalizeDateValue(a);
                const bValue = normalizeDateValue(b);
                const aTime = new Date(aValue || 0).getTime();
                const bTime = new Date(bValue || 0).getTime();
                return bTime - aTime;
            });

            setMessages(withDerivedFlags);
        }
        catch (error) {
            setErrorText(`Unable to load messages: ${error?.message || error}`);
            setMessages([]);
        }
        setLoading(false);
    };

    return (
        <Dialog
            open={true}
            onClose={onClose}
            fullScreen
            TransitionComponent={Transition}
        >
            <DialogContent className={classes.dialogBox}>
                <Box className={classes.wrapper}>
                    <Box className={classes.topBar}>
                        <Typography
                            className={classes.title}
                            style={AVATextStyle({ size: 1.3, bold: true, margin: { bottom: 1, top: 0, left: 0, right: 1 } })}
                            id='scroll-dialog-title'
                        >
                            {'Message Monitor'}
                        </Typography>
                        <Typography variant='body2' className={classes.muted}>Filter by Sender, Receiver, Date Range, and Status.</Typography>

                        <Box className={classes.filters}>
                            <TextField
                                label='Sender'
                                variant='outlined'
                                size='small'
                                value={filters.senderDisplay}
                                onChange={event => {
                                    updateFilter('senderDisplay', event.target.value);
                                    updateFilter('senderIds', []);
                                }}
                                onClick={openSenderPicker}
                                InputProps={{ readOnly: true }}
                            />

                            <TextField
                                label='Receiver'
                                variant='outlined'
                                size='small'
                                value={filters.receiverDisplay}
                                onChange={event => {
                                    updateFilter('receiverDisplay', event.target.value);
                                    updateFilter('receiverIds', []);
                                }}
                                onClick={openReceiverPicker}
                                InputProps={{ readOnly: true }}
                            />

                            <TextField
                                label='From'
                                type='date'
                                variant='outlined'
                                size='small'
                                value={filters.dateFrom}
                                onChange={event => updateFilter('dateFrom', event.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label='To'
                                type='date'
                                variant='outlined'
                                size='small'
                                value={filters.dateTo}
                                onChange={event => updateFilter('dateTo', event.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />

                            <TextField
                                label='Status'
                                variant='outlined'
                                size='small'
                                select
                                value={filters.status}
                                onChange={event => updateFilter('status', event.target.value)}
                            >
                                {statusOptions.map(statusValue => (
                                    <MenuItem key={statusValue} value={statusValue}>{statusValue}</MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    </Box>

                    <Box className={classes.scrollArea}>
                        {errorText && (
                            <Box mb={1}>
                                <Alert severity='error'>{errorText}</Alert>
                            </Box>
                        )}

                        <Paper variant='outlined' className={classes.listPaper}>
                            {loading && (
                                <Box p={2} display='flex' alignItems='center' gridGap={8}>
                                    <CircularProgress size={18} />
                                    <Typography variant='body2'>Loading messages…</Typography>
                                </Box>
                            )}

                            {!loading && messages.length === 0 && (
                                <Box p={2}>
                                    <Typography variant='body2' className={classes.muted}>No messages match these filters.</Typography>
                                </Box>
                            )}

                            {!loading && messages.length > 0 && (
                                <List dense>
                                    {messages.map((message, index) => {
                                        const sender = message.sent_from || 'Unknown sender';
                                        const receivers = normalizeReceivers(message);
                                        const senderText = personNameFromAccessList(sender);
                                        const receiverText = receivers.length
                                            ? receivers.map(receiverId => personNameFromAccessList(receiverId)).join(', ')
                                            : 'Unknown receiver';
                                        const status = normalizeStatus(message);
                                        const dateText = formatMessageDate(normalizeDateValue(message));
                                        const subjectText = getMessageSubject(message);
                                        const derivedFlags = message.derived_flags || {};
                                        const flagLabels = getEnabledFlagLabels(derivedFlags);
                                        const primary = `${subjectText}`;
                                        const secondary = `${dateText} • ${senderText} → ${receiverText} • ${status}`;
                                        const itemKey = message.composite_key || message.thread_id || `${subjectText}-${index}`;

                                        return (
                                            <React.Fragment key={itemKey}>
                                                <ListItem
                                                    button
                                                    onClick={() => {
                                                        setSelectedMessage(message);
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={primary}
                                                        secondary={(
                                                            <Box>
                                                                <Typography variant='body2' color='textSecondary'>
                                                                    {secondary}
                                                                </Typography>
                                                                {flagLabels.length > 0 && (
                                                                    <Box className={classes.flagRow}>
                                                                        {flagLabels.map((flagLabel) => (
                                                                            <Button
                                                                                key={`${itemKey}_${flagLabel}`}
                                                                                size='small'
                                                                                variant='outlined'
                                                                                disabled
                                                                                className={classes.flagPill}
                                                                            >
                                                                                {flagLabel}
                                                                            </Button>
                                                                        ))}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        )}
                                                    />
                                                </ListItem>
                                                {index < (messages.length - 1) && <Divider component='li' />}
                                            </React.Fragment>
                                        );
                                    })}
                                </List>
                            )}
                        </Paper>
                    </Box>

                    <Box className={classes.bottomBar}>
                        <Box className={classes.actions}>
                            <Button
                                className={AVAClass.AVAButton}
                                style={{ backgroundColor: 'red', color: 'white' }}
                                size='small'
                                startIcon={<CloseIcon fontSize="small" />}
                                onClick={onClose}
                            >
                                {'Close'}
                            </Button>
                            <Button className={AVAClass.AVAButton} color='primary' variant='contained' onClick={runSearch} disabled={loading}>
                                {loading ? 'Searching…' : 'Search'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>

            {showSenderQuickSearch && (
                <QuickSearch
                    reactData={senderQuickSearchData}
                    updateReactData={updateSenderQuickSearchData}
                    options={{
                        pickAndGo: true,
                        keepSelections: true,
                        withGroups: true,
                        withPreferred: false,
                        hidePeople: false,
                        withSpecialValues: true,
                        title: 'Select Sender',
                        showAll: true,
                        restrictGroups: false,
                        buttonText: 'Apply Sender'
                    }}
                    onClose={(selections) => {
                        const finalSelections = selections || [];
                        setShowSenderQuickSearch(false);
                        setSenderQuickSearchData(prev => ({ ...prev, selections: finalSelections }));
                        applyQuickSearchSelections('sender', finalSelections);
                    }}
                />
            )}

            {showReceiverQuickSearch && (
                <QuickSearch
                    reactData={receiverQuickSearchData}
                    updateReactData={updateReceiverQuickSearchData}
                    options={{
                        pickAndGo: true,
                        keepSelections: true,
                        withGroups: true,
                        withPreferred: false,
                        hidePeople: false,
                        withSpecialValues: true,
                        title: 'Select Receiver',
                        showAll: true,
                        restrictGroups: false,
                        buttonText: 'Apply Receiver'
                    }}
                    onClose={(selections) => {
                        const finalSelections = selections || [];
                        setShowReceiverQuickSearch(false);
                        setReceiverQuickSearchData(prev => ({ ...prev, selections: finalSelections }));
                        applyQuickSearchSelections('receiver', finalSelections);
                    }}
                />
            )}

            {selectedMessage && (
                <Dialog
                    open={!!selectedMessage}
                    onClose={() => {
                        setSelectedMessage(null);
                    }}
                    maxWidth='md'
                    fullWidth
                >
                    <DialogContent>
                        <Box display='flex' flexDirection='column' gridGap={10}>
                            <Typography style={AVATextStyle({ size: 1.2, bold: true })}>
                                {getMessageSubject(selectedMessage)}
                            </Typography>
                            <Typography variant='body2' color='textSecondary'>
                                {`${formatMessageDate(normalizeDateValue(selectedMessage))} • ${personNameFromAccessList(selectedMessage.sent_from || 'Unknown sender')} → ${(normalizeReceivers(selectedMessage).length ? normalizeReceivers(selectedMessage).map(receiverId => personNameFromAccessList(receiverId)).join(', ') : 'Unknown receiver')}`}
                            </Typography>
                            <TextField
                                label='Message'
                                value={getMessageText(selectedMessage)}
                                variant='outlined'
                                multiline
                                minRows={8}
                                InputProps={{ readOnly: true }}
                            />
                            <Box display='flex' justifyContent='flex-end'>
                                <Button
                                    className={AVAClass.AVAButton}
                                    style={{ backgroundColor: 'red', color: 'white' }}
                                    size='small'
                                    onClick={() => {
                                        setSelectedMessage(null);
                                    }}
                                >
                                    {'Close'}
                                </Button>
                            </Box>
                        </Box>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
