import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { getActivityData } from '../../graphql/queries';
import Section from '../Section';

const useStyles = makeStyles({
  container: {
    maxHeight: 400,
  },
});

export default ({ patient, session, newFact }) => {
  const [facts, setFacts] = React.useState([]);
  const isTablet = useMediaQuery(theme => theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let result;
      if (patient && session) {
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: { client_id: session.client_id, person_id: patient.person_id, fact_data: true, history_only: true },
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching facts: ${error.message}`, {
            variant: 'error',
          });
        });

        if (mounted) {
          setFacts(result.data.getActivityData);
        } else {
          API.cancel(result, 'FactSection unmounted, cancel getActivityData');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [patient, session, newFact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Section title='Facts'>
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
    </Section>
  );
};
