import { isAdmin } from '../app.js';

let containerEl = null;
let editMode = false;
let githubPat = localStorage.getItem('toolbox_gh_pat') || '';
let currentEditCard = null; // Memorizza la card attualmente in fase di modifica

const GH_OWNER = 'HazeV98'; 
const GH_REPO = 'Toolbox';
const GH_BRANCH = 'main';

export async function init(container) {
    containerEl = container;
    injectStyles();
    buildMainUI();
    
    if (isAdmin) {
        buildAdminModals();
        bindAdminEvents();
    }
    
    bindGridEvents();
}

function injectStyles() {
    if (document.getElementById('app-container-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-container-styles';
    style.innerHTML = `
        .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 1rem; padding: 1rem 0; }
        .app-icon-card { display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(150,150,150,0.05); border: 1px solid var(--border-soft); border-radius: 12px; padding: 1rem 0.5rem; cursor: pointer; transition: all 0.2s; position: relative; text-align: center; }
        .app-icon-card:hover { border-color: var(--accent-color); background: rgba(37, 99, 235, 0.05); }
        .app-icon-card i { font-size: 2rem; color: var(--accent-color); margin-bottom: 0.5rem; }
        .app-icon-card span { font-size: 0.8rem; font-weight: 600; line-height: 1.2; word-break: break-word; }
        
        .ac-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-soft); padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .ac-actions { display: flex; gap: 0.5rem; }
        .ac-actions button { transition: transform 0.2s; }
        .edit-active .ac-edit-btn { background: var(--accent-color); color: white; border-radius: 50%; }
        .edit-active .app-icon-card { border-style: dashed; border-color: var(--text-secondary); }
        .edit-active .app-icon-card:hover { border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        
        .modal-body { padding: 1rem 0; display: flex; flex-direction: column; gap: 1rem; }
    `;
    document.head.appendChild(style);
}

function buildMainUI() {
    let adminControls = isAdmin ? `
        <div class="ac-actions">
            <button id="ac-btn-key" class="icon-btn hidden" title="Imposta Token PAT"><span class="material-symbols-outlined">key</span></button>
            <button id="ac-btn-add" class="icon-btn hidden" title="Aggiungi App"><span class="material-symbols-outlined">add</span></button>
            <button id="ac-btn-edit" class="icon-btn ac-edit-btn" title="Modalità Modifica"><span class="material-symbols-outlined">edit</span></button>
        </div>
    ` : '';

    containerEl.innerHTML = `
        <div class="module-wrapper" id="app-container-wrapper">
            <div class="ac-header">
                <h2 style="margin:0; font-size:1.3rem;">Le Mie App</h2>
                ${adminControls}
            </div>
            
            <div class="app-grid" id="ac-app-grid">
                <!-- ESEMPIO: Sostituire con il caricamento dinamico reale -->
                <div class="app-icon-card" data-link="https://www.google.com" data-type="link">
                    <i class="fa-solid fa-link" style="font-size:2.5rem; color:var(--accent-color); margin-bottom:8px;"></i>
                    <span>Link Esempio</span>
                </div>
            </div>
        </div>
    `;

    if (isAdmin) {
        document.getElementById('ac-btn-edit').addEventListener('click', toggleEditMode);
    }
}

function buildAdminModals() {
    const wrapper = document.createElement('div');
    wrapper.id = 'ac-admin-modals';
    wrapper.innerHTML = `
        <!-- MODALE TOKEN PAT -->
        <div id="ac-pat-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <!-- ... (Stesso codice di prima per il token) ... -->
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Token GitHub PAT</h2>
                    <button id="ac-close-pat" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="modal-body">
                    <input type="password" id="ac-pat-input" class="input-select" placeholder="ghp_xxxxxxxxxxxx" value="${githubPat}" style="width:100%;">
                    <button id="ac-save-pat" class="btn primary" style="width:100%;">Salva Token</button>
                </div>
            </div>
        </div>

        <!-- MODALE AGGIUNGI APP -->
        <div id="ac-add-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <!-- ... (Stesso codice di prima per aggiungere app) ... -->
        </div>

        <!-- MODALE MODIFICA/ELIMINA APP -->
        <div id="ac-edit-app-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Modifica App</h2>
                    <button id="ac-close-edit-app" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="modal-body">
                    <input type="text" id="ac-edit-app-name" class="input-select" placeholder="Nome App" style="width:100%;">
                    <input type="text" id="ac-edit-app-icon" class="input-select" placeholder="Icona FontAwesome (es. fa-solid fa-car)" style="width:100%;">
                    
                    <div style="display:flex; gap:0.5rem; margin-top: 1rem;">
                        <button id="ac-btn-delete-app" class="btn danger outline" style="flex:1;">Elimina</button>
                        <button id="ac-btn-save-edit" class="btn primary" style="flex:1;">Salva</button>
                    </div>
                    <p id="ac-edit-msg" class="msg-feedback" style="text-align:center;"></p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);
}

function toggleEditMode() {
    editMode = !editMode;
    const wrapper = document.getElementById('app-container-wrapper');
    const btnAdd = document.getElementById('ac-btn-add');
    const btnKey = document.getElementById('ac-btn-key');

    if (editMode) {
        wrapper.classList.add('edit-active');
        btnAdd.classList.remove('hidden');
        btnKey.classList.remove('hidden');
    } else {
        wrapper.classList.remove('edit-active');
        btnAdd.classList.add('hidden');
        btnKey.classList.add('hidden');
    }
}

function bindGridEvents() {
    document.getElementById('ac-app-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.app-icon-card');
        if (!card) return;

        if (editMode && isAdmin) {
            // Modalità Modifica: Apri il modale con i dati della card
            currentEditCard = card;
            const name = card.querySelector('span').innerText;
            const iconElement = card.querySelector('i');
            const iconClass = iconElement ? iconElement.className : '';
            
            document.getElementById('ac-edit-app-name').value = name;
            document.getElementById('ac-edit-app-icon').value = iconClass;
            document.getElementById('ac-edit-msg').innerText = '';
            
            document.getElementById('ac-edit-app-modal').classList.remove('hidden');
        } else {
            // Modalità Normale: Avvia l'app o apri il link
            const link = card.getAttribute('data-link');
            const module = card.getAttribute('data-module');
            if (link) window.open(link, '_blank');
            // Se gestisci l'apertura dei moduli qui dentro, aggiungi la logica per chiamare openModule() di app.js
        }
    });
}

function bindAdminEvents() {
    // --- Token ---
    document.getElementById('ac-btn-key').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.remove('hidden'));
    document.getElementById('ac-close-pat').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.add('hidden'));
    document.getElementById('ac-save-pat').addEventListener('click', () => {
        githubPat = document.getElementById('ac-pat-input').value.trim();
        localStorage.setItem('toolbox_gh_pat', githubPat);
        document.getElementById('ac-pat-modal').classList.add('hidden');
    });

    // --- Chiusura Modale Modifica ---
    document.getElementById('ac-close-edit-app').addEventListener('click', () => document.getElementById('ac-edit-app-modal').classList.add('hidden'));

    // --- Salvataggio Modifica App ---
    document.getElementById('ac-btn-save-edit').addEventListener('click', async () => {
        const newName = document.getElementById('ac-edit-app-name').value.trim();
        const newIcon = document.getElementById('ac-edit-app-icon').value.trim();
        const msgEl = document.getElementById('ac-edit-msg');

        if (!newName || !newIcon) return msgEl.innerText = "Compila tutti i campi.";
        
        msgEl.innerText = "Aggiornamento su GitHub in corso...";
        
        // Calcola l'HTML della card originale (per la ricerca) e di quella nuova
        const oldHtml = currentEditCard.outerHTML;
        
        // Aggiorna visivamente il DOM
        currentEditCard.querySelector('span').innerText = newName;
        if(currentEditCard.querySelector('i')) currentEditCard.querySelector('i').className = newIcon;
        const newHtml = currentEditCard.outerHTML;

        try {
            await updateGitHubFile('index.html', oldHtml, newHtml, `Modifica app: ${newName}`);
            msgEl.innerText = "Modifica salvata!";
            msgEl.style.color = "var(--accent-color)";
            setTimeout(() => document.getElementById('ac-edit-app-modal').classList.add('hidden'), 1500);
        } catch (err) {
            msgEl.innerText = "Errore durante il salvataggio.";
            msgEl.style.color = "red";
        }
    });

    // --- Eliminazione App ---
    document.getElementById('ac-btn-delete-app').addEventListener('click', async () => {
        const msgEl = document.getElementById('ac-edit-msg');
        if (!confirm("Sei sicuro di voler eliminare questa App?")) return;

        msgEl.innerText = "Eliminazione da GitHub in corso...";
        const oldHtml = currentEditCard.outerHTML;

        try {
            await updateGitHubFile('index.html', oldHtml, '', "Rimozione app");
            currentEditCard.remove(); // Rimuovi dal DOM
            document.getElementById('ac-edit-app-modal').classList.add('hidden');
        } catch (err) {
            msgEl.innerText = "Errore durante l'eliminazione.";
            msgEl.style.color = "red";
        }
    });
}

// Funzione unificata per modificare o rimuovere uno snippet di testo dal file
async function updateGitHubFile(filename, oldSnippet, newSnippet, commitMsg) {
    if (!githubPat) throw new Error('Token mancante');
    
    const fileData = await fetchGitHubFile(filename);
    const currentContent = decodeURIComponent(escape(atob(fileData.content)));
    
    // Sostituisce lo snippet esatto. (Se newSnippet è vuoto '', equivale a un'eliminazione)
    // Nota: in produzione è consigliabile usare espressioni regolari flessibili se l'HTML subisce formattazioni automatiche
    const updatedContent = currentContent.replace(oldSnippet, newSnippet);
    
    if (currentContent === updatedContent) {
        throw new Error("Impossibile trovare la corrispondenza esatta nel file sorgente.");
    }

    const newContentBase64 = btoa(unescape(encodeURIComponent(updatedContent)));
    await commitGitHubFile(filename, fileData.sha, newContentBase64, commitMsg);
}

async function fetchGitHubFile(path) {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
    const response = await fetch(url, { headers: { 'Authorization': `token ${githubPat}` } });
    if (!response.ok) throw new Error('File non trovato');
    return await response.json();
}

async function commitGitHubFile(path, sha, base64Content, message) {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubPat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, content: base64Content, sha: sha, branch: GH_BRANCH })
    });
    if (!response.ok) throw new Error('Errore durante il commit');
    return await response.json();
}
