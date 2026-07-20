import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, auth } from '../firebase-init.js';

// Inietta stili specifici per questo modulo se non esistono
if (!document.getElementById('list-module-styles')) {
    const style = document.createElement('style');
    style.id = 'list-module-styles';
    style.innerHTML = `
        .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .list-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
        
        .list-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; border-bottom: 1px solid rgba(150,150,150,0.2); cursor: pointer; transition: background 0.2s; border-radius: 8px; margin-bottom: 0.5rem; position: relative; }
        .list-row:hover { background: rgba(150,150,150,0.05); }
        .list-row-name { font-weight: 500; font-size: 1.1rem; flex: 1; margin-left: 0.8rem; }
        
        /* Menu a tendina per i 3 puntini */
        .list-options-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.5rem; border-radius: 50%; display: flex; align-items: center; transition: background 0.2s; }
        .list-options-btn:hover { background: rgba(150,150,150,0.1); color: var(--text-primary); }
        
        .dropdown-menu { position: absolute; right: 2rem; top: 2.5rem; background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 8px; box-shadow: var(--shadow); z-index: 10; display: flex; flex-direction: column; overflow: hidden; min-width: 150px; opacity: 0; pointer-events: none; transform: translateY(-10px); transition: opacity 0.2s, transform 0.2s; }
        .dropdown-menu.active { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .dropdown-item { padding: 0.8rem 1rem; text-align: left; background: none; border: none; width: 100%; cursor: pointer; color: var(--text-primary); font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; }
        .dropdown-item:hover { background: rgba(150,150,150,0.05); }
        .dropdown-item.danger { color: #ef4444; }
        .dropdown-item.danger:hover { background: rgba(239, 68, 68, 0.1); }

        .todo-row { display: flex; align-items: center; padding: 0.8rem; border-bottom: 1px solid rgba(150,150,150,0.1); }
        .todo-checkbox { cursor: pointer; color: var(--text-secondary); transition: color 0.2s; font-size: 1.5rem; user-select: none; }
        .todo-checkbox.checked { color: #ef4444; } 
        .todo-text { flex: 1; margin: 0 0.8rem; font-size: 1rem; transition: color 0.2s; }
        .todo-row.checked .todo-text { text-decoration: line-through; color: var(--text-secondary); }
        
        .bottom-input-bar { display: flex; gap: 0.5rem; margin-top: 1rem; background: var(--surface-color); padding-top: 0.5rem; position: sticky; bottom: 0; }
        .bottom-input-bar input { flex: 1; padding: 0.8rem 1rem; border-radius: 8px; border: 1px solid var(--text-secondary); background: transparent; color: var(--text-primary); font-family: inherit; }
        
        .share-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--surface-color); z-index: 50; display: flex; flex-direction: column; padding: 1.5rem; }
        .share-list-container { flex: 1; overflow-y: auto; margin-top: 1rem; }
        .member-row { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 0; border-bottom: 1px solid rgba(150,150,150,0.1); }
        .member-email { font-size: 0.95rem; }
        .member-badge { font-size: 0.75rem; background: var(--accent-color); color: white; padding: 2px 6px; border-radius: 12px; margin-left: 8px; }
    `;
    document.head.appendChild(style);
}

export function init(container) {
    const db = getFirestore(app);
    const user = auth.currentUser;
    
    if (!user) {
        container.innerHTML = `<div class="module-wrapper"><p style="text-align:center; color:red;">Devi fare l'accesso per utilizzare le liste.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="module-wrapper" style="position: relative; display: flex; flex-direction: column; height: 100%;">
            <!-- VISTA: ELENCO LISTE -->
            <div id="view-lists" style="display: flex; flex-direction: column; flex: 1;" data-context="lists">
                <div class="list-header">
                    <h2 class="list-title">Le tue Liste</h2>
                    <button id="btn-new-list" class="icon-btn" aria-label="Nuova Lista">
                        <span class="material-symbols-outlined" style="font-size: 2rem;">add</span>
                    </button>
                </div>
                <div id="lists-container" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                    <p style="text-align:center; color: var(--text-secondary); margin-top: 2rem;">Caricamento liste...</p>
                </div>
            </div>

            <!-- VISTA: DETTAGLIO LISTA -->
            <div id="view-items" class="hidden" style="display: flex; flex-direction: column; flex: 1;">
                <div class="list-header">
                    <div style="display: flex; align-items: center; flex:1; overflow:hidden;">
                        <button id="btn-back-to-lists" class="icon-btn" style="margin-right: 0.5rem; flex-shrink: 0;">
                            <span class="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h2 id="current-list-title" class="list-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Lista</h2>
                    </div>
                    <button id="btn-open-share" class="icon-btn" aria-label="Condividi" style="flex-shrink: 0;">
                        <span class="material-symbols-outlined">person_add</span>
                    </button>
                </div>
                <div id="items-container" style="flex: 1; overflow-y: auto;"></div>
                <form id="form-add-item" class="bottom-input-bar">
                    <input type="text" id="new-item-input" placeholder="Aggiungi una voce..." required autocomplete="off">
                    <button type="submit" class="btn primary" style="flex: none; padding: 0 1.2rem;">+</button>
                </form>
            </div>

            <!-- VISTA MODALE: CONDIVISIONE -->
            <div id="view-share" class="share-modal hidden">
                <div class="list-header">
                    <h2 class="list-title">Condivisione</h2>
                    <button id="btn-close-share" class="icon-btn">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Aggiungi la mail della persona con cui vuoi condividere questa lista.</p>
                <form id="form-share" style="display: flex; gap: 0.5rem;">
                    <input type="email" id="share-email-input" placeholder="Email utente..." required class="input-select" style="margin-bottom:0;">
                    <button type="submit" class="btn primary" style="flex: none; padding: 0 1rem;">Invita</button>
                </form>
                <p id="share-msg" style="font-size: 0.85rem; margin-top: 0.5rem; text-align: center; min-height: 1.2rem;"></p>
                
                <h3 style="margin-top: 2rem; font-size: 1rem; color: var(--text-secondary); border-bottom: 1px solid rgba(150,150,150,0.2); padding-bottom: 0.5rem;">Membri attuali</h3>
                <div id="members-container" class="share-list-container"></div>
            </div>
        </div>
    `;

    const viewLists = container.querySelector('#view-lists');
    const viewItems = container.querySelector('#view-items');
    const viewShare = container.querySelector('#view-share');
    const listsContainer = container.querySelector('#lists-container');
    const itemsContainer = container.querySelector('#items-container');
    const membersContainer = container.querySelector('#members-container');
    const inputNewItem = container.querySelector('#new-item-input');
    const inputShareEmail = container.querySelector('#share-email-input');
    const shareMsg = container.querySelector('#share-msg');

    let currentListId = null;
    let currentList = null;
    let unsubscribeLists = null;
    let unsubscribeItems = null;

    // Chiudi tutti i menu a tendina se si clicca fuori
    document.addEventListener('click', closeAllDropdowns);

    function closeAllDropdowns(e) {
        // Ignora i click sui bottoni dei puntini stessi
        if (e && e.target.closest('.list-options-btn')) return;
        document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
            menu.classList.remove('active');
        });
    }

    // --- LOGICA LISTE ---

    function startListeningLists() {
        const q = query(collection(db, 'shopping_lists'), where('members', 'array-contains', user.email));

        unsubscribeLists = onSnapshot(q, (snapshot) => {
            closeAllDropdowns(); // Pulisce eventuali menu aperti
            listsContainer.innerHTML = '';
            if (snapshot.empty) {
                listsContainer.innerHTML = `<p style="text-align:center; color: var(--text-secondary); margin-top: 2rem;">Nessuna lista trovata. Creane una nuova!</p>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const listData = docSnap.data();
                const isShared = listData.members.length > 1;
                const isOwner = listData.ownerId === user.uid;
                
                const row = document.createElement('div');
                row.className = 'list-row';
                
                // HTML Base per la riga
                row.innerHTML = `
                    <span class="material-symbols-outlined" style="color: var(--accent-color);">list_alt</span>
                    <span class="list-row-name">${listData.name}</span>
                    ${isShared ? `<span class="material-symbols-outlined" style="color: var(--text-secondary); font-size: 1.2rem; margin-right: 0.5rem;" title="Condivisa">group</span>` : ''}
                    
                    <button class="list-options-btn" aria-label="Opzioni">
                        <span class="material-symbols-outlined">more_vert</span>
                    </button>
                    
                    <div class="dropdown-menu">
                        <button class="dropdown-item btn-rename"><span class="material-symbols-outlined" style="font-size:1.1rem;">edit</span> Rinomina</button>
                        ${isOwner ? `<button class="dropdown-item danger btn-delete"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span> Elimina</button>` : ''}
                    </div>
                `;
                
                // Click per aprire la lista (solo sull'area principale, non sul bottone opzioni)
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.list-options-btn') || e.target.closest('.dropdown-menu')) return;
                    openList(docSnap.id, listData);
                });

                // Click sui tre puntini
                const optionsBtn = row.querySelector('.list-options-btn');
                const dropdownMenu = row.querySelector('.dropdown-menu');
                
                optionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Chiudi altri menu prima di aprire questo
                    closeAllDropdowns();
                    dropdownMenu.classList.add('active');
                });

                // Rinomina
                row.querySelector('.btn-rename').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    closeAllDropdowns();
                    const newName = prompt("Nuovo nome della lista:", listData.name);
                    if (newName && newName.trim() !== '' && newName !== listData.name) {
                        await updateDoc(doc(db, 'shopping_lists', docSnap.id), { name: newName.trim() });
                    }
                });

                // Elimina (Solo Proprietario)
                const deleteBtn = row.querySelector('.btn-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        closeAllDropdowns();
                        if (confirm(`Sei sicuro di voler eliminare la lista "${listData.name}"? L'azione è irreversibile.`)) {
                            await deleteDoc(doc(db, 'shopping_lists', docSnap.id));
                        }
                    });
                }

                listsContainer.appendChild(row);
            });
        }, (error) => {
            console.error("Errore fetch liste:", error);
            listsContainer.innerHTML = `<p style="color:red; text-align:center;">Errore di connessione. Verifica le regole su Firebase.</p>`;
        });
    }

    container.querySelector('#btn-new-list').addEventListener('click', async () => {
        const name = prompt("Nome della nuova lista:");
        if (!name || name.trim() === '') return;

        try {
            await addDoc(collection(db, 'shopping_lists'), {
                name: name.trim(),
                ownerId: user.uid,
                ownerEmail: user.email,
                members: [user.email],
                createdAt: Date.now()
            });
        } catch (error) {
            alert("Errore durante la creazione della lista.");
        }
    });

    // --- LOGICA DETTAGLIO LISTA (VOCI) ---

    function openList(listId, listData) {
        currentListId = listId;
        currentList = listData;
        
        container.querySelector('#current-list-title').innerText = listData.name;
        
        viewLists.classList.add('hidden');
        viewItems.classList.remove('hidden');
        
        startListeningItems(listId);
    }

    container.querySelector('#btn-back-to-lists').addEventListener('click', () => {
        if (unsubscribeItems) unsubscribeItems();
        viewItems.classList.add('hidden');
        viewLists.classList.remove('hidden');
        currentListId = null;
    });

    function startListeningItems(listId) {
        if (unsubscribeItems) unsubscribeItems();

        const q = query(collection(db, `shopping_lists/${listId}/items`), orderBy('createdAt', 'asc'));

        unsubscribeItems = onSnapshot(q, (snapshot) => {
            itemsContainer.innerHTML = '';
            if (snapshot.empty) {
                itemsContainer.innerHTML = `<p style="text-align:center; color: var(--text-secondary); margin-top: 2rem;">Lista vuota.</p>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const item = docSnap.data();
                const row = document.createElement('div');
                row.className = `todo-row ${item.checked ? 'checked' : ''}`;
                
                const icon = item.checked ? 'close' : 'check_box_outline_blank';
                
                row.innerHTML = `
                    <span class="material-symbols-outlined todo-checkbox ${item.checked ? 'checked' : ''}" data-id="${docSnap.id}">
                        ${icon}
                    </span>
                    <span class="todo-text">${item.text}</span>
                `;

                const checkbox = row.querySelector('.todo-checkbox');
                checkbox.addEventListener('click', async () => {
                    const itemRef = doc(db, `shopping_lists/${listId}/items`, docSnap.id);
                    if (!item.checked) {
                        await updateDoc(itemRef, { checked: true });
                    } else {
                        await deleteDoc(itemRef);
                    }
                });

                itemsContainer.appendChild(row);
            });
            itemsContainer.scrollTop = itemsContainer.scrollHeight;
        });
    }

    container.querySelector('#form-add-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = inputNewItem.value.trim();
        if (!text || !currentListId) return;

        inputNewItem.value = '';
        try {
            await addDoc(collection(db, `shopping_lists/${currentListId}/items`), {
                text: text,
                checked: false,
                createdAt: Date.now()
            });
        } catch (error) {
            console.error("Errore aggiunta voce", error);
        }
    });

    // --- LOGICA CONDIVISIONE ---

    container.querySelector('#btn-open-share').addEventListener('click', () => {
        renderShareMembers();
        viewShare.classList.remove('hidden');
    });

    container.querySelector('#btn-close-share').addEventListener('click', () => {
        viewShare.classList.add('hidden');
        shareMsg.innerText = '';
        inputShareEmail.value = '';
    });

    function renderShareMembers() {
        membersContainer.innerHTML = '';
        if (!currentList) return;

        currentList.members.forEach(memberEmail => {
            const isOwner = memberEmail === currentList.ownerEmail;
            const isMe = memberEmail === user.email;
            
            const row = document.createElement('div');
            row.className = 'member-row';
            
            let badges = '';
            if (isOwner) badges += '<span class="member-badge">Proprietario</span>';
            if (isMe) badges += '<span class="member-badge" style="background:var(--text-secondary)">Tu</span>';

            let removeBtn = '';
            if (!isOwner && (currentList.ownerEmail === user.email || isMe)) {
                removeBtn = `<button class="text-btn" style="color: #ef4444; text-decoration: none;" data-email="${memberEmail}">Rimuovi</button>`;
            }

            row.innerHTML = `
                <div>
                    <span class="member-email">${memberEmail}</span>
                    ${badges}
                </div>
                ${removeBtn}
            `;

            if (removeBtn) {
                row.querySelector('button').addEventListener('click', async (e) => {
                    const emailToRemove = e.target.dataset.email;
                    const listRef = doc(db, 'shopping_lists', currentListId);
                    try {
                        await updateDoc(listRef, { members: arrayRemove(emailToRemove) });
                        if (emailToRemove === user.email) {
                            viewShare.classList.add('hidden');
                            container.querySelector('#btn-back-to-lists').click();
                        } else {
                            currentList.members = currentList.members.filter(m => m !== emailToRemove);
                            renderShareMembers();
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });
            }

            membersContainer.appendChild(row);
        });
    }

    container.querySelector('#form-share').addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailToAdd = inputShareEmail.value.trim().toLowerCase();
        if (!emailToAdd) return;

        if (currentList.members.includes(emailToAdd)) {
            shareMsg.innerText = "L'utente è già nella lista.";
            shareMsg.style.color = "#ef4444";
            return;
        }

        try {
            const listRef = doc(db, 'shopping_lists', currentListId);
            await updateDoc(listRef, { members: arrayUnion(emailToAdd) });
            
            shareMsg.innerText = "Utente aggiunto con successo!";
            shareMsg.style.color = "var(--accent-color)";
            inputShareEmail.value = '';
            
            currentList.members.push(emailToAdd);
            renderShareMembers();
            
            setTimeout(() => shareMsg.innerText = '', 3000);
        } catch (error) {
            shareMsg.innerText = "Errore durante la condivisione.";
            shareMsg.style.color = "#ef4444";
        }
    });

    startListeningLists();

    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(container)) {
            if (unsubscribeLists) unsubscribeLists();
            if (unsubscribeItems) unsubscribeItems();
            document.removeEventListener('click', closeAllDropdowns);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
