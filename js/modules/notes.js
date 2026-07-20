import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, auth } from '../firebase-init.js';

if (!document.getElementById('notes-module-styles')) {
    const style = document.createElement('style');
    style.id = 'notes-module-styles';
    style.innerHTML = `
        .notes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .notes-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
        
        .vault-locked { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; text-align: center; }
        .vault-locked-icon { font-size: 4rem; color: var(--text-secondary); margin-bottom: 1rem; }
        
        .note-row { display: flex; align-items: center; padding: 1rem 1.2rem; text-decoration: none; color: var(--text-primary); transition: background 0.2s, transform 0.1s; gap: 12px; background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 12px; margin-bottom: 0.8rem; cursor: pointer; box-shadow: var(--shadow); }
        .note-row:hover { background: rgba(150,150,150,0.05); }
        .note-row:active { transform: scale(0.98); }
        
        .note-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(37, 99, 235, 0.1); color: var(--accent-color); }
        .note-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .note-name { font-weight: 600; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .note-date { font-size: 0.8rem; color: var(--text-secondary); }
        
        .note-content-box { background: rgba(150,150,150,0.03); border: 1px solid rgba(150,150,150,0.2); padding: 1.2rem; border-radius: 8px; color: var(--text-primary); font-size: 1rem; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; max-height: 55vh; overflow-y: auto; }
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
    let unsubscribeNotes = null;
    let savedNotesList = [];

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    
    function bufferToBase64(buffer) { return btoa(String.fromCharCode(...new Uint8Array(buffer))); }
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
            return "Errore Decrittazione (Chiave Errata o Dati Corrotti)";
        }
    }

    // --- UI BASE ---
    container.innerHTML = `
        <div class="module-wrapper" style="position: relative; display: flex; flex-direction: column; height: 100%;">
            
            <div class="notes-header">
                <h2 class="notes-title">
                    <span class="material-symbols-outlined">edit_document</span> Note Segrete
                </h2>
                <button id="btn-new-note" class="icon-btn hidden" aria-label="Nuova Nota" style="background: var(--accent-color); color: white;">
                    <span class="material-symbols-outlined">add</span>
                </button>
            </div>

            <!-- VISTA CASSAFORTE BLOCCATA (Pagina Accesso) -->
            <div id="vault-auth-view" class="vault-locked">
                <div class="loader" id="vault-loader"></div>
                
                <div id="vault-login-form" class="hidden" style="width: 100%; max-width: 300px; margin-top: 1rem;">
                    <span class="material-symbols-outlined vault-locked-icon" id="vault-lock-icon">lock</span>
                    <h3 id="vault-msg-title" style="margin-bottom: 1rem;">Sblocca Cassaforte</h3>
                    <p id="vault-msg-desc" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Inserisci la tua Master Password.</p>
                    
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

                    <!-- SEZIONE RESET (Visibile solo al login della cassaforte) -->
                    <div style="margin-top: 2.5rem; border-top: 1px dashed rgba(150,150,150,0.3); padding-top: 1.5rem;">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.8rem;">Hai dimenticato la Master Password?</p>
                        <button id="btn-reset-vault" class="btn danger outline" style="width: 100%; font-size: 0.85rem; padding: 0.5rem;">Elimina Database e Resetta</button>
                    </div>
                </div>
            </div>

            <!-- VISTA LISTA NOTE -->
            <div id="vault-content-view" class="hidden" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <span class="material-symbols-outlined input-icon">search</span>
                    <input type="text" id="search-note" placeholder="Cerca nel titolo...">
                </div>
                <div id="notes-list-container"></div>
            </div>
        </div>
    `;

    // --- MODALI INIETTATE NEL BODY (Per risolvere il bug della sfocatura) ---
    const modalsWrapper = document.createElement('div');
    modalsWrapper.id = 'notes-modals-container';
    modalsWrapper.innerHTML = `
        <!-- MODALE: AGGIUNGI NOTA -->
        <div id="modal-add-note" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="font-size: 1.3rem;">Nuova Nota</h2>
                    <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <form id="form-add-note" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Titolo (Visibile)</label>
                        <input type="text" id="add-note-title" class="input-select" required placeholder="Es. Codici Bancomat">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Contenuto (Crittografato)</label>
                        <textarea id="add-note-content" class="input-select" required rows="8" placeholder="Scrivi qui la tua nota segreta..."></textarea>
                    </div>
                    
                    <button type="submit" class="btn primary" style="margin-top: 1rem;">Salva Nota Criptata</button>
                    <p style="font-size:0.75rem; color:var(--text-secondary); text-align:center;">Il contenuto verrà crittografato sul tuo dispositivo.</p>
                </form>
            </div>
        </div>

        <!-- MODALE: VISUALIZZA NOTA -->
        <div id="modal-view-note" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="view-note-title" style="font-size: 1.3rem;">Dettagli Nota</h2>
                    <div style="display:flex; gap:5px;">
                        <button id="btn-edit-note-init" class="icon-btn" style="color:var(--text-secondary);" title="Modifica"><span class="material-symbols-outlined">edit</span></button>
                        <button id="btn-close-view" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                </div>
                
                <div class="note-content-box" id="view-note-content">...</div>

                <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                    <!-- NUOVO BOTTONE ELIMINA -->
                    <button id="btn-delete-entry" class="btn danger outline" style="flex: 1; display:flex; justify-content:center; align-items:center; gap:5px;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">delete</span> Elimina
                    </button>
                    <button id="btn-copy-note" class="btn secondary outline" style="flex: 1; display:flex; justify-content:center; align-items:center; gap:5px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span> Copia Testo
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE: MODIFICA NOTA -->
        <div id="modal-edit-note" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="font-size: 1.3rem;">Modifica Nota</h2>
                    <button id="btn-close-edit" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <form id="form-edit-note" style="display: flex; flex-direction: column; gap: 1rem;">
                    <input type="hidden" id="edit-note-id">
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Titolo</label>
                        <input type="text" id="edit-note-title" class="input-select" required>
                    </div>
                    <div>
                        <label style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Contenuto</label>
                        <textarea id="edit-note-content" class="input-select" required rows="8"></textarea>
                    </div>
                    <button type="submit" class="btn primary" style="margin-top: 1rem;">Aggiorna Nota</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modalsWrapper);

    // --- REFERENZE DOM (Main) ---
    const vaultAuthView = container.querySelector('#vault-auth-view');
    const vaultContentView = container.querySelector('#vault-content-view');
    const vaultLoader = container.querySelector('#vault-loader');
    const vaultLoginForm = container.querySelector('#vault-login-form');
    const btnNewNote = container.querySelector('#btn-new-note');
    const notesListContainer = container.querySelector('#notes-list-container');
    const searchInput = container.querySelector('#search-note');

    // --- REFERENZE DOM (Modali nel Body) ---
    const modalAdd = modalsWrapper.querySelector('#modal-add-note');
    const formAdd = modalsWrapper.querySelector('#form-add-note');
    const modalView = modalsWrapper.querySelector('#modal-view-note');
    const modalEdit = modalsWrapper.querySelector('#modal-edit-note');

    // Chiusura modali cliccando fuori (sullo sfondo scuro)
    modalsWrapper.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (overlay.id === 'modal-add-note') formAdd.reset();
            }
        });
    });

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
                // Se non ha una cassaforte, nasconde il bottone reset
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
            btnNewNote.classList.remove('hidden');
            loadNotes();

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
                        // Elimina anche la chiave meta (la serratura della cassaforte)
                        deletePromises.push(deleteDoc(doc(db, 'passwords_meta', user.uid)));
                        
                        await Promise.all(deletePromises);
                        alert("Database azzerato con successo. Ora puoi creare una nuova Master Password.");
                        
                        // Resetta l'interfaccia UI
                        isNewVault = true;
                        container.querySelector('#vault-msg-title').innerText = "Crea Cassaforte";
                        container.querySelector('#vault-msg-desc').innerText = "Crea una Master Password. NON potrai recuperarla se la perdi.";
                        container.querySelector('#master-pwd-confirm-group').classList.remove('hidden');
                        container.querySelector('#btn-unlock-vault').innerText = "Inizializza Sicurezza";
                        container.querySelector('#vault-lock-icon').innerText = "lock_open";
                        btnResetVault.parentElement.style.display = 'none'; // Nasconde se stesso
                        
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
    function loadNotes() {
        const q = query(collection(db, 'notes'), where('ownerId', '==', user.uid));
        if(unsubscribeNotes) unsubscribeNotes();
        unsubscribeNotes = onSnapshot(q, (snap) => {
            savedNotesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderNotesList();
        });
    }

    function renderNotesList(filterText = "") {
        notesListContainer.innerHTML = '';
        const filtered = savedNotesList.filter(n => n.title.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            notesListContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top:2rem;">Nessuna nota trovata.</p>`;
            return;
        }

        // Ordina per data (più recenti prima)
        filtered.sort((a,b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).forEach(note => {
            const row = document.createElement('div');
            row.className = 'note-row';
            const dateStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString('it-IT');
            
            row.innerHTML = `
                <div class="note-icon">
                    <span class="material-symbols-outlined">description</span>
                </div>
                <div class="note-info">
                    <span class="note-name">${note.title}</span>
                    <span class="note-date">Modificato: ${dateStr}</span>
                </div>
                <span class="material-symbols-outlined" style="color:var(--text-secondary);">chevron_right</span>
            `;

            row.addEventListener('click', () => openNoteDetail(note));
            notesListContainer.appendChild(row);
        });
    }

    searchInput.addEventListener('input', (e) => renderNotesList(e.target.value));

    // --- AGGIUNGI NOTA ---
    btnNewNote.addEventListener('click', () => modalAdd.classList.remove('hidden'));
    modalsWrapper.querySelector('#btn-close-add').addEventListener('click', () => modalAdd.classList.add('hidden'));

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = modalsWrapper.querySelector('#add-note-title').value.trim();
        const content = modalsWrapper.querySelector('#add-note-content').value;

        if (!title || !content) return;

        const btnSub = formAdd.querySelector('button[type="submit"]');
        btnSub.disabled = true;
        btnSub.innerText = "Cifratura...";

        try {
            const encContent = await encryptText(content);
            const ora = Date.now();
            await addDoc(collection(db, 'notes'), {
                ownerId: user.uid,
                title: title,
                contentCipher: encContent.cipherText,
                contentIv: encContent.iv,
                createdAt: ora,
                updatedAt: ora
            });

            modalAdd.classList.add('hidden');
            formAdd.reset();
        } catch (error) {
            alert("Errore salvataggio.");
        } finally {
            btnSub.disabled = false;
            btnSub.innerText = "Salva Nota Criptata";
        }
    });

    // --- VISUALIZZA DETTAGLIO ---
    let currentViewingNote = null;
    let currentDecryptedText = "";

    async function openNoteDetail(note) {
        currentViewingNote = note;
        modalsWrapper.querySelector('#view-note-title').innerText = note.title;
        modalsWrapper.querySelector('#view-note-content').innerText = "Decrittazione in corso...";
        modalView.classList.remove('hidden');

        currentDecryptedText = await decryptText(note.contentCipher, note.contentIv);
        modalsWrapper.querySelector('#view-note-content').innerText = currentDecryptedText;
    }

    modalsWrapper.querySelector('#btn-close-view').addEventListener('click', () => {
        modalView.classList.add('hidden');
        currentViewingNote = null;
        currentDecryptedText = "";
    });

    modalsWrapper.querySelector('#btn-copy-note').addEventListener('click', () => {
        navigator.clipboard.writeText(modalsWrapper.querySelector('#view-note-content').innerText);
    });

    // --- ELIMINA NOTA ---
    modalsWrapper.querySelector('#btn-delete-entry').addEventListener('click', async () => {
        if (!currentViewingNote) return;
        if (confirm("Eliminare definitivamente questa nota?")) {
            await deleteDoc(doc(db, 'notes', currentViewingNote.id));
            modalView.classList.add('hidden');
        }
    });

    // --- MODIFICA NOTA ---
    modalsWrapper.querySelector('#btn-edit-note-init').addEventListener('click', () => {
        if (!currentViewingNote) return;
        modalsWrapper.querySelector('#edit-note-id').value = currentViewingNote.id;
        modalsWrapper.querySelector('#edit-note-title').value = currentViewingNote.title;
        modalsWrapper.querySelector('#edit-note-content').value = currentDecryptedText;
        
        modalView.classList.add('hidden');
        modalEdit.classList.remove('hidden');
    });

    modalsWrapper.querySelector('#btn-close-edit').addEventListener('click', () => {
        modalEdit.classList.add('hidden');
    });

    modalsWrapper.querySelector('#form-edit-note').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = modalsWrapper.querySelector('#edit-note-id').value;
        const newTitle = modalsWrapper.querySelector('#edit-note-title').value.trim();
        const newContent = modalsWrapper.querySelector('#edit-note-content').value;

        if (!newTitle || !newContent) return;
        
        const btnSub = e.target.querySelector('button[type="submit"]');
        btnSub.disabled = true;

        try {
            const encContent = await encryptText(newContent);
            await updateDoc(doc(db, 'notes', id), {
                title: newTitle,
                contentCipher: encContent.cipherText,
                contentIv: encContent.iv,
                updatedAt: Date.now()
            });
            modalEdit.classList.add('hidden');
        } catch (error) {
            alert("Errore aggiornamento.");
        } finally {
            btnSub.disabled = false;
        }
    });

    // --- INIT MOTORE ---
    initVaultState();

    // Cleanup RAM e rimozione finestre modali create
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (unsubscribeNotes) unsubscribeNotes();
            cryptoKey = null; // Distrugge la chiave crittografica
            if (document.body.contains(modalsWrapper)) {
                document.body.removeChild(modalsWrapper);
            }
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
