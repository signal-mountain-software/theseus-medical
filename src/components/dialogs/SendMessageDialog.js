import React from 'react';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';
import DialogContent from '@material-ui/core/DialogContent';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useSession from '../../hooks/useSession';
import PersonFilter from '../forms/PersonFilter';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  freeInput: {
    marginLeft: '25px',
    marginTop: '5px',
    marginRight: 2,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  titleText: {
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },

  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.primary[theme.palette.type],
  },
  resetButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
    marginLeft: 10,
    paddingLeft: 10,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

export default ({ open, multiSelect = false, onClose, onSelect, pReturnValue = 'ID' }) => {
  // returnValue = 'object' returns object with {id: name, id: name, ...}

  const { state } = useSession();
  const { session } = state;
  const [message_targets, setMessageTargets] = React.useState(state.accessList[state.session.client_id].list);
  const [loading, setLoading] = React.useState(true);

  const classes = useStyles();

  if (loading) {
    let response = [];
    state.accessList[state.session.client_id].list.forEach(a => {
        // list is of the form <name>:<id>:<search_string>
        response.push(`${a.last}, ${a.first}:${a.id}:${a.display_name}_${a.location}`);
    });
    setMessageTargets(response);
    setLoading(false);
  }

  /*
  React.useEffect(() => {
    let getTargets = (     // get a list of people a user may send messages to: 
      async () => {
        setLoading(true);
        let targetObj = await prepareTargets(session.patient_id, session.client_id, { includeGroups: true });
        setMessageTargets(targetObj.responsibleList.sort());
        setLoading(false);
      }
    );
    getTargets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  */
  
  const handleClose = () => {
    if (session) {
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      {loading &&
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={2} mr={2} mb={2} mt={8}
          >
            <Box
              component="img"
              mb={2}
              minWidth={150}
              maxWidth={150}
              alt=''
              src={session.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            <React.Fragment>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                flexWrap='wrap' textOverflow='ellipsis' width='100%'
                key={'loadingBox'}
                mb={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Retrieving Names`}</Typography>
                <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              </Box>
              <CircularProgress />
            </React.Fragment>
          </Box>
        </DialogContent>
      }
      {!loading && message_targets &&
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
            <List component='nav'>
              {(message_targets.length > 0) &&
                <PersonFilter
                  prompt={'Who do you want to send a message to?'}
                  peopleList={message_targets}
                  onCancel={() => {
                    onClose();
                  }}
                  onSelect={(selectedPerson) => {
                    open = false;
                    onSelect(selectedPerson);
                  }}
                  allowRandom={true}
                  returnValue={pReturnValue}
                  multiSelect={true}
                />
              }
            </List>
          </Paper>
        </Box>
      }
    </Dialog>
  );
};
