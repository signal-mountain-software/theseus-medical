import React from 'react';

import useSession from '../../hooks/useSession';

import { deepCopy, isMobile } from '../../util/AVAUtilities';
import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/Close';
import { Box, Button, TextField, Typography, Dialog, Paper, DialogContentText, DialogActions } from '@material-ui/core/';

const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    padding: '16px',
    height: '450px'
  }
}));

export default ({ reactData, updateReactData, onClose, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    async function initialize() {
      if (!reactData.accessList) {
        if (!state.accessList) {
          if (isMounted.current) {
            onClose();
          }
        }
        else {
          updateReactData(
            {
              selections: [],
              accessList: deepCopy(state.accessList[state.session.client_id].list)
            },
            true
          );
        }
      }
      else {
        updateReactData(
          {
            selections: [],
          },
          true
        );
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const OKtoShow = (this_person) => {
    return (
      (((reactData.selections.length > 0) && (reactData.selections.some(s => { return s.person_id === this_person.person_id; })))
        ||
      ((reactData.linkedPersonFilter?.raw?.length > 1)
        && (`${this_person.last} ${this_person.first}`).toLowerCase().includes(reactData.linkedPersonFilter.lower)))
    );
  };

  return (
    <Dialog open={true || reactData.accessList}
      p={2}
      height={250}
      classes={{ paper: classes.clientPopUp }}
      fullWidth
      variant={'elevation'}
      elevation={2}
      onClose={() => { onClose(); }}
    >
      <DialogContentText
        id='scroll-dialog-title'
        style={AVATextStyle({
          size: 1.4,
          bold: true,
          margin: { left: 0.5, top: 1 }
        })}
      >
        {`Quick Search`}
      </DialogContentText>
      <TextField
        style={isMobile ? AVATextStyle({ width: '90%', margin: { left: 0.5 } }) : AVATextStyle({ margin: { left: 1 } })}
        key={`key_words`}
        defaultValue={reactData.linkedPersonFilter.raw || ''}
        onChange={(event) => {
          if (event.target.value.length === 0) {
            updateReactData({
              linkedPersonFilter: {
                raw: '',
                lower: ''
              }
            }, true);
          }
          else {
            updateReactData({
              linkedPersonFilter: {
                raw: event.target.value.trim(),
                lower: event.target.value.trim().toLowerCase()
              }
            }, true);
          }
        }}
        autoComplete='off'
        helperText='Name Search'
      />
      <Paper p={2} component={Box} elevation={0}
        width='100%' height={250} overflow='auto' square
      >
        {reactData.accessList &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            {reactData.accessList.map((this_item, tIndex) => (
              OKtoShow(this_item) &&
              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                key={`select_person_opt${tIndex}`}
                style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', textWrapStyle: 'balance' }}
                onClick={() => {
                  if (options.pickAndGo) {
                    reactData.selections.unshift({
                      person_id: this_item.person_id,
                      person_name: (`${this_item.first.trim()} ${this_item.last.trim()}`).trim()
                    })
                    updateReactData({
                      selections: reactData.selections
                    }, true)
                  }
                  else {
                    updateReactData({
                      showProfileEdit_id: this_item.person_id
                    }, true);
                  }
                }}
              >
                <Typography
                    style={AVATextStyle({ bold: (reactData.selections.some(s => { return s.person_id === this_item.person_id; }))})}
                >
                  {`${this_item.first} ${this_item.last}`}
                </Typography>
              </Box>
            )
            )}
          </Box>
        }
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            onClose(reactData.selections);
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Exit'}
        </Button>
      </DialogActions>
      {reactData.showProfileEdit_id &&
        <PeopleMaintenance
          person_id={reactData.showProfileEdit_id}
          options={{ mode: 'view' }}
          onClose={(updatedPerson) => {
            updateReactData({
              showProfileEdit_id: false
            }, true);
          }}
        />
      }
    </Dialog >
  );






};