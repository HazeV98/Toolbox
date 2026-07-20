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

            /* --- Stili Livella --- */
            .level-modes { display: flex; gap: 10px; margin-bottom: 2rem; background: rgba(150,150,150,0.1); padding: 5px; border-radius: 30px; }
            .level-mode-btn { background: transparent; border: none; padding: 8px 16px; border-radius: 20px; color: var(--text-secondary); cursor: pointer; font-weight: bold; transition: 0.2s; }
            .level-mode-btn.active { background: var(--surface-color); color: var(--text-primary); box-shadow: var(--shadow); }
            
            /* Piatta */
            .level-container { width: 200px; height: 200px; border-radius: 50%; border: 3px solid var(--text-secondary); position: relative; margin: 0 auto; background: rgba(150,150,150,0.1); display: flex; justify-content: center; align-items: center;}
            .level-center-mark { width: 40px; height: 40px; border-radius: 50%; border: 2px dashed var(--accent-color); position: absolute; }
            .level-bubble { width: 30px; height: 30px; background: #10b981; border-radius: 50%; position: absolute; transition: transform 0.1s ease-out; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
            /* Tubi (Vert/Orizz) */
            .level-tube-h { width: 250px; height: 60px; border-radius: 30px; border: 3px solid var(--text-secondary); position: relative; margin: 4rem auto; background: rgba(150,150,150,0.1); display: flex; justify-content: center; align-items: center; overflow: hidden;}
            .level-tube-v { width: 60px; height: 250px; border-radius: 30px; border: 3px solid var(--text-secondary); position: relative; margin: 1rem auto; background: rgba(150,150,150,0.1); display: flex; justify-content: center; align-items: center; overflow: hidden;}
            .level-center-line-v { height: 100%; width: 4px; background: rgba(255,255,255,0.3); position: absolute; }
            .level-center-line-h { width: 100%; height: 4px; background: rgba(255,255,255,0.3); position: absolute; }
            .level-center-marks-h { height: 100%; width: 40px; border-left: 2px solid var(--accent-color); border-right: 2px solid var(--accent-color); position: absolute; }
            .level-center-marks-v { width: 100%; height: 40px; border-top: 2px solid var(--accent-color); border-bottom: 2px solid var(--accent-color); position: absolute; }
            
            .level-text { font-family: monospace; font-size: 1.5rem; margin-top: 1rem; text-align: center; font-weight: bold;}

            /* --- Stili Bussola --- */
            .compass-container { width: 250px; height: 250px; border-radius: 50%; border: 4px solid var(--text-secondary); position: relative; margin: 2rem auto; display: flex; justify-content: center; align-items: center; background: var(--surface-color); box-shadow: var(--shadow); }
            .compass-dial { width: 100%; height: 100%; position: absolute; border-radius: 50%; transition: transform 0.1s ease-out; display: flex; justify-content: center; align-items: center;}
            .compass-mark { position: absolute; font-weight: bold; font-size: 1.2rem; }
            .compass-mark.n { top: 10px; color: #ef4444; font-size: 1.5rem; }
            .compass-mark.s { bottom: 10px; color: var(--text-primary); }
            .compass-mark.e { right: 15px; color: var(--text-primary); }
            .compass-mark.w { left: 15px; color: var(--text-primary); }
            .compass-arrow { width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-bottom: 80px solid #ef4444; position: absolute; top: 30px; }
            .compass-arrow-bg { width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-top: 80px solid var(--text-secondary); position: absolute; bottom: 30px; }
            .compass-center { width: 16px; height: 16px; background: var(--accent-color); border-radius: 50%; position: absolute; z-index: 10;}
            
            /* --- Stili Righello --- */
            .ruler-wrapper { width: 100%; background: var(--surface-color); border-radius: 8px; border: 1px solid rgba(150,150,150,0.2); margin-top: 1rem; overflow: hidden; position: relative; }
            .ruler-ticks { display: flex; height: 60px; border-bottom: 2px solid var(--text-primary); }
            .ruler-tick { border-left: 1px solid var(--text-primary); position: relative; }
            .ruler-tick.cm { height: 100%; }
            .ruler-tick.mm { height: 30%; border-left: 1px solid var(--text-secondary); }
            .ruler-tick.mm5 { height: 50%; }
            .ruler-number { position: absolute; bottom: 2px; left: 2px; font-size: 0.7rem; color: var(--text-primary); }

            /* --- Stili QR --- */
            #qr-video { width: 100%; max-width: 400px; border-radius: 12px; background: #000; box-shadow: var(--shadow); }
            .qr-result { margin-top: 1rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; color: #10b981; word-break: break-all; width: 100%; max-width: 400px; text-align: center; display: none; }

            /* --- Stili Cruscotto (GPS/Audio) --- */
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
                <div class="tool-card" data-tool="compass">
                    <span class="material-symbols-outlined">assistant_navigation</span>
                    <p>Bussola</p>
                </div>
                <div class="tool-card" data-tool="ruler">
                    <span class="material-symbols-outlined">straighten</span>
                    <p>Righello</p>
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
    let orientationListener = null;
    let compassListener = null;

    // --- FUNZIONE DI PULIZIA GLOBALE ---
    function stopAllSensors() {
        if (activeStream) { activeStream.getTracks().forEach(track => track.stop()); activeStream = null; }
        if (activeWatchId !== null) { navigator.geolocation.clearWatch(activeWatchId); activeWatchId = null; }
        if (orientationListener) { window.removeEventListener('deviceorientation', orientationListener); orientationListener = null; }
        if (compassListener) { 
            window.removeEventListener('deviceorientationabsolute', compassListener); 
            window.removeEventListener('deviceorientation', compassListener); 
            compassListener = null; 
        }
        if (audioContext) { audioContext.close(); audioContext = null; }
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        
        // Sblocca rotazione schermo
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
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
        stopAllSensors(); 
        toolContentArea.innerHTML = '';

        if (toolName === 'level') initLevelTool();
        else if (toolName === 'compass') initCompassTool();
        else if (toolName === 'ruler') initRulerTool();
        else if (toolName === 'qr') initQRTool();
        else if (toolName === 'gps') initGPSTool();
        else if (toolName === 'noise') initNoiseTool();
    }

    // ==========================================
    // 1. LIVELLA (Piatta, Orizzontale, Verticale)
    // ==========================================
    function initLevelTool() {
        // Tenta di bloccare la rotazione nativa (funziona soprattutto se in PWA fullscreen)
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(()=>{}); } catch(e) {}

        let currentMode = 'flat';

        toolContentArea.innerHTML = `
            <div style="text-align:center; width: 100%;">
                <div class="level-modes">
                    <button class="level-mode-btn active" data-mode="flat">Piatta</button>
                    <button class="level-mode-btn" data-mode="horiz">Orizzontale</button>
                    <button class="level-mode-btn" data-mode="vert">Verticale</button>
                </div>
                
                <div id="level-graphics-container"></div>
                <div class="level-text" id="level-text">0.0°</div>
                
                <button id="btn-start-level" class="btn primary" style="margin-top: 2rem;">Avvia Sensori (Richiesto su iOS)</button>
            </div>
        `;

        const graphicsContainer = document.getElementById('level-graphics-container');
        const levelText = document.getElementById('level-text');
        const btnStart = document.getElementById('btn-start-level');
        const modeBtns = document.querySelectorAll('.level-mode-btn');

        function renderGraphics() {
            if (currentMode === 'flat') {
                graphicsContainer.innerHTML = `
                    <div class="level-container">
                        <div class="level-center-mark"></div>
                        <div class="level-bubble" id="level-bubble"></div>
                    </div>`;
            } else if (currentMode === 'horiz') {
                graphicsContainer.innerHTML = `
                    <div class="level-tube-h">
                        <div class="level-center-line-h"></div>
                        <div class="level-center-marks-h"></div>
                        <div class="level-bubble" id="level-bubble"></div>
                    </div>`;
            } else if (currentMode === 'vert') {
                graphicsContainer.innerHTML = `
                    <div class="level-tube-v">
                        <div class="level-center-line-v"></div>
                        <div class="level-center-marks-v"></div>
                        <div class="level-bubble" id="level-bubble"></div>
                    </div>`;
            }
        }

        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                modeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentMode = e.target.dataset.mode;
                renderGraphics();
            });
        });

        renderGraphics(); // Primo render

        orientationListener = (event) => {
            const bubble = document.getElementById('level-bubble');
            if(!bubble) return;

            let x = event.gamma || 0; // [-90,90]  Inclinazione Sx/Dx
            let y = event.beta || 0;  // [-180,180] Inclinazione Su/Giu

            // Fix per tenere l'angolo stabile
            if (x > 90) x = 90; if (x < -90) x = -90;

            let angleDisp = "";
            let inPlane = false;

            if (currentMode === 'flat') {
                angleDisp = `X: ${Math.round(x)}° | Y: ${Math.round(y)}°`;
                const maxDist = 85; 
                const moveX = (x / 90) * maxDist;
                const moveY = (y / 90) * maxDist;
                bubble.style.transform = `translate(${moveX}px, ${moveY}px)`;
                if (Math.abs(x) < 2 && Math.abs(y) < 2) inPlane = true;
            } 
            else if (currentMode === 'horiz') {
                // Il telefono è poggiato sul lato lungo. Interessa l'angolo Y (o se piatto X)
                // Usiamo un calcolo approssimativo per l'uso "a parete"
                let tilt = y; 
                angleDisp = `${Math.abs(Math.round(tilt))}°`;
                const maxDist = 110;
                let moveX = (tilt / 45) * maxDist;
                if (moveX > maxDist) moveX = maxDist; if (moveX < -maxDist) moveX = -maxDist;
                bubble.style.transform = `translateX(${moveX}px)`;
                if (Math.abs(tilt) < 1.5) inPlane = true;
            }
            else if (currentMode === 'vert') {
                // Il telefono è poggiato sul lato corto. Interessa X
                let tilt = x;
                angleDisp = `${Math.abs(Math.round(tilt))}°`;
                const maxDist = 110;
                let moveY = (tilt / 45) * maxDist;
                if (moveY > maxDist) moveY = maxDist; if (moveY < -maxDist) moveY = -maxDist;
                bubble.style.transform = `translateY(${moveY}px)`;
                if (Math.abs(tilt) < 1.5) inPlane = true;
            }

            levelText.innerText = angleDisp;
            if (inPlane) {
                bubble.style.background = "#10b981";
                if (navigator.vibrate) navigator.vibrate(50); // Feedback aptico
            } else {
                bubble.style.background = "#ef4444";
            }
        };

        btnStart.addEventListener('click', async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', orientationListener);
                        btnStart.style.display = 'none';
                    } else alert("Permesso negato.");
                } catch (e) { console.error(e); }
            } else {
                window.addEventListener('deviceorientation', orientationListener);
                btnStart.style.display = 'none';
            }
        });

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', orientationListener);
            btnStart.style.display = 'none';
        }
    }

    // ==========================================
    // 2. BUSSOLA (Magnetometro)
    // ==========================================
    function initCompassTool() {
        toolContentArea.innerHTML = `
            <div style="text-align:center; width: 100%;">
                <h3 style="margin-bottom: 0.5rem;">Bussola</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary);">Tieni il telefono piatto e lontano da calamite.</p>
                
                <div class="compass-container">
                    <div class="compass-dial" id="compass-dial">
                        <div class="compass-mark n">N</div>
                        <div class="compass-mark s">S</div>
                        <div class="compass-mark e">E</div>
                        <div class="compass-mark w">O</div>
                        <div class="compass-arrow"></div>
                        <div class="compass-arrow-bg"></div>
                        <div class="compass-center"></div>
                    </div>
                </div>
                <div class="dashboard-value" id="compass-deg" style="margin-top:2rem;">0°</div>
                
                <button id="btn-start-compass" class="btn primary" style="margin-top: 1rem;">Avvia Sensore</button>
            </div>
        `;

        const dial = document.getElementById('compass-dial');
        const degText = document.getElementById('compass-deg');
        const btnStart = document.getElementById('btn-start-compass');

        compassListener = (event) => {
            let heading = null;

            // iOS compass
            if (event.webkitCompassHeading) {
                heading = event.webkitCompassHeading;
            } 
            // Android compass
            else if (event.alpha !== null) {
                // Per Android, alpha è l'angolo. Spesso richiede 'deviceorientationabsolute'
                heading = 360 - event.alpha; 
            }

            if (heading !== null) {
                const roundedHeading = Math.round(heading);
                degText.innerText = `${roundedHeading}°`;
                dial.style.transform = `rotate(${-heading}deg)`;
            }
        };

        btnStart.addEventListener('click', async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', compassListener);
                        btnStart.style.display = 'none';
                    }
                } catch (e) { console.error(e); }
            } else {
                // Su Android cerchiamo i valori assoluti rispetto al nord
                window.addEventListener('deviceorientationabsolute', compassListener);
                // Fallback standard
                window.addEventListener('deviceorientation', compassListener);
                btnStart.style.display = 'none';
            }
        });

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientationabsolute', compassListener);
            window.addEventListener('deviceorientation', compassListener);
            btnStart.style.display = 'none';
        }
    }

    // ==========================================
    // 3. RIGHELLO (CSS Dinamico + Calibrazione)
    // ==========================================
    function initRulerTool() {
        toolContentArea.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
                <h3 style="margin-bottom: 0.5rem; width:100%; text-align:left;">Righello</h3>
                
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:10px;">
                    <div style="background:var(--surface-color); padding: 5px; border-radius:8px; display:flex; gap:5px; border:1px solid rgba(150,150,150,0.2);">
                        <button class="btn-ruler-unit active" data-unit="cm" style="border:none; background:var(--accent-color); color:white; padding:4px 10px; border-radius:6px; cursor:pointer;">CM</button>
                        <button class="btn-ruler-unit" data-unit="in" style="border:none; background:transparent; color:var(--text-primary); padding:4px 10px; border-radius:6px; cursor:pointer;">INCH</button>
                    </div>
                </div>

                <div class="ruler-wrapper">
                    <div class="ruler-ticks" id="ruler-canvas" style="transform-origin: left top; transition: transform 0.1s;"></div>
                </div>
                
                <!-- Strumento di Calibrazione -->
                <div style="width:100%; background:var(--surface-color); padding:1rem; border-radius:12px; margin-top:2rem; border:1px solid rgba(150,150,150,0.2);">
                    <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--accent-color);">Calibrazione Precisa</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:15px;">Le dimensioni degli schermi variano. Appoggia una moneta o una carta sul telefono e usa lo slider per far combaciare i segni.</p>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">remove</span>
                        <input type="range" id="ruler-scale" min="0.5" max="1.5" step="0.01" value="1" style="flex:1; accent-color:var(--accent-color);">
                        <span class="material-symbols-outlined" style="font-size:18px;">add</span>
                    </div>
                    <div style="text-align:center; margin-top:10px; font-size:0.8rem; font-family:monospace;" id="ruler-scale-val">Scala: 1.00x</div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('ruler-canvas');
        const unitBtns = document.querySelectorAll('.btn-ruler-unit');
        const slider = document.getElementById('ruler-scale');
        const sliderVal = document.getElementById('ruler-scale-val');
        
        let currentUnit = 'cm';
        // Costanti CSS. In CSS standard 1cm = 37.8px. 1inch = 96px.
        const CM_PX = 37.795275;
        const IN_PX = 96;

        function drawRuler() {
            canvas.innerHTML = '';
            // Disegnamo un righello abbastanza lungo (es. 30 unità), il contenitore lo taglierà
            const length = 30; 
            const pxPerUnit = currentUnit === 'cm' ? CM_PX : IN_PX;
            const subdivisions = currentUnit === 'cm' ? 10 : 8; // Millimetri vs ottavi di pollice

            for (let i = 0; i < length; i++) {
                // Contenitore per un'unità intera
                const unitBlock = document.createElement('div');
                unitBlock.style.width = `${pxPerUnit}px`;
                unitBlock.style.display = 'flex';
                unitBlock.style.position = 'relative';

                // Etichetta del numero (non sul primo tick per pulizia)
                if (i > 0) {
                    const num = document.createElement('div');
                    num.className = 'ruler-number';
                    num.innerText = i;
                    unitBlock.appendChild(num);
                }

                // Generazione dei sottomultipli (tacche piccole)
                const pxPerSub = pxPerUnit / subdivisions;
                for (let j = 0; j < subdivisions; j++) {
                    const tick = document.createElement('div');
                    tick.className = 'ruler-tick';
                    tick.style.width = `${pxPerSub}px`;
                    
                    if (j === 0) tick.classList.add('cm'); // Tacca lunga principale
                    else if (currentUnit === 'cm' && j === 5) tick.classList.add('mm5'); // Tacca media (5mm)
                    else if (currentUnit === 'in' && j === 4) tick.classList.add('mm5'); // Tacca media (mezzo pollice)
                    else tick.classList.add('mm'); // Tacca corta

                    unitBlock.appendChild(tick);
                }
                canvas.appendChild(unitBlock);
            }
        }

        unitBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                unitBtns.forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--text-primary)'; });
                e.target.style.background = 'var(--accent-color)';
                e.target.style.color = 'white';
                currentUnit = e.target.dataset.unit;
                drawRuler();
            });
        });

        // Gestione calibrazione visiva tramite CSS Transform Scale
        slider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            canvas.style.transform = `scaleX(${scale})`;
            sliderVal.innerText = `Scala: ${scale.toFixed(2)}x`;
        });

        drawRuler();
    }

    // ==========================================
    // 4. SCANNER QR
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

        if (!('BarcodeDetector' in window)) {
            errBox.innerText = "Il tuo browser non supporta la lettura nativa dei QR (BarcodeDetector API).";
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
                        
                        if (activeStream) {
                            activeStream.getTracks().forEach(t => t.stop());
                            activeStream = null;
                        }
                        return;
                    }
                    animFrameId = requestAnimationFrame(scanCode);
                }).catch(err => {
                    animFrameId = requestAnimationFrame(scanCode);
                });
            } else {
                animFrameId = requestAnimationFrame(scanCode);
            }
        }
    }

    // ==========================================
    // 5. TACHIMETRO E GPS
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

                const speedMpS = position.coords.speed || 0;
                speedEl.innerText = (speedMpS * 3.6).toFixed(1);

                const alt = position.coords.altitude;
                altEl.innerText = alt !== null ? Math.round(alt) : "--";
            },
            (error) => {
                statusEl.style.color = "#ef4444";
                switch(error.code) {
                    case error.PERMISSION_DENIED: statusEl.innerText = "Permesso GPS negato."; break;
                    case error.POSITION_UNAVAILABLE: statusEl.innerText = "Posizione non disponibile."; break;
                    case error.TIMEOUT: statusEl.innerText = "Timeout richiesta GPS."; break;
                }
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }

    // ==========================================
    // 6. FONOMETRO
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
                    
                    let sum = 0;
                    for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const average = sum / dataArray.length;
                    
                    let decibels = Math.round(30 + (average / 255) * 70);
                    if (average === 0) decibels = 0;
                    
                    dbEl.innerText = decibels;
                    
                    let percentage = (decibels / 100) * 100;
                    if(percentage > 100) percentage = 100;
                    barEl.style.width = percentage + "%";

                    if(decibels < 50) barEl.style.background = "#10b981";
                    else if(decibels < 75) barEl.style.background = "#f59e0b";
                    else barEl.style.background = "#ef4444";
                }

                drawAudio();
            } catch (err) {
                errEl.innerText = "Impossibile accedere al microfono.";
            }
        });
    }

    // --- CLEANUP GLOBALE ---
    const observer = new MutationObserver(() => {
        if (!document.body.contains(container)) {
            stopAllSensors();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
