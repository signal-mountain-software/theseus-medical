import React from 'react';

import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/Close';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: '20px',
    paddingBottom: '20px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  reject: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
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
  firstName: {
    marginLeft: theme.spacing(1),
  },
  lastName: {
    fontWeight: 'bold',
  },
  idText: {
    paddingTop: 6,
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(1)
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ prompt, peopleList, onCancel, onSelect, onSignOut }) => {
  const [person_filter, setPersonFilter] = React.useState('');

  const classes = useStyles();

  const handleChangePersonFilter = event => {
    setPersonFilter(event.target.value.toLowerCase());
    if (event.target.value.toLowerCase() === 'sign out') { onSignOut() }
  };

  function goodEntry(pLine, x) {
    if (!pLine) { return x; }
    else { return pLine.toLowerCase().includes(person_filter); }
  }

  function makeFirstName(pName) {
    let [, ans] = pName.split(/[:,]/);
    if (ans.startsWith('group=')) { return ''; }
    else { return ans; }
  }

  // **************************

  return (
    <Dialog
      open={true}
      p={2}
      height={250}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {prompt}
      </DialogContentText>
      <TextField
        id='Type a few letters to filter the list'
        value={person_filter}
        onChange={handleChangePersonFilter}
        className={classes.freeInput}
        label='Type a few letters to filter the list'
        variant={'standard'}
        autoComplete='off'
      />
      <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
        <List component='nav'>
          {peopleList.map((listEntry, x) => (
            (
              goodEntry(listEntry, x) &&
                <ListItem
                  key={'person-list_' + x }
                  onClick={() => {
                    onSelect(listEntry);
                  }}
                  button
                >
                  <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                    <Typography variant='h5' className={classes.lastName}>{listEntry.split(/[:,]/)[0].trim()}</Typography>
                    <Typography variant='h5' className={classes.firstName}>{makeFirstName(listEntry)}</Typography>
                    {(x > 0) && (x < (peopleList.length - 1))
                      && ((peopleList[x - 1].split(':')[0] === listEntry.split(':')[0])
                        || (peopleList[x + 1].split(':')[0] === listEntry.split(':')[0])) &&
                      <Typography variant='h5' className={classes.idText}>({listEntry.split(/[:]/)[1]})</Typography>
                    }
                  </Box>
                </ListItem>
            )
          ))}
        </List>
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={classes.reject}
          onClick={() => {
            onCancel();
          }}
          startIcon={<CloseIcon fontSize="small" />}
        >
          {'Close/Exit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
