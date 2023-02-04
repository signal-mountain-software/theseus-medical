import React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import EditIcon from '@material-ui/icons/Edit';
import SendIcon from '@material-ui/icons/Send';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';


import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import { getPerson, makeDate } from '../../util/AVAUtilities';
import { updateServiceRequest } from '../../util/AVAServiceRequest';
import MakeMessage from '../forms/MakeMessage';
import AVATextInput from '../forms/AVATextInput';

const requestNames = {
  maint: 'Maintenance Request',
  meal: 'Meal Order',
  guest_room: 'Guest Room Reservation Request',
  trans: 'Transportation Request',
  breakfast: 'Breakfast Order'
};

const useStyles = makeStyles(theme => ({
  typeLine: {
    fontSize: theme.typography.fontSize * 1.5,
    flexGrow: 0,
    marginBottom: 0,
    fontWeight: 'bold'
  },
  textLine: {
    fontSize: theme.typography.fontSize * 1,
    flexGrow: 0,
    marginBottom: 0
  },
  statusLine: {
    fontSize: theme.typography.fontSize * 0.8,
    flexGrow: 0,
    marginBottom: 0
  },
  headerLine: {
    marginTop: theme.spacing(3.5),
    marginBottom: theme.spacing(1.0),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
    paddingRight: 50,
  },
  descText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(3),
    marginBottom: 10,
    marginTop: 0,
    paddingLeft: 0,
    paddingRight: 50,
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  profileArea: {
    alignItems: 'center'
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  drowhead: {
    display: 'flex',
    marginTop: 10,
    fontSize: theme.typography.fontSize * 1.0,
    width: '100%',
    justifyContent: 'center',
    fontWeight: 'bold'
  },
  drowdetail: {
    fontSize: theme.typography.fontSize * 0.8,
    justifyContent: 'flex-start',
  },
  drowqual: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 10,
    justifyContent: 'flex-start',
  },
  qualText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 10,
    paddingLeft: 0,
    paddingRight: 50,
    fontWeight: 'bold'
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  freeInput: {
    marginLeft: 20,
    paddingLeft: 0,
    paddingRight: 0,
    flexGrow: 2,
    fontSize: theme.typography.fontSize * 1.3,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  inputRow: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  listItem: {
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  page: {
    height: 950,
  },
  qualOption: {
    marginTop: 0,
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 0.8
  },
  qualItem: {
    marginTop: 0,
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 0.8
  },
  title: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.2
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  }
}));

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default ({ session, filter = {}, defaultValue, seedData, onClose }) => {

  /* 
    filter: {
      person_id - only show this person
      request_type - (optional) only show requests of this type
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
  */

  const classes = useStyles();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);

  const [checkedToSave, setCheckedToSave] = React.useState();

  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [dataRows, setDataRows] = React.useState(seedData);

  const [promptForMessage, setPromptForMessage] = React.useState(false);
  const [promptForUpdate, setPromptForUpdate] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  //**  Initialize

  //**  Functions

  function toggleCheck(pI) {
    dataRows[pI].workData.checked = !dataRows[pI].workData.checked;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function toggleOpen(pI) {
    dataRows[pI].workData.open = !dataRows[pI].workData.open;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function createMessageText() {
    let mData = {};
    let mCount = 0;
    let pM = '';
    dataRows.forEach(r => {
      if (r.workData.checked) {
        if (!(r.request_type in mData)) { mData[r.request_type] = []; }
        mData[r.request_type].push(r.workData.display_date);
        mCount++;
      }
    });
    if (mCount === 0) { return null; }
    if (mCount > 1) { pM += ` ${mCount} prior requests:`; }
    let linkWord = '';
    for (let t in mData) {
      let mL = mData[t].length - 1;
      pM += `${linkWord} ${requestNames[t] || 'request'}`;
      if (mL > 0) { pM += 's'; }
      pM += ' from';
      for (let x = 0; x <= mL; x++) {
        if (mData[t][x].startsWith('Last ')) { pM += ` last ${mData[t][x].slice(5)}`; }
        else { pM += ` ${mData[t][x]}`; }
        if ((mL > 1) && (x < mL)) { pM += ','; }
        if ((x + 1) === (mL)) { pM += ' and'; }
      };
      linkWord = ', and';
    }
    return pM.trim();
  }

  async function handleUpdates([newStatus, checked, newNote]) {
    let historyLine = '';
    if (newStatus) { historyLine += `Status changed to "${newStatus}"`; }
    else if (checked === 'checked') { historyLine += 'Status changed to "Complete"'; }
    if (newNote) {
      if (historyLine) { historyLine += ' and '; }
      historyLine += `Note that said "${newNote.trim()}" added`;
    }
    let thisPerson = await getPerson(session.patient_id, 'name');
    historyLine += ` by ${thisPerson}`;
    if (session.patient_id !== session.user_id) { historyLine += ` (proxy=${session.user_id})`; }
    let AVAdate = makeDate(new Date());
    historyLine += ` on ${AVAdate.absolute}`;
    let updateRows = [];
    dataRows.forEach(r => {
      if (r.workData.checked) {
        if (newStatus && (newStatus !== '')) { r.last_status = newStatus; }
        else if (checked === 'checked') { r.last_status = 'Complete'; }
        r.last_update = AVAdate.timestamp;
        r.workData.update_date = AVAdate.relative;
        if (newNote) { r.last_note = newNote; }
        if (('history' in r) && Array.isArray(r.history)) {
          r.history.shift(historyLine);
        }
        else { r.history = [historyLine]; }
        updateRows.push(r);
      }
    });
    updateServiceRequest(updateRows.map(u => {
      let w = Object.assign({}, u);
      delete w.workData;
      return w;
    }));
    setDataRows(dataRows.sort((a, b) => {
      if (a.last_update > b.last_update) { return -1; }
      if (a.last_update < b.last_update) { return 1; }
    }));
    setForceRedisplay(!forceRedisplay);
  }

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {/* Header with Title and Popup Menu */}
      <Box
        display='flex' flexDirection='row'
        className={classes.messageArea}
        key={'topBox'}
      >
        <Box display='flex' flexDirection='column' key={'titlesection'}>
          <Typography
            className={classes.title}
          >
            {`Requests for ${session.patient_display_name}`}
          </Typography>
        </Box>
        <Box
          paddingRight={2}
          marginTop={1}
          aria-controls='hidden-menu'
          aria-haspopup='true'
          onClick={(event) => {
            handleClick(event);
            setPopupMenuOpen(true);
          }}>
          <Avatar src={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'} />
        </Box>
        <Menu
          id='hidden-menu'
          anchorEl={anchorEl}
          open={popupMenuOpen}
          onClose={() => { setPopupMenuOpen(false); }}
          keepMounted>
          <MenuList className={classes.popUpMenu}>
            <MenuItem
              onClick={() => {
                onClose();
              }}>
              <Box
                display='flex' flexDirection='row' alignItems={'center'}
                key={'vRowHome'}
              >
                <HomeIcon />
                <Typography className={classes.popUpMenuRow} >{'Go to AVA Menu'}</Typography>
              </Box>
            </MenuItem>
            <MenuItem
              onClick={() => {
                let jumpTo = window.location.origin;
                window.location.replace(jumpTo);
              }}>
              <Box
                display='flex' flexDirection='row' alignItems={'center'}
                key={'vRowRefresh'}
              >
                <AutorenewIcon />
                <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
              </Box>
            </MenuItem>
            <MenuItem>
              <Box
                display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                key={'vRowRefresh'}
              >
                <Typography className={classes.popUpFooter} >{`AVA vers 23.2.6${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              </Box>
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
      {dataRows &&
        <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
          <List  >
            {dataRows.map((this_item, this_index) => (
              <Box
                display='flex'
                flexDirection='row'
                key={'row' + this_index}
                className={classes.listItem}
                justifyContent='flex-start'
                padding={this_item.workData.open ? 2 : 0}
                border={this_item.workData.open ? 1 : 0}
                alignItems='center'
              >
                <Checkbox
                  edge='start'
                  checked={this_item.workData.checked}
                  disableRipple
                  key={'checkbox' + this_index}
                  onClick={() => { toggleCheck(this_index); }}
                />
                <Box
                  display='flex'
                  flexDirection='row'
                  flexGrow={1}
                  key={'h2row' + this_index}
                  className={classes.inputRow}
                  justifyContent='space-between'
                  alignItems='center'
                  onClick={() => { toggleOpen(this_index); }}
                >
                  <Box
                    display='flex'
                    flexDirection='column'
                    key={'hcol' + this_index}
                    className={classes.inputRow}
                    justifyContent='flex-start'
                    alignItems='start'
                  >
                    {!filter.request_type &&
                      <Typography className={classes.typeLine}>{this_item.workData.formatted_type}</Typography>
                    }
                    {this_item.workData.update_date ?
                      <Typography className={classes.textLine}>{`Updated ${this_item.workData.update_date} (Sent ${this_item.workData.display_date})`}</Typography>
                      :
                      <Typography className={classes.textLine}>{`Sent ${this_item.workData.display_date}`}</Typography>
                    }
                    <Typography className={classes.textLine}>{this_item.last_status}</Typography>
                    {this_item.workData.open &&
                      <React.Fragment>
                        <Typography className={classes.drowhead}>Details</Typography>
                        {this_item.workData.formatted_request.map(dRow => (
                          <Typography className={(`drow${dRow[0]}` in classes) ? classes[`drow${dRow[0]}`] : classes.drowdetail}>{dRow[1]}</Typography>
                        ))}
                      </React.Fragment>
                    }
                  </Box>
                  {(this_item.workData.open) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </Box>
            ))}
          </List>
        </Paper>
      }
      { /* Prompts */}
      {promptForMessage &&
        <MakeMessage
          titleText={'Follow-up'}
          promptText={`What should your message say?`}
          buttonText={'Send'}
          sender={{
            "client_id": session.client_id,
            "patient_id": session.patient_id,
            "patient_display_name": session.patient_display_name
          }}
          pRecipientID={'*select'}
          pRecipientName={''}
          onCancel={() => { setPromptForMessage(false); }}
          onComplete={() => { setPromptForMessage(false); }}
          setMethod={null}
          allowCancel={true}
          seedText={promptForMessage}
        />
      }
      {promptForUpdate &&
        <AVATextInput
          titleText={createMessageText()}
          promptText={['New Status', '[checkbox]Mark as Complete?', 'Notes']}
          buttonText='Update'
          onCancel={() => { setPromptForUpdate(false); }}
          onSave={async (requestUpdates) => {
            setPromptForUpdate(false);
            await handleUpdates(requestUpdates);
          }}
        />
      }
      { /* Command Area */}
      {
        <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
          <Box display='flex' flexDirection='column'>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
              <Button
                className={classes.rowButtonDefault}
                onClick={() => {
                  onClose();
                }}
                startIcon={<CloseIcon size="small" />}
              >
                {'Exit'}
              </Button>
              <Button
                className={classes.rowButtonDefault}
                onClick={() => {
                  setPromptForUpdate(true);
                }}
                startIcon={<EditIcon size="small" />}
              >
                {'Update Status'}
              </Button>
              {(filter.person_id || session.patient_id) &&
                <Button
                  className={classes.rowButtonDefault}
                  onClick={() => {
                    setPromptForMessage('With regard to ' + createMessageText() + ': ');
                  }}
                  startIcon={<SendIcon size="small" />}
                >
                  {'Send Follow-up'}
                </Button>
              }
              {(false) &&
                <Button
                  className={classes.rowButtonDefault}
                  onClick={() => {
                  }}
                  startIcon={<CheckIcon size="small" />}
                >
                  {'Confirm/Send'}
                </Button>
              }
            </Box>
          </Box>
        </DialogActions>
      }
    </Dialog >
  );
};
