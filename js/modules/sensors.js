export function init(container) {
    if (!document.getElementById('sensors-module-styles')) {
        const style = document.createElement('style');
        style.id = 'sensors-module-styles';
        style.innerHTML = `
            .sensors-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
            .sensors-title { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-color); }
            
            .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-top: 1rem; }
            .tool-card { background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 12px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: var(--shadow); }
            .tool-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .tool-card .material-symbols-outlined { font-size: 2.5rem; color: var(--accent-color); margin-bottom: 0.8rem; }
            .tool-card p { margin: 0; font-weight: 500; color: var(--text-primary); }

            .tool-view { display: none; flex-direction: column; align-items: center; width: 100%; }
            .tool-view.active { display: flex; }
            
            .tool-header-back { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 1.5rem; cursor: pointer; color: var(--text-secondary); font-weight: bold; }
            .tool-header-back:hover { color: var(--text-primary); }

            /* Stili Livella */
            .level-container { width: 200px; height: 200px; border-radius: 50%; border: 3px solid var(--text-secondary); position: relative; margin: 2rem auto; background: rgba(150,150,150,0.1); display: flex; justify-content: center; align-items: center;}
            .level-center-mark { width: 40px; height: 40px; border-radius: 50%; border: 2px dashed var(--accent-color); position: absolute; }
            .level-bubble { width: 30px; height: 30px; background: #10b981; border-radius: 50%; position: absolute; transition: transform 0.1s ease-out; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
            .level-text { font-family: monospace; font-size: 1.2rem; margin-top: 1rem; text-align: center; }

            /* Stili QR */
            #qr-video { width: 100%; max-width: 400px; border-radius: 12px; background: #000; box-shadow: var(--shadow); }
            .qr-result { margin-top: 1rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; color: #10b981; word-break: break-all; width: 100%; max-width: 400px; text-align: center; display: none; }

            /* Stili Cruscotto (GPS/Audio) */
            .dashboard-value { font-size: 3rem; font-weight: 800; color: var(--text-primary); margin: 1rem 0 0.2rem 0; font-family: monospace; }
            .dashboard-label { font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }
            .dashboard-card { background: var(--surface-color); border: 1px solid rgba(150,150,150,0.2); border-radius: 16px; padding: 2rem; width: 100%; max-width: 300px; text-align: center; margin-bottom: 1rem; box-shadow: var(--shadow); }
            
            .meter-bar-container { width: 100%; height: 20px; background: rgba(150,150,150,0.2); border-radius: 10px; overflow: hidden; margin-top: 1rem; }
            .meter-bar { height: 100%; width: 0%; background: #10b981; transition: width 0.1s, background-color 0.2s; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="module-wrapper" style="display: flex; flex-direction: column; height: 100%;">
            <div class="sensors-header">
                <h2 class="sensors-title">
                    <span class="material-symbols-outlined">sensors</span> Strumenti
                </h2>
            </div>

            <!-- MENU PRINCIPALE SENSORI -->
            <div id="sensors-home" class="tool-grid">
                <div class="tool-card" data-tool="level">
                    <span class="material-symbols-outlined">explore</span>
                    <p>Livella</p>
                </div>
                <div class="tool-card" data-tool="qr">
                    <span class="material-symbols-outlined">qr_code_scanner</span>
                    <p>Scanner QR</p>
                </div>
                <div class="tool-card" data-tool="gps">
                    <span class="material-symbols-outlined">speed</span>
                    <p>Tachimetro</p>
                </div>
                <div class="tool-card" data-tool="noise">
                    <span class="material-symbols-outlined">mic</span>
                    <p>Fonometro</p>
                </div>
            </div>

            <!-- CONTENITORE STRUMENTO ATTIVO -->
            <div id="tool-container" style="flex: 1; padding-bottom: 2rem; display: none; flex-direction: column;">
                <div class="tool-header-back" id="btn-back-tool">
                    <span class="material-symbols-outlined">arrow_back</span> Torna agli Strumenti
                </div>
                <div id="tool-content-area" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <!-- Inject tool html here -->
                </div>
            </div>
        </div>
    `;

    const sensorsHome = container.querySelector('#sensors-home');
    const toolContainer = container.querySelector('#tool-container');
    const toolContentArea = container.querySelector('#tool-content-area');
    const btnBackTool = container.querySelector('#btn-back-tool');

    // Variabili per la pulizia (Cleanup)
    let activeStream = null;
    let activeWatchId = null;
    let audioContext = null;
    let animFrameId = null;

    // --- FUNZIONE DI PULIZIA GLOBALE ---
    function stopAllSensors() {
        // Ferma fotocamera / microfono
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
        }
        // Ferma GPS
        if (activeWatchId !== null) {
            navigator.geolocation.clearWatch(activeWatchId);
            activeWatchId = null;
        }
        // Ferma Livella
        window.removeEventListener('deviceorientation', handleOrientation);
        // Ferma Audio
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        // Ferma loop animazioni
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    // --- NAVIGAZIONE INTERNA ---
    container.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
            const toolName = card.dataset.tool;
            sensorsHome.style.display = 'none';
            toolContainer.style.display = 'flex';
            launchTool(toolName);
        });
    });

    btnBackTool.addEventListener('click', () => {
        stopAllSensors();
        toolContainer.style.display = 'none';
        toolContentArea.innerHTML = '';
        sensorsHome.style.display = 'grid';
    });

    // --- DISPATCHER DEGLI STRUMENTI ---
    function launchTool(toolName) {
        stopAllSensors(); // Sicurezza extra
        toolContentArea.innerHTML = '';

        if (toolName === 'level') initLevelTool();
        else if (toolName === 'qr') initQRTool();
        else if (toolName === 'gps') initGPSTool();
        else if (toolName === 'noise') initNoiseTool();
    }

    // ==========================================
    // 1. LIVELLA (Accelerometro/Giroscopio)
    // ==========================================
    let levelBubble, levelText;
    
    function initLevelTool() {
        toolContentArea.innerHTML = `
            <div style="text-align:center;">
                <h3 style="margin-bottom: 0.5rem;">Livella a bolla</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary);">Appoggia il telefono su una superficie.</p>
                <div class="level-container">
                    <div class="level-center-mark"></div>
                    <div class="level-bubble" id="level-bubble"></div>
                </div>
                <div class="level-text" id="level-text">X: 0° | Y: 0°</div>
                <button id="btn-start-level" class="btn primary" style="margin-top: 1rem;">Avvia Sensore (Richiesto su iOS)</button>
            </div>
        `;
        levelBubble = document.getElementById('level-bubble');
        levelText = document.getElementById('level-text');
        
        const btnStart = document.getElementById('btn-start-level');
        btnStart.addEventListener('click', async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permissionState = await DeviceOrientationEvent.requestPermission();
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                        btnStart.style.display = 'none';
                    } else {
                        alert("Permesso negato per i sensori di movimento.");
                    }
                } catch (e) { console.error(e); }
            } else {
                // Non-iOS 13+ devices
                window.addEventListener('deviceorientation', handleOrientation);
                btnStart.style.display = 'none';
            }
        });

        // Auto-start per Android/PC
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', handleOrientation);
            btnStart.style.display = 'none';
        }
    }

    function handleOrientation(event) {
        if(!levelBubble) return;
        let x = event.gamma || 0; // In degree in the range [-90,90]
        let y = event.beta || 0;  // In degree in the range [-180,180]

        // Fix orientation per quando si appoggia di piatto
        if (x >  90) x =  90;
        if (x < -90) x = -90;

        levelText.innerText = `X: ${Math.round(x)}° | Y: ${Math.round(y)}°`;

        // Calcola lo spostamento della bolla (Max spostamento = 85px dal centro per stare nel cerchio)
        const maxDist = 85; 
        const moveX = (x / 90) * maxDist;
        const moveY = (y / 90) * maxDist;

        levelBubble.style.transform = `translate(${moveX}px, ${moveY}px)`;

        // Feedback visivo (verde quando perfetto)
        if (Math.abs(x) < 2 && Math.abs(y) < 2) {
            levelBubble.style.background = "#10b981"; // Verde
            // Feedback aptico leggero se supportato
            if (navigator.vibrate && Math.abs(x) < 0.5 && Math.abs(y) < 0.5) navigator.vibrate(50);
        } else {
            levelBubble.style.background = "#ef4444"; // Rosso
        }
    }

    // ==========================================
    // 2. SCANNER QR (Fotocamera + BarcodeDetector)
    // ==========================================
    function initQRTool() {
        toolContentArea.innerHTML = `
            <div style="text-align:center; width:100%; display:flex; flex-direction:column; align-items:center;">
                <h3 style="margin-bottom: 0.5rem;">Scanner QR</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 1rem;">Inquadra un codice a barre o QR Code.</p>
                
                <video id="qr-video" autoplay playsinline></video>
                <div id="qr-result" class="qr-result"></div>
                <button id="btn-copy-qr" class="btn secondary outline hidden" style="margin-top: 10px;">Copia Risultato</button>
                <p id="qr-error" class="error-msg" style="margin-top: 10px;"></p>
            </div>
        `;
        
        const video = document.getElementById('qr-video');
        const resBox = document.getElementById('qr-result');
        const errBox = document.getElementById('qr-error');
        const btnCopy = document.getElementById('btn-copy-qr');

        // Controllo supporto API NATIVA (Shape Detection API)
        if (!('BarcodeDetector' in window)) {
            errBox.innerText = "Il tuo browser non supporta la lettura nativa dei QR Code (BarcodeDetector API). Usa Chrome su Android per questa funzione.";
            video.style.display = 'none';
            return;
        }

        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128'] });

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                activeStream = stream;
                video.srcObject = stream;
                video.play();
                requestAnimationFrame(scanCode);
            })
            .catch(err => {
                errBox.innerText = "Impossibile accedere alla fotocamera. Controlla i permessi.";
            });

        function scanCode() {
            if (!activeStream) return;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                barcodeDetector.detect(video).then(barcodes => {
                    if (barcodes.length > 0) {
                        const code = barcodes[0].rawValue;
                        resBox.style.display = 'block';
                        resBox.innerText = code;
                        btnCopy.classList.remove('hidden');
                        
                        btnCopy.onclick = () => {
                            navigator.clipboard.writeText(code);
                            btnCopy.innerText = "Copiato!";
                            setTimeout(() => btnCopy.innerText = "Copia Risultato", 2000);
                        };
                        
                        // Ferma lo scanner dopo aver trovato il codice per risparmiare batteria
                        if (activeStream) {
                            activeStream.getTracks().forEach(t => t.stop());
                            activeStream = null;
                        }
                        return; // Esce dal loop
                    }
                    animFrameId = requestAnimationFrame(scanCode);
                }).catch(err => {
                    console.error("Errore detection:", err);
                    animFrameId = requestAnimationFrame(scanCode);
                });
            } else {
                animFrameId = requestAnimationFrame(scanCode);
            }
        }
    }

    // ==========================================
    // 3. TACHIMETRO (GPS Geolocation)
    // ==========================================
    function initGPSTool() {
        toolContentArea.innerHTML = `
            <div style="text-align:center; width: 100%; display: flex; flex-direction: column; align-items: center;">
                <h3 style="margin-bottom: 1.5rem;">Dati Satellitari</h3>
                
                <div class="dashboard-card">
                    <div class="dashboard-label">Velocità</div>
                    <div class="dashboard-value" id="gps-speed">0.0</div>
                    <div style="color:var(--text-secondary); font-weight:bold;">km/h</div>
                </div>

                <div class="dashboard-card" style="padding: 1rem;">
                    <div class="dashboard-label">Altitudine</div>
                    <div class="dashboard-value" style="font-size: 2rem;" id="gps-alt">--</div>
                    <div style="color:var(--text-secondary);">metri (slm)</div>
                </div>
                
                <p id="gps-status" style="font-size:0.85rem; color:var(--text-secondary); margin-top: 1rem;">In attesa di segnale GPS...</p>
            </div>
        `;

        const speedEl = document.getElementById('gps-speed');
        const altEl = document.getElementById('gps-alt');
        const statusEl = document.getElementById('gps-status');

        if (!navigator.geolocation) {
            statusEl.innerText = "Il tuo browser non supporta il GPS.";
            statusEl.style.color = "#ef4444";
            return;
        }

        activeWatchId = navigator.geolocation.watchPosition(
            (position) => {
                statusEl.innerText = `Segnale Ricevuto (Accuratezza: ±${Math.round(position.coords.accuracy)}m)`;
                statusEl.style.color = "#10b981";

                // Velocità (da m/s a km/h)
                const speedMpS = position.coords.speed || 0;
                const speedKmH = (speedMpS * 3.6).toFixed(1);
                speedEl.innerText = speedKmH;

                // Altitudine
                const alt = position.coords.altitude;
                altEl.innerText = alt !== null ? Math.round(alt) : "--";
            },
            (error) => {
                statusEl.style.color = "#ef4444";
                switch(error.code) {
                    case error.PERMISSION_DENIED: statusEl.innerText = "Permesso GPS negato."; break;
                    case error.POSITION_UNAVAILABLE: statusEl.innerText = "Posizione non disponibile."; break;
                    case error.TIMEOUT: statusEl.innerText = "Timeout richiesta GPS."; break;
                    default: statusEl.innerText = "Errore GPS sconosciuto."; break;
                }
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }

    // ==========================================
    // 4. FONOMETRO (Microfono Web Audio)
    // ==========================================
    function initNoiseTool() {
        toolContentArea.innerHTML = `
            <div style="text-align:center; width: 100%; display: flex; flex-direction: column; align-items: center;">
                <h3 style="margin-bottom: 0.5rem;">Misuratore Decibel</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 1.5rem;">Stima del rumore ambientale.</p>
                
                <div class="dashboard-card">
                    <div class="dashboard-label">Livello Rumore</div>
                    <div class="dashboard-value" id="noise-db">0</div>
                    <div style="color:var(--text-secondary); font-weight:bold;">dB</div>
                    
                    <div class="meter-bar-container">
                        <div class="meter-bar" id="noise-bar"></div>
                    </div>
                </div>

                <button id="btn-start-audio" class="btn primary">Consenti Microfono</button>
                <p id="audio-error" class="error-msg" style="margin-top: 1rem;"></p>
            </div>
        `;

        const dbEl = document.getElementById('noise-db');
        const barEl = document.getElementById('noise-bar');
        const errEl = document.getElementById('audio-error');
        const btnStart = document.getElementById('btn-start-audio');

        btnStart.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                activeStream = stream;
                btnStart.style.display = 'none';

                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                
                analyser.fftSize = 512;
                source.connect(analyser);
                
                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                function drawAudio() {
                    if (!audioContext) return;
                    animFrameId = requestAnimationFrame(drawAudio);
                    
                    analyser.getByteFrequencyData(dataArray);
                    
                    // Calcolo media dei volumi per stimare i dB
                    let sum = 0;
                    for(let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    
                    // Mappatura approssimativa: 0 = 30dB (silenzio), 255 = 100dB (rumore forte)
                    let decibels = Math.round(30 + (average / 255) * 70);
                    if (average === 0) decibels = 0;
                    
                    dbEl.innerText = decibels;
                    
                    // Barra
                    let percentage = (decibels / 100) * 100;
                    if(percentage > 100) percentage = 100;
                    barEl.style.width = percentage + "%";

                    // Colore barra
                    if(decibels < 50) barEl.style.background = "#10b981"; // Verde
                    else if(decibels < 75) barEl.style.background = "#f59e0b"; // Arancio
                    else barEl.style.background = "#ef4444"; // Rosso
                }

                drawAudio();
            } catch (err) {
                errEl.innerText = "Impossibile accedere al microfono.";
            }
        });
    }

    // --- CLEANUP GLOBALE QUANDO SI CHIUDE IL MODULO ---
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            stopAllSensors();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
