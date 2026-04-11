import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
const backBtn = document.getElementById('back-btn'); 

// NEW: Reply Elements
const replyBanner = document.getElementById('reply-banner');
const replyToName = document.getElementById('reply-to-name');
const replyToText = document.getElementById('reply-to-text');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');

// App State
let currentChatId = null;
let unsubscribeMessages = null; 
let replyingToMessage = null; // Keeps track of what we are replying to

// --- Auth ---
loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (error) { console.error("Login Failed", error); } });
logoutBtn.addEventListener('click', () => { signOut(auth); });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await setDoc(doc(db, "users", user.uid), { uid: user.uid, displayName: user.displayName, email: user.email, lastSeen: serverTimestamp() }, { merge: true });
        loginScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userNameDisplay.textContent = user.displayName;
        loadSidebarUsers(); 
    } else {
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
        if (unsubscribeMessages) unsubscribeMessages(); 
    }
});

// --- UI / Mobile Logic ---
function loadSidebarUsers() {
    const q = query(collection(db, "users"));
    onSnapshot(q, (snapshot) => {
        usersList.innerHTML = ''; 
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (userData.uid === auth.currentUser.uid) return; 

            const userElement = document.createElement('div');
            userElement.classList.add('user-item');
            userElement.innerHTML = `<strong>${userData.displayName}</strong>`;
            
            userElement.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                userElement.classList.add('active');
                openChat(userData);
            });
            usersList.appendChild(userElement);
        });
    });
}

function openChat(otherUser) {
    const myUid = auth.currentUser.uid;
    const otherUid = otherUser.uid;
    currentChatId = [myUid, otherUid].sort().join('_');
    
    currentChatNameUI.textContent = otherUser.displayName;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    appContainer.classList.add('chat-active'); 
    cancelReply(); // Clear any pending replies when switching chats
    loadMessages(); 
}

backBtn.addEventListener('click', () => { appContainer.classList.remove('chat-active'); });

// --- NEW: Reply Logic ---
function triggerReply(msg) {
    replyingToMessage = {
        displayName: msg.displayName,
        text: msg.type === 'text' ? msg.text : (msg.type === 'image' ? '📷 Photo' : '🎤 Voice Note')
    };
    replyToName.textContent = replyingToMessage.displayName;
    replyToText.textContent = replyingToMessage.text;
    replyBanner.classList.remove('hidden');
    messageInput.focus();
}

function cancelReply() {
    replyingToMessage = null;
    replyBanner.classList.add('hidden');
}

cancelReplyBtn.addEventListener('click', cancelReply);

// --- Sending Data ---
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return; 
    const { uid, displayName } = auth.currentUser;
    try {
        // Include the reply data if it exists
        const messageData = { text: text, type: "text", uid: uid, displayName: displayName, createdAt: serverTimestamp() };
        if (replyingToMessage) messageData.replyTo = replyingToMessage;

        await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
        
        messageInput.value = ''; 
        cancelReply(); // Close banner after sending
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) { console.error(error); }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

attachBtn.addEventListener('click', () => { if (currentChatId) imageInput.click(); });
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const { uid, displayName } = auth.currentUser;
    const uploadTask = uploadBytesResumable(ref(storage, `images/${currentChatId}_${Date.now()}_${file.name}`), file);
    uploadTask.on('state_changed', null, (error) => { console.error(error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const messageData = { text: "Photo", imageUrl: downloadURL, type: "image", uid: uid, displayName: displayName, createdAt: serverTimestamp() };
        if (replyingToMessage) messageData.replyTo = replyingToMessage;
        
        await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
        imageInput.value = '';
        cancelReply();
    });
});

let mediaRecorder, audioChunks = [], isRecording = false;
micBtn.addEventListener('click', async () => {
    if (!currentChatId) return; 
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => { uploadAudio(new Blob(audioChunks)); };
            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording'); 
            messageInput.placeholder = "Recording..."; messageInput.disabled = true; 
        } catch (err) { alert("Microphone access denied."); }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
        isRecording = false;
        micBtn.classList.remove('recording');
        messageInput.placeholder = "Type a message..."; messageInput.disabled = false;
    }
});

async function uploadAudio(blob) {
    const { uid, displayName } = auth.currentUser;
    const uploadTask = uploadBytesResumable(ref(storage, `audio/${currentChatId}_${Date.now()}.webm`), blob);
    uploadTask.on('state_changed', null, (error) => { console.error(error); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const messageData = { text: "Voice Note", audioUrl: downloadURL, type: "audio", uid: uid, displayName: displayName, createdAt: serverTimestamp() };
        if (replyingToMessage) messageData.replyTo = replyingToMessage;

        await addDoc(collection(db, "chats", currentChatId, "messages"), messageData);
        cancelReply();
    });
}

// --- Reading Data & Touch Logic ---
function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    chatContainer.innerHTML = ''; 
    const q = query(collection(db, "chats", currentChatId, "messages"), orderBy("createdAt"));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatContainer.innerHTML = ''; 
        if (snapshot.empty) { chatContainer.innerHTML = `<div class="message system-msg" style="align-self: center; background: #e4e6eb;">Send a message to start the chat!</div>`; return; }

        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', message.uid === auth.currentUser.uid ? 'sent' : 'received');
            
            // Build the Quoted HTML if this message is a reply
            let quoteHtml = '';
            if (message.replyTo) {
                quoteHtml = `
                    <div class="quoted-message">
                        <span class="quoted-name">${message.replyTo.displayName}</span>
                        <span class="quoted-text">${message.replyTo.text}</span>
                    </div>
                `;
            }

            let timeString = message.createdAt ? message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            let contentHtml = message.type === 'image' ? `<img src="${message.imageUrl}" class="message-image">` : message.type === 'audio' ? `<audio controls src="${message.audioUrl}"></audio>` : `<span class="message-text">${message.text}</span>`;

            messageElement.innerHTML = `<span class="sender-name">${message.displayName}</span>${quoteHtml}${contentHtml}<span class="timestamp">${timeString}</span>`;
            
            // --- NEW: Double Click & Swipe To Reply Logic ---
            
            // For Computer: Double Click
            messageElement.addEventListener('dblclick', () => { triggerReply(message); });

            // For Phone: Swipe Right
            let startX = 0;
            let currentX = 0;

            messageElement.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            }, {passive: true});

            messageElement.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].clientX;
                const diff = currentX - startX;
                // Only allow swiping to the right, max 80px
                if (diff > 0 && diff < 80) { 
                    messageElement.style.transform = `translateX(${diff}px)`;
                    messageElement.style.transition = 'none';
                }
            }, {passive: true});

            messageElement.addEventListener('touchend', (e) => {
                const diff = currentX - startX;
                messageElement.style.transition = 'transform 0.3s ease';
                messageElement.style.transform = `translateX(0px)`;
                
                if (diff > 40) { // If pulled far enough, trigger the reply!
                    triggerReply(message);
                }
                startX = 0; currentX = 0;
            });

            chatContainer.appendChild(messageElement);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}