import React from 'react';

import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Box from '@material-ui/core/Box';
import FolderIcon from '@material-ui/icons/Folder';
import RestoreIcon from '@material-ui/icons/Restore';
import FavoriteIcon from '@material-ui/icons/Favorite';
import LocationOnIcon from '@material-ui/icons/LocationOn';

export default () => {
  const [value, setValue] = React.useState('recents');

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box width='100%' position='fixed' bottom={0} clone>
      <BottomNavigation value={value} onChange={handleChange}>
        <BottomNavigationAction label='Recents' value='recents' icon={<RestoreIcon />} />
        <BottomNavigationAction label='Favorites' value='favorites' icon={<FavoriteIcon />} />
        <BottomNavigationAction label='Nearby' value='nearby' icon={<LocationOnIcon />} />
        <BottomNavigationAction label='Folder' value='folder' icon={<FolderIcon />} />
      </BottomNavigation>
    </Box>
  );
};
