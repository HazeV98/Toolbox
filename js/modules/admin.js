import { isAdmin } from '../app.js';

export function init(container) {
    if (!isAdmin) {
        container.innerHTML = `<div class="module-wrapper"><p style="text-align:center; color:#ef4444;">Accesso negato. Area riservata agli amministratori.</p></div>`;
        return;
    }

    // Inietta il CSS originale di Utility adattato al design di Suite
    if (!document.getElementById('admin-module-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-module-styles';
        style.innerHTML = `
            .admin-card-panel {
                background-color: var(--surface-color);
                padding: 24px;
                border-radius: 12px;
                width: 100%;
                box-shadow: var(--shadow);
                border: 1px solid rgba(150,150,150,0.2);
                box-sizing: border-box;
                margin-bottom: 20px;
            }
            .admin-card-panel h3 {
                margin-top: 0;
                font-size: 18px;
                color: var(--text-primary);
                border-bottom: 1px solid rgba(150,150,150,0.2);
                padding-bottom: 15px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .admin-input-group {
                position: relative;
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }
            .admin-input-group .admin-icon {
                position: absolute;
                left: 12px;
                color: var(--text-secondary);
                font-size: 20px;
                pointer-events: none;
            }
            .admin-input-field {
                width: 100%;
                padding: 10px 10px 10px 40px; /* Spazio per l'icona */
                background: rgba(150,150,150,0.05);
                border: 1px solid rgba(150,150,150,0.2);
                border-radius: 8px;
                color: var(--text-primary);
                font-family: inherit;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .admin-input-field:focus { 
                border-color: var(--accent-color); 
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
            }
            
            .admin-checkbox-container {
                display: flex;
                align-items: center;
                font-size: 14px;
                margin-top: 15px;
                margin-bottom: 20px;
                color: var(--text-secondary);
                cursor: pointer;
                font-weight: 500;
            }
            .admin-checkbox-container input { margin-right: 10px; width: 18px; height: 18px; accent-color: var(--accent-color); }
            
            .status-log { 
                font-size: 14px; 
                color: var(--text-secondary); 
                margin-top: 15px; 
                text-align: center; 
                min-height: 15px; 
                font-weight: 600; 
                background: rgba(150,150,150,0.05);
                padding: 10px;
                border-radius: 8px;
                border: 1px solid rgba(150,150,150,0.2);
            }
            
            .btn-action {
                padding: 12px 15px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                transition: opacity 0.2s, transform 0.1s;
            }
            .btn-action:hover { opacity: 0.9; }
            .btn-action:active { transform: scale(0.98); }
            .btn-warning { background-color: #f59e0b; color: white; }
            
            @keyframes admin-spin { 100% { transform: rotate(360deg); } }
            .admin-fa-spin { animation: admin-spin 1s linear infinite; }
        `;
        document.head.appendChild(style);
    }

    // Struttura HTML del modulo
    container.innerHTML = `
        <div style="padding: 10px; max-width: 800px; margin: 0 auto;">
            <h2 style="color: var(--text-primary); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                <span class="material-symbols-outlined" style="color: #f59e0b; font-size: 28px;">shield_person</span> Pannello Admin
            </h2>

            <!-- CARD: Sincronizzazione Mappa e Credenziali -->
            <div class="admin-card-panel">
                <h3><span class="material-symbols-outlined" style="color:#f59e0b;">rotate_right</span> Sincronizzazione Mappa</h3>
                
                <p style="font-size: 13.5px; color: var(--text-secondary); margin-top: 0; line-height: 1.6; margin-bottom: 20px;">
                    Rigenera l'indice globale del database (mappa_file.json) di GitHub. Operazione necessaria se l'app esterna non visualizza i file caricati o eliminati di recente.
                </p>

                <div class="admin-input-group">
                    <span class="material-symbols-outlined admin-icon">person</span>
                    <input type="text" id="gh-owner" class="admin-input-field" placeholder="Username GitHub">
                </div>
                
                <div class="admin-input-group">
                    <span class="material-symbols-outlined admin-icon">folder</span>
                    <input type="text" id="gh-repo" class="admin-input-field" placeholder="Nome Repository">
                </div>
                
                <div class="admin-input-group">
                    <span class="material-symbols-outlined admin-icon">key</span>
                    <input type="password" id="gh-token" class="admin-input-field" placeholder="Token GitHub (PAT)">
                </div>
                
                <label class="admin-checkbox-container">
                    <input type="checkbox" id="remember-token"> Ricorda Token su questo dispositivo
                </label>

                <button id="btn-forza-mappa" class="btn-action btn-warning">
                    <span id="map-btn-icon" class="material-symbols-outlined" style="font-size: 20px;">cell_tower</span> Forza Creazione Mappa
                </button>
                
                <div id="status-log-map" class="status-log">In attesa...</div>
            </div>

            <!-- Segnaposto per futuri moduli Admin (ZIP, Calendario, ecc.) -->
            <div id="admin-future-modules-container"></div>
            
        </div>
    `;

    // Referenze DOM
    const ownerInput = container.querySelector('#gh-owner');
    const repoInput = container.querySelector('#gh-repo');
    const tokenInput = container.querySelector('#gh-token');
    const rememberChk = container.querySelector('#remember-token');
    const btnForzaMappa = container.querySelector('#btn-forza-mappa');
    const statusLogMap = container.querySelector('#status-log-map');
    const mapBtnIcon = container.querySelector('#map-btn-icon');

    // --- PRECOMPILAZIONE E CACHE DATI ---
    const defaultOwner = "HazeV98";
    const defaultRepo = "Toolbox";

    // Se esiste un salvataggio locale lo usiamo, altrimenti usiamo i default
    const savedOwner = localStorage.getItem('suite_gh_owner') || defaultOwner;
    const savedRepo = localStorage.getItem('suite_gh_repo') || defaultRepo;
    const savedToken = localStorage.getItem('suite_gh_token'); // Nessun default per il token per sicurezza
    
    ownerInput.value = savedOwner;
    repoInput.value = savedRepo;
    
    if (savedToken) {
        tokenInput.value = savedToken;
        rememberChk.checked = true;
    } else {
        rememberChk.checked = false;
    }

    // --- LOGICA GITHUB E SINCRONIZZAZIONE ---
    
    function gestisciMemoriaToken(owner, repo, token, remember) {
        if (remember) {
            localStorage.setItem('suite_gh_owner', owner);
            localStorage.setItem('suite_gh_repo', repo);
            localStorage.setItem('suite_gh_token', token);
        } else {
            // Se tolgo la spunta, ripulisco il token ma mantengo Owner e Repo se voglio
            localStorage.removeItem('suite_gh_token');
            localStorage.setItem('suite_gh_owner', owner);
            localStorage.setItem('suite_gh_repo', repo);
        }
    }

    async function aggiornaMappaFiles(owner, repo, token) {
        let listaRotazioni = [];
        try {
            const urlRot = `https://api.github.com/repos/${owner}/${repo}/contents/rotazioni`;
            const resRot = await fetch(urlRot, { headers: { "Authorization": `token ${token}` } });
            if (resRot.ok) {
                const filesRot = await resRot.json();
                listaRotazioni = filesRot.filter(f => f.type === "file").map(f => f.name);
            }
        } catch(e) {}

        let alberoCompleto = [];
        try {
            const resRepo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { "Authorization": `token ${token}` } });
            if (resRepo.ok) {
                const repoData = await resRepo.json();
                const urlTree = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`;
                const resTree = await fetch(urlTree, { headers: { "Authorization": `token ${token}` } });
                if (resTree.ok) {
                    const treeData = await resTree.json();
                    alberoCompleto = treeData.tree.map(f => f.path);
                }
            }
        } catch(e) {}

        const mappaGlobale = { rotazioni: listaRotazioni, albero: alberoCompleto };
        const urlMappa = `https://api.github.com/repos/${owner}/${repo}/contents/mappa_file.json`;
        
        let shaMappa = null;
        try {
            const rM = await fetch(urlMappa, { headers: { "Authorization": `token ${token}` } });
            if (rM.ok) { 
                const dM = await rM.json(); 
                shaMappa = dM.sha; 
            }
        } catch(e) {}

        const putRes = await fetch(urlMappa, {
            method: "PUT",
            headers: { "Authorization": `token ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Update mappa_file.json via Admin Suite",
                content: btoa(unescape(encodeURIComponent(JSON.stringify(mappaGlobale)))),
                sha: shaMappa || undefined
            })
        });

        if (!putRes.ok) throw new Error("Errore API GitHub: Verifica che il Token sia valido e abbia i permessi 'repo'.");
    }

    // --- AZIONE PULSANTE FORZA MAPPA ---
    btnForzaMappa.addEventListener('click', async () => {
        const owner = ownerInput.value.trim();
        const repo = repoInput.value.trim();
        const token = tokenInput.value.trim();

        if (!owner || !repo || !token) {
            statusLogMap.innerHTML = `<span style="color: #ef4444;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">warning</span> Compila Username, Repo e Token.</span>`;
            return;
        }

        // Salva i dati in base alla scelta della checkbox
        gestisciMemoriaToken(owner, repo, token, rememberChk.checked);

        // Feedback visivo UI
        btnForzaMappa.disabled = true;
        btnForzaMappa.style.opacity = '0.7';
        mapBtnIcon.innerText = 'sync';
        mapBtnIcon.classList.add('admin-fa-spin');
        
        statusLogMap.innerHTML = `<span style="color: var(--text-primary);">Rigenerazione mappa globale in corso...</span>`;

        try {
            await aggiornaMappaFiles(owner, repo, token);
            statusLogMap.innerHTML = `<span style="color: #10b981;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">check_circle</span> Mappa rigenerata con successo!</span>`;
        } catch (e) {
            console.error(e);
            statusLogMap.innerHTML = `<span style="color: #ef4444;"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">error</span> ${e.message}</span>`;
        } finally {
            // Ripristino bottone
            btnForzaMappa.disabled = false;
            btnForzaMappa.style.opacity = '1';
            mapBtnIcon.classList.remove('admin-fa-spin');
            mapBtnIcon.innerText = 'cell_tower';
        }
    });
}
