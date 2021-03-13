import useShouldShowPrompt from './useShouldShowPrompt';

const isIOS = () => {
  if (typeof window !== 'undefined' && navigator.standalone) {
    // user already installed the app
    return false;
  }
  const agent = (typeof window !== 'undefined' && navigator.userAgent) || '';
  const isIPad = !!agent.match(/iPad/i);
  const isIPhone = !!agent.match(/iPhone/i);
  return isIPad || isIPhone;
};

const useIosInstallPrompt = () => {
  const [userShouldSeePrompt, handleInstallPromptSeen] = useShouldShowPrompt('iosPromptLastSeen');
  return [isIOS() && userShouldSeePrompt, handleInstallPromptSeen];
};

export default useIosInstallPrompt;
