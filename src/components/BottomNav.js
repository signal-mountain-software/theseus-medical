import React from 'react';

import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Box from '@material-ui/core/Box';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import ChatIcon from '@material-ui/icons/Chat';

export default () => {
  const [value, setValue] = React.useState('facts');

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box width='100%' position='fixed' top='auto' bottom={0} clone>
      <BottomNavigation value={value} onChange={handleChange}>
        <BottomNavigationAction label='Profile' value='profile' icon={<AccountCircleIcon />} />
        <BottomNavigationAction label='Facts' value='facts' icon={<AssignmentIcon />} />
        <BottomNavigationAction label='Chat' value='chat' icon={<ChatIcon />} />
      </BottomNavigation>
    </Box>
  );
};
