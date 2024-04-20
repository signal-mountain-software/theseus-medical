import React from 'react';
import { useSnackbar } from 'notistack';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';
import ListItem from '@material-ui/core/ListItem';
import Slide from '@material-ui/core/Slide';

import AVATextInput from '../forms/AVATextInput';

import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';

import TextField from '@material-ui/core/TextField';

import Paper from '@material-ui/core/Paper';
import { cl, isObject } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import { getImage, makeName } from '../../util/AVAPeople';

import useSession from '../../hooks/useSession';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';


const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  freeInput: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 1.8,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  firstName: {
    marginLeft: theme.spacing(1),
    fontSize: '0.8rem',
  },
  lastName: {
    fontWeight: 'bold',
  },
  groupName: {
    fontWeight: 'bold',
    color: 'red'
  },
  orSeparator: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontSize: theme.typography.fontSize * 0.8,
  },
  idText: {
    paddingTop: 6,
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(1)
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ open, last_selected, priority_list, onClose }) => {

  const { state } = useSession();
  const { accessList } = state;
  const { enqueueSnackbar } = useSnackbar();

  const [person_filter, setPersonFilter] = React.useState('');
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [rowLimit, setRowLimit] = React.useState(20);

  const selectedClient = state.session.client_id;

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const handleClose = () => {
    onClose(reactData.last_selected_person);
  };

  const [reactData, setReactData] = React.useState({
    screen_mode: 'select',
    selected_person: null,
    selection_list: buildSelectionList()
  });
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  function buildSelectionList() {
    let inList = [];
    if (last_selected) {
      inList.push(...last_selected);
    }
    if (priority_list) {
      inList.push(...priority_list);
    }
    if (accessList) {
      inList.push(...accessList[selectedClient].list);
    }
    let finalList = [];
    let existingIDs = [];
    for (let w = 0; w < inList.length; w++) {
      let this_row = inList[w];
      if (typeof (this_row) === 'string') {
        this_row = accessList[selectedClient].list.find(r => {
          return (r.person_id === this_row);
        });
      }
      else if ((!this_row.hasOwnProperty.location) && accessList) {
        let a_row = accessList[selectedClient].list.find(r => {
          return (r.person_id === (this_row.id || this_row.person_id));
        });
        if (a_row.groups.some(r => {
          return (state.session.inactiveGroupList.includes(r));
        })) {
          continue;
        }
        this_row.location = a_row.location;
      }
      if (!existingIDs.includes(this_row.id)) {
        existingIDs.push(this_row.id);
        finalList.push({
          id: this_row.id,
          location: this_row.location,
          name: this_row.displayName || (`${this_row.first} ${this_row.last}`.trim()) || (`${this_row?.name.first} ${this_row?.name.last}`.trim()) || this_row.id || this_row.person_id
        });
      }
    };
    return finalList;
  }

  const subMenuHead = React.useRef(null);

  const scrollValue = 20;
  var rowsWritten;
  let filterTimeOut;

  const onScroll = event => {
    let newLimit = rowLimit + scrollValue;
    setRowLimit(newLimit);
  };

  const handleChangePersonFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (!vCheck) {
        setPersonFilter(null);
      }
      else {
        let filterInput = vCheck.trim();
        setPersonFilter(filterInput.toLowerCase());
      }
      setForceRedisplay(!forceRedisplay);
    }, 500);
    return;
  };

  async function onSelect(newClient, newPatient) {
    updateReactData({
      last_selected_person: [newPatient],
      screen_mode: 'checkIn',
      selected_person: newPatient,
      statusObj: await getCurrentStatus(newClient, newPatient, 'staff')
    }, true);
  };

  async function getCurrentStatus(client_id, personRec, mode) {
    let person;
    if (isObject(personRec)) {
      person = personRec.person_id || personRec.id;
    }
    else {
      person = personRec;
    }
    let reqArray = await getServiceRequests({ client_id, person_id: person, foreign_key: mode, request_type: "checkout" });
    if (reqArray.length === 0) {
      let now = new Date().getTime();
      return {
        last_status: 'none',
        last_update: 0,
        history: [],
        last_visited_name: await makeName(state.patient.person_id),
        reqRec: {
          client_id,
          "request_id": `${personRec.person_id}_checkout`,
          "requestor": personRec.person_id,
          "on_behalf_of": `${personRec.first} ${personRec.last}`,
          "request_type": 'checkout',
          "request_date": now,
          "original_request": {},
          "history": [],
          "local_key": `${personRec.person_id}_checkout`,
          "foreign_key": mode,
          "last_update": now,
          "type_date": `checkout~${now}`,
          "last_status": 'none',
        }
      };
    }
    else {
      let returnObj = {
        last_update: reqArray[0].last_update,
        last_visited: reqArray[0].last_visited,
        history: reqArray[0].history,
        reqRec: reqArray[0]
      };
      if ((reqArray[0].last_visited && (reqArray[0].last_status === 'in'))) {
        returnObj.last_status = 'in';
        returnObj.last_visited_name = (reqArray[0].last_visited ? await makeName(reqArray[0].last_visited) : '');
      }
      else {
        returnObj.last_status = 'out';
        returnObj.last_visited_name = await makeName(state.patient.person_id);
      }
      return returnObj;
    }
  }

  function makeGreeting(pName) {
    if (state.session?.custom_greeting) { return `${state.session.custom_greeting}${pName ? ', ' + pName : ''}!`; }
    else { return `Good ${makeDate(new Date()).dayPart}${pName ? ', ' + pName : ''}!`; }
  }

  function okToShow(pLine) {
    if (!pLine) { return false; }
    if (pLine.access === 'none') { return false; }
    if (pLine.access === 'view') { return false; }
    if (!person_filter) { return true; }
    return Object.values(pLine).toString().toLowerCase().includes(person_filter);
  };

  React.useEffect(() => {
    if (subMenuHead && subMenuHead.current) {
      subMenuHead.current.scrollIntoView({
        behavior: 'instant',
        block: 'start',
      });
    }
  }, [selectedClient]);

  return (
    <Dialog open={open || forceRedisplay}
      onScroll={onScroll}
      p={2}
      height={250}
      fullWidth
      variant={'elevation'}
      elevation={2}
      TransitionComponent={Transition}
      onClose={handleClose}>
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {`Where are you checking in to?`}
      </DialogContentText>
      <TextField
        id='Type a few letters to filter the list'
        onChange={event => (handleChangePersonFilter(event.target.value))}
        className={classes.freeInput}
        autoComplete='off'
        variant="standard"
      />
      <Typography variant='h5' className={classes.orSeparator}>
        {`You may filter the list below`}
      </Typography>
      <Paper p={2} component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
        {accessList && (selectedClient !== '*none') &&
          <React.Fragment>
            <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
              {rowsWritten = 0}
            </Typography>
            {reactData.selection_list.map((listEntry, x) => (
              ((rowsWritten <= rowLimit) && okToShow(listEntry) &&
                <ListItem
                  key={'person-list_' + x}
                  onClick={async () => {
                    await onSelect(selectedClient, listEntry);
                  }}
                  button
                  ref={(rowsWritten === 0) ? subMenuHead : null}
                  onContextMenu={async (e) => {
                    e.preventDefault();
                    enqueueSnackbar(<div>
                      ID: {listEntry.id}<br />
                      Grp(s): {listEntry.groups}<br />
                      </div>,
                      { variant: 'info', persist: true });
                  }}
                >
                  <Box height={50} key={'name_box_' + x} display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsWritten++}
                    </Typography>
                    <Box
                      key={'person_image_' + x}
                      component="img"
                      border={1}
                      mr={1}
                      minHeight={50}
                      maxHeight={100}
                      minWidth={50}
                      maxWidth={50}
                      alt=''
                      src={getImage(listEntry.id)}
                    />
                    <Box key={'name_line_' + x} display='flex' flexWrap='wrap' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                      <Typography variant='h5' className={classes.lastName}>{listEntry.location}</Typography>
                      <Typography variant='h5' className={classes.firstName}>{listEntry.name}</Typography>
                    </Box>
                  </Box>
                </ListItem>
              )))}
            {(rowsWritten === 0) &&
              <Box key={'empty_line'} display='flex' flexWrap='wrap' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                <Typography variant='h5' className={classes.firstName}>{'No selections available'}</Typography>
              </Box>
            }
          </React.Fragment>
        }
        {!accessList &&
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
            <Typography style={AVATextStyle({ bold: true, margin: { left: 1 } })}>
              {'AVA is still loading'}
            </Typography>
            <Typography style={AVATextStyle({ size: 0.8, margin: { top: 0.5, left: 1 } })}>
              {'Please try again in a moment.'}
            </Typography>
          </Box>
        }
      </Paper>
      { /* **********************************
               We are checking in/out
             ********************************** */
        reactData.screen_mode === 'checkIn'
        &&
        (['in'].includes(reactData.statusObj.last_status) ?
          <AVATextInput
            titleText={[
              makeGreeting(reactData.selected_person.first),
              `[italic]You've been checked in with ${reactData.statusObj.last_visited_name} since ${makeDate(reactData.statusObj.last_update).relative}`,
              ' ',
              `Tap "Confirm" to check out`
            ]}
            promptText={[]}  // prompts go here (if any)
            buttonText={['Confirm', 'Back']}
            onCancel={() => {
              updateReactData({
                screen_mode: 'select'
              }, true);
            }}
            onSave={async (responses) => {
              let now = makeDate(new Date());
              reactData.statusObj.reqRec.last_status = 'out';
              reactData.statusObj.reqRec.last_update = now.timestamp;
              reactData.statusObj.reqRec.type_date = `${reactData.statusObj.reqRec.request_type}~${now.timestamp}`;
              let hNote = `Checked out on ${now.absolute}`;
              /*  if we have other data to capture ("did you complete your task?", "issues to note", etc.)
                  those notes would be captured in prompts and be saved here
              responses.forEach((r, x) => {
                if (r && reactData.residentPrompts) {
                  hNote += ` ${reactData.residentPrompts[x]}: ${r}.`;
                }
              });
              */
              reactData.statusObj.reqRec.history.unshift(hNote);
              await updateServiceRequest(reactData.statusObj.reqRec);
              //    enqueueSnackbar(`Check-out successful!`, { variant: 'success', persist: false });
              handleClose();
            }}
            allowCancel={true}
            options={{ save_on_enter: true }}
          />
          :
          <AVATextInput
            titleText={[
              makeGreeting(state.session.patient_display_name),
              `[italic]You are checking in to ${reactData.selected_person.location} (${reactData.selected_person.name})`,
              ' ',
              `Tap "Confirm" to check in`
            ]}
            promptText={[]}  // prompts go here (if any)
            buttonText={['Confirm', 'Back']}
            onCancel={() => {
              updateReactData({
                screen_mode: 'select'
              }, true);
            }}
            onSave={async () => {
              let now = makeDate(new Date());
              reactData.statusObj.reqRec.last_status = 'in';
              reactData.statusObj.reqRec.last_update = now.timestamp;
              reactData.statusObj.reqRec.type_date = `${reactData.statusObj.reqRec.request_type}~${now.timestamp}`;
              let hNote = `Checked in on ${now.absolute} to visit ${reactData.statusObj.last_visited_name}`;
              reactData.statusObj.reqRec.history.unshift(hNote);
              reactData.statusObj.reqRec.last_visited = state.patient.person_id;
              await updateServiceRequest(reactData.statusObj.reqRec);
              handleClose();
            }}
            allowCancel={true}
          />
        )
      }
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            handleClose();
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Exit'}
        </Button>
      </DialogActions>
    </Dialog >
  );
};
