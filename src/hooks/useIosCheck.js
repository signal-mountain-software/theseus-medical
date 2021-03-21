import React from 'react';

const getNavigatorInstance = () => {
  if (typeof window !== 'undefined') {
    if (window.navigator || navigator) {
      return window.navigator || navigator;
    }
  }
  return false;
};

const useIosCheck = () => {
  const nav = getNavigatorInstance();

  return React.useMemo(() => {
    if (nav && nav.standalone) {
      // user already installed the app
      return false;
    }

    // check if current device is iOS/iOS 13
    return (
      nav &&
      (/iPad|iPhone|iPod/.test(nav.platform) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) &&
      !window.MSStream
    );
  }, [nav]);
};

export default useIosCheck;
