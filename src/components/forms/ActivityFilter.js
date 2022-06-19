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

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ activityList, activityObject, onCancel, onSelect }) => {
  const [activity_filter, setActivityFilter] = React.useState('');

  const classes = useStyles();

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
  };

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
        {'Select a menu from this list'}
      </DialogContentText>
      <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
        <TextField
          id='Type a few letters to filter the list'
          value={activity_filter}
          onChange={handleChangeActivityFilter}
          className={classes.freeInput}
          label='Type a few letters to filter the list'
          variant={'standard'}
          autoComplete='off'
        />
        <List component='nav'>
          {activityList && activityList.length > 0 && activityList.map((listEntry, x) => (
            (
              listEntry.toLowerCase().includes(activity_filter.toLowerCase()) ?
                <ListItem
                  key={'activity-list_' + listEntry}
                  onClick={() => {
                    onSelect(listEntry);
                  }}
                  button
                >
                  <Typography className={classes.listItemAVA}>
                    {listEntry}
                  </Typography>
                </ListItem>
                : null
            )
          ))}
        </List>
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={classes.reject}
          size='small'
          variant='contained'
          onClick={() => {
            onCancel();
          }}>
          {'Done'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
