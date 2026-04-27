import React from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    Paper,
    Typography,
    TextField,
    Button,
    List,
    ListItem,
    ListItemText,
    Divider,
    CircularProgress,
    IconButton
} from '@material-ui/core';
import { Alert } from '@material-ui/lab/';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Slide from '@material-ui/core/Slide';
import { alpha } from '@material-ui/core/styles/colorManipulator';

import CloseIcon from '@material-ui/icons/ExitToApp';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import ForwardIcon from '@material-ui/icons/Forward';

import useSession from '../../hooks/useSession';
import { dbClient, sentenceCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { parseDateInputAsLocalDate, getWeekNumberFromMessageTime, buildMessageWeekList } from '../../util/AVAMessages';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { makeName } from '../../util/AVAPeople';
import QuickSearch from '../sections/QuickSearch';
import MessageForm from './MessageForm';
import AVAConfirm from './AVAConfirm';



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
    scopePresetRow: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        marginTop: theme.spacing(0.5)
    },
    scopePresetActions: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing(1)
    },
    statusPillRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(1),
        alignItems: 'flex-end',
        marginBottom: theme.spacing(1),
        marginTop: theme.spacing(1.5)
    },
    statusPillItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 74
    },
    statusPillCount: {
        fontSize: '0.7rem',
        lineHeight: 1,
        marginBottom: theme.spacing(0.4),
        opacity: 0.75
    },
    statusPillButton: {
        minWidth: 'auto',
        textTransform: 'none',
        borderRadius: 999,
        padding: theme.spacing(0.25, 1)
    },
    statusPillActive: {
        outline: `6px solid ${alpha(theme.palette.primary.main, 0.55)}`,
        outlineOffset: 1,
        boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0.2)}`,
        transform: 'translateY(-1px)'
    },
    scrollArea: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: theme.spacing(2)
    },
    listScrollArea: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden'
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.spacing(1),
    },
    pendingSearchHint: {
        fontSize: '0.78rem',
        fontWeight: 600,
        color: theme.palette.warning.main,
        marginRight: theme.spacing(1)
    },
    searchButtonPending: {
        animation: '$searchButtonPulse 1400ms ease-in-out infinite',
        boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0.45)}`,
        borderColor: `${theme.palette.warning.main} !important`
    },
    '@keyframes searchButtonPulse': {
        '0%': {
            boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0.45)}`
        },
        '70%': {
            boxShadow: `0 0 0 10px ${alpha(theme.palette.warning.main, 0)}`
        },
        '100%': {
            boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0)}`
        }
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
        width: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
    },
    muted: {
        opacity: 0.7
    },
    messagePreview: {
        marginBottom: theme.spacing(0.6),
        opacity: 0.88,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
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
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'none',
        borderRadius: 999,
        opacity: 1,
        cursor: 'default'
    },
    flagPillRedOutline: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.error.light : theme.palette.error.main} !important`,
        color: `${theme.palette.type === 'dark' ? theme.palette.error.light : theme.palette.error.main} !important`,
        backgroundColor: `${alpha(theme.palette.error.main, theme.palette.type === 'dark' ? 0.22 : 0.08)} !important`
    },
    flagPillOrangeOutline: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.warning.light : theme.palette.warning.dark} !important`,
        color: `${theme.palette.type === 'dark' ? theme.palette.warning.light : theme.palette.warning.dark} !important`,
        backgroundColor: `${alpha(theme.palette.warning.main, theme.palette.type === 'dark' ? 0.2 : 0.08)} !important`
    },
    flagPillGreenSolid: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.success.main : theme.palette.success.dark} !important`,
        backgroundColor: `${theme.palette.type === 'dark' ? theme.palette.success.main : theme.palette.success.dark} !important`,
        color: `${theme.palette.common.white} !important`
    },
    flagPillRedSolid: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.error.main : theme.palette.error.dark} !important`,
        backgroundColor: `${theme.palette.type === 'dark' ? theme.palette.error.main : theme.palette.error.dark} !important`,
        color: `${theme.palette.common.white} !important`
    },
    recipientScrollArea: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: theme.spacing(1)
    },
    recipientRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.6),
        paddingTop: theme.spacing(0.5),
        paddingBottom: theme.spacing(0.7)
    },
    recipientHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: theme.spacing(1)
    },
    recipientName: {
        fontWeight: 500,
        flex: '1 1 auto',
        minWidth: 0
    },
    recipientResultText: {
        opacity: 0.85,
        fontSize: '0.82rem',
        maxWidth: '70%',
        textAlign: 'right'
    },
    recipientResultLine: {
        lineHeight: 1.3,
        marginBottom: theme.spacing(0.25)
    },
    recipientReplyLine: {
        lineHeight: 1.25,
        marginBottom: theme.spacing(0.45),
        marginLeft: theme.spacing(0.9),
        fontSize: '0.76rem',
        opacity: 0.85,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
    },
    recipientFooterRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1)
    },
    recipientActionButtons: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.35),
        marginLeft: 'auto'
    },
    recipientActionButton: {
        padding: theme.spacing(0.45)
    },
    detailHoldActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(0.5),
        flexShrink: 0
    },
    detailDialogContent: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: theme.spacing(2),
        minHeight: 0,
        height: 'calc(100vh - 160px)',
        maxHeight: 760
    },
    detailDialogBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1.2),
        minHeight: 0,
        flex: 1,
        overflow: 'hidden'
    },
    detailDialogFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(0.5)
    },
    messageBox: {
        position: 'relative',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: theme.spacing(1.6, 1.2, 1.1, 1.2),
        marginTop: theme.spacing(0.5),
        backgroundColor: theme.palette.background.paper,
        minWidth: 0,
        flexShrink: 0
    },
    messageBoxLabel: {
        position: 'absolute',
        top: -9,
        left: 10,
        padding: theme.spacing(0, 0.6),
        backgroundColor: theme.palette.background.paper,
        fontSize: '0.75rem',
        color: theme.palette.text.secondary
    },
    messageBoxMeta: {
        fontSize: '0.76rem',
        opacity: 0.72,
        marginBottom: theme.spacing(0.8),
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap'
    },
    messageBoxBody: {
        fontSize: '0.9rem',
        lineHeight: 1.42,
        whiteSpace: 'pre-wrap',
        overflowY: 'auto',
        overflowX: 'hidden',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        minWidth: 0,
        maxWidth: '100%'
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

function getComplaintHistoryEntry(message) {
    const historyList = [message?.history].flat().filter(Boolean);
    return historyList.find((historyEntry) => {
        const historyStatus = String(
            historyEntry?.status
            || historyEntry?.delivery_status
            || historyEntry?.send_status
            || historyEntry?.result
            || ''
        ).trim().toLowerCase();
        return historyStatus === 'complaint';
    }) || null;
}

function normalizeMethod(message) {
    const methodValue = String(
        message?.deliver_method
        || message?.recipient_list?.method
        || ''
    ).trim().toLowerCase();

    if (!methodValue) {
        return '';
    }

    if (methodValue === 'email') {
        return 'e-Mail';
    }
    if (methodValue === 'sms') {
        return 'text';
    }
    if (methodValue === 'voice') {
        return 'phone call';
    }
    if (methodValue === 'hold') {
        return 'held';
    }
    return 'AVA';
}

function makeAddressKey(value) {
    return String(value || '').trim().toLowerCase();
}

function buildRecipientNameByAddressLookup(deliveryItems = [], resolvePersonName = (id) => id) {
    const addressRecipientMap = new Map();

    deliveryItems.forEach((deliveryItem) => {
        const receiverIds = normalizeReceivers(deliveryItem);

        const addressCandidates = [
            deliveryItem?.deliver_address,
            deliveryItem?.recipient_address,
            deliveryItem?.recipient_list?.address,
            deliveryItem?.recipient_list?.deliver_address,
            deliveryItem?.recipient_list?.recipient_address
        ];

        addressCandidates.forEach((addressValue) => {
            const key = makeAddressKey(addressValue);
            if (!key) {
                return;
            }

            if (!addressRecipientMap.has(key)) {
                addressRecipientMap.set(key, new Map());
            }

            const recipientsForAddress = addressRecipientMap.get(key);
            receiverIds.forEach((receiverId) => {
                const normalizedReceiverId = String(receiverId || '').trim();
                if (!normalizedReceiverId) {
                    return;
                }
                const resolvedName = String(resolvePersonName(normalizedReceiverId) || normalizedReceiverId || '').trim();
                if (resolvedName) {
                    recipientsForAddress.set(normalizedReceiverId, resolvedName);
                }
            });
        });
    });

    return (addressValue, options = {}) => {
        const key = makeAddressKey(addressValue);
        if (!key) {
            return '';
        }

        const recipientsForAddress = addressRecipientMap.get(key);
        if (!recipientsForAddress || (recipientsForAddress.size === 0)) {
            return '';
        }

        const excludedRecipientId = String(options?.excludeRecipientId || '').trim().toLowerCase();
        const excludedRecipientName = String(options?.excludeRecipientName || '').trim().toLowerCase();

        for (const [candidateId, candidateName] of recipientsForAddress.entries()) {
            const candidateIdNormalized = String(candidateId || '').trim().toLowerCase();
            const candidateNameNormalized = String(candidateName || '').trim().toLowerCase();
            if (excludedRecipientId && (candidateIdNormalized === excludedRecipientId)) {
                continue;
            }
            if (excludedRecipientName && (candidateNameNormalized === excludedRecipientName)) {
                continue;
            }
            return candidateName;
        }

        return '';
    };
}

function getReplyTextFromResultEntry(resultEntry) {
    if (!resultEntry || (typeof resultEntry !== 'object')) {
        return '';
    }

    const replyCandidate = [
        resultEntry.reply,
        resultEntry.response,
        resultEntry.reply_text,
        resultEntry.replyText
    ]
        .map((value) => String(value || '').trim())
        .find(Boolean);

    return replyCandidate || '';
}

function makeResultDisplay(message, options = {}) {
    const otherPersonByAddress = options.otherPersonByAddress || (() => '');
    const currentRecipientId = options.currentRecipientId || '';
    const currentRecipientName = options.currentRecipientName || '';
    const defaultStatus = sentenceCase(normalizeStatus(message) || 'unknown');
    const method = normalizeMethod(message);
    const heldRuleUsedText = [message?.recipient_list?.rule_used]
        .flat()
        .map((ruleValue) => String(ruleValue || '').trim())
        .filter(Boolean)
        .join(', ');
    const heldMethodText = method === 'held'
        ? `held${heldRuleUsedText ? ` (rule: ${heldRuleUsedText})` : ''}`
        : method;
    let methodMsg, resultText;
    if (method && method === 'AVA') {
        methodMsg = `via AVA`;
        resultText = `via AVA`;
    }
    else if (defaultStatus === 'Duplicate') {
        const otherAddress = message?.recipient_address || message?.deliver_address || message?.recipient_list?.address || '';
        const resolvedOtherPerson = otherPersonByAddress(otherAddress, {
            excludeRecipientId: currentRecipientId,
            excludeRecipientName: currentRecipientName
        }) || 'another recipient';
        const duplicateMethodText = method ? ` of ${method}` : '';
        return {
            text: `Not sent - Duplicate${duplicateMethodText} to ${resolvedOtherPerson}`,
            replyText: ''
        };
    }
    else if (method === 'held') {
        methodMsg = `held${heldRuleUsedText ? ` (rule: ${heldRuleUsedText})` : ''}`;
        resultText = `Held${heldRuleUsedText ? ` by rule ${heldRuleUsedText} ` : ''}`;
        resultText += makeDate(message.created_time).oaDate;
    }
    else if (normalizeStatus(message) === 'complaint') {
        const complaintHistoryEntry = getComplaintHistoryEntry(message);
        const complaintCarrier = String(complaintHistoryEntry?.details?.userAgent || '').trim();
        const complaintTimestamp = (
            complaintHistoryEntry?.posted_time
            || complaintHistoryEntry?.created_time
            || complaintHistoryEntry?.timestamp
            || message?.created_time
            || null
        );
        const complaintDateText = complaintTimestamp ? ` ${makeDate(complaintTimestamp).oaDate}` : '';
        const complaintCarrierText = complaintCarrier ? ` - carrier: ${complaintCarrier}` : '';
        return {
            text: `reported as Spam${complaintCarrierText}${complaintDateText}`,
            replyText: ''
        };
    }
    else {
        methodMsg = heldMethodText ? `via ${heldMethodText} - ` : '';
        resultText = `${methodMsg}${defaultStatus === 'Submitted' ? 'Sent' : defaultStatus}`;
    }
    let alreadyOpened = false;

    const resultsList = [message?.results].flat().filter(Boolean);
    for (const resultEntry of resultsList) {
        const resultValue = String(resultEntry?.result || resultEntry || '').toLowerCase();
        if (!resultValue) {
            continue;
        }

        const postedText = resultEntry?.posted_time ? ` ${makeDate(resultEntry.posted_time).oaDate}` : '';

        if (resultValue.startsWith('reply')) {
            return {
                text: `${methodMsg}Replied${postedText}`,
                replyText: getReplyTextFromResultEntry(resultEntry)
            };
        }
        if ((resultValue === 'response') || resultValue.includes('respond') || resultValue.includes('resopnd')) {
            return {
                text: `${methodMsg}Responded${postedText}`,
                replyText: getReplyTextFromResultEntry(resultEntry)
            };
        }
        if (alreadyOpened) {
            continue;
        }

        if (resultValue === 'open') {
            resultText = `${methodMsg}Opened${postedText}`;
            alreadyOpened = true;
            continue;
        }
        if (resultValue.startsWith('deliver')) {
            const carrier = String(resultEntry?.info?.phoneCarrier || '').trim();
            resultText = `${methodMsg}Delivery${carrier ? ` confirmed by ${carrier}` : ''}${postedText}`;
            continue;
        }
        if (resultValue.includes('no answer') || resultValue.includes('busy')) {
            resultText = `${methodMsg}No answer${postedText}`;
            continue;
        }
        if (resultValue.includes('answered')) {
            resultText = `${methodMsg}${sentenceCase(String(resultEntry?.result || resultValue))}${postedText}`;
            alreadyOpened = true;
        }
    }

    return {
        text: resultText,
        replyText: ''
    };
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
    const isDuplicate = normalizeStatus(message) === 'duplicate';
    const isSpam = normalizeStatus(message) === 'complaint';
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
        duplicate: isDuplicate,
        spam: isSpam,
        machine_answered: machineAnswered,
        person_answered: personAnswered,
        accepted_by_carrier: acceptedByCarrier,
        email_opened: emailOpened,
        call_not_answered: callNotAnswered,
        ava_only: avaOnly,
        was_responded_to: wasRespondedTo
    };
}

function getAttachmentUrlsFromMessage(message) {
    const normalizeUrlCandidate = (value) => {
        const textValue = String(value || '').trim();
        if (!textValue) {
            return '';
        }
        const lowered = textValue.toLowerCase();
        if (lowered.startsWith('http://') || lowered.startsWith('https://')) {
            return textValue;
        }
        return '';
    };

    const attachmentSources = [
        message?.content?.current?.attachments,
        message?.attachments
    ].flat();

    const urls = [];

    attachmentSources.forEach((attachmentSource) => {
        if (!attachmentSource) {
            return;
        }

        const attachmentItems = Array.isArray(attachmentSource) ? attachmentSource : [attachmentSource];
        attachmentItems.forEach((attachmentItem) => {
            if ((typeof attachmentItem === 'string') || (typeof attachmentItem === 'number')) {
                const normalized = normalizeUrlCandidate(attachmentItem);
                if (normalized) {
                    urls.push(normalized);
                }
                return;
            }

            if (attachmentItem && (typeof attachmentItem === 'object')) {
                const objectUrlCandidate = [
                    attachmentItem.Location,
                    attachmentItem.location,
                    attachmentItem.url,
                    attachmentItem.href,
                    attachmentItem.link,
                    attachmentItem.file_url,
                    attachmentItem.fileUrl,
                    attachmentItem.s3Location,
                    attachmentItem.s3_location,
                    attachmentItem.fLoc
                ]
                    .map(normalizeUrlCandidate)
                    .find(Boolean);

                if (objectUrlCandidate) {
                    urls.push(objectUrlCandidate);
                }
            }
        });
    });

    return Array.from(new Set(urls));
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
    const messageWasHeld = methodValue === 'hold';
    const rawHoldReasonValue = String(recipientList.hold_reason || '').trim().toLowerCase();
    const normalizedHoldReasonValue = (() => {
        if (!messageWasHeld) {
            return rawHoldReasonValue;
        }
        if (['hold', 'blocked', 'replaced'].includes(rawHoldReasonValue)) {
            return rawHoldReasonValue;
        }
        return 'hold';
    })();

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
        held_for_hold_reason: messageWasHeld && (normalizedHoldReasonValue === 'hold'),
        held_for_blocked_reason: messageWasHeld && (normalizedHoldReasonValue === 'blocked'),
        held_for_replaced_reason: messageWasHeld && (normalizedHoldReasonValue === 'replaced'),
        rule_used_values: Array.from(new Set(ruleUsedValues)),
        rule_used_value: ruleUsedValues[0] || null,
        has_attachment: hasAttachment
    };
}

function getEnabledFlagLabels(derivedFlags = {}) {
    const flagMap = [
        ['duplicate', 'Duplicate'],
        ['spam', 'Spam'],
        ['auto_cc', 'Auto CC'],
        ['machine_answered', 'Machine'],
        ['person_answered', 'Person'],
        ['accepted_by_carrier', 'Carrier OK'],
        ['email_opened', 'Opened'],
        ['call_not_answered', 'No Answer'],
        ['ava_only', 'AVA Only'],
        ['was_responded_to', 'Responded'],
        ['has_attachment', 'Attachment'],
        ['held_for_blocked_reason', 'Blocked'],
        ['held_for_replaced_reason', 'Replaced'],
        ['held_for_hold_reason', 'Hold']
    ];

    return flagMap
        .filter(([flagKey]) => !!derivedFlags[flagKey])
        .map(([, label]) => label);
}

function getStatusPillLabel(statusKey) {
    if (statusKey === '*all') { return 'All'; }
    const statusToLabelMap = {
        duplicate: 'Duplicate',
        machine_answered: 'Machine',
        person_answered: 'Person',
        auto_cc: 'Auto CC',
        accepted_by_carrier: 'Carrier OK',
        email_opened: 'Opened',
        call_not_answered: 'No Answer',
        ava_only: 'AVA Only',
        was_responded_to: 'Responded',
        has_attachment: 'Attachment',
        spam: 'Spam'
    };
    return statusToLabelMap[statusKey] || sentenceCase(statusKey.replace(/_/g, ' '));
}

const STATUS_FILTER_OPTIONS = [
    '*all',
    'duplicate',
    'spam',
    'auto_cc',
    'machine_answered',
    'person_answered',
    'accepted_by_carrier',
    'email_opened',
    'call_not_answered',
    'ava_only',
    'was_responded_to',
    'has_attachment'
];

function normalizeStatusFilterValue(statusValue) {
    const normalized = String(statusValue || '*all').trim().toLowerCase();
    return STATUS_FILTER_OPTIONS.includes(normalized) ? normalized : '*all';
}

function messageMatchesStatusKey(message, statusKey) {
    const normalizedStatusKey = normalizeStatusFilterValue(statusKey);
    if (normalizedStatusKey === '*all') {
        return true;
    }
    const resultFlags = {
        ...getResultFlags(message),
        ...getRecipientFlags(message),
        ...(message?.derived_flags || {})
    };
    if (normalizedStatusKey === 'duplicate') { return !!resultFlags.duplicate; }
    if (normalizedStatusKey === 'spam') { return !!resultFlags.spam; }
    if (normalizedStatusKey === 'auto_cc') { return !!resultFlags.auto_cc; }
    if (normalizedStatusKey === 'machine_answered') { return !!resultFlags.machine_answered; }
    if (normalizedStatusKey === 'person_answered') { return !!resultFlags.person_answered; }
    if (normalizedStatusKey === 'accepted_by_carrier') { return !!resultFlags.accepted_by_carrier; }
    if (normalizedStatusKey === 'email_opened') { return !!resultFlags.email_opened; }
    if (normalizedStatusKey === 'call_not_answered') { return !!resultFlags.call_not_answered; }
    if (normalizedStatusKey === 'ava_only') { return !!resultFlags.ava_only; }
    if (normalizedStatusKey === 'was_responded_to') { return !!resultFlags.was_responded_to; }
    if (normalizedStatusKey === 'has_attachment') { return !!resultFlags.has_attachment; }
    return normalizeStatus(message) === normalizedStatusKey;
}

function getFlagPillVariantClass(label, classes) {
    const redOutlineLabels = ['Hold', 'Replaced', 'Duplicate', 'Attachment', 'No Answer'];
    const greenSolidLabels = ['Person', 'Responded', 'Opened'];
    const orangeOutlineLabels = ['Carrier OK', 'Machine', 'AVA Only', 'Auto CC'];

    if ((label === 'Blocked') || (label === 'Spam')) {
        return classes.flagPillRedSolid;
    }
    if (redOutlineLabels.includes(label)) {
        return classes.flagPillRedOutline;
    }
    if (greenSolidLabels.includes(label)) {
        return classes.flagPillGreenSolid;
    }
    if (orangeOutlineLabels.includes(label)) {
        return classes.flagPillOrangeOutline;
    }
    return '';
}

function getMessageSubject(message) {
    return message?.subject_line || message?.subject || message?.title || 'No subject';
}

function getRawMessageText(message) {
    const contentCurrent = message?.content?.current || {};
    if (contentCurrent?.en?.text != null) {
        return String(contentCurrent.en.text);
    }
    if (contentCurrent?.original?.text != null) {
        return String(contentCurrent.original.text);
    }
    return '';
}

function stripSignatureBlock(messageText, options = {}) {
    const rawText = String(messageText || '');
    if (!rawText.trim()) {
        return '';
    }

    const signatureKey = String(options?.signatureKey || '').trim();
    if (signatureKey) {
        const sourceLower = rawText.toLowerCase();
        const signatureLower = signatureKey.toLowerCase();
        const signatureIndex = sourceLower.indexOf(signatureLower);
        if (signatureIndex >= 0) {
            return rawText.slice(0, signatureIndex).trim();
        }
    }

    const lines = rawText.replace(/\r\n/g, '\n').split('\n');
    const signoffPattern = /^(thanks|thank you|thx|regards|best|best regards|kind regards|warm regards|sincerely|respectfully|cheers|many thanks|all the best)[\s!,.:-]*$/i;
    const mobileFooterPattern = /^sent from my\s+/i;
    const signatureDividerPattern = /^[-_]{2,}\s*$/;
    const quotedHeaderStartPattern = /^(from|sent|subject|to):\s+/i;
    const contactLinePattern = /\b(cell|office|fax|email|website|phone|mobile|tel|direct)\b\s*[:|]/i;
    const socialOrWebPattern = /\b(www\.|facebook|linkedin|instagram|twitter|tiktok)\b/i;
    const emailAddressPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const phonePattern = /\+?\d[\d\s().-]{7,}\d/;
    const titlePattern = /\b(realtor|manager|director|coordinator|broker|agent|sales|development)\b/i;

    const isSignatureCueLine = (lineValue) => {
        const line = String(lineValue || '').trim();
        if (!line) {
            return false;
        }

        return (
            signoffPattern.test(line)
            || mobileFooterPattern.test(line)
            || signatureDividerPattern.test(line)
            || contactLinePattern.test(line)
            || socialOrWebPattern.test(line)
            || emailAddressPattern.test(line)
            || phonePattern.test(line)
            || titlePattern.test(line)
        );
    };

    let cutIndex = -1;

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const trimmedLine = String(lines[lineIndex] || '').trim();
        if (!trimmedLine) {
            continue;
        }

        const remainingLineCount = lines.length - lineIndex;
        const isNearBottom = remainingLineCount <= 8;
        const isLikelySignoff = signoffPattern.test(trimmedLine) && (trimmedLine.length <= 30);
        const isMobileFooter = mobileFooterPattern.test(trimmedLine);
        const isSignatureDivider = signatureDividerPattern.test(trimmedLine);
        const isQuotedHeader = quotedHeaderStartPattern.test(trimmedLine);

        if (isQuotedHeader || isSignatureDivider) {
            cutIndex = lineIndex;
            break;
        }

        if (isNearBottom) {
            const lookAheadWindow = lines.slice(lineIndex, lineIndex + 6);
            const cueCount = lookAheadWindow.filter(isSignatureCueLine).length;
            const hasHardContactCue = lookAheadWindow.some((lineValue) => {
                const line = String(lineValue || '').trim();
                return contactLinePattern.test(line) || emailAddressPattern.test(line) || phonePattern.test(line);
            });

            if ((cueCount >= 3) && hasHardContactCue) {
                cutIndex = lineIndex;
                break;
            }
        }

        if ((isNearBottom && isLikelySignoff) || isMobileFooter || (isNearBottom && isSignatureDivider)) {
            cutIndex = lineIndex;
            break;
        }
    }

    const keptLines = (cutIndex >= 0 ? lines.slice(0, cutIndex) : lines).slice();
    while ((keptLines.length > 0) && !String(keptLines[keptLines.length - 1] || '').trim()) {
        keptLines.pop();
    }

    return keptLines.join('\n').trim();
}

function getMessageText(message, options = {}) {
    return stripSignatureBlock(getRawMessageText(message), options);
}

function toSingleLinePreview(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
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

// buildMessageWeekList is now imported from AVAMessages.js

function getMessageIdentityKey(message) {
    const compositeKey = String(message?.composite_key || '').trim();
    if (compositeKey) {
        const keyParts = compositeKey.split('~');
        if (keyParts.length >= 2) {
            return `${keyParts[0]}~${keyParts[1]}`;
        }
    }

    const threadPart = message?.thread_id ? `T:${message.thread_id}` : 'T:unknown';
    const messagePart = message?.message_id || message?.id || message?.created_time || 'unknown';
    return `${threadPart}~M:${messagePart}`;
}

function getCompositeKeyIdentity(compositeKeyValue) {
    const compositeKey = String(compositeKeyValue || '').trim();
    if (!compositeKey) {
        return '';
    }
    const keyParts = compositeKey.split('~');
    if (keyParts.length >= 2) {
        return `${keyParts[0]}~${keyParts[1]}`;
    }
    return compositeKey;
}

function getCompositeMessageSegment(compositeKeyValue) {
    const compositeKey = String(compositeKeyValue || '').trim();
    if (!compositeKey) {
        return '';
    }
    const messageSegment = compositeKey
        .split('~')
        .find((segment) => String(segment || '').trim().toUpperCase().startsWith('M:'));
    return String(messageSegment || '').trim();
}

function replaceCompositeMessageSegment(compositeKeyValue, nextMessageSegmentValue) {
    const compositeKey = String(compositeKeyValue || '').trim();
    const nextMessageSegment = String(nextMessageSegmentValue || '').trim();
    if (!compositeKey || !nextMessageSegment) {
        return compositeKey;
    }

    const segments = compositeKey.split('~');
    const messageSegmentIndex = segments.findIndex((segment) => String(segment || '').trim().toUpperCase().startsWith('M:'));
    if (messageSegmentIndex < 0) {
        return compositeKey;
    }

    const nextSegments = segments.slice();
    nextSegments[messageSegmentIndex] = nextMessageSegment;
    return nextSegments.join('~');
}

function getMessageSequenceFromCompositeKey(compositeKeyValue) {
    const compositeKey = String(compositeKeyValue || '').trim();
    if (!compositeKey) {
        return null;
    }

    const messagePart = compositeKey
        .split('~')
        .find((part) => String(part || '').trim().toUpperCase().startsWith('M:'));

    if (!messagePart) {
        return null;
    }

    const numericPart = String(messagePart).split(':').slice(1).join(':').trim();
    const sequenceValue = Number(numericPart);
    return Number.isFinite(sequenceValue) ? sequenceValue : null;
}

function isReplyMessageFromDeliveries(deliveryItems = []) {
    return deliveryItems.some((deliveryItem) => {
        const sequenceValue = getMessageSequenceFromCompositeKey(deliveryItem?.composite_key);
        return (sequenceValue !== null) && (sequenceValue > 1);
    });
}

function getUniqueReceiversFromDeliveries(deliveryItems = []) {
    const receiverSet = new Set();
    for (const delivery of deliveryItems) {
        normalizeReceivers(delivery).forEach((receiverId) => {
            const normalized = String(receiverId || '').trim();
            if (normalized) {
                receiverSet.add(normalized);
            }
        });
    }
    return Array.from(receiverSet);
}

function summarizeReceivers(receiverIds, getDisplayName, maxNames = 2) {
    const names = receiverIds
        .map((receiverId) => getDisplayName(receiverId))
        .filter(Boolean);

    if (names.length === 0) {
        return 'Unknown receiver';
    }
    if (names.length <= maxNames) {
        return names.join(', ');
    }
    const shownNames = names.slice(0, maxNames).join(', ');
    return `${shownNames} +${names.length - maxNames} more`;
}

function mergeDerivedFlags(baseFlags = {}, incomingFlags = {}) {
    const merged = { ...baseFlags };
    Object.keys(incomingFlags).forEach((flagKey) => {
        const incomingValue = incomingFlags[flagKey];
        if (Array.isArray(incomingValue)) {
            const existing = Array.isArray(merged[flagKey]) ? merged[flagKey] : [];
            merged[flagKey] = Array.from(new Set([...existing, ...incomingValue]));
        }
        else if (typeof incomingValue === 'boolean') {
            merged[flagKey] = !!merged[flagKey] || incomingValue;
        }
        else if ((incomingValue !== null) && (incomingValue !== undefined) && (incomingValue !== '')) {
            merged[flagKey] = merged[flagKey] || incomingValue;
        }
        else if (!(flagKey in merged)) {
            merged[flagKey] = incomingValue;
        }
    });
    return merged;
}

function isDeliveryStillHeld(deliveryItem) {
    const statusValue = String(normalizeStatus(deliveryItem) || '').trim().toLowerCase();
    const methodValue = String(deliveryItem?.recipient_list?.method || '').trim().toLowerCase();
    return (statusValue === 'held') || (methodValue === 'hold');
}

function dedupeReplyTextForDisplay(resultEntries = []) {
    if (!Array.isArray(resultEntries) || (resultEntries.length <= 1)) {
        return resultEntries;
    }

    const chosenReplyText = resultEntries
        .map((entry) => String(entry?.replyText || '').trim())
        .find(Boolean);

    if (!chosenReplyText) {
        return resultEntries;
    }

    const lastIndex = resultEntries.length - 1;
    return resultEntries.map((entry, index) => ({
        ...entry,
        replyText: index === lastIndex ? chosenReplyText : ''
    }));
}

function trimViaAvaOnlyResultEntries(resultEntries = []) {
    if (!Array.isArray(resultEntries) || (resultEntries.length <= 1)) {
        return resultEntries;
    }

    const isViaAvaEntry = (entry) => {
        const textValue = String(entry?.text || '').trim().toLowerCase();
        return textValue === 'via ava';
    };

    const hasNonViaAvaEntry = resultEntries.some((entry) => !isViaAvaEntry(entry));
    if (!hasNonViaAvaEntry) {
        return resultEntries;
    }

    return resultEntries.filter((entry) => !isViaAvaEntry(entry));
}

function buildRecipientSummaries(deliveryItems = [], resolvePersonName = (id) => id) {
    const recipientMap = new Map();
    const otherPersonByAddress = buildRecipientNameByAddressLookup(deliveryItems, resolvePersonName);

    deliveryItems.forEach((deliveryItem) => {
        const receivers = normalizeReceivers(deliveryItem);
        const deliveryTime = (() => {
            const dateValue = normalizeDateValue(deliveryItem);
            const asNumber = Number(dateValue);
            if (!Number.isNaN(asNumber)) {
                return asNumber;
            }
            const asDate = new Date(dateValue || 0).getTime();
            return Number.isNaN(asDate) ? 0 : asDate;
        })();
        const deliveryFlags = deliveryItem?.derived_flags || {
            ...getResultFlags(deliveryItem),
            ...getRecipientFlags(deliveryItem)
        };
        const deliveryFlagLabels = getEnabledFlagLabels(deliveryFlags);

        if (receivers.length === 0) {
            receivers.push('Unknown receiver');
        }

        receivers.forEach((receiverId) => {
            const normalizedReceiverId = String(receiverId || '').trim() || 'Unknown receiver';
            if (!recipientMap.has(normalizedReceiverId)) {
                recipientMap.set(normalizedReceiverId, {
                    recipientId: normalizedReceiverId,
                    recipientName: resolvePersonName(normalizedReceiverId) || normalizedReceiverId,
                    flagSet: new Set(),
                    deliveryCount: 0,
                    avaOnlyDeliveryCount: 0,
                    resultEntries: [],
                    resultEntryKeySet: new Set(),
                    compositeKeySet: new Set(),
                    attachmentUrlSet: new Set(),
                    heldCompositeKeySet: new Set(),
                    hasHeldDelivery: false,
                    hasNonHeldDelivery: false
                });
            }

            const recipientSummary = recipientMap.get(normalizedReceiverId);
            const resultDisplay = makeResultDisplay(deliveryItem, {
                otherPersonByAddress,
                currentRecipientId: normalizedReceiverId,
                currentRecipientName: recipientSummary.recipientName
            });
            const resultText = resultDisplay.text;
            const replyText = resultDisplay.replyText;

            const compositeKey = String(deliveryItem?.composite_key || '').trim();
            const resultEntryKey = compositeKey
                ? `${compositeKey}::${resultText}::${replyText}`
                : `${deliveryTime}::${resultText}::${replyText}`;
            if (resultText && !recipientSummary.resultEntryKeySet.has(resultEntryKey)) {
                recipientSummary.resultEntries.push({
                    text: resultText,
                    replyText,
                    deliveryTime,
                    compositeKey
                });
                recipientSummary.resultEntryKeySet.add(resultEntryKey);
            }

            if (compositeKey) {
                recipientSummary.compositeKeySet.add(compositeKey);
            }

            const isHeldDelivery = isDeliveryStillHeld(deliveryItem);
            recipientSummary.deliveryCount += 1;
            if (!!deliveryFlags.ava_only) {
                recipientSummary.avaOnlyDeliveryCount += 1;
            }

            if (isHeldDelivery) {
                recipientSummary.hasHeldDelivery = true;
                if (compositeKey) {
                    recipientSummary.heldCompositeKeySet.add(compositeKey);
                }
            }
            else {
                recipientSummary.hasNonHeldDelivery = true;
            }

            const attachmentUrls = getAttachmentUrlsFromMessage(deliveryItem);
            attachmentUrls.forEach((attachmentUrl) => {
                recipientSummary.attachmentUrlSet.add(attachmentUrl);
            });

            deliveryFlagLabels.forEach((flagLabel) => {
                recipientSummary.flagSet.add(flagLabel);
            });
        });
    });

    return Array.from(recipientMap.values())
        .map((recipientSummary) => {
            const sortedResultEntries = recipientSummary.resultEntries
                .slice()
                .sort((a, b) => (b.deliveryTime || 0) - (a.deliveryTime || 0));

            const resultDisplayList = trimViaAvaOnlyResultEntries(
                dedupeReplyTextForDisplay(sortedResultEntries)
            );

            const recipientFlagSet = new Set(recipientSummary.flagSet);
            const hasOnlySingleAvaDelivery = (recipientSummary.deliveryCount === 1) && (recipientSummary.avaOnlyDeliveryCount === 1);
            if (!hasOnlySingleAvaDelivery) {
                recipientFlagSet.delete('AVA Only');
            }

            return {
                resultDisplayList,
                recipientId: recipientSummary.recipientId,
                recipientName: recipientSummary.recipientName,
                flagLabels: Array.from(recipientFlagSet).sort(),
                resultTextList: sortedResultEntries
                    .map((entry) => entry.text)
                    .filter(Boolean),
                resultText: sortedResultEntries
                    .map((entry) => entry.text)
                    .find(Boolean) || '',
                compositeKeys: Array.from(recipientSummary.compositeKeySet),
                compositeKey: Array.from(recipientSummary.compositeKeySet)[0] || '',
                attachmentUrls: Array.from(recipientSummary.attachmentUrlSet),
                attachmentUrl: Array.from(recipientSummary.attachmentUrlSet)[0] || '',
                heldCompositeKeys: Array.from(recipientSummary.heldCompositeKeySet),
                heldCompositeKey: Array.from(recipientSummary.heldCompositeKeySet)[0] || '',
                isUnresolvedHold: !!recipientSummary.hasHeldDelivery && !recipientSummary.hasNonHeldDelivery
            };
        })
        .sort((a, b) => a.recipientName.localeCompare(b.recipientName));
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

    React.useEffect(() => {
        if (defaults.autoSearch && accessListReady) {
            hasManualSearchRef.current = true;
            setHasSearchedOnce(true);
            runSearchRef.current();
        }
    }, [accessListReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const initialParty1Ids = (() => {
        const explicit = normalizeIdList(defaults.party1Ids || defaults.party1_ids || defaults.senderIds || defaults.sender_ids);
        if (explicit.length > 0) { return explicit; }
        if ((defaults.party1 || defaults.sender || '').toLowerCase() === '*me') {
            return myPatientId ? [myPatientId] : [];
        }
        return [];
    })();

    const initialParty2Ids = normalizeIdList(
        defaults.party2Ids || defaults.party2_ids || defaults.receiverIds || defaults.receiver_ids ||
        defaults.party2 || defaults.receiver
    );

    const defaultDates = getDefaultDateRange();
    const [filters, setFilters] = React.useState({
        party1Ids: initialParty1Ids,
        party2Ids: initialParty2Ids,
        party1Display: defaults.party1Display || defaults.party1 || defaults.senderDisplay || defaults.sender || '*me',
        party2Display: defaults.party2Display || defaults.party2 || defaults.receiverDisplay || defaults.receiver || '*anyone',
        dateFrom: toDateInputValue(defaults.dateFrom) || defaultDates.dateFrom,
        dateTo: toDateInputValue(defaults.dateTo) || defaultDates.dateTo,
        messageSearchText: defaults.messageSearchText || defaults.message_search_text || defaults.messageSearch || defaults.message_search || ''
    });
    const [activeStatusFilter, setActiveStatusFilter] = React.useState(normalizeStatusFilterValue(defaults.status));
    const [pendingSearchChanges, setPendingSearchChanges] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [hasSearchedOnce, setHasSearchedOnce] = React.useState(false);
    const [errorText, setErrorText] = React.useState('');
    const [baseMessages, setBaseMessages] = React.useState([]);
    const [selectedMessage, setSelectedMessage] = React.useState(null);
    const [selectedRecipientPersonId, setSelectedRecipientPersonId] = React.useState('');
    const runSearchRef = React.useRef(() => { });
    const hasManualSearchRef = React.useRef(false);
    const loadingRef = React.useRef(false);
    const pendingSearchRef = React.useRef(false);
    const [signatureKeyByPersonId, setSignatureKeyByPersonId] = React.useState({});
    const signatureKeyFetchAttemptedRef = React.useRef(new Set());
    const [replyToContext, setReplyToContext] = React.useState({
        loading: false,
        errorText: '',
        message: null
    });
    const [showParty1QuickSearch, setShowParty1QuickSearch] = React.useState(false);
    const [showParty2QuickSearch, setShowParty2QuickSearch] = React.useState(false);
    const [party1EditText, setParty1EditText] = React.useState(null);
    const [party2EditText, setParty2EditText] = React.useState(null);
    const [holdActionBusy, setHoldActionBusy] = React.useState(false);
    const [forwardMessageOptions, setForwardMessageOptions] = React.useState(null);
    const [replyMessageOptions, setReplyMessageOptions] = React.useState(null);
    const [releaseConfirmContext, setReleaseConfirmContext] = React.useState(null);
    const [autoCcForwardNameByRecipientId, setAutoCcForwardNameByRecipientId] = React.useState({});
    const autoCcForwardNameByRecipientIdRef = React.useRef({});
    const autoCcLookupAttemptedRef = React.useRef(new Set());
    const [party1QuickSearchData, setParty1QuickSearchData] = React.useState({
        selections: [],
        accessList,
        special_values: quickSearchSpecialValues,
    });
    const [party2QuickSearchData, setParty2QuickSearchData] = React.useState({
        selections: [],
        accessList,
        special_values: quickSearchSpecialValues,
    });

    const updateFilter = (key, value) => {
        setPendingSearchChanges(true);
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const openParty1Picker = (preFilter = '') => {
        if (!accessListReady) {
            onClose({
                message: 'AVA is still loading.  Please wait a moment.'
            });
            return;
        }
        if (preFilter) {
            setParty1QuickSearchData(prev => ({
                ...prev,
                linkedPersonFilter: { raw: preFilter, lower: preFilter.toLowerCase() }
            }));
        }
        setShowParty1QuickSearch(true);
    };

    const openParty2Picker = (preFilter = '') => {
        if (!accessListReady) {
            onClose({
                message: 'AVA is still loading.  Please wait a moment.'
            });
            return;
        }
        if (preFilter) {
            setParty2QuickSearchData(prev => ({
                ...prev,
                linkedPersonFilter: { raw: preFilter, lower: preFilter.toLowerCase() }
            }));
        }
        setShowParty2QuickSearch(true);
    };

    React.useEffect(() => {
        setParty1QuickSearchData(prev => ({
            ...prev,
            accessList,
            special_values: quickSearchSpecialValues
        }));
        setParty2QuickSearchData(prev => ({
            ...prev,
            accessList,
            special_values: quickSearchSpecialValues
        }));
    }, [accessList, quickSearchSpecialValues]);

    const accessListByPersonId = React.useMemo(() => {
        const lookup = new Map();
        accessList.forEach((person) => {
            const key = String(person?.person_id || '').trim().toLowerCase();
            if (!key || lookup.has(key)) {
                return;
            }
            lookup.set(key, person);
        });
        return lookup;
    }, [accessList]);

    const personNameFromAccessList = React.useCallback((personId) => {
        const normalizedPersonId = String(personId || '').trim();
        if (!normalizedPersonId) { return ''; }
        const found = accessListByPersonId.get(normalizedPersonId.toLowerCase());
        if (!found) { return personId; }
        const first = found.first || found?.name?.first || '';
        const last = found.last || found?.name?.last || '';
        const full = `${first} ${last}`.trim();
        return full || found.display_name || normalizedPersonId;
    }, [accessListByPersonId]);

    const getSignatureKeyFromAccessList = React.useCallback((personId) => {
        const normalizedPersonId = String(personId || '').trim();
        if (!normalizedPersonId) {
            return '';
        }
        const found = accessListByPersonId.get(normalizedPersonId.toLowerCase());
        const signatureKey = String(found?.signature_key || found?.signatureKey || '').trim();
        return signatureKey;
    }, [accessListByPersonId]);

    const getSignatureKeyForPerson = React.useCallback((personId) => {
        const normalizedPersonId = String(personId || '').trim();
        if (!normalizedPersonId) {
            return '';
        }

        const fromAccessList = getSignatureKeyFromAccessList(normalizedPersonId);
        if (fromAccessList) {
            return fromAccessList;
        }

        return String(signatureKeyByPersonId[normalizedPersonId.toLowerCase()] || '').trim();
    }, [getSignatureKeyFromAccessList, signatureKeyByPersonId]);

    React.useEffect(() => {
        let cancelled = false;

        const senderIdsToCheck = [
            selectedMessage?.sent_from,
            replyToContext?.message?.sent_from
        ]
            .map((personId) => String(personId || '').trim())
            .filter(Boolean);

        const uniqueSenderIds = Array.from(new Set(senderIdsToCheck));
        if (uniqueSenderIds.length === 0) {
            return undefined;
        }

        const fetchMissingSignatureKeys = async () => {
            const idsToFetch = uniqueSenderIds.filter((personId) => {
                const personIdLower = personId.toLowerCase();
                if (getSignatureKeyFromAccessList(personId)) {
                    return false;
                }
                if (signatureKeyByPersonId[personIdLower] !== undefined) {
                    return false;
                }
                if (signatureKeyFetchAttemptedRef.current.has(personIdLower)) {
                    return false;
                }
                return true;
            });

            if (idsToFetch.length === 0) {
                return;
            }

            idsToFetch.forEach((personId) => signatureKeyFetchAttemptedRef.current.add(personId.toLowerCase()));

            const fetchedEntries = await Promise.all(idsToFetch.map(async (personId) => {
                try {
                    const personResult = await dbClient
                        .get({
                            TableName: 'People',
                            Key: { person_id: personId }
                        })
                        .promise();
                    const signatureKey = String(personResult?.Item?.signature_key || personResult?.Item?.signatureKey || '').trim();
                    return { personId: personId.toLowerCase(), signatureKey };
                }
                catch (error) {
                    console.log('[MessageMonitorV3] Unable to read People signature_key', { personId, error });
                    return { personId: personId.toLowerCase(), signatureKey: '' };
                }
            }));

            if (cancelled) {
                return;
            }

            setSignatureKeyByPersonId((prev) => {
                const next = { ...prev };
                fetchedEntries.forEach(({ personId, signatureKey }) => {
                    if (!(personId in next)) {
                        next[personId] = signatureKey;
                    }
                });
                return next;
            });
        };

        fetchMissingSignatureKeys();

        return () => {
            cancelled = true;
        };
    }, [selectedMessage, replyToContext, getSignatureKeyFromAccessList, signatureKeyByPersonId]);

    React.useEffect(() => {
        autoCcForwardNameByRecipientIdRef.current = autoCcForwardNameByRecipientId;
    }, [autoCcForwardNameByRecipientId]);

    React.useEffect(() => {
        let cancelled = false;

        const loadAutoCcForwardNames = async () => {
            if (!selectedMessage || !currentClientId) {
                setAutoCcForwardNameByRecipientId((prev) => (Object.keys(prev).length === 0 ? prev : {}));
                autoCcLookupAttemptedRef.current = new Set();
                return;
            }

            const selectedDeliveryItems = Array.isArray(selectedMessage.delivery_items)
                ? selectedMessage.delivery_items
                : [selectedMessage];
            const recipientSummaries = buildRecipientSummaries(selectedDeliveryItems, personNameFromAccessList);
            const autoCcRecipientIds = recipientSummaries
                .filter((recipientSummary) => {
                    return Array.isArray(recipientSummary?.flagLabels) && recipientSummary.flagLabels.includes('Auto CC');
                })
                .map((recipientSummary) => String(recipientSummary?.recipientId || '').trim())
                .filter((recipientId) => recipientId !== '');

            if (autoCcRecipientIds.length === 0) {
                setAutoCcForwardNameByRecipientId((prev) => (Object.keys(prev).length === 0 ? prev : {}));
                autoCcLookupAttemptedRef.current = new Set();
                return;
            }

            const uniqueRecipientIds = Array.from(new Set(autoCcRecipientIds));

            const idsToLookup = uniqueRecipientIds.filter((recipientId) => {
                const key = recipientId.toLowerCase();
                if (autoCcForwardNameByRecipientIdRef.current[key] !== undefined) {
                    return false;
                }
                if (autoCcLookupAttemptedRef.current.has(key)) {
                    return false;
                }
                return true;
            });

            if (idsToLookup.length === 0) {
                return;
            }

            idsToLookup.forEach((recipientId) => autoCcLookupAttemptedRef.current.add(recipientId.toLowerCase()));

            const resolvedEntries = await Promise.all(idsToLookup.map(async (recipientId) => {
                try {
                    const recipientKey = recipientId.toLowerCase();
                    let receiverPerson = null;

                    const personResponse = await dbClient
                        .get({
                            TableName: 'People',
                            Key: { person_id: recipientId }
                        })
                        .promise();

                    if (personResponse?.Item) {
                        receiverPerson = personResponse.Item;
                    }
                    else {
                        receiverPerson = accessListByPersonId.get(recipientKey) || null;
                    }

                    const familyGroupsFromPerson = Array.isArray(receiverPerson?.family_groups)
                        ? receiverPerson.family_groups
                            .map((familyGroupId) => String(familyGroupId || '').trim())
                            .filter(Boolean)
                        : [];
                    const familyGroupFromPerson = String(receiverPerson?.family_group || '').trim();
                    const familyId = familyGroupsFromPerson[0] || familyGroupFromPerson;

                    if (!familyId) {
                        return { recipientKey, forwardName: '' };
                    }

                    const familyGroupResponse = await dbClient
                        .get({
                            TableName: 'FamilyGroups',
                            Key: {
                                client_id: currentClientId,
                                composite_key: familyId
                            }
                        })
                        .promise();

                    const primaryContactId = String(familyGroupResponse?.Item?.primary_contact?.id || '').trim();
                    if (!primaryContactId) {
                        return { recipientKey, forwardName: '' };
                    }

                    const primaryContactNameFromAccessList = String(personNameFromAccessList(primaryContactId) || '').trim();
                    const primaryContactName = (
                        primaryContactNameFromAccessList
                        && (primaryContactNameFromAccessList.toLowerCase() !== primaryContactId.toLowerCase())
                    )
                        ? primaryContactNameFromAccessList
                        : (String((await makeName(primaryContactId)) || '').trim() || primaryContactId);

                    return { recipientKey, forwardName: primaryContactName };
                }
                catch (error) {
                    console.log('[MessageMonitorV3] Unable to resolve Auto CC family contact', { recipientId, error });
                    return { recipientKey: recipientId.toLowerCase(), forwardName: '' };
                }
            }));

            if (cancelled) {
                return;
            }

            setAutoCcForwardNameByRecipientId((prev) => {
                const next = { ...prev };
                resolvedEntries.forEach(({ recipientKey, forwardName }) => {
                    next[recipientKey] = String(forwardName || '').trim();
                });
                return next;
            });
        };

        loadAutoCcForwardNames();

        return () => {
            cancelled = true;
        };
    }, [selectedMessage, currentClientId, accessListByPersonId, personNameFromAccessList]);

    React.useEffect(() => {
        let cancelled = false;

        const loadReplyToContext = async () => {
            if (!selectedMessage) {
                setReplyToContext({ loading: false, errorText: '', message: null });
                return;
            }

            const selectedDeliveryItems = Array.isArray(selectedMessage.delivery_items)
                ? selectedMessage.delivery_items
                : [selectedMessage];
            const selectedIsReplyMessage = isReplyMessageFromDeliveries(selectedDeliveryItems);
            if (!selectedIsReplyMessage) {
                setReplyToContext({ loading: false, errorText: '', message: null });
                return;
            }

            const threadId = String(
                selectedMessage?.thread_id
                || selectedDeliveryItems.find((deliveryItem) => !!deliveryItem?.thread_id)?.thread_id
                || ''
            ).trim();
            const senderId = String(selectedMessage?.sent_from || '').trim();
            const targetDeliverTo = String(
                selectedMessage?.deliver_to
                || selectedDeliveryItems.find((deliveryItem) => !!deliveryItem?.deliver_to)?.deliver_to
                || ''
            ).trim().toLowerCase();
            const targetMessageDateValue = normalizeDateValue(selectedMessage);
            const targetMessageTime = (() => {
                const asNumber = Number(targetMessageDateValue);
                if (!Number.isNaN(asNumber) && (asNumber > 0)) {
                    return asNumber;
                }
                const asDate = new Date(targetMessageDateValue || 0).getTime();
                return Number.isNaN(asDate) ? 0 : asDate;
            })();

            if (!threadId || !senderId || !targetDeliverTo || !targetMessageTime) {
                setReplyToContext({
                    loading: false,
                    errorText: 'Missing thread context for reply lookup.',
                    message: null
                });
                return;
            }

            setReplyToContext({ loading: true, errorText: '', message: null });

            try {
                const replyLookupPageSize = 25;
                const replyLookupMaxPages = 20;
                const selectedIdentityKey = getMessageIdentityKey(selectedMessage);
                let foundReplyToMessage = null;
                let lastKey;
                let pageGuard = 0;
                const fetchedCandidates = [];

                do {
                    const response = await dbClient
                        .query({
                            TableName: 'TheseusMessages',
                            KeyConditionExpression: 'thread_id = :threadId',
                            FilterExpression: 'record_type = :recordType AND deliver_to = :deliverTo',
                            ExpressionAttributeValues: {
                                ':threadId': threadId,
                                ':recordType': 'delivery',
                                ':deliverTo': senderId
                            },
                            ExclusiveStartKey: lastKey,
                            ScanIndexForward: false,
                            Limit: replyLookupPageSize
                        })
                        .promise();

                    const candidateItems = Array.isArray(response?.Items) ? response.Items : [];
                    fetchedCandidates.push(...candidateItems);

                    lastKey = response?.LastEvaluatedKey;
                    pageGuard++;
                } while (!foundReplyToMessage && lastKey && (pageGuard < replyLookupMaxPages));

                const sortedCandidates = fetchedCandidates
                    .map((candidate) => {
                        const candidateDateValue = normalizeDateValue(candidate);
                        const candidateTime = (() => {
                            const asNumber = Number(candidateDateValue);
                            if (!Number.isNaN(asNumber) && (asNumber > 0)) {
                                return asNumber;
                            }
                            const asDate = new Date(candidateDateValue || 0).getTime();
                            return Number.isNaN(asDate) ? 0 : asDate;
                        })();

                        return {
                            candidate,
                            candidateTime,
                            candidateIdentityKey: getMessageIdentityKey(candidate)
                        };
                    })
                    .filter(({ candidateTime }) => candidateTime > 0)
                    .sort((a, b) => b.candidateTime - a.candidateTime);

                foundReplyToMessage = (
                    sortedCandidates.find(({ candidate, candidateTime, candidateIdentityKey }) => {
                        if (candidateTime >= targetMessageTime) {
                            return false;
                        }
                        if (selectedIdentityKey && (candidateIdentityKey === selectedIdentityKey)) {
                            return false;
                        }
                        const candidateSender = String(candidate?.sent_from || '').trim().toLowerCase();
                        if (candidateSender !== targetDeliverTo) {
                            return false;
                        }
                        return true;
                    })?.candidate
                ) || null;

                if (cancelled) {
                    return;
                }

                setReplyToContext({
                    loading: false,
                    errorText: '',
                    message: foundReplyToMessage
                });
            }
            catch (error) {
                if (cancelled) {
                    return;
                }
                setReplyToContext({
                    loading: false,
                    errorText: `Unable to load replied-to message: ${error?.message || error}`,
                    message: null
                });
            }
        };

        loadReplyToContext();

        return () => {
            cancelled = true;
        };
    }, [selectedMessage]);

    const summarizeSelectionDisplay = (selections, personIds, type) => {
        if (!selections || selections.length === 0) {
            return (type === 'party1') ? '*me' : '*anyone';
        }
        if (selections.length === 1) {
            const [firstSelection] = selections;
            if (firstSelection.person_id) {
                if (firstSelection.person_id === myPatientId) {
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
        setPendingSearchChanges(true);
        const personIds = extractPersonIds(selections);
        const display = summarizeSelectionDisplay(selections, personIds, type);
        if (type === 'party1') {
            setFilters(prev => ({
                ...prev,
                party1Ids: personIds,
                party1Display: display,
            }));
        }
        else {
            setFilters(prev => ({
                ...prev,
                party2Ids: personIds,
                party2Display: display,
            }));
        }
    };

    const updateParty1QuickSearchData = (newData, force = false) => {
        setParty1QuickSearchData(prev => ({ ...prev, ...newData }));
        if (newData?.selections) {
            applyQuickSearchSelections('party1', newData.selections);
        }
        if (force) { }
    };

    const updateParty2QuickSearchData = (newData, force = false) => {
        setParty2QuickSearchData(prev => ({ ...prev, ...newData }));
        if (newData?.selections) {
            applyQuickSearchSelections('party2', newData.selections);
        }
        if (force) { }
    };

    const findHeldActionRecByCompositeKey = React.useCallback(async (heldCompositeKey) => {
        const normalizedCompositeKey = String(heldCompositeKey || '').trim();
        if (!normalizedCompositeKey || !currentClientId) {
            return null;
        }

        let lastKey;
        let pageGuard = 0;

        do {
            const actionResponse = await dbClient
                .query({
                    TableName: 'MessageActions',
                    KeyConditionExpression: 'client_id = :clientId',
                    FilterExpression: '#content.#compositeKey = :compositeKey',
                    ExpressionAttributeNames: {
                        '#content': 'content',
                        '#compositeKey': 'composite_key'
                    },
                    ExpressionAttributeValues: {
                        ':clientId': currentClientId,
                        ':compositeKey': normalizedCompositeKey
                    },
                    ExclusiveStartKey: lastKey,
                    Limit: 100
                })
                .promise();

            const matchedAction = (Array.isArray(actionResponse?.Items) ? actionResponse.Items : []).find(Boolean);
            if (matchedAction) {
                return matchedAction;
            }

            lastKey = actionResponse?.LastEvaluatedKey;
            pageGuard++;
        } while (lastKey && (pageGuard < 6));

        return null;
    }, [currentClientId]);

    const releaseHeldByCompositeKey = React.useCallback(async (heldCompositeKey) => {
        const actionRec = await findHeldActionRecByCompositeKey(heldCompositeKey);
        if (!actionRec) {
            throw new Error(`No MessageActions record found for ${heldCompositeKey}`);
        }

        const postOfficeMessageId = String(actionRec?.content?.message_id || '').trim();
        if (!postOfficeMessageId) {
            throw new Error('Held action record is missing content.message_id');
        }

        const poTableName = actionRec?.content?.testMode ? 'TestPostOffice' : 'PostOffice';
        const postOfficeOriginal = await dbClient
            .get({
                TableName: poTableName,
                Key: { message_id: postOfficeMessageId }
            })
            .promise();

        if (!postOfficeOriginal?.Item) {
            throw new Error(`PostOffice message_id ${postOfficeMessageId} not found in ${poTableName}`);
        }

        const nextPostOfficeRecord = {
            ...postOfficeOriginal.Item,
            message_id: `${postOfficeOriginal.Item.message_id}.${Date.now()}`,
            byPass_rules: true
        };

        const actionCompositeKey = String(actionRec?.content?.composite_key || '').trim();
        if (actionCompositeKey) {
            const originalDelivery = await dbClient
                .get({
                    TableName: 'TheseusMessages',
                    Key: {
                        thread_id: postOfficeOriginal.Item.thread_id,
                        composite_key: actionCompositeKey
                    }
                })
                .promise();

            if (originalDelivery?.Item?.deliver_to) {
                nextPostOfficeRecord.recipient_base = 'list';
                nextPostOfficeRecord.recipient_key = [originalDelivery.Item.deliver_to];
            }
        }

        await dbClient
            .put({
                TableName: poTableName,
                Item: nextPostOfficeRecord
            })
            .promise();

        await dbClient
            .delete({
                TableName: 'MessageActions',
                Key: {
                    client_id: actionRec.client_id,
                    after: actionRec.after
                }
            })
            .promise();

        return nextPostOfficeRecord.message_id;
    }, [findHeldActionRecByCompositeKey]);

    const handleReleaseHeldRecipients = React.useCallback(async (recipientSummaryList = []) => {
        const unresolvedRecipients = (Array.isArray(recipientSummaryList) ? recipientSummaryList : []).filter((recipientSummary) => {
            return !!recipientSummary?.isUnresolvedHold && !!String(recipientSummary?.heldCompositeKey || '').trim();
        });

        if (unresolvedRecipients.length === 0) {
            return;
        }

        setHoldActionBusy(true);
        let successCount = 0;
        const failures = [];

        for (const recipientSummary of unresolvedRecipients) {
            const heldCompositeKey = String(recipientSummary.heldCompositeKey || '').trim();
            try {
                await releaseHeldByCompositeKey(heldCompositeKey);
                successCount++;
            }
            catch (error) {
                failures.push({
                    recipient: recipientSummary.recipientName || recipientSummary.recipientId,
                    message: error?.message || String(error)
                });
            }
        }

        setHoldActionBusy(false);

        if (failures.length > 0) {
            window.alert([
                `Released ${successCount} held recipient${successCount === 1 ? '' : 's'}.`,
                ...failures.map((failure) => `Failed ${failure.recipient}: ${failure.message}`)
            ].join('\n'));
        }
        else {
            window.alert(`Released ${successCount} held recipient${successCount === 1 ? '' : 's'}.`);
        }

        setSelectedMessage(null);
        runSearchRef.current();
    }, [releaseHeldByCompositeKey]);

    const requestReleaseHeldRecipients = React.useCallback((recipientSummaryList = []) => {
        const unresolvedRecipients = (Array.isArray(recipientSummaryList) ? recipientSummaryList : []).filter((recipientSummary) => {
            return !!recipientSummary?.isUnresolvedHold && !!String(recipientSummary?.heldCompositeKey || '').trim();
        });
        if (unresolvedRecipients.length === 0) {
            return;
        }

        const recipientNames = unresolvedRecipients
            .map((recipientSummary) => String(recipientSummary?.recipientName || recipientSummary?.recipientId || '').trim())
            .filter(Boolean);

        const promptText = unresolvedRecipients.length === 1
            ? `Release held message for ${recipientNames[0] || 'this recipient'}?`
            : `Release held messages for ${unresolvedRecipients.length} recipients?`;

        setReleaseConfirmContext({
            recipientSummaryList: unresolvedRecipients,
            promptText
        });
    }, []);

    const handleForwardMessage = React.useCallback(async () => {
        if (!selectedMessage) {
            return;
        }

        const senderId = String(selectedMessage?.sent_from || '').trim();
        const senderName = personNameFromAccessList(senderId || 'Unknown sender');
        const forwarderId = String(state?.session?.user_id || '').trim();
        const resolvedForwarderName = personNameFromAccessList(forwarderId || '');
        const forwarderNameFromSession = [
            state?.session?.user_name,
            state?.session?.user_full_name,
            `${state?.session?.user_first || ''} ${state?.session?.user_last || ''}`.trim(),
            state?.session?.name
        ]
            .map((value) => String(value || '').trim())
            .find(Boolean);
        const forwarderNameFromMakeName = forwarderId
            ? String((await makeName(forwarderId)) || '').trim()
            : '';
        const forwarderName = (
            resolvedForwarderName
            && forwarderId
            && (String(resolvedForwarderName).trim().toLowerCase() !== forwarderId.toLowerCase())
        )
            ? resolvedForwarderName
            : (forwarderNameFromSession || forwarderNameFromMakeName || 'Unknown user');
        const selectedDeliveryItems = Array.isArray(selectedMessage.delivery_items) ? selectedMessage.delivery_items : [selectedMessage];
        const selectedReceivers = getUniqueReceiversFromDeliveries(selectedDeliveryItems);
        const recipientText = summarizeReceivers(selectedReceivers, personNameFromAccessList, 10);
        const shouldBypassRulesOnForward = selectedDeliveryItems.some((deliveryItem) => isDeliveryStillHeld(deliveryItem));
        const forwardAttachmentUrls = Array.from(new Set(
            selectedDeliveryItems
                .flatMap((deliveryItem) => getAttachmentUrlsFromMessage(deliveryItem))
                .filter(Boolean)
        ));

        const sentDateText = formatMessageDate(normalizeDateValue(selectedMessage));
        const originalText = getMessageText(selectedMessage, {
            signatureKey: getSignatureKeyForPerson(selectedMessage?.sent_from)
        }) || '';

        const forwardIntro = `I thought you should see this message.  It was originally sent by ${senderName} on ${sentDateText}.`;
        const forwardRecipientsLine = `Original recipients listed on that send: ${recipientText}.`;
        const forwardAttachmentWarningLine = (forwardAttachmentUrls.length > 0)
            ? `Attachment note: ${forwardAttachmentUrls.length} original attachment link${forwardAttachmentUrls.length === 1 ? '' : 's'} copied to this forward.`
            : '';
        const forwardRuleBypassLine = shouldBypassRulesOnForward
            ? 'Routing note: Rule bypass was enabled because at least one original delivery was held.'
            : '';
        const forwardSeparatorLine = '\n~ ~ ~\n';
        const forwardTextWithContext = [
            forwardIntro,
            forwardRecipientsLine,
            forwardAttachmentWarningLine,
            forwardRuleBypassLine,
            forwardSeparatorLine,
            originalText
        ]
            .filter((line) => String(line || '').trim() !== '')
            .join('\n')
            .trim();
        const forwardSubject = `Message Forwarded from ${forwarderName}`;

        setForwardMessageOptions({
            newMessage: true,
            sendFrom: forwarderId,
            subject: forwardSubject,
            messageText: forwardTextWithContext,
            attachmentList: forwardAttachmentUrls,
            forwardBypassRules: shouldBypassRulesOnForward,
            newMessageSendFrom: forwarderId,
            newMessageSubject: forwardSubject,
            newMessageText: forwardTextWithContext,
            sourceMessage: selectedMessage,
            sourceSenderName: senderName,
            sourceMessageText: originalText
        });
    }, [selectedMessage, personNameFromAccessList, state, getSignatureKeyForPerson]);

    const handleReplyMessage = React.useCallback(async () => {
        if (!selectedMessage) {
            return;
        }

        const myId = String(myPatientId || '').trim().toLowerCase();
        const senderId = String(selectedMessage?.sent_from || '').trim().toLowerCase();
        const selectedDeliveryItems = Array.isArray(selectedMessage.delivery_items)
            ? selectedMessage.delivery_items
            : [selectedMessage];
        const allReceivers = getUniqueReceiversFromDeliveries(selectedDeliveryItems)
            .map(r => r.toLowerCase());

        const iAmSender = myId && (senderId === myId);
        const iAmReceiver = myId && allReceivers.includes(myId);

        if (!iAmSender && !iAmReceiver) {
            return;
        }

        // Determine the other parties: exclude *me from the full set of participants
        const allParticipants = Array.from(new Set([senderId, ...allReceivers]));
        const otherParticipantIds = allParticipants.filter(id => id !== myId && id !== '');

        const recipients = await Promise.all(
            otherParticipantIds.map(async (personId) => {
                const nameFromList = String(personNameFromAccessList(personId) || '').trim();
                const resolvedName = (
                    nameFromList && (nameFromList.toLowerCase() !== personId.toLowerCase())
                )
                    ? nameFromList
                    : (String((await makeName(personId)) || '').trim() || personId);
                return { person_id: personId, person_name: resolvedName };
            })
        );

        const subject = String(selectedMessage?.subject_line || selectedMessage?.subject || selectedMessage?.title || '').trim();
        const replySubject = subject ? `Re: ${subject}` : '';
        const threadId = String(
            selectedMessage?.thread_id
            || selectedDeliveryItems.find(d => !!d?.thread_id)?.thread_id
            || ''
        ).trim();

        const sourceSenderName = String(personNameFromAccessList(senderId) || '').trim() || senderId;
        const sourceMessageText = getMessageText(selectedMessage, {
            signatureKey: getSignatureKeyForPerson(selectedMessage?.sent_from)
        }) || '';

        setReplyMessageOptions({
            newMessage: true,
            sendFrom: myPatientId,
            subject: replySubject,
            recipients,
            ...(threadId ? { newMessageThread: threadId } : {}),
            sourceMessage: selectedMessage,
            sourceSenderName,
            sourceMessageText
        });
    }, [selectedMessage, myPatientId, personNameFromAccessList, getSignatureKeyForPerson]);

    const runSearch = async (overrideFilters = null) => {
        setLoading(true);
        setErrorText('');
        try {
            const searchFilters = overrideFilters || filters;
            const party1Match = (searchFilters.party1Display || '').trim().toLowerCase();
            const party2Match = (searchFilters.party2Display || '').trim().toLowerCase();
            const party1IdMatch = (searchFilters.party1Ids || []).map(v => String(v).toLowerCase());
            const party2IdMatch = (searchFilters.party2Ids || []).map(v => String(v).toLowerCase());
            const myIdentityList = [state?.session?.patient_id]
                .filter(Boolean)
                .map(v => String(v).toLowerCase());
            const party1HasAnyone = party1IdMatch.includes('*anyone') || (party1Match === '*anyone');
            const party2HasAnyone = party2IdMatch.includes('*anyone') || (party2Match === '*anyone');
            const party1HasMe = party1IdMatch.includes('*me') || (party1Match === '*me');
            const party2HasMe = party2IdMatch.includes('*me') || (party2Match === '*me');

            if (party1HasAnyone && party2HasAnyone) {
                setErrorText('Please specify at least one person before searching.');
                setLoading(false);
                return;
            }

            const fromDate = searchFilters.dateFrom ? parseDateInputAsLocalDate(searchFilters.dateFrom) : null;
            const toDate = searchFilters.dateTo ? parseDateInputAsLocalDate(searchFilters.dateTo) : null;
            if (toDate) {
                toDate.setHours(23, 59, 59, 999);
            }

            const resolveEffectiveIds = (idMatch, hasMe, hasAnyone) => {
                if (hasAnyone) { return []; }
                if (idMatch.length > 0) {
                    return Array.from(new Set(
                        idMatch.flatMap(id => {
                            if (id === '*anyone') { return []; }
                            if (id === '*me') { return myIdentityList; }
                            return [id];
                        })
                    ));
                }
                if (hasMe) { return myIdentityList; }
                return [];
            };

            const queryParty1Ids = resolveEffectiveIds(party1IdMatch, party1HasMe, party1HasAnyone);
            const queryParty2Ids = resolveEffectiveIds(party2IdMatch, party2HasMe, party2HasAnyone);

            const weekList = buildMessageWeekList(searchFilters.dateFrom, searchFilters.dateTo);
            const startEpochMs = toEpochMsString(searchFilters.dateFrom, false);
            const endEpochMs = toEpochMsString(searchFilters.dateTo, true);

            const queryBySenderIds = async (senderIds) => {
                const results = [];
                for (const senderId of senderIds) {
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
                                results.push(...response.Items);
                            }
                            lastKey = response?.LastEvaluatedKey;
                            pageGuard++;
                        } while (lastKey && pageGuard < 20);
                    }
                }
                return results;
            };

            const queryByReceiverIds = async (receiverIds) => {
                const results = [];
                for (const receiverId of receiverIds) {
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
                                results.push(...response.Items);
                            }
                            lastKey = response?.LastEvaluatedKey;
                            pageGuard++;
                        } while (lastKey && pageGuard < 20);
                    }
                }
                return results;
            };

            let scanResults = [];
            if (!party1HasAnyone && !party2HasAnyone) {
                // Both parties specified: fetch messages sent by each party; cross-filter applied below
                const [p1AsSender, p2AsSender] = await Promise.all([
                    queryBySenderIds(queryParty1Ids),
                    queryBySenderIds(queryParty2Ids)
                ]);
                scanResults = [...p1AsSender, ...p2AsSender];
            }
            else {
                // One party is *anyone: fetch all messages involving the specified party
                const specifiedIds = party1HasAnyone ? queryParty2Ids : queryParty1Ids;
                const [asSender, asReceiver] = await Promise.all([
                    queryBySenderIds(specifiedIds),
                    queryByReceiverIds(specifiedIds)
                ]);
                scanResults = [...asSender, ...asReceiver];
            }

            const dedupeMap = {};
            for (const record of scanResults) {
                const dedupeKey = `${record.thread_id || ''}::${record.composite_key || record.created_time || Math.random()}`;
                dedupeMap[dedupeKey] = record;
            }
            scanResults = Object.values(dedupeMap);

            const heldRecords = scanResults.filter((record) => {
                const isDeliveryRecord = String(record?.record_type || '').trim().toLowerCase() === 'delivery';
                const isHeldStatus = normalizeStatus(record) === 'held';
                return isDeliveryRecord && isHeldStatus;
            });

            const heldPartnerCache = new Map();
            const partnerIdentityByHeldComposite = new Map();
            const heldCompositeByPartnerIdentity = new Map();

            for (const heldRecord of heldRecords) {
                const threadId = String(heldRecord?.thread_id || '').trim();
                const heldCompositeKey = String(heldRecord?.composite_key || '').trim();
                const heldDeliverTo = String(heldRecord?.deliver_to || '').trim();
                const heldSentFrom = String(heldRecord?.sent_from || '').trim();
                const heldMessageSegment = getCompositeMessageSegment(heldCompositeKey);

                if (!threadId || !heldCompositeKey || !heldDeliverTo || !heldSentFrom || !heldMessageSegment) {
                    continue;
                }

                const heldLookupKey = `${threadId}::${heldCompositeKey}::${heldDeliverTo.toLowerCase()}::${heldSentFrom.toLowerCase()}`;
                if (!heldPartnerCache.has(heldLookupKey)) {
                    const partnerRecords = [];

                    let lastKey;
                    let pageGuard = 0;
                    let retryIdentityKey = '';
                    let keepCollectingCurrentIdentity = false;

                    do {
                        const response = await dbClient
                            .query({
                                TableName: 'TheseusMessages',
                                KeyConditionExpression: 'thread_id = :threadId AND composite_key > :heldCompositeKey',
                                FilterExpression: 'record_type = :recordType AND deliver_to = :deliverTo AND sent_from = :sentFrom',
                                ExpressionAttributeValues: {
                                    ':threadId': threadId,
                                    ':heldCompositeKey': heldCompositeKey,
                                    ':recordType': 'delivery',
                                    ':deliverTo': heldDeliverTo,
                                    ':sentFrom': heldSentFrom
                                },
                                ExclusiveStartKey: lastKey,
                                ScanIndexForward: true,
                                Limit: 50
                            })
                            .promise();

                        const candidateItems = Array.isArray(response?.Items) ? response.Items : [];

                        for (const candidateItem of candidateItems) {
                            const candidateIdentityKey = getMessageIdentityKey(candidateItem);
                            if (!retryIdentityKey) {
                                retryIdentityKey = candidateIdentityKey;
                                keepCollectingCurrentIdentity = true;
                            }

                            if (keepCollectingCurrentIdentity && (candidateIdentityKey === retryIdentityKey)) {
                                partnerRecords.push(candidateItem);
                                continue;
                            }

                            if (keepCollectingCurrentIdentity && (candidateIdentityKey !== retryIdentityKey)) {
                                keepCollectingCurrentIdentity = false;
                                break;
                            }
                        }

                        lastKey = response?.LastEvaluatedKey;
                        pageGuard++;

                        if (!keepCollectingCurrentIdentity && (partnerRecords.length > 0)) {
                            break;
                        }
                    } while (lastKey && (pageGuard < 6));

                    heldPartnerCache.set(heldLookupKey, partnerRecords);
                }

                const matchedPartnerRecords = heldPartnerCache.get(heldLookupKey) || [];
                if (matchedPartnerRecords.length === 0) {
                    continue;
                }

                const partnerIdentityKey = getMessageIdentityKey(matchedPartnerRecords[0]);
                if (!partnerIdentityKey) {
                    continue;
                }

                partnerIdentityByHeldComposite.set(heldCompositeKey, partnerIdentityKey);
                heldCompositeByPartnerIdentity.set(partnerIdentityKey, heldCompositeKey);

                matchedPartnerRecords.forEach((partnerRecord) => {
                    const partnerCompositeKey = String(partnerRecord?.composite_key || '').trim();
                    if (!partnerCompositeKey) {
                        return;
                    }
                    const partnerDedupeKey = `${partnerRecord.thread_id || ''}::${partnerCompositeKey || partnerRecord.created_time || Math.random()}`;
                    dedupeMap[partnerDedupeKey] = partnerRecord;
                });
            }

            scanResults = Object.values(dedupeMap).map((record) => {
                const currentCompositeKey = String(record?.composite_key || '').trim();
                if (!currentCompositeKey) {
                    return record;
                }

                const heldMessageSegment = getCompositeMessageSegment(currentCompositeKey);
                if (!heldMessageSegment) {
                    return record;
                }

                const explicitPartnerIdentity = partnerIdentityByHeldComposite.get(currentCompositeKey);
                if (explicitPartnerIdentity) {
                    heldCompositeByPartnerIdentity.set(explicitPartnerIdentity, currentCompositeKey);
                    return record;
                }

                const currentIdentity = getCompositeKeyIdentity(currentCompositeKey);
                const heldCompositeForIdentity = heldCompositeByPartnerIdentity.get(currentIdentity);
                if (!heldCompositeForIdentity) {
                    return record;
                }

                const heldSegment = getCompositeMessageSegment(heldCompositeForIdentity);
                if (!heldSegment) {
                    return record;
                }

                const nextCompositeKey = replaceCompositeMessageSegment(currentCompositeKey, heldSegment);
                return {
                    ...record,
                    composite_key: nextCompositeKey
                };
            });

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

            const party1IdSet = new Set(queryParty1Ids);
            const party2IdSet = new Set(queryParty2Ids);

            const filtered = scanResults.filter(message => {
                const sender = String(message.sent_from || '').toLowerCase();
                const receivers = normalizeReceivers(message).map(r => r.toLowerCase());

                const senderInParty1 = party1HasAnyone || party1IdSet.has(sender);
                const senderInParty2 = party2HasAnyone || party2IdSet.has(sender);
                const receiverInParty1 = party1HasAnyone || receivers.some(r => party1IdSet.has(r));
                const receiverInParty2 = party2HasAnyone || receivers.some(r => party2IdSet.has(r));

                const direction1Valid = senderInParty1 && receiverInParty2;
                const direction2Valid = senderInParty2 && receiverInParty1;

                if (!direction1Valid && !direction2Valid) {
                    logFilteredOut('party_mismatch', message, { sender, receivers });
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

            const withDerivedFlags = filtered.map((message) => {
                const receiverIds = normalizeReceivers(message)
                    .map((receiverId) => String(receiverId || '').trim().toLowerCase())
                    .filter(Boolean);

                const hasAutoCcReceiver = receiverIds.some((receiverId) => {
                    const receiverPerson = accessListByPersonId.get(receiverId);
                    if (!receiverPerson) {
                        return false;
                    }

                    const preferredMethod = String(receiverPerson?.preferred_method || '').trim().toLowerCase();
                    const preferredMethods = Array.isArray(receiverPerson?.preferred_methods)
                        ? receiverPerson.preferred_methods
                            .map((methodValue) => String(methodValue || '').trim().toLowerCase())
                            .filter(Boolean)
                        : [];

                    return (preferredMethod === 'family_primary') || preferredMethods.includes('family_primary');
                });

                return {
                    ...message,
                    derived_flags: {
                        ...getResultFlags(message),
                        ...getRecipientFlags(message),
                        auto_cc: hasAutoCcReceiver
                    }
                };
            });

            const groupedMap = new Map();
            withDerivedFlags.forEach((deliveryMessage) => {
                const messageKey = getMessageIdentityKey(deliveryMessage);
                const existingGroup = groupedMap.get(messageKey);

                if (!existingGroup) {
                    groupedMap.set(messageKey, {
                        ...deliveryMessage,
                        message_identity_key: messageKey,
                        delivery_items: [deliveryMessage],
                        derived_flags: { ...(deliveryMessage.derived_flags || {}) }
                    });
                    return;
                }

                existingGroup.delivery_items.push(deliveryMessage);
                existingGroup.derived_flags = mergeDerivedFlags(existingGroup.derived_flags, deliveryMessage.derived_flags || {});

                const existingTime = new Date(normalizeDateValue(existingGroup) || 0).getTime();
                const candidateTime = new Date(normalizeDateValue(deliveryMessage) || 0).getTime();
                if (candidateTime > existingTime) {
                    existingGroup.created_time = deliveryMessage.created_time;
                    existingGroup.message_date = deliveryMessage.message_date;
                    existingGroup.created_at = deliveryMessage.created_at;
                    existingGroup.sent_at = deliveryMessage.sent_at;
                    existingGroup.timestamp = deliveryMessage.timestamp;
                }
            });

            const groupedMessages = Array.from(groupedMap.values());

            groupedMessages.forEach((groupedMessage) => {
                const deliveryItems = Array.isArray(groupedMessage.delivery_items)
                    ? groupedMessage.delivery_items
                    : [];

                if (deliveryItems.length !== 1) {
                    groupedMessage.derived_flags = {
                        ...(groupedMessage.derived_flags || {}),
                        ava_only: false
                    };
                    return;
                }

                const onlyDelivery = deliveryItems[0] || null;
                const onlyDeliveryFlags = {
                    ...getResultFlags(onlyDelivery),
                    ...getRecipientFlags(onlyDelivery),
                    ...(onlyDelivery?.derived_flags || {})
                };

                groupedMessage.derived_flags = {
                    ...(groupedMessage.derived_flags || {}),
                    ava_only: !!onlyDeliveryFlags.ava_only
                };
            });

            const toSortMs = (v) => {
                const n = Number(v);
                if (!Number.isNaN(n) && n > 0) { return n; }
                const d = new Date(v || 0).getTime();
                return Number.isNaN(d) ? 0 : d;
            };
            groupedMessages.sort((a, b) => toSortMs(normalizeDateValue(b)) - toSortMs(normalizeDateValue(a)));

            setBaseMessages(groupedMessages);
        }
        catch (error) {
            setErrorText(`Unable to load messages: ${error?.message || error}`);
            setBaseMessages([]);
        }
        setLoading(false);
    };

    runSearchRef.current = runSearch;

    const handleManualSearch = React.useCallback(() => {
        hasManualSearchRef.current = true;
        setHasSearchedOnce(true);
        setPendingSearchChanges(false);
        runSearchRef.current();
    }, []);

    React.useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    React.useEffect(() => {
        pendingSearchRef.current = pendingSearchChanges;
    }, [pendingSearchChanges]);

    React.useEffect(() => {
        const autoRefreshId = window.setInterval(() => {
            if (!hasManualSearchRef.current || loadingRef.current || pendingSearchRef.current) {
                return;
            }
            runSearchRef.current();
        }, 5 * 60 * 1000);

        return () => {
            window.clearInterval(autoRefreshId);
        };
    }, []);

    const textFilteredMessages = React.useMemo(() => {
        const messageSearchQuery = String(filters.messageSearchText || '').trim().toLowerCase();
        if (!messageSearchQuery) {
            return baseMessages;
        }

        return baseMessages.filter((groupedMessage) => {
            const deliveryItems = Array.isArray(groupedMessage?.delivery_items)
                ? groupedMessage.delivery_items
                : [groupedMessage];

            return deliveryItems.some((deliveryItem) => {
                const rawText = String(getRawMessageText(deliveryItem) || '').toLowerCase();
                const strippedText = String(getMessageText(deliveryItem, {
                    signatureKey: getSignatureKeyForPerson(deliveryItem?.sent_from)
                }) || '').toLowerCase();

                return rawText.includes(messageSearchQuery) || strippedText.includes(messageSearchQuery);
            });
        });
    }, [baseMessages, filters.messageSearchText, getSignatureKeyForPerson]);

    const statusPillCounts = React.useMemo(() => {
        const counts = { '*all': textFilteredMessages.length };
        STATUS_FILTER_OPTIONS.forEach((statusKey) => {
            if (statusKey === '*all') { return; }
            counts[statusKey] = textFilteredMessages.filter((message) => messageMatchesStatusKey(message, statusKey)).length;
        });
        return counts;
    }, [textFilteredMessages]);

    const visibleStatusPills = React.useMemo(() => {
        return STATUS_FILTER_OPTIONS.filter((statusKey) => {
            if (statusKey === '*all') { return true; }
            if (statusKey === activeStatusFilter) { return true; }
            return (statusPillCounts[statusKey] || 0) > 0;
        });
    }, [statusPillCounts, activeStatusFilter]);

    const displayedMessages = React.useMemo(() => {
        if (activeStatusFilter === '*all') {
            return textFilteredMessages;
        }
        return textFilteredMessages.filter((message) => messageMatchesStatusKey(message, activeStatusFilter));
    }, [textFilteredMessages, activeStatusFilter]);

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
                        <Typography variant='caption' color='textSecondary' className={classes.muted}>
                            {'Filters'}
                        </Typography>

                        <Box className={classes.filters}>
                            <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TextField
                                    label='Person'
                                    variant='outlined'
                                    size='small'
                                    value={party1EditText !== null ? party1EditText : filters.party1Display}
                                    onChange={(e) => setParty1EditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { openParty1Picker(party1EditText || ''); } }}
                                    onBlur={() => { if (!showParty1QuickSearch) { setParty1EditText(null); } }}
                                    onClick={() => openParty1Picker(party1EditText || '')}
                                    style={{ flex: 1 }}
                                />
                                <Typography color='textSecondary' style={{ flexShrink: 0, fontSize: '1.1rem' }}>{'⇄'}</Typography>
                                <TextField
                                    label='Person'
                                    variant='outlined'
                                    size='small'
                                    value={party2EditText !== null ? party2EditText : filters.party2Display}
                                    onChange={(e) => setParty2EditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { openParty2Picker(party2EditText || ''); } }}
                                    onBlur={() => { if (!showParty2QuickSearch) { setParty2EditText(null); } }}
                                    onClick={() => openParty2Picker(party2EditText || '')}
                                    style={{ flex: 1 }}
                                />
                            </Box>

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

                            <Box>
                                <TextField
                                    label='Message Text'
                                    variant='outlined'
                                    size='small'
                                    value={filters.messageSearchText}
                                    onChange={event => {
                                        const nextValue = event?.target?.value || '';
                                        setFilters(prev => ({ ...prev, messageSearchText: nextValue }));
                                    }}
                                    placeholder='Contains text...'
                                    fullWidth
                                />
                                {String(filters.messageSearchText || '').trim() !== '' && (
                                    <Typography variant='caption' color='textSecondary' style={{ marginTop: 2, display: 'block' }}>
                                        {`${textFilteredMessages.length} match${textFilteredMessages.length === 1 ? '' : 'es'}`}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {textFilteredMessages.length > 0 && (
                        <Box className={classes.statusPillRow} style={{ padding: '0 16px' }}>
                            {visibleStatusPills.map((statusKey) => {
                                const isActive = activeStatusFilter === statusKey;
                                const pillLabel = getStatusPillLabel(statusKey);
                                const pillVariantClass = statusKey === '*all' ? '' : getFlagPillVariantClass(pillLabel, classes);
                                return (
                                    <Box key={statusKey} className={classes.statusPillItem}>
                                        <Typography className={classes.statusPillCount} color='textSecondary'>
                                            {statusPillCounts[statusKey] || 0}
                                        </Typography>
                                        <Button
                                            variant={pillLabel === 'Spam' ? 'contained' : 'outlined'}
                                            size='small'
                                            disableRipple
                                            disableFocusRipple
                                            className={`${classes.statusPillButton} ${classes.flagPill} ${pillVariantClass} ${isActive ? classes.statusPillActive : ''}`}
                                            onClick={() => setActiveStatusFilter(statusKey)}
                                            style={{ opacity: isActive ? 1 : 0.75 }}
                                        >
                                            {pillLabel}
                                        </Button>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    <Box className={classes.scrollArea}>

                        {errorText && (
                            <Box mb={1}>
                                <Alert severity='error'>{errorText}</Alert>
                            </Box>
                        )}

                        <Paper variant='outlined' className={classes.listPaper}>
                            <Box className={classes.listScrollArea}>
                                {loading && (
                                    <Box p={2} display='flex' alignItems='center' gridGap={8}>
                                        <CircularProgress size={18} />
                                        <Typography variant='body2'>Loading messages…</Typography>
                                    </Box>
                                )}

                                {!loading && displayedMessages.length === 0 && (
                                    <Box p={2}>
                                        <Typography variant='body2' className={classes.muted}>
                                            {hasSearchedOnce
                                                ? 'No messages match these filters.'
                                                : 'Tap Search to load messages with these filters.'}
                                        </Typography>
                                    </Box>
                                )}

                                {!loading && displayedMessages.length > 0 && (
                                    <List dense>
                                        {displayedMessages.map((message, index) => {
                                            const sender = message.sent_from || 'Unknown sender';
                                            const deliveryItems = Array.isArray(message.delivery_items) ? message.delivery_items : [message];
                                            const receivers = getUniqueReceiversFromDeliveries(deliveryItems);
                                            const isReplyMessage = isReplyMessageFromDeliveries(deliveryItems);
                                            const senderText = personNameFromAccessList(sender);
                                            const receiverText = summarizeReceivers(receivers, personNameFromAccessList, 2);
                                            const dateText = formatMessageDate(normalizeDateValue(message));
                                            const subjectText = getMessageSubject(message);
                                            const derivedFlags = message.derived_flags || {};
                                            const flagLabels = getEnabledFlagLabels(derivedFlags);
                                            const deliveryCount = deliveryItems.length;
                                            const primary = `${subjectText}`;
                                            const directionText = isReplyMessage
                                                ? `${senderText} → reply to ${receiverText}`
                                                : `${senderText} → ${receiverText}`;
                                            const secondary = `${dateText} • ${directionText}${deliveryCount > 1 ? ` • ${deliveryCount} deliveries` : ''}`;
                                            const previewText = toSingleLinePreview(
                                                getMessageText(message, {
                                                    signatureKey: getSignatureKeyForPerson(message?.sent_from)
                                                })
                                            );
                                            const itemKey = message.message_identity_key || message.composite_key || message.thread_id || `${subjectText}-${index}`;

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
                                                            secondaryTypographyProps={{ component: 'div' }}
                                                            secondary={(
                                                                <Box>
                                                                    <Typography variant='body2' color='textSecondary'>
                                                                        {secondary}
                                                                    </Typography>
                                                                    {!!previewText && (
                                                                        <Typography
                                                                            variant='body2'
                                                                            color='textSecondary'
                                                                            className={classes.messagePreview}
                                                                            noWrap
                                                                            title={previewText}
                                                                        >
                                                                            {previewText}
                                                                        </Typography>
                                                                    )}
                                                                    {flagLabels.length > 0 && (
                                                                        <Box className={classes.flagRow}>
                                                                            {flagLabels.map((flagLabel) => (
                                                                                <Button
                                                                                    key={`${itemKey}_${flagLabel}`}
                                                                                    size='small'
                                                                                    variant='outlined'
                                                                                    disableRipple
                                                                                    disableFocusRipple
                                                                                    onClick={(event) => event.preventDefault()}
                                                                                    className={`${classes.flagPill} ${getFlagPillVariantClass(flagLabel, classes)}`}
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
                                                    {index < (displayedMessages.length - 1) && <Divider component='li' />}
                                                </React.Fragment>
                                            );
                                        })}
                                    </List>
                                )}
                            </Box>
                        </Paper>
                    </Box>

                    <Box className={classes.bottomBar}>
                        <Box className={classes.actions}>
                            {pendingSearchChanges && !loading && (
                                <Typography className={classes.pendingSearchHint}>
                                    Filters changed — tap Search when ready
                                </Typography>
                            )}
                            <Button
                                className={AVAClass.AVAButton}
                                style={{ backgroundColor: 'red', color: 'white' }}
                                size='small'
                                startIcon={<CloseIcon fontSize="small" />}
                                onClick={onClose}
                            >
                                {'Close'}
                            </Button>
                            <Button
                                className={`${AVAClass.AVAButton} ${(pendingSearchChanges && !loading) ? classes.searchButtonPending : ''}`}
                                size='small'
                                color='primary'
                                variant='contained'
                                onClick={handleManualSearch}
                                disabled={loading}
                            >
                                {loading ? 'Searching…' : 'Search'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>

            {showParty1QuickSearch && (
                <QuickSearch
                    reactData={party1QuickSearchData}
                    updateReactData={updateParty1QuickSearchData}
                    options={{
                        pickAndGo: true,
                        keepSelections: true,
                        withGroups: true,
                        withPreferred: false,
                        hidePeople: false,
                        withSpecialValues: true,
                        title: 'Select Person',
                        showAll: true,
                        restrictGroups: false,
                        buttonText: 'Apply'
                    }}
                    onClose={(selections) => {
                        const finalSelections = selections || [];
                        setShowParty1QuickSearch(false);
                        setParty1EditText(null);
                        setParty1QuickSearchData(prev => ({ ...prev, selections: finalSelections, linkedPersonFilter: { raw: '', lower: '' } }));
                        applyQuickSearchSelections('party1', finalSelections);
                    }}
                />
            )}

            {showParty2QuickSearch && (
                <QuickSearch
                    reactData={party2QuickSearchData}
                    updateReactData={updateParty2QuickSearchData}
                    options={{
                        pickAndGo: true,
                        keepSelections: true,
                        withGroups: true,
                        withPreferred: false,
                        hidePeople: false,
                        withSpecialValues: true,
                        title: 'Select Person',
                        showAll: true,
                        restrictGroups: false,
                        buttonText: 'Apply'
                    }}
                    onClose={(selections) => {
                        const finalSelections = selections || [];
                        setShowParty2QuickSearch(false);
                        setParty2EditText(null);
                        setParty2QuickSearchData(prev => ({ ...prev, selections: finalSelections, linkedPersonFilter: { raw: '', lower: '' } }));
                        applyQuickSearchSelections('party2', finalSelections);
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
                    PaperProps={{ style: { overflow: 'hidden', borderRadius: '30px', display: 'flex', flexDirection: 'column', height: '90vh', maxHeight: '90vh' } }}
                >
                    <DialogContent className={classes.detailDialogContent}>
                        <Box className={classes.detailDialogBody}>
                            {(() => {
                                const selectedDeliveryItems = Array.isArray(selectedMessage.delivery_items) ? selectedMessage.delivery_items : [selectedMessage];
                                const selectedIsReplyMessage = isReplyMessageFromDeliveries(selectedDeliveryItems);
                                const selectedReceivers = getUniqueReceiversFromDeliveries(selectedDeliveryItems);
                                const selectedReceiverText = summarizeReceivers(selectedReceivers, personNameFromAccessList, 10);
                                const selectedDeliveryCount = selectedDeliveryItems.length;
                                const recipientSummaries = buildRecipientSummaries(selectedDeliveryItems, personNameFromAccessList);
                                const unresolvedHoldRecipientSummaries = recipientSummaries.filter((recipientSummary) => !!recipientSummary.isUnresolvedHold);
                                const hasUnresolvedHoldRecipients = unresolvedHoldRecipientSummaries.length > 0;
                                const replyToBodyHeightStyle = selectedIsReplyMessage
                                    ? { minHeight: '3.6em', maxHeight: '5.4em' }
                                    : { minHeight: '4.6em', maxHeight: '8.6em' };
                                const thisMessageBodyHeightStyle = selectedIsReplyMessage
                                    ? { minHeight: '4.8em', maxHeight: '6.2em' }
                                    : { minHeight: '7.2em', maxHeight: '10.8em' };
                                return (
                                    <React.Fragment>
                                        <Typography style={{ ...AVATextStyle({ size: 1.2, bold: true }), flexShrink: 0 }}>
                                            {getMessageSubject(selectedMessage)}
                                        </Typography>
                                        {(selectedDeliveryCount > 1) && (
                                            <Typography variant='body2' color='textSecondary' style={{ flexShrink: 0 }}>
                                                {`${selectedDeliveryCount} delivery records in this message thread`}
                                            </Typography>
                                        )}
                                        <Typography variant='body2' style={{ ...AVATextStyle({ size: 0.95, bold: true }), flexShrink: 0 }}>
                                            {'Message'}
                                        </Typography>
                                        {selectedIsReplyMessage && (
                                            <Box className={classes.messageBox}>
                                                <Typography className={classes.messageBoxLabel}>
                                                    {'Replying to'}
                                                </Typography>
                                                <Typography className={classes.messageBoxMeta}>
                                                    {
                                                        replyToContext.loading
                                                            ? 'Loading replied-to message...'
                                                            : (replyToContext.message
                                                                ? `${formatMessageDate(normalizeDateValue(replyToContext.message))} • ${personNameFromAccessList(replyToContext.message.sent_from || 'Unknown sender')}`
                                                                : (replyToContext.errorText || 'Original message not found in this thread.'))
                                                    }
                                                </Typography>
                                                {!replyToContext.loading && !!replyToContext.message && (
                                                    <Typography
                                                        className={classes.messageBoxBody}
                                                        style={replyToBodyHeightStyle}
                                                    >
                                                        {getMessageText(replyToContext.message, {
                                                            signatureKey: getSignatureKeyForPerson(replyToContext.message.sent_from)
                                                        }) || '[No message text available]'}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                        <Box className={classes.messageBox}>
                                            <Typography className={classes.messageBoxLabel}>
                                                {'This Message'}
                                            </Typography>
                                            <Typography className={classes.messageBoxMeta}>
                                                {`${formatMessageDate(normalizeDateValue(selectedMessage))} • ${personNameFromAccessList(selectedMessage.sent_from || 'Unknown sender')} → ${selectedReceiverText}`}
                                            </Typography>
                                            <Typography
                                                className={classes.messageBoxBody}
                                                style={thisMessageBodyHeightStyle}
                                            >
                                                {getMessageText(selectedMessage, {
                                                    signatureKey: getSignatureKeyForPerson(selectedMessage?.sent_from)
                                                }) || '[No message text available]'}
                                            </Typography>
                                        </Box>

                                        <Typography variant='body2' style={{ ...AVATextStyle({ size: 0.95, bold: true }), flexShrink: 0 }}>
                                            {'Recipients'}
                                        </Typography>
                                        {hasUnresolvedHoldRecipients && (
                                            <Box className={classes.detailHoldActions}>
                                                <Button
                                                    size='small'
                                                    color='primary'
                                                    variant='outlined'
                                                    startIcon={<LockOpenIcon fontSize='small' />}
                                                    disabled={holdActionBusy}
                                                    onClick={() => {
                                                        requestReleaseHeldRecipients(unresolvedHoldRecipientSummaries);
                                                    }}
                                                >
                                                    {'Release Hold'}
                                                </Button>
                                            </Box>
                                        )}
                                        <Box className={classes.recipientScrollArea}>
                                            {recipientSummaries.map((recipientSummary) => {
                                                const recipientKey = String(recipientSummary.recipientId || '').trim().toLowerCase();
                                                const hasAutoCcFlag = Array.isArray(recipientSummary?.flagLabels) && recipientSummary.flagLabels.includes('Auto CC');
                                                const autoCcForwardName = String(autoCcForwardNameByRecipientId[recipientKey] || '').trim();
                                                return (
                                                    <Box key={`${recipientSummary.recipientId}`} className={classes.recipientRow}>
                                                        <Box className={classes.recipientHeader}>
                                                            <Typography
                                                                variant='body2'
                                                                className={classes.recipientName}
                                                                style={{ cursor: recipientSummary.recipientId ? 'pointer' : 'default' }}
                                                                onClick={() => {
                                                                    const recipientId = String(recipientSummary.recipientId || '').trim();
                                                                    if (!recipientId) {
                                                                        return;
                                                                    }
                                                                    setSelectedMessage(null);
                                                                    setSelectedRecipientPersonId(recipientId);
                                                                }}
                                                                onContextMenu={(event) => {
                                                                    event.preventDefault();
                                                                    const compositeKeyList = Array.isArray(recipientSummary.compositeKeys)
                                                                        ? recipientSummary.compositeKeys.filter(Boolean)
                                                                        : [];
                                                                    window.alert(
                                                                        compositeKeyList.length > 0
                                                                            ? compositeKeyList.join('\n')
                                                                            : 'No composite_key available for this recipient delivery.'
                                                                    );
                                                                }}
                                                            >
                                                                {recipientSummary.recipientName}
                                                            </Typography>
                                                            <Box className={classes.recipientResultText}>
                                                                {((recipientSummary.resultDisplayList || []).length > 0
                                                                    ? recipientSummary.resultDisplayList
                                                                    : [{ text: recipientSummary.resultText || sentenceCase(normalizeStatus(selectedMessage)), replyText: '' }]
                                                                ).map((resultItem, resultIndex) => (
                                                                    <React.Fragment key={`${recipientSummary.recipientId}_result_${resultIndex}`}>
                                                                        <Typography
                                                                            variant='body2'
                                                                            color='textSecondary'
                                                                            className={classes.recipientResultLine}
                                                                        >
                                                                            {resultItem.text}
                                                                        </Typography>
                                                                        {resultItem.replyText && (
                                                                            <Typography
                                                                                variant='body2'
                                                                                color='textSecondary'
                                                                                className={classes.recipientReplyLine}
                                                                                title={resultItem.replyText}
                                                                            >
                                                                                {`"${resultItem.replyText}"`}
                                                                            </Typography>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))}
                                                                {hasAutoCcFlag && !!autoCcForwardName && (
                                                                    <Typography
                                                                        variant='body2'
                                                                        color='textSecondary'
                                                                        className={classes.recipientResultLine}
                                                                    >
                                                                        {`Per preferences, also sent to ${autoCcForwardName}`}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                        <Box className={classes.recipientFooterRow}>
                                                            <Box className={classes.flagRow}>
                                                                {recipientSummary.flagLabels.map((pillLabel) => (
                                                                    <Button
                                                                        key={`${recipientSummary.recipientId}_${pillLabel}`}
                                                                        size='small'
                                                                        variant='outlined'
                                                                        disableRipple
                                                                        disableFocusRipple
                                                                        onClick={(event) => {
                                                                            event.preventDefault();
                                                                            if (pillLabel !== 'Attachment') {
                                                                                return;
                                                                            }
                                                                            const attachmentUrl = String(recipientSummary.attachmentUrl || '').trim();
                                                                            if (!attachmentUrl) {
                                                                                return;
                                                                            }
                                                                            window.open(attachmentUrl, '_blank', 'noopener,noreferrer');
                                                                        }}
                                                                        style={{ cursor: ((pillLabel === 'Attachment') && !!recipientSummary.attachmentUrl) ? 'pointer' : 'default' }}
                                                                        title={((pillLabel === 'Attachment') && !!recipientSummary.attachmentUrl) ? recipientSummary.attachmentUrl : ''}
                                                                        className={`${classes.flagPill} ${getFlagPillVariantClass(pillLabel, classes)}`}
                                                                    >
                                                                        {pillLabel}
                                                                    </Button>
                                                                ))}
                                                            </Box>
                                                            {recipientSummary.isUnresolvedHold && (
                                                                <Box className={classes.recipientActionButtons}>
                                                                    <IconButton
                                                                        size='small'
                                                                        className={classes.recipientActionButton}
                                                                        title='Release held message for this recipient'
                                                                        disabled={holdActionBusy}
                                                                        onClick={() => {
                                                                            requestReleaseHeldRecipients([recipientSummary]);
                                                                        }}
                                                                    >
                                                                        <LockOpenIcon fontSize='small' />
                                                                    </IconButton>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                        <Divider />
                                                    </Box>
                                                );
                                            })}
                                            {recipientSummaries.length === 0 && (
                                                <Typography variant='body2' className={classes.muted}>
                                                    {'No recipient details available.'}
                                                </Typography>
                                            )}
                                        </Box>
                                    </React.Fragment>
                                );
                            })()}
                        </Box>
                        <Box className={classes.detailDialogFooter}>
                            <Box style={{ display: 'flex', gap: 8 }}>
                                <Button
                                    className={AVAClass.AVAButton}
                                    size='small'
                                    variant='outlined'
                                    startIcon={<ForwardIcon fontSize='small' />}
                                    onClick={() => {
                                        handleForwardMessage();
                                    }}
                                >
                                    {'Forward'}
                                </Button>
                                {(() => {
                                    const myId = String(myPatientId || '').trim().toLowerCase();
                                    if (!myId) { return null; }
                                    const senderId = String(selectedMessage?.sent_from || '').trim().toLowerCase();
                                    const delivItems = Array.isArray(selectedMessage.delivery_items) ? selectedMessage.delivery_items : [selectedMessage];
                                    const receivers = getUniqueReceiversFromDeliveries(delivItems).map(r => r.toLowerCase());
                                    const iAmSender = senderId === myId;
                                    const iAmReceiver = receivers.includes(myId);
                                    if (!iAmSender && !iAmReceiver) { return null; }
                                    const buttonLabel = iAmReceiver ? 'Reply' : 'Follow-up';
                                    return (
                                        <Button
                                            className={AVAClass.AVAButton}
                                            size='small'
                                            variant='outlined'
                                            onClick={() => { handleReplyMessage(); }}
                                        >
                                            {buttonLabel}
                                        </Button>
                                    );
                                })()}
                            </Box>
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
                    </DialogContent>
                </Dialog>
            )}

            {selectedRecipientPersonId && (
                <MessageForm
                    pPerson={selectedRecipientPersonId}
                    pClient={state.session.client_id}
                    pMessageList={[]}
                    pSession={state.session}
                    onReset={() => {
                        setSelectedRecipientPersonId('');
                    }}
                    options={{
                        viewOnly: true
                    }}
                />
            )}

            {!!releaseConfirmContext && (
                <AVAConfirm
                    promptText={releaseConfirmContext.promptText}
                    onCancel={() => {
                        setReleaseConfirmContext(null);
                    }}
                    onConfirm={async () => {
                        const recipientSummaryList = releaseConfirmContext?.recipientSummaryList || [];
                        setReleaseConfirmContext(null);
                        await handleReleaseHeldRecipients(recipientSummaryList);
                    }}
                />
            )}

            {!!forwardMessageOptions && (
                <MessageForm
                    pPerson={state?.session?.user_id || state?.session?.patient_id || ''}
                    pClient={state.session.client_id}
                    pMessageList={[]}
                    pSession={state.session}
                    onReset={() => {
                        setForwardMessageOptions(null);
                    }}
                    options={forwardMessageOptions}
                />
            )}

            {!!replyMessageOptions && (
                <MessageForm
                    pPerson={state?.session?.user_id || state?.session?.patient_id || ''}
                    pClient={state.session.client_id}
                    pMessageList={[]}
                    pSession={state.session}
                    onReset={() => {
                        setReplyMessageOptions(null);
                    }}
                    options={replyMessageOptions}
                />
            )}
        </Dialog>
    );
}
