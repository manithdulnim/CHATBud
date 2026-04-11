import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// NEW IMPORTS: Added doc and setDoc for saving user profiles
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAp0ywAmfphqA8BJPWRag28yYQASokHz3Q",
  authDomain: "chatbud-live.firebaseapp.com",
  projectId: "chatbud-live",
  storageBucket: "chatbud-live.firebasestorage.app",
  messagingSenderId: "355009695073",
  appId: "1:355009695073:web:c44c7130c86a35ca590920"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app); 

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');
const micBtn = document.getElementById('mic-btn');
const usersList = document.getElementById('users-list');
const currentChatNameUI = document.getElementById('current-chat-name');

// App State Variables
let currentChatId = null;
let unsubscribeMessages = null; // Keeps track of the active chat listener

// -----------------------------------------
// 1. AUTHENTICATION & USER MANAGEMENT
// -----------------------------------------
loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (error) { console.error("Login Failed", error); } });
logoutBtn.addEventListener('click', () => { signOut(auth); });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Save/Update user profile in the database
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            lastSeen: serverTimestamp()
        }, { merge: true });

        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
        
        loadSidebarUsers(); // Fetch all registered users
    } else {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
        if (unsubscribeMessages) unsubscribeMessages(); // Stop listening if logged out
    }
});

// -----------------------------------------
// 2. SIDEBAR LOGIC (PRIVATE ROOMS)
// -----------------------------------------
function loadSidebarUsers() {
    const q = query(collection(db, "users"));
    
    onSnapshot(q, (snapshot) => {
        usersList.innerHTML = ''; 
        
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            
            // Don't show yourself in the sidebar
            if (userData.uid === auth.currentUser.uid) return; 

            const userElement = document.createElement('div');
            userElement.classList.add('user-item');
            userElement.innerHTML = `<strong>${userData.displayName}</strong>`;
            
            userElement.addEventListener('click', () => {
                // Highlight active user
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                userElement.classList.add('active');
                
                openChat(userData);
            });
            
            usersList.appendChild(userElement);
        });
    });
}

function openChat(otherUser) {
    // Generate the unique Room ID by sorting UIDs alphabetically
    const myUid = auth.currentUser.uid;
    const otherUid = otherUser.uid;
    currentChatId = [myUid, otherUid].sort().join('_');
    
    // Update UI
    currentChatNameUI.textContent = otherUser.displayName;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    
    loadMessages(); // Load the specific messages for this room
}

// -----------------------------------------
// 3. SENDING MESSAGES (TEXT, IMAGE, AUDIO)
// -----------------------------------------
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return; 
    
    const { uid, displayName } = auth.currentUser;
    try {
        // We now save to: chats -> [ChatID] -> messages
        await addDoc(collection(db, "chats", currentChatId, "messages"), { 
            text: text, type: "text", uid: uid, displayName: displayName, createdAt: serverTimestamp() 
        });
        messageInput.value = ''; 
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) { console.error("Error", error); }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

attachBtn.addEventListener('click', () => { if (currentChatId) imageInput.click(); });
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const { uid, displayName } = auth.currentUser;
    const filePath = `images/${currentChatId}_${Date.now()}_${file.name}`;
    const uploadTask = uploadBytesResumable(ref(storage, filePath), file);

    uploadTask.on('state_changed', null, (error) => { console.error(error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "chats", currentChatId, "messages"), { 
            text: "Photo", imageUrl: downloadURL, type: "image", uid: uid, displayName: displayName, createdAt: serverTimestamp() 
        });
        imageInput.value = '';
    });
});

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

micBtn.addEventListener('click', async () => {
    if (!currentChatId) return; // Don't record if no chat is open

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => { uploadAudio(new Blob(audioChunks)); };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording'); 
            messageInput.placeholder = "Recording... Click mic to stop";
            messageInput.disabled = true; 
        } catch (err) { alert("Microphone access denied."); }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
        isRecording = false;
        micBtn.classList.remove('recording');
        messageInput.placeholder = "Type a message...";
        messageInput.disabled = false;
    }
});

async function uploadAudio(blob) {
    const { uid, displayName } = auth.currentUser;
    const filePath = `audio/${currentChatId}_${Date.now()}.webm`; 
    const uploadTask = uploadBytesResumable(ref(storage, filePath), blob);

    uploadTask.on('state_changed', null, (error) => { console.error("Audio error", error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "chats", currentChatId, "messages"), { 
            text: "Voice Note", audioUrl: downloadURL, type: "audio", uid: uid, displayName: displayName, createdAt: serverTimestamp() 
        });
    });
}

// -----------------------------------------
// 4. READING MESSAGES 
// -----------------------------------------
function loadMessages() {
    // If we were already listening to another chat, unplug from it!
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    chatContainer.innerHTML = ''; 
    const q = query(collection(db, "chats", currentChatId, "messages"), orderBy("createdAt"));

    // Save the listener so we can unplug it later
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = ''; 

        if (snapshot.empty) {
            chatContainer.innerHTML = `<div class="message system-msg" style="align-self: center; background: #e4e6eb;">Send a message to start the chat!</div>`;
            return;
        }

        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageElement = document.createElement('div');
            
            const messageClass = message.uid === auth.currentUser.uid ? 'sent' : 'received';
            messageElement.classList.add('message', messageClass);
            
            let timeString = '';
            if (message.createdAt) {
                timeString = message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            let contentHtml = '';
            if (message.type === 'image') contentHtml = `<img src="${message.imageUrl}" class="message-image" alt="Shared photo">`;
            else if (message.type === 'audio') contentHtml = `<audio controls src="${message.audioUrl}"></audio>`; 
            else contentHtml = `<span class="message-text">${message.text}</span>`;

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