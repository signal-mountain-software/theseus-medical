import React from 'react';
import { lambda } from '../../util/AVAUtilities';

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

import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloseIcon from '@material-ui/icons/ExitToApp';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import CircularProgress from '@material-ui/core/CircularProgress';

import AVATextInput from '../forms/AVATextInput';

const useStyles = makeStyles(theme => ({
  page: {
    height: 800,
  },
  formControl: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingTop: 3,
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
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
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small'
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // backgroundColor: theme.palette.primary[theme.palette.type],
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // backgroundColor: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // backgroundColor: theme.palette.info[theme.palette.type],
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
  greenButton: {
    variant: 'outlined',
    backgroundColor: 'green',
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
  listItemAVALight: {
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'light'
  },
  listItemAVABold: {
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  rightEdgeSmall: {
    fontSize: theme.typography.fontSize * 0.8,
    justifyContent: 'right',
    textTransform: 'capitalize'
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

export default ({ pSession, isMobile, groupsManagedObject, onCancel, onSelect, onRefresh }) => {
  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');
  const [promptForName, setPromptForName] = React.useState(false);

  const classes = useStyles();

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
    setLowerFilter(event.target.value.toLowerCase());
  };

  function OKtoShow(inObj) { 
    return (
      inObj.toLowerCase().includes(lower_activity_filter) ||
      groupsManagedObject[inObj].group_id.toLowerCase().includes(lower_activity_filter)
    );
  }

  const handleCreateAGroup = async pGroupName => {
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: ''
    };

    params.Payload = JSON.stringify({
      action: "create_new_group",
      clientId: pSession.client_id,
      request: {
        "person_id": pSession.patient_id,
        "group_name": pGroupName
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log(err);
      });
    onRefresh();
  };

  // **************************

  return (
    <Dialog
      open={true}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      {Object.keys(groupsManagedObject).length === 0
        ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Typography className={classes.formControl} variant='h5' >
            {'Building the Group List'}
          </Typography>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </div>
        </Box>
        :
        <React.Fragment>
          <DialogContentText
            className={classes.title}
            id='scroll-dialog-title'
          >
            {'Select a group from this list'}
          </DialogContentText>
          <TextField
            id='List Filter'
            value={activity_filter}
            onChange={handleChangeActivityFilter}
            className={classes.freeInput}
            label={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
            variant={'standard'}
            autoComplete='off'
          />
          <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
            <List component='nav'>
              {Object.keys(groupsManagedObject).map((listEntry, x) => (
                (OKtoShow(listEntry) &&
                    <ListItem
                      key={'activity-list_' + listEntry}
                      onClick={() => {
                        onSelect(listEntry);
                      }}
                      button
                    >
                      <Box display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
                        <Typography className=
                          {groupsManagedObject[listEntry].role === 'member' ? classes.listItemAVA :
                            (groupsManagedObject[listEntry].role === 'non-member' ? classes.listItemAVALight :
                              classes.listItemAVABold)}>
                          {listEntry}
                        </Typography>
                        <Typography className={classes.rightEdgeSmall}>
                          {groupsManagedObject[listEntry].role}
                        </Typography>
                      </Box>
                    </ListItem>
                )
              ))
              }
              {promptForName &&
                <AVATextInput
                  promptText="Enter a Name for the Group you're creating"
                  buttonText='Create'
                  onCancel={() => { setPromptForName(false); }}
                  onSave={(newGroupName) => {
                    setPromptForName(false);
                    handleCreateAGroup(newGroupName);
                  }}
                />
              }
            </List>
          </Paper>
        </React.Fragment>
      }
        <DialogActions className={classes.buttonArea} >
          <Button
            className={classes.rowButtonRed}
            onClick={() => {
              onCancel();
            }}
            startIcon={<CloseIcon fontSize="small" />}
          >
            {'Done'}
          </Button>
          {Object.keys(groupsManagedObject).length > 0 &&
            <Button
              onClick={() => {
                setPromptForName(true);
              }}
              className={classes.rowButtonGreen}
              startIcon={<GroupAddIcon fontSize="small" />}
            >
              {`Create ${!isMobile ? 'New Group' : ''}`}
            </Button>
          }
        </DialogActions>
    </Dialog>
  );
};
