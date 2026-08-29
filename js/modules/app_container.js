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
const APPS_FILE_PATH = 'assets/apps.json';

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
        .app-icon-card p { font-size: 0.8rem; font-weight: 600; line-height: 1.2; word-break: break-word; margin: 0; color: var(--text-primary); }
        
        .ac-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-soft); padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .ac-actions { display: flex; gap: 0.5rem; }
        .ac-actions button { transition: transform 0.2s; }
        .edit-active .ac-edit-btn { background: var(--accent-color); color: white; border-radius: 50%; }
        .edit-active .app-icon-card { border-style: dashed; border-color: var(--text-secondary); }
        .edit-active .app-icon-card:hover { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        
        .modal-body { padding: 1rem 0; display: flex; flex-direction: column; gap: 0.8rem; }
        .input-label { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: -0.5rem; display: block; }
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
        const res = await fetch(`${APPS_FILE_PATH}?t=${new Date().getTime()}`);
        if (!res.ok) throw new Error("File apps.json non trovato");
        currentApps = await res.json();
        renderGrid();
    } catch (err) {
        currentApps = [];
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-secondary);">Nessuna app installata o file assets/apps.json mancante.</p>';
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
        if (app.iconType === 'auto' && app.type === 'link') {
            let domain = app.target;
            try { domain = new URL(app.target).hostname; } catch(e){}
            visualHtml = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" style="width:40px; height:40px; border-radius:8px;">`;
        } else if (app.iconType === 'custom') {
            visualHtml = `<img src="${app.iconValue}?t=${new Date().getTime()}" style="width:40px; height:40px; border-radius:8px;">`;
        } else {
            visualHtml = `<i class="${app.iconValue || 'fas fa-link'}" style="font-size:2.5rem; color:var(--accent-color);"></i>`;
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
                    <label class="input-label">Nome App</label>
                    <input type="text" id="ac-add-name" class="input-select" placeholder="Es. Gestione Orari" style="width:100%;">
                    
                    <label class="input-label">Destinazione</label>
                    <div style="display:flex; gap:0.5rem;">
                        <select id="ac-add-type" class="input-select" style="width:120px;">
                            <option value="module">Modulo</option>
                            <option value="link">Link Esterno</option>
                        </select>
                        <input type="text" id="ac-add-target-module" class="input-select" placeholder="Nome file js (es. actv)" style="flex:1;">
                        <input type="url" id="ac-add-target-link" class="input-select hidden" placeholder="https://..." style="flex:1;">
                    </div>

                    <label class="input-label">Stile Icona</label>
                    <select id="ac-add-icon-type" class="input-select" style="width:100%;">
                        <option value="fontawesome">FontAwesome (Es. fas fa-car)</option>
                        <option value="custom">Carica PNG (assets/icons/)</option>
                        <option value="auto" class="auto-icon-opt hidden">Favicon Automatica (Solo Link)</option>
                    </select>
                    
                    <input type="text" id="ac-add-icon-fa" class="input-select" placeholder="Classe FA (es. fas fa-car)" style="width:100%;">
                    <input type="file" id="ac-add-icon-file" class="input-select hidden" accept="image/png" style="width:100%;">
                    
                    <button id="ac-confirm-add" class="btn primary" style="width:100%; margin-top:0.5rem;">Registra App</button>
                    <p id="ac-add-msg" class="msg-feedback" style="text-align:center;"></p>
                </div>
            </div>
        </div>

        <div id="ac-edit-app-modal" class="modal-overlay hidden" style="z-index: 2500;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Modifica App</h2>
                    <button id="ac-close-edit" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="modal-body">
                    <label class="input-label">Nome App</label>
                    <input type="text" id="ac-edit-name" class="input-select" style="width:100%;">
                    
                    <label class="input-label">Destinazione</label>
                    <div style="display:flex; gap:0.5rem;">
                        <select id="ac-edit-type" class="input-select" style="width:120px;">
                            <option value="module">Modulo</option>
                            <option value="link">Link</option>
                        </select>
                        <input type="text" id="ac-edit-target" class="input-select" style="flex:1;">
                    </div>

                    <label class="input-label">Stile Icona</label>
                    <select id="ac-edit-icon-type" class="input-select" style="width:100%;">
                        <option value="fontawesome">FontAwesome</option>
                        <option value="custom">Carica nuova PNG</option>
                        <option value="auto" class="auto-icon-opt hidden">Favicon Automatica</option>
                    </select>
                    
                    <input type="text" id="ac-edit-icon-fa" class="input-select" placeholder="Classe FA" style="width:100%;">
                    <input type="file" id="ac-edit-icon-file" class="input-select hidden" accept="image/png" style="width:100%;">
                    
                    <div style="display:flex; gap:0.5rem; margin-top: 1rem;">
                        <button id="ac-btn-delete" class="btn danger outline" style="flex:1;">Elimina</button>
                        <button id="ac-btn-save-edit" class="btn primary" style="flex:1;">Salva Modifiche</button>
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
            currentEditAppId = card.dataset.id;
            const appData = currentApps.find(a => a.id === currentEditAppId);
            
            document.getElementById('ac-edit-name').value = appData.name;
            document.getElementById('ac-edit-type').value = appData.type;
            document.getElementById('ac-edit-target').value = appData.target;
            document.getElementById('ac-edit-icon-type').value = appData.iconType || 'fontawesome';
            
            if(appData.type === 'link') {
                document.querySelector('#ac-edit-app-modal .auto-icon-opt').classList.remove('hidden');
            } else {
                document.querySelector('#ac-edit-app-modal .auto-icon-opt').classList.add('hidden');
            }

            const faInput = document.getElementById('ac-edit-icon-fa');
            const fileInput = document.getElementById('ac-edit-icon-file');
            faInput.value = (appData.iconType === 'fontawesome') ? appData.iconValue : '';
            fileInput.value = '';
            
            toggleIconInputs('ac-edit-icon-type', faInput, fileInput);
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

function toggleIconInputs(selectId, faInput, fileInput) {
    const val = document.getElementById(selectId).value;
    faInput.classList.add('hidden');
    fileInput.classList.add('hidden');
    
    if (val === 'fontawesome') faInput.classList.remove('hidden');
    if (val === 'custom') fileInput.classList.remove('hidden');
}

function bindAdminEvents() {
    document.getElementById('ac-btn-key').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.remove('hidden'));
    document.getElementById('ac-close-pat').addEventListener('click', () => document.getElementById('ac-pat-modal').classList.add('hidden'));
    document.getElementById('ac-save-pat').addEventListener('click', () => {
        githubPat = document.getElementById('ac-pat-input').value.trim();
        localStorage.setItem('toolbox_gh_pat', githubPat);
        document.getElementById('ac-pat-modal').classList.add('hidden');
    });

    document.getElementById('ac-btn-add').addEventListener('click', () => {
        document.getElementById('ac-add-modal').classList.remove('hidden');
    });
    document.getElementById('ac-close-add').addEventListener('click', () => document.getElementById('ac-add-modal').classList.add('hidden'));

    document.getElementById('ac-add-type').addEventListener('change', (e) => {
        const isModule = e.target.value === 'module';
        document.getElementById('ac-add-target-module').classList.toggle('hidden', !isModule);
        document.getElementById('ac-add-target-link').classList.toggle('hidden', isModule);
        
        const autoOpt = document.querySelector('#ac-add-modal .auto-icon-opt');
        autoOpt.classList.toggle('hidden', isModule);
        if (isModule && document.getElementById('ac-add-icon-type').value === 'auto') {
            document.getElementById('ac-add-icon-type').value = 'fontawesome';
            toggleIconInputs('ac-add-icon-type', document.getElementById('ac-add-icon-fa'), document.getElementById('ac-add-icon-file'));
        }
    });

    document.getElementById('ac-add-icon-type').addEventListener('change', () => {
        toggleIconInputs('ac-add-icon-type', document.getElementById('ac-add-icon-fa'), document.getElementById('ac-add-icon-file'));
    });

    document.getElementById('ac-close-edit').addEventListener('click', () => document.getElementById('ac-edit-app-modal').classList.add('hidden'));
    
    document.getElementById('ac-edit-type').addEventListener('change', (e) => {
        const isModule = e.target.value === 'module';
        const autoOpt = document.querySelector('#ac-edit-app-modal .auto-icon-opt');
        autoOpt.classList.toggle('hidden', isModule);
        if (isModule && document.getElementById('ac-edit-icon-type').value === 'auto') {
            document.getElementById('ac-edit-icon-type').value = 'fontawesome';
        }
        toggleIconInputs('ac-edit-icon-type', document.getElementById('ac-edit-icon-fa'), document.getElementById('ac-edit-icon-file'));
    });

    document.getElementById('ac-edit-icon-type').addEventListener('change', () => {
        toggleIconInputs('ac-edit-icon-type', document.getElementById('ac-edit-icon-fa'), document.getElementById('ac-edit-icon-file'));
    });

    document.getElementById('ac-confirm-add').addEventListener('click', () => handleAppSave(false));
    document.getElementById('ac-btn-save-edit').addEventListener('click', () => handleAppSave(true));

    document.getElementById('ac-btn-delete').addEventListener('click', async () => {
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

async function handleAppSave(isEdit) {
    if (!githubPat) return alert("Inserisci prima il token PAT cliccando sull'icona a chiave!");

    const prefix = isEdit ? 'ac-edit' : 'ac-add';
    const type = document.getElementById(`${prefix}-type`).value;
    const name = document.getElementById(`${prefix}-name`).value.trim();
    const iconType = document.getElementById(`${prefix}-icon-type`).value;
    const msgEl = document.getElementById(`${prefix}-msg`);
    
    let target = '';
    if (isEdit) {
        target = document.getElementById(`ac-edit-target`).value.trim();
    } else {
        target = type === 'link' 
            ? document.getElementById(`ac-add-target-link`).value.trim() 
            : document.getElementById(`ac-add-target-module`).value.trim();
    }

    if (!name || !target) {
        msgEl.innerText = "Compila Nome e Destinazione.";
        msgEl.style.color = "red";
        return;
    }

    msgEl.innerText = "Salvataggio in corso...";
    msgEl.style.color = "var(--text-primary)";

    try {
        let iconValue = '';
        if (iconType === 'fontawesome') {
            iconValue = document.getElementById(`${prefix}-icon-fa`).value.trim();
        } else if (iconType === 'custom') {
            const fileInput = document.getElementById(`${prefix}-icon-file`);
            if (fileInput.files.length > 0) {
                msgEl.innerText = "Caricamento PNG su GitHub in corso...";
                iconValue = await uploadIconToGitHub(fileInput.files[0]);
            } else if (isEdit) {
                const oldApp = currentApps.find(a => a.id === currentEditAppId);
                iconValue = oldApp.iconValue;
            } else {
                throw new Error("Seleziona un'immagine PNG da caricare.");
            }
        }

        const appObj = {
            id: isEdit ? currentEditAppId : 'app_' + Date.now(),
            name, type, target, iconType, iconValue
        };

        if (isEdit) {
            const idx = currentApps.findIndex(a => a.id === currentEditAppId);
            currentApps[idx] = appObj;
        } else {
            currentApps.push(appObj);
        }

        msgEl.innerText = "Sincronizzazione assets/apps.json in corso...";
        await syncAppsToGitHub(`${isEdit ? 'Modifica' : 'Aggiunta'} app: ${name}`);
        
        renderGrid();
        
        msgEl.innerText = "Operazione completata!";
        msgEl.style.color = "var(--accent-color)";
        setTimeout(() => document.getElementById(`${prefix}-modal`).classList.add('hidden'), 1500);

    } catch (err) {
        msgEl.innerText = err.message || "Errore durante l'operazione.";
        msgEl.style.color = "red";
    }
}

async function uploadIconToGitHub(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64Content = reader.result.split(',')[1];
            const filename = `icon_${Date.now()}.png`;
            const path = `assets/icons/${filename}`;
            try {
                await commitGitHubFile(path, null, base64Content, `Upload icona: ${filename}`);
                resolve(path);
            } catch (e) {
                reject(new Error("Errore upload immagine su GitHub"));
            }
        };
        reader.onerror = () => reject(new Error("Errore lettura file"));
        reader.readAsDataURL(file);
    });
}

async function syncAppsToGitHub(commitMsg) {
    let sha = null;
    try {
        const fileData = await fetchGitHubFileInfo(APPS_FILE_PATH);
        if (fileData) sha = fileData.sha;
    } catch (e) {}

    const updatedContent = JSON.stringify(currentApps, null, 4);
    const newContentBase64 = btoa(unescape(encodeURIComponent(updatedContent)));
    
    await commitGitHubFile(APPS_FILE_PATH, sha, newContentBase64, commitMsg);
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
    const bodyData = { message, content: base64Content, branch: GH_BRANCH };
    if (sha) bodyData.sha = sha; 
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubPat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });
    if (!response.ok) throw new Error('Errore durante il commit');
    return await response.json();
}
