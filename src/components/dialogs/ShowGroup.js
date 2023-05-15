import React from 'react';
import { useSnackbar } from 'notistack';
import { getMemberList, getGroup, getRole } from '../../util/AVAGroups';
import { dbClient } from '../../util/AVAUtilities';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';

// import useMediaQuery from '@material-ui/core/useMediaQuery';


const useStyles = makeStyles(theme => ({
  formControl: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingTop: 3,
  },
  pageHead: {
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  dialogBox: {
    minWidth: '100%',
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  load: {
    backgroundColor: theme.palette.warning[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pSession, pGroup_id, pGroup_name, peopleList, showList, onClose }) => {
  const [groupMemberList, setGroupMemberList] = React.useState([]);
  const [groupsManagedObject, setGroupsManagedObject] = React.useState([]);
  const [showGroupSelect, setShowGroupSelect] = React.useState(false);

  const [groupName, setGroupName] = React.useState(pGroup_name);
  const [groupID, setGroupID] = React.useState();
  const [groupRole, setGroupRole] = React.useState();
  const [groupRec, setGroupRec] = React.useState();

  const [progressMessage, setprogressMessage] = React.useState('Building Member List');

  const classes = useStyles();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const { enqueueSnackbar } = useSnackbar();

  async function getGroupMemberList(inGroup) {
    setprogressMessage('Getting all accounts');
    let memberInfo = await getMemberList(inGroup, pSession.client_id, { "sort": true, "exclude": false });

    if (memberInfo.peopleList.length === 0) {
      enqueueSnackbar(`AVA couldn't find any accounts.`, { variant: 'error' });
      onClose();
      return [];
    }
    setGroupMemberList(memberInfo.peopleList);
    if (memberInfo.groupList.length === 1) {
      if (memberInfo.groupList[0] === '*all') {
        setGroupID('*all');
        setGroupRole('responsible');
      }
      else {
        let groupRec = await getGroup(memberInfo.groupList[0], pSession.client_id);
        setGroupRec(groupRec);
        setGroupID(groupRec.group_id);
        if (groupsManagedObject[groupRec.name]) {
          setGroupRole(groupsManagedObject[groupRec.name].role);
        }
        else { setGroupRole(await getRole(groupRec.group_id, pSession.patient_id)); }
      }
    }
    else {
      setGroupRec({});
      setGroupID(...inGroup);
      setGroupRole('');
    }
    return memberInfo.peopleList;
  };

  async function getSession(who) {
    let sRec = await dbClient
      .get({
        Key: {
          session_id: who
        },
        TableName: "SessionsV2"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on SessionsV2 - caught error is': error });
      });
    if (sRec && ('Item' in sRec)) { return sRec.Item; }
    else { return {}; }
  }

  async function getPerson(pPerson) {
    let peopleRec = await dbClient
      .get({
        Key: {
          person_id: pPerson
        },
        TableName: "People"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on People - caught error is': error });
      });
    if (peopleRec && ('Item' in peopleRec)) { return peopleRec.Item; }
    else { return {}; }
  }

  async function getGroupDetails(pClient, pGroup) {
    let groupRec = await dbClient
      .get({
        Key: {
          client_id: pClient,
          group_id: pGroup
        },
        TableName: "Groups"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on Groups - caught error is': error });
      });
    if ('Item' in groupRec) { return groupRec.Item; }
    else { return {}; }
  }

  const getGroupsManagedObject = async (pPatient) => {
    let patientSession = await getSession(pPatient);
    var returnObject = {};
    let foundGroups = [];
    // First, get Groups that this person explicitly manages (as per the SessionsV2 table)
    if ('groups_managed' in patientSession) {
      patientSession.groups_managed.forEach(group => {
        let [gID, gName] = group.split('~');
        returnObject[gName.trim()] = {
          group_id: gID.trim(),
          role: 'responsible'
        };
        foundGroups.push(gID.trim());
      });
    }

    // If there are groups in the "responsible for" array, include those
    let respArray = [];
    if ('responsible_for' in patientSession) {
      if (Array.isArray(patientSession.responsible_for)) { respArray.push(...patientSession.responsible_for); }
      else if (patientSession.responsible_for.startsWith('[')) { respArray = patientSession.responsible_for.replace(/[[\s\]]/g, '').split(','); }
      else { respArray.push(patientSession.responsible_for); }
    }
    for (let g = 0; g < respArray.length; g++) {
      let group = respArray[g];
      if (!foundGroups.includes(group)) {
        let checkGroup = await getGroupDetails(pSession.client_id, group);
        if (checkGroup.hasOwnProperty('name')) {
          returnObject[checkGroup.name.trim()] = {
            group_id: group.trim(),
            role: 'responsible'
          };
          foundGroups.push(group.trim());
        }
      }
    };

    // Next, get any other Groups that this person belongs to
    var personRec = await getPerson(pPatient);
    for (let g = 0; g < personRec.groups.length; g++) {
      let group = personRec.groups[g];
      if (!foundGroups.includes(group)) {
        let checkGroup = await getGroupDetails(pSession.client_id, group);
        if (checkGroup.hasOwnProperty('name')) {
          returnObject[checkGroup.name.trim()] = {
            group_id: group.trim(),
            role: 'member'
          };
          foundGroups.push(group.trim());
        }
      }
    };

    // Finally, get open Groups that this person does not already belong to
    let openGroups = await dbClient
      .scan({
        FilterExpression: 'client_id = :c and group_type = :o',
        ExpressionAttributeValues: { ':c': pSession.client_id, ':o': 'open' },
        TableName: 'Groups',
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad query on Groups in getGroupsPersonBelongsTo - caught error is': error });
      });
    if (openGroups && ('Items' in openGroups)) {
      openGroups.Items.forEach(groupRec => {
        if (!foundGroups.includes(groupRec.group_id)) {
          returnObject[groupRec.name] =
          {
            group_id: groupRec.group_id,
            role: 'non-member'
          };
          foundGroups.push(groupRec.group_id);
        }
      });
    }

    // Sort on name
    // First - Create a sorted array of the Keys (names)
    let returnArray = Object.keys(returnObject).sort((a, b) => {
      if (a.toLowerCase() > b.toLowerCase()) { return 1; }
      else { return -1; }
    });

    //  ...then build a new Object that delivers the keys in this sorted order
    let finalObject = {};
    returnArray.forEach(key => {
      finalObject[key] = returnObject[key];
    });
    setGroupsManagedObject(finalObject);
    return finalObject;

  };

  const handleAbort = async () => {
    onClose();
  };

  // **************************

  React.useEffect(() => {
    async function prepare() {
      if (pGroup_id) {
        let gList = [];
        if (Array.isArray(pGroup_id)) {
          pGroup_id.forEach(grp => { gList.push(...(grp.replace(/[[\]]/g, '').split(/,|~/g))); });
        }
        else if (pGroup_id.includes('[')) { gList = pGroup_id.replace(/[[\]]/g, '').split(/,|~/g); }
        else { gList = [pGroup_id]; }
        setShowGroupSelect(false);
        await getGroupMemberList(gList);
        if (!(pGroup_name.trim())) {
          let gName = ``;
          if (gList.length === 1) {
            let gRec = await getGroup(gList[0], pSession.client_id);
            if (gRec && gRec.name) { gName = gRec.name; }
          }
          setGroupName(gName);
        }
      }
      else if (pSession.patient_id && (!groupsManagedObject || Object.keys(groupsManagedObject).length === 0)) {
        setShowGroupSelect(true);
        await getGroupsManagedObject(pSession.patient_id);
      }
    }
    prepare();
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (showList &&
      <Dialog
        open={showList}
        onClose={handleAbort}
        TransitionComponent={Transition}
        className={classes.pageHead}
        fullScreen
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
          <Typography className={classes.formControl} variant='h5' >
            {groupName || 'Group Maintenance'}
          </Typography>
        </Box>
        <DialogContent dividers={true} className={classes.dialogBox}>
          {groupMemberList.length === 0 && groupID &&
            <Box display='flex' marginBottom={5} flexDirection='column' justifyContent='center' alignItems='center'>
              <Typography className={classes.formControl} variant='h5' >
                {progressMessage}
              </Typography>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </div>
            </Box>
          }
          {groupMemberList.length > 0 &&
            <GroupForm
              groupMemberList={groupMemberList}
              peopleList={peopleList}
              pPatient={pSession.patient_id}
              pPatientName={pSession.patient_display_name}
              pClient={pSession.client_id}
              pGroup={groupID}
              pGroupRec={groupRec}
              pGroupName={groupName}
              pRole={groupRole}
              onReset={handleAbort}
            />
          }
        </DialogContent>
        {showGroupSelect &&
          <GroupFilter
            pSession={pSession}
            groupsManagedObject={groupsManagedObject}
            onCancel={() => {
              setShowGroupSelect(false);
              onClose();
            }}
            onSelect={async (selectedGroup) => {
              setShowGroupSelect(false);
              setGroupName(selectedGroup);
              setGroupID(groupsManagedObject[selectedGroup].group_id);
              setGroupRole(groupsManagedObject[selectedGroup].role);
              await getGroupMemberList([groupsManagedObject[selectedGroup].group_id]);
            }}
            onRefresh={async () => {
              setShowGroupSelect(true);
              await getGroupsManagedObject(pSession.patient_id);
            }}
          >
          </GroupFilter>
        }
      </Dialog>
    )
  );
};
