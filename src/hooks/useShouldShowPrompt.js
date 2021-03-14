import React from 'react';
import moment from 'moment';

const promptLastSeen = prompt => typeof window !== 'undefined' && localStorage.getItem(prompt);

const setPromptLastSeen = prompt => {
  const today = moment().toISOString();
  typeof window !== 'undefined' && localStorage.setItem(prompt, today);
};

const getShouldUserBePrompted = (prompt, interval) => {
  const lastSeen = moment(promptLastSeen(prompt));
  const daysSincePromptLastSeen = moment().diff(lastSeen, 'minutes');
  return isNaN(daysSincePromptLastSeen) || daysSincePromptLastSeen > interval;
};

const useShouldShowPrompt = (prompt, interval = 5) => {
  const [userShouldSeePrompt, setUserShouldSeePrompt] = React.useState(getShouldUserBePrompted(prompt, interval));

  const handleInstallPromptSeen = () => {
    setUserShouldSeePrompt(false);
    setPromptLastSeen(prompt);
  };

  return [userShouldSeePrompt, handleInstallPromptSeen];
};

export default useShouldShowPrompt;
