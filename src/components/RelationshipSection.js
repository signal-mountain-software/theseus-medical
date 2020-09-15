import React from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles({
  container: {
    maxHeight: 400,
  },
});

export default ({ patient }) => {
  const classes = useStyles();

  return (
    <Paper component={Box} m={2} variant='outlined'>
      <Box mt={1} py={1.25} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='subtitle1'>Relationships</Typography>
        </Box>
      </Box>
      <Box p={3} flexGrow={1}>
        <TableContainer className={classes.container} component={Paper}>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            {patient?.relationships ? (
              <TableBody>
                {patient.relationships.map(relationship => (
                  <TableRow key={relationship.person_id}>
                    <TableCell>{relationship.name}</TableCell>
                    <TableCell>{relationship.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ) : null}
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
};
