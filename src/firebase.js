import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "mock-demo-api-key-safe-to-expose",
  authDomain: "crm-master-demo.firebaseapp.com",
  projectId: "crm-master-demo",
  storageBucket: "crm-master-demo.appspot.com",
  messagingSenderID: "000000000000",
  appId: "1:000000000000:web:mockappid00000000"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-east4");

export const getTenantPath = (companyId, collectionName) => {
  if (!companyId) return collectionName;
  return `business/${companyId}/${collectionName}`;
};
