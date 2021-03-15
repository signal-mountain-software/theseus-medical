import { isIOS, isIOS13, isIPad13, isIPhone13, isIPod13 } from 'react-device-detect';
import getNavigatorInstance from '../_utils/getNavigatorInstance';
import useShouldShowPrompt from './useShouldShowPrompt';

const NAV = getNavigatorInstance();

const isUsingIOS = () => {
  if (NAV && NAV.standalone) {
    // user already installed the app
    return false;
  }
  return isIOS || isIOS13 || isIPad13 || isIPhone13 || isIPod13;
};

const useIosInstallPrompt = () => {
  const [userShouldSeePrompt, handleInstallPromptSeen] = useShouldShowPrompt('iosPromptLastSeen');
  return [isUsingIOS() && userShouldSeePrompt, handleInstallPromptSeen];
};

export default useIosInstallPrompt;
