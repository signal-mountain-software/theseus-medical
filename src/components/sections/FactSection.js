import React from 'react';

import AppBar from '@material-ui/core/AppBar';
import AssignmentOutlinedIcon from '@material-ui/icons/AssignmentOutlined';
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

//import Section from '../Section';

const useStyles = makeStyles(theme => ({
  container: {
    maxHeight: 400,
  },
  tableHead: {
    backgroundColor: theme.palette.primary[theme.palette.type],
    borderBottomColor: 'black',
    paddingTop: theme.typography.fontSize * 1.5,
  },
  appBar: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
}));

export default ({ patient, session, newFact }) => {
  // const [facts, setFacts] = React.useState([]);
  const facts = [];
  const isTablet = useMediaQuery(theme => theme.breakpoints.down('sm'));
  const classes = useStyles();

  React.useEffect(() => {
  //  let mounted = true;
    /* removing Fact section (temporary?)    
    (async () => {
      let result;
      if (patient && session) {
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: { client_id: session.client_id, person_id: patient.person_id, fact_data: true, history_only: true },
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching facts: ${error.errors[0].message}`, {
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
*/
    return () => {
//      mounted = false;
    };
  }, [patient, session, newFact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper component={Box} m={2}>
      <AppBar className={classes.appBar}>
        <Box
          px={3}
          display='flex'
          flexGrow={1}
          flexDirection='row'
          mt={1}
          mb={1}
          justifyContent='flex-start'
          alignItems='center'>
          <AssignmentOutlinedIcon />
          <Box flexDirection='row' pl={1} nowrap='true' grow={1} justifyContent='flex-start' alignItems='center'>
            <Typography variant='h6' className={classes.title}>
              Facts
            </Typography>
          </Box>
        </Box>
      </AppBar>
      <TableContainer className={classes.container} component={Paper}>
        <Table size='small' stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={classes.tableHead}>Name</TableCell>
              {isTablet ? null : (
                <>
                  <TableCell className={classes.tableHead}>Type</TableCell>
                  <TableCell className={classes.tableHead}>Status</TableCell>
                </>
              )}
              <TableCell className={classes.tableHead}>Observation</TableCell>
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
    </Paper>
    //</Section>
  );
};
