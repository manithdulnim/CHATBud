// 1. Import Firebase Auth and Firestore from Google's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// 3. Initialize Firebase, Auth, and Firestore
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// 4. Get DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');

// 5. Auth Logic
loginBtn.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error("Login Failed", error); }
});

logoutBtn.addEventListener('click', () => { signOut(auth); });

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
        loadMessages(); 
    } else {
        loginScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
    }
});

// 6. Send Message Logic
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return; 

    const { uid, displayName } = auth.currentUser;

    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            uid: uid,
            displayName: displayName,
            createdAt: serverTimestamp() 
        });
        messageInput.value = ''; 
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        console.error("Error sending message: ", error);
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 7. Read Messages & Format Timestamps
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt"));

    onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = ''; 

        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageElement = document.createElement('div');
            
            const messageClass = message.uid === auth.currentUser.uid ? 'sent' : 'received';
            messageElement.classList.add('message', messageClass);
            
            // Format the Firebase timestamp into a readable time (e.g., 10:42 AM)
            let timeString = '';
            if (message.createdAt) {
                const date = message.createdAt.toDate(); 
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Inject the upgraded HTML structure
            messageElement.innerHTML = `
                <span class="sender-name">${message.displayName}</span>
                <span class="message-text">${message.text}</span>
                <span class="timestamp">${timeString}</span>
            `;
            
            chatContainer.appendChild(messageElement);
        });
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}