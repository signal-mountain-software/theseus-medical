/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getActivityData = /* GraphQL */ `
  query GetActivityData($input: ActivityDataInput) {
    getActivityData(input: $input) {
      code
      name
      color
      icon
      type
      reason
      baseline_value
      default_value
      normal_value
      numeric_minimum
      numeric_maximum
      most_recent_observation
      observation_expires
      observation_status
      observation_key
      prompt
      valid_values_list
      value_qualifiers {
        associated_activity
        value
        description
        image_url
        minimum_required
        maximum_allowed
        qualifiers
      }
      fact_history {
        person_id
        activity_key
        value
        qualifier
        status
        user_id
        session_id
        method
        posted_time
      }
    }
  }
`;

export const resourceRequest = /* GraphQL */ `
  query resourceRequest($input: ResourceRequest) {
    resourceRequest(input: $input) {
        resource_id
        resource_name
        offer_date
        time_from
    }
  }
`;

export const getActivityTypes = /* GraphQL */ `
  query GetActivityTypes($client_id: String!) {
    getActivityTypes(client_id: $client_id) {
      client_id
      activity_type_code
      default_observation_value
      description
      name
      primary_observation_key
      qualifiers {
        qualifier_description
        qualifier_observation_key
      }
    }
  }
`;

export const getCustomizations = /* GraphQL */ `
  query GetCustomizations(
    $client_id: String!
    $custom_key: String!
    ) {
    getCustomizations(
      client_id: $client_id
      custom_key: $custom_key
      ) {
      client_id
      custom_key
      icon
      color
      customization_value
    }
  }
`;

export const getCalendar = /* GraphQL */ `
  query getCalendar($input: GetCalendarInput) {
  getCalendar(input: $input) {
    body {
      id
      client
      event_key
      list_key
      calData {
        date_key
        date_key_modifier
        description
        first_date
        groups
        image
        last_date
        last_date_scheduled
        location
        max_seats
        recurrence_type
        owner
        reminder_minutes_NotEnrolled
        reminder_minutes_Enrolled
        signup_type
        time_to
        time_from
        status
        slot_visibility
      }
      occData {
        date
        description
        image
        location
        max_seats
        remaining_seats
        originally_scheduled_date
        owner
        time_to
        time_from
        signup_type
        status
      }
      schedule_key
      slots {
        reminder_minutes
        owner
        name
        id
      }
    }
    status
    message
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
export const getPeopleByGroup = /* GraphQL */ `
  query GetPeopleByGroup($client_group_id: String!, $role: String) {
    getPeopleByGroup(client_group_id: $client_group_id, role: $role) {
      person_id
      client_id
      clients {
        groups
        id
      }
      location
      search_data
      name {
        first
        last
        mi
        suffix
      }
      groups
      roles
      messaging {
        email
        sms
        voice
      }
      relationships {
        person_id
        name
        type
      }
      preferred_method
      time_based_rules {
        time_to
        time_from
        comment
        method
        day
      }
      activity_customizations {
        activity_key
        baseline
        permitted_role
      }
      priority_activities
      favorite_activities
    }
  }
`;
export const getPerson = /* GraphQL */ `
  query GetPerson($person_id: String!) {
    getPerson(person_id: $person_id) {
      person_id
      client_id
      clients {
        groups
        id
      }
      location
      search_data
      name {
        first
        last
        mi
        suffix
      }
      groups
      roles
      messaging {
        email
        surrogate
        sms
        voice
      }
      relationships {
        person_id
        name
        type
      }
      preferred_method
      time_based_rules {
        time_to
        time_from
        comment
        method
        day
      }
      activity_customizations {
        activity_key
        baseline
        permitted_role
      }
      priority_activities
      favorite_activities
    }
  }
`;
export const getRoles = /* GraphQL */ `
  query GetRoles($person_id: String!, $client_group_id: String!) {
    getRoles(person_id: $person_id, client_group_id: $client_group_id)
  }
`;
export const getGroup = /* GraphQL */ `
  query getGroup($client_group_id: String!) {
    getGroup(client_group_id: $client_group_id) { 
      display_name
      person_id
      roles
      client_group_id
    }
  }
`;
export const getSession = /* GraphQL */ `
  query GetSession($session_id: String!) {
    getSession(session_id: $session_id) {
      session_id
      client_id
      device_id
      method
      status
      user_display_name
      user_id
      patient_display_name
      patient_id
      assigned_to
      responsible_for
      current_event
      password_change_date
      platform
      description
      event_description
      kiosk_mode
      kiosk_activity
      groups_managed
    }
  }
`;
export const getReservation = /* GraphQL */ `
  query GetReservation($client_id: String!, $event_code: String!) {
    getReservation(client_id: $client_id, event_code: $event_code) {
      event_name
      available_to
      show_slots
      owner
      slot {
        display_name
        identifier
        type
        owner
        notification
      }
      expires_after
      event_code
      client_id
      version
    }
  }
`;
