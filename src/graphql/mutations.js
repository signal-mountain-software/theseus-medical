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
      current_event
      device_id
      method
      patient_display_name
      patient_id
      status
      user_display_name
      user_id
      directed_action
      code_version
      full_device_id
      host_session_id
      host_user_id
      patient_activity_customizations {
        activity_key
        baseline
        permitted_role
      }
      responsible_for
      assigned_to
    }
  }
`;
