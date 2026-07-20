import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, setDoc, getDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, auth } from '../firebase-init.js';

if (!document.getElementById('pwd-module-styles')) {
    const style = document.createElement('style');
    style.id = 'pwd-module-styles';
    style.innerHTML = `
        .pwd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .pwd-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
        
        .vault-locked { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; text-align: center; }
        .vault-locked-icon { font-size: 4rem; color: var(--text-secondary); margin-bottom: 1rem; }
        
        .pwd-row { display: flex; align-items: center; padding: 1rem 1.2rem; text-decoration: none; color: var(--text-primary); transition: background 0.2s, transform 0.1s; gap: 12px; background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 12px; margin-bottom: 0.8rem; cursor: pointer; }
        .pwd-row:hover { background: rgba(150,150,150,0.05); }
        .pwd-row:active { transform: scale(0.98); }
        
        .pwd-icon-img { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; background: white; border: 1px solid rgba(150,150,150,0.2); }
        .pwd-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .pwd-name { font-weight: 600; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pwd-url { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .detail-group { margin-bottom: 1.2rem; position: relative; }
        .detail-label { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.3rem; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
        .detail-value-box { background: rgba(150,150,150,0.05); border: 1px solid rgba(150,150,150,0.2); padding: 0.8rem; border-radius: 8px; font-family: monospace; font-size: 1.1rem; color: var(--text-primary); word-break: break-all; display: flex; justify-content: space-between; align-items: center; }
        
        .btn-copy-mini { background: none; border: none; color: var(--accent-color); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-copy-mini:hover { background: rgba(37, 99, 235, 0.1); }
    `;
    document.head.appendChild(style);
}

export function init(container) {
    const db = getFirestore(app);
    const user = auth.currentUser;
    
    if (!user) {
        container.innerHTML = `<div class="module-wrapper"><p style="text-align:center; color:red;">Devi fare l'accesso.</p></div>`;
        return;
    }

    // --- MOTORE CRITTOGRAFICO (AES-GCM 256-bit) ---
    let cryptoKey = null; 
    let unsubscribePasswords = null;
    let savedPasswordsList = [];

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    
    function bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
    function base64ToBuffer(base64) {
        const binStr = atob(base64);
        const arr = new Uint8Array(binStr.length);
        for(let i=0; i<binStr.length; i++) arr[i] = binStr.charCodeAt(i);
        return arr.buffer;
    }

    async function deriveKey(masterPassword, saltBase64) {
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(masterPassword), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const salt = base64ToBuffer(saltBase64);
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    }

    async function encryptText(text) {
        if (!cryptoKey) throw new Error("Vault bloccato");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, cryptoKey, enc.encode(text)
        );
        return { cipherText: bufferToBase64(cipherBuffer), iv: bufferToBase64(iv) };
    }

    async function decryptText(cipherBase64, ivBase64) {
        if (!cryptoKey) return "???";
        try {
            const cipherBuffer = base64ToBuffer(cipherBase64);
            const iv = base64ToBuffer(ivBase64);
            const plainBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, cryptoKey, cipherBuffer
            );
            return dec.decode(plainBuffer);
        } catch (e) {
            return "Errore Decrittazione";
        }
    }

    // --- UI BASE ---
    container.innerHTML = `
        <div class="module-wrapper" style="position: relative; display: flex; flex-direction: column; height: 100%;">
            
            <div class="pwd-header">
                <h2 class="pwd-title">
                    <span class="material-symbols-outlined">key</span> Password
                </h2>
                <button id="btn-new-pwd" class="icon-btn hidden" aria-label="Nuova Password" style="background: var(--accent-color); color: white;">
                    <span class="material-symbols-outlined">add</span>
                </button>
            </div>

            <!-- VISTA CASSAFORTE BLOCCATA -->
            <div id="vault-auth-view" class="vault-locked">
                <div class="loader" id="vault-loader"></div>
                
                <div id="vault-login-form" class="hidden" style="width: 100%; max-width: 300px; margin-top: 1rem;">
                    <span class="material-symbols-outlined vault-locked-icon" id="vault-lock-icon">lock</span>
                    <h3 id="vault-msg-title" style="margin-bottom: 1rem;">Sblocca Cassaforte</h3>
                    <p id="vault-msg-desc" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Inserisci la tua Master Password locale.</p>
                    
                    <div class="input-group" style="margin-bottom: 1rem;">
                        <span class="material-symbols-outlined input-icon">key</span>
                        <input type="password" id="master-pwd-input" placeholder="Master Password" required>
                    </div>
                    
                    <div id="master-pwd-confirm-group" class="input-group hidden" style="margin-bottom: 1rem;">
                        <span class="material-symbols-outlined input-icon">key</span>
                        <input type="password" id="master-pwd-confirm" placeholder="Conferma Master Password">
                    </div>

                    <button id="btn-unlock-vault" class="btn primary" style="width: 100%;">Sblocca</button>
                    <p id="vault-error" class="error-msg" style="margin-top: 1rem;"></p>

                    <!-- SEZIONE RESET (Visibile solo al login della cassaforte se già esistente) -->
                    <div style="margin-top: 2.5rem; border-top: 1px dashed rgba(150,150,150,0.3); padding-top: 1.5rem;">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.8rem;">Hai dimenticato la Master Password?</p>
                        <button id="btn-reset-vault" class="btn danger outline" style="width: 100%; font-size: 0.85rem; padding: 0.5rem;">Elimina Database e Resetta</button>
                    </div>
                </div>
            </div>

            <!-- VISTA LISTA PASSWORD -->
            <div id="vault-content-view" class="hidden" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <span class="material-symbols-outlined input-icon">search</span>
                    <input type="text" id="search-pwd" placeholder="Cerca sito...">
                </div>
                <div id="pwd-list-container"></div>
            </div>
        </div>
    `;

    // --- MODALI INIETTATE NEL BODY (Per risolvere il bug della sfocatura) ---
    const modalsWrapper = document.createElement('div');
    modalsWrapper.id = 'pwd-modals-container';
    modalsWrapper.innerHTML = `
        <!-- MODALE: AGGIUNGI PASSWORD -->
        <div id="modal-add-pwd" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="font-size: 1.3rem;">Aggiungi Credenziali</h2>
                    <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <form id="form-add-pwd" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Nome Sito o App</label>
                        <input type="text" id="add-pwd-name" class="input-select" required placeholder="Es. Netflix">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">URL Sito (Opzionale, serve per l'icona)</label>
                        <input type="url" id="add-pwd-url" class="input-select" placeholder="https://netflix.com">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Email o Username</label>
                        <input type="text" id="add-pwd-user" class="input-select" required autocomplete="off">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Password</label>
                        <div class="input-group">
                            <input type="password" id="add-pwd-pass" class="input-select" required autocomplete="new-password" style="padding-left: 0.8rem; margin-bottom:0;">
                            <button type="button" id="btn-toggle-vis" class="icon-btn" style="position:absolute; right:5px;"><span class="material-symbols-outlined" style="font-size:18px;">visibility</span></button>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn primary" style="margin-top: 1rem;">Salva Criptato</button>
                    <p style="font-size:0.75rem; color:var(--text-secondary); text-align:center;">I dati verranno crittografati sul tuo dispositivo prima dell'invio.</p>
                </form>
            </div>
        </div>

        <!-- MODALE: VISUALIZZA DETTAGLI -->
        <div id="modal-view-pwd" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img id="view-pwd-icon" src="" style="width:30px; height:30px; border-radius:6px; display:none;">
                        <h2 id="view-pwd-title" style="font-size: 1.3rem;">Dettagli</h2>
                    </div>
                    <button id="btn-close-view" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                
                <div class="detail-group">
                    <span class="detail-label">Email / Username</span>
                    <div class="detail-value-box">
                        <span id="view-pwd-user">...</span>
                        <button class="btn-copy-mini" onclick="navigator.clipboard.writeText(document.getElementById('view-pwd-user').innerText)"><span class="material-symbols-outlined">content_copy</span></button>
                    </div>
                </div>

                <div class="detail-group">
                    <span class="detail-label">Password</span>
                    <div class="detail-value-box">
                        <span id="view-pwd-pass" style="filter: blur(5px); transition: filter 0.3s; cursor:pointer;" title="Clicca per mostrare">...</span>
                        <button class="btn-copy-mini" onclick="navigator.clipboard.writeText(document.getElementById('view-pwd-pass').innerText)"><span class="material-symbols-outlined">content_copy</span></button>
                    </div>
                    <div style="text-align:right; margin-top:5px;">
                        <button id="btn-reveal-pass" class="text-btn" style="font-size:0.8rem;">Mostra Password</button>
                    </div>
                </div>

                <div style="margin-top: 2rem; border-top: 1px solid rgba(150,150,150,0.2); padding-top: 1.5rem; display: flex; justify-content: center;">
                    <button id="btn-delete-entry" class="btn danger outline" style="flex: 1; display:flex; justify-content:center; align-items:center; gap:5px;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">delete</span> Elimina Voce
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalsWrapper);

    // --- REFERENZE DOM (Main) ---
    const vaultAuthView = container.querySelector('#vault-auth-view');
    const vaultContentView = container.querySelector('#vault-content-view');
    const vaultLoader = container.querySelector('#vault-loader');
    const vaultLoginForm = container.querySelector('#vault-login-form');
    const btnNewPwd = container.querySelector('#btn-new-pwd');
    const pwdListContainer = container.querySelector('#pwd-list-container');
    const searchInput = container.querySelector('#search-pwd');

    // --- REFERENZE DOM (Modali nel Body) ---
    const modalAdd = modalsWrapper.querySelector('#modal-add-pwd');
    const formAdd = modalsWrapper.querySelector('#form-add-pwd');
    const modalView = modalsWrapper.querySelector('#modal-view-pwd');

    // Chiusura modali cliccando fuori (sullo sfondo scuro)
    modalsWrapper.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (overlay.id === 'modal-add-pwd') formAdd.reset();
            }
        });
    });

    // --- UTILITY FAVICON ---
    function getDomain(urlStr) { try { return new URL(urlStr).hostname; } catch(e) { return urlStr; } }
    function getFaviconUrl(urlStr) {
        if (!urlStr) return '';
        let u = urlStr.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        return `https://www.google.com/s2/favicons?domain=${getDomain(u)}&sz=64`;
    }

    // --- LOGICA SBLOCCO CASSAFORTE ---
    let isNewVault = false;
    let userSalt = null;

    async function initVaultState() {
        try {
            const metaDoc = await getDoc(doc(db, 'passwords_meta', user.uid));
            vaultLoader.classList.add('hidden');
            vaultLoginForm.classList.remove('hidden');

            if (metaDoc.exists()) {
                isNewVault = false;
                userSalt = metaDoc.data().salt;
            } else {
                isNewVault = true;
                container.querySelector('#vault-msg-title').innerText = "Crea Cassaforte";
                container.querySelector('#vault-msg-desc').innerText = "Crea una Master Password. NON potrai recuperarla se la perdi.";
                container.querySelector('#master-pwd-confirm-group').classList.remove('hidden');
                container.querySelector('#btn-unlock-vault').innerText = "Inizializza Sicurezza";
                container.querySelector('#vault-lock-icon').innerText = "lock_open";
                // Nasconde il tasto reset per i nuovi utenti
                container.querySelector('#btn-reset-vault').parentElement.style.display = 'none';
            }
        } catch (e) {
            vaultLoader.classList.add('hidden');
            container.querySelector('#vault-error').innerText = "Errore connessione database.";
        }
    }

    container.querySelector('#btn-unlock-vault').addEventListener('click', async () => {
        const mpInput = container.querySelector('#master-pwd-input').value;
        const errEl = container.querySelector('#vault-error');
        errEl.innerText = "";

        if (!mpInput) return;

        try {
            container.querySelector('#btn-unlock-vault').disabled = true;

            if (isNewVault) {
                const mpConf = container.querySelector('#master-pwd-confirm').value;
                if (mpInput !== mpConf) throw new Error("Le password non coincidono.");
                if (mpInput.length < 6) throw new Error("La Master Password deve avere almeno 6 caratteri.");

                const newSalt = bufferToBase64(crypto.getRandomValues(new Uint8Array(16)));
                const tempKey = await deriveKey(mpInput, newSalt);
                
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, tempKey, enc.encode("vault_ok"));
                
                await setDoc(doc(db, 'passwords_meta', user.uid), {
                    salt: newSalt,
                    checkStr: bufferToBase64(cipherBuffer),
                    checkIv: bufferToBase64(iv)
                });

                cryptoKey = tempKey;
            } else {
                const metaData = (await getDoc(doc(db, 'passwords_meta', user.uid))).data();
                const tempKey = await deriveKey(mpInput, metaData.salt);
                
                try {
                    const plainBuffer = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: base64ToBuffer(metaData.checkIv) }, 
                        tempKey, base64ToBuffer(metaData.checkStr)
                    );
                    const checkTxt = dec.decode(plainBuffer);
                    if (checkTxt !== "vault_ok") throw new Error();
                } catch (e) {
                    throw new Error("Master Password errata.");
                }

                cryptoKey = tempKey;
            }

            vaultAuthView.classList.add('hidden');
            vaultContentView.classList.remove('hidden');
            btnNewPwd.classList.remove('hidden');
            loadPasswords();

        } catch (e) {
            errEl.innerText = e.message;
            container.querySelector('#btn-unlock-vault').disabled = false;
        }
    });

    // --- RESET TOTALE CASSAFORTE ---
    const btnResetVault = container.querySelector('#btn-reset-vault');
    if (btnResetVault) {
        btnResetVault.addEventListener('click', async () => {
            if (confirm("ATTENZIONE: Stai per eliminare per sempre l'intera cassaforte (tutte le Note e tutte le Password salvate). L'operazione NON è reversibile. Vuoi procedere?")) {
                if (confirm("SEI ASSOLUTAMENTE SICURO? Questa è la tua ultima possibilità per annullare.")) {
                    btnResetVault.innerText = "Cancellazione in corso...";
                    btnResetVault.disabled = true;
                    try {
                        const notesQ = query(collection(db, 'notes'), where('ownerId', '==', user.uid));
                        const passQ = query(collection(db, 'passwords'), where('ownerId', '==', user.uid));
                        
                        const [notesSnap, passSnap] = await Promise.all([getDocs(notesQ), getDocs(passQ)]);
                        
                        const deletePromises = [];
                        notesSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
                        passSnap.forEach(d => deletePromises.push(deleteDoc(d.ref)));
                        deletePromises.push(deleteDoc(doc(db, 'passwords_meta', user.uid)));
                        
                        await Promise.all(deletePromises);
                        alert("Database azzerato con successo. Ora puoi creare una nuova Master Password.");
                        
                        isNewVault = true;
                        container.querySelector('#vault-msg-title').innerText = "Crea Cassaforte";
                        container.querySelector('#vault-msg-desc').innerText = "Crea una Master Password. NON potrai recuperarla se la perdi.";
                        container.querySelector('#master-pwd-confirm-group').classList.remove('hidden');
                        container.querySelector('#btn-unlock-vault').innerText = "Inizializza Sicurezza";
                        container.querySelector('#vault-lock-icon').innerText = "lock_open";
                        btnResetVault.parentElement.style.display = 'none';
                        
                    } catch (error) {
                        alert("Errore durante l'eliminazione.");
                        console.error(error);
                    } finally {
                        btnResetVault.innerText = "Elimina Database e Resetta";
                        btnResetVault.disabled = false;
                    }
                }
            }
        });
    }

    // --- CARICAMENTO E RENDER LISTA ---
    function loadPasswords() {
        const q = query(collection(db, 'passwords'), where('ownerId', '==', user.uid));
        
        if(unsubscribePasswords) unsubscribePasswords();
        
        unsubscribePasswords = onSnapshot(q, (snap) => {
            savedPasswordsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderPasswordList();
        });
    }

    function renderPasswordList(filterText = "") {
        pwdListContainer.innerHTML = '';
        
        const filtered = savedPasswordsList.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            pwdListContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top:2rem;">Nessuna password trovata.</p>`;
            return;
        }

        filtered.sort((a,b) => a.name.localeCompare(b.name)).forEach(pwd => {
            const row = document.createElement('div');
            row.className = 'pwd-row';
            
            const favUrl = getFaviconUrl(pwd.url);
            const imgHtml = favUrl 
                ? `<img src="${favUrl}" class="pwd-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` 
                : '';
            
            const fallbackHtml = `<div class="pwd-icon-img" style="display:${favUrl?'none':'flex'}; align-items:center; justify-content:center; background:var(--accent-color); color:white; font-weight:bold;">${pwd.name.charAt(0).toUpperCase()}</div>`;

            row.innerHTML = `
                ${imgHtml}
                ${fallbackHtml}
                <div class="pwd-info">
                    <span class="pwd-name">${pwd.name}</span>
                    <span class="pwd-url">${pwd.url ? getDomain(pwd.url) : 'Account'}</span>
                </div>
                <span class="material-symbols-outlined" style="color:var(--text-secondary);">chevron_right</span>
            `;

            row.addEventListener('click', () => openPasswordDetail(pwd));
            pwdListContainer.appendChild(row);
        });
    }

    searchInput.addEventListener('input', (e) => renderPasswordList(e.target.value));

    // --- AGGIUNGI PASSWORD ---
    btnNewPwd.addEventListener('click', () => modalAdd.classList.remove('hidden'));
    modalsWrapper.querySelector('#btn-close-add').addEventListener('click', () => modalAdd.classList.add('hidden'));

    modalsWrapper.querySelector('#btn-toggle-vis').addEventListener('click', (e) => {
        const inp = modalsWrapper.querySelector('#add-pwd-pass');
        const icon = e.currentTarget.querySelector('span');
        if (inp.type === "password") { inp.type = "text"; icon.innerText = "visibility_off"; }
        else { inp.type = "password"; icon.innerText = "visibility"; }
    });

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = modalsWrapper.querySelector('#add-pwd-name').value.trim();
        const url = modalsWrapper.querySelector('#add-pwd-url').value.trim();
        const username = modalsWrapper.querySelector('#add-pwd-user').value.trim();
        const pass = modalsWrapper.querySelector('#add-pwd-pass').value;

        if (!name || !username || !pass) return;

        const btnSub = formAdd.querySelector('button[type="submit"]');
        btnSub.disabled = true;
        btnSub.innerText = "Cifratura in corso...";

        try {
            const encUser = await encryptText(username);
            const encPass = await encryptText(pass);

            await addDoc(collection(db, 'passwords'), {
                ownerId: user.uid,
                name: name,
                url: url,
                usernameCipher: encUser.cipherText,
                usernameIv: encUser.iv,
                passwordCipher: encPass.cipherText,
                passwordIv: encPass.iv,
                createdAt: Date.now()
            });

            modalAdd.classList.add('hidden');
            formAdd.reset();
        } catch (error) {
            alert("Errore salvataggio.");
        } finally {
            btnSub.disabled = false;
            btnSub.innerText = "Salva Criptato";
        }
    });

    // --- VISUALIZZA DETTAGLIO ---
    let currentViewingId = null;

    async function openPasswordDetail(pwd) {
        currentViewingId = pwd.id;
        modalsWrapper.querySelector('#view-pwd-title').innerText = pwd.name;
        
        const iconEl = modalsWrapper.querySelector('#view-pwd-icon');
        const favUrl = getFaviconUrl(pwd.url);
        if (favUrl) { iconEl.src = favUrl; iconEl.style.display = 'block'; }
        else { iconEl.style.display = 'none'; }

        const plainUser = await decryptText(pwd.usernameCipher, pwd.usernameIv);
        const plainPass = await decryptText(pwd.passwordCipher, pwd.passwordIv);

        modalsWrapper.querySelector('#view-pwd-user').innerText = plainUser;
        const passEl = modalsWrapper.querySelector('#view-pwd-pass');
        passEl.innerText = plainPass;
        
        passEl.style.filter = 'blur(5px)';
        modalsWrapper.querySelector('#btn-reveal-pass').innerText = "Mostra Password";

        modalView.classList.remove('hidden');
    }

    modalsWrapper.querySelector('#btn-close-view').addEventListener('click', () => {
        modalView.classList.add('hidden');
        currentViewingId = null;
    });

    const passEl = modalsWrapper.querySelector('#view-pwd-pass');
    const btnReveal = modalsWrapper.querySelector('#btn-reveal-pass');
    
    function togglePassReveal() {
        if (passEl.style.filter === 'blur(5px)') {
            passEl.style.filter = 'none';
            btnReveal.innerText = "Nascondi Password";
        } else {
            passEl.style.filter = 'blur(5px)';
            btnReveal.innerText = "Mostra Password";
        }
    }
    passEl.addEventListener('click', togglePassReveal);
    btnReveal.addEventListener('click', togglePassReveal);

    // Elimina
    modalsWrapper.querySelector('#btn-delete-entry').addEventListener('click', async () => {
        if (!currentViewingId) return;
        if (confirm("Eliminare definitivamente questa credenziale?")) {
            await deleteDoc(doc(db, 'passwords', currentViewingId));
            modalView.classList.add('hidden');
        }
    });

    // --- INIT MOTORE ---
    initVaultState();

    // Cleanup alla chiusura del modulo e distruzione modali esterne
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (unsubscribePasswords) unsubscribePasswords();
            cryptoKey = null; 
            if (document.body.contains(modalsWrapper)) {
                document.body.removeChild(modalsWrapper);
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
