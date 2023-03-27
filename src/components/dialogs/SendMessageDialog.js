import React from 'react';

import { prepareTargets } from '../../util/AVAGroups';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';

import useSession from '../../hooks/useSession';
import PersonFilter from '../forms/PersonFilter';

export default ({ open, onClose, onSelect }) => {

  const { state } = useSession();
  const { session } = state;
  const [message_targets, setMessageTargets] = React.useState();


  React.useEffect(() => {
    let getTargets = (     // get a list of people a user may send messages to: 
      async () => {
        let targetObj = await prepareTargets(session.patient_id, session.client_id, { includeGroups: true });
        setMessageTargets(targetObj.responsibleList.sort());
      }
    );
    getTargets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (session) {
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      {message_targets &&
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
            <List component='nav'>
              {(message_targets.length > 0) &&
                <PersonFilter
                  prompt={'Send a message to...?'}
                  peopleList={message_targets}
                  onCancel={() => {
                    onClose();
                  }}
                  onSelect={(selectedPerson) => {
                    open = false;
                    onSelect(selectedPerson);
                  }}
                  allowRandom={true}
                />
              }
            </List>
          </Paper>
        </Box>
      }
    </Dialog>
  );
};
