import { useRecoilState } from 'recoil';
import promptState from '../states/promptState';
import useShowPrompt from './useShowPrompt';

const useWebPrompt = () => {
  const [prompt, setPrompt] = useRecoilState(promptState);
  const [showPrompt, onPromptViewed] = useShowPrompt('web');

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

  return [showPrompt && prompt, onDecline, onInstall];
};

export default useWebPrompt;
