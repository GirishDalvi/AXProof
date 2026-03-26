import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDD7swxN4kCAgI4ZKmuK47ew1j2MXZA3qM",
  authDomain: "axproofpro.firebaseapp.com",
  projectId: "axproofpro",
  storageBucket: "axproofpro.firebasestorage.app",
  messagingSenderId: "56973902338",
  appId: "1:56973902338:web:d4abe8b8874c96e7f71d1b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
