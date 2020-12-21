import React from 'react';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import FaceIcon from '@material-ui/icons/Face';

import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import TextField from '@material-ui/core/TextField';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
    minWidth: '100%',
  },
  subHeader: {
    fontWeight: 'bold',
    minWidth: '100%',
  },
  defaultButton: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
    variant: 'outlined',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.6,
    height: theme.typography.fontSize * 1.8,
  },
  valueLine: {
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 0,
    lineHeight: 1,
    minWidth: '100%',
    height: theme.typography.fontSize * 25,
  },
  qualTitle: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    paddingBottom: 0,
    paddingTop: 0,
    paddingLeft: 0,
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  qualDescription: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginTop: 0,
    paddingTop: 0,
    paddingLeft: 0,
    fontSize: '0.8rem',
    lineHeight: 1,
  },
  qualLine: {
    marginLeft: 15,
    marginTop: 0,
    paddingTop: 2,
    lineHeight: 1,
    fontSize: theme.typography.fontSize * 0.8,
  },
  picture: {
    marginTop: theme.spacing(3),
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
}));

export default ({
  qualifierOpen,
  setQualifierOpen,
  qualifiedFact,
  qualifierData,
  qualifierImage,
  currentQualifier,
  setNewFact,
  newFact,
}) => {
  const [freeText, setFreeText] = React.useState('');
  const [qualMessage, setQualMessage] = React.useState('');

  const [OGqualifiers, setOGQualifiers] = React.useState([]);
  const [qualsChecked, setqualsChecked] = React.useState([]);

  if ((OGqualifiers.length = 0 && currentQualifier.length > 0)) {
    setOGQualifiers(currentQualifier);
    setqualsChecked(currentQualifier);
  }

  const classes = useStyles();

  const handleToggle = value => () => {
    const currentIndex = qualsChecked.indexOf(value);
    const newqualsChecked = [...qualsChecked];

    if (currentIndex === -1) {
      newqualsChecked.push(value); /* wasn't checkd?  check it! */
    } else {
      newqualsChecked.splice(currentIndex, 1); /* already checked?  remove it! */
    }
    setqualsChecked(newqualsChecked);
    if (newqualsChecked.length === 0) {
      setQualMessage('');
    } else {
      setQualMessage(`\n\rOptions selected: ${newqualsChecked.join(' ~ ')}`);
    }
    newFact.value = newqualsChecked;
    setNewFact(newFact);
  };

  const handleQSave = () => {
    newFact.value.qualifiers[qualifiedFact] = qualsChecked;
    setNewFact(newFact);
    setOGQualifiers('');
    setQualifierOpen(false);
  };

  const handleQClose = event => {
    setOGQualifiers('');
    setQualifierOpen(false);
  };

  const onChangeFreeText = event => {
    setFreeText(event.target.value);
  };

  return (
    <Dialog open={qualifierOpen} onClose={handleQClose} aria-labelledby='form-dialog-title'>
      <Box display='flex' flexDirection='row' width='95%'>
        <Box display='flex' flexDirection='column' width='95%'>
          <DialogTitle pb={0} className={classes.qualTitle} id='form-dialog-title'>
            {qualifierData.value}
          </DialogTitle>
          {qualifierData.description ? (
            <DialogContentText className={classes.qualDescription}>
              {qualifierData.description + qualMessage}
            </DialogContentText>
          ) : null}
        </Box>
        {qualifierData.image_url ? (
          <Avatar src={qualifierImage} className={classes.picture}>
            <FaceIcon className={classes.picture} />
          </Avatar>
        ) : null}
      </Box>
      {/*          
      <List className={classes.valueLine}>
        {qualifierData.qualifiers
          ? qualifierData.qualifiers.map(value => {
              const labelId = `qualifier-list-label-${value}`;
              return value.startsWith('~~') ? (
                <ListItem key={value} role={undefined} className={classes.defaultButton} dense>
                  <ListItemText
                    id={'subhead' + value}
                    classes={{ primary: classes.subHeader }}
                    primary={value.substr(2)}
                  />
                </ListItem>
              ) : (
                <ListItem
                  key={value}
                  role={undefined}
                  dense
                  button
                  className={classes.defaultButton}
                  onClick={handleToggle(value)}>
                  <React.Fragment key={`fragment-${value}`}>
                    <Checkbox
                      edge='start'
                      qualsChecked={qualsChecked.indexOf(value) !== -1}
                      disableRipple
                      inputProps={{ 'aria-labelledby': labelId }}
                    />
                                      {value !== '~other~' ? (       
                    <ListItemText id={labelId} primary={<Typography noWrap={true}>{value}</Typography>} />
                    }                   ) : (
                      <TextField
                        value={freeText}
                        label={labelId}
                        onChange={onChangeFreeText}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
 )}  
                  </React.Fragment>
                </ListItem>
              );
            })
          : null}
      </List>
        */}
      <DialogActions>
        <Button onClick={handleQClose} color='inherit' size='small' variant='contained'>
          Back
        </Button>
        <Button onClick={handleQSave} className={classes.confirm} variant='contained' color='primary' size='small'>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
