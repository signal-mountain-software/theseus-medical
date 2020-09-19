import React from 'react';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Section from '../Section';

const useStyles = makeStyles({
  container: {
    maxHeight: 400,
  },
});

export default ({ person }) => {
  const classes = useStyles();

  return (
    <Section title='Activity Customizations' outlined>
      <TableContainer className={classes.container} component={Paper}>
        <Table size='small' stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Activity Key</TableCell>
              <TableCell>Baseline</TableCell>
              <TableCell>Permitted Roles</TableCell>
            </TableRow>
          </TableHead>
          {person && person.activity_customizations ? (
            <TableBody>
              {person.activity_customizations.map(activity => (
                <TableRow key={activity.activity_key}>
                  <TableCell>{activity.activity_key}</TableCell>
                  <TableCell>{activity.baseline}</TableCell>
                  <TableCell>{activity.permitted_roles ? activity.permitted_roles.join(', ') : 'none'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : null}
        </Table>
      </TableContainer>
    </Section>
  );
};
