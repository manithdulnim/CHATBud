import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAp0ywAmfphqA8BJPWRag28yYQASokHz3Q",
  authDomain: "chatbud-live.firebaseapp.com",
  projectId: "chatbud-live",
  storageBucket: "chatbud-live.firebasestorage.app",
  messagingSenderId: "355009695073",
  appId: "1:355009695073:web:c44c7130c86a35ca590920",
  measurementId: "G-F514V1Y0YX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');
const micBtn = document.getElementById('mic-btn'); // NEW Mic Button

// Auth Logic
loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (error) { console.error("Login Failed", error); } });
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

// Send Text
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return;
    const { uid, displayName } = auth.currentUser;
    try {
        await addDoc(collection(db, "messages"), { text: text, type: "text", uid: uid, displayName: displayName, createdAt: serverTimestamp() });
        messageInput.value = '';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) { console.error("Error", error); }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// Send Image
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { uid, displayName } = auth.currentUser;
    const filePath = `images/${uid}_${Date.now()}_${file.name}`;
    const uploadTask = uploadBytesResumable(ref(storage, filePath), file);

    uploadTask.on('state_changed', null, (error) => { console.error(error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "messages"), { text: "Photo", imageUrl: downloadURL, type: "image", uid: uid, displayName: displayName, createdAt: serverTimestamp() });
        imageInput.value = '';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
});

// --- NEW: Voice Note Logic ---
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        // Start Recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks);
                uploadAudio(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording'); // Starts the red pulse animation
            messageInput.placeholder = "Recording... Click mic to stop";
            messageInput.disabled = true; // Prevent typing while recording
        } catch (err) {
            console.error("Microphone access denied", err);
            alert("Please allow microphone access to send voice notes.");
        }
    } else {
        // Stop Recording
        mediaRecorder.stop();
        // Turn off the red recording light on the browser tab
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        isRecording = false;
        micBtn.classList.remove('recording');
        messageInput.placeholder = "Type a message...";
        messageInput.disabled = false;
    }
});

async function uploadAudio(blob) {
    const { uid, displayName } = auth.currentUser;
    const filePath = `audio/${uid}_${Date.now()}.webm`; // Saves as a standard web audio file
    const uploadTask = uploadBytesResumable(ref(storage, filePath), blob);

    uploadTask.on('state_changed', null, (error) => { console.error("Audio upload failed", error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "messages"), {
            text: "Voice Note",
            audioUrl: downloadURL,
            type: "audio", // Tell the UI to render an audio player
            uid: uid,
            displayName: displayName,
            createdAt: serverTimestamp()
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// Read Messages (Updated with Audio support)
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt"));

    onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = '';

        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageElement = document.createElement('div');
            
            const messageClass = message.uid === auth.currentUser.uid ? 'sent' : 'received';
            messageElement.classList.add('message', messageClass);
            
            let timeString = '';
            if (message.createdAt) {
                const date = message.createdAt.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Render Text, Image, OR Audio Player
            let contentHtml = '';
            if (message.type === 'image') {
                contentHtml = `<img src="${message.imageUrl}" class="message-image" alt="Shared photo">`;
            } else if (message.type === 'audio') {
                contentHtml = `<audio controls src="${message.audioUrl}"></audio>`; // The native HTML5 audio player
            } else {
                contentHtml = `<span class="message-text">${message.text}</span>`;
            }

            messageElement.innerHTML = `
                <span class="sender-name">${message.displayName}</span>
                ${contentHtml}
                <span class="timestamp">${timeString}</span>
            `;
            
            chatContainer.appendChild(messageElement);
        });
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}