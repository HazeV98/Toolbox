import { app, auth } from '../firebase-init.js';
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const db = getFirestore(app);

// --- STATO GLOBALE DEL MODULO ---
let containerEl = null;
let currentDate = new Date();
let entries = [];
let savedMeds = [];
let isModuleInitialized = false; 

export async function init(container) {
    containerEl = container;
    
    if (!auth.currentUser) {
        containerEl.innerHTML = `<div style="text-align:center; padding: 2rem;">Devi effettuare l'accesso per usare il calendario.</div>`;
        return;
    }

    injectStyles();
    buildMainUI();
    
    if (!isModuleInitialized) {
        buildModalsToBody();
        bindModalEvents();
        isModuleInitialized = true;
    }
    
    bindCalendarEvents(); 
    initDataListeners();
}

// --- CALCOLO SANTI E FESTIVITA' ---
const santiDic = [
    ["Maria SS. Madre di Dio", "S. Basilio", "S. Genoveffa", "S. Ermete", "S. Amelia", "Epifania", "S. Luciano", "S. Massimo", "S. Giuliano", "S. Aldo", "S. Igino", "S. Modesto", "S. Ilario", "S. Felice", "S. Mauro", "S. Marcello", "S. Antonio abate", "S. Margherita", "S. Mario", "S. Sebastiano", "S. Agnese", "S. Vincenzo", "S. Emerenziana", "S. Francesco di Sales", "Conversione di S. Paolo", "S. Tito", "S. Angela Merici", "S. Tommaso d'Aquino", "S. Costanzo", "S. Martina", "S. Giovanni Bosco"],
    ["S. Verdiana", "Presentazione", "S. Biagio", "S. Gilberto", "S. Agata", "S. Paolo Miki", "S. Teodoro", "S. Girolamo Emiliani", "S. Apollonia", "S. Scolastica", "S. Dante", "S. Eulalia", "S. Maura", "S. Valentino", "S. Faustino", "S. Giuliana", "S. Donato", "S. Simone", "S. Mansueto", "S. Silvano", "S. Pier Damiani", "S. Margherita", "S. Renzo", "S. Edilberto", "S. Cesario", "S. Romeo", "S. Leandro", "S. Romano", "S. Giusto"],
    ["S. Albino", "S. Basileo", "S. Cunegonda", "S. Casimiro", "S. Adriano", "S. Giordano", "S. Perpetua", "S. Giovanni di Dio", "S. Francesca Romana", "S. Simplicio", "S. Costantino", "S. Massimiliano", "S. Arrigo", "S. Matilde", "S. Luisa", "S. Ilario", "S. Patrizio", "S. Cirillo", "S. Giuseppe", "S. Alessandra", "S. Benedetto", "S. Lea", "S. Turibio", "S. Romolo", "Annunciazione", "S. Emanuele", "S. Augusto", "S. Sisto III", "S. Secondo", "S. Amedeo", "S. Beniamino"],
    ["S. Ugo", "S. Francesco di Paola", "S. Riccardo", "S. Isidoro", "S. Vincenzo Ferrer", "S. Guglielmo", "S. Ermanno", "S. Alberto", "S. Maria Cleofe", "S. Terenzio", "S. Stanislao", "S. Giulio", "S. Martino", "S. Abbondio", "S. Annibale", "S. Lamberto", "S. Roberto", "S. Galdino", "S. Ermogene", "S. Adalgisa", "S. Anselmo", "S. Caio", "S. Giorgio", "S. Fedele", "S. Marco evangelista", "S. Marcellino", "S. Zita", "S. Valeria", "S. Caterina da Siena", "S. Pio V"],
    ["S. Giuseppe artigiano", "S. Cesare", "S. Filippo", "S. Silvano", "S. Pellegrino", "S. Giuditta", "S. Flavia", "S. Desiderato", "S. Pacomio", "S. Antonino", "S. Fabio", "S. Rossana", "S. Emma", "S. Mattia", "S. Torquato", "S. Ubaldo", "S. Pasquale", "S. Giovanni I", "S. Pietro di Morrone", "S. Bernardino", "S. Vittorio", "S. Rita da Cascia", "S. Desiderio", "Maria Ausiliatrice", "S. Beda", "S. Filippo Neri", "S. Agostino", "S. Emilio", "S. Massimino", "S. Ferdinando", "Visitazione di Maria"],
    ["S. Giustino", "S. Marcellino", "S. Carlo Lwanga", "S. Quirino", "S. Bonifacio", "S. Norberto", "S. Roberto", "S. Medardo", "S. Efrem", "S. Diana", "S. Barnaba", "S. Guido", "S. Antonio da Padova", "S. Eliseo", "S. Vito", "S. Aureliano", "S. Gregorio", "S. Marina", "S. Gervasio", "S. Silverio", "S. Luigi Gonzaga", "S. Paolino", "S. Lanfranco", "Natività S. Giovanni", "S. Guglielmo", "S. Vigilio", "S. Cirillo", "S. Ireneo", "SS. Pietro e Paolo", "Primi Martiri"],
    ["S. Teobaldo", "S. Ottone", "S. Tommaso apostolo", "S. Elisabetta", "S. Antonio M. Zaccaria", "S. Maria Goretti", "S. Edda", "S. Adriano", "S. Letizia", "S. Silvana", "S. Benedetto", "S. Fortunato", "S. Enrico", "S. Camillo", "S. Bonaventura", "Beata Vergine del Carmelo", "S. Alessio", "S. Federico", "S. Simmaco", "S. Margherita", "S. Lorenzo da Brindisi", "S. Maria Maddalena", "S. Brigida", "S. Cristina", "S. Giacomo apostolo", "S. Anna", "S. Liliana", "S. Nazario", "S. Marta", "S. Pietro Crisologo", "S. Ignazio di Loyola"],
    ["S. Alfonso", "S. Eusebio", "S. Lidia", "S. Nicodemo", "S. Osvaldo", "Trasfigurazione", "S. Gaetano", "S. Domenico", "S. Romano", "S. Lorenzo", "S. Chiara", "S. Ercolano", "S. Ippolito", "S. Alfredo", "Assunzione di Maria", "S. Rocco", "S. Giacinto", "S. Elena", "S. Giovanni Eudes", "S. Bernardo", "S. Pio X", "B.V. Maria Regina", "S. Rosa da Lima", "S. Bartolomeo", "S. Ludovico", "S. Alessandro", "S. Monica", "S. Agostino", "Martirio S. Giovanni B.", "S. Faustina", "S. Aristide"],
    ["S. Egidio", "S. Elpidio", "S. Gregorio", "S. Rosalia", "S. Teresa di Calcutta", "S. Umberto", "S. Regina", "Natività B.V. Maria", "S. Sergio", "S. Nicola da Tolentino", "S. Diomede", "Nome di Maria", "S. Maurilio", "Esaltazione della Croce", "B.V. Maria Addolorata", "S. Cornelio", "S. Roberto", "S. Sofia", "S. Gennaro", "S. Eustachio", "S. Matteo", "S. Maurizio", "S. Lino", "S. Pacifico", "S. Aurelia", "S. Cosimo", "S. Vincenzo", "S. Venceslao", "S. Michele", "S. Girolamo"],
    ["S. Teresa di G.B.", "Angeli Custodi", "S. Gerardo", "S. Francesco d'Assisi", "S. Placido", "S. Bruno", "B.V. Maria del Rosario", "S. Pelagia", "S. Dionigi", "S. Daniele", "S. Firmino", "S. Serafino", "S. Edoardo", "S. Callisto", "S. Teresa d'Avila", "S. Edvige", "S. Ignazio d'Antiochia", "S. Luca evangelista", "S. Isacco", "S. Irene", "S. Orsola", "S. Donato", "S. Giovanni da Capestrano", "S. Antonio M. Claret", "S. Crispino", "S. Evaristo", "S. Fiorenzo", "S. Simone", "S. Ermelinda", "S. Germano", "S. Lucilla"],
    ["Tutti i Santi", "Comm. Fedeli Defunti", "S. Silvia", "S. Carlo Borromeo", "S. Zaccaria", "S. Leonardo", "S. Ernesto", "S. Goffredo", "S. Oreste", "S. Leone Magno", "S. Martino di Tours", "S. Renato", "S. Diego", "S. Giocondo", "S. Alberto Magno", "S. Margherita", "S. Elisabetta", "S. Oddone", "S. Fausto", "S. Benigno", "Presentazione B.V. Maria", "S. Cecilia", "S. Clemente", "S. Flora", "S. Caterina d'Alessandria", "S. Corrado", "S. Virgilio", "S. Giacomo", "S. Saturnino", "S. Andrea apostolo"],
    ["S. Eligio", "S. Bibiana", "S. Francesco Saverio", "S. Barbara", "S. Giulio", "S. Nicola di Bari", "S. Ambrogio", "Immacolata Concezione", "S. Siro", "B.V. Maria di Loreto", "S. Damaso", "S. Giovanna", "S. Lucia", "S. Giovanni della Croce", "S. Valeriano", "S. Adelaide", "S. Lazzaro", "S. Graziano", "S. Fausta", "S. Liberato", "S. Pietro Canisio", "S. Francesca Cabrini", "S. Giovanni da Kety", "S. Adele", "Natale del Signore", "S. Stefano", "S. Giovanni apostolo", "SS. Innocenti", "S. Tommaso Becket", "S. Eugenio", "S. Silvestro"]
];

const festeFisse = {
    "01-01": "Capodanno", "06-01": "Epifania", "25-04": "Festa della Liberazione", "01-05": "Festa dei Lavoratori", 
    "02-06": "Festa della Repubblica", "15-08": "Ferragosto", "01-11": "Tutti i Santi", "08-12": "Immacolata Concezione", 
    "25-12": "Natale", "26-12": "Santo Stefano"
};

function getPasqua(anno) {
    const C = Math.floor(anno/100);
    const N = anno - 19*Math.floor(anno/19);
    const K = Math.floor((C - 17)/25);
    let I = C - Math.floor(C/4) - Math.floor((C - K)/3) + 19*N + 15;
    I = I - 30*Math.floor((I/30));
    I = I - Math.floor(I/28)*(1 - Math.floor(I/28)*Math.floor(29/(I + 1))*Math.floor((21 - N)/11));
    let J = anno + Math.floor(anno/4) + I + 2 - C + Math.floor(C/4);
    J = J - 7*Math.floor(J/7);
    const L = I - J;
    const M = 3 + Math.floor((L + 40)/44);
    const D = L + 28 - 31*Math.floor(M/4);
    return { mese: M, giorno: D };
}

function getDayInfo(d, m, y) {
    const dateKey = `${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}`;
    let festa = festeFisse[dateKey] || null;
    
    const pasqua = getPasqua(y);
    if (d === pasqua.giorno && m === pasqua.mese) festa = "Pasqua";
    else {
        let pData = new Date(y, pasqua.mese - 1, pasqua.giorno + 1); 
        if (d === pData.getDate() && m === pData.getMonth() + 1) festa = "Pasquetta (Lunedì dell'Angelo)";
    }
    
    let santo = "Santo del giorno";
    if (santiDic[m - 1] && santiDic[m - 1][d - 1]) santo = santiDic[m - 1][d - 1];
    
    return { festa, santo };
}


// --- CSS SPECIFICO DEL MODULO ---
function injectStyles() {
    if (document.getElementById('migraine-styles')) return;
    const style = document.createElement('style');
    style.id = 'migraine-styles';
    style.innerHTML = `
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .cal-nav { display: flex; align-items: center; gap: 1rem; }
        .cal-nav button { background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-day-header { text-align: center; font-size: 0.8rem; font-weight: bold; color: var(--text-secondary); padding-bottom: 0.5rem; }
        .cal-cell { min-height: 80px; background: rgba(150,150,150,0.05); border-radius: 8px; padding: 4px; display: flex; flex-direction: column; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; position:relative;}
        .cal-cell:hover { border-color: var(--accent-color); }
        .cal-cell.today { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }
        .cal-cell.other-month { opacity: 0.4; }
        .cal-date { font-size: 0.85rem; font-weight: bold; margin-bottom: 4px; text-align: right; pointer-events: none; }
        
        .cal-dots-container { display: flex; justify-content: flex-end; gap: 3px; margin-top: auto; padding: 2px; flex-wrap: wrap; pointer-events: none;}
        .cal-dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot-red { background-color: #ef4444; }
        
        .episode-row { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--border-soft); background: rgba(150,150,150,0.03); border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid #ef4444;}
        
        /* Form fields */
        .migraine-form-group { margin-bottom: 0.8rem; }
        .migraine-form-group label { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.2rem; }
        .migraine-input { width: 100%; padding: 0.5rem; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--surface-light); color: var(--text-primary); }
        textarea.migraine-input { resize: vertical; min-height: 60px; }
        
        /* Accordions and Chips */
        .migraine-accordion { background: rgba(150,150,150,0.02); border: 1px solid var(--border-soft); border-radius: 8px; margin-bottom: 0.5rem; }
        .migraine-accordion-header { padding: 0.8rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold; font-size: 0.9rem; }
        .migraine-accordion-header .chevron { transition: transform 0.3s; color: var(--text-secondary); }
        .migraine-accordion.open .chevron { transform: rotate(-180deg); }
        .migraine-accordion-content { display: none; padding: 0 0.8rem 0.8rem 0.8rem; flex-direction: column; gap: 0.8rem; }
        .migraine-accordion.open .migraine-accordion-content { display: flex; }
        
        .chip-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .selectable-chip { background: var(--surface-light); border: 1px solid var(--border-soft); border-radius: 16px; padding: 5px 12px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; user-select: none; }
        .selectable-chip.selected { background: #ef4444; color: white; border-color: #ef4444; }
        .selectable-chip.med-chip { background: rgba(150,150,150,0.1); }
        
        .med-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(150,150,150,0.05); border-radius: 6px; }
    `;
    document.head.appendChild(style);
}

// --- STRUTTURA HTML CALENDARIO ---
function buildMainUI() {
    containerEl.innerHTML = `
        <div class="module-wrapper">
            <div class="cal-header">
                <div class="cal-nav">
                    <button id="cal-prev"><span class="material-symbols-outlined">chevron_left</span></button>
                    <h2 id="cal-month-year" style="margin:0; font-size:1.2rem;">...</h2>
                    <button id="cal-next"><span class="material-symbols-outlined">chevron_right</span></button>
                </div>
                <div style="display:flex; gap:0.2rem;">
                    <button id="cal-menu-btn" class="icon-btn">
                        <span class="material-symbols-outlined">more_vert</span>
                    </button>
                </div>
            </div>

            <div class="cal-grid" id="cal-days-header">
                <div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div><div class="cal-day-header">Mer</div>
                <div class="cal-day-header">Gio</div><div class="cal-day-header">Ven</div><div class="cal-day-header">Sab</div><div class="cal-day-header">Dom</div>
            </div>
            
            <div class="cal-grid" id="cal-grid-body"></div>
        </div>
    `;
}

// --- COSTRUZIONE MODALI A LIVELLO DEL BODY ---
function buildModalsToBody() {
    const wrapper = document.createElement('div');
    wrapper.id = 'migraine-modals-wrapper';
    
    wrapper.innerHTML = `
        <!-- MENU MODALE -->
        <div id="cal-menu-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Opzioni Diario</h2>
                    <button id="btn-close-menu" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="settings-section">
                    <button id="btn-open-meds" class="btn secondary outline" style="width:100%; margin-bottom:0.5rem;">
                        <span class="material-symbols-outlined" style="vertical-align:middle; margin-right:5px;">vaccines</span> Gestisci Farmaci
                    </button>
                    <button id="btn-open-stats" class="btn secondary outline" style="width:100%; margin-bottom:0.5rem;">
                        <span class="material-symbols-outlined" style="vertical-align:middle; margin-right:5px;">bar_chart</span> Statistiche
                    </button>
                    <button id="btn-open-export" class="btn secondary outline" style="width:100%; margin-bottom:1rem; border-color:var(--accent-color); color:var(--accent-color);">
                        <span class="material-symbols-outlined" style="vertical-align:middle; margin-right:5px;">picture_as_pdf</span> Esporta Diario PDF
                    </button>
                </div>
            </div>
        </div>

        <!-- MODALE STATISTICHE -->
        <div id="cal-stats-modal" class="modal-overlay hidden" style="z-index: 2050;">
            <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>Statistiche</h2>
                    <button id="btn-close-stats" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="font-size:0.8rem; display:block; margin-bottom:0.3rem;">Seleziona Periodo:</label>
                    <select id="stats-period-type" class="migraine-input" style="margin-bottom: 0.5rem;">
                        <option value="month">Mese specifico</option>
                        <option value="year">Anno specifico</option>
                        <option value="custom">Periodo personalizzato</option>
                    </select>
                    
                    <div id="stats-inputs-month" class="stats-input-group">
                        <input type="month" id="stats-month" class="migraine-input">
                    </div>
                    <div id="stats-inputs-year" class="stats-input-group" style="display:none;">
                        <input type="number" id="stats-year" placeholder="Es. 2026" class="migraine-input" min="2000" max="2100">
                    </div>
                    <div id="stats-inputs-custom" class="stats-input-group" style="display:none; gap:0.5rem;">
                        <input type="date" id="stats-date-from" class="migraine-input" style="flex:1;">
                        <input type="date" id="stats-date-to" class="migraine-input" style="flex:1;">
                    </div>
                    
                    <button id="btn-calc-stats" class="btn primary" style="width:100%; margin-top: 0.8rem;">Calcola Statistiche</button>
                </div>
                <div id="stats-results" style="display:flex; flex-direction:column; gap:1rem;">
                    <!-- Risultati generati qui -->
                </div>
            </div>
        </div>

        <!-- MODALE GESTIONE FARMACI -->
        <div id="cal-meds-modal" class="modal-overlay hidden" style="z-index: 2100;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Farmaci Salvati</h2>
                    <button id="btn-close-meds" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div style="display:flex; gap:0.5rem; margin-bottom: 1rem;">
                    <input type="text" id="new-med-name" placeholder="Nome farmaco" class="migraine-input" style="flex:2; margin:0;">
                    <input type="text" id="new-med-dose" placeholder="Dosaggio" class="migraine-input" style="flex:1; margin:0;">
                    <button id="btn-add-med" class="btn primary" style="padding:0 1rem;"><span class="material-symbols-outlined">add</span></button>
                </div>
                <div id="meds-list" style="display:flex; flex-direction:column; gap:0.5rem; max-height:40vh; overflow-y:auto;">
                    <!-- Lista farmaci caricata da Firebase -->
                </div>
            </div>
        </div>

        <!-- MODALE ESPORTA PDF -->
        <div id="cal-export-modal" class="modal-overlay hidden" style="z-index: 2050;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Esporta in PDF</h2>
                    <button id="btn-close-export" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <p style="font-size:0.85rem; margin-bottom:1rem; color:var(--text-secondary);">Seleziona il periodo da esportare. Verrà generato un elenco dettagliato di tutti gli episodi registrati.</p>
                
                <div style="display:flex; gap:0.5rem; margin-bottom: 1rem;">
                    <div style="flex:1;">
                        <label style="font-size:0.8rem;">Da Mese</label>
                        <input type="month" id="export-month-from" class="input-select" style="width:100%;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.8rem;">A Mese</label>
                        <input type="month" id="export-month-to" class="input-select" style="width:100%;">
                    </div>
                </div>
                
                <button id="btn-do-export" class="btn primary" style="width:100%;">Genera e Scarica PDF</button>
            </div>
        </div>

        <!-- MODALE DETTAGLI DEL GIORNO -->
        <div id="cal-day-details-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header" style="align-items:flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <h2 id="day-details-title" style="margin-bottom: 0.2rem;">Episodi</h2>
                        <div id="day-details-subtitle" style="font-size:0.85rem; color:var(--text-secondary); line-height:1.2;"></div>
                    </div>
                    <div style="display:flex; gap: 0.5rem;">
                        <button id="btn-add-from-day" class="icon-btn" style="color:var(--accent-color); border-color:var(--accent-color);"><span class="material-symbols-outlined">add</span></button>
                        <button id="btn-close-day-details" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                    </div>
                </div>
                <div id="day-details-list" style="display:flex; flex-direction:column; gap:0.5rem; max-height: 60vh; overflow-y: auto;">
                    <!-- Gli eventi verranno caricati qui -->
                </div>
            </div>
        </div>

        <!-- MODALE AGGIUNGI / MODIFICA EPISODIO -->
        <div id="cal-add-modal" class="modal-overlay hidden" style="z-index: 2200;">
            <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 id="add-modal-title">Registra Episodio</h2>
                    <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                
                <input type="hidden" id="add-date">
                <input type="hidden" id="edit-entry-id">

                <div style="display:flex; gap:0.5rem; margin-bottom: 1rem;">
                    <div class="migraine-form-group" style="flex:1; margin-bottom:0;">
                        <label>Ora Inizio</label>
                        <input type="time" id="add-start" class="migraine-input">
                    </div>
                    <div class="migraine-form-group" style="flex:1; margin-bottom:0;">
                        <label>Ora Fine</label>
                        <input type="time" id="add-end" class="migraine-input">
                    </div>
                </div>

                <!-- Intensità -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Intensità (1-10)</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <input type="range" id="add-intensity" min="1" max="10" value="5" class="migraine-input" style="padding:0;">
                        <div style="text-align:center; font-weight:bold;">Valore: <span id="intensity-val">5</span></div>
                    </div>
                </div>

                <!-- Localizzazione -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Localizzazione e Tipo Dolore</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <div class="chip-group" id="chips-location">
                            <div class="selectable-chip">Tempia Dx</div>
                            <div class="selectable-chip">Tempia Sx</div>
                            <div class="selectable-chip">Fronte</div>
                            <div class="selectable-chip">Nuca</div>
                            <div class="selectable-chip">Occhi</div>
                            <div class="selectable-chip">Diffuso</div>
                            <div class="selectable-chip">Pulsante</div>
                            <div class="selectable-chip">Oppressivo</div>
                            <div class="selectable-chip">Trafiggente</div>
                        </div>
                        <input type="text" id="add-location-other" placeholder="Altra localizzazione o tipo..." class="migraine-input">
                    </div>
                </div>

                <!-- Sintomi e Preavviso -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Sintomi e Preavviso</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <div class="chip-group" id="chips-symptoms">
                            <div class="selectable-chip">Nausea</div>
                            <div class="selectable-chip">Vomito</div>
                            <div class="selectable-chip">Fotofobia (Luce)</div>
                            <div class="selectable-chip">Fonofobia (Suoni)</div>
                            <div class="selectable-chip">Osmofobia (Odori)</div>
                            <div class="selectable-chip">Aura visiva</div>
                            <div class="selectable-chip">Stanchezza</div>
                            <div class="selectable-chip">Sbadigli frequenti</div>
                            <div class="selectable-chip">Formicolio</div>
                            <div class="selectable-chip">Difficoltà concentrazione</div>
                        </div>
                        <input type="text" id="add-symptoms-other" placeholder="Altri sintomi..." class="migraine-input">
                    </div>
                </div>

                <!-- Fattori Scatenanti -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Fattori Scatenanti (Trigger)</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <div class="chip-group" id="chips-triggers">
                            <div class="selectable-chip">Stress</div>
                            <div class="selectable-chip">Poco sonno</div>
                            <div class="selectable-chip">Troppo sonno</div>
                            <div class="selectable-chip">Sbalzo termico/Meteo</div>
                            <div class="selectable-chip">Ciclo mestruale</div>
                            <div class="selectable-chip">Alcol</div>
                            <div class="selectable-chip">Caffeina (eccesso/astinenza)</div>
                            <div class="selectable-chip">Digiuno</div>
                            <div class="selectable-chip">Sforzo fisico</div>
                        </div>
                        <input type="text" id="add-triggers-other" placeholder="Altri fattori scatenanti..." class="migraine-input">
                    </div>
                </div>

                <!-- Farmaci -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Farmaci Assunti ed Efficacia</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <div class="chip-group" id="quick-meds-container">
                            <!-- Farmaci dinamici -->
                        </div>
                        <input type="text" id="add-meds-other" placeholder="Es. Dolore passato dopo 2h..." class="migraine-input">
                        <div style="margin-top: 0.5rem;">
                            <label style="display:block; font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.2rem;">Efficacia del medicinale (1-10)</label>
                            <input type="range" id="add-med-efficacy" min="1" max="10" value="5" class="migraine-input" style="padding:0;">
                            <div style="text-align:center; font-weight:bold;">Valore: <span id="efficacy-val">5</span></div>
                        </div>
                    </div>
                </div>

                <!-- Note -->
                <div class="migraine-accordion">
                    <div class="migraine-accordion-header">
                        <span>Note Aggiuntive</span>
                        <span class="material-symbols-outlined chevron">expand_more</span>
                    </div>
                    <div class="migraine-accordion-content">
                        <textarea id="add-notes" placeholder="Impatto sulle attività, annotazioni libere..." class="migraine-input"></textarea>
                    </div>
                </div>

                <button id="btn-save-entry" class="btn primary" style="width:100%; margin-top:1rem;">Salva Episodio</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(wrapper);
}


// --- LOGICA E DATABASE ---
function initDataListeners() {
    const uid = auth.currentUser.uid;
    
    // Ascolta la collezione migraine, filtrata per utente
    const q = query(collection(db, 'migraine'), where('ownerUid', '==', uid));
    onSnapshot(q, (snap) => {
        entries = [];
        snap.forEach(d => {
            entries.push({id: d.id, ...d.data()});
        });
        
        const addDateInput = document.getElementById('add-date');
        if (addDateInput) {
            const dateStr = addDateInput.value;
            const detailsModal = document.getElementById('cal-day-details-modal');
            if (detailsModal && !detailsModal.classList.contains('hidden') && dateStr) {
                openDayDetails(dateStr);
            }
        }
        
        renderCalendar();
    });

    // Ascolta la collezione farmaci
    const qMeds = query(collection(db, 'migraine_meds'), where('ownerUid', '==', uid));
    onSnapshot(qMeds, (snap) => {
        savedMeds = [];
        snap.forEach(d => {
            savedMeds.push({id: d.id, ...d.data()});
        });
        renderMedsList();
        renderQuickMeds();
    });
}

// --- FUNZIONI UTILI PER LETTURA/SCRITTURA DELLE CATEGORIE CON CHIP ---
function getCategoryData(containerId, otherInputId) {
    let selected = [];
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('.selectable-chip.selected').forEach(c => {
            selected.push(c.innerText);
        });
    }
    if (otherInputId) {
        const other = document.getElementById(otherInputId);
        if (other && other.value.trim() !== '') {
            selected.push(other.value.trim());
        }
    }
    return selected.join(', ');
}

function setCategoryData(containerId, otherInputId, fullString) {
    const container = document.getElementById(containerId);
    const otherInput = document.getElementById(otherInputId);
    
    if (container) {
        container.querySelectorAll('.selectable-chip').forEach(c => c.classList.remove('selected'));
    }
    if (otherInput) otherInput.value = '';
    
    if (!fullString) return;
    
    let parts = fullString.split(',').map(s => s.trim());
    let leftovers = [];
    
    parts.forEach(part => {
        let found = false;
        if (container) {
            container.querySelectorAll('.selectable-chip').forEach(chip => {
                if (chip.innerText === part) {
                    chip.classList.add('selected');
                    found = true;
                }
            });
        }
        if (!found && part !== '') leftovers.push(part);
    });
    
    if (otherInput && leftovers.length > 0) {
        otherInput.value = leftovers.join(', ');
    }
}


// --- RENDERING CALENDARIO CON PUNTINI ---
function renderCalendar() {
    const mYearLabel = document.getElementById('cal-month-year');
    if (!mYearLabel) return; 

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    mYearLabel.innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let startOffset = firstDay === 0 ? 6 : firstDay - 1; 
    
    const grid = document.getElementById('cal-grid-body');
    grid.innerHTML = '';
    
    const today = new Date();

    for (let i = 0; i < startOffset; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell other-month';
        grid.appendChild(cell);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }
        
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        cell.dataset.date = dateStr;
        
        const dayInfo = getDayInfo(i, month + 1, year);
        let holiMarker = dayInfo.festa ? `<span style="color:#ef4444; font-size:1.2rem; line-height:0.5; vertical-align: middle;">•</span>` : '';

        const dayEntries = entries.filter(e => e.date === dateStr);
        let dotsHtml = '<div class="cal-dots-container">';
        if (dayEntries.length > 0) {
            dotsHtml += '<div class="cal-dot dot-red"></div>';
        }
        dotsHtml += '</div>';

        cell.innerHTML = `<div class="cal-date">${holiMarker} ${i}</div> ${dotsHtml}`;
        cell.addEventListener('click', () => openDayDetails(dateStr));
        grid.appendChild(cell);
    }
}


function openDayDetails(dateStr) {
    document.getElementById('add-date').value = dateStr;
    const [y, m, d] = dateStr.split('-');
    
    document.getElementById('day-details-title').innerText = `${d}/${m}/${y}`;
    
    const dayInfo = getDayInfo(parseInt(d), parseInt(m), parseInt(y));
    let subtitleHtml = dayInfo.santo;
    if (dayInfo.festa) subtitleHtml += ` <br><span style="color:#ef4444; font-weight:bold;">${dayInfo.festa}</span>`;
    document.getElementById('day-details-subtitle').innerHTML = subtitleHtml;
    
    const cont = document.getElementById('day-details-list');
    cont.innerHTML = '';
    
    const dayEntries = entries.filter(e => e.date === dateStr);
    
    dayEntries.sort((a,b) => {
        if (!a.startTime) return -1;
        if (!b.startTime) return 1;
        return a.startTime.localeCompare(b.startTime);
    });
    
    if (dayEntries.length === 0) {
        cont.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:1rem;">Nessun episodio registrato.</p>';
    } else {
        dayEntries.forEach(entry => {
            const div = document.createElement('div');
            div.className = `episode-row`;
            
            let timeText = entry.startTime ? `${entry.startTime}` : 'Ora non specificata';
            if (entry.endTime) timeText += ` - ${entry.endTime}`;
            
            let summaryStr = [];
            if (entry.intensity) summaryStr.push(`Intensità: ${entry.intensity}`);
            if (entry.medEfficacy) summaryStr.push(`Efficacia: ${entry.medEfficacy}`);
            if (entry.location) summaryStr.push(entry.location);
            
            let actionsHtml = `
                <div style="display:flex; gap:0.4rem; align-items:center;">
                    <button class="icon-btn btn-edit-entry" data-id="${entry.id}" style="color:var(--accent-color); width:32px; height:32px; min-width:32px;"><span class="material-symbols-outlined" style="font-size:1.1rem;">edit</span></button>
                    <button class="icon-btn btn-del-entry" data-id="${entry.id}" style="color:#ef4444; width:32px; height:32px; min-width:32px;"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span></button>
                </div>
            `;

            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold; margin-bottom:0.2rem;">${timeText}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">
                        ${summaryStr.length > 0 ? summaryStr.join(' | ') : 'Nessun dettaglio aggiuntivo'}
                    </div>
                </div>
                ${actionsHtml}
            `;
            cont.appendChild(div);
        });

        // EDIT EVENTO
        document.querySelectorAll('.btn-edit-entry').forEach(b => {
            b.addEventListener('click', (e) => {
                const entryId = e.currentTarget.dataset.id;
                const entry = entries.find(x => x.id === entryId);
                if (!entry) return;

                document.getElementById('edit-entry-id').value = entry.id;
                document.getElementById('add-date').value = entry.date;
                
                document.getElementById('add-start').value = entry.startTime || '';
                document.getElementById('add-end').value = entry.endTime || '';
                
                // Popola i campi tramite la funzione di set
                const intInput = document.getElementById('add-intensity');
                intInput.value = entry.intensity || 5;
                document.getElementById('intensity-val').innerText = intInput.value;

                const effInput = document.getElementById('add-med-efficacy');
                effInput.value = entry.medEfficacy || 5;
                document.getElementById('efficacy-val').innerText = effInput.value;

                setCategoryData('chips-location', 'add-location-other', entry.location);
                setCategoryData('chips-symptoms', 'add-symptoms-other', entry.symptoms);
                setCategoryData('chips-triggers', 'add-triggers-other', entry.triggers);
                setCategoryData('quick-meds-container', 'add-meds-other', entry.meds);
                document.getElementById('add-notes').value = entry.notes || '';
                
                // Chiudi tutte le schede per pulizia visiva
                document.querySelectorAll('.migraine-accordion').forEach(acc => acc.classList.remove('open'));

                document.getElementById('add-modal-title').innerText = "Modifica Episodio";
                
                document.getElementById('cal-day-details-modal').classList.add('hidden');
                document.getElementById('cal-add-modal').classList.remove('hidden');
            });
        });

        // ELIMINA EVENTO
        document.querySelectorAll('.btn-del-entry').forEach(b => {
            b.addEventListener('click', async (e) => {
                if(confirm("Sei sicuro di voler eliminare questo episodio?")) {
                    const entryId = e.currentTarget.dataset.id;
                    try { await deleteDoc(doc(db, 'migraine', entryId)); } catch (err) {}
                }
            });
        });
    }
    
    document.getElementById('cal-day-details-modal').classList.remove('hidden');
}


// --- RENDERING FARMACI ---
function renderMedsList() {
    const cont = document.getElementById('meds-list');
    if (!cont) return;
    cont.innerHTML = '';

    if (savedMeds.length === 0) {
        cont.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:1rem; font-size:0.9rem;">Nessun farmaco salvato.</p>';
        return;
    }

    savedMeds.forEach(med => {
        const div = document.createElement('div');
        div.className = 'med-row';
        div.innerHTML = `
            <div>
                <strong>${med.name}</strong> 
                <span style="color:var(--text-secondary); font-size:0.85rem;">${med.dosage ? ' - ' + med.dosage : ''}</span>
            </div>
            <button class="icon-btn btn-del-med" data-id="${med.id}" style="color:#ef4444; width:32px; height:32px; min-width:32px;"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span></button>
        `;
        cont.appendChild(div);
    });

    document.querySelectorAll('.btn-del-med').forEach(b => {
        b.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            try { await deleteDoc(doc(db, 'migraine_meds', id)); } catch(err) {}
        });
    });
}

function renderQuickMeds() {
    const cont = document.getElementById('quick-meds-container');
    if (!cont) return;
    cont.innerHTML = '';
    
    if (savedMeds.length === 0) {
        cont.innerHTML = '<span style="font-size:0.8rem; color:var(--text-secondary);">Nessun farmaco configurato. Aggiungili dalle Opzioni Diario.</span>';
        return;
    }

    savedMeds.forEach(med => {
        const chip = document.createElement('div');
        chip.className = 'selectable-chip med-chip';
        chip.innerText = `${med.name} ${med.dosage ? '('+med.dosage+')' : ''}`;
        cont.appendChild(chip);
    });
    
    // Ripetiamo il binding del click per i chip appena creati dinamicamente
    cont.querySelectorAll('.selectable-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
    });
}


// --- EVENTI CALENDARIO BASE ---
function bindCalendarEvents() {
    document.getElementById('cal-prev').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('cal-next').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('cal-menu-btn').addEventListener('click', () => document.getElementById('cal-menu-modal').classList.remove('hidden'));
}

// --- EVENTI MODALI ---
function bindModalEvents() {
    // Gestione input range per Intensità ed Efficacia
    document.getElementById('add-intensity').addEventListener('input', (e) => {
        document.getElementById('intensity-val').innerText = e.target.value;
    });
    document.getElementById('add-med-efficacy').addEventListener('input', (e) => {
        document.getElementById('efficacy-val').innerText = e.target.value;
    });

    document.getElementById('btn-close-menu').addEventListener('click', () => document.getElementById('cal-menu-modal').classList.add('hidden'));
    document.getElementById('btn-close-add').addEventListener('click', () => document.getElementById('cal-add-modal').classList.add('hidden'));
    document.getElementById('btn-close-day-details').addEventListener('click', () => document.getElementById('cal-day-details-modal').classList.add('hidden'));
    
    // Gestione Accordion e Chip Generici (Statici)
    document.querySelectorAll('.migraine-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });

    document.querySelectorAll('.selectable-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Se è a selezione singola (es. intensità), deseleziona gli altri nel suo gruppo
            if (chip.classList.contains('single-select')) {
                chip.parentElement.querySelectorAll('.single-select').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            } else {
                chip.classList.toggle('selected');
            }
        });
    });

    // GESTIONE FARMACI MODALE
    document.getElementById('btn-open-meds').addEventListener('click', () => {
        document.getElementById('cal-meds-modal').classList.remove('hidden');
        document.getElementById('cal-menu-modal').classList.add('hidden');
    });
    document.getElementById('btn-close-meds').addEventListener('click', () => document.getElementById('cal-meds-modal').classList.add('hidden'));
    
    document.getElementById('btn-add-med').addEventListener('click', async () => {
        const name = document.getElementById('new-med-name').value.trim();
        const dosage = document.getElementById('new-med-dose').value.trim();
        if (!name) return alert("Inserisci il nome del farmaco.");
        
        try {
            await addDoc(collection(db, 'migraine_meds'), {
                name, dosage, ownerUid: auth.currentUser.uid
            });
            document.getElementById('new-med-name').value = '';
            document.getElementById('new-med-dose').value = '';
        } catch (e) {
            console.error(e);
            alert("Errore salvataggio farmaco.");
        }
    });

    // GESTIONE STATISTICHE MODALE
    document.getElementById('btn-open-stats').addEventListener('click', () => {
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const yyyy = currentDate.getFullYear();
        document.getElementById('stats-month').value = `${yyyy}-${mm}`;
        document.getElementById('stats-year').value = yyyy;
        
        document.getElementById('cal-stats-modal').classList.remove('hidden');
        document.getElementById('cal-menu-modal').classList.add('hidden');
        document.getElementById('stats-results').innerHTML = ''; 
    });

    document.getElementById('btn-close-stats').addEventListener('click', () => {
        document.getElementById('cal-stats-modal').classList.add('hidden');
    });

    document.getElementById('stats-period-type').addEventListener('change', (e) => {
        document.getElementById('stats-inputs-month').style.display = 'none';
        document.getElementById('stats-inputs-year').style.display = 'none';
        document.getElementById('stats-inputs-custom').style.display = 'none';
        
        if(e.target.value === 'month') document.getElementById('stats-inputs-month').style.display = 'block';
        if(e.target.value === 'year') document.getElementById('stats-inputs-year').style.display = 'block';
        if(e.target.value === 'custom') document.getElementById('stats-inputs-custom').style.display = 'flex';
    });

    document.getElementById('btn-calc-stats').addEventListener('click', () => {
        const periodType = document.getElementById('stats-period-type').value;
        let filtered = [];

        if (periodType === 'month') {
            const val = document.getElementById('stats-month').value;
            if (!val) return alert("Seleziona un mese.");
            filtered = entries.filter(e => e.date.startsWith(val));
        } else if (periodType === 'year') {
            const val = document.getElementById('stats-year').value;
            if (!val) return alert("Inserisci un anno.");
            filtered = entries.filter(e => e.date.startsWith(val));
        } else if (periodType === 'custom') {
            const from = document.getElementById('stats-date-from').value;
            const to = document.getElementById('stats-date-to').value;
            if (!from || !to) return alert("Seleziona data di inizio e fine.");
            if (from > to) return alert("La data di inizio non può superare la data di fine.");
            filtered = entries.filter(e => e.date >= from && e.date <= to);
        }

        const resContainer = document.getElementById('stats-results');
        if (filtered.length === 0) {
            resContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Nessun episodio in questo periodo.</p>';
            return;
        }

        const total = filtered.length;
        
        let intensityCounts = {};
        let medsTakenCount = 0;
        let locations = {};
        let symptoms = {};
        let triggers = {};

        filtered.forEach(e => {
            if(e.intensity) {
                intensityCounts[e.intensity] = (intensityCounts[e.intensity] || 0) + 1;
            }
            
            if (e.meds && e.meds.trim() !== '') {
                const mList = e.meds.split(',').filter(x => x.trim() !== '');
                medsTakenCount += mList.length;
            }

            const countItems = (str, targetObj) => {
                if (!str) return;
                str.split(',').forEach(item => {
                    let val = item.trim();
                    if(val !== '') targetObj[val] = (targetObj[val] || 0) + 1;
                });
            };

            countItems(e.location, locations);
            countItems(e.symptoms, symptoms);
            countItems(e.triggers, triggers);
        });

        const renderBar = (label, count, maxVal) => {
            const pct = Math.round((count / Math.max(maxVal, 1)) * 100);
            return `
                <div style="margin-bottom: 4px; font-size: 0.85rem; display:flex; justify-content:space-between;">
                    <span>${label}</span>
                    <span>${count} (${pct}%)</span>
                </div>
                <div style="width: 100%; background: var(--border-soft); height: 6px; border-radius: 3px; margin-bottom: 8px;">
                    <div style="width: ${pct}%; background: var(--accent-color, #ef4444); height: 100%; border-radius: 3px;"></div>
                </div>
            `;
        };

        const generateSectionHtml = (title, dataObj, totalReference) => {
            const keys = Object.keys(dataObj).sort((a,b) => dataObj[b] - dataObj[a]);
            if(keys.length === 0) return '';
            let html = `<div style="background: rgba(150,150,150,0.05); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                            <strong style="display:block; margin-bottom: 8px;">${title}</strong>`;
            keys.forEach(k => {
                html += renderBar(k, dataObj[k], totalReference);
            });
            html += `</div>`;
            return html;
        };

        let html = `
            <div style="display:flex; gap:0.5rem; justify-content:center;">
                <div style="flex:1; text-align:center; padding: 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
                    <h3 style="margin: 0; color: #ef4444;">${total}</h3>
                    <span style="font-size:0.8rem;">Episodi Totali</span>
                </div>
                <div style="flex:1; text-align:center; padding: 10px; background: rgba(150, 150, 150, 0.1); border: 1px solid var(--border-soft); border-radius: 8px;">
                    <h3 style="margin: 0;">${medsTakenCount}</h3>
                    <span style="font-size:0.8rem;">Farmaci Assunti</span>
                </div>
            </div>
        `;

        html += generateSectionHtml("Intensità Registrate", intensityCounts, total);
        html += generateSectionHtml("Localizzazione e Tipo", locations, total);
        html += generateSectionHtml("Sintomi e Preavviso", symptoms, total);
        html += generateSectionHtml("Fattori Scatenanti", triggers, total);

        resContainer.innerHTML = html;
    });

    // Apre la finestra di aggiunta nuova
    document.getElementById('btn-add-from-day').addEventListener('click', () => {
        document.getElementById('edit-entry-id').value = ''; 
        
        // Svuota form
        document.getElementById('add-start').value = '';
        document.getElementById('add-end').value = '';
        
        document.getElementById('add-intensity').value = 5;
        document.getElementById('intensity-val').innerText = 5;
        document.getElementById('add-med-efficacy').value = 5;
        document.getElementById('efficacy-val').innerText = 5;

        setCategoryData('chips-location', 'add-location-other', '');
        setCategoryData('chips-symptoms', 'add-symptoms-other', '');
        setCategoryData('chips-triggers', 'add-triggers-other', '');
        setCategoryData('quick-meds-container', 'add-meds-other', '');
        document.getElementById('add-notes').value = '';

        // Chiude gli accordion
        document.querySelectorAll('.migraine-accordion').forEach(acc => acc.classList.remove('open'));

        document.getElementById('add-modal-title').innerText = "Registra Episodio";
        
        document.getElementById('cal-day-details-modal').classList.add('hidden');
        document.getElementById('cal-add-modal').classList.remove('hidden');
    });

    // GESTIONE ESPORTAZIONE PDF
    document.getElementById('btn-open-export').addEventListener('click', () => {
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const yyyy = currentDate.getFullYear();
        document.getElementById('export-month-from').value = `${yyyy}-${mm}`;
        document.getElementById('export-month-to').value = `${yyyy}-${mm}`;
        
        document.getElementById('cal-export-modal').classList.remove('hidden');
        document.getElementById('cal-menu-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-close-export').addEventListener('click', () => {
        document.getElementById('cal-export-modal').classList.add('hidden');
    });

    document.getElementById('btn-do-export').addEventListener('click', async () => {
        const valFrom = document.getElementById('export-month-from').value; 
        const valTo = document.getElementById('export-month-to').value; 
        
        if (!valFrom || !valTo) return alert("Seleziona il periodo di esportazione.");
        if (valFrom > valTo) return alert("Il mese di fine non può precedere quello di inizio.");

        const epsToExport = entries.filter(e => {
            const entryMonthStr = e.date.substring(0, 7); 
            return entryMonthStr >= valFrom && entryMonthStr <= valTo;
        });
        
        epsToExport.sort((a,b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (!a.startTime) return -1;
            if (!b.startTime) return 1;
            return a.startTime.localeCompare(b.startTime);
        });

        let htmlContent = `
            <div id="pdf-export-wrap" style="padding: 20px; font-family: sans-serif; background: #fff; color: #000; box-sizing: border-box; width: 100%;">
               <h1 style="text-align:center; color:#ef4444; margin-bottom: 20px; font-size: 24px;">Diario Emicrania</h1>
               <p style="text-align:center; font-size: 14px; margin-bottom:30px; color:#64748b;">Periodo: da ${valFrom} a ${valTo}</p>
        `;

        if (epsToExport.length === 0) {
            htmlContent += `<p style="text-align:center;">Nessun episodio registrato in questo periodo.</p>`;
        } else {
            epsToExport.forEach(ep => {
                const [y, m, d] = ep.date.split('-');
                
                let timeStr = ep.startTime ? ep.startTime : 'N/D';
                if (ep.endTime) timeStr += ` - ${ep.endTime}`;

                htmlContent += `
                    <div style="border: 1px solid #cbd5e1; border-left: 5px solid #ef4444; border-radius: 6px; padding: 10px 15px; margin-bottom: 15px; background: #f8fafc; page-break-inside: avoid;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">
                            <strong style="font-size:16px;">Data: ${d}/${m}/${y}</strong>
                            <span style="font-size:14px; font-weight:bold; color:#ef4444;">Orario: ${timeStr}</span>
                        </div>
                        <table style="width:100%; font-size:13px; line-height:1.5;">
                            ${ep.intensity ? `<tr><td style="width:30%; font-weight:bold; color:#475569;">Intensità:</td><td>${ep.intensity} / 10</td></tr>` : ''}
                            ${ep.medEfficacy ? `<tr><td style="font-weight:bold; color:#475569;">Efficacia Farmaco:</td><td>${ep.medEfficacy} / 10</td></tr>` : ''}
                            ${ep.location ? `<tr><td style="font-weight:bold; color:#475569;">Localizzazione/Tipo:</td><td>${ep.location}</td></tr>` : ''}
                            ${ep.symptoms ? `<tr><td style="font-weight:bold; color:#475569;">Sintomi/Preavviso:</td><td>${ep.symptoms}</td></tr>` : ''}
                            ${ep.triggers ? `<tr><td style="font-weight:bold; color:#475569;">Fattori Scatenanti:</td><td>${ep.triggers}</td></tr>` : ''}
                            ${ep.meds ? `<tr><td style="font-weight:bold; color:#475569;">Farmaci:</td><td>${ep.meds}</td></tr>` : ''}
                            ${ep.notes ? `<tr><td style="font-weight:bold; color:#475569; vertical-align:top;">Note:</td><td>${ep.notes}</td></tr>` : ''}
                        </table>
                    </div>
                `;
            });
        }

        htmlContent += `</div>`;

        const btn = document.getElementById('btn-do-export');
        const oldText = btn.innerText;
        btn.innerText = "Creazione PDF in corso...";
        btn.disabled = true;

        try {
            if (typeof html2pdf === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const element = document.createElement('div');
            element.innerHTML = htmlContent;

            const opt = {
              margin:       10,
              filename:     `Diario_Emicrania_${valFrom}_${valTo}.pdf`,
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { scale: 2 },
              jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };

            await html2pdf().set(opt).from(element).save();

            document.getElementById('cal-export-modal').classList.add('hidden');
        } catch(err) {
            console.error(err);
            alert("Errore generazione PDF");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    });

    // SALVATAGGIO EVENTO 
    document.getElementById('btn-save-entry').addEventListener('click', async () => {
        const editId = document.getElementById('edit-entry-id').value; 
        const date = document.getElementById('add-date').value;
        
        const payload = {
            date: date,
            startTime: document.getElementById('add-start').value,
            endTime: document.getElementById('add-end').value,
            intensity: document.getElementById('add-intensity').value,
            medEfficacy: document.getElementById('add-med-efficacy').value,
            location: getCategoryData('chips-location', 'add-location-other'),
            symptoms: getCategoryData('chips-symptoms', 'add-symptoms-other'),
            triggers: getCategoryData('chips-triggers', 'add-triggers-other'),
            meds: getCategoryData('quick-meds-container', 'add-meds-other'),
            notes: document.getElementById('add-notes').value.trim()
        };

        try {
            if (editId) {
                // MODIFICA
                await updateDoc(doc(db, 'migraine', editId), payload);
            } else {
                // CREAZIONE 
                payload.ownerUid = auth.currentUser.uid;
                await addDoc(collection(db, 'migraine'), payload);
            }
            
            document.getElementById('cal-add-modal').classList.add('hidden');
        } catch (e) {
            console.error(e);
            alert("Errore durante il salvataggio.");
        }
    });
}
