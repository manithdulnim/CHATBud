// 1. Import Firebase functions directly from Google's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. Your Web App's Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAp0ywAmfphqA8BJPWRag28yYQASokHz3Q",
  authDomain: "chatbud-live.firebaseapp.com",
  projectId: "chatbud-live",
  storageBucket: "chatbud-live.firebasestorage.app",
  messagingSenderId: "355009695073",
  appId: "1:355009695073:web:c44c7130c86a35ca590920",
  measurementId: "G-F514V1Y0YX"
};

// 3. Initialize Firebase, Analytics, and Auth
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 4. Get DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');

// 5. Login Function
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Failed", error);
        alert("Failed to log in. Check console for details.");
    }
});

// 6. Logout Function
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// 7. Listen for Auth State Changes (Toggles the UI)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
    } else {
        // User is signed out
        loginScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
    }
});