import React from 'react';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';
import ListItem from '@material-ui/core/ListItem';
import Slide from '@material-ui/core/Slide';
import { useSnackbar } from 'notistack';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Paper from '@material-ui/core/Paper';
import { getImage } from '../../util/AVAPeople';
import { getCustomizations } from '../../util/AVAUtilities';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
    overflowX: 'hidden'
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
  listRow: {
    marginTop: theme.spacing(1),
    marginLeft: 0,
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  listRowIndent: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(4),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  listRowBottom: {
    marginTop: theme.spacing(1),
    marginLeft: 0,
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontSize: '1.3rem',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  groupName: {
    fontWeight: 'bold',
    color: 'red'
  }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ selectionList, onCancel, onSelect }) => {

  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const [reactData, setReactData] = React.useState({
    moduleState: 'start'
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(!forceRedisplay);
    }
  };

  const classes = useStyles();
  const AVAClass = AVAclasses();

  async function initialLoad() {
    let clientList = [];
    let clientObj = {};
    let choosePeople = false;
    for (let s = 0; s < selectionList.length; s++) {
      let this_selection = selectionList[s];
      if (!clientList.includes(this_selection.client_id)) {
        clientList.push(this_selection.client_id);
        let cRec = await getCustomizations('*all', this_selection.client_id);
        clientObj[this_selection.client_id] = {
          client_name: cRec.client_name,
          client_logo: cRec.logo,
          peopleRecs: []
        };
      }
      if (clientObj[this_selection.client_id].peopleRecs.push({
        person_id: this_selection.person_id,
        display_name: (this_selection.name ? (`${this_selection.name.first} ${this_selection.name.last}`).trim() : (this_selection.display_name || this_selection.person_id))
      }) > 1) {
        choosePeople = true;
      };
    }
    if (choosePeople) {
      clientList.forEach(this_client => {
        if (clientObj[this_client].peopleRecs.length > 1) {
          clientObj[this_client].peopleRecs.sort((a, b) => {
            return ((a.display_name > b.display_name) ? 1 : -1);
          });
        }
      });
    };
    updateReactData({
      clientObj,
      choosePeople,
      chooseClient: (clientList.length > 1)
    }, false);
  };

  React.useEffect(() => {
    async function initialize() {
      updateReactData({ moduleState: 'initializing' }, false);
      await initialLoad();
      updateReactData({ moduleState: 'ready' }, true);
    }
    initialize();
  }, [selectionList]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    (reactData.moduleState === 'ready') &&
    <Dialog
      open={forceRedisplay || true}
      p={2}
      height={250}
      fullWidth
      variant={'elevation'}
      elevation={2}
      TransitionComponent={Transition}
      onClose={() => { onCancel(); }}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {`Select from these choices`}
      </DialogContentText>
        <Paper
          className={classes.formControl}
          p={2}
          component={Box}
          variant='outlined'
          width='100%'
          maxHeight={256}
          overflow='auto'
          square
        >
        {Object.keys(reactData.clientObj).map((this_client_id) => (
          <React.Fragment>
            {reactData.chooseClient &&
              <ListItem
                key={this_client_id}
                className={reactData.choosePeople ? classes.listRowBottom : classes.listRow}
                onClick={() => {
                  if (reactData.choosePeople) { }
                  else {
                    closeSnackbar();
                    enqueueSnackbar(
                      `Logging you in to ${reactData.clientObj[this_client_id].client_name}`,
                      { variant: 'success' }
                    );
                    onSelect({
                      person_id: reactData.clientObj[this_client_id].peopleRecs[0].person_id,
                      client_id: this_client_id
                    });
                  }
                }}
              >
                <Box display='flex' height={50} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                  <Box
                    component="img"
                    mr={1}
                    minWidth={50}
                    maxWidth={50}
                    alt=''
                    src={reactData.clientObj[this_client_id].client_logo}
                  />
                  <Typography variant='h5' className={classes.lastName}>
                    {reactData.clientObj[this_client_id].client_name}
                  </Typography>
                </Box>
              </ListItem>
            }
            {reactData.choosePeople &&
              reactData.clientObj[this_client_id].peopleRecs.map((this_person, pX) => (
                <ListItem
                  key={this_person}
                  className={reactData.chooseClient ? classes.listRowIndent : classes.listRow}
                  onClick={() => {
                    closeSnackbar();
                    enqueueSnackbar(
                      `Logging you in as ${this_person.display_name}${reactData.chooseClient ? (' to ' + reactData.clientObj[this_client_id].client_name) : ''}`,
                      { variant: 'success' }
                    );
                    onSelect({
                      person_id: this_person.person_id,
                      client_id: this_client_id
                    });
                  }}
                >
                  <Box display='flex' height={50} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                    <Box
                      key={`person_image_${pX}`}
                      component="img"
                      border={1}
                      mr={1}
                      minHeight={50}
                      maxHeight={50}
                      minWidth={50}
                      maxWidth={50}
                      alt=''
                      src={getImage(this_person.person_id)}
                    />
                    <Typography variant='h5' className={classes.lastName}>
                      {this_person.display_name}
                    </Typography>
                  </Box>
                </ListItem>
              ))
            }
          </React.Fragment>
        ))}
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={() => {
            onCancel();
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Back'}
        </Button>
      </DialogActions>
    </Dialog >
  );
};
