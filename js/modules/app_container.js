import { isAdmin } from '../app.js';

let containerEl = null;
let editMode = false;
let githubPat = localStorage.getItem('toolbox_gh_pat') || '';
let currentEditAppId = null;
let currentApps = [];

// Credenziali Repository
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
    await loadApps();
}

function injectStyles() {
    if (document.getElementById('app-container-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-container-styles';
    style.innerHTML = `
        .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 1rem; padding: 1rem 0; }
        .app-icon-card { display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(150,150,150,0.05); border: 1px solid var(--border-soft); border-radius: 12px; padding: 1rem 0.5rem; cursor: pointer; transition: all 0.2s; position: relative; text-align: center; text-decoration: none; }
        .app-icon-card:hover { border-color: var(--accent-color); background: rgba(37, 99, 235, 0.05); }
        .app-icon-card i, .app-icon-card img { margin-bottom: 0.5rem; }
        .app-icon-card p, .app-icon-card span { font-size: 0.8rem; font-weight: 600; line-height: 1.2; word-break: break-word; margin: 0; color: var(--text-primary); }
        
        .ac-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-soft); padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .ac-actions { display: flex; gap: 0.5rem; }
        .ac-actions button { transition: transform 0.2s; }
        .edit-active .ac-edit-btn { background: var(--accent-color); color: white; border-radius: 50%; }
        .edit-active .app-icon-card { border-style: dashed; border-color: var(--text-secondary); }
        .edit-active .app-icon-card:hover { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
        
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
                <div class="loader" style="margin: 2rem auto; grid-column: 1 / -1;"></div>
            </div>
        </div>
    `;

    if (isAdmin) {
        document.getElementById('ac-btn-edit').addEventListener('click', toggleEditMode);
    }
}

async function loadApps() {
    const grid = document.getElementById('ac-app-grid');
    try {
        const res = await fetch(`apps.json?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("File apps.json non trovato");
        currentApps = await res.json();
        renderGrid();
    } catch (err) {
        currentApps = [];
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-secondary);">Nessuna app installata o file apps.json mancante.</p>';
    }
}

function renderGrid() {
    const grid = document.getElementById('ac-app-grid');
    grid.innerHTML = '';
    
    currentApps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-icon-card';
        card.dataset.id = app.id;
        card.dataset.type = app.type;
        card.dataset.target = app.target;
        
        let visualHtml = '';
        if (app.type === 'link') {
            let domain = app.target;
            try { domain = new URL(app.target).hostname; } catch(e){}
            const fallbackAttr = `this.outerHTML='<i class=&quot;${app.icon}&quot; style=&quot;font-size:2.5rem; color:var(--accent-color); margin-bottom:8px;&quot;></i>'`;
            visualHtml = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" style="width:40px; height:40px; margin-bottom:8px; border-radius:8px;" onerror="${fallbackAttr}">`;
        } else {
            visualHtml = `<i class="${app.icon}" style="font-size:2.5rem; color:var(--accent-color); margin-bottom:8px;"></i>`;
        }
        
        card.innerHTML = `${visualHtml}<p>${app.name}</p>`;
        grid.appendChild(card);
    });
}

function buildAdminModals() {
    const wrapper = document.createElement('div');
    wrapper.id = 'ac-admin-modals';
    wrapper.innerHTML = `
        <div id="ac-pat-modal" class="modal-overlay hidden" style="z-index: 2500;">
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

        <div id="ac-add-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Aggiungi App</h2>
                    <button id="ac-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="modal-body">
                    <select id="ac-add-type" class="input-select" style="width:100%;">
                        <option value="module">Modulo Esistente (non registrato)</option>
                        <option value="link">Link Esterno</option>
                    </select>
                    <div id="ac-module-select-wrap">
                        <select id="ac-module-select" class="input-select" style="width:100%;"><option value="">Caricamento moduli...</option></select>
                    </div>
                    <div id="ac-link-input-wrap" class="hidden">
                        <input type="url" id="ac-link-url" class="input-select" placeholder="https://..." style="width:100%;">
                    </div>
                    <input type="text" id="ac-app-name" class="input-select" placeholder="Nome App" style="width:100%;">
                    <input type="text" id="ac-app-icon" class="input-select" placeholder="Icona FontAwesome (es. fas fa-car)" style="width:100%;">
                    <button id="ac-confirm-add" class="btn primary" style="width:100%;">Registra e Aggiungi</button>
                    <p id="ac-add-msg" class="msg-feedback" style="text-align:center;"></p>
                </div>
            </div>
        </div>

        <div id="ac-edit-app-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Gestione App</h2>
                    <button id="ac-close-edit-app" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="modal-body">
                    <p style="font-size: 0.9rem; text-align: center;">Vuoi rimuovere <strong><span id="ac-del-target-name"></span></strong>?</p>
                    <button id="ac-btn-delete-app" class="btn danger" style="width:100%;">Elimina App Definitivamente</button>
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
            currentEditAppId = card.dataset.id;
            const name = card.querySelector('p').innerText;
            document.getElementById('ac-del-target-name').innerText = name;
            document.getElementById('ac-edit-msg').innerText = '';
            document.getElementById('ac-edit-app-modal').classList.remove('hidden');
        } else {
            const type = card.dataset.type;
            const target = card.dataset.target;
            
            if (type === 'link') {
                window.open(target, '_blank');
            } else if (type === 'module') {
                const nativeCard = document.querySelector('#view-home .module-card');
                
                if (nativeCard) {
                    const originalModule = nativeCard.getAttribute('data-module');
                    const pEl = nativeCard.querySelector('p');
                    const originalTitle = pEl.innerText;

                    nativeCard.setAttribute('data-module', target);
                    pEl.innerText = card.querySelector('p').innerText;

                    nativeCard.click();

                    nativeCard.setAttribute('data-module', originalModule);
                    pEl.innerText = originalTitle;
                }
            }
        }
    });
}

function bindAdminEvents() {
    document.getElementById('ac-btn-key').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.remove('hidden'));
    document.getElementById('ac-close-pat').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.add('hidden'));
    document.getElementById('ac-save-pat').addEventListener('click', () => {
        githubPat = document.getElementById('ac-pat-input').value.trim();
        localStorage.setItem('toolbox_gh_pat', githubPat);
        document.getElementById('ac-pat-modal').classList.add('hidden');
    });

    document.getElementById('ac-btn-add').addEventListener('click', async () => {
        document.getElementById('ac-add-modal').classList.remove('hidden');
        await loadUnregisteredModules();
    });
    document.getElementById('ac-close-add').addEventListener('click', () => document.getElementById('ac-add-modal').classList.add('hidden'));
    document.getElementById('ac-close-edit-app').addEventListener('click', () => document.getElementById('ac-edit-app-modal').classList.add('hidden'));

    document.getElementById('ac-add-type').addEventListener('change', (e) => {
        if (e.target.value === 'module') {
            document.getElementById('ac-module-select-wrap').classList.remove('hidden');
            document.getElementById('ac-link-input-wrap').classList.add('hidden');
        } else {
            document.getElementById('ac-module-select-wrap').classList.add('hidden');
            document.getElementById('ac-link-input-wrap').classList.remove('hidden');
        }
    });

    document.getElementById('ac-confirm-add').addEventListener('click', handleAppRegistration);

    document.getElementById('ac-btn-delete-app').addEventListener('click', async () => {
        const msgEl = document.getElementById('ac-edit-msg');
        msgEl.innerText = "Eliminazione in corso...";
        
        try {
            currentApps = currentApps.filter(app => app.id !== currentEditAppId);
            await syncAppsToGitHub("Rimozione app");
            
            renderGrid();
            document.getElementById('ac-edit-app-modal').classList.add('hidden');
        } catch (err) {
            msgEl.innerText = "Errore durante l'eliminazione.";
            msgEl.style.color = "red";
        }
    });
}

async function loadUnregisteredModules() {
    const select = document.getElementById('ac-module-select');
    try {
        const res = await fetch('mappa_file.json');
        const mapData = await res.json();
        
        const allModules = mapData.albero
            .filter(path => path.startsWith('js/modules/') && path.endsWith('.js'))
            .map(path => path.replace('js/modules/', '').replace('.js', ''))
            .filter(m => !['actv', 'admin', 'app_container', 'calendar', 'contacts', 'links', 'list', 'notes', 'passwords', 'sensors'].includes(m));
        
        select.innerHTML = allModules.length === 0 
            ? '<option value="">Nessun modulo nuovo trovato</option>' 
            : allModules.map(m => `<option value="${m}">${m}</option>`).join('');
    } catch (err) {
        select.innerHTML = '<option value="">Errore caricamento mappa</option>';
    }
}

async function handleAppRegistration() {
    if (!githubPat) return alert("Inserisci prima il token PAT cliccando sull'icona a chiave!");

    const type = document.getElementById('ac-add-type').value;
    const name = document.getElementById('ac-app-name').value.trim();
    const icon = document.getElementById('ac-app-icon').value.trim();
    const target = type === 'module' ? document.getElementById('ac-module-select').value : document.getElementById('ac-link-url').value.trim();
    const msgEl = document.getElementById('ac-add-msg');

    if (!name || !icon || !target) {
        msgEl.innerText = "Compila tutti i campi.";
        msgEl.style.color = "red";
        return;
    }

    msgEl.innerText = "Registrazione in corso...";
    msgEl.style.color = "var(--text-primary)";

    const newApp = {
        id: 'app_' + Date.now(),
        name: name,
        type: type,
        target: target,
        icon: icon
    };

    try {
        currentApps.push(newApp);
        await syncAppsToGitHub(`Aggiunta app: ${name}`);
        
        renderGrid();
        
        document.getElementById('ac-app-name').value = '';
        document.getElementById('ac-app-icon').value = '';
        if(type === 'link') document.getElementById('ac-link-url').value = '';
        
        msgEl.innerText = "App aggiunta con successo!";
        msgEl.style.color = "var(--accent-color)";
        setTimeout(() => document.getElementById('ac-add-modal').classList.add('hidden'), 1500);

    } catch (err) {
        msgEl.innerText = err.message || "Errore durante la comunicazione con GitHub.";
        msgEl.style.color = "red";
        currentApps.pop(); 
    }
}

async function syncAppsToGitHub(commitMsg) {
    if (!githubPat) throw new Error('Token mancante');
    
    let sha = null;
    try {
        const fileData = await fetchGitHubFileInfo('apps.json');
        if (fileData) sha = fileData.sha;
    } catch (e) {}

    const updatedContent = JSON.stringify(currentApps, null, 4);
    const newContentBase64 = btoa(unescape(encodeURIComponent(updatedContent)));
    
    await commitGitHubFile('apps.json', sha, newContentBase64, commitMsg);
}

async function fetchGitHubFileInfo(path) {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
    const response = await fetch(url, { headers: { 'Authorization': `token ${githubPat}` } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Errore durante la lettura del file');
    return await response.json();
}

async function commitGitHubFile(path, sha, base64Content, message) {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
    const bodyData = { message: message, content: base64Content, branch: GH_BRANCH };
    if (sha) bodyData.sha = sha; 
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubPat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });
    if (!response.ok) throw new Error('Errore durante il commit');
    return await response.json();
}
