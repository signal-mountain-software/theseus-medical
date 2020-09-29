import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import SaveIcon from '@material-ui/icons/Save';

import DynamicForm from '../forms/DynamicForm';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

export default ({ fact, session, open, onClose, onSave }) => {
  const [newFact, setNewFact] = React.useState(null);
  const [disable, setDisable] = React.useState(false);
  const classes = useStyles();

  const handleSave = () => {
    onSave(newFact);
  };

  const disableSave = value => {
    setDisable(value);
  };

  React.useEffect(() => {
    if (fact && session) {
      setNewFact({
        patient_id: session.patient_id || session.user_id,
        activity_key: fact.code,
        value: null,
        session: {
          user_id: session.user_id,
          session_id: session.session_id,
        },
      });
    }
  }, [fact, session]);

  return (
    <Dialog open={open} onClose={onClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            Adding New Fact - {fact?.name}
          </Typography>
        </Toolbar>
      </AppBar>
      {fact ? (
        <Box p={3} display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <Typography variant='subtitle1'>Most Recent Observation: {fact.most_recent_observation}</Typography>
          <Box my={1} />
          <DynamicForm
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            values={fact.valid_values_list}
            defaultValue={fact.default_value}
            observationKey={fact.observation_key}
            onError={disableSave}
          />
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
        <Button color='secondary' variant='contained' endIcon={<CloseIcon />} onClick={onClose}>
          Cancel
        </Button>
        <Box mr={2} />
        <Button color='primary' variant='contained' startIcon={<SaveIcon />} onClick={handleSave} disabled={disable}>
          Save
        </Button>
      </Box>
    </Dialog>
  );
};
