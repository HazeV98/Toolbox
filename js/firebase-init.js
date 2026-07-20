import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAQDlKPDo7NArMtlBwpwpe5VVQDKH2bXac",
    authDomain: "suite-35b2b.firebaseapp.com",
    projectId: "suite-35b2b",
    storageBucket: "suite-35b2b.firebasestorage.app",
    messagingSenderId: "712306399383",
    appId: "1:712306399383:web:4a2dac034b54a0613b71d2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
