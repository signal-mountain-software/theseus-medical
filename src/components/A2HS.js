import React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import SvgIcon from '@material-ui/core/SvgIcon';

import useIosInstallPrompt from '../hooks/useIosInstallPrompt';
import useWebInstallPrompt from '../hooks/useWebInstallPrompt';

const A2HS = () => {
  const [iosInstallPrompt, onIosDecline] = useIosInstallPrompt();
  const [webInstallPrompt, onWebDecline, onWebInstall] = useWebInstallPrompt();

  const onCancel = () => {
    if (iosInstallPrompt) {
      onIosDecline();
    } else {
      onWebDecline();
    }
  };

  if (!(iosInstallPrompt || webInstallPrompt)) return null;

  return (
    <Dialog open={iosInstallPrompt || webInstallPrompt}>
      <DialogTitle>Install Available</DialogTitle>
      <DialogContent>
        {iosInstallPrompt ? (
          <DialogContentText>
            For iOS, tap{' '}
            <SvgIcon width='1rem' height='1rem' viewBox='0 0 1000 1000' fill='currentColor'>
              <path d='M780,290H640v35h140c19.3,0,35,15.7,35,35v560c0,19.3-15.7,35-35,35H220c-19.2,0-35-15.7-35-35V360c0-19.2,15.7-35,35-35h140v-35H220c-38.7,0-70,31.3-70,70v560c0,38.7,31.3,70,70,70h560c38.7,0,70-31.3,70-70V360C850,321.3,818.7,290,780,290z M372.5,180l110-110.2v552.7c0,9.6,7.9,17.5,17.5,17.5c9.6,0,17.5-7.9,17.5-17.5V69.8l110,110c3.5,3.5,7.9,5,12.5,5s9-1.7,12.5-5c6.8-6.8,6.8-17.9,0-24.7l-140-140c-6.8-6.8-17.9-6.8-24.7,0l-140,140c-6.8,6.8-6.8,17.9,0,24.7C354.5,186.8,365.5,186.8,372.5,180z' />
            </SvgIcon>{' '}
            then "Add to Home Screen"
          </DialogContentText>
        ) : (
          <DialogContentText>Would you like to install this application on your device?</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>No Thanks</Button>
        {webInstallPrompt && <Button onClick={onWebInstall}>Install</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default A2HS;
