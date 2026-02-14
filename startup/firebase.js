const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");
const admin = require("firebase-admin");
const serviceAccount = require("../firebaseServiceAccountKey.json");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const decodeToken = async (idToken) => {
  const userData = await admin.auth().verifyIdToken(idToken);
  return userData;
};

const storage = getStorage(app);
module.exports = { storage, decodeToken };