/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createPutFact = /* GraphQL */ `
  mutation CreatePutFact($input: CreatePutFactInput!) {
    createPutFact(input: $input) {
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
`;
export const updateSession = /* GraphQL */ `
  mutation UpdateSession($input: UpdateSessionInput!) {
    updateSession(input: $input) {
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
      description
      event_description
      kiosk_mode
    }
  }
`;
