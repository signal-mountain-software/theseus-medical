import React from 'react';
import { useSnackbar } from 'notistack';

import { makeDate, addDays } from '../../util/AVADateTime';
import { getCalendarEntries, getAllOccurrences } from '../../util/AVACalendars';
import { cl } from '../../util/AVAUtilities';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';

import CloseIcon from '@material-ui/icons/ExitToApp';

import CalendarEventEditForm from './CalendarEventEditForm';

import TextField from '@material-ui/core/TextField';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import DialogContent from '@material-ui/core/DialogContent';
import Dialog from '@material-ui/core/Dialog';

import Button from '@material-ui/core/Button';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

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
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  title: {
    flexGrow: 1,
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.2
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
  freeInput: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.75),
    width: '90%'
  },
  subDescriptionText2: {
    marginTop: 0,
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    fontSize: '0.8rem',
  },
  subDescriptionText: {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    fontSize: '0.8rem',
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
}));

export default ({ myCalendar, person_id, kiosk_mode, display_name, peopleList, session, handleMore, onClose }) => {

  let working_date = '';

  const scrollValue = 15;
  var rowsWritten;

  const { enqueueSnackbar } = useSnackbar();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [reactData, setReactData] = React.useState(
    {
      rowLimit: 50,
      priorTop: 0,
      filterTextDisplayed: null,
      filterTextLower: null,
      selectDate: null,
      loading: false,
      progress: 0,
      pWidth: 60
    }
  );

  const updateReactData = (newData, force = false) => {
    for (let oKey in newData) {
      setReactData((prevValues) => ({
        ...prevValues,
        [oKey]: newData[oKey]
      }));
    }
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const showFilterText = () => {
    return reactData.filterTextDisplayed || ' ';
  };

  const lastRow = React.useRef(null);

  const [detailEdit, setDetailEdit] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  function okToShow(this_event) {
    if (reactData.selectDate) { return reactData.selectDate.numeric$ === this_event.date; }
    else if (this_event.date === '29991231') { return false; }
    else if (!reactData.filterTextLower) { return true; }
    else {
      return (`${this_event.description} ${this_event.location}`).toLowerCase().includes(reactData.filterTextLower);
    }
  }

  const screenStatus = (statusMessage, progressPct, progressWidth) => {
    updateReactData({
      loading: statusMessage,
      progress: progressPct,
      pWidth: progressWidth * 100
    }, true);
  };

  const extendDates = async (factor, set_end = {}) => {
    let previousStart = myCalendar[0].date;
    let previousEnd = myCalendar[myCalendar.length - 1].date;
    let start_date, end_date;
    if (set_end.hasOwnProperty('numeric$')) {
      if (set_end.numeric$ <= previousEnd) { return; }
      start_date = addDays(previousEnd, 1);
      end_date = set_end.date;
    }
    else if (factor > 0) {
      start_date = addDays(previousEnd, 1);
      end_date = addDays(previousEnd, factor);
    }
    else {
      start_date = addDays(previousStart, factor);
      end_date = addDays(previousStart, -1);
    }
    let newEntries = await getAllOccurrences(
      {
        client_id: myCalendar[0].client,
        start_date,
        end_date
      },
      screenStatus
    );
    if (factor > 0) {
      myCalendar.push(...newEntries);
    }
    else {
      myCalendar.unshift(...newEntries);
    }
    myCalendar.sort((a, b) => {
      if (a.date < b.date) { return -1; }
      else if (a.date > b.date) { return 1; }
      else if (a.time24 < b.time24) { return -1; }
      else { return 1; }
    });
    updateReactData({
      loading: false,
      progress: 100,
      pWidth: 60
    }, true);
  };

  let scrollTimeOut;
  async function handleScroll(e) {
    clearTimeout(scrollTimeOut);
    scrollTimeOut = setTimeout(async ([scrollHeight, visibleTop, visibleHeight]) => {
      cl({ scrollHeight, visibleTop, priorTop: reactData.priorTop, visibleHeight });
      if ((visibleTop > reactData.priorTop)    // scroll down
        && ((scrollHeight - visibleTop) <= (visibleHeight * 1.05))) {       // on the last visible page
        let newLimit = reactData.rowLimit + scrollValue;
        if (newLimit > myCalendar.length) { await extendDates(7); }
        updateReactData({ rowLimit: newLimit, priorTop: visibleTop }, true);
        if (lastRow && lastRow.current) {
          lastRow.current.scrollTo({
            behavior: 'instant',
            top: (visibleTop + visibleHeight),
          });
        }
      }
    }, 500, [e.target.scrollHeight, e.target.scrollTop, e.target.clientHeight]);
  };

  const handleChangeRequestFilter = (vCheck, filterTimeOut) => {
    clearTimeout(filterTimeOut);
    updateReactData({
      filterTextDisplayed: vCheck.trimStart()
    }, true);
    let returnTimeOut = setTimeout(async () => {
      cl(`timeout expired ${vCheck}`);
      if (!vCheck) {
        updateReactData({
          filterTextLower: null,
          selectDate: null
        }, true);
      }
      else {
        let checkDate = makeDate(vCheck);
        if (checkDate.error) {
          updateReactData({
            filterTextLower: ((vCheck.length === 1) ? null : vCheck.trim().toLowerCase()),
            selectDate: null
          }, true);
        }
        else {
          await extendDates(0, checkDate);
          updateReactData({
            filterTextLower: null,
            selectDate: checkDate
          }, true);
        }
      }
    }, 750);
    cl(`set timeout ${returnTimeOut} with ${vCheck}`);
    return returnTimeOut;
  };

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {myCalendar &&
        <React.Fragment>
          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
            {rowsWritten = 0}
          </Typography>
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            key={'topBox'}
          >
            <Box
              display='flex'
              grow={1}
              style={{ width: '90%' }}
              mb={0}
              flexDirection='column'
              justifyContent='center'
              alignItems='flex-start'
            >
              <Typography
                className={classes.title} style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
              >
                {!session.patient_display_name ? `Calendar of Events` : `${session.patient_display_name.split(',').pop()}'s Calendar`}
              </Typography>

              <Box
                display='flex' flexDirection='row' alignItems={'center'}
                key={'vRowRefresh'}
              >
                {(myCalendar.length > 0) ?
                  <Typography
                    className={classes.subDescriptionText2} style={AVATextStyle({ margin: { left: 2, right: 2, bottom: 2 } })}
                  >
                    {reactData.selectDate ? reactData.selectDate.absolute_full :
                      `From ${makeDate(myCalendar[0].date).relative} to ${makeDate(myCalendar[myCalendar.length - 1].date).relative}`
                    }
                  </Typography>

                  :
                  <Typography
                    className={classes.subDescriptionText2} style={AVATextStyle({ margin: { left: 2, right: 2, bottom: 2 } })}
                  >
                    This Calendar is empty!
                  </Typography>
                }
              </Box>
            </Box>
            <Box
              component="img"
              ml={2}
              mr={2}
              mt={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={50}
              maxWidth={50}
              minHeight={50}
              maxHeight={50}
              onClick={(event) => {
                handleClick(event);
                setPopupMenuOpen(true);
              }}
              alt=''
              src={process.env.REACT_APP_AVA_LOGO}
            />
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
                    <Typography className={classes.popUpFooter} >{`User ${session.user_id}${session.patient_id !== session.user_id ? (' (' + session.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: Calendar`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
          <Box display='flex'
            flexDirection='row'
            marginLeft={2}
            marginRight={2}
            marginBottom={0.5}
            border={showFilterText() ? 1 : 0}
            borderRadius={'16px'}
            key={'filterRow'}
          >
            <TextField
              className={classes.freeInput}
              id='List Filter'
              variant={'standard'}
              key={'filtertext'}
              helperText={'Filter/Search or Date'}
              inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
              FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
              multiline
              onChange={(event) => {
                let lastUsed = handleChangeRequestFilter(event.target.value, reactData.lastFilterTimeoutUsed);
                updateReactData({ lastFilterTimeoutUsed: lastUsed }, true);
              }}
              autoComplete='off'
              value={showFilterText()}
            />
          </Box>
          {/* Loading spinner */}
          {reactData.loading &&
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
                src={session?.client_logo || process.env.REACT_APP_AVA_LOGO}
              />
              <React.Fragment>
                <Box
                  display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                  flexWrap='wrap' textOverflow='ellipsis' width='100%'
                  key={'loadingBox'}
                  mb={2}
                >
                  <Typography style={AVATextStyle({ size: 1.5, align: 'center' })} className={classes.lastName} >{`Loading More Dates`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.8 })}>{reactData.loading}</Typography>
                </Box>
                <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: reactData.pWidth }} value={reactData.progress} />
                <CircularProgress />
              </React.Fragment>
            </Box>
          }
          {!reactData.loading &&
            <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }} ref={lastRow} onScroll={async (event) => (await handleScroll(event))}>
              <Box >
                <Grid item>
                  <GridList cellHeight='auto' cols={1} key='gridList' >
                    {myCalendar.map((this_event, index) => (
                      okToShow(this_event) && (rowsWritten < reactData.rowLimit) &&
                      <React-fragment key={this_event.id + 'frag' + index} >
                        <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                          {rowsWritten++}
                        </Typography>
                        {this_event.date !== working_date &&
                          <GridListTile
                            key={this_event.id + 'rhead' + index}
                            style={{ marginBottom: '0px', marginTop: (rowsWritten === 1 ? '0px' : '50px') }}
                            cols={1}
                          >
                            <Box mb={0.5} py={1} px={0} borderBottom={2}>
                              <Box flexGrow={1}>
                                <Typography
                                  key={this_event.date + 'dhead' + index}
                                  className={classes.noDisplay}
                                >
                                  {working_date = this_event.date}
                                </Typography>
                                <Typography
                                  style={AVATextStyle({ size: 1.5 })}
                                  key={working_date + 'head' + index}
                                >
                                  {makeDate(working_date).absolute}
                                </Typography>
                              </Box>
                            </Box>
                          </GridListTile>
                        }
                        <GridListTile
                          key={this_event.id + 'r' + index}
                          style={{ marginBottom: '0px', marginTop: '0px' }}
                          cols={1}
                        >
                          <Paper
                            component={Box}
                            p={2}
                            mt={0} mb={1}
                            variant='outlined'
                            style={{ background: this_event, marginBottom: '0px', marginTop: '0px' }}
                            textAlign='left'
                            onClick={async () => {
                              let cEntries = await getCalendarEntries({
                                person_id,
                                client: this_event.client,
                                event_id: this_event.event_key
                              });
                              this_event.occData = Object.assign({},
                                cEntries[0].eventData.event_data,
                                cEntries[0].eventData,
                                { location: cEntries[0].eventData.event_data.location.description },
                                { signup_type: cEntries[0].eventData.sign_up.type },
                                cEntries[1],
                                { date: cEntries[1].occurrence_date },
                                { time$: `${cEntries[0].eventData.event_data.time.from}${(cEntries[0].eventData.event_data.time.to ? ' to ' + cEntries[0].eventData.event_data.time.to : '')}` },
                                { time24: this_event.time24 }
                              );
                              this_event.index = index;
                              setDetailEdit(this_event);
                            }}
                            square
                          >
                            <Box display='flex' flexDirection='row'
                              justifyContent='flex-start' alignItems='center'
                              onContextMenu={async (e) => {
                                e.preventDefault();
                                enqueueSnackbar(`Event data=${JSON.stringify(this_event)}`, { variant: 'info', persist: true });
                              }}
                            >
                                <Typography style={AVATextStyle({ })}>
                                {`${this_event.description}${this_event.time ? ' - ' + this_event.time : ''}`}
                              </Typography>
                            </Box>
                          </Paper>
                        </GridListTile>
                      </React-fragment>
                    ))}
                    {(rowsWritten === 0) &&
                      <GridListTile
                        key={'rhead'}
                        style={{ marginBottom: '0px', marginTop: '0px' }}
                        cols={1}
                      >
                        <Box mb={0.5} py={1} px={0} >
                          <Box flexGrow={1}>
                            <Typography
                              key={'head'}
                              style={AVATextStyle({ size: 1.5 })}
                            >
                              No Calendar Entries to Show!
                            </Typography>
                          </Box>
                        </Box>
                      </GridListTile>

                    }
                  </GridList>
                </Grid>
              </Box>
            </DialogContent>
          }
          {!reactData.loading && detailEdit &&
            <CalendarEventEditForm
              pEventCode={detailEdit.event_key}
              peopleList={peopleList}
              pPatient={person_id}
              pClient={detailEdit.client}
              pOccData={detailEdit.occData}
              onReset={(updatedData) => {
                myCalendar[detailEdit.index].description = updatedData.description;
                if ((myCalendar[detailEdit.index].date !== updatedData.date)
                  || (myCalendar[detailEdit.index].time24 !== updatedData.time24)) {
                  myCalendar[detailEdit.index].date = updatedData.date;
                  myCalendar[detailEdit.index].time = updatedData.time$;
                  myCalendar[detailEdit.index].time24 = updatedData.time24;
                  myCalendar.sort((a, b) => {
                    if (a.date < b.date) { return -1; }
                    else if (a.date > b.date) { return 1; }
                    else if (a.time24 < b.time24) { return -1; }
                    else { return 1; }
                  });
                }
                setDetailEdit(false);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
            />
          }
        </React.Fragment>
      }
      <Box display='flex' flexDirection='row'
        justifyContent='center' alignItems='center' style={{ marginTop: '1em' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          startIcon={<CloseIcon fontSize="small" />}
          onClick={onClose}>
          {'Done'}
        </Button>
      </Box>
    </Dialog>
  );
};