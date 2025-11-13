import React from 'react';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';
import ListItem from '@material-ui/core/ListItem';
import Slide from '@material-ui/core/Slide';

import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';

import TextField from '@material-ui/core/TextField';

import Paper from '@material-ui/core/Paper';
import { switchActiveAccount, cl, array_in_array } from '../../util/AVAUtilities';
import { getImage } from '../../util/AVAPeople';

import useSession from '../../hooks/useSession';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';

import { AVAclasses } from '../../util/AVAStyles';

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
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
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

export default ({ open, roles, onClose }) => {

  const { state } = useSession();
  const { accessList } = state;

  const [person_filter, setPersonFilter] = React.useState('');
  const [client_filter, setClientFilter] = React.useState('');
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [rowLimit, setRowLimit] = React.useState(20);

  let tally = 0;
  let onlyClient;
  Object.keys(accessList).forEach(k => {
    if (okClient({ candidate_id: k, candidate_name: k.name })) {
      tally++;
      onlyClient = k;
    }
  });
  // if (tally === 0) {
  //  onClose();
  // }
  const multiClient = (tally > 1);
  const [selectedClient, setSelectedClient] = React.useState((tally === 1) ? onlyClient : '*none');

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const handleClose = () => {
    onClose();
  };

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
        setClientFilter(null);
      }
      else {
        let filterInput = vCheck.trim();
        if (selectedClient !== '*none') { setPersonFilter(filterInput.toLowerCase()); }
        else { setClientFilter(filterInput.toLowerCase()); }
      }
      setForceRedisplay(!forceRedisplay);
    }, 500);
    return;
  };

  async function onSelect(newClient, newPatient) {
    await switchActiveAccount(state.session, newClient, newPatient);
    onClose();
  };

  function okToShow(pLine) {
    if (!pLine) { return false; }
    if (pLine.access === 'none') { return false; }
    if (pLine.access === 'view') { return false; }
    if (pLine.inactive_account) { return false; }
    if (array_in_array(state?.session?.group_assignments?.inactive, pLine.groups)) { return false; }
    if (!person_filter) { return true; }
    return Object.values(pLine).toString().toLowerCase().includes(person_filter);
  };

  function okClient(cLine) {
    if (!cLine) { return false; }
    // if you are not authorized to access this client, reject it
    if (!accessList[cLine.candidate_id].hasOwnProperty('list') || (accessList[cLine.candidate_id].list.length === 0)) {
      return false;
    }
    // you ARE autohirzed to this client; is it filtered out?
    if (!client_filter) { return true; }
    return Object.values(cLine).toString().toLowerCase().includes(client_filter);
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
    accessList &&
    <Dialog open={open || forceRedisplay}
      onScroll={onScroll}
      p={2}
      height={250}
      classes={{ paper: classes.clientPopUp }}
      fullWidth
      variant={'elevation'}
      elevation={2}
      TransitionComponent={Transition}
      onClose={handleClose}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {`Switch to which ${(selectedClient === '*none') ? 'client' : 'account'}?`}
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
      <Paper p={2} component={Box} variant='outlined'
        width='100%' maxHeight={256} overflow='auto' square
      >
        {(selectedClient === '*none') &&
          <React.Fragment>
            {Object.keys(accessList).map((client, c) => (
              okClient({ candidate_id: client, candidate_name: accessList[client].name }) &&
              <ListItem
                key={`client_master_line_${c}`}
                onClick={() => {
                  setSelectedClient(client);
                  setRowLimit(scrollValue);
                  setForceRedisplay(!forceRedisplay);
                }}
              >
                <Box display='flex' height={50} flexDirection='row' my='16px' justifyContent='flex-start' alignItems='center'>
                  <Box
                    component="img"
                    mr={1}
                    minWidth={50}
                    maxWidth={50}
                    alt=''
                    src={accessList[client].logo}
                  />
                  <Typography variant='h5' className={classes.lastName}>{accessList[client].name}</Typography>
                </Box>
              </ListItem>
            ))}
          </React.Fragment>
        }
        {(selectedClient !== '*none') &&
          <React.Fragment>
            <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
              {rowsWritten = 0}
            </Typography>
            {accessList[selectedClient].list.map((listEntry, x) => (
              ((rowsWritten <= rowLimit) && okToShow(listEntry) &&
                <ListItem
                  key={'person-list_' + x}
                  onClick={async () => {
                    await onSelect(selectedClient, listEntry);
                  }}
                  button
                  ref={(rowsWritten === 0) ? subMenuHead : null}
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
                      <Typography variant='h5' style={{ lineHeight: 0.9 }} className={classes.lastName}>{listEntry.last}</Typography>
                      <Typography variant='h5' style={{ lineHeight: 0.9 }} className={classes.firstName}>{listEntry.first}</Typography>
                      {(x > 0) && (x < (accessList[selectedClient].list.length - 1)) &&
                        ((accessList[selectedClient].list[x - 1].first === listEntry.first)
                          || (accessList[selectedClient].list[x + 1].first === listEntry.first)) &&
                        ((accessList[selectedClient].list[x - 1].last === listEntry.last)
                          || (accessList[selectedClient].list[x + 1].last === listEntry.last)) &&
                        <Typography variant='h5' style={{ paddingTop: '0px' }} className={classes.idText}>({listEntry.id})</Typography>
                      }
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
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            if ((selectedClient === '*none') || (!multiClient)) {
              onClose();
            }
            else {
              setSelectedClient('*none');
              setForceRedisplay(!forceRedisplay);
            }
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {((selectedClient === '*none') || (!multiClient)) ? 'Exit' : 'Back'}
        </Button>
      </DialogActions>
    </Dialog >
  );
};
