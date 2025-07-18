// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2-xFtKr1tX0VazxY3YvUOH4-eVeAOXeo",
  authDomain: "doc-storage-app-18400.firebaseapp.com",
  projectId: "doc-storage-app-18400",
  storageBucket: "doc-storage-app-18400.appspot.com", // ✅ not .firebasestorage.app
  messagingSenderId: "899205555082",
  appId: "1:899205555082:web:0c4f56a6d6694dac835e73",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
