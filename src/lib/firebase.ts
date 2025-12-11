import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBIIjl354VG-opzhRSGmofwFkfeea-BfP8",
    authDomain: "tajneed-f537c.firebaseapp.com",
    projectId: "tajneed-f537c",
    storageBucket: "tajneed-f537c.firebasestorage.app",
    messagingSenderId: "880416089122",
    appId: "1:880416089122:web:00b962299377551fa9167b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
