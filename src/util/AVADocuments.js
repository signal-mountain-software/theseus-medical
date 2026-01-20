import { cl, recordExists, dbClient } from './AVAUtilities';
import { addDays, makeDate } from './AVADateTime';

export async function createDocument({ docData, author }) {
    // must have client_id, pertains_to, and form_type/form_id
    if (!docData.client_id) {
        if (docData.client) {
            docData.client_id = docData.client;
        }
        else {
            return false;
        }
    };
    if (!docData.pertains_to) {
        if (docData.person_id) {
            docData.pertains_to = docData.person_id;
        }
        else {
            return false;
        }
    }
    if (!docData.form_type) {
        if (docData.form_id) {
            docData.form_type = docData.form_id;
            delete docData.form_id;
        }
        else if (docData.formType) {
            docData.form_type = docData.formType;
            delete docData.formType;
        }
        else {
            return false;
        }
    }
    const today = makeDate('today');
    let docRec = {
        document_id: `${docData.pertains_to}%%${docData.form_type}%%${docData.event_id}#${docData.occurrence}`,
        client_id_form_type: `${docData.client_id}%%${docData.form_type}`,
        history: [
            {
                last_update: today.timestamp,
                status: 'created',
                update_by: author || 'createDocument'
            }
        ],
        status: 'not_started',
        assigned_to: [docData.assigned_to].flat()
    };
    const formData = await documentDueDate(docData.client_id, docData.form_type);
    if (!docData.due_date && formData.due_date) {
        docRec.due_date = formData.due_date;
    }
    if (formData.formRec.restricted_access) {
        docRec.restricted_access = formData.formRec.restricted_access;
    }
    let goodPut = true;
    const docOut = Object.assign({}, docRec, docData);
    await dbClient
        .put({
            Item: docOut,
            TableName: 'DocumentMaster'
        })
        .promise()
        .catch(error => {
            cl(`Bad put to DocumentMaster. Error is: ${error}`);
            goodPut = false;
        });
    return (goodPut ? docOut.document_id : false);
};

export async function documentDueDate(client_id, formIn, dueDate_key) {
    let formRec;
    if (typeof (formIn) === 'string') {   // passed in a form_id
        let formRecIn = await dbClient
            .get({
                Key: {
                    client_id: client_id,
                    form_id: formIn
                },
                TableName: "Forms"
            })
            .promise()
            .catch(error => {
                cl({ [`in documentDueDate, Error reading Forms key=${formIn}`]: error });
            });
        if (!recordExists(formRecIn) || !formRecIn.Item.due_by) {
            return {
                due_date: false,
                formRec: (recordExists(formRecIn) ? formRecIn.Item : {})
            };
        }
        formRec = formRecIn.Item;
    }
    else if (Array.isArray(formIn)) {      // passed in an array of possible due dates
        formRec = { due_by: formIn };
    }
    else {
        formRec = formIn;    // passed in a whole form_rec (assumed formIn is an object)
    }
    if (!formRec.due_by) {
        return {
            due_date: false,
            formRec
        };
    }
    // due_by works like this...
    //   if due_by is single date and the date is in the future, use that date
    //   if due_by is an array of dates, take the nearest date that is in the future
    //   if due_by is a number, and docData.dueDate_key exists, add/subtract due_by to docData.dueDate_key
    //   if due_by is a number, and no docData.dueDate_key exists, add due_by to today
    let date_assigned = false;
    const today = makeDate('today');
    let temp_dueDate = today.numeric$ + 10000;     // one year from today
    for (const this_dueBy of [formRec.due_by].flat()) {
        let candidate = Number(this_dueBy);
        if ((candidate > today.numeric$) && (candidate < temp_dueDate)) {   // is it a date in the future that is earlier than the current temp_dueDate?
            temp_dueDate = candidate;
            date_assigned = true;
        }
        else if (candidate < 20000000) {   // it is not a date at all
            let checkMe = addDays((dueDate_key || today.date), candidate);
            if (checkMe.numeric$ > today.numeric$) {
                temp_dueDate = checkMe.numeric$;
                date_assigned = true;
                break;
            }
        }
    }
    return {
        due_date: (date_assigned ? temp_dueDate : false),
        formRec
    };
};

export async function updateDocument({ docData, author, isNew = false, save_type, url, pending }) {
    // save_type is one of 'final', 'in_process', 'on_timeout', 'printed', 'uploaded'
    if ((save_type === 'uploaded') && !url) {
        return false;
    }
    let docBasis = {};
    const now = new Date().getTime();
    if (!docData.document_id) {
        return false;
    }
    else {
        if (!docData.client_id) {
            if (docData.client) {
                docData.client_id = docData.client;
            }
            else {
                return false;
            }
        };
        if (!docData.pertains_to) {
            if (docData.person_id) {
                docData.pertains_to = docData.person_id;
            }
            else {
                return false;
            }
        }
        if (!docData.form_type) {
            if (docData.form_id) {
                docData.form_type = docData.form_id;
                delete docData.form_id;
            }
            else if (docData.formType) {
                docData.form_type = docData.formType;
                delete docData.formType;
            }
            else {
                return false;
            }
        }
        if (!docData.client_id || !docData.pertains_to || !docData.form_type) {
            let fetchedRec = await dbClient
                .get({
                    Key: {
                        document_id: docData.document_id
                    },
                    TableName: "DocumentMaster"
                })
                .promise()
                .catch(error => {
                    cl(`in updateDocument, bad get to DocumentMaster with ${docData.document_id || '(null)'}. Error is: ${error}`);
                });
            if (recordExists(fetchedRec)) {
                docBasis = fetchedRec.Item;
            }
        }
        else {
            docBasis = {
                document_id: docData.document_id || `${docData.pertains_to}%%${docData.form_type}%%${now}`,
                client_id_form_type: `${docData.client_id}%%${docData.form_type}`,
                history: [
                    {
                        last_update: now,
                        status: 'created',
                        update_by: author || 'updateDocument'
                    }
                ],
                status: 'not_started',
            };
        }
    }
    let docOut = Object.assign({}, docBasis, docData);
    if (isNew) {
        const formData = await documentDueDate(docOut.client_id, docOut.form_type);
        if (!docOut.due_date && formData.due_date) {
            docOut.due_date = formData.due_date;
        }
        if (formData.formRec.restricted_access) {
            docOut.restricted_access = formData.formRec.restricted_access;
        }
    }
    // save_type is one of 'save_final', 'in_process', 'on_timeout', 'printed', 'uploaded', 'cancelled'
    if (docOut.history[0].status === 'on_timeout') {
        docOut.history.splice(0, 1);
    }
    docOut.history.unshift({
        last_update: now,
        status: pending ? 'pending' : save_type,
        stage: docData.form_stage || 'unknown',
        update_by: author || 'updateDocument'
    });
    if (url) {
        docOut.history[0].url = url;
    }
    if (((save_type === 'printed') && !pending) || (save_type === 'uploaded') || (save_type === 'save_final')) {
        docOut.status = 'complete';
    }
    else {
        docOut.status = (pending ? 'pending' : 'in_process');
    }
    let goodPut = true;
    await dbClient
        .put({
            Item: docOut,
            TableName: 'DocumentMaster'
        })
        .promise()
        .catch(error => {
            cl(`Bad put to DocumentMaster. Error is: ${error}`);
            goodPut = false;
        });
    return (goodPut ? docOut : false);
};