import React from 'react';
import { titleCase, sentenceCase } from '../../util/AVAUtilities';
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

export default ({ person, groupData, updateGroups }) => {

  const classes = useStyles();
  const { state } = useSession();

  const [adminSelected, setAdminSelected] = React.useState(groupData.selectedID);
  const [reactData, setReactData] = React.useState(groupData);
  const [accountClass, setAccountClass] = React.useState(person.account_class || null);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();

  function handleUpdate(adminGroup) {
    let memberOf = [adminGroup || adminSelected];
    let checkGroup = memberOf[0];
    let nextGroup;
    let loopCount = 0;
    do {
      nextGroup = null;
      loopCount++;
      // eslint-disable-next-line
      reactData.adminHierarchy.forEach(gObj => {
        if ((gObj.id === checkGroup) && (gObj.belongs_to)) {
          if (!memberOf.includes(gObj.belongs_to)) { memberOf.push(gObj.belongs_to); }
          nextGroup = gObj.belongs_to;
        }
      });
      checkGroup = nextGroup;
    } while (checkGroup && (loopCount < 20));
    for (let gID in reactData.publicGroups) {
      if (!reactData.publicGroups[gID].role.startsWith('non')
        && !memberOf.includes(gID)) {
        memberOf.push(gID);
      }
    }
    for (let gID in reactData.privateGroups) {
      if (!reactData.privateGroups[gID].role.startsWith('non')
        && !memberOf.includes(gID)) {
        memberOf.push(gID);
      }
    };
    updateGroups(memberOf);
    if (!person.account_class || (person.account_class === '')) {
      setAccountClass(determineClass(memberOf), state.session.group_assignments);
    }
    setForceRedisplay(!forceRedisplay);
  }
/*
  function determineClass(gList) {
    let groupFlavor = {};
    let groupHierarchy = ['admin', 'staff', 'resident', 'family', 'guest', 'vendor', 'other'];
    if (state.session.group_assignments) {
      Object.keys(state.session.group_assignments).forEach(t => {
        let groups = makeArray(state.session.group_assignments[t]);
        groups.forEach(g => {
          if (!groupFlavor.hasOwnProperty(g)) { groupFlavor[g] = groupHierarchy.indexOf(t); }
          else { groupFlavor[g] = Math.min(groupHierarchy.indexOf(t), groupFlavor[g]); }
        });
      });
    }
    let member_of = groupHierarchy.length;
    let gL = gList.length;
    for (let x = 0; x < gL; x++) {
      let g = gList[x];
      if (groupFlavor.hasOwnProperty(g)) {
        member_of = Math.min(member_of, groupFlavor[g]);
      }
    }
    return groupHierarchy[member_of];
  }
*/
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
                      if (adminSelected === gObj.id) {
                        enqueueSnackbar(`You need to choose one.  Pick the group you are a member of and ${gObj.name} will be unchecked automatically!`, { variant: 'warning' });
                      }
                      else {
                        setAdminSelected(gObj.id);
                        handleUpdate(gObj.id);
                      }
                    }}
                    checked={(adminSelected === gObj.id)}
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
                    if (reactData.publicGroups[gID].role.startsWith('non-')) {
                      reactData.publicGroups[gID].role = reactData.publicGroups[gID].role.slice(4);
                    }
                    else { reactData.publicGroups[gID].role = `non-${reactData.publicGroups[gID].role}`; }
                    setReactData(reactData);
                    handleUpdate();
                  }}
                  checked={(!reactData.publicGroups[gID].role.startsWith('non-'))}
                />
                <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{reactData.publicGroups[gID].group_name}</Typography>
                {!reactData.publicGroups[gID].role.startsWith('non-') && reactData.publicGroups[gID].role !== 'member' &&
                  <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>({titleCase(reactData.publicGroups[gID].role)})</Typography>
                }
              </Box>
            </Box>
          ))}
        </List>
      </Box>
      <Typography className={classes.HeadTextWIthTopSpacing}>{`Private Groups`}</Typography>
      {Object.keys(reactData.privateGroups).length > 0
        ? <Typography className={classes.InstructionText}>{`You have been added to these Groups by an Administrator`}</Typography>
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
                <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{reactData.privateGroups[gID].group_name || gID}</Typography>
                {reactData.privateGroups[gID].role !== 'member' &&
                  <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>({titleCase(reactData.privateGroups[gID].role)})</Typography>
                }
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
        <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{sentenceCase(accountClass || determineClass(person.groups))}</Typography>
      </Box>
    </Section>
  );
};
