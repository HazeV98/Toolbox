import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, auth } from '../firebase-init.js';
import { isAdmin } from '../app.js';

if (!document.getElementById('links-module-styles')) {
    const style = document.createElement('style');
    style.id = 'links-module-styles';
    style.innerHTML = `
        .links-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .links-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
        
        /* Rimosso overflow: hidden per permettere alla tendina di uscire */
        .category-group { margin-bottom: 1rem; background: var(--surface-color); border-radius: 12px; border: 1px solid rgba(150,150,150,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .category-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.2rem; cursor: pointer; font-weight: 600; background: rgba(150,150,150,0.03); user-select: none; transition: background 0.2s; border-radius: 12px 12px 0 0; }
        .category-group:not(.open) .category-header { border-radius: 12px; }
        .category-header:hover { background: rgba(150,150,150,0.08); }
        .category-content { display: none; padding: 0.5rem 0; border-top: 1px solid rgba(150,150,150,0.1); }
        .category-group.open .category-content { display: block; }
        .category-group .chevron { transition: transform 0.3s ease; color: var(--text-secondary); }
        .category-group.open .chevron { transform: rotate(90deg); }
        
        .link-row { display: flex; align-items: center; padding: 0.8rem 1.2rem; color: var(--text-primary); transition: background 0.2s; gap: 12px; position: relative; cursor: pointer; }
        .link-row:hover { background: rgba(150,150,150,0.05); }
        .link-icon-img { width: 28px; height: 28px; border-radius: 6px; object-fit: cover; background: white; border: 1px solid rgba(150,150,150,0.2); }
        .link-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .link-name { font-weight: 500; font-size: 1.05rem; white-space: normal; word-break: break-word; }
        
        .link-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: bold; white-space: nowrap;}
        .badge-public { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-private { background: rgba(150, 150, 150, 0.1); color: var(--text-secondary); border: 1px solid rgba(150, 150, 150, 0.3); }

        /* Menu a tendina per i 3 puntini */
        .list-options-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.5rem; border-radius: 50%; display: flex; align-items: center; transition: background 0.2s; }
        .list-options-btn:hover { background: rgba(150,150,150,0.1); color: var(--text-primary); }
        
        .dropdown-menu { position: absolute; right: 2rem; top: 2.5rem; background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); z-index: 100; display: flex; flex-direction: column; overflow: hidden; min-width: 150px; opacity: 0; pointer-events: none; transform: translateY(-10px); transition: opacity 0.2s, transform 0.2s; }
        .dropdown-menu.active { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .dropdown-item { padding: 0.8rem 1rem; text-align: left; background: none; border: none; width: 100%; cursor: pointer; color: var(--text-primary); font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; }
        .dropdown-item:hover { background: rgba(150,150,150,0.05); }
        .dropdown-item.danger { color: #ef4444; }
        .dropdown-item.danger:hover { background: rgba(239, 68, 68, 0.1); }
        
        /* Dettaglio Link */
        .detail-group { margin-bottom: 1.2rem; }
        .detail-label { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.3rem; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
        .detail-value-box { background: rgba(150,150,150,0.05); border: 1px solid rgba(150,150,150,0.2); padding: 0.8rem; border-radius: 8px; color: var(--text-primary); font-size: 0.95rem; line-height: 1.5; }
        .url-box { display: flex; align-items: center; gap: 10px; }
        .url-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent-color); font-family: monospace; font-size: 0.9rem;}
        
        /* Tooltip per il feedback della copia */
        .copy-feedback {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: var(--text-primary); color: var(--bg-color); padding: 8px 16px;
            border-radius: 20px; font-size: 0.9rem; opacity: 0; pointer-events: none;
            transition: opacity 0.3s; z-index: 1000;
        }
        .copy-feedback.show { opacity: 1; }
    `;
    document.head.appendChild(style);
    
    // Aggiungi div per il feedback visivo globale
    if (!document.getElementById('link-copy-feedback')) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'link-copy-feedback';
        feedbackDiv.className = 'copy-feedback';
        feedbackDiv.innerText = 'Link copiato!';
        document.body.appendChild(feedbackDiv);
    }
}

export function init(container) {
    const db = getFirestore(app);
    const user = auth.currentUser;
    
    if (!user) {
        container.innerHTML = `<div class="module-wrapper"><p style="text-align:center; color:red;">Devi fare l'accesso per utilizzare i Siti Utili.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="module-wrapper" style="position: relative; display: flex; flex-direction: column; height: 100%;">
            
            <div class="links-header">
                <h2 class="links-title">
                    <span class="material-symbols-outlined">bookmark</span> Siti Utili
                </h2>
                <div style="display: flex; gap: 0.5rem;">
                    ${isAdmin ? `
                    <button id="btn-admin-links" class="icon-btn" aria-label="Link Utenti" style="color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">
                        <span class="material-symbols-outlined">group</span>
                    </button>
                    ` : ''}
                    <button id="btn-new-link" class="icon-btn" aria-label="Nuovo Link" style="background: var(--accent-color); color: white;">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                </div>
            </div>

            <div id="links-container" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                <div class="loader" style="margin: 2rem auto;"></div>
            </div>

            <!-- MODALE AGGIUNGI LINK -->
            <div id="modal-add-link" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 style="font-size: 1.3rem;">Aggiungi Sito</h2>
                        <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-add-link" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Nome del sito</label>
                            <input type="text" id="add-link-name" class="input-select" required placeholder="Es. Wikipedia">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">URL (Link)</label>
                            <input type="url" id="add-link-url" class="input-select" required placeholder="https://...">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Categoria</label>
                            <select id="add-link-category-sel" class="input-select" required>
                                <option value="" disabled selected>Scegli una categoria...</option>
                                <option value="__NEW__">+ Nuova categoria...</option>
                            </select>
                            <input type="text" id="add-link-category-new" class="input-select hidden" style="margin-top: 0.5rem;" placeholder="Nome nuova categoria">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Descrizione (Opzionale)</label>
                            <textarea id="add-link-desc" class="input-select" rows="3" placeholder="Aggiungi una breve descrizione o annotazione..."></textarea>
                        </div>
                        
                        ${isAdmin ? `
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; cursor: pointer; margin-top: 0.5rem; color: var(--text-primary);">
                            <input type="checkbox" id="add-link-is-public" style="width:18px; height:18px; accent-color: var(--accent-color);">
                            Visibile a tutti (Pubblico)
                        </label>
                        ` : ''}

                        <button type="submit" class="btn primary" style="margin-top: 1rem;">Salva Link</button>
                    </form>
                </div>
            </div>

            <!-- MODALE MODIFICA LINK -->
            <div id="modal-edit-link" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 style="font-size: 1.3rem;">Modifica Sito</h2>
                        <button id="btn-close-edit" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-edit-link" style="display: flex; flex-direction: column; gap: 1rem;">
                        <input type="hidden" id="edit-link-id">
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Nome del sito</label>
                            <input type="text" id="edit-link-name" class="input-select" required>
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">URL (Link)</label>
                            <input type="url" id="edit-link-url" class="input-select" required>
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Categoria</label>
                            <input type="text" id="edit-link-category" class="input-select" required placeholder="Nome Categoria">
                        </div>
                        <div>
                            <label style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:5px; display:block;">Descrizione</label>
                            <textarea id="edit-link-desc" class="input-select" rows="3"></textarea>
                        </div>
                        
                        ${isAdmin ? `
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; cursor: pointer; margin-top: 0.5rem; color: var(--text-primary);">
                            <input type="checkbox" id="edit-link-is-public" style="width:18px; height:18px; accent-color: var(--accent-color);">
                            Visibile a tutti (Pubblico)
                        </label>
                        ` : ''}

                        <button type="submit" class="btn primary" style="margin-top: 1rem;">Aggiorna Link</button>
                    </form>
                </div>
            </div>

            <!-- MODALE DETTAGLIO LINK (VISUALIZZAZIONE) -->
            <div id="modal-view-link" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img id="view-link-icon" src="" style="width:28px; height:28px; border-radius:6px; display:none;">
                            <h2 id="view-link-title" style="font-size: 1.3rem;">Dettagli Sito</h2>
                        </div>
                        <button id="btn-close-view" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    
                    <div class="detail-group">
                        <span class="detail-label">Indirizzo Web</span>
                        <div class="detail-value-box url-box">
                            <span id="view-link-url-text" class="url-text">...</span>
                            <button id="btn-expand-url" class="icon-btn" style="padding:4px; color:var(--text-secondary);" title="Espandi URL"><span class="material-symbols-outlined">unfold_more</span></button>
                        </div>
                    </div>

                    <div class="detail-group" id="view-desc-container">
                        <span class="detail-label">Descrizione</span>
                        <div class="detail-value-box" id="view-link-desc-text">Nessuna descrizione.</div>
                    </div>

                    <div style="display:flex; gap:1rem; margin-top: 2rem;">
                        <button id="btn-view-copy" class="btn secondary outline" style="flex:1; display:flex; justify-content:center; align-items:center; gap:5px;">
                            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span> Copia
                        </button>
                        <a id="btn-view-open" href="#" target="_blank" class="btn primary" style="flex:1; display:flex; justify-content:center; align-items:center; gap:5px; text-decoration:none;">
                            <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span> Apri Sito
                        </a>
                    </div>
                </div>
            </div>

            <!-- MODALE ADMIN: GESTIONE LINK UTENTI -->
            ${isAdmin ? `
            <div id="modal-admin-links-view" class="modal-overlay hidden">
                <div class="modal-content" style="max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header" style="position: sticky; top: -1.5rem; background: var(--surface-color); z-index: 10;">
                        <h2 style="font-size: 1.3rem; color: #f59e0b; display:flex; align-items:center; gap:8px;">
                            <span class="material-symbols-outlined">group</span> Link Utenti
                        </h2>
                        <button id="btn-close-admin-links" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Qui vedi tutti i link personali salvati dagli utenti. Puoi promuoverli a "Pubblici" per renderli visibili a tutti.
                    </p>
                    <div id="admin-links-container" style="flex: 1; overflow-y: auto;"></div>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // --- REFERENZE DOM E CHIUSURA MODALI (CLICK FUORI) ---
    const linksContainer = container.querySelector('#links-container');
    
    const modalAdd = container.querySelector('#modal-add-link');
    const formAdd = container.querySelector('#form-add-link');
    const selCategoryAdd = container.querySelector('#add-link-category-sel');
    const inputNewCatAdd = container.querySelector('#add-link-category-new');
    
    const modalEdit = container.querySelector('#modal-edit-link');
    const formEdit = container.querySelector('#form-edit-link');
    
    const modalView = container.querySelector('#modal-view-link');
    const viewUrlText = container.querySelector('#view-link-url-text');
    const btnExpandUrl = container.querySelector('#btn-expand-url');
    const viewDescText = container.querySelector('#view-link-desc-text');
    
    const btnAdminLinks = container.querySelector('#btn-admin-links');
    const modalAdminView = container.querySelector('#modal-admin-links-view');
    const adminLinksContainer = container.querySelector('#admin-links-container');

    // Chiusura di tutte le modali cliccando sullo sfondo (overlay)
    container.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                
                // Reset specifici quando chiuse dall'esterno
                if (overlay.id === 'modal-add-link') {
                    formAdd.reset();
                    if (inputNewCatAdd) inputNewCatAdd.classList.add('hidden');
                } else if (overlay.id === 'modal-admin-links-view') {
                    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
                }
            }
        });
    });

    // --- STATO ---
    let publicLinks = [];
    let privateLinks = [];
    let existingCategories = new Set();
    let unsubPublic, unsubPrivate, unsubAdmin;

    // Chiudi tutti i menu a tendina se si clicca fuori
    document.addEventListener('click', closeAllDropdowns);
    function closeAllDropdowns(e) {
        if (e && e.target.closest('.list-options-btn')) return;
        document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
            menu.classList.remove('active');
            // Riporta la riga al suo z-index normale
            const row = menu.closest('.link-row');
            if (row) row.style.zIndex = '1';
        });
    }

    // Utilità
    function getDomain(urlStr) {
        try { return new URL(urlStr).hostname; } catch(e) { return urlStr; }
    }
    function getFaviconUrl(urlStr) {
        return `https://www.google.com/s2/favicons?domain=${getDomain(urlStr)}&sz=64`;
    }
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            const feedback = document.getElementById('link-copy-feedback');
            if (feedback) {
                feedback.classList.add('show');
                setTimeout(() => feedback.classList.remove('show'), 2000);
            }
        }).catch(err => console.error("Errore copia:", err));
    }

    // --- RENDER PRINCIPALE ---
    function renderLinks() {
        const allLinks = [...publicLinks, ...privateLinks];
        linksContainer.innerHTML = '';
        existingCategories.clear();

        if (allLinks.length === 0) {
            linksContainer.innerHTML = `<div class="status-message" style="text-align:center; margin-top:2rem; color:var(--text-secondary);">Nessun sito salvato. Aggiungine uno!</div>`;
            aggiornaSelectCategorie();
            return;
        }

        const grouped = {};
        allLinks.forEach(link => {
            existingCategories.add(link.category);
            if (!grouped[link.category]) grouped[link.category] = [];
            grouped[link.category].push(link);
        });

        Object.keys(grouped).sort().forEach(category => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'category-group';

            let html = `
                <div class="category-header">
                    <span>${category} <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:5px;">(${grouped[category].length})</span></span>
                    <span class="material-symbols-outlined chevron">chevron_right</span>
                </div>
                <div class="category-content">
            `;

            grouped[category].sort((a,b) => a.name.localeCompare(b.name)).forEach(link => {
                const isMine = link.ownerId === user.uid;
                const canEditDelete = isAdmin || (isMine && !link.isPublic);
                
                let badge = link.isPublic 
                    ? `<span class="link-badge badge-public">Pubblico</span>` 
                    : `<span class="link-badge badge-private">Privato</span>`;

                html += `
                    <div class="link-row" data-id="${link.id}">
                        <img src="${getFaviconUrl(link.url)}" class="link-icon-img" alt="icon" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'%23ccc\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/></svg>'">
                        <div class="link-info">
                            <div style="display:flex; align-items:center;">
                                <span class="link-name">${link.name}</span>
                                ${isAdmin || (!link.isPublic && isMine) ? badge : ''}
                            </div>
                        </div>
                        
                        ${canEditDelete ? `
                        <button class="list-options-btn" aria-label="Opzioni">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item btn-edit-link"><span class="material-symbols-outlined" style="font-size:1.1rem;">edit</span> Modifica</button>
                            <button class="dropdown-item danger btn-delete-link"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span> Elimina</button>
                        </div>
                        ` : ''}
                    </div>
                `;
            });

            html += `</div>`;
            groupDiv.innerHTML = html;

            // Toggle Categoria
            groupDiv.querySelector('.category-header').addEventListener('click', () => {
                groupDiv.classList.toggle('open');
            });

            // Assegna gli Event Listener per ogni riga
            groupDiv.querySelectorAll('.link-row').forEach(row => {
                const linkId = row.dataset.id;
                const linkObj = allLinks.find(l => l.id === linkId);

                // Cliccando sulla riga si apre l'Overlay di Visualizzazione
                row.addEventListener('click', (e) => {
                    // Ignora se si clicca sui 3 puntini o nel menu
                    if (e.target.closest('.list-options-btn') || e.target.closest('.dropdown-menu')) return;
                    apriVisualizzazioneLink(linkObj);
                });

                const optionsBtn = row.querySelector('.list-options-btn');
                const dropdownMenu = row.querySelector('.dropdown-menu');
                
                if (optionsBtn && dropdownMenu) {
                    optionsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeAllDropdowns();
                        dropdownMenu.classList.add('active');
                        // Porta la riga in primo piano per evitare che la tendina finisca sotto le righe successive
                        row.style.zIndex = '50';
                    });

                    // Modifica
                    row.querySelector('.btn-edit-link').addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeAllDropdowns();
                        apriModificaLink(linkObj);
                    });

                    // Elimina
                    row.querySelector('.btn-delete-link').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        closeAllDropdowns();
                        if (confirm(`Sei sicuro di voler eliminare "${linkObj.name}"?`)) {
                            await deleteDoc(doc(db, 'links', linkId));
                        }
                    });
                }
            });

            linksContainer.appendChild(groupDiv);
        });

        aggiornaSelectCategorie();
    }

    // --- GESTIONE OVERLAY VISUALIZZAZIONE ---
    function apriVisualizzazioneLink(link) {
        container.querySelector('#view-link-title').innerText = link.name;
        
        const iconEl = container.querySelector('#view-link-icon');
        const favUrl = getFaviconUrl(link.url);
        if (favUrl) { iconEl.src = favUrl; iconEl.style.display = 'block'; }
        else { iconEl.style.display = 'none'; }

        viewUrlText.innerText = link.url;
        viewUrlText.style.whiteSpace = 'nowrap'; // Reset espansione
        btnExpandUrl.innerHTML = '<span class="material-symbols-outlined">unfold_more</span>';

        viewDescText.innerText = link.description || 'Nessuna descrizione fornita.';
        viewDescText.style.color = link.description ? 'var(--text-primary)' : 'var(--text-secondary)';
        viewDescText.style.fontStyle = link.description ? 'normal' : 'italic';

        const btnCopy = container.querySelector('#btn-view-copy');
        const btnOpen = container.querySelector('#btn-view-open');
        
        btnCopy.onclick = () => copyToClipboard(link.url);
        btnOpen.href = link.url;

        modalView.classList.remove('hidden');
    }

    container.querySelector('#btn-close-view').addEventListener('click', () => {
        modalView.classList.add('hidden');
    });

    btnExpandUrl.addEventListener('click', () => {
        if (viewUrlText.style.whiteSpace === 'nowrap') {
            viewUrlText.style.whiteSpace = 'normal';
            viewUrlText.style.wordBreak = 'break-all';
            btnExpandUrl.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';
        } else {
            viewUrlText.style.whiteSpace = 'nowrap';
            viewUrlText.style.wordBreak = 'normal';
            btnExpandUrl.innerHTML = '<span class="material-symbols-outlined">unfold_more</span>';
        }
    });

    // --- AGGIORNA TENDINA CATEGORIE ---
    function aggiornaSelectCategorie() {
        const opts = Array.from(existingCategories).sort();
        let html = `<option value="" disabled selected>Scegli una categoria...</option>`;
        opts.forEach(c => html += `<option value="${c}">${c}</option>`);
        html += `<option value="__NEW__" style="font-weight:bold; color:var(--accent-color);">+ Nuova categoria...</option>`;
        selCategoryAdd.innerHTML = html;
    }

    selCategoryAdd.addEventListener('change', (e) => {
        if (e.target.value === '__NEW__') {
            inputNewCatAdd.classList.remove('hidden');
            inputNewCatAdd.required = true;
            inputNewCatAdd.focus();
        } else {
            inputNewCatAdd.classList.add('hidden');
            inputNewCatAdd.required = false;
        }
    });

    // --- AGGIUNTA LINK ---
    container.querySelector('#btn-new-link').addEventListener('click', () => {
        modalAdd.classList.remove('hidden');
    });
    container.querySelector('#btn-close-add').addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        formAdd.reset();
        inputNewCatAdd.classList.add('hidden');
    });

    formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let url = container.querySelector('#add-link-url').value.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        
        const name = container.querySelector('#add-link-name').value.trim();
        const description = container.querySelector('#add-link-desc').value.trim();
        
        let category = selCategoryAdd.value;
        if (category === '__NEW__') category = inputNewCatAdd.value.trim();
        
        const isPublicChk = container.querySelector('#add-link-is-public');
        const isPublic = isPublicChk ? isPublicChk.checked : false;

        if (!name || !url || !category) return;

        const btnSubmit = formAdd.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        try {
            await addDoc(collection(db, 'links'), {
                name,
                url,
                category,
                description,
                ownerId: user.uid,
                ownerEmail: user.email,
                isPublic: isPublic,
                createdAt: Date.now()
            });
            modalAdd.classList.add('hidden');
            formAdd.reset();
            inputNewCatAdd.classList.add('hidden');
        } catch (error) {
            console.error("Errore salvataggio link:", error);
            alert("Errore durante il salvataggio.");
        } finally {
            btnSubmit.disabled = false;
        }
    });

    // --- MODIFICA LINK ---
    function apriModificaLink(link) {
        container.querySelector('#edit-link-id').value = link.id;
        container.querySelector('#edit-link-name').value = link.name;
        container.querySelector('#edit-link-url').value = link.url;
        container.querySelector('#edit-link-category').value = link.category;
        container.querySelector('#edit-link-desc').value = link.description || "";
        
        if (isAdmin) {
            container.querySelector('#edit-link-is-public').checked = link.isPublic;
        }
        
        modalEdit.classList.remove('hidden');
    }

    container.querySelector('#btn-close-edit').addEventListener('click', () => {
        modalEdit.classList.add('hidden');
    });

    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const linkId = container.querySelector('#edit-link-id').value;
        
        let url = container.querySelector('#edit-link-url').value.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        
        const name = container.querySelector('#edit-link-name').value.trim();
        const category = container.querySelector('#edit-link-category').value.trim();
        const description = container.querySelector('#edit-link-desc').value.trim();
        
        const updates = { name, url, category, description };
        
        if (isAdmin) {
            updates.isPublic = container.querySelector('#edit-link-is-public').checked;
        }

        const btnSubmit = formEdit.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        try {
            await updateDoc(doc(db, 'links', linkId), updates);
            modalEdit.classList.add('hidden');
        } catch (error) {
            console.error("Errore aggiornamento link:", error);
            alert("Errore durante l'aggiornamento.");
        } finally {
            btnSubmit.disabled = false;
        }
    });

    // --- DATABASE LISTENERS ---
    const qPub = query(collection(db, 'links'), where('isPublic', '==', true));
    unsubPublic = onSnapshot(qPub, (snap) => {
        publicLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLinks();
    });

    const qPriv = query(collection(db, 'links'), where('ownerId', '==', user.uid), where('isPublic', '==', false));
    unsubPrivate = onSnapshot(qPriv, (snap) => {
        privateLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLinks();
    });

    // --- PANNELLO ADMIN (LINK DEGLI UTENTI) ---
    if (isAdmin && btnAdminLinks) {
        btnAdminLinks.addEventListener('click', () => {
            modalAdminView.classList.remove('hidden');
            
            const qAdmin = query(collection(db, 'links'), where('isPublic', '==', false));
            adminLinksContainer.innerHTML = '<div class="loader" style="margin:2rem auto;"></div>';

            if (unsubAdmin) unsubAdmin();
            unsubAdmin = onSnapshot(qAdmin, (snap) => {
                adminLinksContainer.innerHTML = '';
                const userLinks = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(l => l.ownerId !== user.uid);

                if (userLinks.length === 0) {
                    adminLinksContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top:2rem;">Nessun link privato di altri utenti.</p>`;
                    return;
                }

                const groupedUsers = {};
                userLinks.forEach(link => {
                    if (!groupedUsers[link.category]) groupedUsers[link.category] = [];
                    groupedUsers[link.category].push(link);
                });

                Object.keys(groupedUsers).sort().forEach(category => {
                    const catTitle = document.createElement('h3');
                    catTitle.style.cssText = "font-size:1rem; margin: 1rem 0 0.5rem 0; color:var(--text-secondary); border-bottom:1px solid rgba(150,150,150,0.2); padding-bottom:5px;";
                    catTitle.innerText = category;
                    adminLinksContainer.appendChild(catTitle);

                    groupedUsers[category].forEach(link => {
                        const row = document.createElement('div');
                        row.className = 'link-row';
                        row.style.background = "var(--surface-color)";
                        row.style.border = "1px solid rgba(150,150,150,0.2)";
                        row.style.borderRadius = "8px";
                        row.style.marginBottom = "8px";
                        
                        row.innerHTML = `
                            <img src="${getFaviconUrl(link.url)}" class="link-icon-img" alt="icon">
                            <div class="link-info">
                                <span class="link-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${link.name}</span>
                                <span class="link-url" style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${getDomain(link.url)} <span style="color:#f59e0b;">• da: ${link.ownerEmail}</span></span>
                            </div>
                            <button class="btn outline btn-promote" data-id="${link.id}" style="padding: 6px 10px; font-size: 0.8rem; flex:none;">Promuovi</button>
                        `;

                        row.querySelector('.btn-promote').addEventListener('click', async () => {
                            if (confirm(`Rendere "${link.name}" visibile a tutti gli utenti?`)) {
                                await updateDoc(doc(db, 'links', link.id), { isPublic: true });
                            }
                        });

                        adminLinksContainer.appendChild(row);
                    });
                });
            });
        });

        container.querySelector('#btn-close-admin-links').addEventListener('click', () => {
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
            document.removeEventListener('click', closeAllDropdowns);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
