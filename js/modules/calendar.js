import { app, auth } from '../firebase-init.js';
import { getFirestore, collection, addDoc, query, where, getDocs, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const db = getFirestore(app);

// --- STATO GLOBALE DEL MODULO ---
let containerEl = null;
let currentDate = new Date();
let entries = [];
let presets = [];
let sharedUsersData = {}; 
let filters = {}; 
let quickModePreset = null; 
let quickSelectedDates = new Set(); 
let pendingRequests = [];
let myProfile = { name: '', sharedWith: [] };
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
    
    await checkUserProfile();
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
    if (document.getElementById('calendar-styles')) return;
    const style = document.createElement('style');
    style.id = 'calendar-styles';
    style.innerHTML = `
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .cal-nav { display: flex; align-items: center; gap: 1rem; }
        .cal-nav button { background: none; border: none; color: var(--text-primary); font-size: 1.5rem; cursor: pointer; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-day-header { text-align: center; font-size: 0.8rem; font-weight: bold; color: var(--text-secondary); padding-bottom: 0.5rem; }
        .cal-cell { min-height: 80px; background: rgba(150,150,150,0.05); border-radius: 8px; padding: 4px; display: flex; flex-direction: column; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; position:relative;}
        .cal-cell:hover { border-color: var(--accent-color); }
        .cal-cell.today { background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.3); }
        .cal-cell.other-month { opacity: 0.4; }
        .cal-cell.quick-selected { background-color: rgba(16, 185, 129, 0.2); border-color: #10b981; }
        .cal-date { font-size: 0.85rem; font-weight: bold; margin-bottom: 4px; text-align: right; pointer-events: none; }
        
        .cal-dots-container { display: flex; justify-content: flex-end; gap: 3px; margin-top: auto; padding: 2px; flex-wrap: wrap; pointer-events: none;}
        .cal-dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot-green { background-color: #10b981; }
        .dot-blue { background-color: #3b82f6; }
        .dot-yellow { background-color: #f59e0b; }
        
        .quick-mode-banner { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--surface-strong); border: 1px solid var(--accent-color); padding: 10px 15px; border-radius: 30px; display: flex; align-items: center; gap: 15px; box-shadow: var(--shadow-strong); z-index: 3000; width: 90%; max-width: 400px; justify-content: space-between; }
        
        /* FILTRI E ACCORDION */
        .filter-row { border-bottom: 1px solid var(--border-soft); margin-bottom: 0.5rem; }
        .filter-header { padding: 0.8rem 0; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: bold;}
        .filter-header .chevron { transition: transform 0.3s; color: var(--text-secondary); }
        .filter-row.open .chevron { transform: rotate(-180deg); }
        .filter-content { padding: 0.5rem 0 1rem 0; display: none; flex-direction: column; gap: 0.8rem; }
        .filter-row.open .filter-content { display: flex; }
        
        /* IOS SWITCH TOGGLE */
        .ios-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .ios-switch input { opacity: 0; width: 0; height: 0; }
        .ios-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(150,150,150,0.3); transition: .3s; border-radius: 24px; }
        .ios-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input:checked + .ios-slider { background-color: #10b981; }
        input:checked + .ios-slider:before { transform: translateX(20px); }
        .filter-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; }

        .preset-row { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--border-soft); background: rgba(150,150,150,0.03); border-radius: 8px; margin-bottom: 0.5rem;}
        
        .req-row { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; background: rgba(150,150,150,0.05); border-radius: 8px; margin-bottom: 0.5rem; }
        .req-actions { display: flex; gap: 0.5rem; }
        
        .menu-btn-container { position: relative; }
        .notification-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 0.6rem; font-weight: bold; width: 16px; height: 16px; border-radius: 50%; display: flex; justify-content: center; align-items: center; }
        .hidden-badge { display: none !important; }

        /* Scelta Aggiunta */
        .choice-btn { display: flex; align-items: center; gap: 1rem; width: 100%; padding: 1rem; background: rgba(150,150,150,0.05); border: 1px solid var(--border-soft); border-radius: 8px; font-size: 1.1rem; color: var(--text-primary); cursor: pointer; margin-bottom: 0.5rem; transition: background 0.2s; }
        .choice-btn:hover { background: rgba(150,150,150,0.1); }
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
                    <button id="btn-open-filters" class="icon-btn">
                        <span class="material-symbols-outlined">filter_list</span>
                    </button>
                    <div class="menu-btn-container">
                        <button id="cal-menu-btn" class="icon-btn">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                        <div id="cal-main-badge" class="notification-badge hidden-badge">!</div>
                    </div>
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
    wrapper.id = 'calendar-modals-wrapper';
    
    wrapper.innerHTML = `
        <!-- MENU MODALE -->
        <div id="cal-menu-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Opzioni Calendario</h2>
                    <button id="btn-close-menu" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="settings-section">
                    <button id="btn-open-share" class="btn secondary outline" style="width:100%; margin-bottom:0.5rem;">Condividi Calendario</button>
                    <button id="btn-open-requests" class="btn secondary outline" style="width:100%; margin-bottom:0.5rem; position:relative;">
                        Richieste
                        <div id="cal-req-badge" class="notification-badge hidden-badge" style="right:10px; top:10px;">!</div>
                    </button>
                    <button id="btn-open-presets" class="btn secondary outline" style="width:100%; margin-bottom:0.5rem;">Turni Predefiniti (Rapidi)</button>
                    <!-- Tasto per Esportazione PDF -->
                    <button id="btn-open-export" class="btn secondary outline" style="width:100%; margin-bottom:1rem; border-color:var(--accent-color); color:var(--accent-color);">
                        <span class="material-symbols-outlined" style="vertical-align:middle; margin-right:5px;">picture_as_pdf</span> Esporta PDF Mese
                    </button>
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
                <p style="font-size:0.85rem; margin-bottom:1rem; color:var(--text-secondary);">Seleziona il mese. Verrà generata una griglia mensile classica a 7 colonne in un'unica pagina.</p>
                <div class="input-group" style="margin-bottom: 1rem;">
                    <input type="month" id="export-month" class="input-select" style="width:100%; margin:0;">
                </div>
                <button id="btn-do-export" class="btn primary" style="width:100%;">Genera e Scarica PDF</button>
            </div>
        </div>

        <!-- MODALE FILTRI -->
        <div id="cal-filters-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Filtri Calendario</h2>
                    <button id="btn-close-filters" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div id="cal-filters-container"></div>
            </div>
        </div>

        <!-- MODALE DETTAGLI DEL GIORNO -->
        <div id="cal-day-details-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header" style="align-items:flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <h2 id="day-details-title" style="margin-bottom: 0.2rem;">Eventi</h2>
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

        <!-- MODALE SCELTA AGGIUNTA -->
        <div id="cal-add-choice-modal" class="modal-overlay hidden" style="z-index: 2100;">
            <div class="modal-content" style="max-width:350px;">
                <div class="modal-header">
                    <h2>Cosa vuoi aggiungere?</h2>
                    <button id="btn-close-choice" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <button class="choice-btn" data-choice="shift">
                    <span class="material-symbols-outlined" style="color:#10b981;">work</span> Turno di Lavoro
                </button>
                <button class="choice-btn" data-choice="event">
                    <span class="material-symbols-outlined" style="color:#3b82f6;">event</span> Evento
                </button>
                <button class="choice-btn" data-choice="note">
                    <span class="material-symbols-outlined" style="color:#f59e0b;">description</span> Nota (Testo libero)
                </button>
            </div>
        </div>

        <!-- MODALE AGGIUNGI / MODIFICA VOCE -->
        <div id="cal-add-modal" class="modal-overlay hidden" style="z-index: 2200;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="add-modal-title">Aggiungi</h2>
                    <button id="btn-close-add" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                
                <input type="hidden" id="add-date">
                <input type="hidden" id="add-type">
                <input type="hidden" id="edit-entry-id">

                <div class="input-group" style="margin-bottom: 0.8rem;">
                    <input type="text" id="add-title" placeholder="Nome o testo...">
                </div>

                <div id="add-time-container" style="display:flex; gap:0.5rem; margin-bottom: 0.8rem;">
                    <div style="flex:1;">
                        <label style="font-size:0.8rem;">Inizio</label>
                        <input type="time" id="add-start" class="input-select" style="width:100%;">
                    </div>
                    <div style="flex:1;" id="end-time-wrapper">
                        <label style="font-size:0.8rem;">Fine</label>
                        <input type="time" id="add-end" class="input-select" style="width:100%;">
                    </div>
                </div>

                <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1.5rem; font-size:0.9rem; cursor:pointer;">
                    <input type="checkbox" id="add-private"> 
                    Privato (Non visibile agli altri)
                </label>

                <button id="btn-save-entry" class="btn primary" style="width:100%;">Salva</button>
            </div>
        </div>

        <!-- MODALE PRESET / QUICK MODE -->
        <div id="cal-presets-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Turni Rapidi</h2>
                    <button id="btn-close-presets" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                
                <button id="btn-show-add-preset" class="btn secondary outline" style="width:100%; margin-bottom:1rem;">
                    <span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 5px;">add</span> Aggiungi Turno
                </button>
                
                <div id="add-preset-form" class="hidden" style="margin-bottom: 1rem; padding: 1rem; background: rgba(150,150,150,0.05); border-radius: 8px;">
                    <input type="text" id="preset-name" placeholder="Nome Turno (es. Mattina)" class="input-select" style="width:100%; margin-bottom:0.8rem;">
                    <div style="display:flex; gap:0.5rem; margin-bottom: 0.8rem;">
                        <div style="flex:1;">
                            <label style="font-size:0.8rem;">Inizio</label>
                            <input type="time" id="preset-start" class="input-select" style="width:100%;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem;">Fine</label>
                            <input type="time" id="preset-end" class="input-select" style="width:100%;">
                        </div>
                    </div>
                    <button id="btn-save-preset" class="btn primary" style="width:100%;">Salva Turno</button>
                </div>

                <div id="presets-list"></div>
            </div>
        </div>

        <!-- MODALE CONDIVISIONE -->
        <div id="cal-share-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Condividi Calendario</h2>
                    <button id="btn-close-share" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <p style="font-size:0.85rem; margin-bottom:1rem;">Inserisci l'email dell'utente per condividere reciprocamente i calendari.</p>
                <div class="input-group" style="margin-bottom: 1rem;">
                    <input type="email" id="share-email" placeholder="Email utente" style="margin:0;">
                </div>
                <button id="btn-send-share" class="btn primary" style="width:100%;">Invia Richiesta</button>
                <p id="share-msg" class="msg-feedback"></p>

                <h3 style="margin-top:1.5rem; font-size:1rem;">I tuoi collegamenti:</h3>
                <div id="shared-with-list"></div>
            </div>
        </div>

        <!-- MODALE RICHIESTE -->
        <div id="cal-requests-modal" class="modal-overlay hidden" style="z-index: 2000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Richieste Ricevute</h2>
                    <button id="btn-close-requests" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div id="requests-list">Nessuna richiesta.</div>
            </div>
        </div>

        <!-- BANNER QUICK MODE -->
        <div id="quick-mode-banner" class="quick-mode-banner hidden">
            <div style="flex:1; display:flex; flex-direction:column;">
                <span style="font-size: 0.8rem; color: var(--text-secondary);">Turno selezionato:</span>
                <strong id="quick-mode-name" style="color: var(--accent-color);"></strong>
            </div>
            <div style="display:flex; gap: 0.5rem; align-items:center;">
                <button id="btn-apply-quick" class="btn primary" style="display:none; padding: 0.5rem 1rem;">Salva</button>
                <button id="btn-exit-quick" class="icon-btn" style="border-color: var(--border-soft);"><span class="material-symbols-outlined">close</span></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(wrapper);
}


// --- LOGICA E DATABASE ---
async function checkUserProfile() {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const snap = await getDoc(userRef);
    
    if (snap.exists()) {
        const data = snap.data();
        const fname = data.firstName || 'Utente';
        const lname = data.lastName || '';
        myProfile.name = `${fname} ${lname}`.trim();
        myProfile.sharedWith = data.sharedWith || [];
    } else {
        myProfile.name = 'Utente';
        myProfile.sharedWith = [];
    }
    
    initDataListeners();
}

function initDataListeners() {
    const uid = auth.currentUser.uid;
    
    if (!filters[uid]) filters[uid] = { events: true, shifts: true, notes: true };
    sharedUsersData[uid] = { name: myProfile.name, email: auth.currentUser.email };

    // 1. Ascolta profilo utente
    onSnapshot(doc(db, 'users', uid), async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            myProfile.sharedWith = data.sharedWith || [];
            
            for (let friendUid of myProfile.sharedWith) {
                if (!filters[friendUid]) filters[friendUid] = { events: true, shifts: true, notes: true };
                if (!sharedUsersData[friendUid]) {
                    const friendSnap = await getDoc(doc(db, 'users', friendUid));
                    if (friendSnap.exists()) {
                        const fd = friendSnap.data();
                        sharedUsersData[friendUid] = { 
                            name: `${fd.firstName || ''} ${fd.lastName || ''}`.trim() || fd.email, 
                            email: fd.email 
                        };
                    }
                }
            }
            renderFilters();
            renderSharedWithList();
            renderCalendar();
        }
    });

    // 2. Ascolta Turni Rapidi
    onSnapshot(query(collection(db, 'calendar_presets'), where('ownerUid', '==', uid)), (snap) => {
        presets = [];
        snap.forEach(d => presets.push({id: d.id, ...d.data()}));
        renderPresets();
    });

    // 3. Ascolta Richieste IN ENTRATA (Pending)
    onSnapshot(query(collection(db, 'calendar_requests'), where('toEmail', '==', auth.currentUser.email), where('status', '==', 'pending')), (snap) => {
        pendingRequests = [];
        snap.forEach(d => pendingRequests.push({id: d.id, ...d.data()}));
        
        const badge1 = document.getElementById('cal-main-badge');
        const badge2 = document.getElementById('cal-req-badge');
        if (pendingRequests.length > 0) {
            badge1.classList.remove('hidden-badge');
            badge2.classList.remove('hidden-badge');
            badge1.innerText = pendingRequests.length;
            badge2.innerText = pendingRequests.length;
        } else {
            badge1.classList.add('hidden-badge');
            badge2.classList.add('hidden-badge');
        }
        renderRequests();
    });

    // 4. FIX CONDIVISIONE: Ascolta Richieste IN USCITA accettate
    onSnapshot(query(collection(db, 'calendar_requests'), where('fromUid', '==', uid), where('status', '==', 'accepted')), (snap) => {
        snap.forEach(async (d) => {
            const reqData = d.data();
            if (reqData.acceptedByUid) {
                await updateDoc(doc(db, 'users', uid), {
                    sharedWith: arrayUnion(reqData.acceptedByUid)
                });
                // Elimina la notifica che ha fatto il suo dovere
                await deleteDoc(doc(db, 'calendar_requests', d.id));
            }
        });
    });

    // 5. Ascolta Eventi e Turni
    onSnapshot(collection(db, 'calendar_entries'), (snap) => {
        entries = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.ownerUid === uid || (myProfile.sharedWith.includes(data.ownerUid) && !data.isPrivate)) {
                entries.push({id: d.id, ...data});
            }
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
        
        if (quickModePreset && quickSelectedDates.has(dateStr)) {
            cell.classList.add('quick-selected');
        }
        
        const dayInfo = getDayInfo(i, month + 1, year);
        let holiMarker = dayInfo.festa ? `<span style="color:#ef4444; font-size:1.2rem; line-height:0.5; vertical-align: middle;">•</span>` : '';

        // Creazione dei puntini colorati (Dots)
        const dayEntries = entries.filter(e => e.date === dateStr);
        let hasShift = false, hasEvent = false, hasNote = false;
        
        dayEntries.forEach(entry => {
            const userFilter = filters[entry.ownerUid];
            if (!userFilter) return;
            if (entry.type === 'shift' && userFilter.shifts) hasShift = true;
            if (entry.type === 'event' && userFilter.events) hasEvent = true;
            if (entry.type === 'note' && userFilter.notes) hasNote = true;
        });

        let dotsHtml = '<div class="cal-dots-container">';
        if (hasShift) dotsHtml += '<div class="cal-dot dot-green"></div>';
        if (hasEvent) dotsHtml += '<div class="cal-dot dot-blue"></div>';
        if (hasNote) dotsHtml += '<div class="cal-dot dot-yellow"></div>';
        dotsHtml += '</div>';

        cell.innerHTML = `<div class="cal-date">${holiMarker} ${i}</div> ${dotsHtml}`;

        cell.addEventListener('click', () => handleDayClick(dateStr, cell));
        grid.appendChild(cell);
    }
}

function handleDayClick(dateStr, cellElement) {
    if (quickModePreset) {
        if (quickSelectedDates.has(dateStr)) {
            quickSelectedDates.delete(dateStr);
            cellElement.classList.remove('quick-selected');
        } else {
            quickSelectedDates.add(dateStr);
            cellElement.classList.add('quick-selected');
        }
        
        const btnApply = document.getElementById('btn-apply-quick');
        if (quickSelectedDates.size > 0) {
            btnApply.style.display = 'block';
            btnApply.innerText = `Salva (${quickSelectedDates.size})`;
        } else {
            btnApply.style.display = 'none';
        }
    } else {
        openDayDetails(dateStr);
    }
}

function openDayDetails(dateStr) {
    document.getElementById('add-date').value = dateStr;
    const [y, m, d] = dateStr.split('-');
    
    document.getElementById('day-details-title').innerText = `${d}/${m}/${y}`;
    
    const dayInfo = getDayInfo(parseInt(d), parseInt(m), parseInt(y));
    let subtitleHtml = dayInfo.santo;
    if (dayInfo.festa) {
        subtitleHtml += ` <br><span style="color:#ef4444; font-weight:bold;">${dayInfo.festa}</span>`;
    }
    document.getElementById('day-details-subtitle').innerHTML = subtitleHtml;
    
    const cont = document.getElementById('day-details-list');
    cont.innerHTML = '';
    
    const dayEntries = entries.filter(e => e.date === dateStr);
    
    // Ordina: Eventi e Note senza ora in alto, Turni in ordine di ora
    dayEntries.sort((a,b) => {
        if (!a.startTime) return -1;
        if (!b.startTime) return 1;
        return a.startTime.localeCompare(b.startTime);
    });
    
    let shownCount = 0;
    
    dayEntries.forEach(entry => {
        const userFilter = filters[entry.ownerUid];
        if (!userFilter) return;
        if (entry.type === 'shift' && !userFilter.shifts) return;
        if (entry.type === 'event' && !userFilter.events) return;
        if (entry.type === 'note' && !userFilter.notes) return;
        
        shownCount++;
        const isMine = entry.ownerUid === auth.currentUser.uid;
        let initial = '';
        let ownerName = 'Mio';
        
        if (!isMine && sharedUsersData[entry.ownerUid]) {
            ownerName = sharedUsersData[entry.ownerUid].name;
            initial = `<span style="font-size:0.7rem; color:var(--text-secondary);">(${ownerName})</span>`;
        }

        const div = document.createElement('div');
        div.className = `preset-row`;
        
        let colorTheme = '#10b981'; // Green (shift)
        let iconHtml = 'schedule';
        let timeText = `${entry.startTime} ${entry.endTime ? '- '+entry.endTime : ''}`;
        
        if (entry.type === 'event') {
            colorTheme = '#3b82f6'; // Blu
        } else if (entry.type === 'note') {
            colorTheme = '#f59e0b'; // Giallo
            iconHtml = 'description';
            timeText = 'Nota';
        }
        
        if (entry.isPrivate) colorTheme = '#ef4444'; // Rosso (privato)

        div.style.borderLeft = `4px solid ${colorTheme}`;
        
        // Nuova struttura pulsanti Modifica / Elimina
        let actionsHtml = isMine ? `
            <div style="display:flex; gap:0.4rem; align-items:center;">
                <button class="icon-btn btn-edit-entry" data-id="${entry.id}" style="color:var(--accent-color); width:32px; height:32px; min-width:32px;"><span class="material-symbols-outlined" style="font-size:1.1rem;">edit</span></button>
                <button class="icon-btn btn-del-entry" data-id="${entry.id}" style="color:#ef4444; width:32px; height:32px; min-width:32px;"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span></button>
            </div>
        ` : '';

        div.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:bold; margin-bottom:0.2rem;">${entry.title} ${initial}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">
                    <span class="material-symbols-outlined" style="font-size:0.9rem; vertical-align:middle;">${iconHtml}</span>
                    ${timeText}
                </div>
            </div>
            ${actionsHtml}
        `;
        cont.appendChild(div);
    });
    
    if (shownCount === 0) {
        cont.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:1rem;">Nessun elemento da mostrare.</p>';
    } else {
        
        // EDIT EVENTO
        document.querySelectorAll('.btn-edit-entry').forEach(b => {
            b.addEventListener('click', (e) => {
                const entryId = e.currentTarget.dataset.id;
                const entry = entries.find(x => x.id === entryId);
                if (!entry) return;

                document.getElementById('edit-entry-id').value = entry.id;
                document.getElementById('add-date').value = entry.date;
                document.getElementById('add-type').value = entry.type;
                document.getElementById('add-title').value = entry.title;
                document.getElementById('add-start').value = entry.startTime || '';
                document.getElementById('add-end').value = entry.endTime || '';
                document.getElementById('add-private').checked = !!entry.isPrivate;

                const timeContainer = document.getElementById('add-time-container');
                const endWrapper = document.getElementById('end-time-wrapper');
                const modalTitle = document.getElementById('add-modal-title');

                if (entry.type === 'note') {
                    modalTitle.innerText = "Modifica Nota";
                    timeContainer.style.display = 'none';
                } else if (entry.type === 'shift') {
                    modalTitle.innerText = "Modifica Turno";
                    timeContainer.style.display = 'flex';
                    endWrapper.style.display = 'block';
                } else {
                    modalTitle.innerText = "Modifica Evento";
                    timeContainer.style.display = 'flex';
                    endWrapper.style.display = 'block';
                }

                document.getElementById('cal-day-details-modal').classList.add('hidden');
                document.getElementById('cal-add-modal').classList.remove('hidden');
            });
        });

        // ELIMINA EVENTO
        document.querySelectorAll('.btn-del-entry').forEach(b => {
            b.addEventListener('click', async (e) => {
                const entryId = e.currentTarget.dataset.id;
                try { await deleteDoc(doc(db, 'calendar_entries', entryId)); } catch (err) {}
            });
        });
    }
    
    document.getElementById('cal-day-details-modal').classList.remove('hidden');
}

// --- FILTRI CON INTERFACCIA TIPO IOS ---
function renderFilters() {
    const cont = document.getElementById('cal-filters-container');
    if(!cont) return;
    cont.innerHTML = '';
    
    const uids = [auth.currentUser.uid, ...myProfile.sharedWith];
    
    uids.forEach(uid => {
        if(!sharedUsersData[uid] || !filters[uid]) return;
        const name = uid === auth.currentUser.uid ? "Le mie Voci" : sharedUsersData[uid].name;
        const state = filters[uid];
        
        const row = document.createElement('div');
        row.className = 'filter-row';
        row.innerHTML = `
            <div class="filter-header">
                <span>${name}</span>
                <span class="material-symbols-outlined chevron">expand_more</span>
            </div>
            <div class="filter-content">
                <div class="filter-item">
                    <span>Lavoro (Turni)</span>
                    <label class="ios-switch">
                        <input type="checkbox" class="cb-filter" data-uid="${uid}" data-type="shifts" ${state.shifts ? 'checked' : ''}>
                        <span class="ios-slider"></span>
                    </label>
                </div>
                <div class="filter-item">
                    <span>Eventi</span>
                    <label class="ios-switch">
                        <input type="checkbox" class="cb-filter" data-uid="${uid}" data-type="events" ${state.events ? 'checked' : ''}>
                        <span class="ios-slider"></span>
                    </label>
                </div>
                <div class="filter-item">
                    <span>Note</span>
                    <label class="ios-switch">
                        <input type="checkbox" class="cb-filter" data-uid="${uid}" data-type="notes" ${state.notes ? 'checked' : ''}>
                        <span class="ios-slider"></span>
                    </label>
                </div>
            </div>
        `;
        
        row.querySelector('.filter-header').addEventListener('click', () => {
            row.classList.toggle('open');
        });

        row.querySelectorAll('.cb-filter').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const tuid = e.target.dataset.uid;
                const ttype = e.target.dataset.type;
                filters[tuid][ttype] = e.target.checked;
                renderCalendar(); 
            });
        });

        cont.appendChild(row);
    });
}

function renderPresets() {
    const cont = document.getElementById('presets-list');
    if(!cont) return;
    cont.innerHTML = '';
    presets.forEach(p => {
        const div = document.createElement('div');
        div.className = 'preset-row';
        div.innerHTML = `
            <div><strong>${p.name}</strong><br><small>${p.startTime} - ${p.endTime}</small></div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn primary outline btn-use-preset" data-id="${p.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem;">Usa Rapido</button>
                <button class="icon-btn btn-del-preset" data-id="${p.id}" style="color:#ef4444;"><span class="material-symbols-outlined">delete</span></button>
            </div>
        `;
        cont.appendChild(div);
    });

    document.querySelectorAll('.btn-del-preset').forEach(b => {
        b.addEventListener('click', async (e) => {
            try { await deleteDoc(doc(db, 'calendar_presets', e.currentTarget.dataset.id)); } catch (err) {}
        });
    });

    document.querySelectorAll('.btn-use-preset').forEach(b => {
        b.addEventListener('click', (e) => {
            const preset = presets.find(x => x.id === e.currentTarget.dataset.id);
            quickModePreset = preset;
            quickSelectedDates.clear(); 
            
            document.getElementById('cal-presets-modal').classList.add('hidden');
            document.getElementById('cal-menu-modal').classList.add('hidden');
            
            const banner = document.getElementById('quick-mode-banner');
            document.getElementById('quick-mode-name').innerText = preset.name;
            document.getElementById('btn-apply-quick').style.display = 'none'; 
            banner.classList.remove('hidden');
            
            renderCalendar(); 
        });
    });
}

function renderRequests() {
    const cont = document.getElementById('requests-list');
    if(!cont) return;
    
    if (pendingRequests.length === 0) {
        cont.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Nessuna nuova richiesta.</p>';
        return;
    }
    
    cont.innerHTML = '';
    pendingRequests.forEach(req => {
        const div = document.createElement('div');
        div.className = 'req-row';
        div.innerHTML = `
            <div><strong>${req.fromName}</strong><br><small>${req.fromEmail}</small></div>
            <div class="req-actions">
                <button class="icon-btn" style="color:#10b981; border-color:#10b981;" data-id="${req.id}" data-uid="${req.fromUid}" data-action="accept"><span class="material-symbols-outlined">check</span></button>
                <button class="icon-btn" style="color:#ef4444; border-color:#ef4444;" data-id="${req.id}" data-action="reject"><span class="material-symbols-outlined">close</span></button>
            </div>
        `;
        cont.appendChild(div);
    });

    document.querySelectorAll('.req-actions button').forEach(b => {
        b.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const reqId = btn.dataset.id;
            const action = btn.dataset.action;
            
            try {
                if (action === 'accept') {
                    const fromUid = btn.dataset.uid;
                    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                        sharedWith: arrayUnion(fromUid)
                    });
                    await updateDoc(doc(db, 'calendar_requests', reqId), { 
                        status: 'accepted',
                        acceptedByUid: auth.currentUser.uid
                    });
                } else {
                    await deleteDoc(doc(db, 'calendar_requests', reqId));
                }
            } catch (err) {
                console.error("Errore risposta richiesta:", err);
            }
        });
    });
}

function renderSharedWithList() {
    const cont = document.getElementById('shared-with-list');
    if(!cont) return;
    cont.innerHTML = '';
    if (myProfile.sharedWith.length === 0) {
        cont.innerHTML = '<p style="font-size:0.9rem; color:var(--text-secondary);">Nessuno.</p>';
        return;
    }
    myProfile.sharedWith.forEach(uid => {
        if(sharedUsersData[uid]) {
            cont.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:rgba(150,150,150,0.05); border-radius:4px; margin-bottom:0.2rem;">
                <div>
                    <div style="font-weight:bold; font-size:0.95rem;">${sharedUsersData[uid].name}</div>
                    <small style="color:var(--text-secondary);">${sharedUsersData[uid].email}</small>
                </div>
                <button class="icon-btn btn-revoke-share" data-uid="${uid}" style="color:#ef4444; border-color:transparent; width:32px; height:32px; min-width:32px;" title="Revoca Condivisione">
                    <span class="material-symbols-outlined" style="font-size:1.3rem;">person_remove</span>
                </button>
            </div>`;
        }
    });

    // EVENTO REVOCA CONDIVISIONE (Reciproca)
    document.querySelectorAll('.btn-revoke-share').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetUid = e.currentTarget.dataset.uid;
            if (confirm("Vuoi davvero revocare la condivisione? Non potrete più vedere i reciproci calendari.")) {
                try {
                    // Tolgo lui dalla mia lista
                    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                        sharedWith: arrayRemove(targetUid)
                    });
                    // Tolgo me dalla sua lista
                    await updateDoc(doc(db, 'users', targetUid), {
                        sharedWith: arrayRemove(auth.currentUser.uid)
                    });
                } catch(err) {
                    alert("Errore durante la revoca.");
                }
            }
        });
    });
}

// --- EVENTI CALENDARIO BASE ---
function bindCalendarEvents() {
    document.getElementById('cal-prev').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('cal-next').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('cal-menu-btn').addEventListener('click', () => document.getElementById('cal-menu-modal').classList.remove('hidden'));
    document.getElementById('btn-open-filters').addEventListener('click', () => document.getElementById('cal-filters-modal').classList.remove('hidden'));
}

// --- EVENTI MODALI ---
function bindModalEvents() {
    document.getElementById('btn-close-menu').addEventListener('click', () => document.getElementById('cal-menu-modal').classList.add('hidden'));
    document.getElementById('btn-close-filters').addEventListener('click', () => document.getElementById('cal-filters-modal').classList.add('hidden'));
    document.getElementById('btn-close-add').addEventListener('click', () => document.getElementById('cal-add-modal').classList.add('hidden'));
    document.getElementById('btn-close-day-details').addEventListener('click', () => document.getElementById('cal-day-details-modal').classList.add('hidden'));
    document.getElementById('btn-close-choice').addEventListener('click', () => document.getElementById('cal-add-choice-modal').classList.add('hidden'));
    
    // Tasto '+' per aggiungere: apre la Scelta e formatta gli ID
    document.getElementById('btn-add-from-day').addEventListener('click', () => {
        document.getElementById('edit-entry-id').value = ''; // Svuota l'edit mode
        document.getElementById('cal-add-choice-modal').classList.remove('hidden');
    });

    // Azioni della modale Scelta (Turno, Evento, Nota)
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const choice = e.currentTarget.dataset.choice;
            document.getElementById('add-type').value = choice;
            document.getElementById('cal-add-choice-modal').classList.add('hidden');
            
            const timeContainer = document.getElementById('add-time-container');
            const endWrapper = document.getElementById('end-time-wrapper');
            const addTitle = document.getElementById('add-title');
            
            document.getElementById('add-title').value = ''; // Reset
            document.getElementById('add-start').value = '';
            document.getElementById('add-end').value = '';
            document.getElementById('add-private').checked = false;

            if (choice === 'note') {
                document.getElementById('add-modal-title').innerText = "Aggiungi Nota";
                addTitle.placeholder = "Testo della nota...";
                timeContainer.style.display = 'none'; 
            } else {
                document.getElementById('add-modal-title').innerText = choice === 'shift' ? "Aggiungi Turno" : "Aggiungi Evento";
                addTitle.placeholder = "Nome (es. Mattina, Visita)";
                timeContainer.style.display = 'flex'; 
                endWrapper.style.display = 'block'; 
            }
            
            document.getElementById('cal-add-modal').classList.remove('hidden');
        });
    });

    document.getElementById('btn-open-share').addEventListener('click', () => {
        document.getElementById('cal-share-modal').classList.remove('hidden');
        renderSharedWithList();
    });
    document.getElementById('btn-close-share').addEventListener('click', () => document.getElementById('cal-share-modal').classList.add('hidden'));
    
    document.getElementById('btn-open-requests').addEventListener('click', () => document.getElementById('cal-requests-modal').classList.remove('hidden'));
    document.getElementById('btn-close-requests').addEventListener('click', () => document.getElementById('cal-requests-modal').classList.add('hidden'));

    document.getElementById('btn-open-presets').addEventListener('click', () => document.getElementById('cal-presets-modal').classList.remove('hidden'));
    document.getElementById('btn-close-presets').addEventListener('click', () => document.getElementById('cal-presets-modal').classList.add('hidden'));

    // GESTIONE ESPORTAZIONE PDF
    document.getElementById('btn-open-export').addEventListener('click', () => {
        // Pre-imposta il mese attualmente visualizzato
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const yyyy = currentDate.getFullYear();
        document.getElementById('export-month').value = `${yyyy}-${mm}`;
        
        document.getElementById('cal-export-modal').classList.remove('hidden');
        document.getElementById('cal-menu-modal').classList.add('hidden');
    });
    
    document.getElementById('btn-close-export').addEventListener('click', () => {
        document.getElementById('cal-export-modal').classList.add('hidden');
    });

    document.getElementById('btn-do-export').addEventListener('click', async () => {
        const monthVal = document.getElementById('export-month').value; 
        if (!monthVal) return alert("Seleziona un mese.");

        const [y, m] = monthVal.split('-');
        const year = parseInt(y);
        const month = parseInt(m) - 1; 
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let startOffset = firstDay === 0 ? 6 : firstDay - 1; 

        let htmlContent = `
            <div id="pdf-export-wrap" style="padding: 10px; font-family: sans-serif; background: #fff; color: #000; box-sizing: border-box; width: 100%;">
               <h1 style="text-align:center; color:#2563eb; margin-bottom: 8px; font-size: 18px; font-weight: bold;">${monthNames[month]} ${year}</h1>
               <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-weight: bold; font-size: 10px; background: #e2e8f0; padding: 4px; margin-bottom: 2px;">
                   <div>Lun</div><div>Mar</div><div>Mer</div><div>Gio</div><div>Ven</div><div>Sab</div><div>Dom</div>
               </div>
               <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; width: 100%;">
        `;

        // Celle vuote prima del mese
        for (let i = 0; i < startOffset; i++) {
            htmlContent += `<div style="min-height: 70px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; opacity: 0.3;"></div>`;
        }

        // Giorni del mese
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEntries = entries.filter(e => e.date === dateStr);
            const dayInfo = getDayInfo(i, month + 1, year);

            let dayHtml = `
            <div style="min-height: 70px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 2px;">
                    <span style="font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${dayInfo.festa ? '<b>' + dayInfo.festa + '</b>' : dayInfo.santo}</span>
                    <span style="font-size: 12px; font-weight: bold; color: ${dayInfo.festa ? '#ef4444' : '#0f172a'};">${i}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">
            `;

            if (dayEntries.length > 0) {
                dayEntries.sort((a,b) => {
                    if (!a.startTime) return -1;
                    if (!b.startTime) return 1;
                    return a.startTime.localeCompare(b.startTime);
                });

                dayEntries.forEach(entry => {
                    const userFilter = filters[entry.ownerUid];
                    if (!userFilter) return;
                    if (entry.type === 'shift' && !userFilter.shifts) return;
                    if (entry.type === 'event' && !userFilter.events) return;
                    if (entry.type === 'note' && !userFilter.notes) return;

                    const isMine = entry.ownerUid === auth.currentUser.uid;
                    let ownerName = isMine ? '' : ` (${sharedUsersData[entry.ownerUid]?.name || 'Cond.'})`;
                    let timeStr = entry.type === 'note' ? 'Nota' : `${entry.startTime}`;

                    let color = entry.type === 'shift' ? '#10b981' : (entry.type === 'event' ? '#3b82f6' : '#f59e0b');
                    if (entry.isPrivate) color = '#ef4444';

                    dayHtml += `
                        <div style="font-size: 7px; background: ${color}15; border-left: 2px solid ${color}; padding: 1px 2px; border-radius: 2px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <b>${timeStr}</b> ${entry.title}${ownerName}
                        </div>
                    `;
                });
            }

            dayHtml += `</div></div>`;
            htmlContent += dayHtml;
        }

        htmlContent += `</div></div>`;

        const btn = document.getElementById('btn-do-export');
        const oldText = btn.innerText;
        btn.innerText = "Creazione PDF in corso...";
        btn.disabled = true;

        try {
            // Carica la libreria html2pdf dinamicamente solo se richiesta
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
              margin:       5,
              filename:     `Calendario_${monthNames[month]}_${year}.pdf`,
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { scale: 2 },
              jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
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

    document.getElementById('btn-exit-quick').addEventListener('click', () => {
        quickModePreset = null;
        quickSelectedDates.clear();
        document.getElementById('quick-mode-banner').classList.add('hidden');
        renderCalendar(); 
    });

    document.getElementById('btn-apply-quick').addEventListener('click', async () => {
        if (quickSelectedDates.size === 0 || !quickModePreset) return;
        
        const btn = document.getElementById('btn-apply-quick');
        btn.disabled = true;
        btn.innerText = "Salvataggio...";
        
        try {
            const promises = [];
            for (let dateStr of quickSelectedDates) {
                promises.push(addDoc(collection(db, 'calendar_entries'), {
                    type: 'shift',
                    title: quickModePreset.name,
                    startTime: quickModePreset.startTime,
                    endTime: quickModePreset.endTime,
                    date: dateStr,
                    ownerUid: auth.currentUser.uid,
                    isPrivate: false 
                }));
            }
            await Promise.all(promises);
            
            quickModePreset = null;
            quickSelectedDates.clear();
            document.getElementById('quick-mode-banner').classList.add('hidden');
            renderCalendar(); 
        } catch (e) {
            console.error(e);
            alert("Errore salvataggio rapido.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Salva";
        }
    });

    document.getElementById('btn-show-add-preset').addEventListener('click', () => {
        document.getElementById('add-preset-form').classList.toggle('hidden');
    });

    document.getElementById('btn-save-entry').addEventListener('click', async () => {
        const type = document.getElementById('add-type').value;
        const editId = document.getElementById('edit-entry-id').value; // Per la modifica
        let title = document.getElementById('add-title').value.trim();
        const start = document.getElementById('add-start').value;
        const end = document.getElementById('add-end').value;
        const date = document.getElementById('add-date').value;
        const isPrivate = document.getElementById('add-private').checked;

        if (type === 'shift' && !title) title = 'Lavoro';
        if (type === 'note' && !title) return alert("Inserisci il testo della nota.");
        if (type !== 'note' && (!start || (type==='shift' && !end))) return alert("Compila orario di inizio e fine.");

        try {
            const payload = {
                type, title, 
                startTime: type === 'note' ? '' : start, 
                endTime: type === 'note' ? '' : end, 
                date, isPrivate
            };

            if (editId) {
                // MODIFICA voce esistente
                await updateDoc(doc(db, 'calendar_entries', editId), payload);
            } else {
                // CREAZIONE nuova voce
                payload.ownerUid = auth.currentUser.uid;
                await addDoc(collection(db, 'calendar_entries'), payload);
            }
            
            document.getElementById('cal-add-modal').classList.add('hidden');
            document.getElementById('add-title').value = '';
            document.getElementById('add-start').value = '';
            document.getElementById('add-end').value = '';
            document.getElementById('add-private').checked = false;
            document.getElementById('edit-entry-id').value = ''; // Reset

        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btn-save-preset').addEventListener('click', async () => {
        const name = document.getElementById('preset-name').value.trim();
        const start = document.getElementById('preset-start').value;
        const end = document.getElementById('preset-end').value;
        
        if(!name || !start || !end) return alert("Compila tutti i campi del turno.");
        
        try {
            await addDoc(collection(db, 'calendar_presets'), {
                name, startTime: start, endTime: end, ownerUid: auth.currentUser.uid
            });
            document.getElementById('preset-name').value = '';
            document.getElementById('preset-start').value = '';
            document.getElementById('preset-end').value = '';
            document.getElementById('add-preset-form').classList.add('hidden');
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btn-send-share').addEventListener('click', async () => {
        const email = document.getElementById('share-email').value.trim();
        const msgEl = document.getElementById('share-msg');
        if(!email) return;
        
        if (email === auth.currentUser.email) {
            msgEl.innerText = "Non puoi condividerlo con te stesso.";
            msgEl.style.color = "red";
            return;
        }

        try {
            const q = query(collection(db, 'users'), where('email', '==', email));
            const snap = await getDocs(q);
            if (snap.empty) {
                msgEl.innerText = "Utente non trovato o non registrato.";
                msgEl.style.color = "red";
                return;
            }
            
            await addDoc(collection(db, 'calendar_requests'), {
                fromUid: auth.currentUser.uid,
                fromEmail: auth.currentUser.email,
                fromName: myProfile.name,
                toEmail: email,
                status: 'pending'
            });

            msgEl.innerText = "Richiesta inviata con successo!";
            msgEl.style.color = "var(--accent-color)";
            document.getElementById('share-email').value = '';
        } catch (e) {
            console.error(e);
            msgEl.innerText = "Errore durante l'invio della richiesta.";
        }
    });
}
