import React from 'react';
import { Box, Typography, CircularProgress } from '@material-ui/core';
import { AVATextStyle } from '../../util/AVAStyles';
import { dbClient } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import useSession from '../../hooks/useSession';

export default ({ reactData }) => {
    const { state } = useSession();
    const [loading, setLoading] = React.useState(true);
    const [activityList, setActivityList] = React.useState([]);
    const [showOlder, setShowOlder] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        const loadActivities = async () => {
            const clientId = state.session.client_id;
            const personId = reactData.person_id;

            // Fetch all slot records for this person via the slot_owner-index GSI
            let slotRecs = [];
            let lastKey;
            do {
                const response = await dbClient
                    .query({
                        TableName: 'Calendar',
                        IndexName: 'slot_owner-index',
                        KeyConditionExpression: 'client = :c AND slot_owner = :s',
                        ExpressionAttributeValues: { ':c': clientId, ':s': personId },
                        ...(lastKey ? { ExclusiveStartKey: lastKey } : {})
                    })
                    .promise()
                    .catch(err => { console.log('ActivitiesSection: error fetching slots', err); return null; });
                if (!response) { break; }
                slotRecs = slotRecs.concat(response.Items || []);
                lastKey = response.LastEvaluatedKey;
            } while (lastKey);

            // Drop slots where the person cancelled (status = 'released' with no subsequent owner)
            const validSlots = slotRecs.filter(rec =>
                rec?.slotData?.status?.current !== 'released'
            );

            // Collect unique event base keys (<event_id>#<occurrence_date>) and fetch descriptions
            const eventDescMap = {};
            const toFetch = new Set();
            for (const rec of validSlots) {
                const parts = (rec.event_key || '').split('#');
                if (parts.length >= 1) {
                    toFetch.add(parts[0]);
                }
            }

            await Promise.all([...toFetch].map(async (eventId) => {
                const result = await dbClient
                    .get({
                        Key: { client: clientId, event_key: eventId },
                        TableName: 'Calendar'
                    })
                    .promise()
                    .catch(err => { console.log('ActivitiesSection: error fetching event', eventId, err); return null; });
                const rec = result?.Item;
                eventDescMap[eventId] =
                    rec?.eventData?.event_data?.description ||
                    rec?.eventData?.description ||
                    rec?.occData?.description ||
                    rec?.description ||
                    '';
            }));

            // Build display list
            const displayList = validSlots.map(rec => {
                const parts = (rec.event_key || '').split('#');
                const dateStr = parts.length >= 2 ? parts[1] : '';
                const eventId = parts[0];
                return {
                    dateStr,
                    description: eventDescMap[eventId] || '',
                    attended: !!rec.marked,
                };
            });

            // Sort ascending by date string (yyyymmdd lexicographic order works correctly)
            displayList.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

            if (!cancelled) {
                setActivityList(displayList);
                setLoading(false);
            }
        };

        loadActivities();
        return () => { cancelled = true; };
    }, [reactData.person_id, state.session.client_id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <Box display='flex' justifyContent='center' p={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (activityList.length === 0) {
        return (
            <Box px={2} py={4}>
                <Typography style={AVATextStyle({ size: 1.2, align: 'center' })}>
                    {'No activities found'}
                </Typography>
            </Box>
        );
    }

    const todayStr = makeDate(new Date()).numeric$;
    const twoMonthsAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 2);
        return makeDate(d).numeric$;
    })();

    const olderEvents = activityList.filter(item => item.dateStr < twoMonthsAgo);
    const pastEvents = activityList.filter(item => item.dateStr >= twoMonthsAgo && item.dateStr < todayStr);
    const futureEvents = activityList.filter(item => item.dateStr >= todayStr);

    const renderRow = (item, i) => (
        <Box
            key={`activity_${i}`}
            ml={2}
            py={1}
            style={{ borderBottom: '1px solid #e0e0e0' }}
        >
            <Typography style={AVATextStyle({ size: 1.1, bold: true })}>
                {item.description}
            </Typography>
            <Typography style={AVATextStyle({ size: 0.9, opacity: 0.7 })}>
                {`${item.dateStr ? makeDate(item.dateStr).absolute : ''}${item.attended ? '  ·  Attended' : ''}`}
            </Typography>
        </Box>
    );

    const SectionHeader = ({ label }) => (
        <Box mt={2} mb={0.5} ml={2}>
            <Typography style={AVATextStyle({ size: 0.8, bold: true, opacity: 0.5 })}>
                {label.toUpperCase()}
            </Typography>
        </Box>
    );

    return (
        <Box py={2} display='flex' flexDirection='column'>
            {olderEvents.length > 0 &&
                <Box
                    ml={2} mb={1}
                    display='inline-flex'
                    alignSelf='flex-start'
                    onClick={() => setShowOlder(prev => !prev)}
                    style={{
                        cursor: 'pointer',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '16px',
                        padding: '4px 12px',
                        marginTop: '16px',
                    }}
                >
                    <Typography style={AVATextStyle({ size: 0.85, bold: true })}>
                        {showOlder ? 'Hide older events' : `Show ${olderEvents.length} older event${olderEvents.length === 1 ? '' : 's'}`}
                    </Typography>
                </Box>
            }
            {showOlder && olderEvents.map((item, i) => renderRow(item, `older_${i}`))}
            {pastEvents.length > 0 && <SectionHeader label='Past Events' />}
            {pastEvents.map((item, i) => renderRow(item, `past_${i}`))}
            {futureEvents.length > 0 && <SectionHeader label='Future Events' />}
            {futureEvents.map((item, i) => renderRow(item, `future_${i}`))}
        </Box>
    );
};
