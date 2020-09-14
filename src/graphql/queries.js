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
export const getSessionWithPatient = /* GraphQL */ `
  query GetSessionWithPatient($client_id: String!, $device_id: String!) {
    getSessionWithPatient(client_id: $client_id, device_id: $device_id) {
      session {
        client_id
        device_id
        method
        patient_id
        session_id
        status
        current_filter
        directed_action
        user_id
        message
        user_display_name
        user_role
        code_version
        full_device_id
        host_session_id
        host_user_id
        patient_activity_customizations {
          activity_key
        }
        patient_display_name
        verbosity
        current_event
      }
      patient {
        person_id
        client_id
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
