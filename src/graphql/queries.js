/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getActivityData = /* GraphQL */ `
  query GetActivityData($input: ActivityDataInput) {
    getActivityData(input: $input) {
      code
      name
      type
      most_recent_observation
      observation_expires
      observation_status
      normal_value
      default_value
      valid_values_list
    }
  }
`;
export const getActivities = /* GraphQL */ `
  query GetActivities($client_id: String!, $activity_code: String!) {
    getActivities(client_id: $client_id, activity_code: $activity_code) {
      activity_code
      client_id
      allow_bulk_update
      expiration_minutes
      name
      type
    }
  }
`;
export const getActivitiesByClient = /* GraphQL */ `
  query GetActivitiesByClient(
    $client_id: String!
    $filter: TableActivitiesFilterInput
    $limit: Int
    $nextToken: String
  ) {
    getActivitiesByClient(
      client_id: $client_id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        activity_code
        client_id
        allow_bulk_update
        expiration_minutes
        name
        type
      }
      nextToken
    }
  }
`;
export const getEvents = /* GraphQL */ `
  query GetEvents($client_id: String!, $event_id: String!) {
    getEvents(client_id: $client_id, event_id: $event_id) {
      client_id
      event_id
      activities {
        activity_code
        client_id
        allow_bulk_update
        expiration_minutes
        name
        type
      }
    }
  }
`;
export const getEventsByClient = /* GraphQL */ `
  query GetEventsByClient(
    $client_id: String!
    $filter: TableEventsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    getEventsByClient(
      client_id: $client_id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        client_id
        event_id
        activities
      }
      nextToken
    }
  }
`;
export const getFacts = /* GraphQL */ `
  query GetFacts($person_id: String!, $activity_key: String!) {
    getFacts(person_id: $person_id, activity_key: $activity_key) {
      activity_key
      person_id
      method
      posted_time
      qualifier
      session_id
      status
      user_id
      value
    }
  }
`;
export const getFactsByPerson = /* GraphQL */ `
  query GetFactsByPerson(
    $person_id: String!
    $filter: TableFactsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    getFactsByPerson(
      person_id: $person_id
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        activity_key
        person_id
        method
        posted_time
        qualifier
        session_id
        status
        user_id
        value
      }
      nextToken
    }
  }
`;
export const getSessions = /* GraphQL */ `
  query GetSessions($client_id: String!, $device_id: String!) {
    getSessions(client_id: $client_id, device_id: $device_id) {
      client_id
      device_id
      method
      patient_id
      current_event
      current_filter
      message
      session_id
      status
      user_id
      user_role
    }
  }
`;
export const getSessionWithFacts = /* GraphQL */ `
  query GetSessionWithFacts($client_id: String!, $device_id: String!) {
    getSessionWithFacts(client_id: $client_id, device_id: $device_id) {
      session {
        client_id
        device_id
        method
        patient_id
        current_event
        current_filter
        message
        session_id
        status
        user_id
        user_role
      }
      facts {
        activity_key
        person_id
        method
        posted_time
        qualifier
        session_id
        status
        user_id
        value
      }
    }
  }
`;
export const getSessionWithPatient = /* GraphQL */ `
  query GetSessionWithPatient($client_id: String!, $device_id: String!) {
    getSessionWithPatient(client_id: $client_id, device_id: $device_id) {
      session {
        client_id
        device_id
        method
        patient_id
        current_event
        current_filter
        message
        session_id
        status
        user_id
        user_role
      }
      patient {
        client_id
        person_id
        clients {
          groups
          id
        }
        location
        name {
          first
          last
          mi
          suffix
        }
        roles
        relationship {
          type
          person_id
        }
        messaging {
          email
          sms
        }
        preferred_method
        activity_customizations {
          activity_key
          baseline
          permitted_roles
        }
        priority_activities
        favorite_activities
      }
    }
  }
`;
