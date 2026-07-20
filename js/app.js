import { app, auth, googleProvider } from './firebase-init.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GESTIONE INSTALLAZIONE PWA ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    // Evita che Chrome mostri il prompt automatico (vecchie versioni)
    e.preventDefault();
    // Salva l'evento per poterlo attivare al click
    deferredPrompt = e;
    
    // Mostra il pulsante se il DOM è già caricato
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    // Nascondi il pulsante quando l'app viene installata con successo
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) btnInstall.classList.add('hidden');
    deferredPrompt = null;
});

// GESTIONE ADMIN
export const ADMIN_UID = "07K6IzDZTWScoi8qhpmt6OU8mxf1"; 
export let isAdmin = false;
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Referenze UI
    const splashOverlay = document.getElementById('splash-overlay');
    const authView = document.getElementById('auth-view');
    const appShell = document.getElementById('app-shell');
    const homeView = document.getElementById('view-home');
    const moduleView = document.getElementById('view-module');
    const moduleContainer = document.getElementById('module-container');
    const appTitle = document.getElementById('app-title');
    const btnBack = document.getElementById('btn-back');
    const btnAdmin = document.getElementById('btn-admin');
    const btnInstall = document.getElementById('btn-install');
    
    // Modali
    const settingsOverlay = document.getElementById('settings-overlay');
    const adminOverlay = document.getElementById('admin-overlay');

    // Se l'evento PWA è scattato prima del caricamento del DOM, mostra subito il pulsante
    if (deferredPrompt && btnInstall) {
        btnInstall.classList.remove('hidden');
    }

    // --- AZIONE CLICK INSTALLAZIONE PWA ---
    if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
            if (deferredPrompt) {
                // Mostra il prompt nativo di installazione
                deferredPrompt.prompt();
                // Attendi la risposta dell'utente
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('App installata con successo');
                }
                // Il prompt può essere usato una sola volta
                deferredPrompt = null;
                btnInstall.classList.add('hidden');
            }
        });
    }

    // --- AUTENTICAZIONE E CHECK BLOCCO ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // L'utente esiste. Verifichiamo nel DB se è bloccato.
            const userRef = doc(db, 'users', user.uid);
            
            try {
                const docSnap = await getDoc(userRef);
                
                // Se il documento esiste ed è bloccato
                if (docSnap.exists() && docSnap.data().blocked === true) {
                    await signOut(auth);
                    showAuthMessage("Il tuo account è stato bloccato dall'amministratore.", true);
                    hideSplashAndShow(authView);
                    return;
                }

                // Aggiorna data ultimo accesso sul DB
                await setDoc(userRef, {
                    email: user.email,
                    lastLogin: Date.now()
                }, { merge: true });

                // Check privilegi Admin
                isAdmin = (user.uid === ADMIN_UID);
                
                let profileText = user.email;
                if (isAdmin) {
                    profileText += ' <span style="color:var(--accent-color); font-weight:bold; font-size:0.8rem; margin-left:8px; border: 1px solid var(--accent-color); padding: 2px 6px; border-radius: 12px;">ADMIN</span>';
                    btnAdmin.classList.remove('hidden');
                    // Mostra la card del modulo Admin nella home
                    document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'flex');
                } else {
                    btnAdmin.classList.add('hidden');
                    // Nasconde la card del modulo Admin nella home
                    document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'none');
                }
                
                document.getElementById('user-profile-email').innerHTML = profileText;
                
                // Nasconde splash e mostra App
                hideSplashAndShow(appShell);

            } catch (error) {
                console.error("Errore controllo utente:", error);
                // Permettiamo l'accesso in caso di errore DB temporaneo
                hideSplashAndShow(appShell);
            }
            
        } else {
            // Utente non loggato
            isAdmin = false;
            btnAdmin.classList.add('hidden');
            // Nasconde la card del modulo Admin nella home
            document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'none');
            hideSplashAndShow(authView);
        }
    });

    function hideSplashAndShow(viewToShow) {
        // Appare la vista richiesta
        appShell.classList.add('hidden');
        authView.classList.add('hidden');
        viewToShow.classList.remove('hidden');
        
        // Fai svanire lo splash screen
        splashOverlay.classList.add('hidden');
        setTimeout(() => {
            splashOverlay.style.display = 'none';
        }, 400); // Attende la fine della transizione CSS
    }

    const emailInput = document.getElementById('auth-email');
    const pwdInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');

    function showAuthMessage(msg, isError = true) {
        errorMsg.innerText = msg;
        errorMsg.className = isError ? 'error-msg' : 'success-msg';
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        showAuthMessage('');
        try {
            await signInWithEmailAndPassword(auth, emailInput.value, pwdInput.value);
        } catch (error) {
            showAuthMessage("Errore di accesso. Controlla le credenziali.");
        }
    });

    document.getElementById('btn-register').addEventListener('click', async () => {
        if (!emailInput.value || !pwdInput.value) return showAuthMessage("Inserisci Email e Password.");
        try {
            await createUserWithEmailAndPassword(auth, emailInput.value, pwdInput.value);
            showAuthMessage("Registrazione completata!", false);
        } catch (error) {
            showAuthMessage("Errore. L'email potrebbe essere già in uso o la password troppo debole.");
        }
    });

    document.getElementById('btn-google').addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            showAuthMessage("Errore con l'accesso Google.");
        }
    });

    document.getElementById('btn-reset-pwd').addEventListener('click', async () => {
        if (!emailInput.value) return showAuthMessage("Inserisci l'email qui sopra per ripristinare la password.");
        try {
            await sendPasswordResetEmail(auth, emailInput.value);
            showAuthMessage("Email di ripristino inviata!", false);
        } catch (error) {
            showAuthMessage("Errore nell'invio dell'email.");
        }
    });


    function openModal(overlay) {
        overlay.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeModal(overlay) {
        overlay.classList.add('hidden');
        if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
            document.body.classList.remove('modal-open');
        }
    }

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(closeModal);
        }
    });

    // --- IMPOSTAZIONI UTENTE ---
    document.getElementById('btn-settings').addEventListener('click', () => {
        openModal(settingsOverlay);
        document.getElementById('theme-selector').value = localStorage.getItem('theme-pref') || 'system';
        document.getElementById('pwd-msg').innerText = '';
        document.getElementById('new-password').value = '';
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
        closeModal(settingsOverlay);
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        closeModal(settingsOverlay);
        // Riattiva lo splash
        splashOverlay.style.display = 'flex';
        setTimeout(() => splashOverlay.classList.remove('hidden'), 10);
        await signOut(auth);
    });

    document.getElementById('btn-change-pwd').addEventListener('click', async () => {
        const newPwd = document.getElementById('new-password').value;
        const msgEl = document.getElementById('pwd-msg');
        if (newPwd.length < 6) {
            msgEl.innerText = "La password deve avere almeno 6 caratteri.";
            msgEl.style.color = "#ef4444";
            return;
        }
        try {
            await updatePassword(auth.currentUser, newPwd);
            msgEl.innerText = "Password aggiornata con successo!";
            msgEl.style.color = "var(--accent-color)";
            document.getElementById('new-password').value = "";
        } catch (error) {
            msgEl.innerText = "Errore. Riavvia la sessione (esci e rientra) e riprova.";
            msgEl.style.color = "#ef4444";
        }
    });

    // --- PANNELLO ADMIN ---
    btnAdmin.addEventListener('click', () => {
        openModal(adminOverlay);
        loadAdminUsers();
    });

    document.getElementById('btn-close-admin').addEventListener('click', () => {
        closeModal(adminOverlay);
    });

    async function loadAdminUsers() {
        const container = document.getElementById('admin-users-list');
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Caricamento utenti...</p>';
        
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            container.innerHTML = '';
            
            if (querySnapshot.empty) {
                container.innerHTML = '<p style="text-align:center;">Nessun utente trovato.</p>';
                return;
            }

            querySnapshot.forEach((docSnap) => {
                const userData = docSnap.data();
                const isMe = docSnap.id === ADMIN_UID;
                const date = new Date(userData.lastLogin).toLocaleString('it-IT');
                const isBlocked = userData.blocked === true;
                
                const row = document.createElement('div');
                row.className = 'user-row';
                
                let blockBtnHTML = '';
                if (!isMe) {
                    blockBtnHTML = isBlocked 
                        ? `<button class="btn outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" data-uid="${docSnap.id}" data-action="unblock">Sblocca</button>`
                        : `<button class="btn danger outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" data-uid="${docSnap.id}" data-action="block">Blocca</button>`;
                } else {
                    blockBtnHTML = `<span style="font-size:0.8rem; color:var(--text-secondary);">Amministratore</span>`;
                }

                row.innerHTML = `
                    <div class="user-info">
                        <span class="user-email ${isBlocked ? 'error-msg' : ''}" style="text-align:left; margin:0;">${userData.email}</span>
                        <span class="user-date">Ultimo accesso: ${date}</span>
                    </div>
                    <div>${blockBtnHTML}</div>
                `;

                if (!isMe) {
                    row.querySelector('button').addEventListener('click', async (e) => {
                        const targetUid = e.target.dataset.uid;
                        const action = e.target.dataset.action;
                        const newStatus = action === 'block';
                        
                        try {
                            await updateDoc(doc(db, 'users', targetUid), { blocked: newStatus });
                            loadAdminUsers(); // Ricarica la lista per aggiornare il bottone
                        } catch (err) {
                            alert("Errore nell'aggiornamento dell'utente.");
                        }
                    });
                }

                container.appendChild(row);
            });
            
        } catch (error) {
            console.error("Errore Admin DB:", error);
            container.innerHTML = '<p style="color:red; text-align:center;">Errore di lettura dal database. Controlla le regole Firestore.</p>';
        }
    }

    // --- TEMA ---
    function applyTheme(theme) {
        if (theme === 'system') {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    function initTheme() {
        const pref = localStorage.getItem('theme-pref') || 'system';
        applyTheme(pref);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (localStorage.getItem('theme-pref') === 'system') applyTheme('system');
        });
    }

    document.getElementById('theme-selector').addEventListener('change', (e) => {
        const selected = e.target.value;
        localStorage.setItem('theme-pref', selected);
        applyTheme(selected);
    });

    // --- ROUTER MODULI (Lazy Loading) ---
    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => {
            const moduleName = card.getAttribute('data-module');
            const moduleTitle = card.querySelector('p').innerText;
            openModule(moduleName, moduleTitle);
        });
    });

    btnBack.addEventListener('click', () => { closeModule(); });

    async function openModule(moduleName, title) {
        try {
            homeView.classList.remove('active');
            homeView.classList.add('hidden');
            
            appTitle.innerText = title;
            btnBack.classList.remove('hidden');
            moduleView.classList.remove('hidden');
            
            moduleContainer.innerHTML = '<div class="module-wrapper"><div class="loader" style="margin: 2rem auto;"></div><p style="text-align:center;">Caricamento...</p></div>';
            
            const module = await import(`./modules/${moduleName}.js`);
            
            moduleContainer.innerHTML = '';
            module.init(moduleContainer);
            
            setTimeout(() => moduleView.classList.add('active'), 50);

        } catch (error) {
            console.error(`Errore caricamento modulo ${moduleName}:`, error);
            moduleContainer.innerHTML = `<div class="module-wrapper"><p style="color:red; text-align:center;">Errore nel caricamento del modulo.</p></div>`;
        }
    }

    function closeModule() {
        moduleView.classList.remove('active');
        moduleView.classList.add('hidden');
        appTitle.innerText = 'Toolbox';
        btnBack.classList.add('hidden');
        
        setTimeout(() => {
            moduleContainer.innerHTML = '';
            homeView.classList.remove('hidden');
            setTimeout(() => homeView.classList.add('active'), 50);
        }, 300);
    }
});
