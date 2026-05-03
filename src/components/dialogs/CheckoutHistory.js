import React, { useState, useEffect, useRef } from 'react';

import Typography from '@material-ui/core/Typography';
import { Box, Button, CircularProgress } from '@material-ui/core';

import { dbClient } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { AVATextStyle } from '../../util/AVAStyles';

const PAGE_SIZE = 20;

export default ({ currentValues }) => {

  const [records, setRecords] = useState([]);
  const [lastKey, setLastKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const isMounted = useRef(true);

  const person_id = currentValues.peopleRec.person_id;

  async function loadCheckouts(startKey = null) {
    if (!person_id) return;
    setLoading(true);
    let qQ = {
      TableName: 'ServiceRequests',
      IndexName: 'pertains_to-type_date-index',
      KeyConditionExpression: 'pertains_to = :p and begins_with(type_date, :prefix)',
      ExpressionAttributeValues: {
        ':p': person_id,
        ':prefix': 'checkout'
      },
      ScanIndexForward: false,
      Limit: PAGE_SIZE
    };
    if (startKey) {
      qQ.ExclusiveStartKey = startKey;
    }
    let qR = await dbClient
      .query(qQ)
      .promise()
      .catch(error => {
        console.log({ 'Error reading checkout history': error });
      });
    if (!isMounted.current) { return; }
    if (qR && qR.Items) {
      setRecords(prev => startKey ? [...prev, ...qR.Items] : qR.Items);
      setLastKey(qR.LastEvaluatedKey || null);
    }
    setLoading(false);
    setInitialLoadDone(true);
  }

  useEffect(() => {
    isMounted.current = true;
    setRecords([]);
    setLastKey(null);
    setInitialLoadDone(false);
    loadCheckouts();
    return () => { isMounted.current = false; };
  }, [person_id]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      key={`CheckoutHistory_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {currentValues.peopleRec.checkout_status &&
        <Typography
          style={AVATextStyle({
            size: 1.3,
            bold: true,
            align: 'center',
            margin: { bottom: 1.5, top: 1 }
          })}
        >
          {`Currently checked ${currentValues.peopleRec.checkout_status}`}
        </Typography>
      }
      {initialLoadDone && records.length > 0 &&
        <Typography
          style={AVATextStyle({
            size: 1,
            bold: true,
            align: 'center',
            margin: { bottom: 1 }
          })}
        >
          {'Recent Activity'}
        </Typography>
      }
      {records.map((rec, i) => (
        <Box key={`checkout_rec_${i}`}
          display='flex' flexDirection='row'
          flexWrap='noWrap'
          marginTop={0.5}
          marginBottom={0.5}
          alignItems='flex-start'
          justifyContent='space-between'
        >
          <Box display='flex' flexDirection='column' flexGrow={1}>
            <Typography style={AVATextStyle({ size: 0.9, bold: true })}>
              {rec.request_date ? makeDate(rec.request_date).oaDate : ''}
            </Typography>
            {rec.last_note &&
              <Typography style={AVATextStyle({ size: 0.85 })}>
                {rec.last_note}
              </Typography>
            }
          </Box>
        </Box>
      ))}
      {loading &&
        <Box display='flex' justifyContent='center' mt={1}>
          <CircularProgress size={24} />
        </Box>
      }
      {initialLoadDone && records.length === 0 && !loading &&
        <Typography style={AVATextStyle({ size: 1, align: 'center' })}>
          {'No checkout history found'}
        </Typography>
      }
      {lastKey && !loading &&
        <Box display='flex' justifyContent='center' mt={2}>
          <Button
            onClick={() => loadCheckouts(lastKey)}
            variant='outlined'
            size='small'
          >
            {'Load More'}
          </Button>
        </Box>
      }
    </Box>
  );
};
