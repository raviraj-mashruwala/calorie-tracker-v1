// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPUuRUzw_MSbm00FIfWCUlMjTnPQr8Aes",
  authDomain: "calorie-tracker-v1.firebaseapp.com",
  projectId: "calorie-tracker-v1",
  storageBucket: "calorie-tracker-v1.firebasestorage.app",
  messagingSenderId: "565699947699",
  appId: "1:565699947699:web:05676c65f270fcde6cd4c6",
  measurementId: "G-ZSR72G2E7K",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
