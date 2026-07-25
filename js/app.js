import { app, auth, googleProvider } from './firebase-init.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GESTIONE INSTALLAZIONE PWA ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
        btnInstall.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) btnInstall.classList.add('hidden');
    deferredPrompt = null;
});

// GESTIONE ADMIN E STATO GLOBALE
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
    const registerOverlay = document.getElementById('register-overlay');
    const setupProfileOverlay = document.getElementById('setup-profile-overlay');

    if (deferredPrompt && btnInstall) {
        btnInstall.classList.remove('hidden');
    }

    if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') console.log('App installata');
                deferredPrompt = null;
                btnInstall.classList.add('hidden');
            }
        });
    }

    getRedirectResult(auth).catch((error) => {
        console.error("Errore dopo redirect Google:", error);
        showAuthMessage("Accesso con Google fallito o annullato.");
    });

    // --- AUTENTICAZIONE E CHECK DATI PROFILO ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            try {
                const docSnap = await getDoc(userRef);
                const userData = docSnap.exists() ? docSnap.data() : {};
                
                if (userData.blocked === true) {
                    await signOut(auth);
                    showAuthMessage("Il tuo account è stato bloccato dall'amministratore.", true);
                    hideSplashAndShow(authView);
                    return;
                }

                // Controllo se mancano Nome e Cognome (vecchi utenti o Google login)
                if (!userData.firstName || !userData.lastName) {
                    // Mettiamo in pausa il flusso e chiediamo i dati
                    splashOverlay.classList.add('hidden');
                    openModal(setupProfileOverlay);
                    
                    // L'inizializzazione dell'app riprenderà dal form di setup
                } else {
                    // Dati completi, avvia l'app shell
                    await initAppShell(user, userData, userRef);
                }

            } catch (error) {
                console.error("Errore controllo utente:", error);
                hideSplashAndShow(appShell);
            }
        } else {
            // Logout / Non loggato
            isAdmin = false;
            btnAdmin.classList.add('hidden');
            document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'none');
            hideSplashAndShow(authView);
        }
    });

    // Funzione separata per inizializzare l'interfaccia quando siamo sicuri che i dati ci sono
    async function initAppShell(user, userData, userRef) {
        await setDoc(userRef, {
            email: user.email,
            lastLogin: Date.now()
        }, { merge: true });

        isAdmin = (user.uid === ADMIN_UID);
        
        // Popola il modale Impostazioni con Nome e Cognome
        let fullName = `${userData.firstName} ${userData.lastName}`;
        document.getElementById('user-profile-name').innerHTML = fullName;
        
        let profileEmailText = user.email;
        if (isAdmin) {
            profileEmailText += ' <span style="color:var(--accent-color); font-weight:bold; font-size:0.8rem; margin-left:8px; border: 1px solid var(--accent-color); padding: 2px 6px; border-radius: 12px;">ADMIN</span>';
            btnAdmin.classList.remove('hidden');
            document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'flex');
        } else {
            btnAdmin.classList.add('hidden');
            document.querySelectorAll('.admin-only-card').forEach(el => el.style.display = 'none');
        }
        
        document.getElementById('user-profile-email').innerHTML = profileEmailText;
        
        hideSplashAndShow(appShell);
    }

    // GESTIONE SETUP PROFILO (Quando mancano Nome e Cognome)
    document.getElementById('setup-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fname = document.getElementById('setup-name').value.trim();
        const lname = document.getElementById('setup-surname').value.trim();
        const errorEl = document.getElementById('setup-error');

        if (!fname || !lname) {
            errorEl.innerText = "Entrambi i campi sono obbligatori.";
            return;
        }

        try {
            const user = auth.currentUser;
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                firstName: fname,
                lastName: lname,
                email: user.email
            }, { merge: true });
            
            closeModal(setupProfileOverlay);
            
            // Riprendi il caricamento
            const updatedSnap = await getDoc(userRef);
            await initAppShell(user, updatedSnap.data(), userRef);

        } catch (error) {
            errorEl.innerText = "Errore durante il salvataggio. Riprova.";
        }
    });

    function hideSplashAndShow(viewToShow) {
        appShell.classList.add('hidden');
        authView.classList.add('hidden');
        viewToShow.classList.remove('hidden');
        
        splashOverlay.classList.add('hidden');
        setTimeout(() => {
            splashOverlay.style.display = 'none';
        }, 400); 
    }

    // --- LOGICA LOGIN ---
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

    document.getElementById('btn-google').addEventListener('click', async () => {
        try {
            await signInWithRedirect(auth, googleProvider);
        } catch (error) {
            showAuthMessage("Errore con l'avvio dell'accesso Google.");
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

    // --- LOGICA REGISTRAZIONE ---
    document.getElementById('btn-open-register').addEventListener('click', () => {
        document.getElementById('reg-error').innerText = '';
        document.getElementById('register-form').reset();
        openModal(registerOverlay);
    });

    document.getElementById('btn-close-register').addEventListener('click', () => {
        closeModal(registerOverlay);
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fname = document.getElementById('reg-name').value.trim();
        const lname = document.getElementById('reg-surname').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pwd = document.getElementById('reg-password').value;
        const pwdConfirm = document.getElementById('reg-password-confirm').value;
        const errorEl = document.getElementById('reg-error');

        if (pwd !== pwdConfirm) {
            errorEl.innerText = "Le password non coincidono.";
            return;
        }

        try {
            errorEl.style.color = "var(--text-primary)";
            errorEl.innerText = "Creazione account in corso...";
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, pwd);
            const user = userCredential.user;
            
            // Salviamo subito il nome e cognome così il check all'avvio lo troverà compilato
            await setDoc(doc(db, 'users', user.uid), {
                firstName: fname,
                lastName: lname,
                email: email,
                lastLogin: Date.now(),
                blocked: false
            });

            closeModal(registerOverlay);
            showAuthMessage("Registrazione completata! Accesso in corso...", false);
        } catch (error) {
            errorEl.style.color = "#ef4444";
            if (error.code === 'auth/email-already-in-use') {
                errorEl.innerText = "Questa email è già in uso.";
            } else if (error.code === 'auth/weak-password') {
                errorEl.innerText = "La password deve avere almeno 6 caratteri.";
            } else {
                errorEl.innerText = "Errore durante la registrazione.";
            }
        }
    });

    // --- FUNZIONI MODALI GENERALI ---
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
            // Impedisce la chiusura cliccando fuori per il setup obbligatorio
            if (e.target === overlay && overlay.id !== 'setup-profile-overlay') closeModal(overlay);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(overlay => {
                if(overlay.id !== 'setup-profile-overlay') closeModal(overlay);
            });
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
        container.innerHTML = '<div class="loader" style="margin: 2rem auto;"></div><p style="text-align:center; color:var(--text-secondary);">Caricamento utenti...</p>';
        
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
                
                // Preparazione Nome Visualizzato
                let displayFullName = "Senza Nome";
                if (userData.firstName && userData.lastName) {
                    displayFullName = `${userData.firstName} ${userData.lastName}`;
                }

                const row = document.createElement('div');
                row.className = 'user-row';
                // Stile inline per trasformarlo in un contenitore cliccabile e flessibile
                row.style.cursor = 'pointer';
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.alignItems = 'stretch';
                
                let blockBtnHTML = '';
                if (!isMe) {
                    blockBtnHTML = isBlocked 
                        ? `<button class="btn outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" data-uid="${docSnap.id}" data-action="unblock">Sblocca</button>`
                        : `<button class="btn danger outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" data-uid="${docSnap.id}" data-action="block">Blocca</button>`;
                } else {
                    blockBtnHTML = `<span style="font-size:0.8rem; color:var(--text-secondary);">Admin</span>`;
                }

                row.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="user-info">
                            <span class="user-email ${isBlocked ? 'error-msg' : ''}" style="text-align:left; margin:0;">${displayFullName}</span>
                            <span class="user-date">Ultimo accesso: ${date}</span>
                        </div>
                        <div>${blockBtnHTML}</div>
                    </div>
                    <div class="user-email-reveal hidden" style="margin-top: 0.8rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-soft); font-size: 0.85rem; color: var(--text-secondary);">
                        <strong>Email:</strong> ${userData.email}
                    </div>
                `;

                // Espansione al click per vedere la mail
                row.addEventListener('click', () => {
                    const emailReveal = row.querySelector('.user-email-reveal');
                    emailReveal.classList.toggle('hidden');
                });

                if (!isMe) {
                    row.querySelector('button').addEventListener('click', async (e) => {
                        e.stopPropagation(); // Evita di espandere/collassare la riga se si clicca il tasto blocca
                        const targetUid = e.target.dataset.uid;
                        const action = e.target.dataset.action;
                        const newStatus = action === 'block';
                        
                        try {
                            await updateDoc(doc(db, 'users', targetUid), { blocked: newStatus });
                            loadAdminUsers(); // Ricarica la lista
                        } catch (err) {
                            alert("Errore nell'aggiornamento dell'utente.");
                        }
                    });
                }

                container.appendChild(row);
            });
            
        } catch (error) {
            console.error("Errore Admin DB:", error);
            container.innerHTML = '<p style="color:red; text-align:center;">Errore di lettura dal database.</p>';
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
