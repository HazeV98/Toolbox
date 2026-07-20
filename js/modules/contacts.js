import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, auth } from '../firebase-init.js';
import { isAdmin } from '../app.js';

if (!document.getElementById('contacts-module-styles')) {
    const style = document.createElement('style');
    style.id = 'contacts-module-styles';
    // ATTENZIONE: Aggiunto prefisso 'contact-' alle classi per evitare conflitti con links.js
    style.innerHTML = `
        .contacts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .contacts-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
        
        .contact-category-group { margin-bottom: 1rem; background: var(--surface-color); border-radius: 12px; border: 1px solid rgba(150,150,150,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.02); overflow: hidden; }
        .contact-category-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.2rem; cursor: pointer; font-weight: 600; color: var(--text-primary); user-select: none; transition: background 0.2s; }
        .contact-category-header:hover { background: rgba(150,150,150,0.05); }
        .contact-category-group.open .contact-category-header { background: rgba(150,150,150,0.03); border-bottom: 1px solid rgba(150,150,150,0.1); }
        
        .contact-category-content { display: none; padding: 0.8rem; background: transparent; }
        .contact-category-group.open .contact-category-content { display: block; }
        
        .contact-category-group .chevron { transition: transform 0.3s ease; color: var(--text-secondary); }
        .contact-category-group.open .chevron { transform: rotate(90deg); }
        
        .contact-row { padding: 1rem 1.2rem; background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 8px; margin-bottom: 0.8rem; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .contact-row:last-child { margin-bottom: 0; }
        
        .contact-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(150,150,150,0.15); padding-bottom: 8px;}
        .contact-name { font-weight: 600; font-size: 1.1rem; color: var(--text-primary); }
        .contact-body { display: flex; justify-content: space-between; align-items: center; }
        .contact-number { font-size: 1.2rem; font-family: monospace; color: var(--text-primary); letter-spacing: 0.5px; }
        
        .contact-actions { display: flex; gap: 10px; }
        .btn-action-contact { 
            background: rgba(150,150,150,0.05); 
            border: 1px solid rgba(150,150,150,0.2); 
            color: var(--text-secondary); 
            cursor: pointer; 
            width: 38px; 
            height: 38px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: 0.2s; 
            text-decoration: none; 
            box-sizing: border-box;
        }
        .btn-action-contact:hover { background: rgba(150,150,150,0.1); color: var(--text-primary); }
        .btn-action-contact.call { background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
        .btn-action-contact.call:hover { background: rgba(16, 185, 129, 0.2); }
        
        .btn-delete-contact { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; display: flex; transition: 0.2s; }
        .btn-delete-contact:hover { color: #ef4444; }

        .contact-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: bold; }
        .badge-public { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-private { background: rgba(150, 150, 150, 0.1); color: var(--text-secondary); border: 1px solid rgba(150, 150, 150, 0.3); }

        .copy-feedback {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: var(--text-primary); color: var(--bg-color); padding: 8px 16px;
            border-radius: 20px; font-size: 0.9rem; opacity: 0; pointer-events: none;
            transition: opacity 0.3s; z-index: 1000;
        }
        .copy-feedback.show { opacity: 1; }
    `;
    document.head.appendChild(style);

    if (!document.getElementById('contact-copy-feedback')) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'contact-copy-feedback';
        feedbackDiv.className = 'copy-feedback';
        feedbackDiv.innerText = 'Numero copiato!';
        document.body.appendChild(feedbackDiv);
    }
}

export function init(container) {
    const db = getFirestore(app);
    const user = auth.currentUser;
    
    if (!user) {
        container.innerHTML = `<div class="module-wrapper"><p style="text-align:center; color:red;">Devi fare l'accesso per utilizzare i Numeri Utili.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="module-wrapper" style="position: relative; display: flex; flex-direction: column; height: 100%;">
            
            <div class="contacts-header">
                <h2 class="contacts-title">
                    <span class="material-symbols-outlined">call</span> Numeri Utili
                </h2>
                <div style="display: flex; gap: 0.5rem;">
                    ${isAdmin ? `
                    <button id="btn-admin-contacts" class="icon-btn" aria-label="Numeri Utenti" style="color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">
                        <span class="material-symbols-outlined">group</span>
                    </button>
                    ` : ''}
                    <button id="btn-new-contact" class="icon-btn" aria-label="Nuovo Numero" style="background: var(--accent-color); color: white;">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                </div>
            </div>

            <div id="contacts-container" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                <div class="loader" style="margin: 2rem auto;"></div>
            </div>

            <!-- MODALE AGGIUNGI CONTATTO -->
            <div id="modal-add-contact" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 style="font-size: 1.3rem;">Aggiungi Numero</h2>
                        <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-add-contact" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Nome Contatto / Servizio</label>
                            <input type="text" id="contact-name" class="input-select" required placeholder="Es. Idraulico Mario">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Numero di Telefono</label>
                            <input type="tel" id="contact-phone" class="input-select" required placeholder="Es. 333 123 4567">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Categoria</label>
                            <select id="contact-category-sel" class="input-select" required>
                                <option value="" disabled selected>Scegli una categoria...</option>
                                <option value="__NEW__">+ Nuova categoria...</option>
                            </select>
                            <input type="text" id="contact-category-new" class="input-select hidden" style="margin-top: 0.5rem;" placeholder="Nome nuova categoria">
                        </div>
                        
                        ${isAdmin ? `
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; cursor: pointer; margin-top: 0.5rem; color: var(--text-primary);">
                            <input type="checkbox" id="contact-is-public" style="width:18px; height:18px; accent-color: var(--accent-color);">
                            Visibile a tutti (Pubblico)
                        </label>
                        ` : ''}

                        <button type="submit" class="btn primary" style="margin-top: 1rem;">Salva Numero</button>
                    </form>
                </div>
            </div>

            <!-- MODALE ADMIN: GESTIONE CONTATTI UTENTI -->
            ${isAdmin ? `
            <div id="modal-admin-contacts-view" class="modal-overlay hidden">
                <div class="modal-content" style="max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header" style="position: sticky; top: -1.5rem; background: var(--surface-color); z-index: 10;">
                        <h2 style="font-size: 1.3rem; color: #f59e0b; display:flex; align-items:center; gap:8px;">
                            <span class="material-symbols-outlined">group</span> Numeri Utenti
                        </h2>
                        <button id="btn-close-admin-contacts" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Qui vedi tutti i numeri salvati privatamente dagli utenti. Puoi promuoverli a "Pubblici" per renderli visibili a tutti.
                    </p>
                    <div id="admin-contacts-container" style="flex: 1; overflow-y: auto;"></div>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // --- REFERENZE DOM E CHIUSURA MODALI (CLICK FUORI) ---
    const contactsContainer = container.querySelector('#contacts-container');
    const modalAdd = container.querySelector('#modal-add-contact');
    const formAdd = container.querySelector('#form-add-contact');
    const selCategory = container.querySelector('#contact-category-sel');
    const inputNewCat = container.querySelector('#contact-category-new');
    
    const btnAdminContacts = container.querySelector('#btn-admin-contacts');
    const modalAdminView = container.querySelector('#modal-admin-contacts-view');
    const adminContactsContainer = container.querySelector('#admin-contacts-container');

    // Chiusura modali cliccando fuori
    container.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (overlay.id === 'modal-add-contact') {
                    formAdd.reset();
                    if (inputNewCat) inputNewCat.classList.add('hidden');
                } else if (overlay.id === 'modal-admin-contacts-view') {
                    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
                }
            }
        });
    });

    // --- STATO ---
    let publicContacts = [];
    let privateContacts = [];
    let existingCategories = new Set();
    let unsubPublic, unsubPrivate, unsubAdmin;

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            const feedback = document.getElementById('contact-copy-feedback');
            if (feedback) {
                feedback.classList.add('show');
                setTimeout(() => feedback.classList.remove('show'), 2000);
            }
        }).catch(err => console.error("Errore copia:", err));
    }

    // --- RENDER PRINCIPALE ---
    function renderContacts() {
        const allContacts = [...publicContacts, ...privateContacts];
        contactsContainer.innerHTML = '';
        existingCategories.clear();

        if (allContacts.length === 0) {
            contactsContainer.innerHTML = `<div class="status-message" style="text-align:center; margin-top:2rem; color:var(--text-secondary);">Nessun numero salvato. Aggiungine uno!</div>`;
            aggiornaSelectCategorie();
            return;
        }

        const grouped = {};
        allContacts.forEach(contact => {
            existingCategories.add(contact.category);
            if (!grouped[contact.category]) grouped[contact.category] = [];
            grouped[contact.category].push(contact);
        });

        Object.keys(grouped).sort().forEach(category => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'contact-category-group'; // Nuova classe

            let html = `
                <div class="contact-category-header">
                    <span>${category} <span style="font-size:0.8rem; margin-left:5px; color:var(--text-secondary);">(${grouped[category].length})</span></span>
                    <span class="material-symbols-outlined chevron">chevron_right</span>
                </div>
                <div class="contact-category-content">
            `;

            grouped[category].sort((a,b) => a.name.localeCompare(b.name)).forEach(contact => {
                const isMine = contact.ownerId === user.uid;
                const canDelete = isAdmin || (isMine && !contact.isPublic);
                
                let badge = contact.isPublic 
                    ? `<span class="contact-badge badge-public">Pubblico</span>` 
                    : `<span class="contact-badge badge-private">Privato</span>`;

                html += `
                    <div class="contact-row">
                        <div class="contact-header">
                            <div style="display:flex; align-items:center;">
                                <span class="contact-name">${contact.name}</span>
                                ${isAdmin || (!contact.isPublic && isMine) ? badge : ''}
                            </div>
                            ${canDelete ? `<button class="btn-delete-contact" data-id="${contact.id}" title="Elimina"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>` : ''}
                        </div>
                        <div class="contact-body">
                            <span class="contact-number">${contact.phone}</span>
                            <div class="contact-actions">
                                <button class="btn-action-contact btn-copy-contact" data-phone="${contact.phone}" title="Copia Numero">
                                    <span class="material-symbols-outlined" style="font-size:20px;">content_copy</span>
                                </button>
                                <a href="tel:${contact.phone.replace(/\s+/g, '')}" class="btn-action-contact call" title="Chiama">
                                    <span class="material-symbols-outlined" style="font-size:20px;">call</span>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            groupDiv.innerHTML = html;

            groupDiv.querySelector('.contact-category-header').addEventListener('click', () => {
                groupDiv.classList.toggle('open');
            });

            groupDiv.querySelectorAll('.btn-copy-contact').forEach(btn => {
                btn.addEventListener('click', () => copyToClipboard(btn.dataset.phone));
            });

            groupDiv.querySelectorAll('.btn-delete-contact').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm("Sei sicuro di voler eliminare questo contatto?")) {
                        await deleteDoc(doc(db, 'contacts', btn.dataset.id));
                    }
                });
            });

            contactsContainer.appendChild(groupDiv);
        });

        aggiornaSelectCategorie();
    }

    // --- AGGIORNA TENDINA CATEGORIE ---
    function aggiornaSelectCategorie() {
        const opts = Array.from(existingCategories).sort();
        let html = `<option value="" disabled selected>Scegli una categoria...</option>`;
        opts.forEach(c => html += `<option value="${c}">${c}</option>`);
        html += `<option value="__NEW__" style="font-weight:bold; color:var(--accent-color);">+ Nuova categoria...</option>`;
        selCategory.innerHTML = html;
    }

    selCategory.addEventListener('change', (e) => {
        if (e.target.value === '__NEW__') {
            inputNewCat.classList.remove('hidden');
            inputNewCat.required = true;
            inputNewCat.focus();
        } else {
            inputNewCat.classList.add('hidden');
            inputNewCat.required = false;
        }
    });

    // --- AGGIUNTA CONTATTO ---
    container.querySelector('#btn-new-contact').addEventListener('click', () => {
        modalAdd.classList.remove('hidden');
    });
    container.querySelector('#btn-close-add').addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        formAdd.reset();
        inputNewCat.classList.add('hidden');
    });

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = container.querySelector('#contact-name').value.trim();
        const phone = container.querySelector('#contact-phone').value.trim();
        let category = selCategory.value;
        if (category === '__NEW__') category = inputNewCat.value.trim();
        
        const isPublicChk = container.querySelector('#contact-is-public');
        const isPublic = isPublicChk ? isPublicChk.checked : false;

        if (!name || !phone || !category) return;

        const btnSubmit = formAdd.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        try {
            await addDoc(collection(db, 'contacts'), {
                name,
                phone,
                category,
                ownerId: user.uid,
                ownerEmail: user.email,
                isPublic: isPublic,
                createdAt: Date.now()
            });
            modalAdd.classList.add('hidden');
            formAdd.reset();
            inputNewCat.classList.add('hidden');
        } catch (error) {
            alert("Errore durante il salvataggio.");
        } finally {
            btnSubmit.disabled = false;
        }
    });

    // --- DATABASE LISTENERS ---
    const qPub = query(collection(db, 'contacts'), where('isPublic', '==', true));
    unsubPublic = onSnapshot(qPub, (snap) => {
        publicContacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderContacts();
    });

    const qPriv = query(collection(db, 'contacts'), where('ownerId', '==', user.uid), where('isPublic', '==', false));
    unsubPrivate = onSnapshot(qPriv, (snap) => {
        privateContacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderContacts();
    });

    // --- PANNELLO ADMIN (CONTATTI UTENTI) ---
    if (isAdmin && btnAdminContacts) {
        btnAdminContacts.addEventListener('click', () => {
            modalAdminView.classList.remove('hidden');
            
            const qAdmin = query(collection(db, 'contacts'), where('isPublic', '==', false));
            adminContactsContainer.innerHTML = '<div class="loader" style="margin:2rem auto;"></div>';

            if (unsubAdmin) unsubAdmin();
            unsubAdmin = onSnapshot(qAdmin, (snap) => {
                adminContactsContainer.innerHTML = '';
                const userContacts = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(c => c.ownerId !== user.uid);

                if (userContacts.length === 0) {
                    adminContactsContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top:2rem;">Nessun numero privato di altri utenti.</p>`;
                    return;
                }

                const groupedUsers = {};
                userContacts.forEach(contact => {
                    if (!groupedUsers[contact.category]) groupedUsers[contact.category] = [];
                    groupedUsers[contact.category].push(contact);
                });

                Object.keys(groupedUsers).sort().forEach(category => {
                    const catTitle = document.createElement('h3');
                    catTitle.style.cssText = "font-size:1rem; margin: 1rem 0 0.5rem 0; color:var(--text-secondary); border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:5px;";
                    catTitle.innerText = category;
                    adminContactsContainer.appendChild(catTitle);

                    groupedUsers[category].forEach(contact => {
                        const row = document.createElement('div');
                        row.className = 'contact-row';
                        row.style.background = "var(--surface-color)";
                        row.style.padding = "0.8rem";
                        row.style.boxShadow = "none";
                        
                        row.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                <span class="contact-name">${contact.name}</span>
                                <span style="font-size:0.8rem; color:#f59e0b;">da: ${contact.ownerEmail}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="contact-number">${contact.phone}</span>
                                <button class="btn outline btn-promote" data-id="${contact.id}" style="padding: 6px 10px; font-size: 0.8rem; flex:none;">Promuovi</button>
                            </div>
                        `;

                        row.querySelector('.btn-promote').addEventListener('click', async () => {
                            if (confirm(`Rendere il numero di "${contact.name}" visibile a tutti gli utenti?`)) {
                                await updateDoc(doc(db, 'contacts', contact.id), { isPublic: true });
                            }
                        });

                        adminContactsContainer.appendChild(row);
                    });
                });
            });
        });

        container.querySelector('#btn-close-admin-contacts').addEventListener('click', () => {
            modalAdminView.classList.add('hidden');
            if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
        });
    }

    // Cleanup
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            if (unsubPublic) unsubPublic();
            if (unsubPrivate) unsubPrivate();
            if (unsubAdmin) unsubAdmin();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
