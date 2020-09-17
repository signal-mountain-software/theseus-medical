import React from 'react';
import { Link } from 'react-router-dom';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Box from '@material-ui/core/Box';

export default ({ menu, homePath }) => {
  const [value, setValue] = React.useState(homePath);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box width='100%' position='fixed' top='auto' bottom={0} zIndex={3} clone>
      <BottomNavigation value={value} onChange={handleChange}>
        {menu.map(item => (
          <BottomNavigationAction
            key={item.path}
            component={Link}
            to={item.path}
            label={item.label}
            value={item.path}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
};
