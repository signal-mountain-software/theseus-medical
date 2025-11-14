import React, { useState } from 'react';
import { syncDynamicGroupsForClient } from '../../util/AVAGroups';
import { useSnackbar } from 'notistack';
import { Button, Box } from '@material-ui/core';

/**
 * Component to run syncDynamicGroupsForClient and display results.
 * Usage: Place in an admin/maintenance area. Requires session and groups in state.
 */
export default function DynamicGroupSyncTool({ client_id, dynamicGroups, onClose }) {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSync = async () => {
        if (!client_id || !Array.isArray(dynamicGroups)) {
            enqueueSnackbar('Missing client_id or dynamicGroups', { variant: 'error' });
            return;
        }
        setLoading(true);
        setResult(null);
        try {
            const res = await syncDynamicGroupsForClient(client_id, dynamicGroups, {
                logger: { info: () => { }, error: () => { } },
            });
            setResult(res);
            enqueueSnackbar(`Sync complete: ${res.updated} updated out of ${res.total} people.`, { variant: 'success' });
        } catch (e) {
            enqueueSnackbar('Error during sync: ' + (e.message || e), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 500 }}>
            <h2>Dynamic Group Sync Tool</h2>
            <p>This tool will re-evaluate all people in your client against all dynamic group rules and update their group memberships accordingly.</p>
            <Box display="flex" flexDirection="row" justifyContent="flex-start" alignItems="center" mb={2}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSync}
                    disabled={loading}
                    style={{ marginRight: 16 }}
                >
                    {loading ? 'Syncing...' : 'Run Dynamic Group Sync'}
                </Button>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={onClose}
                    disabled={loading}
                >
                    Exit
                </Button>
            </Box>
            {result && (
                <div style={{ marginTop: 16 }}>
                    <strong>Result:</strong>
                    <div>{result.updated} updated out of {result.total} people.</div>
                </div>
            )}
        </div>
    );
}

