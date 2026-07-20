export function init(container) {
    // Inietta gli stili specifici per il modulo Orari Actv
    if (!document.getElementById('actv-module-styles')) {
        const style = document.createElement('style');
        style.id = 'actv-module-styles';
        style.innerHTML = `
            .actv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
            .actv-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
            
            /* Riga a forma di "Pillola" (semicerchi uniti) */
            .actv-row { 
                display: flex; align-items: center; justify-content: space-between; 
                padding: 0.8rem 1.2rem; border: 1px solid rgba(150,150,150,0.2); 
                background: var(--surface-color); border-radius: 50px; margin-bottom: 0.8rem; 
                text-decoration: none; color: var(--text-primary); transition: background 0.2s, transform 0.1s;
                box-shadow: var(--shadow);
                flex: 1; 
            }
            .actv-row.clickable { cursor: pointer; }
            .actv-row.clickable:hover { background: rgba(150,150,150,0.05); }
            .actv-row.clickable:active { transform: scale(0.98); }
            
            .actv-row-left { display: flex; align-items: center; gap: 12px; flex: 1; overflow: hidden; }
            .actv-row-name { font-weight: 500; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            /* Contenitore per affiancare Pillola (Apri) e Tondo (Scarica) */
            .actv-pdf-wrapper {
                display: flex; align-items: stretch; gap: 10px; margin-bottom: 0.8rem;
            }

            /* Tasto tondo perfetto per il download */
            .actv-circle-down { 
                background: var(--surface-color); 
                border: 1px solid rgba(150,150,150,0.2); 
                color: var(--text-secondary); 
                cursor: pointer; 
                width: 52px; /* Larghezza fissa uguale all'altezza per renderlo tondo */
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                transition: 0.2s; 
                box-shadow: var(--shadow);
                flex-shrink: 0; /* Impedisce che si rimpicciolisca */
            }
            .actv-circle-down:hover { background: rgba(150,150,150,0.05); color: var(--text-primary); transform: scale(1.05); }
            .actv-circle-down:active { transform: scale(0.95); }

            /* Colori Specifici per i tipi di riga */
            .icon-realtime { color: #10b981; } /* Verde */
            .icon-folder { color: #f59e0b; }   /* Arancione */
            .icon-pdf { color: var(--accent-color); } /* Blu */
            .icon-pdf-completo { color: #ef4444; } /* Rosso */

            .status-message { text-align: center; color: var(--text-secondary); padding: 2rem 1rem; font-size: 1rem; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="module-wrapper" style="display: flex; flex-direction: column; height: 100%;">
            <div class="actv-header">
                <div style="display: flex; align-items: center;">
                    <button id="btn-back-actv" class="icon-btn hidden" style="margin-right: 0.5rem;">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 id="actv-view-title" class="actv-title">
                        <span class="material-symbols-outlined">directions_bus</span> Orari Actv
                    </h2>
                </div>
            </div>

            <div id="actv-content-area" style="flex: 1; overflow-y: auto; padding-bottom: 2rem;">
                <div class="status-message">
                    <div class="loader" style="margin: 0 auto 1rem auto;"></div>
                    Caricamento mappa file...
                </div>
            </div>
        </div>
    `;

    const area = container.querySelector('#actv-content-area');
    const btnBack = container.querySelector('#btn-back-actv');
    const title = container.querySelector('#actv-view-title');

    let mappaAlbero = [];

    // --- LOGICA DI DOWNLOAD FORZATO ---
    async function downloadForzato(e, url, filename) {
        e.stopPropagation(); 
        e.preventDefault();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");
            const blob = await response.blob();
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob; 
            a.download = filename;
            document.body.appendChild(a); 
            a.click();
            window.URL.revokeObjectURL(urlBlob);
        } catch (error) { 
            window.open(url, '_blank'); 
        }
    }

    // --- FORMATTAZIONE NOMI ---
    function formattaNomePdf(nomeOrig) {
        let isCompleto = nomeOrig.includes("completo");
        let nomeVis = nomeOrig.replace(/\.pdf$/i, "").replace(/_/g, " ");
        
        if (isCompleto) {
            nomeVis = "PDF Orari Completo";
        } else {
            nomeVis = nomeVis.split(/\s+dal\s+/i)[0];
            nomeVis = nomeVis.replace(/actv nav/i, "Orari").replace(/(\d+)b\b/gi, "$1/").trim();
            nomeVis = nomeVis.charAt(0).toUpperCase() + nomeVis.slice(1);
        }
        return { nomeVis, isCompleto };
    }

    // --- CREAZIONE ELEMENTI UI ---
    function creaRigaLink(testo, iconaMaterial, coloreIcona, link) {
        const row = document.createElement('a');
        row.className = "actv-row clickable";
        row.href = link;
        row.target = "_blank";
        row.innerHTML = `
            <div class="actv-row-left">
                <span class="material-symbols-outlined" style="color: ${coloreIcona}; font-size: 24px;">${iconaMaterial}</span>
                <span class="actv-row-name">${testo}</span>
            </div>
            <span class="material-symbols-outlined" style="color: var(--text-secondary); font-size: 18px;">open_in_new</span>
        `;
        return row;
    }

    function creaRigaCartella(nomeCartella) {
        const row = document.createElement('div');
        row.className = "actv-row clickable";
        
        let label = nomeCartella.replace("orari_", "").split("_").join("/");
        
        row.innerHTML = `
            <div class="actv-row-left">
                <span class="material-symbols-outlined icon-folder" style="font-size: 24px;">folder</span>
                <span class="actv-row-name">Orari dal ${label}</span>
            </div>
            <span class="material-symbols-outlined" style="color: var(--text-secondary); font-size: 20px;">chevron_right</span>
        `;
        row.addEventListener('click', () => apriCartella(nomeCartella, label));
        return row;
    }

    function creaRigaPdf(pathIntero, nomeFile) {
        // Wrapper flessibile per affiancare i due tasti
        const wrapper = document.createElement('div');
        wrapper.className = "actv-pdf-wrapper";

        const { nomeVis, isCompleto } = formattaNomePdf(nomeFile);
        const iconColorClass = isCompleto ? "icon-pdf-completo" : "icon-pdf";
        const iconName = isCompleto ? "picture_as_pdf" : "schedule";

        // Tasto a pillola (<a>) + Tasto tondo (<button>)
        wrapper.innerHTML = `
            <a href="${pathIntero}" target="_blank" class="actv-row clickable" style="margin-bottom: 0;">
                <div class="actv-row-left">
                    <span class="material-symbols-outlined ${iconColorClass}" style="font-size: 24px;">${iconName}</span>
                    <span class="actv-row-name">${nomeVis}</span>
                </div>
            </a>
            <button class="actv-circle-down" title="Scarica PDF">
                <span class="material-symbols-outlined" style="font-size: 24px;">download</span>
            </button>
        `;

        wrapper.querySelector('.actv-circle-down').addEventListener('click', (e) => downloadForzato(e, pathIntero, nomeFile));
        
        return wrapper;
    }

    // --- VISTE DEL MODULO ---
    function renderizzaRoot() {
        area.innerHTML = "";
        btnBack.classList.add('hidden');
        title.innerHTML = `<span class="material-symbols-outlined">directions_bus</span> Orari Actv`;

        // Aggiunge il pulsante "Tempo Reale" in cima alla Root
        area.appendChild(creaRigaLink("Orari in tempo reale", "satellite_alt", "#10b981", "https://oraritemporeale.actv.it/nav/stops/"));

        const rootPdfs = mappaAlbero.filter(p => p.startsWith("orari_actv/") && p.split('/').length === 2 && p.toLowerCase().endsWith(".pdf"));
        const cartelle = [...new Set(mappaAlbero.filter(p => p.startsWith("orari_actv/") && p.split('/').length > 2).map(p => p.split('/')[1]))];

        // Se c'è 1 sola cartella e 0 PDF esterni, apre direttamente la cartella
        if (cartelle.length === 1 && rootPdfs.length === 0) {
            let label = cartelle[0].replace("orari_", "").split("_").join("/");
            apriCartella(cartelle[0], label, false); 
            return;
        }

        if (rootPdfs.length === 0 && cartelle.length === 0) {
            area.innerHTML += `<div class='status-message'><span class="material-symbols-outlined" style="font-size:32px;">folder_off</span><br>Nessun orario trovato nella repository.</div>`;
            return;
        }

        // Renderizza PDF Standalone
        rootPdfs.sort().forEach(p => {
            const nomeOrig = p.split('/')[1];
            area.appendChild(creaRigaPdf(p, nomeOrig));
        });

        // Renderizza Cartelle (dalla più recente alla più vecchia)
        cartelle.sort((a,b) => b.localeCompare(a)); 
        cartelle.forEach(nomeDir => {
            area.appendChild(creaRigaCartella(nomeDir));
        });
    }

    function apriCartella(nomeDir, label, mostraBack = true) {
        area.innerHTML = "";
        title.innerHTML = `<span class="material-symbols-outlined icon-folder">folder_open</span> Dal ${label}`;
        
        if (mostraBack) {
            btnBack.classList.remove('hidden');
            btnBack.onclick = renderizzaRoot;
        }

        // Aggiunge il pulsante "Tempo Reale" in cima anche all'interno della cartella
        area.appendChild(creaRigaLink("Orari in tempo reale", "satellite_alt", "#10b981", "https://oraritemporeale.actv.it/nav/stops/"));

        const pdfsNellaCartella = mappaAlbero.filter(p => p.startsWith(`orari_actv/${nomeDir}/`) && p.toLowerCase().endsWith(".pdf"));

        if (pdfsNellaCartella.length === 0) {
            area.innerHTML += `<div class='status-message'>Nessun PDF in questa cartella.</div>`;
            return;
        }

        // Ordina i PDF: file "completo" prima, poi in ordine alfabetico/numerico
        pdfsNellaCartella.sort((a, b) => {
            if (a.includes("completo")) return -1;
            return a.localeCompare(b, undefined, {numeric: true});
        });

        pdfsNellaCartella.forEach(p => {
            const nomeOrig = p.split('/').pop();
            area.appendChild(creaRigaPdf(p, nomeOrig));
        });
    }

    // --- INIT MOTORE ---
    async function caricaMappa() {
        try {
            const res = await fetch('mappa_file.json?t=' + new Date().getTime());
            if (!res.ok) throw new Error("Mappa non trovata");
            
            const datiMappa = await res.json();
            mappaAlbero = datiMappa.albero || [];
            
            renderizzaRoot();

        } catch (e) {
            area.innerHTML = `
                <div class='status-message' style="color: #ef4444;">
                    <span class="material-symbols-outlined" style="font-size:32px; margin-bottom: 10px;">error</span><br>
                    Errore: impossibile caricare la mappa dei file. Usa il Pannello Admin per forzare la sincronizzazione.
                </div>
            `;
        }
    }

    caricaMappa();
}
