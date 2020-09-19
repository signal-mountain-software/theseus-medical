import React from 'react';
import Typography from '@material-ui/core/Typography';
import Section from '../Section';

export default ({ session }) => {
  const getGreeting = () => {
    const date = new Date();
    const hours = date.getHours();

    let greeting;
    if (hours >= 18) {
      greeting = 'Good Evening';
    } else if (hours >= 12) {
      greeting = 'Good Afternoon';
    } else if (hours >= 6) {
      greeting = 'Good Morning';
    } else {
      greeting = 'Good Evening';
    }
    return greeting;
  };

  return (
    <Section title='Profile'>
      {session ? (
        <>
          <Typography variant='h5' gutterBottom>
            {getGreeting()}, {session.user_display_name}!
          </Typography>
          {session.patient_id ? (
            <Typography variant='body1'>Your current patient is {session.patient_display_name}</Typography>
          ) : (
            <Typography variant='body1'>You are currently viewing your own facts</Typography>
          )}
        </>
      ) : null}
    </Section>
  );
};
