// 1. Import Firebase functions directly from Google's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 2. Your Firebase Configuration (Get this from Firebase Console -> Project Settings)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
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

// 7. Listen for Auth State Changes (The magic that toggles the UI)
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