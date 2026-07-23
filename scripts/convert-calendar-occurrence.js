#!/usr/bin/env node
'use strict';

const AWS = require('aws-sdk');

function parseArgs(argv) {
  const out = {
    table: 'Calendar',
    region: process.env.AWS_REGION || 'us-east-1',
    apply: false,
    force: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);

    if (key === 'help' || key === 'h') {
      out.help = true;
      continue;
    }

    if (key === 'apply') {
      out.apply = true;
      continue;
    }
    if (key === 'force') {
      out.force = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    out[key] = next;
    i += 1;
  }

  if (out.help) {
    return out;
  }

  if (!out.client) {
    throw new Error('Missing required --client');
  }

  if (!out.event && !out.occurrence) {
    throw new Error('Missing required --event (or provide event+occurrence)');
  }

  if (out.event && out.event.includes('#') && !out.occurrence) {
    const parts = out.event.split('#');
    out.event = parts[0];
    out.occurrence = parts[1];
  }

  if (!out.event || !out.occurrence) {
    throw new Error('Both --event and --occurrence are required (or pass --event <event#occurrence>)');
  }

  return out;
}

function printUsage() {
  console.log(`Usage:
  npm run calendar:convert-occurrence -- --client <client_id> --event <event_id[#occurrence]> --occurrence <yyyymmdd> [--apply] [--force] [--region us-east-1] [--table Calendar]

Examples:
  npm run calendar:convert-occurrence -- --client demo --event abc123 --occurrence 20260723
  npm run calendar:convert-occurrence -- --client demo --event abc123#20260723 --apply

Notes:
  - Default mode is DRY RUN (no writes).
  - Use --apply to persist changes.
  - For seats/time signup types, script exits unless --force is provided.
`);
}

function titleCase(value) {
  return `${value || ''}`
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function makeOccPrefix(eventId, occurrence) {
  return `${eventId}#${occurrence}#`;
}

function participantTokenFromRow(row) {
  if (row?.slotData?.slot) return `${row.slotData.slot}`;
  const parts = `${row.event_key || ''}`.split('#');
  return parts.slice(2).join('#');
}

function statusCurrent(row) {
  return row?.slotData?.status?.current || '';
}

function isActiveStatus(status) {
  return ['selected', 'notes'].includes(status);
}

async function getAllOccurrenceSlots(docClient, table, client, eventId, occurrence) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const response = await docClient.query({
      TableName: table,
      KeyConditionExpression: 'client = :c and begins_with(event_key, :e)',
      ExpressionAttributeValues: {
        ':c': client,
        ':e': makeOccPrefix(eventId, occurrence),
      },
      ExclusiveStartKey,
    }).promise();

    items.push(...(response.Items || []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items.filter(i => i.record_type === 'slot');
}

async function getEventRecord(docClient, table, client, eventId) {
  const resp = await docClient.get({
    TableName: table,
    Key: {
      client,
      event_key: eventId,
    },
  }).promise();
  return resp.Item || null;
}

function migrationEntry(owner, note) {
  return {
    date: new Date().toISOString(),
    status: 'selected',
    owner,
    note,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }
  AWS.config.update({ region: args.region });
  const docClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

  const eventRec = await getEventRecord(docClient, args.table, args.client, args.event);
  if (!eventRec) {
    throw new Error(`Event record not found for ${args.event}`);
  }

  const signUpType = eventRec?.eventData?.sign_up?.type;
  const isPersonStyle = !['seats', 'time'].includes(signUpType);

  if (!isPersonStyle && !args.force) {
    console.log(`Signup type is '${signUpType || 'unknown'}'. No changes recommended for seats/time.`);
    console.log('Use --force to run anyway.');
    return;
  }

  const slots = await getAllOccurrenceSlots(docClient, args.table, args.client, args.event, args.occurrence);
  if (slots.length === 0) {
    console.log('No slot rows found for this occurrence.');
    return;
  }

  const peopleNameCache = new Map();
  const ownerNamesNeeded = new Set();
  const participantNamesNeeded = new Set();

  for (const row of slots) {
    const participant = participantTokenFromRow(row);
    const owner = `${row?.slotData?.owner || row?.slot_owner || ''}`;
    if (owner) ownerNamesNeeded.add(owner);
    if (participant && !participant.toLowerCase().startsWith('guest:')) participantNamesNeeded.add(participant);
  }

  async function getPersonName(token) {
    if (!token) return '';
    if (token.toLowerCase().startsWith('guest:')) {
      return titleCase(token.slice(6));
    }
    if (peopleNameCache.has(token)) {
      return peopleNameCache.get(token);
    }
    const resp = await docClient.get({
      TableName: 'People',
      Key: { person_id: token },
    }).promise();
    const p = resp.Item;
    let name = '';
    if (p?.name?.first || p?.name?.last) {
      name = `${p.name.first || ''} ${p.name.last || ''}`.trim();
    }
    if (!name) {
      name = p?.display_name || token;
    }
    peopleNameCache.set(token, name);
    return name;
  }

  for (const token of ownerNamesNeeded) {
    await getPersonName(token);
  }
  for (const token of participantNamesNeeded) {
    await getPersonName(token);
  }

  const plannedPuts = [];
  const ownerRequirements = new Map();
  const slotMapByParticipant = new Map();

  for (const row of slots) {
    const participant = participantTokenFromRow(row);
    const owner = `${row?.slotData?.owner || row?.slot_owner || ''}`;
    const currentStatus = statusCurrent(row);

    slotMapByParticipant.set(participant, row);

    if (!participant || !owner) continue;

    const participantName = participant.toLowerCase().startsWith('guest:')
      ? titleCase(participant.slice(6))
      : (peopleNameCache.get(participant) || participant);
    const ownerName = peopleNameCache.get(owner) || owner;

    const expectedDisplayName = (participant === owner) ? ownerName : participantName;

    const nextRow = JSON.parse(JSON.stringify(row));
    nextRow.slot_owner = owner;
    nextRow.slotData = nextRow.slotData || {};
    nextRow.slotData.slot = participant;
    nextRow.slotData.owner = owner;
    nextRow.slotData.display_name = expectedDisplayName;
    nextRow.slotData.name = expectedDisplayName;

    const changed = (
      (row.slot_owner !== nextRow.slot_owner)
      || (row?.slotData?.slot !== nextRow.slotData.slot)
      || (row?.slotData?.owner !== nextRow.slotData.owner)
      || (row?.slotData?.display_name !== nextRow.slotData.display_name)
      || (row?.slotData?.name !== nextRow.slotData.name)
    );

    if (changed) {
      plannedPuts.push({
        action: 'normalize-slot-row',
        key: row.event_key,
        item: nextRow,
      });
    }

    if ((participant !== owner) && isActiveStatus(currentStatus)) {
      if (!ownerRequirements.has(owner)) {
        ownerRequirements.set(owner, row);
      }
    }
  }

  for (const [owner, sourceRow] of ownerRequirements.entries()) {
    const ownerEventKey = `${args.event}#${args.occurrence}#${owner}`;
    const existingOwnerRow = slotMapByParticipant.get(owner);
    const ownerName = peopleNameCache.get(owner) || owner;
    const ownerIsActive = existingOwnerRow && isActiveStatus(statusCurrent(existingOwnerRow));

    if (ownerIsActive) {
      continue;
    }

    const baseRow = existingOwnerRow ? JSON.parse(JSON.stringify(existingOwnerRow)) : {
      client: args.client,
      event_id: args.event,
      event_key: ownerEventKey,
      occurrence_date: `${args.occurrence}`,
      record_type: 'slot',
      id: args.event,
      list_key: `${owner}#${args.occurrence}`,
      schedule_key: 'slot_data',
    };

    baseRow.slot_owner = owner;
    baseRow.slotData = baseRow.slotData || {};
    baseRow.slotData.slot = owner;
    baseRow.slotData.owner = owner;
    baseRow.slotData.display_name = ownerName;
    baseRow.slotData.name = ownerName;
    baseRow.slotData.show_this_slot = true;
    baseRow.slotData.status = baseRow.slotData.status || { current: 'selected', history: [] };
    baseRow.slotData.status.current = 'selected';
    baseRow.slotData.status.history = Array.isArray(baseRow.slotData.status.history)
      ? baseRow.slotData.status.history
      : [];
    baseRow.slotData.status.history.unshift(migrationEntry(owner, `Migrated owner self-slot from participant slot ${sourceRow.event_key}`));

    plannedPuts.push({
      action: existingOwnerRow ? 'activate-owner-self-slot' : 'create-owner-self-slot',
      key: ownerEventKey,
      item: baseRow,
    });
  }

  console.log('Calendar occurrence conversion plan:');
  console.log(JSON.stringify({
    client: args.client,
    event: args.event,
    occurrence: args.occurrence,
    signUpType: signUpType || 'unknown',
    slotsRead: slots.length,
    plannedWrites: plannedPuts.length,
    mode: args.apply ? 'APPLY' : 'DRY_RUN',
  }, null, 2));

  if (plannedPuts.length > 0) {
    console.log('\nPlanned changes:');
    for (const entry of plannedPuts) {
      console.log(`- ${entry.action}: ${entry.key}`);
    }
  }

  if (!args.apply) {
    console.log('\nDry run only. Re-run with --apply to write updates.');
    return;
  }

  for (const entry of plannedPuts) {
    await docClient.put({
      TableName: args.table,
      Item: entry.item,
    }).promise();
  }

  console.log(`\nApplied ${plannedPuts.length} write(s).`);
}

main().catch((error) => {
  console.error('Conversion failed:', error.message || error);
  process.exit(1);
});
