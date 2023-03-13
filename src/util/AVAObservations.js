import { isMemberOf } from './AVAGroups';
import { cl, recordExists, resolveVariables } from './AVAUtilities';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

const lambda = new AWS.Lambda({
  region: 'us-east-1',
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY,
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
  if (activityRec?.validation?.values) {
    let listLength = activityRec.validation.values.length;
    for (let v = 0; v < listLength; v++) {
      let this_entry = activityRec.validation.values[v];
      if (!this_entry.startsWith('~')) { returnList.push(this_entry); }
      else {
        // deconstruct this_entry as ~<oType>.<oKey>  
        // ex. ~includeobservations.todaysdinner gives 
        //     oType = includeobservations and 
        //     oKey = todaysdinner
        let [oType, oKey] = this_entry.slice(1).split(/[.|:](.*)/);
        switch (true) {
          case (oType === 'includeObservations'): {
            let [cList, cQual] = await getObservations(assignedClient, oKey);
            returnList.push(...cList);
            if (Object.keys(cQual).length > 0) { returnQObj = Object.assign(returnQObj, cQual); }
            break;
          }
          case (oType.startsWith('includeIfGroup=')): {
            // ~includeIfGroup=AVT_soft_entree:~includeObservations.soft_entree_[wednesday]"
            let [, checkGroup] = oType.split(/[=|:]/g);
            if (await isMemberOf(pSession.patient_id, checkGroup) && oKey) {
              activityRec.validation.values[v] = oKey;
              v--;
            }
            break;
          }
          case (oType === 'lambda'): {
            let [cList, cQual] = await getLambda(oKey);
            returnList.push(...cList);
            if (Object.keys(cQual).length > 0) { returnQObj = Object.assign(returnQObj, cQual); }
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
        let qualObj = {};
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

  async function getLambda(lambdaString) {
    // execute a lambda function
    // the body of the call is specified on the line itself as
    //     "~lambda:<function_name>%%{<key1>:<value1>,<key2>:<value2>,..."
    //     ex. getFileUpdateOptions%%{request_client:[client],author:[person]}
    let lCleaned = await resolveVariables(lambdaString, pSession);
    let [lFunction, lString] = lCleaned.replace(/[{|}]/g, '').split('%%');
    let rValues = [];
    let rQual = [];
    if (lString) {
      let lObj = {};
      lString.split(',').forEach(e => { 
        let [key, value] = e.split(':');
        lObj[key] = value;
      })
      let payload = { body: lObj };
      let b64 = AWS.util.base64.encode(JSON.stringify('AVAObservations'));
      var params = {
        FunctionName: lFunction,
        ClientContext: b64,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(payload)
      };
      let data = await lambda.invoke(params)
        .promise()
        .catch((err) => {
          cl('error on invoke', JSON.stringify(err));
          return [`~~${JSON.stringify(err)}`];
        });
      if (data) {
        let payloadObject = JSON.parse(data.Payload);
        if (payloadObject.response_code === 200) { rValues = [...payloadObject.response_values]; }
        if (payloadObject.response_qualifiers) { rQual = [...payloadObject.response_qualifiers]; }
      }
    }
    return [rValues, rQual];
  }
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
    return activityRec.Item;
  }
  return {};
};
