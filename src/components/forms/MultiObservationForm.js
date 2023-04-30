import React from 'react';

import { makeName, getImage } from '../../util/AVAPeople';
import { listFromArray } from '../../util/AVAUtilities';
import { putServiceRequest } from '../../util/AVAServiceRequest';
import AVATextInput from '../forms/AVATextInput';

import makeStyles from '@material-ui/core/styles/makeStyles';
import Tooltip from '@material-ui/core/Tooltip';

import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import EditIcon from '@material-ui/icons/Edit';
import NotesIcon from '@material-ui/icons/Notes';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import Radio from '@material-ui/core/Radio';

import AVAConfirm from './AVAConfirm';

const useStyles = makeStyles(theme => ({
  textLine: {
    fontSize: theme.typography.fontSize * 1.3,
    flexGrow: 0,
    lineHeight: 1.0,
    marginRight: '7px'
  },
  smallTextLine: {
    fontSize: theme.typography.fontSize * 1.0,
    flexGrow: 0,
    lineHeight: 1.25,
    whiteSpace: 'break-spaces'
  },
  headerLine: {
    marginTop: theme.spacing(3.0),
    marginBottom: theme.spacing(1.0),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  headerLineSticky: {
    marginTop: theme.spacing(1.0),
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
    marginRight: theme.spacing(1)
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
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  listItem: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  hiddenItem: {
    display: 'none',
    visibility: 'hidden'
  },
  listTopRow: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    width: 'max-content'
  },
  listItemSticky: {
    marginLeft: theme.spacing(1),
    marginRight: 0,
    position: 'sticky',
    background: 'lightgray',
    top: 0,
    opacity: 1,
    zIndex: 1,
    width: 'max-content'
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

export default ({ fact, factName, defaultValue, prompt, pClient, qualifiers, listValues, onSave, onClose }) => {

  const classes = useStyles();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);

  const [promptForText, setPromptForText] = React.useState([]);

  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [dataRows, setDataRows] = React.useState();

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [maxName, setMaxName] = React.useState(1);

  const factType = fact.activity_key.split('.')[0];

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  /* value                       | meaning                                  | example                                                   */
  /* ---------                   | ----------                               | -------------                                             */

  /* headers...
  /* ~~<displayThis>             | section header                           | ~~Entree Choices                                          */

  /* check boxes...
  /* <textOnly>                  | selection/check box                      | Filet Mignon                                              */

  /* instructions...
  /* ~[checkbox=off]             | Stop rendering check boxes, render value only
  /* ~[checkbox=on]              | Begin rendering check boxes AND values
  /* ~[display=off]              | Do not display anything until display=on is encountered
  /* ~[display=on]               | Begin showing lines again
  /* ~[required=on]              | Text fields between these tags must not be left blank
  /* ~[required=off]             | Stop requiring entry in text fields
   
  /* prompt for response...
  /* ~other:<text>               | prompt for text response with <text>     | ~other:What is your name?                                */
  /* ~time:<text>                | prompt for time response with <text>     | ~time:What time would you like your meal?                */
  /* ~date:<text>                | prompt for date response with <text>     | ~date:What date would you like your meal?                */

  /* special cases...
  /* ~+<key>~<value>             | use value only when <key> is selected    | ~+Filet Mignon~~!How would you like your filet cooked?      */

  let displayRowList = [];
  let columnList = [];
  let checkbox = true;
  let ignore = false;
  let required = false;
  let displayBold = false;
  let displayItalic = false;
  let doneWithTopBox = false;

  if (!initialLoadComplete) {
    let defaultObj = {};
    let defaultChecked = { AVA: false };
    if (defaultValue) {
      (Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue]).forEach(i => {
        if (typeof i === 'string') {
          let [key, value] = i.split('=');
          defaultObj[key] = value;
        }
        else {
          if (typeof i === 'object' && i.peopleList) {
            columnList = i.peopleList.peopleList;
          }
        }
      });
    }
    for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
      // All rows are evaluated as follows "<instruction[0]>~<instruction[1]>:<instruction[2]>"
      // OR... "<instruction[0]>~~<instruction[1]>" (instruction[0] expected to be null/blank in this case)
      let instruction = listValues[vIndex].split(/[~:]+/);
      // console.log(instruction);

      // This checks for rows that contain "~[<oControl>=<oValue on/off>]"
      let dValue = '';
      let last_instruction = instruction[instruction.length - 1];
      if (last_instruction.charAt(0) === '[') {
        let [, oControl, oValue] = last_instruction.split(/[=[\]]+/);
        switch (oControl) {
          case 'checkbox': {    // checkbox default state is true; this allows you to toggle it off/on
            checkbox = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'display': {
            ignore = (oValue.toLowerCase() === 'off');
            break;
          }
          case 'required': {
            required = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'bold': {
            displayBold = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'italics':
          case 'italic': {
            displayItalic = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'default': {
            dValue = oValue;
            break;
          }
          default: { }
        }
        instruction.pop();
        if ((instruction.length === 0) || ((instruction.length === 1) && !instruction[0])) { continue; }
      }

      if (ignore) { continue; }

      if ((vIndex !== 0) && (checkbox || (!instruction[0] && !instruction[2]))) {
        // this is either a checkbox or a header
        doneWithTopBox = true;
      }

      // This handles any row without a leading "~"
      if (instruction[0]) {
        if (vIndex !== 0 && !doneWithTopBox) {
          displayRowList[0].text += `\n${instruction[0]}`;
        }
        else {
          displayRowList.push({
            checkbox,
            required,
            text: instruction[0],
            oKey: getKey(instruction[0]),
            desc: getDescription(instruction[0]),
            input: false,
            bold: displayBold,
            italic: displayItalic
          });
          if (['checked', 'on', 'selected', 'true'].includes(dValue)) { defaultChecked[instruction[0]] = true; }
        };
        continue;
      }

      // Dropping through to here means that instruction[0] was null/blank
      //    (ie. there was nothing before the first "~"; the row started with "~")
      // This handles rows in the form "~<instruction[1]>:<instruction[2]>", for example
      //     "~lambda:<instruction[2]>" or "~prompt:Who is this order for?"
      // Ignore these lines in multi-mode...
      if (instruction[2]) {
        displayRowList.push({
          checkbox: false,
          required: false,
          text: instruction[2],
          oKey: getKey(instruction[2]),
          desc: getDescription(instruction[2]),
          input: instruction[1],
          header: false
        });
        if (dValue) { defaultObj[instruction[2]] = dValue; }
        continue;
      }

      // Dropping through to here means that instruction[2] was also null/blank
      //      so the row looked like "~<instruction[1]>" or "~~<instruction[1]>"
      // Turns out, this is a header line in instruction[1]
      displayRowList.push({
        checkbox: false,
        required: false,
        text: instruction[1],
        oKey: getKey(instruction[1]),
        desc: getDescription(instruction[1]),
        input: false,
        header: true
      });
      if (dValue) { defaultObj[instruction[1]] = dValue; }
    };
    setTextInput(defaultObj);

    // We'll pre-load the radio checkboxes and do a little manipulation on the names for display purposes
    let radioOn = {};
    let maxLength = 1;
    columnList.forEach((c, x) => {
      radioOn[c.person_id] = Object.assign({}, defaultChecked);
      let a = c.display_name.split(' ');
      maxLength = Math.max(a.length, maxLength);
      columnList[x].dName = [' ', ' ', ' '].concat(a);
    });
    setMaxName(maxLength);

    setDataRows({
      displayRows: displayRowList,
      dataRows: {},
      radioOn,
      checked: Object.keys(defaultChecked),
      columnList: columnList
    });
    setLoadComplete(true);
  }

  function getKey(pText) {
    if (qualifiers.hasOwnProperty(pText) && qualifiers[pText].qualifiers) {
      let qKey = qualifiers[pText].qualifiers.find(q => { return (q.startsWith('~~key=')); });
      if (qKey) { return qKey.substr(6); }
    }
    return null;
  }

  function getDescription(pText) {
    if (qualifiers.hasOwnProperty(pText)) {
      return qualifiers[pText].description;
    }
    else {
      return null;
    }
  }

  function isChecked(pText) {
    let numberOn = 0;
    let numberOfPeople = Object.keys(dataRows.radioOn).length;
    for (let person in dataRows.radioOn) {
      if (dataRows.radioOn[person][pText]) { numberOn++; }
    }
    if (numberOn === 0) { return 'none'; }
    else if (numberOn < numberOfPeople) { return 'some'; }
    else { return 'all'; }
  }

  function isRadioSelected(person, item) {
    return (dataRows.radioOn[person].hasOwnProperty(item) && dataRows.radioOn[person][item]);
  }

  function makeConfirm(pData) {
    let warningsExist = false;
    let dataExists = false;
    let warningSection = [' ', `[bold][italic]There are no selections for:`, ' '];
    let responseArray = [' ', `[bold][italic]AVA will send the following:`];
    pData.columnList.forEach(c => {
      let radioChecked = [];
      Object.keys(pData.radioOn[c.person_id]).forEach(r => {
        if (pData.radioOn[c.person_id][r]) { radioChecked.push(r); }
        return;
      });
      if (radioChecked.length > 0) {
        dataExists = true;
        responseArray.push(` `);
        responseArray.push(`[italic]${c.name.first} ${c.name.last}`);
        responseArray.push(`[indent=1]${listFromArray(radioChecked)}`);
      }
      let noText = true;
      if (pData.textValue && pData.textValue.hasOwnProperty(c.person_id)) {
        Object.keys(pData.textValue[c.person_id]).forEach(textIn => {
          if (pData.textValue[c.person_id][textIn].trim() !== '') {
            dataExists = true;
            noText = false;
            if (radioChecked.length === 0) {
              responseArray.push(` `);
              responseArray.push(`[italic]${c.name.first} ${c.name.last}`);
            }
            responseArray.push(`[indent=1]${textIn}: ${pData.textValue[c.person_id][textIn]}`);
          }
        });
      }
      if ((radioChecked.length === 0) && (noText)) {
        warningsExist = true;
        warningSection.push(`[italic]${c.name.first} ${c.name.last}`);
      }
    });
    let returnArray = ['Selection summary'];
    if (warningsExist) { returnArray.push(...warningSection); }
    if (dataExists) { returnArray.push(...responseArray); }
    return ['confirm', returnArray];
  };

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {!!dataRows && dataRows.hasOwnProperty('displayRows') && dataRows.displayRows.length > 0 &&
        <React.Fragment>
          {/* Header with Avatar, Message, and VertMenu */}
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            key={'topBox'}
          >
            <Box display='flex' flexDirection='column' key={'titlesection'}>
              <Typography
                className={classes.title}
              >
                {factName}
              </Typography>
              <Typography
                className={classes.subTitle}
              >
                {prompt || `Please select from these options`}
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
              <Avatar src={process.env.REACT_APP_AVA_LOGO} />
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
                    <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`User ${fact.session.user_id}${fact.patient_id !== fact.session.user_id ? (' (' + fact.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: ObservationForm`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Activity: ${fact.activity_key}`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          { /* Data rows */}
          <Paper component={Box} className={classes.page} overflow='auto' square>
            {dataRows.displayRows.map((this_item, this_index) => (
              <Box display='flex'
                flexDirection='column'
                margin={0}
                border={isChecked(this_item.text) !== 'none' ? 2 : 0}
                key={'fullRow' + this_index}
                className={(this_index === 0 ? classes.listItemSticky : classes.listTopRow)}
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  key={'row' + this_index}
                  className={classes.listItem}
                  mb={0.5}
                  mt={0.5}
                  justifyContent='space-between'
                  alignItems='center'
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    minWidth={200}
                    maxWidth={(this_item.header && (this_index > 0)) ? 2000 : 200}
                    key={`descriptor-row${this_index}`}
                    className={classes.listItem}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    <Typography
                      className={this_item.header ? (this_index === 0 ? classes.headerLineSticky : classes.headerLine) : classes.textLine}
                    >
                      {this_item.bold
                        ? (this_item.italic ? <b><i>{this_item.text}</i></b> : <b>{this_item.text}</b>)
                        : (this_item.italic ? <i>{this_item.text}</i> : `${this_item.text}`)}
                    </Typography>
                  </Box>
                  {(!this_item.header || (this_index === 0)) &&
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={'row' + this_index}
                      className={classes.listItem}
                      justifyContent='flex-end'
                      alignItems='center'
                    >
                      {this_index !== 0 &&
                        (this_item.checkbox ?
                          <Box
                            display='flex'
                            flexDirection='row'
                            minWidth={50}
                            maxWidth={50}
                            key={`radiobox-row${this_index}`}
                            className={classes.listItem}
                            justifyContent='center'
                            alignItems='center'
                          >
                            <Checkbox
                              checked={isChecked(this_item.text) === 'all'}
                              indeterminate={isChecked(this_item.text) === 'some'}
                              disableRipple
                              key={'checkbox' + this_index}
                              onClick={() => {
                                // i every person currently check ON for this row?
                                let someAreOff = false;
                                for (let person in dataRows.radioOn) {
                                  if (!dataRows.radioOn[person][this_item.text]) { someAreOff = true; }
                                }
                                for (let person in dataRows.radioOn) {
                                  dataRows.radioOn[person][this_item.text] = someAreOff;
                                }
                                setDataRows(dataRows);
                                setForceRedisplay(!forceRedisplay);
                              }}
                            />
                          </Box>
                          :
                          <Box
                            display='flex'
                            flexDirection='row'
                            minWidth={50}
                            maxWidth={50}
                            key={`pencilbox-row${this_index}`}
                            className={classes.listItem}
                            justifyContent='center'
                            alignItems='center'
                          >
                            <Checkbox
                              disableRipple
                              className={classes.hiddenItem}
                              key={'pencilbox' + this_index}
                              onClick={() => { }}
                            />
                          </Box>
                        )}
                      {(this_index === 0) &&
                        <Box
                          display='flex'
                          flexDirection='column'
                          minWidth={50}
                          maxWidth={50}
                          key={`radiobox-row${this_index}`}
                          className={classes.listItem}
                          justifyContent='flex-end'
                          alignItems='center'
                        >
                          <Typography className={classes.smallTextLine}>Select</Typography>
                          <Typography className={classes.smallTextLine}>all</Typography>
                        </Box>
                      }
                      {dataRows.columnList.map((this_person, this_column) => (
                        (this_index === 0 ?
                          <Box
                            display='flex'
                            flexDirection='column'
                            minWidth={50}
                            maxWidth={50}
                            key={`radiobox-row${this_index}-col${this_column}`}
                            className={classes.listItem}
                            justifyContent='flex-end'
                            alignItems='center'
                          >
                            <Box
                              component="img"
                              mt={0}
                              mb={1}
                              minWidth={50}
                              maxWidth={50}
                              minHeight={50}
                              maxHeight={50}
                              alt=''
                              src={getImage(this_person.person_id)}
                            />
                            {this_person.dName.slice(-1 * maxName).map((n, nx) => (
                              <Typography key={`name-${nx}-${this_column}`} className={classes.smallTextLine}>{n}</Typography>
                            ))}
                          </Box>
                          :
                          (this_item.checkbox ?
                            <Box
                              display='flex'
                              flexDirection='row'
                              minWidth={50}
                              maxWidth={50}
                              key={`radiobox-row${this_index}-col${this_column}`}
                              className={classes.listItem}
                              justifyContent='center'
                              alignItems='center'
                            >
                              <Radio
                                key={`radio-row${this_index}-col${this_column}`}
                                checked={isRadioSelected(this_person.person_id, this_item.text)}
                                value={isRadioSelected(this_person.person_id, this_item.text)}
                                onClick={() => {
                                  if (!dataRows.radioOn[this_person.person_id].hasOwnProperty(this_item.text)
                                    || (!dataRows.radioOn[this_person.person_id][this_item.text])) { dataRows.radioOn[this_person.person_id][this_item.text] = true; }
                                  else { dataRows.radioOn[this_person.person_id][this_item.text] = false; }
                                  setDataRows(dataRows);
                                  setForceRedisplay(!forceRedisplay);
                                }}
                                disableRipple
                                className={classes.radioButton}
                                size='small'
                              />
                            </Box>
                            :
                            <Box
                              display='flex'
                              flexDirection='row'
                              minWidth={50}
                              maxWidth={50}
                              key={`pencilbox-row${this_index}-col${this_column}`}
                              className={classes.listItem}
                              justifyContent='center'
                              alignItems='center'
                            >
                              {(dataRows.hasOwnProperty('textValue')
                                && dataRows.textValue.hasOwnProperty(this_person.person_id)
                                && dataRows.textValue[this_person.person_id].hasOwnProperty(this_item.text)
                                && dataRows.textValue[this_person.person_id][this_item.text].trim() !== '')
                                ?
                                <Tooltip title={dataRows.textValue[this_person.person_id][this_item.text]}>
                                  <Button
                                    className={classes.pencilButton}
                                    onClick={() => {
                                      setPromptForText([this_person.person_id, this_item.text, this_person.display_name]);
                                      setForceRedisplay(!forceRedisplay);
                                    }}
                                    startIcon={<NotesIcon size="small" />}
                                  />
                                </Tooltip>
                                :
                                <Button
                                  className={classes.pencilButton}
                                  onClick={() => {
                                    setPromptForText([this_person.person_id, this_item.text, this_person.display_name]);
                                    setForceRedisplay(!forceRedisplay);
                                  }}
                                  startIcon={<EditIcon size="small" />}
                                />
                              }
                            </Box>
                          )
                        )
                      ))}
                    </Box>
                  }
                </Box>
              </Box>
            ))}

          </Paper>

          { /* Prompt for Text */}
          {(promptForText.length > 0) &&
            <AVATextInput
              titleText={promptForText[2]}
              promptText={promptForText[1]}
              buttonText='Save'
              onCancel={() => {
                setPromptForText([]);
                setForceRedisplay(!forceRedisplay);
              }}
              onSave={(updatedText) => {
                if (!dataRows.hasOwnProperty('textValue')) { dataRows.textValue = {}; }
                if (!dataRows.textValue.hasOwnProperty(promptForText[0])) {
                  dataRows.textValue[promptForText[0]] = {};
                }
                dataRows.textValue[promptForText[0]][promptForText[1]] = updatedText;
                setDataRows(dataRows);
                setPromptForText([]);
                setForceRedisplay(!forceRedisplay);
              }}
            />
          }

          { /* Prompts */}
          {
            cancelPending &&
            <AVAConfirm
              promptText={`Are you sure you'd like to exit?`}
              cancelText={'No, go back'}
              confirmText={'Yes, exit'}
              onCancel={() => {
                setCancelPending(false);
              }}
              onConfirm={() => {
                onClose();
              }}
            >
            </AVAConfirm>
          }
          {
            (confirmStatus === 'confirm') &&
            <AVAConfirm
              promptText={confirmPrompt}
              cancelText={'Go back'}
              confirmText={'Save/Send'}
              onCancel={() => { setConfirmStatus(''); }}
              onConfirm={async () => {
                let oBo, foreign_key, request_type;
                if (fact.value.freeText) {
                  if ('foreignKey' in fact.value.freeText) { foreign_key = fact.value.freeText.foreignKey; }
                  if ('requestType' in fact.value.freeText) { request_type = fact.value.freeText.requestType; }
                }
                if (!foreign_key) { foreign_key = '*tbd'; }
                if (!request_type) {
                  let s = fact.activity_key.split('.');
                  request_type = s[s.length - 1];
                }
                dataRows.columnList.map(async (c) => {
                  oBo = await makeName(c.person_id);
                  let radioChecked = [];
                  Object.keys(dataRows.radioOn[c.person_id]).forEach(r => {
                    if (dataRows.radioOn[c.person_id][r]) { radioChecked.push(r); }
                  });
                  let textSelections = {};
                  let textExists = false;
                  if (dataRows.textValue && dataRows.textValue.hasOwnProperty(c.person_id)) {
                    Object.keys(dataRows.textValue[c.person_id]).forEach(textIn => {
                      if (dataRows.textValue[c.person_id][textIn].trim() !== '') {
                        textExists = true;
                        textSelections[textIn] = dataRows.textValue[c.person_id][textIn];
                      }
                    });
                  }
                  if ((radioChecked.length > 0) || textExists) {
                    delete textInput['requestType'];
                    let requestObj = { 'selections': radioChecked };
                    if (textExists) { requestObj.textInput = textSelections; }
                    let messageObj = {};
                    if ('messaging' in fact) {
                      messageObj.messaging = Object.assign({}, requestObj, fact.messaging);
                      messageObj.messaging.activityName = factName;
                    }
                    await putServiceRequest(
                      {
                        client: pClient,
                        author: c.person_id,
                        proxy_user: fact.session.user_id,
                        requestType: request_type,
                        onBehalfOf: oBo,
                        foreign_key,
                        request: requestObj,
                        messaging: fact.messaging
                      });
                  }
                });
                onSave();
              }}
            >
            </AVAConfirm>
          }
          {
            (confirmStatus === 'error') &&
            <AVAConfirm
              promptText={confirmPrompt}
              cancelText={'Go back'}
              confirmText={'*none*'}
              onCancel={() => { setConfirmStatus(''); }}
              onConfirm={() => { }}
            >
            </AVAConfirm>
          }

          { /* Command Area */}
          {
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={classes.rowButtonDefault}
                    onClick={() => {
                      ((factType === 'list') ? onClose() : setCancelPending(true));
                    }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Exit'}
                  </Button>
                  {(!factType || (factType !== 'list')) &&
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={() => {
                        let [cStatus, response] = makeConfirm(dataRows);
                        setConfirmPrompt(response);
                        setConfirmStatus(cStatus);
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
        </React.Fragment>
      }
    </Dialog >
  );

};
