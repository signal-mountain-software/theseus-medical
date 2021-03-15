import React from 'react';
import moment from 'moment';
import getLocalStorageInstance from '../_utils/getLocalStorageInstance';

const LS = getLocalStorageInstance();

const getPromptLastSeen = prompt => LS && LS.getItem(prompt);

const setPromptLastSeen = prompt => {
  const today = moment().toISOString();
  LS && LS.setItem(prompt, today);
};

const getUserShouldSeePrompt = (prompt, waitTime, unitOfTime) => {
  const lastSeen = moment(getPromptLastSeen(prompt));
  const daysSincePromptLastSeen = moment().diff(lastSeen, unitOfTime);
  return isNaN(daysSincePromptLastSeen) || daysSincePromptLastSeen > waitTime;
};

const useShouldShowPrompt = (prompt, waitTime = 3, unitOfTime = 'days') => {
  const [userShouldSeePrompt, setUserShouldSeePrompt] = React.useState(
    getUserShouldSeePrompt(prompt, waitTime, unitOfTime)
  );

  const handleInstallPromptSeen = () => {
    setUserShouldSeePrompt(false);
    setPromptLastSeen(prompt);
  };

  return [userShouldSeePrompt, handleInstallPromptSeen];
};

export default useShouldShowPrompt;
