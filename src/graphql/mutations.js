/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createEvents = /* GraphQL */ `
  mutation CreateEvents($input: CreateEventsInput!) {
    createEvents(input: $input) {
      client_id
      event_id
      activities {
        activity_code
        client_id
        allow_bulk_update
        expiration_minutes
        name
        normal_value
        permitted_role
      }
    }
  }
`;
export const updateEvents = /* GraphQL */ `
  mutation UpdateEvents($input: UpdateEventsInput!) {
    updateEvents(input: $input) {
      client_id
      event_id
      activities {
        activity_code
        client_id
        allow_bulk_update
        expiration_minutes
        name
        normal_value
        permitted_role
      }
    }
  }
`;
export const deleteEvents = /* GraphQL */ `
  mutation DeleteEvents($input: DeleteEventsInput!) {
    deleteEvents(input: $input) {
      client_id
      event_id
      activities
    }
  }
`;
export const createActivities = /* GraphQL */ `
  mutation CreateActivities($input: CreateActivitiesInput!) {
    createActivities(input: $input) {
      activity_code
      client_id
      allow_bulk_update
      expiration_minutes
      name
      normal_value
      permitted_role
    }
  }
`;
export const updateActivities = /* GraphQL */ `
  mutation UpdateActivities($input: UpdateActivitiesInput!) {
    updateActivities(input: $input) {
      activity_code
      client_id
      allow_bulk_update
      expiration_minutes
      name
      normal_value
      permitted_role
    }
  }
`;
export const deleteActivities = /* GraphQL */ `
  mutation DeleteActivities($input: DeleteActivitiesInput!) {
    deleteActivities(input: $input) {
      activity_code
      client_id
      allow_bulk_update
      expiration_minutes
      name
      normal_value
      permitted_role
    }
  }
`;
