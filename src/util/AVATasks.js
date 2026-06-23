import { cl, clt, recordExists, uuid, dbClient, deepCopy } from './AVAUtilities';
import { makeName } from './AVAPeople';
import { getMemberList } from './AVAGroups';
import { makeDate } from './AVADateTime';
import { prepareMessage } from './AVAMessages';

// ─── TASK CRUD ────────────────────────────────────────────────────────────────

/**
 * Get all Tasks that apply to a given person and are visible to the viewer.
 *
 * applies_to  — who this task is ABOUT (the subject/patient).
 *               Entries: { type: 'person'|'group', id }
 * available_to — who is allowed to VIEW/COMPLETE the task.
 *               Entries: '*all', 'person:<id>', 'group:<id>'
 *
 * @param {string} client_id
 * @param {string} person_id   - the subject: whose tasks we want
 * @param {string} [viewer_id] - who is viewing (defaults to person_id)
 * @param {string[]} [subjectGroups] - pre-fetched groups of person_id (avoids extra DB read)
 * @returns {Promise<object[]>} filtered Task records
 */
export async function getTasksForPerson(client_id, person_id, viewer_id, subjectGroups) {
  const actualViewerId = viewer_id || person_id;

  let qParm = {
    TableName: 'Tasks',
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': client_id },
  };
  let taskRecs = await dbClient
    .query(qParm)
    .promise()
    .catch(error => { clt({ 'Error reading Tasks': error, client_id }); });
  if (!recordExists(taskRecs)) { return []; }

  // Fetch subject's group memberships (for applies_to group matching)
  let mySubjectGroups = subjectGroups;
  if (!mySubjectGroups) {
    let personRec = await dbClient
      .get({ TableName: 'People', Key: { person_id } })
      .promise()
      .catch(() => null);
    mySubjectGroups = (personRec && personRec.Item && Array.isArray(personRec.Item.groups))
      ? personRec.Item.groups
      : [];
  }

  // Fetch viewer's group memberships (for available_to group matching)
  // Reuse subject groups when viewer === subject to avoid a second DB read
  let myViewerGroups;
  if (actualViewerId === person_id) {
    myViewerGroups = mySubjectGroups;
  } else {
    let viewerRec = await dbClient
      .get({ TableName: 'People', Key: { person_id: actualViewerId } })
      .promise()
      .catch(() => null);
    myViewerGroups = (viewerRec && viewerRec.Item && Array.isArray(viewerRec.Item.groups))
      ? viewerRec.Item.groups
      : [];
  }

  return taskRecs.Items.filter(t => {
    // ── applies_to: is this task ABOUT person_id? ────────────────────────
    if (!Array.isArray(t.applies_to) || t.applies_to.length === 0) { return false; }
    const appliesToSubject = t.applies_to.some(e => {
      if (!e || !e.type || !e.id) { return false; }
      if (e.type === 'person') { return e.id === person_id; }
      if (e.type === 'group') { return mySubjectGroups.includes(e.id); }
      return false;
    });
    if (!appliesToSubject) { return false; }

    // ── available_to: is viewer_id allowed to see/complete this task? ────
    if (!Array.isArray(t.available_to)) { return false; }
    if (t.available_to.some(entry => {
      if (!entry.startsWith('!')) { return false; }
      const raw = entry.slice(1);
      if (raw === '*all') { return true; }
      if (raw.startsWith('group:')) { return myViewerGroups.includes(raw.slice(6)); }
      if (raw.startsWith('person:')) { return actualViewerId === raw.slice(7); }
      return false;
    })) { return false; }
    return t.available_to.some(entry => {
      if (entry === '*all') { return true; }
      if (entry === `person:${actualViewerId}`) { return true; }
      if (entry.startsWith('group:')) {
        const gid = entry.slice(6);
        return myViewerGroups.includes(gid);
      }
      return false;
    });
  });
}

/**
 * Get a single Task record by client_id + task_id.
 * @param {string} client_id
 * @param {string} task_id
 * @returns {Promise<object|null>}
 */
export async function getTask(client_id, task_id) {
  let rec = await dbClient
    .get({ TableName: 'Tasks', Key: { client_id, task_id } })
    .promise()
    .catch(error => { clt({ 'Error reading Task': error, client_id, task_id }); });
  return (recordExists(rec)) ? rec.Item : null;
}

/**
 * Write (create or overwrite) a Task record.
 * Generates task_id if not already present.
 * @param {object} taskRec
 * @returns {Promise<object>} the written record
 */
export async function putTask(taskRec) {
  let rec = deepCopy(taskRec);
  if (!rec.task_id) {
    rec.task_id = `task_${uuid(12)}`;
  }
  if (!rec.created_at) {
    rec.created_at = new Date().toISOString();
  }
  await dbClient
    .put({ TableName: 'Tasks', Item: rec })
    .promise()
    .catch(error => { clt({ 'Error writing Task': error, client_id: rec.client_id, task_id: rec.task_id }); });
  return rec;
}

/**
 * Permanently delete a Task record.
 * Callers are responsible for ensuring no completion data exists before calling.
 */
export async function deleteTask(client_id, task_id) {
  await dbClient
    .delete({ TableName: 'Tasks', Key: { client_id, task_id } })
    .promise()
    .catch(error => { clt({ 'Error deleting Task': error, client_id, task_id }); });
}

/**
 * Set status 'active' or 'inactive' on a task.
 * @param {string} client_id
 * @param {string} task_id
 * @param {'active'|'inactive'} status
 */
export async function setTaskStatus(client_id, task_id, status) {
  await dbClient
    .update({
      TableName: 'Tasks',
      Key: { client_id, task_id },
      UpdateExpression: 'set #s = :s',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status },
    })
    .promise()
    .catch(error => { clt({ 'Error updating Task status': error, client_id, task_id }); });
}

// ─── COMPLETION CRUD ──────────────────────────────────────────────────────────

/**
 * Get all completions for a specific task (across all people).
 * Uses the task_id-index GSI.
 * @param {string} task_id
 * @returns {Promise<object[]>}
 */
export async function getCompletionsForTask(task_id) {
  let qParm = {
    TableName: 'TaskCompletions',
    IndexName: 'by_task',
    KeyConditionExpression: 'task_id = :t',
    ExpressionAttributeValues: { ':t': task_id },
    ScanIndexForward: false,
  };
  let recs = await dbClient
    .query(qParm)
    .promise()
    .catch(error => { clt({ 'Error reading TaskCompletions by task': error, task_id }); });
  return recordExists(recs) ? recs.Items : [];
}

/**
 * Get all completions for a specific person (across all tasks).
 * Direct PK query — no GSI needed.
 * @param {string} person_id
 * @returns {Promise<object[]>}
 */
export async function getCompletionsForPerson(person_id) {
  let qParm = {
    TableName: 'TaskCompletions',
    KeyConditionExpression: 'person_id = :p',
    ExpressionAttributeValues: { ':p': person_id },
    ScanIndexForward: false,
  };
  let recs = await dbClient
    .query(qParm)
    .promise()
    .catch(error => { clt({ 'Error reading TaskCompletions by person': error, person_id }); });
  return recordExists(recs) ? recs.Items : [];
}

/**
 * Get completions for a specific person+task combination.
 * Direct PK+SK-prefix query — no GSI needed.
 * SK format is task_id#time_completed, so begins_with gives us all entries for this task.
 * @param {string} task_id
 * @param {string} person_id
 * @returns {Promise<object[]>}
 */
export async function getCompletionsForTaskAndPerson(task_id, person_id) {
  let qParm = {
    TableName: 'TaskCompletions',
    KeyConditionExpression: 'person_id = :p AND begins_with(completion_sk, :sk)',
    ExpressionAttributeValues: { ':p': person_id, ':sk': `${task_id}#` },
    ScanIndexForward: false,
  };
  let recs = await dbClient
    .query(qParm)
    .promise()
    .catch(error => { clt({ 'Error reading TaskCompletions': error, task_id, person_id }); });
  return recordExists(recs) ? recs.Items : [];
}

/**
 * Write a new completion record.
 * Builds the full snapshot of collected_data from the task's data_to_collect definition + supplied values.
 *
 * @param {object} params
 * @param {object} params.taskRec         - The full task record
 * @param {string} params.person_id       - Who this completion is for (null for group completions)
 * @param {string} [params.group_id]      - Set if is_group_completion === true
 * @param {boolean} [params.is_group_completion]
 * @param {string} params.by_whom         - person_id of the user recording the completion
 * @param {string} [params.notes]
 * @param {object} params.collectedValues - { [field_id]: value }
 * @param {string} [params.scheduled_for] - ISO timestamp of the slot this satisfies
 * @param {string} [params.source]        - 'manual'|'message_response'|'system'
 * @param {boolean} [params.is_retroactive]
 * @returns {Promise<object>} the written completion record
 */
export async function recordTaskCompletion(params) {
  const {
    taskRec,
    person_id,
    group_id,
    is_group_completion = false,
    by_whom,
    notes,
    collectedValues = {},
    scheduled_for,
    source = 'manual',
    is_retroactive = false,
  } = params;

  // Build the full snapshot with values embedded
  const collected_data = (taskRec.data_to_collect || []).map(field => ({
    field_id: field.field_id,
    prompt: field.prompt,
    value_type: field.value_type,
    ...(field.options ? { options: field.options } : {}),
    collected_value: collectedValues[field.field_id] !== undefined
      ? collectedValues[field.field_id]
      : null,
  }));

  let time_completed = new Date().toISOString();

  let completionRec = {
    // PK: person_id  SK: task_id#time_completed (enables range queries per person+task)
    person_id: person_id || null,
    completion_sk: `${taskRec.task_id}#${time_completed}`,
    date_completed: time_completed.split('T')[0],
    // retained as a plain attribute for reference (e.g. message response ingestion)
    completion_id: `comp_${uuid(12)}`,
    task_id: taskRec.task_id,
    group_id: group_id || null,
    is_group_completion,
    scheduled_for: scheduled_for || null,
    time_completed,
    by_whom,
    source,
    notes: notes || null,
    collected_data,
    is_retroactive,
  };

  await dbClient
    .put({ TableName: 'TaskCompletions', Item: completionRec })
    .promise()
    .catch(error => { clt({ 'Error writing TaskCompletion': error, completion_id: completionRec.completion_id }); });

  return completionRec;
}

// ─── GROUP EXPANSION ──────────────────────────────────────────────────────────

/**
 * Expand an applies_to or remind_who array to a flat array of person_id strings.
 * Entries can be { type: 'person', id } or { type: 'group', id }.
 * @param {object[]} targetList
 * @param {string} client_id
 * @returns {Promise<string[]>} deduplicated person_ids
 */
export async function expandTargetList(targetList, client_id) {
  if (!Array.isArray(targetList) || targetList.length === 0) { return []; }
  let personIds = new Set();
  for (let entry of targetList) {
    if (!entry || !entry.type || !entry.id) { continue; }
    if (entry.type === 'person') {
      personIds.add(entry.id);
    }
    else if (entry.type === 'group') {
      let result = await getMemberList(entry.id, client_id, { nameOnly: true });
      (result.peopleList || []).forEach(p => personIds.add(p.person_id));
    }
  }
  return Array.from(personIds);
}

// ─── REMINDERS ────────────────────────────────────────────────────────────────

/**
 * Send reminders for a task to all expanded remind_who targets.
 * Uses the AVAMessages prepareMessage infrastructure.
 *
 * @param {object} taskRec        - the full Task record
 * @param {string} client_id
 * @param {string} author_id      - person sending the reminder
 * @param {string} [scheduled_for] - ISO timestamp of the slot being reminded about
 */
export async function sendTaskReminders(taskRec, client_id, author_id, scheduled_for) {
  if (!taskRec.reminders || taskRec.reminders.length === 0) { return; }
  if (!taskRec.remind_who || taskRec.remind_who.length === 0) { return; }

  let recipientIds = await expandTargetList(taskRec.remind_who, client_id);
  if (recipientIds.length === 0) { return; }

  let scheduledText = scheduled_for
    ? ` scheduled for ${makeDate(scheduled_for).relative}`
    : '';

  for (let reminder of taskRec.reminders) {
    let method = reminder.method || 'ava_only';
    for (let person_id of recipientIds) {
      let recipientName = await makeName(person_id);
      let messageBody = {
        client: client_id,
        author: author_id,
        onBehalfOf: person_id,
        messaging: [{
          method,
          message: `Reminder: "${taskRec.description}"${scheduledText}`,
          subject: `Task Reminder`,
        }],
        ...(reminder.allow_response_as_completion ? {
          response_action: {
            type: 'task_completion',
            task_id: taskRec.task_id,
            person_id,
            scheduled_for: scheduled_for || null,
          }
        } : {}),
      };
      await prepareMessage(messageBody).catch(err => {
        cl({ 'Error sending task reminder': err, person_id, task_id: taskRec.task_id });
      });
      cl({ 'Task reminder sent': { task_id: taskRec.task_id, person_id: recipientName, method } });
    }
  }
}

// ─── STREAK CALCULATION ───────────────────────────────────────────────────────

/**
 * Calculate streaks for a person on a specific task.
 * Streak = the number of consecutive schedule periods in which the rule was satisfied.
 *
 * @param {object} taskRec
 * @param {string} person_id
 * @param {object[]} [completions]  - pre-fetched completions (omit to auto-fetch)
 * @returns {Promise<object[]>}  one result per streak_rule: { rule, current_streak, longest_streak }
 */
export async function calculateStreaks(taskRec, person_id, completions) {
  if (!Array.isArray(taskRec.streak_rules) || taskRec.streak_rules.length === 0) {
    return [];
  }
  let allCompletions = completions || await getCompletionsForTaskAndPerson(taskRec.task_id, person_id);
  // Sort oldest-first for streak counting
  let sorted = [...allCompletions].sort((a, b) =>
    new Date(a.time_completed) - new Date(b.time_completed)
  );

  let results = [];
  for (let rule of taskRec.streak_rules) {
    let current = 0;
    let longest = 0;
    let streak = 0;

    for (let comp of sorted) {
      let satisfied = false;
      switch (rule.rule_type) {
        case 'recorded': {
          // any completion where the target field has a non-null value
          let field = (comp.collected_data || []).find(f => f.field_id === rule.field_id);
          satisfied = field
            ? (field.collected_value !== null && field.collected_value !== undefined && field.collected_value !== '')
            : (comp.collected_data && comp.collected_data.length === 0)
              ? true  // no fields = boolean "recorded" task
              : false;
          // If field_id is not specified, any completion counts
          if (!rule.field_id) { satisfied = true; }
          break;
        }
        case 'threshold': {
          let field = (comp.collected_data || []).find(f => f.field_id === rule.field_id);
          if (field && field.collected_value !== null) {
            let val = Number(field.collected_value);
            switch (rule.operator) {
              case '>=': satisfied = val >= Number(rule.threshold_value); break;
              case '>':  satisfied = val >  Number(rule.threshold_value); break;
              case '<=': satisfied = val <= Number(rule.threshold_value); break;
              case '<':  satisfied = val <  Number(rule.threshold_value); break;
              case '=':
              case '==': satisfied = val === Number(rule.threshold_value); break;
              default: break;
            }
          }
          break;
        }
        case 'on_time': {
          if (comp.scheduled_for && comp.time_completed) {
            let scheduledMs = new Date(comp.scheduled_for).getTime();
            let completedMs = new Date(comp.time_completed).getTime();
            let windowMs = (rule.on_time_window_minutes || 60) * 60 * 1000;
            satisfied = (completedMs - scheduledMs) <= windowMs;
          }
          break;
        }
        default: break;
      }
      if (satisfied) {
        streak++;
        if (streak > longest) { longest = streak; }
      }
      else {
        streak = 0;
      }
    }
    current = streak;
    results.push({ rule, current_streak: current, longest_streak: longest });
  }
  return results;
}

// ─── SCHEDULE HELPERS ─────────────────────────────────────────────────────────

/**
 * Given a task's schedule, return a human-readable summary string.
 * @param {object} schedule
 * @returns {string}
 */
export function describeSchedule(schedule) {
  if (!schedule) { return 'No schedule'; }
  const { recurrence, times_of_day, dow, dom, due_date } = schedule;
  let parts = [];
  switch (recurrence) {
    case 'once': {
      parts.push(due_date ? `Once, due ${makeDate(due_date).absolute}` : 'Once');
      break;
    }
    case 'daily': {
      parts.push('Daily');
      break;
    }
    case 'weekly': {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let days = Array.isArray(dow) ? dow.map(d => dayNames[d]).join(', ') : 'every day';
      parts.push(`Weekly on ${days}`);
      break;
    }
    case 'monthly': {
      parts.push(dom ? `Monthly on the ${dom}` : 'Monthly');
      break;
    }
    default: parts.push('Unscheduled');
  }
  if (Array.isArray(times_of_day) && times_of_day.length > 0) {
    const timeTokens = times_of_day.map(t => {
      if (t === 'morning') { return 'in the morning'; }
      if (t === 'afternoon') { return 'in the afternoon'; }
      // Convert 24h HH:MM to 12h clock
      const clockMatch = typeof t === 'string' && t.match(/^(\d{1,2}):(\d{2})$/);
      if (clockMatch) {
        let h = parseInt(clockMatch[1], 10);
        const min = clockMatch[2];
        const ampm = h < 12 ? 'am' : 'pm';
        if (h === 0) { h = 12; }
        else if (h > 12) { h -= 12; }
        return `at ${h}:${min} ${ampm}`;
      }
      return `at ${t}`;
    });
    parts.push(timeTokens.join(', '));
  }
  return parts.join(' ');
}

/**
 * Determine scheduled_for slots that fall within a date range for a given task schedule.
 * Returns ISO date strings.
 * @param {object} schedule
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]}
 */
export function getScheduledSlots(schedule, startDate, endDate) {
  if (!schedule) { return []; }
  const slots = [];
  const { recurrence, times_of_day, dow, dom, due_date } = schedule;
  const timeLabels = Array.isArray(times_of_day) && times_of_day.length > 0
    ? times_of_day
    : [''];

  const addSlots = (date) => {
    timeLabels.forEach(t => {
      let slotDate = new Date(date);
      if (t && t.includes(':')) {
        let [h, m] = t.split(':').map(Number);
        slotDate.setHours(h, m, 0, 0);
      }
      slots.push(slotDate.toISOString());
    });
  };

  let cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  let end = new Date(endDate);

  switch (recurrence) {
    case 'once': {
      if (due_date) {
        let d = new Date(due_date);
        if (d >= startDate && d <= endDate) { addSlots(d); }
      }
      break;
    }
    case 'daily': {
      while (cursor <= end) {
        addSlots(cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }
    case 'weekly': {
      let targetDays = Array.isArray(dow) ? dow : [0, 1, 2, 3, 4, 5, 6];
      while (cursor <= end) {
        if (targetDays.includes(cursor.getDay())) { addSlots(cursor); }
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }
    case 'monthly': {
      while (cursor <= end) {
        if (dom && cursor.getDate() === dom) { addSlots(cursor); }
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }
    default: break;
  }
  return slots;
}

// ─── COMPLETION ROUND HELPERS ─────────────────────────────────────────────────

/**
 * Delete (hard-remove) a TaskCompletion record.
 * Used for timed undo immediately after recording.
 * @param {string} person_id
 * @param {string} completion_sk
 */
export async function deleteTaskCompletion(person_id, completion_sk) {
  await dbClient
    .delete({ TableName: 'TaskCompletions', Key: { person_id, completion_sk } })
    .promise()
    .catch(error => { clt({ 'Error deleting TaskCompletion': error, person_id, completion_sk }); });
}

/**
 * Mark a TaskCompletion record as voided (admin action; soft-delete).
 * @param {string} person_id
 * @param {string} completion_sk
 */
export async function voidTaskCompletion(person_id, completion_sk) {
  await dbClient
    .update({
      TableName: 'TaskCompletions',
      Key: { person_id, completion_sk },
      UpdateExpression: 'set voided = :v',
      ExpressionAttributeValues: { ':v': true },
    })
    .promise()
    .catch(error => { clt({ 'Error voiding TaskCompletion': error, person_id, completion_sk }); });
}

/**
 * Get all completions for a date across a list of people.
 * Queries the by_date_person GSI (PK: date_completed) and filters by the given personIds.
 * @param {string[]} personIds
 * @param {string} date  yyyy-mm-dd
 * @returns {Promise<{ [person_id]: object[] }>}
 */
export async function getCompletionsForPeopleOnDate(personIds, date) {
  let qParm = {
    TableName: 'TaskCompletions',
    IndexName: 'by_date_person',
    KeyConditionExpression: 'date_completed = :d',
    ExpressionAttributeValues: { ':d': date },
  };
  let recs = await dbClient
    .query(qParm)
    .promise()
    .catch(error => { clt({ 'Error reading TaskCompletions by date': error, date }); });
  if (!recordExists(recs)) { return {}; }
  const personSet = new Set(personIds);
  const result = {};
  for (const item of recs.Items) {
    if (!personSet.has(item.person_id)) { continue; }
    if (!result[item.person_id]) { result[item.person_id] = []; }
    result[item.person_id].push(item);
  }
  return result;
}

/**
 * Get tasks for a list of people in one batch, returning a map of person_id → task[].
 * Fetches all client tasks once and filters per person using the same applies_to / available_to
 * logic as getTasksForPerson.
 *
 * @param {string} client_id
 * @param {string[]} personIds   - subjects
 * @param {string} viewer_id     - the logged-in user performing the query
 * @param {string} [date]        - yyyy-mm-dd to filter by schedule (defaults to today)
 * @returns {Promise<{ [person_id]: object[] }>}
 */
// Named-period → minutes from midnight (used for sort order)
const TIME_OF_DAY_MINUTES = {
  morning:   7 * 60,        // 7:00 AM
  breakfast: 8 * 60,        // 8:00 AM
  midday:    12 * 60,       // 12:00 PM
  lunch:     12 * 60 + 30,  // 12:30 PM
  afternoon: 14 * 60,       // 2:00 PM
  dinner:    18 * 60,       // 6:00 PM
  bedtime:   21 * 60,       // 9:00 PM
};

/**
 * Returns a sort key (minutes from midnight) for a task's times_of_day.
 * Tasks with no time specification sort last.
 */
function timeOfDaySortKey(times_of_day) {
  if (!Array.isArray(times_of_day) || times_of_day.length === 0) { return Infinity; }
  const keys = times_of_day.map(t => {
    if (Object.prototype.hasOwnProperty.call(TIME_OF_DAY_MINUTES, t)) { return TIME_OF_DAY_MINUTES[t]; }
    const m = typeof t === 'string' && t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) { return parseInt(m[1], 10) * 60 + parseInt(m[2], 10); }
    return Infinity;
  });
  return Math.min(...keys);
}

/**
 * Whether a task is due on a given date (Option B: missing/null schedule = always show).
 * @param {object} taskRec
 * @param {string} dateStr  yyyy-mm-dd
 * @returns {boolean}
 */
export function isTaskDueOnDate(taskRec, dateStr) {
  const schedule = taskRec.schedule;
  if (!schedule || !schedule.recurrence) { return true; }
  const d = new Date(dateStr + 'T12:00:00');
  switch (schedule.recurrence) {
    case 'daily':   return true;
    case 'weekly':  return Array.isArray(schedule.dow) && schedule.dow.includes(d.getDay());
    case 'monthly': return schedule.dom === d.getDate();
    case 'once':    return schedule.due_date === dateStr;
    default:        return true;
  }
}

/**
 * @param {string} client_id
 * @param {string[]} personIds   - subjects
 * @param {string} viewer_id     - the logged-in user performing the query
 * @param {string} [date]        - yyyy-mm-dd to filter by schedule (defaults to today)
 * @returns {Promise<{ [person_id]: object[] }>}
 */
export async function getTasksForPeopleList(client_id, personIds, viewer_id, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  let taskRecs = await dbClient
    .query({
      TableName: 'Tasks',
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': client_id },
    })
    .promise()
    .catch(error => { clt({ 'Error reading Tasks for people list': error, client_id }); });
  if (!recordExists(taskRecs)) { return {}; }

  const activeTasks = taskRecs.Items.filter(t =>
    t.status !== 'inactive' && isTaskDueOnDate(t, dateStr)
  );

  // Batch-fetch all person records (viewer + all subjects) in one round-trip per 100 items.
  // DynamoDB batchGet supports up to 100 keys per request.
  const allIdsToFetch = [...new Set([viewer_id, ...personIds])];
  const personGroupsMap = {};  // { [person_id]: string[] }
  for (let i = 0; i < allIdsToFetch.length; i += 100) {
    const chunk = allIdsToFetch.slice(i, i + 100);
    const batchResult = await dbClient
      .batchGet({
        RequestItems: {
          People: {
            Keys: chunk.map(id => ({ person_id: id })),
            ProjectionExpression: 'person_id, groups',
          },
        },
      })
      .promise()
      .catch(() => null);
    for (const rec of (batchResult?.Responses?.People || [])) {
      personGroupsMap[rec.person_id] = Array.isArray(rec.groups) ? rec.groups : [];
    }
  }
  const viewerGroups = personGroupsMap[viewer_id] || [];

  const result = {};
  for (const person_id of personIds) {
    const subjectGroups = personGroupsMap[person_id] || [];
    const myViewerGroups = (viewer_id === person_id) ? subjectGroups : viewerGroups;

    result[person_id] = activeTasks.filter(t => {
      if (!Array.isArray(t.applies_to) || t.applies_to.length === 0) { return false; }
      const appliesToSubject = t.applies_to.some(e => {
        if (!e || !e.type || !e.id) { return false; }
        if (e.type === 'person') { return e.id === person_id; }
        if (e.type === 'group') { return subjectGroups.includes(e.id); }
        return false;
      });
      if (!appliesToSubject) { return false; }
      if (!Array.isArray(t.available_to)) { return false; }
      if (t.available_to.some(entry => {
        if (!entry.startsWith('!')) { return false; }
        const raw = entry.slice(1);
        if (raw === '*all') { return true; }
        if (raw.startsWith('group:')) { return myViewerGroups.includes(raw.slice(6)); }
        if (raw.startsWith('person:')) { return viewer_id === raw.slice(7); }
        return false;
      })) { return false; }
      return t.available_to.some(entry => {
        if (entry === '*all') { return true; }
        if (entry === `person:${viewer_id}`) { return true; }
        if (entry.startsWith('group:')) { return myViewerGroups.includes(entry.slice(6)); }
        return false;
      });
    }).sort((a, b) =>
      timeOfDaySortKey(a.schedule?.times_of_day) - timeOfDaySortKey(b.schedule?.times_of_day)
    );
  }

  return result;
}

// ── Task text parsing ─────────────────────────────────────────────────────────
// parseQuickActivity converts a natural-language phrase into a structured task
// schedule.  It is shared by TaskManagerSection (interactive quick-add) and
// FormFillB (rule-driven task creation on form save / stage completion).

const _TIMES_OF_DAY = ['morning', 'midday', 'afternoon', 'breakfast', 'lunch', 'dinner', 'bedtime'];

const _DAY_MAP = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function _normTime(raw) {
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) { return null; }
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2] || '0', 10);
  const meridiem = (m[3] || '').toLowerCase();
  if (meridiem === 'pm' && hours < 12) { hours += 12; }
  if (meridiem === 'am' && hours === 12) { hours = 0; }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseQuickActivity(rawText) {
  let text = rawText.trim();
  let times_of_day = [];
  let recurrence = 'daily';
  let dow = [];

  const modifierPrefix = /\b(every|each|daily|nightly|weekly|monthly)\s+/i;

  const dayKeys = Object.keys(_DAY_MAP).sort((a, b) => b.length - a.length);
  const dayPattern = new RegExp(`\\b(${dayKeys.join('|')})\\b`, 'gi');

  // Pass 1: explicit "weekly" keyword
  if (/\bweekly\b/i.test(text)) {
    recurrence = 'weekly';
    text = text.replace(/\bweekly(\s+on)?\b/i, '').replace(/\s{2,}/g, ' ').trim();
    let match;
    dayPattern.lastIndex = 0;
    while ((match = dayPattern.exec(text)) !== null) {
      const idx = _DAY_MAP[match[1].toLowerCase()];
      if (!dow.includes(idx)) { dow.push(idx); }
    }
    text = text
      .replace(new RegExp(`\\b(on|and)\\b\\s*`, 'gi'), '')
      .replace(new RegExp(`\\b(${dayKeys.join('|')})\\b`, 'gi'), '')
      .replace(/[,]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();
    if (dow.length === 0) { dow = [new Date().getDay()]; }
    dow.sort((a, b) => a - b);
  }

  // Pass 2: "every <day>" / "each <day>"
  if (recurrence === 'daily') {
    const everyDayPattern = new RegExp(
      `\\b(every|each)\\s+(${dayKeys.join('|')})((?:\\s*(?:,|and)\\s*(?:${dayKeys.join('|')}))*)\\b`,
      'gi'
    );
    const everyMatch = everyDayPattern.exec(text);
    if (everyMatch) {
      recurrence = 'weekly';
      const firstDay = _DAY_MAP[everyMatch[2].toLowerCase()];
      if (!dow.includes(firstDay)) { dow.push(firstDay); }
      const extras = everyMatch[3] || '';
      let extraMatch;
      const extraDayPattern = new RegExp(`\\b(${dayKeys.join('|')})\\b`, 'gi');
      while ((extraMatch = extraDayPattern.exec(extras)) !== null) {
        const idx = _DAY_MAP[extraMatch[1].toLowerCase()];
        if (!dow.includes(idx)) { dow.push(idx); }
      }
      text = text
        .replace(everyDayPattern, '')
        .replace(/\b(on|and)\b\s*/gi, '')
        .replace(/[,]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[,\s]+|[,\s]+$/g, '')
        .trim();
      dow.sort((a, b) => a - b);
    }
  }

  // Pass 3: "on <day>" → once, due next occurrence of that weekday
  if (recurrence === 'daily') {
    const onDayPattern = new RegExp(`\\bon\\s+(${dayKeys.join('|')})\\b`, 'i');
    const onDayMatch = text.match(onDayPattern);
    if (onDayMatch) {
      const targetDow = _DAY_MAP[onDayMatch[1].toLowerCase()];
      const today = new Date();
      const todayDow = today.getDay();
      const daysAhead = (targetDow - todayDow + 7) % 7 || 0;
      const due = new Date(today);
      due.setDate(today.getDate() + daysAhead);
      const due_date = due.toISOString().split('T')[0];
      recurrence = 'once';
      text = text.replace(onDayMatch[0], '');
      text = text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
      let early_times = [];
      const earlyClockRegex = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
      const earlyClockMatch = text.match(earlyClockRegex);
      if (earlyClockMatch) {
        const normalized = _normTime(earlyClockMatch[1].trim());
        if (normalized) {
          early_times = [normalized];
          text = text.replace(earlyClockMatch[0], '').replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
        }
      }
      if (early_times.length === 0) {
        for (const kw of _TIMES_OF_DAY) {
          const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
          if (kwRegex.test(text)) {
            early_times = [kw];
            const withPrep = new RegExp(`\\b(?:at|in)\\s+(?:the\\s+)?${kw}\\b`, 'i');
            text = withPrep.test(text) ? text.replace(withPrep, '') : text.replace(kwRegex, '');
            text = text.replace(modifierPrefix, '').replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
            break;
          }
        }
      }
      text = text.replace(/\b(every|each)\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
      return {
        description: text,
        schedule: { recurrence: 'once', times_of_day: early_times, dow: [], dom: 1, due_date },
        start_date: due_date,
      };
    }
  }

  // Pass 4: bare day names (no keyword) → weekly
  if (recurrence === 'daily') {
    const bareDayPattern = new RegExp(`\\b(${dayKeys.join('|')})\\b`, 'gi');
    let match;
    while ((match = bareDayPattern.exec(text)) !== null) {
      const idx = _DAY_MAP[match[1].toLowerCase()];
      if (!dow.includes(idx)) { dow.push(idx); }
    }
    if (dow.length > 0) {
      recurrence = 'weekly';
      text = text
        .replace(new RegExp(`\\b(and)\\b\\s*`, 'gi'), '')
        .replace(new RegExp(`\\b(${dayKeys.join('|')})\\b`, 'gi'), '')
        .replace(/[,]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[,\s]+|[,\s]+$/g, '')
        .trim();
      dow.sort((a, b) => a - b);
    }
  }

  // Normalize: if all 7 days were collected, that's just "daily"
  if (dow.length === 7 && dow.every((d, i) => d === i)) {
    recurrence = 'daily';
    dow = [];
  }

  // Strip the literal word "all" that may appear as a multi-select option value
  // (e.g. when a days-of-week field includes an "all" option)
  if (recurrence === 'daily') {
    text = text.replace(/\ball\b/gi, '').replace(/[",]+/g, '').replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
  }

  // Pass 5: extract time — strip named time from text first, but clock time wins
  let namedTimeKw = null;
  for (const kw of _TIMES_OF_DAY) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(text)) {
      namedTimeKw = kw;
      const withPrep = new RegExp(`\\b(?:at|in)\\s+(?:the\\s+)?${kw}\\b`, 'i');
      text = withPrep.test(text) ? text.replace(withPrep, '') : text.replace(regex, '');
      text = text.replace(modifierPrefix, '');
      text = text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
      break;
    }
  }

  const timeRegex = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const clockMatch = text.match(timeRegex);
  if (clockMatch) {
    const normalized = _normTime(clockMatch[1].trim());
    if (normalized) {
      times_of_day = [normalized];
      text = text.replace(clockMatch[0], '');
      text = text.replace(modifierPrefix, '');
      text = text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
    } else {
      times_of_day = namedTimeKw ? [namedTimeKw] : [];
    }
  } else {
    times_of_day = namedTimeKw ? [namedTimeKw] : [];
  }

  text = text.replace(/\b(every|each)\s*$/i, '').replace(/\s{2,}/g, ' ').trim();

  const today = new Date().toISOString().split('T')[0];
  return {
    description: text,
    schedule: { recurrence, times_of_day, dow, dom: 1, due_date: '' },
    start_date: today,
  };
}
