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

export const updateReservation = /* GraphQL */ `
  mutation UpdateReservation($input: UpdateReservationInput!) {
    updateReservation(input: $input) {
      client_id
	    event_code
	    available_to
	    event_name
	    expires_after
	    owner
	    show_slots
      version
	    slot {
        display_name
        identifier
        type
        owner
      }
    }
  }
`;
