export const initializeApp = (config) => {
  console.log("Firebase App Initialized in Demo Mode with config:", config);
  return {
    name: "[DEFAULT]",
    options: config,
    automaticDataCollectionEnabled: false
  };
};

export const deleteApp = async (app) => {
  console.log("Mock Firebase App Deleted in Demo Mode:", app);
};
