export const getStorage = (app) => {
  return {};
};

export const ref = (storage, path) => {
  return { path };
};

export const uploadBytes = async (storageRef, bytes) => {
  console.log("Mock Storage: Uploaded bytes to", storageRef.path);
  return { ref: storageRef };
};

export const getDownloadURL = async (storageRef) => {
  console.log("Mock Storage: Getting download URL for", storageRef.path);
  return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200"; // fallback mock image URL
};

export const getMetadata = async (storageRef) => {
  return { name: storageRef.path.split("/").pop() || "mock_file" };
};

export const uploadBytesResumable = (storageRef, bytes) => {
  console.log("Mock Storage: Resumable upload started to", storageRef.path);
  const task = {
    on: (event, next, error, complete) => {
      // simulate progress then completion
      setTimeout(() => {
        if (next) next({ bytesTransferred: 100, totalBytes: 100 });
        if (complete) complete();
      }, 100);
    },
    then: (resolve) => {
      return Promise.resolve({ ref: storageRef }).then(resolve);
    }
  };
  return task;
};

export const listAll = async (storageRef) => {
  return { items: [], prefixes: [] };
};
