import { isMemberOf } from './AVAGroups';
import { makeDate } from './AVADateTime';
import { cl, isObject, recordExists, resolveVariables, lambda, dbClient } from './AVAUtilities';

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

export async function getObservationItems(pObsKey) {
  if (!pObsKey) {
    return {};
  }
  let returnObj = {};
  let pObsQkey = {
    KeyConditionExpression: 'observation_key = :c',
    ExpressionAttributeValues: {
      ':c': pObsKey,
    },
    TableName: "Observation_Items",
  };
  let obsItemRec = await dbClient
    .query(pObsQkey)
    .promise()
    .catch(error => { cl('ERROR reading Observation_Items.  Caught error is:', error); });
  if (recordExists(obsItemRec)) {
    obsItemRec.Items.forEach((oiRec) => {
      returnObj[oiRec.characteristic] = oiRec;
    });
  };
  return returnObj;
}

export async function getObservationKeys(request) {
  let pObsQkey = {
    TableName: "Observation_Items",
  };
  if (typeof (request) === 'string') {
    pObsQkey.KeyConditionExpression = 'observation_key = :c';
    pObsQkey.ExpressionAttributeValues = {
      ':c': request
    };
  }
  else if (request.hasOwnProperty('characteristic')) {
    pObsQkey.IndexName = 'characteristic-index';
    pObsQkey.KeyConditionExpression = 'characteristic = :c';
    pObsQkey.ExpressionAttributeValues = {
      ':c': request.characteristic
    };
  }
  else if (request.hasOwnProperty('observation_key')) {
    pObsQkey.KeyConditionExpression = 'observation_key = :c';
    pObsQkey.ExpressionAttributeValues = {
      ':c': request.observation_key
    };
  }
  let obsItemRec = await dbClient
    .query(pObsQkey)
    .promise()
    .catch(error => { cl('ERROR reading Observation_Items.  Caught error is:', error); });
  if (recordExists(obsItemRec)) {
    return obsItemRec.Items;
  };
}

export async function getObservations(pClient, pKey, options = {}) {
  var observations;
  var valueList = [];
  var oList = [];
  var returnQual = {};
  if (options && options.date) {
    let pDate = makeDate(options.date);
    if (pDate.error) {
      return [valueList, returnQual];
    }
    observations = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c and date_key = :d',
        ExpressionAttributeValues: { ':c': pClient, ':d': pDate.ymd },
        TableName: "Observations",
        IndexName: "date_key-index"
      })
      .promise()
      .catch(error => { cl(`ERROR reading Observations by date *** caught error is: ${error}`); });
  }
  else if (options && options.always) {
    observations = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c and date_key = :d',
        ExpressionAttributeValues: { ':c': pClient, ':d': 'always' },
        TableName: "Observations",
        IndexName: "date_key-index"
      })
      .promise()
      .catch(error => { cl(`ERROR reading Observations by date *** caught error is: ${error}`); });
  }
  else {
    pKey = await resolveVariables(pKey, options.session);
    let qQ = {
      KeyConditionExpression: 'composite_key = :p',
      ExpressionAttributeValues: { ':p': `${pClient}~${pKey}` },
      TableName: "Observations",
      IndexName: "sort_order-index"
    };
    observations = await dbClient
      .query(qQ)
      .promise()
      .catch(error => { cl(`***getAct 956- ERR reading Observations*** caught error is: ${error}`, qQ); });
  }
  if (recordExists(observations)) {
    let oL = observations.Items.length;
    for (let o = 0; o < oL; o++) {
      let oRec = observations.Items[o];
      if (options && options.sort) {
        oRec.sort_key = oRec.sort_order.replace(/[\W\d]/g, '').replace('header', '.');
      }
      oList.push(oRec);
      valueList.push(oRec.observation_code);
      let qualObj = {};
      if (oRec.fee) {
        qualObj.fee = oRec.fee;
      }
      if (oRec.description) {
        qualObj.description = oRec.description;
      }
      if (oRec.image_url) {
        qualObj.image_url = oRec.image_url;
      }
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
    if (options && options.sort) {
      oList.sort((a, b) => {
        if (a.sort_key > b.sort_key) { return 1; }
        else { return -1; }
      });
      if (!options || !options.return || !(['object', 'record', 'objects', 'records'].includes(options.return))) {
        valueList = oList.map(o => { return o.observation_code; });
      }
    }
  }
  if (options && options.return && (['object', 'record', 'objects', 'records'].includes(options.return))) {
    return [oList, returnQual];
  }
  return [valueList, returnQual];
};

export async function makeObservationList(pObs, pSession, variables = {}, options = { clean: true }) {
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
      let this_entry = await resolveVariables(activityRec.validation.values[v], pSession, variables);
      if (!this_entry.startsWith('~')) { returnList.push(this_entry); }
      else {
        // deconstruct this_entry as ~<oType>.<oKey>  
        // ex. ~includeobservations.todaysdinner gives 
        //     oType = includeobservations and 
        //     oKey = todaysdinner
        let [oType, oKey] = this_entry.slice(1).split(/[.|:](.*)/);
        switch (true) {
          case (oType === 'includeObservations'): {
            let oClient = assignedClient;
            if (oKey.includes('//')) { [oClient, oKey] = oKey.split('//'); }
            let [cList, cQual] = await getObservations(oClient, oKey, { session: pSession });
            returnList.push(...cList);
            if (Object.keys(cQual).length > 0) { returnQObj = Object.assign(returnQObj, cQual); }
            break;
          }
          case (oType.startsWith('includeIfGroup=')): {
            // ~includeIfGroup=AVT_soft_entree:~includeObservations.soft_entree_[wednesday]"
            let [, checkGroup] = oType.split(/[=|:]/g);
            if (await isMemberOf(pSession.client_id, pSession.patient_id, checkGroup) && oKey) {
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
          case (oType === 'peopleList'): {
            break;
          }
          default: {
            returnList.push(this_entry);
          }
        }
      }
    }
    if (options && options.clean) {
      let cleanedList = [];
      let sortedSection = [];
      returnList.forEach(r => {
        if (r.startsWith('~')) {
          if (sortedSection.length > 0) {
            sortedSection.sort();
            cleanedList.push(...sortedSection);
            sortedSection = [];
          }
          cleanedList.push(r);
        }
        else {
          if (!sortedSection.includes(r)) {
            sortedSection.push(r);
          }
        }
      });
      if (sortedSection.length > 0) {
        sortedSection.sort();
        cleanedList.push(...sortedSection);
      }
      returnList = [...cleanedList];
    }
    activityRec.valid_values_list = returnList;
    activityRec.value_qualifiers = returnQObj;
  }
  return {
    'activityRec': activityRec,
    'rows': returnList,
    'qualifiers': returnQObj
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
      });
      let payload = { body: lObj };
      const AWS = require('aws-sdk');
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

export async function getObservationOptions(pObs) {
  let options = await dbClient
    .query({
      KeyConditionExpression: 'observation_key = :p AND characteristic = :o',
      ExpressionAttributeValues: { ':p': pObs, ':o': 'options' },
      TableName: "Observation_Items"
    })
    .promise()
    .catch(error => { cl(`Problem reading Observation_Items with key ${pObs} is: ${error}`); });
  if (recordExists(options)) { return options.Items[0].display_value; }
  else { return []; }
}

export async function getActivity(pClient, pCode) {
  let qQ = {
    Key: { client_id: pClient, activity_code: pCode },
    TableName: "Activities"
  };
  let activityRec = await dbClient
    .get(qQ)
    .promise()
    .catch(error => { cl(`***ERR reading Activity*** caught error is: ${error}`, qQ); });
  if (recordExists(activityRec)) {
    return activityRec.Item;
  }
  return {};
};

export async function getBulletinBoard(pClient, pGroup_id) {
  let response = {
    //  group_id : {
    //    groupRec,
    //    section_name: {
    //       section_sort,
    //       generic_activities_list: [{
    //         group_list_index,   
    //         link_address,
    //         link_title
    //        }, {}, ...]
    //    }
    //  }
  };
  let qQ = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': pClient },
    TableName: "Groups"
  };
  if (pGroup_id) {
    qQ.KeyConditionExpression += ' and group_id = :g';
    qQ.ExpressionAttributeValues[':g'] = pGroup_id;
  }
  let groupRecs = await dbClient
    .query(qQ)
    .promise()
    .catch(error => {
      cl(`***ERR reading Groups*** caught error is: ${error}`, qQ);
    });
  if (!recordExists(groupRecs)) {
    return {};
  }
  groupRecs.Items.forEach(groupRec => {
    let section_name = 'None';
    let section_sort = '';
    response[groupRec.group_id] = {
      groupRec
    };
    if (groupRec.common_activities && (groupRec.common_activities.length > 0)) {
      groupRec.common_activities.forEach((activity_line, aList_index) => {
        if ((typeof (activity_line) === 'string') && (activity_line.startsWith('~~'))) {
          let sectionKeys = activity_line.slice(2).split('~~');
          if (sectionKeys[1]) {
            section_name = sectionKeys[1].split('~')[0];
            section_sort = sectionKeys[0];
          }
          else {
            section_name = sectionKeys[0].split('~')[0];
            section_sort = '';
          }
        }
        else {
          let activity_name, link_address, link_title;
          if (isObject(activity_line)) {
            activity_name = activity_line.activity_code;
            link_address = activity_line.default?.link_address;
            link_title = activity_line.title;
          }
          else {
            let parsed;
            [activity_name, ...parsed] = activity_line.split('~');
            parsed.forEach(spec => {
              let [split_type, split_spec] = spec.split('=');
              if (split_type.includes('default')) {
                link_address = split_spec.trim().replace(']', '');
              }
              else if (split_type.includes('title')) {
                link_title = split_spec.trim().replace(']', '');
              }
            });
          }
          if (activity_name === 'render.generic') {
            let aObj = {
              group_list_index: aList_index,
              link_address,
              link_title
            };
            if (!response.hasOwnProperty(groupRec.group_id)) {
              response[groupRec.group_id] = {
                groupRec,
                [section_name]: {
                  section_sort,
                  generic_activities_list: [aObj]
                }
              };
            }
            else if (!response[groupRec.group_id].hasOwnProperty(section_name)) {
              response[groupRec.group_id][section_name] = {
                section_sort,
                generic_activities_list: [aObj]
              };
            }
            else {
              response[groupRec.group_id][section_name].generic_activities_list.push(aObj);
            }
          };
        }
      });
    }
  });
  return response;
};

