import React from 'react';
import { Box, Button, TextField, Tooltip, Typography } from '@material-ui/core';
import { Alert, Autocomplete } from '@material-ui/lab';
import { cl, dbClient } from '../../util/AVAUtilities';

export function parseMenuFunctionCall({ accountClass, target, paramsText }) {
  if (accountClass !== 'master') {
    throw new Error('Only master accounts can create Function menu items.');
  }
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error('Please provide a target for the Function menu item.');
  }
  let params;
  try {
    params = JSON.parse(paramsText);
  } catch (error) {
    if (!(error instanceof SyntaxError)) { throw error; }
    throw new Error(`Params must be valid JSON. ${error.message}`);
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Params must be a JSON object, such as {} or {"options": {}}.');
  }
  return { target: target.trim(), params };
}

export default function MenuFunctionFields({ client_id, target, paramsText, onChange, disabled = false }) {
  const [sources, setSources] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  const [selectedSource, setSelectedSource] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    setSources([]);
    setSelectedSource(null);
    setLoading(true);
    setError('');
    (async () => {
      try {
        if (!client_id) { throw new Error('Unable to load Function menu items without a client.'); }
        const items = [];
        let lastKey;
        do {
          const response = await dbClient.query({
            TableName: 'MenuV3',
            KeyConditionExpression: 'client_id = :client',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: { '#type': 'menu_itemType' },
            ExpressionAttributeValues: { ':client': client_id, ':type': 'function' },
            ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
          }).promise();
          if (cancelled) { return; }
          items.push(...(response.Items || []).filter(item => item.client_id === client_id && item.menu_itemType === 'function'));
          lastKey = response.LastEvaluatedKey;
        } while (lastKey);
        items.sort((a, b) => (a.description?.short || a.menu_id).localeCompare(b.description?.short || b.menu_id));
        setSources(items);
      } catch (loadError) {
        cl({ 'Error loading Function menu items': loadError });
        if (!cancelled) { setError('Unable to load Function menu items to copy. You can retry or enter the target and params manually.'); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [client_id, retry]);

  return (
    <Box mt={2}>
      <Autocomplete
        options={sources}
        value={selectedSource}
        loading={loading}
        disabled={disabled}
        getOptionLabel={item => `${item.description?.short || item.menu_id} (${item.menu_id})`}
        getOptionSelected={(a, b) => a.menu_id === b.menu_id}
        noOptionsText={loading ? 'Loading Function menu items...' : 'No Function menu items found for this client'}
        onChange={(event, item) => {
          setSelectedSource(item);
          if (item) {
            onChange({ target: item.call?.target || '', paramsText: JSON.stringify(item.call?.params ?? {}, null, 2) });
          }
        }}
        renderInput={params => <TextField {...params} label='Copy function from' margin='dense' helperText='Copies only target and params. Hover over an entry to preview; title, color, and access stay unchanged.' />}
        renderOption={item => (
          <Tooltip
            title={<Box style={{ maxWidth: '500px' }}>
              <Typography variant='caption'>{`Target: ${item.call?.target || '(missing)'}`}</Typography>
              <pre style={{ margin: 0, maxHeight: '300px', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(item.call?.params ?? {}, null, 2)}
              </pre>
            </Box>}
            interactive
          >
            <Box width='100%'>{`${item.description?.short || item.menu_id} (${item.menu_id})`}</Box>
          </Tooltip>
        )}
      />
      {error && <Alert severity='error' action={<Button disabled={disabled} onClick={() => setRetry(value => value + 1)}>{'Retry'}</Button>}>{error}</Alert>}
      <TextField
        fullWidth margin='dense' id='menu-function-target' label='Function target' value={target} disabled={disabled}
        onChange={event => onChange({ target: event.target.value })}
        helperText='Exact target name, for example ShowGroup or FormFillB.'
      />
      <TextField
        fullWidth margin='dense' id='menu-function-params' label='Function params (JSON)' value={paramsText} disabled={disabled}
        multiline minRows={10} variant='outlined'
        inputProps={{ spellCheck: false, style: { fontFamily: 'monospace' } }}
        onChange={event => onChange({ paramsText: event.target.value })}
        helperText='Enter a JSON object containing any options, defaults, request, or other params. Use {} for no params. Tokens such as <sessionRec> are preserved as strings.'
      />
    </Box>
  );
}
