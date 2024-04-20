import React from 'react';

import Dialog from '@material-ui/core/Dialog';

import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';


import MoveUpIcon from '@material-ui/icons/Publish';
import MoveDownIcon from '@material-ui/icons/GetApp';
import Tooltip from '@material-ui/core/Tooltip';

import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { AVATextStyle } from '../../util/AVAStyles';

import Button from '@material-ui/core/Button';

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
}));

export default ({ listToUpdate, options = {}, onClose }) => {

  const classes = useStyles();

  const preparedOGList = prepare(listToUpdate);

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [reactData, setReactData] = React.useState({
    allDone: false,
    OGList: preparedOGList,
    currentList: preparedOGList
  });

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(forceRedisplay => !forceRedisplay);
    }
  };

  function prepare(passedIn) {
    let response = [];
    if (!passedIn) {
      return [];
    }
    if (Array.isArray(passedIn)) {
      passedIn.forEach((p, x) => {
        if (typeof (p) === 'string') {  // this was an array of strings
          response.push({
            value: p,
            key: x,
            sort: x
          });
        }
        else {   // this was an array of objects
          response.push({
            value: p.value || Object.values(p)[0],
            key: p.key || x,
            sort: p.sort || x,
          });
        }
      });
    }
    else {  // this was an object
      Object.keys(passedIn).forEach((p, x) => {
        response.push({
          value: passedIn[p].value || Object.values(passedIn[p])[0],
          key: passedIn[p].key || x,
          sort: passedIn[p].sort || x,
        });
      });
    };
    return response.sort((a, b) => {
      return ((a.sort > b.sort) ? 1 : -1);
    });
  }

  return (
    <Dialog
      open={(true || forceRedisplay) && !reactData.allDone}
      fullWidth
      className={classes.containerBox}
      p={2}
      variant={'elevation'} elevation={2}
    >
      {/* Screen header - Description, Date, Location... */}
      <Box
        display='flex' flexDirection='row'
        className={classes.messageArea}
        key={'topBox'}
      >
        <Box
          display='flex'
          className={classes.title}
          flexDirection='column'
          flexGrow={1}
          mb={3}
        >
          <Typography style={AVATextStyle({ margin: { bottom: 2 }, size: 1.5, bold: true })} >
            Customize your Event
          </Typography>
        </Box>
      </Box>
      {reactData.currentList && (reactData.currentList.length > 0) &&
        reactData.currentList.map((this_entry, x) => (
          <Box
            display='flex'
            grow={1}
            mb={0}
            ml={2}
            flexDirection='row'
            justifyContent='center'
            alignItems='flex-start'
            key={`dBox_${x}`}
          >
            <TextField
              classes={{ root: classes.idText }}
              id={`value_${x}`}
              key={`value_${x}`}
              fullWidth
              value={this_entry.value}
              onChange={(event) => {
                reactData.currentList[x].value = event.target.value;
                updateReactData({
                  currentList: reactData.currentList
                }, true);
              }}
              onBlur={(event) => {
                reactData.currentList[x].value = event.target.value;
                updateReactData({
                  currentList: reactData.currentList
                }, true);
              }}
            />
            <Box display='flex' key={`arrowBox_${x}`} ml={3} mr={2} flexDirection='row' alignSelf='flex-end' justifyContent='center' alignItems='center'>
              {(x > 0) &&
                <Tooltip title={`Move up`} >
                  <MoveUpIcon
                    onClick={() => {
                      reactData.currentList.splice(x - 1, 0, reactData.currentList.splice(x, 1)[0]);
                      updateReactData({
                        currentList: reactData.currentList
                      }, true);
                    }}
                  />
                </Tooltip>
              }
              {(x < (reactData.currentList.length - 1)) &&
                <Tooltip title={`Move down`} >
                  <MoveDownIcon
                    onClick={() => {
                      reactData.currentList.splice(x + 1, 0, reactData.currentList.splice(x, 1)[0]);
                      updateReactData({
                        currentList: reactData.currentList
                      }, true);
                    }}
                  />
                </Tooltip>
              }
            </Box>
          </Box>
        ))
      }
      <Box
        display='flex'
        grow={1}
        mb={5}
        mt={4}
        flexDirection='row'
        justifyContent='center'
        alignItems='center'
        key={`buttons`}
      >
        <Box
          display='flex'
          mr={2}
          flexDirection='row'
          justifyContent='center'
          alignItems='center'
          key={`button1`}
        >
          <Button
            className={classes.reject} size='small' variant='contained'
            onClick={() => {
              onClose(reactData.OGList);
              updateReactData({
                allDone: true
              }, true);
            }}
          >
            Cancel
          </Button>
        </Box>
        <Box
          display='flex'
          ml={2}
          flexDirection='row'
          justifyContent='center'
          alignItems='center'
          key={`button2`}
        >
          <Button
            ml={2}
            variant='contained'
            color='primary'
            size='small'
            onClick={() => {
              onClose(reactData.currentList.map((c, x) => {
                return {
                  key: c.key,
                  value: c.value,
                  sort: x
                };
              }));
              updateReactData({
                allDone: true
              }, true);
            }}
          >
            Save
          </Button>
        </Box>
      </Box>
    </Dialog >
  );
};