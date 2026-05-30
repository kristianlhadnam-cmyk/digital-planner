import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyD0yliLO2WJONbnh-F41sfycS7XCv3xHzc",
  authDomain: "digital-planner-8b65e.firebaseapp.com",
  projectId: "digital-planner-8b65e",
  storageBucket: "digital-planner-8b65e.firebasestorage.app",
  messagingSenderId: "709011046690",
  appId: "1:709011046690:web:af6b97a6ee3faaeb16a57b",
  measurementId: "G-T3401PD3DP"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app);
}
export { auth };

// Initialize Firestore
export const db = getFirestore(app);
