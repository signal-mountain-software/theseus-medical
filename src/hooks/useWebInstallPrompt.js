import React from 'react';
import useShouldShowPrompt from './useShouldShowPrompt';

const useWebInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = React.useState(null);
  const [userShouldSeePrompt, handleInstallPromptSeen] = useShouldShowPrompt('webPromptLastSeen');

  React.useEffect(() => {
    const beforeInstallPromptHandler = event => {
      event.preventDefault();

      // check if user was already asked
      if (userShouldSeePrompt) {
        // store event for later use
        setInstallPromptEvent(event);
      }
    };

    window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    };
  }, [userShouldSeePrompt]);

  const onDecline = () => {
    handleInstallPromptSeen();
    setInstallPromptEvent(null);
  };

  const onInstall = () => {
    // show native prompt
    installPromptEvent.prompt();

    // decide what to do after the user chooses
    installPromptEvent.userChoice.then(choice => {
      // if user declined, don't show prompt again
      if (choice.outcome !== 'accepted') {
        handleInstallPromptSeen();
      }
      setInstallPromptEvent(null);
    });
  };

  return [installPromptEvent, onDecline, onInstall];
};

export default useWebInstallPrompt;
