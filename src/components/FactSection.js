import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { getActivityData } from '../graphql/queries';

const useStyles = makeStyles({
  container: {
    maxHeight: 400,
  },
});

export default ({ patient, newFact }) => {
  const [facts, setFacts] = React.useState([]);
  const isTablet = useMediaQuery(theme => theme.breakpoints.down('sm'));
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (patient) {
        let result;
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: { client_id: 'SMSoft', person_id: patient.person_id, fact_data: true, history_only: true },
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching activity data: ${error.message}`, {
            variant: 'error',
          });
        });

        if (mounted) {
          setFacts(result.data.getActivityData);
        } else {
          API.cancel(result, 'FactSection unmounted');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [patient, newFact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper component={Box} m={2}>
      <Box mt={1} py={1.25} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='subtitle1'>Facts</Typography>
        </Box>
      </Box>
      <Box p={3} flexGrow={1}>
        <TableContainer className={classes.container} component={Paper}>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                {isTablet ? null : (
                  <>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                  </>
                )}
                <TableCell>Observation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {facts.map(fact => (
                <TableRow key={fact.code}>
                  <TableCell>{fact.name}</TableCell>
                  {isTablet ? null : (
                    <>
                      <TableCell>{fact.type}</TableCell>
                      <TableCell>{fact.observation_status}</TableCell>
                    </>
                  )}
                  <TableCell>{fact.most_recent_observation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
};
