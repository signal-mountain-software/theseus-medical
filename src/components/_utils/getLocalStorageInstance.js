const getLocalStorageInstance = () => {
  if (typeof window !== 'undefined') {
    if (window.localStorage || localStorage) {
      return window.localStorage || localStorage;
    }
  }
  return false;
};

export default getLocalStorageInstance;
