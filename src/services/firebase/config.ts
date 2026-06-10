// import { initializeApp } from 'firebase/app'
import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDFInJ7-_BTym2dleE74h681_VwgucOC3Y",
  authDomain: "loveovers-fyp.firebaseapp.com",
  projectId: "loveovers-fyp",
  storageBucket: "loveovers-fyp.firebasestorage.app",
  messagingSenderId: "743899669918",
  appId: "1:743899669918:web:76c4230df77cde5d19628f",
  measurementId: "G-YCBHCJQYML",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = initializeAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
