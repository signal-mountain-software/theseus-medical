import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Checkbox, Typography } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { cl, dbClient, recordExists } from '../../util/AVAUtilities';

export default ({ currentValues, updateField }) => {

  const { state } = useSession();
  const [reactData, setReactData] = React.useState({
    initialized: false,
    loading: false,
    formsLibrary: []
  });

  const updateReactData = (newData) => {
    setReactData((prevValues) => (Object.assign({}, prevValues, newData)));
  };

  React.useEffect(() => {
    async function initialize() {
      updateReactData({ loading: true });
      let allItems = [];
      let lastKey = undefined;
      do {
        const queryParams = {
          TableName: 'Forms',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: {
            ':c': state.session.client_id
          }
        };
        if (lastKey) { queryParams.ExclusiveStartKey = lastKey; }
        const formsRec = await dbClient
          .query(queryParams)
          .promise()
          .catch((error) => {
            if (error.code === 'NetworkingError') {
              cl(`Security Violation or no Internet Connection`);
            }
            cl({ 'Error reading Forms': error });
            return null;
          });
        if (!formsRec) { break; }
        allItems = allItems.concat(formsRec.Items || []);
        lastKey = formsRec.LastEvaluatedKey;
      } while (lastKey);

      let formsLibrary = allItems.filter((formRec) => {
        return (!formRec.hasOwnProperty('active') || !!formRec.active);
      });

      formsLibrary.sort((a, b) => {
        const catA = (a.category || 'Uncategorized').toLowerCase();
        const catB = (b.category || 'Uncategorized').toLowerCase();
        if (catA < catB) { return -1; }
        if (catA > catB) { return 1; }
        const nameA = (a.form_name || a.form_id || '').toLowerCase();
        const nameB = (b.form_name || b.form_id || '').toLowerCase();
        if (nameA < nameB) { return -1; }
        if (nameA > nameB) { return 1; }
        return 0;
      });

      updateReactData({
        formsLibrary,
        loading: false,
        initialized: true
      });
    }

    initialize();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const assignedFormSet = new Set((currentValues?.Groups?.forms || []).filter(Boolean));
  const allForms = reactData.formsLibrary || [];
  const formById = {};
  allForms.forEach((formRec) => {
    formById[formRec.form_id] = formRec;
  });

  const assignedForms = (currentValues?.Groups?.forms || [])
    .filter(Boolean)
    .map((form_id) => {
      return formById[form_id] || {
        form_id,
        form_name: form_id,
        category: 'Uncategorized'
      };
    });
  const unassignedForms = allForms.filter((formRec) => !assignedFormSet.has(formRec.form_id));

  const groupByCategory = (formsList) => {
    const groupedForms = {};
    formsList.forEach((formRec) => {
      const categoryName = (formRec.category || 'Uncategorized').trim() || 'Uncategorized';
      if (!groupedForms[categoryName]) {
        groupedForms[categoryName] = [];
      }
      groupedForms[categoryName].push(formRec);
    });
    Object.keys(groupedForms).forEach((categoryName) => {
      groupedForms[categoryName].sort((a, b) => {
        const nameA = (a.form_name || a.form_id || '').toLowerCase();
        const nameB = (b.form_name || b.form_id || '').toLowerCase();
        if (nameA < nameB) { return -1; }
        if (nameA > nameB) { return 1; }
        return 0;
      });
    });
    return groupedForms;
  };

  const groupedAssigned = groupByCategory(assignedForms);
  const groupedUnassigned = groupByCategory(unassignedForms);

  const assignedCategoryList = Object.keys(groupedAssigned).sort((a, b) => a.localeCompare(b));
  const unassignedCategoryList = Object.keys(groupedUnassigned).sort((a, b) => a.localeCompare(b));

  const addFormToGroup = async (form_id) => {
    const formsSet = new Set((currentValues?.Groups?.forms || []).filter(Boolean));
    formsSet.add(form_id);
    await updateField({
      updateList: [{
        tableName: 'Groups',
        fieldName: 'forms',
        newData: Array.from(formsSet)
      }]
    });
  };

  const removeFormFromGroup = async (form_id) => {
    const newForms = (currentValues?.Groups?.forms || []).filter((thisFormID) => thisFormID !== form_id);
    await updateField({
      updateList: [{
        tableName: 'Groups',
        fieldName: 'forms',
        newData: newForms
      }]
    });
  };

  return (
    <Box
      key={'groupFormsSection_masterBox'}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Typography style={AVATextStyle({ bold: true, size: 1.2, margin: { bottom: 1 } })}>
        Group Forms
      </Typography>

      <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1 } })}>
        Forms currently in this group are listed below. Select from unassigned forms to add them to this group.
      </Typography>

      {reactData.loading &&
        <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1 } })}>
          Loading forms...
        </Typography>
      }

      {!reactData.loading &&
        <React.Fragment>
          <Typography style={AVATextStyle({ bold: true, margin: { bottom: 0.5 } })}>
            Assigned Forms ({assignedForms.length})
          </Typography>

          {(assignedForms.length === 0)
            ?
            <Typography style={AVATextStyle({ size: 0.9, margin: { left: 1, bottom: 1.2 } })}>
              None assigned yet.
            </Typography>
            :
            <Box mb={1.2}>
              {assignedCategoryList.map((categoryName) => (
                <Box key={`assigned_category_${categoryName}`} mb={1}>
                  <Typography style={AVATextStyle({ size: 0.95, bold: true, margin: { left: 0.2, bottom: 0.2 } })}>
                    {categoryName}
                  </Typography>
                  {groupedAssigned[categoryName].map((formRec) => (
                    <Box key={`assigned_form_${formRec.form_id}`} display='flex' alignItems='center' ml={1}>
                      <Checkbox
                        checked={true}
                        color='primary'
                        onChange={async () => {
                          await removeFormFromGroup(formRec.form_id);
                        }}
                      />
                      <Typography style={AVATextStyle({ size: 0.9 })}>
                        {formRec.form_name || formRec.form_id}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          }

          <Typography style={AVATextStyle({ bold: true, margin: { bottom: 0.5 } })}>
            Unassigned Forms
          </Typography>

          {(unassignedCategoryList.length === 0)
            ?
            <Typography style={AVATextStyle({ size: 0.9, margin: { left: 1 } })}>
              No additional forms available.
            </Typography>
            :
            unassignedCategoryList.map((categoryName) => (
              <Box key={`unassigned_category_${categoryName}`} mb={1}>
                <Typography style={AVATextStyle({ size: 0.95, bold: true, margin: { left: 0.2, bottom: 0.2 } })}>
                  {categoryName}
                </Typography>
                {groupedUnassigned[categoryName].map((formRec) => (
                  <Box key={`unassigned_form_${formRec.form_id}`} display='flex' alignItems='center' ml={1}>
                    <Checkbox
                      checked={false}
                      color='primary'
                      onChange={async () => {
                        await addFormToGroup(formRec.form_id);
                      }}
                    />
                    <Typography style={AVATextStyle({ size: 0.9 })}>
                      {formRec.form_name || formRec.form_id}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))
          }
        </React.Fragment>
      }
    </Box>
  );
};
