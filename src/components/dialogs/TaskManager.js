import React from 'react';

import { Button, Dialog, DialogActions } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses } from '../../util/AVAStyles';
import TaskManagerSection from '../sections/TaskManagerSection';

const useStyles = makeStyles(() => ({
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    maxWidth: '720px',
    margin: 0,
    maxHeight: '98%',
  },
}));

/**
 * TaskManager
 *
 * Standalone dialog wrapper around TaskManagerSection.
 *
 * Props:
 *   person_id   {string}
 *   client_id   {string}
 *   options     {object}   - optional: { allowCreate, administrative }
 *   onClose     {function}
 */
export default function TaskManager({ person_id, client_id, options = {}, onClose }) {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  return (
    <Dialog
      open
      fullWidth
      PaperProps={{ className: classes.paperPallette }}
      scroll='paper'
    >
      <TaskManagerSection
        person_id={person_id}
        client_id={client_id}
        options={options}
      />
      <DialogActions>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={onClose}
        >
          Exit
        </Button>
      </DialogActions>
    </Dialog>
  );
}