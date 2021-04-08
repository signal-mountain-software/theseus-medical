import React from 'react';
import moment from 'moment';

const getPromptLastSeen = prompt => localStorage.getItem(`${prompt}PromptLastSeen`);

const setPromptLastSeen = prompt => {
  const today = moment().toISOString();
  localStorage.setItem(`${prompt}PromptLastSeen`, today);
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
