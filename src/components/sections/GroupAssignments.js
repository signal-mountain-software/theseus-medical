import React from 'react';
import useSession from '../../hooks/useSession';

import { deepCopy, isMobile } from '../../util/AVAUtilities';

import { Typography, Checkbox, Box } from '@material-ui/core';
import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, updateField, reactData, updateReactData }) => {

  const { state } = useSession();

  const isMounted = React.useRef(false);

  const updateGroupList = async (clicked_group) => {
    let foundIt = currentValues.peopleRec.groups.indexOf(clicked_group.id || clicked_group.group_id);
    if (foundIt < 0) {
      currentValues.peopleRec.groups.push(clicked_group.id || clicked_group.group_id);
      if (clicked_group.belongs_to) {
        let checkGroup = clicked_group.belongs_to;
        do {
          if (!currentValues.peopleRec.groups.includes(checkGroup)) {
            currentValues.peopleRec.groups.push(checkGroup);
          }
          let foundParent = reactData.groupObj.adminHierarchy.find(this_group => {
            return (this_group === checkGroup);
          });
          if (foundParent) {
            checkGroup = foundParent.id;
          }
          else {
            checkGroup = false;
          }
        } while (checkGroup);
      }
    }
    else {
      // remove AND remove from parent if no other children of that parent
      currentValues.peopleRec.groups.splice(foundIt, 1);
      if (clicked_group.belongs_to) {
        let checkGroup = clicked_group.belongs_to;
        do {
          let parentAt = currentValues.peopleRec.groups.indexOf(checkGroup);
          if (parentAt > -1) {
            // get a list of other groups that belong to the checkgroup (parent)
            let sibling_exists = reactData.groupObj.adminHierarchy.some(test_group => {
              return ((test_group.belongs_to === checkGroup)
                && (currentValues.peopleRec.groups.includes(test_group.id)));
            });
            if (!sibling_exists) {
              currentValues.peopleRec.groups.splice(parentAt, 1);
            }
          }
          let foundParent = reactData.groupObj.adminHierarchy.find(this_group => {
            return (this_group === checkGroup);
          });
          if (foundParent) {
            checkGroup = foundParent.id;
          }
          else {
            checkGroup = false;
          }
        } while (checkGroup);
      }
    }
    await updateField({
      updateList:
        [{
          tableName: 'peopleRec',
          fieldName: 'groups',
          newData: currentValues.peopleRec.groups
        },
        {
          tableName: 'peopleRec',
          fieldName: 'clients.groups',
          newData: currentValues.peopleRec.groups
        },
        {
          tableName: 'peopleRec',
          fieldName: 'clients.id',
          newData: currentValues.peopleRec.client_id
        }]
    });
  };

  React.useEffect(() => {
    async function initialize() {
      if (!reactData.groupObj) {
        if (!state.groups) {
          if (isMounted.current) {
            updateReactData({
              alert: {
                severity: 'warning',
                title: 'Still loading Group information',
                message: `AVA is still loading.  Wait just a moment and try again, please.`
              }
            }, true);
          }
        }
        else {
          updateReactData({
            groupObj: deepCopy(state.groups)
          }, true);
        }
      }
    }
    isMounted.current = true;
    initialize();
    return () => { isMounted.current = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      key={`GroupSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {reactData.groupObj && <React.Fragment>
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { left: 0 },
            padding: { left: 0 }
          })}
        >
          {`Administrative Groups`}
        </Typography>
        <Box display='flex'
          marginLeft='0px'
          marginTop='8px'
          flexDirection='column' justifyContent='center' alignItems='flex-start'
        >
          {reactData.groupObj.adminHierarchy.map((gObj, ndx) => (
            <Box
              display='flex'
              style={{ height: 40, marginLeft: `${gObj.level * (isMobile() ? 16 : 24) - (gObj.selectable ? 8 : 0)}px` }}
              flexDirection='row' justifyContent='flex-start'
              alignItems='center'
              key={`admin-${ndx}`}
            >
              {gObj.selectable &&
                <Checkbox
                  size="small"
                  onClick={async () => { await updateGroupList(gObj); }}
                  checked={currentValues.peopleRec.groups.includes(gObj.id)}
                />
              }
              <Typography style={AVATextStyle({
                margin: { left: 0 },
                padding: { left: 0 },
                bold: currentValues.peopleRec.groups.includes(gObj.id)
              })}
              >
                {gObj.name}
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography style={
          AVATextStyle({
            size: 1.2,
            margin: { top: 1, left: 0 },
            padding: { left: 0 }
          })}
        >
          {`Public (optional) Groups`}
        </Typography>
        <Typography style={
          AVATextStyle({
            size: 0.8,
            margin: { top: 0.5, left: 0 },
            padding: { left: 0 }
          })}
        >
          {(Object.keys(reactData.groupObj.publicGroups).length > 0)
            ? `Choose any from this list you're interested in`
            : `No Public Groups are available at this time`
          }
        </Typography>
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          {Object.keys(reactData.groupObj.publicGroups).map((gID, ndx) => (
            <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
              alignItems='center' flexWrap='wrap' key={`public-${ndx}`}
            >
              <Checkbox
                size="small"
                onClick={async () => { await updateGroupList(reactData.groupObj.publicGroups[gID]); }}
                checked={currentValues.peopleRec.groups.includes(gID)}
              />
              <Typography style={
                AVATextStyle({
                  margin: { left: 0.5 },
                  padding: { left: 0 },
                  bold: reactData.groupObj.publicGroups[gID].role.startsWith('resp')
                })
              }>
                {reactData.groupObj.publicGroups[gID].group_name}
              </Typography>
            </Box>
          ))}
        </Box>
      </React.Fragment>}
    </Box>
  );
};