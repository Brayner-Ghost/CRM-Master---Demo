let currentUser = null;
try {
  const savedUser = localStorage.getItem("mock_current_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  console.error("Failed to restore mock user session:", e);
}

const listeners = [];

export const getAuth = (app) => {
  return {
    currentUser,
    _triggerStateChange(user) {
      currentUser = user;
      this.currentUser = user;
      listeners.forEach(cb => cb(user));
    }
  };
};

export const onAuthStateChanged = (auth, callback) => {
  listeners.push(callback);
  // Send current state
  callback(auth.currentUser || currentUser);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

export const signInWithEmailAndPassword = async (auth, email, password) => {
  console.log("Mock Auth: Sign-in with credentials:", email, password);
  const mockUser = {
    uid: "demo-user-123",
    email: email || "demo@crmmaster.com",
    displayName: "Usuário Demo",
    emailVerified: true
  };
  currentUser = mockUser;
  auth.currentUser = mockUser;
  try {
    localStorage.setItem("mock_current_user", JSON.stringify(mockUser));
  } catch (e) {
    console.error("Failed to save mock user session:", e);
  }
  listeners.forEach(cb => cb(mockUser));
  return { user: mockUser };
};

export const signOut = async (auth) => {
  console.log("Mock Auth: Signing out");
  currentUser = null;
  if (auth) {
    auth.currentUser = null;
  }
  try {
    localStorage.removeItem("mock_current_user");
  } catch (e) {
    console.error("Failed to clear mock user session:", e);
  }
  listeners.forEach(cb => cb(null));
  return Promise.resolve();
};

export const updatePassword = async (user, newPassword) => {
  console.log("Mock Auth: Password changed successfully in demo mode.");
  return Promise.resolve();
};

export const createUserWithEmailAndPassword = async (auth, email, password) => {
  console.log("Mock Auth: Created user:", email);
  return {
    user: {
      uid: `user-${Date.now()}`,
      email,
      displayName: email.split("@")[0]
    }
  };
};

export const sendPasswordResetEmail = async (auth, email) => {
  console.log("Mock Auth: Sent reset link to:", email);
  return Promise.resolve();
};

export const EmailAuthProvider = {
  credential: (email, password) => {
    return { providerId: "password", email, password };
  }
};

export const reauthenticateWithCredential = async (user, credential) => {
  console.log("Mock Auth: Reauthenticated successfully.");
  return Promise.resolve();
};
