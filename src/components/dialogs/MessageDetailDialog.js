import React from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    Typography,
    Button,
    Divider,
} from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import ForwardIcon from '@material-ui/icons/Forward';
import ReplyIcon from '@material-ui/icons/Reply';

import { AVAclasses } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';

const useStyles = makeStyles((theme) => ({
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
        maxWidth: '100%',
        minHeight: '4.6em',
        maxHeight: '10.8em'
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
    flagPillGreenSolid: {
        borderColor: `${theme.palette.success.dark} !important`,
        backgroundColor: `${theme.palette.success.dark} !important`,
        color: `${theme.palette.common.white} !important`
    },
    flagPillOrangeOutline: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.warning.light : theme.palette.warning.dark} !important`,
        color: `${theme.palette.type === 'dark' ? theme.palette.warning.light : theme.palette.warning.dark} !important`,
        backgroundColor: `${alpha(theme.palette.warning.main, theme.palette.type === 'dark' ? 0.2 : 0.08)} !important`
    },
    flagPillRedOutline: {
        borderColor: `${theme.palette.type === 'dark' ? theme.palette.error.light : theme.palette.error.main} !important`,
        color: `${theme.palette.type === 'dark' ? theme.palette.error.light : theme.palette.error.main} !important`,
        backgroundColor: `${alpha(theme.palette.error.main, theme.palette.type === 'dark' ? 0.22 : 0.08)} !important`
    }
}));

function getFlagPillClass(label, classes) {
    const labelLower = String(label || '').toLowerCase();
    if (labelLower === 'opened') { return classes.flagPillGreenSolid; }
    if (['ava only', 'auto cc', 'carrier ok', 'duplicate', 'machine', 'held', 'redirected'].includes(labelLower)) {
        return classes.flagPillOrangeOutline;
    }
    if (['complaint', 'blocked'].includes(labelLower)) { return classes.flagPillRedOutline; }
    return '';
}

function formatSentTime(sentTime) {
    if (!sentTime) { return 'unknown date'; }
    const asNumber = Number(sentTime);
    if (!Number.isNaN(asNumber) && String(asNumber).length >= 8) {
        return makeDate(asNumber).absolute;
    }
    const asDate = new Date(sentTime);
    if (Number.isNaN(asDate.getTime())) { return String(sentTime); }
    return asDate.toLocaleString();
}

/**
 * MessageDetailDialog — a reusable message detail popup styled like the MessageMonitor detail view.
 *
 * Props:
 *   open          {bool}      — controls dialog visibility
 *   onClose       {function}  — called when the dialog should close
 *   subject       {string}
 *   messageText   {string}    — plain-text body (preferred for display)
 *   authorName    {string}
 *   sentTime      {number|string} — epoch ms or parseable date string
 *   deliveryCount {number}    — if > 1, shows "N delivery records" subtitle
 *   recipients    {Array}     — [{personName, resultLines: string[], flagLabels: string[]}]
 *   onReply       {function|null}  — if provided, shows a Reply button
 *   onForward     {function|null}  — if provided, shows a Forward button
 */
export default function MessageDetailDialog({
    open = false,
    onClose,
    subject = '',
    messageText = '',
    authorName = '',
    sentTime = null,
    deliveryCount = 0,
    recipients = [],
    onReply = null,
    onForward = null,
}) {
    const classes = useStyles();
    const AVAClass = AVAclasses();

    const recipientSummary = (() => {
        const names = recipients.slice(0, 3).map((r) => r.personName).filter(Boolean);
        const overflow = recipients.length - names.length;
        return overflow > 0 ? `${names.join(', ')} +${overflow} more` : names.join(', ');
    })();

    const metaLine = [formatSentTime(sentTime), authorName, recipientSummary ? `→ ${recipientSummary}` : '']
        .filter(Boolean)
        .join(' • ');

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth='md'
            fullWidth
            PaperProps={{
                style: {
                    overflow: 'hidden',
                    borderRadius: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '90vh',
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogContent className={classes.detailDialogContent}>
                <Box className={classes.detailDialogBody}>

                    {/* Subject */}
                    <Typography style={{ fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }}>
                        {subject || '(No Subject)'}
                    </Typography>

                    {/* Delivery count subtitle */}
                    {deliveryCount > 1 && (
                        <Typography variant='body2' color='textSecondary' style={{ flexShrink: 0 }}>
                            {`${deliveryCount} delivery records in this message thread`}
                        </Typography>
                    )}

                    {/* "Message" section header */}
                    <Typography variant='body2' style={{ fontSize: '0.95rem', fontWeight: 700, flexShrink: 0 }}>
                        {'Message'}
                    </Typography>

                    {/* This Message box */}
                    <Box className={classes.messageBox}>
                        <Typography className={classes.messageBoxLabel}>{'This Message'}</Typography>
                        <Typography className={classes.messageBoxMeta}>{metaLine}</Typography>
                        <Typography className={classes.messageBoxBody}>
                            {messageText || '(No message text)'}
                        </Typography>
                    </Box>

                    {/* Recipients section */}
                    {recipients.length > 0 && (
                        <React.Fragment>
                            <Typography variant='body2' style={{ fontSize: '0.95rem', fontWeight: 700, flexShrink: 0 }}>
                                {'Recipients'}
                            </Typography>
                            <Box className={classes.recipientScrollArea}>
                                {recipients.map((recipient, idx) => (
                                    <Box key={`recipient_${idx}`} className={classes.recipientRow}>
                                        <Box className={classes.recipientHeader}>
                                            <Typography variant='body2' className={classes.recipientName}>
                                                {recipient.personName}
                                            </Typography>
                                            {(recipient.resultLines || []).length > 0 && (
                                                <Box className={classes.recipientResultText}>
                                                    {recipient.resultLines.map((line, lineIdx) => (
                                                        <Typography
                                                            key={lineIdx}
                                                            variant='body2'
                                                            color='textSecondary'
                                                            className={classes.recipientResultLine}
                                                        >
                                                            {line}
                                                        </Typography>
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                        {(recipient.flagLabels || []).length > 0 && (
                                            <Box className={classes.flagRow}>
                                                {recipient.flagLabels.map((label) => (
                                                    <Button
                                                        key={label}
                                                        size='small'
                                                        variant='outlined'
                                                        disableRipple
                                                        disableFocusRipple
                                                        className={`${classes.flagPill} ${getFlagPillClass(label, classes)}`}
                                                    >
                                                        {label}
                                                    </Button>
                                                ))}
                                            </Box>
                                        )}
                                        <Divider />
                                    </Box>
                                ))}
                            </Box>
                        </React.Fragment>
                    )}

                </Box>

                {/* Footer */}
                <Box className={classes.detailDialogFooter}>
                    <Box style={{ display: 'flex', gap: 8 }}>
                        {onForward && (
                            <Button
                                className={AVAClass.AVAButton}
                                size='small'
                                variant='outlined'
                                startIcon={<ForwardIcon fontSize='small' />}
                                onClick={onForward}
                            >
                                {'Forward'}
                            </Button>
                        )}
                        {onReply && (
                            <Button
                                className={AVAClass.AVAButton}
                                size='small'
                                variant='outlined'
                                startIcon={<ReplyIcon fontSize='small' />}
                                onClick={onReply}
                            >
                                {'Reply'}
                            </Button>
                        )}
                    </Box>
                    <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'red', color: 'white' }}
                        size='small'
                        onClick={onClose}
                    >
                        {'Close'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
