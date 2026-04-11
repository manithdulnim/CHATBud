// 1. Imports (Notice we added Firebase Storage)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// NEW: Import Storage functions
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// 2. Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAp0ywAmfphqA8BJPWRag28yYQASokHz3Q",
  authDomain: "chatbud-live.firebaseapp.com",
  projectId: "chatbud-live",
  storageBucket: "chatbud-live.firebasestorage.app",
  messagingSenderId: "355009695073",
  appId: "1:355009695073:web:c44c7130c86a35ca590920",
  measurementId: "G-F514V1Y0YX"
};

// 3. Initialize Everything
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app); // NEW: Initialize Storage

// 4. DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');

// NEW: Elements for Image Upload
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');

// 5. Auth Logic
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

// 6. Send Text Message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return; 

    const { uid, displayName } = auth.currentUser;

    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            type: "text", // Specify this is a text message
            uid: uid,
            displayName: displayName,
            createdAt: serverTimestamp() 
        });
        messageInput.value = ''; 
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) { console.error("Error sending message: ", error); }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// 7. NEW: Send Image Logic
attachBtn.addEventListener('click', () => {
    imageInput.click(); // Trigger the hidden file input
});

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { uid, displayName } = auth.currentUser;
    
    // Create a unique file name to prevent overwriting
    const filePath = `images/${uid}_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);
    
    // Upload the file
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
        (snapshot) => {
            // Optional: You could add a progress bar here later
            console.log("Uploading photo...");
        }, 
        (error) => { console.error("Upload failed:", error); }, 
        async () => {
            // Upload complete! Get the URL and save to Firestore
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            await addDoc(collection(db, "messages"), {
                text: "Photo", // Fallback text
                imageUrl: downloadURL,
                type: "image", // Specify this is an image
                uid: uid,
                displayName: displayName,
                createdAt: serverTimestamp()
            });
            
            // Clear the input so you can send the same file again if wanted
            imageInput.value = '';
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    );
});

// 8. Read Messages (Updated to handle images)
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

            // Determine what to display based on the message type
            let contentHtml = '';
            if (message.type === 'image') {
                contentHtml = `<img src="${message.imageUrl}" class="message-image" alt="Shared photo">`;
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