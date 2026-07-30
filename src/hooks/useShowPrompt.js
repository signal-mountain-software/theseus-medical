import React from 'react';
import moment from 'moment';

const getStorage = () => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage || null;
  }
  catch {
    return null;
  }
};

const getPromptLastSeen = prompt => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(`${prompt}PromptLastSeen`);
  }
  catch {
    return null;
  }
};

const setPromptLastSeen = prompt => {
  const today = moment().toISOString();
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(`${prompt}PromptLastSeen`, today);
  }
  catch {
    // Ignore storage write failures and keep prompt logic functional.
  }
};

const getPromptVisibility = (prompt, waitTime, unitOfTime) => {
  const lastSeen = moment(getPromptLastSeen(prompt));
  const daysSincePromptLastSeen = moment().diff(lastSeen, unitOfTime);
  return isNaN(daysSincePromptLastSeen) || daysSincePromptLastSeen > waitTime;
};

const useShowPrompt = (prompt, waitTime = 3, unitOfTime = 'days') => {
  const [showPrompt, setShowPrompt] = React.useState(false);

  const onPromptViewed = () => {
    setShowPrompt(false);
    setPromptLastSeen(prompt);
  };

  React.useEffect(() => {
    const isVisible = getPromptVisibility(prompt, waitTime, unitOfTime);
    setShowPrompt(isVisible);
  }, [prompt, waitTime, unitOfTime]);

  return [showPrompt, onPromptViewed];
};

export default useShowPrompt;
