import React from 'react';
import { sentenceCase } from '../../util/AVAUtilities';
import { determineClass } from '../../util/AVAGroups';
import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';
import useSession from '../../hooks/useSession';

import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';

import List from '@material-ui/core/List';
import { useSnackbar } from 'notistack';

import Section from '../Section';

const useStyles = makeStyles(theme => ({
  container: {
    maxHeight: 400,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  HeadText: {
    fontSize: theme.typography.fontSize * 1.2,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  InstructionText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextWIthTopSpacing: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginTop: 10,
    paddingLeft: 0,
    paddingRight: 10,
  },
  HeadTextWIthTopSpacing: {
    fontSize: theme.typography.fontSize * 1.2,
    marginLeft: 0,
    marginTop: 10,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
}));

export default ({ person, groupData, multiple = false, updateGroups }) => {

  const classes = useStyles();
  const { state } = useSession();

  const [reactData, setReactData] = React.useState({
    ...Object.assign({}, groupData),
    adminGroupList: groupData.adminHierarchy.map(this_group => {
      if (this_group.selectable) {
        return this_group.id;
      }
      else {
        return null;
      }
    }),
    fullGroupList: [],
    accountClass: person.account_class || null
  });

  const { enqueueSnackbar } = useSnackbar();

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

  if ((reactData.fullGroupList.length === 0) && (person.groups.length > 0)) {
    updateGroupList(person.groups);
  }
  function updateGroupList(groupList) {
    let myAdminGroups = [];
    let myOtherGroups = [];
    groupList.forEach(this_group => {
      if (reactData.adminGroupList.includes(this_group)) {
        myAdminGroups.push(this_group);
      }
      else if (reactData.publicGroups.hasOwnProperty(this_group)) {
        if (!reactData.publicGroups[this_group].role.startsWith('non')) {
          myOtherGroups.push(this_group);
        }
      }
      else if (reactData.privateGroups.hasOwnProperty(this_group)) {
        if (!reactData.privateGroups[this_group].role.startsWith('non')) {
          myOtherGroups.push(this_group);
        }
      }
    });
    // now add parents of the adminGroups
    let myRollUpGroups = [];
    let groupsToCheck = [...myAdminGroups];
    do {
      let this_group = groupsToCheck.shift();
      reactData.adminHierarchy.some(gObj => {
        if (gObj.id === this_group) {
          if ((gObj.belongs_to) && !myRollUpGroups.includes(gObj.belongs_to)) {
            myRollUpGroups.push(gObj.belongs_to);
            groupsToCheck.push(gObj.belongs_to);
          }
          return true;
        }
        return false;
      });
    } while (groupsToCheck.length > 0);
    let response = [...myAdminGroups, ...myOtherGroups, ...myRollUpGroups];
    if (!['master', 'support'].includes(person.account_class)) {
      person.account_class = determineClass(response);
    }
    updateReactData({
      fullGroupList: response,
      accountClass: person.account_class
    });
    if ((person.groups.length !== response.length)
      || !((response.every(this_response => {
        return person.groups.includes(this_response);
      })) && ((person.groups.every(this_response => {
        return response.includes(this_response);
      }))))) {
      updateGroups(response);
    }
    return response;
  }

  return (
    (forceRedisplay || true) &&
    <Section title='Groups' outlined>
      <Typography className={classes.HeadText}>{`Administrative Groups`}</Typography>
      <Typography className={classes.InstructionText}>{`Choose ONE from this list`}</Typography>
      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
        <List className={classes.root}>
          {reactData.adminHierarchy.map((gObj, ndx) => (
            <Box display='flex' style={{ height: 40, marginLeft: gObj.level * 20 }} flexDirection='row' justifyContent='flex-start'
              alignItems='center' flexWrap='wrap' key={`admin-${ndx}`}
              onContextMenu={async (e) => {
                e.preventDefault();
                enqueueSnackbar(`Group ID=${gObj.id}`, { variant: 'info', persist: true });
              }}
            >
              {gObj.selectable ?
                <Box display='flex' flexDirection='row' justifyContent='flex-start'
                  alignItems='center' flexWrap='nowrap' key={`qropt-${ndx}`}
                >
                  <Checkbox
                    className={classes.radioButton}
                    size="small"
                    onClick={() => {
                      let foundIt = reactData.fullGroupList.findIndex(this_group => {
                        return (this_group === gObj.id);
                      });
                      if (foundIt < 0) {
                        reactData.fullGroupList.push(gObj.id);
                      }
                      else {
                        reactData.fullGroupList.splice(foundIt, 1);
                      }
                      updateGroupList(reactData.fullGroupList);
                    }}
                    checked={reactData.fullGroupList.includes(gObj.id)}
                  />
                  <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{gObj.name}</Typography>
                </Box>
                :
                <Typography className={classes.radioText}>{gObj.name}</Typography>
              }
            </Box>
          ))}
        </List>
      </Box>
      <Typography className={classes.HeadTextWIthTopSpacing}>{`Public (optional) Groups`}</Typography>
      {Object.keys(reactData.publicGroups).length > 0
        ? <Typography className={classes.InstructionText}>{`Choose any from this list you're interested in`}</Typography>
        : <Typography className={classes.InstructionText}>{`No Public Groups are available at this time`}</Typography>
      }
      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
        <List className={classes.root}>
          {Object.keys(reactData.publicGroups).map((gID, ndx) => (
            <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
              alignItems='center' flexWrap='wrap' key={`public-${ndx}`}
              onContextMenu={async (e) => {
                e.preventDefault();
                enqueueSnackbar(`Group ID=${gID}`, { variant: 'info', persist: true });
              }}
            >
              <Box display='flex' flexDirection='row' justifyContent='flex-start'
                alignItems='center' flexWrap='wrap' key={`pubopt-${ndx}`}
              >
                <Checkbox
                  className={classes.radioButton}
                  size="small"
                  onClick={() => {
                    let foundIt = reactData.fullGroupList.findIndex(this_group => {
                      return (this_group === gID);
                    });
                    if (foundIt < 0) {
                      reactData.fullGroupList.push(gID);
                    }
                    else {
                      reactData.fullGroupList.splice(foundIt, 1);
                    }
                    updateGroupList(reactData.fullGroupList);
                  }}
                  checked={reactData.fullGroupList.includes(gID)}
                  disabled={reactData.publicGroups[gID].role.startsWith('resp')}
                />
                <Typography className={classes.radioText} style={{ fontWeight: (reactData.publicGroups[gID].role.startsWith('resp') ? 'bold' : '') }}>{reactData.publicGroups[gID].group_name}</Typography>
              </Box>
            </Box>
          ))}
        </List>
      </Box>
      <Typography className={classes.HeadTextWIthTopSpacing}>{`Private Groups`}</Typography>
      {Object.keys(reactData.privateGroups).length > 0
        ? <Typography className={classes.InstructionText}>{`Only Administrators can update this information`}</Typography>
        : <Typography className={classes.InstructionText}>{`You are not a member of any Private Groups`}</Typography>
      }
      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
        <List className={classes.root}>
          {Object.keys(reactData.privateGroups).map((gID, ndx) => (
            <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
              alignItems='center' flexWrap='wrap' key={`private-${ndx}`}
              onContextMenu={async (e) => {
                e.preventDefault();
                enqueueSnackbar(`Group ID=${gID}`, { variant: 'info', persist: true });
              }}
            >
              <Box display='flex' flexDirection='row' justifyContent='flex-start'
                alignItems='center' flexWrap='wrap' key={`pubopt-${ndx}`}
              >
                {(!reactData.privateGroups[gID].role.startsWith('non-') || (['master', 'support'].includes(state.user.account_class))) &&
                  <Checkbox
                    className={classes.radioButton}
                    size="small"
                    onClick={() => {
                      let foundIt = reactData.fullGroupList.findIndex(this_group => {
                        return (this_group === gID);
                      });
                      if (foundIt < 0) {
                        reactData.fullGroupList.push(gID);
                      }
                      else {
                        reactData.fullGroupList.splice(foundIt, 1);
                      }
                      updateGroupList(reactData.fullGroupList);
                    }}
                    checked={reactData.fullGroupList.includes(gID)}
                    disabled={reactData.privateGroups[gID].role.startsWith('resp')}
                  />
                }
                <Typography className={classes.radioText} style={{ fontWeight: (reactData.privateGroups[gID].role.startsWith('resp') ? 'bold' : '') }}>{reactData.privateGroups[gID].group_name || gID}</Typography>
              </Box>
            </Box>
          ))}
        </List>
      </Box>
      <Typography className={classes.HeadTextWIthTopSpacing}>{`Account Type`}</Typography>
      <Typography className={classes.InstructionText}>{`Automatically assigned by AVA.  Contact Support for more info`}</Typography>
      <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
        alignItems='center' flexWrap='wrap'
      >
        <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{sentenceCase(reactData.accountClass || determineClass(person.groups))}</Typography>
      </Box>
    </Section>
  );
};
