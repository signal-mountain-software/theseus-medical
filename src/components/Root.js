import React from 'react';
import { useSetRecoilState } from 'recoil';
import promptState from '../states/promptState';

const Root = ({ children }) => {
  const setPrompt = useSetRecoilState(promptState);
  const stableSetter = React.useCallback(setPrompt, [setPrompt]);

  React.useEffect(() => {
    const beforeInstallPromptListener = event => {
      event.preventDefault();
      stableSetter(event);
    };
    window.addEventListener('beforeinstallprompt', beforeInstallPromptListener);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptListener);
    };
  }, [stableSetter]);

  return <>{children}</>;
};

export default Root;
