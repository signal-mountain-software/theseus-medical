import { isMemberOf } from './AVAGroups';
import { cl, clt, recordExists, resolveVariables } from './AVAUtilities';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

// Functions

/*
export function putMessage_nonAsync(body) {
    const goFunction = async () => {
        returnArray = await putMessage(...arguments);
    };
    let returnArray = [];
    goFunction();
    return returnArray;
}
*/

export async function makeObservationList(pObs, pSession) {
  let returnList = [];
  let returnQObj = {};
  let activityRec;
  let assignedClient = pSession.client_id;
  if (typeof (pObs) === 'string') {
    if (pObs.includes('//')) { [assignedClient, pObs] = pObs.split('//'); }
    activityRec = await getActivity(assignedClient, pObs);
  }
  else { activityRec = Object.assign({}, pObs); }
  if (activityRec && ('validation' in activityRec) && ('values' in activityRec.validation)) {
    let listLength = activityRec.validation.values.length;
    for (let v = 0; v < listLength; v++) {
      let this_entry = activityRec.validation.values[v];
      if (!this_entry.startsWith('~')) { returnList.push(this_entry); }
      else {
        // deconstruct this_entry as ~<oType>.<oKey>=<oTag>  
        // ex. ~includeobservations.todaysdinner gives 
        //     oType = includeobservations and 
        //     oKey = todaysdinner
        let oParts = this_entry.split('.');
        let oType = oParts.shift().slice(1);
        let [oKey, oTag] = oParts.join('.').split('=');
        switch (true) {
          case (oType === 'includeObservations'): {
            let [cList, cQual] = await getObservations(assignedClient, oKey);
            returnList.push(...cList);
            if (Object.keys(cQual).length > 0) { returnQObj = Object.assign(returnQObj, cQual); }
            break;
          }
          case (oType.startsWith('includeIfGroup=')): {
            // ~includeIfGroup=AVT_soft_entree:~includeObservations.soft_entree_[wednesday]"
            let [, checkGroup, useThis] = oType.split(/[=:]/g);
            cl({ checkGroup });
            if (await isMemberOf(pSession.patient_id, checkGroup)) {
              activityRec.validation.values[v] = useThis;
              v--;
            }
            break;
          }
          default: {
            returnList.push(this_entry);
          }
        }
      }
    }
    activityRec.valid_values_list = returnList;
    activityRec.value_qualifiers = returnQObj;
  }
  return {
    'activityRec': activityRec,
    'rows': returnList,
    'qualifiers': returnQObj
  };

  async function getObservations(pClient, pKey) {
    cl('in getObservations', { pClient, pKey });
    pKey = await resolveVariables(pKey, pSession);
    var observations;
    var valueList = [];
    var returnQual = {};
    observations = await dbClient
      .query({
        KeyConditionExpression: 'composite_key = :p',
        ExpressionAttributeValues: { ':p': `${pClient}~${pKey}` },
        TableName: "Observations",
        IndexName: "sort_order-index"
      })
      .promise()
      .catch(error => { cl(`***getAct 956- ERR reading Observations*** caught error is: ${error}`); });
    if (recordExists(observations)) {
      let oL = observations.Items.length;
      for (let o = 0; o < oL; o++) {
        let oRec = observations.Items[o];
        valueList.push(oRec.observation_code);
        let qualObj = { };
        if (oRec.description) { qualObj.description = oRec.description; }
        if (oRec.image_url) { qualObj.image_url = oRec.image_url; }
        if ('qualifiers' in oRec) {
          if (oRec.qualifiers.minimum_required) { qualObj.minimum_required = oRec.qualifiers.minimum_required; }
          if (oRec.qualifiers.maximum_allowed) { qualObj.maximum_allowed = oRec.qualifiers.maximum_allowed; }
          if (oRec.qualifiers.options) { qualObj.qualifiers = oRec.qualifiers.options; }
        }
        if (oRec.observation_key && !('qualifiers' in qualObj)) { 
          qualObj.qualifiers = [`~~key=${oRec.observation_key}`];
        }
        if (Object.keys(qualObj).length > 0) {
          if (!('qualifiers' in qualObj)) { qualObj.qualifiers = []; }
          qualObj.value = oRec.observation_code;
          returnQual[oRec.observation_code] = qualObj;
        }
      }
    }
    return [valueList, returnQual];
  };
}

export async function getActivity(pClient, pCode) {
  let activityRec = await dbClient
    .get({
      Key: { client_id: pClient, activity_code: pCode },
      TableName: "Activities"
    })
    .promise()
    .catch(error => { cl(`***getAct 956- ERR reading Observations*** caught error is: ${error}`); });
  if (recordExists(activityRec)) {
    return activityRec.Item
  }
  return {};
};
