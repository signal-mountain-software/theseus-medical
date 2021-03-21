import React from 'react';
import { useRecoilState } from 'recoil';
import promptState from '../_states/promptState';
import useShowPrompt from './useShowPrompt';

const useWebPrompt = () => {
  const [prompt, setPrompt] = useRecoilState(promptState);
  const stableSetPrompt = React.useCallback(setPrompt, [setPrompt]);
  const [showPrompt, onPromptViewed] = useShowPrompt('web');

  React.useEffect(() => {
    const beforeInstallPromptListener = event => {
      event.preventDefault();

      // check if user was already asked
      if (showPrompt) {
        // store event for later use
        stableSetPrompt(event);
      }
    };

    window.addEventListener('beforeinstallprompt', beforeInstallPromptListener);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptListener);
    };
  }, [showPrompt, stableSetPrompt]);

  const onDecline = () => {
    onPromptViewed();
    setPrompt(null);
  };

  const onInstall = () => {
    // show native prompt
    prompt.prompt();

    // decide what to do after the user chooses
    prompt.userChoice.then(choice => {
      // if user declined, don't show prompt again
      if (choice.outcome !== 'accepted') {
        onPromptViewed();
      }
      setPrompt(null);
    });
  };

  return [prompt, onDecline, onInstall];
};

export default useWebPrompt;
