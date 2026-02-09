const rainCanvas = document.getElementById("rainCanvas");
const rainCtx = rainCanvas.getContext("2d");
const mainCanvas = document.getElementById("mainCanvas");
const mainCtx = mainCanvas.getContext("2d");
const audio = document.getElementById("audio");
const eqContainer = document.getElementById("eq");

let colorMain = "#a855f7";
let pulse = 0, flashEffect = 0;
let items = [];
let currentScore = 0;
let isStarted = false;

// Audio Context Web Audio API
let audioCtx;
let analyser;
let dataArray;
let source;

/* --- AUDIO CONTEXT SETUP --- */
function initAudioContext() {
    if (audioCtx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();

    // Connect audio element source
    try {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    } catch (e) {
        console.warn("MediaElementSource already connected or error:", e);
    }

    analyser.fftSize = 64; // Small size for retro blocky look (32 data points)
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}


/* --- INTRO SCREEN LOGIC --- */
// Ensure it starts visible
introScreen.style.opacity = "1";
introScreen.style.display = "flex";

introScreen.addEventListener('click', function (e) {
    if (isStarted) return;

    const rect = this.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Create burn sound effect
    if (audioCtx) {
        // Crackling fire sound using noise and filters
        const duration = 3;
        const now = audioCtx.currentTime;

        // Create noise buffer for crackling
        const bufferSize = audioCtx.sampleRate * duration;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;

        // Low-pass filter for muffled crackling
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        // Gain envelope for realistic fade
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.08, now + 1.5);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        noise.start(now);
        noise.stop(now + duration);
    }

    // Create fire cracks spreading from click point (more visible)
    const numCracks = 25;
    for (let i = 0; i < numCracks; i++) {
        setTimeout(() => {
            const crack = document.createElement('div');
            crack.className = 'fire-crack';
            const angle = (Math.PI * 2 * i) / numCracks;
            const distance = 40 + Math.random() * 120;
            crack.style.left = `${clickX + Math.cos(angle) * distance}px`;
            crack.style.top = `${clickY + Math.sin(angle) * distance}px`;
            crack.style.transform = `rotate(${angle}rad)`;
            crack.style.setProperty('--fire-y', `${-100 - Math.random() * 80}px`);
            document.body.appendChild(crack);
            setTimeout(() => crack.remove(), 2500);
        }, i * 100);
    }

    // Create smoke particles (more and bigger)
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const smoke = document.createElement('div');
            smoke.className = 'smoke-particle';
            smoke.style.left = `${clickX + (Math.random() - 0.5) * 150}px`;
            smoke.style.top = `${clickY + (Math.random() - 0.5) * 80}px`;
            smoke.style.setProperty('--smoke-x', `${(Math.random() - 0.5) * 120}px`);
            document.body.appendChild(smoke);
            setTimeout(() => smoke.remove(), 4000);
        }, i * 180);
    }

    // Create falling ash (more particles)
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const ash = document.createElement('div');
            ash.className = 'ash-particle';
            ash.style.left = `${clickX + (Math.random() - 0.5) * 250}px`;
            ash.style.top = `${clickY + (Math.random() - 0.5) * 120}px`;
            ash.style.setProperty('--ash-x', `${(Math.random() - 0.5) * 180}px`);
            ash.style.setProperty('--ash-y', `${250 + Math.random() * 250}px`);
            document.body.appendChild(ash);
            setTimeout(() => ash.remove(), 5000);
        }, i * 70);
    }

    // Wait for fire to mostly complete (2.5s), THEN fade paper
    setTimeout(() => {
        this.classList.add('burning');

        // After paper fades, start app
        setTimeout(() => {
            this.style.display = 'none';

            isStarted = true;
            initAudioContext();
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            audio.play().catch(e => console.log('Play error:', e));
        }, 1500); // Paper fade duration
    }, 2500); // Wait for fire animation to mostly complete
});

/* --- SWIPE ENGINE --- */
/* --- GESTOS E INTERACCIÓN ---
   (Handled by Unified Pointer Event above)
*/
const gameArea = document.getElementById("game-area");

// Unified Pointer Event (Mouse & Touch)
gameArea.addEventListener('pointerdown', (e) => {
    // Prevent default to stop scrolling/mouse emulation on touch
    e.preventDefault();

    // Get coordinates relative to canvas
    const rect = rainCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Visual Tap Debug (Small ripple)
    createTapRipple(e.clientX, e.clientY);

    // Handle Game Logic
    handleTap(x, y);
});

gameArea.addEventListener('pointerup', (e) => {
    // Swipe Logic End
    let diffX = e.clientX - touchStartX;
    let diffY = e.clientY - touchStartY;

    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
        nextSong();
        // Visual Feedback for Swipe
        const badge = document.getElementById("era-badge");
        const prevText = badge.innerText;
        badge.innerText = diffX > 0 ? "PREV" : "NEXT";
        badge.classList.remove("opacity-0");
        setTimeout(() => {
            if (badge.innerText === "PREV" || badge.innerText === "NEXT") {
                badge.innerText = prevText;
                if (audio.paused) badge.classList.add("opacity-0");
            }
        }, 500);
    }
});

function createTapRipple(x, y) {
    const ripple = document.createElement("div");
    ripple.className = "absolute rounded-full border border-white/50 pointer-events-none animate-ping";
    ripple.style.left = `${x - 10}px`;
    ripple.style.top = `${y - 10}px`;
    ripple.style.width = "20px";
    ripple.style.height = "20px";
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}
/* --- SCORE LOGIC --- */
let bestScore = localStorage.getItem("999_best_score") || 0;
document.getElementById("best-val").innerText = bestScore.toString().padStart(6, '0');

function addScore(pts) {
    currentScore += pts;
    document.getElementById("score-val").innerText = currentScore.toString().padStart(6, '0');
    if (currentScore > bestScore) {
        bestScore = currentScore;
        localStorage.setItem("999_best_score", bestScore);
        document.getElementById("best-val").innerText = bestScore.toString().padStart(6, '0');
    }
}
// Score over time when playing
setInterval(() => { if (!audio.paused) addScore(1); }, 1000);

/* --- LLUVIA ENGINE OPTIMIZED --- */
function resize() {
    const container = document.getElementById("game-area");
    // Match resolution to display size for sharpness without over-rendering
    const dpr = window.devicePixelRatio || 1;
    rainCanvas.width = container.clientWidth * dpr;
    rainCanvas.height = container.clientHeight * dpr;
    rainCtx.scale(dpr, dpr);
}
window.addEventListener('resize', resize);
resize();

// Pre-render rare items to avoid complex path drawing every frame
const cannabisCanvas = document.createElement('canvas');
const juiceCanvas = document.createElement('canvas');
const cupCanvas = document.createElement('canvas');
const pillCanvas = document.createElement('canvas');

function preRenderItems() {
    [cannabisCanvas, juiceCanvas, cupCanvas, pillCanvas].forEach(c => { c.width = 60; c.height = 60; });

    // 1. Cannabis Leaf
    const ctx1 = cannabisCanvas.getContext('2d');
    ctx1.fillStyle = "#4ade80"; // Bright Green
    ctx1.beginPath();
    ctx1.moveTo(30, 5);
    ctx1.bezierCurveTo(30, 5, 35, 20, 50, 20); ctx1.bezierCurveTo(40, 25, 35, 30, 30, 50);
    ctx1.bezierCurveTo(25, 30, 20, 25, 10, 20); ctx1.bezierCurveTo(25, 20, 30, 5, 30, 5);
    ctx1.fill(); ctx1.shadowBlur = 10; ctx1.shadowColor = "#4ade80";

    // 2. Juice Icon (Stylized 999 drop)
    const ctx2 = juiceCanvas.getContext('2d');
    ctx2.fillStyle = "#a855f7"; // Purple
    ctx2.beginPath(); ctx2.arc(30, 30, 15, 0, Math.PI * 2); ctx2.fill();
    ctx2.fillStyle = "#fff"; ctx2.font = "bold 10px Arial"; ctx2.fillText("999", 22, 33);
    ctx2.shadowBlur = 15; ctx2.shadowColor = "#a855f7";

    // 3. Cup
    const ctx3 = cupCanvas.getContext('2d');
    ctx3.translate(30, 30);
    ctx3.fillStyle = "#fff"; ctx3.beginPath(); ctx3.moveTo(-10, -15); ctx3.lineTo(10, -15); ctx3.lineTo(7, 15); ctx3.lineTo(-7, 15); ctx3.fill();
    ctx3.fillStyle = "#a855f7"; ctx3.fillRect(-8, -12, 16, 6);

    // 4. Pill
    const ctx4 = pillCanvas.getContext('2d');
    ctx4.translate(30, 30);
    ctx4.fillStyle = "#3b82f6"; ctx4.beginPath(); ctx4.roundRect(-10, -5, 20, 10, 5); ctx4.fill();
    ctx4.fillStyle = "rgba(255,255,255,0.4)"; ctx4.fillRect(0, -5, 10, 10);
}
preRenderItems(); // Run once

class RainItem {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * (rainCanvas.width / (window.devicePixelRatio || 1));
        this.y = -60;
        this.speed = 2 + Math.random() * 3;
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
        this.dying = false;
        this.opacity = 1;
        this.scale = 0.8 + Math.random() * 0.4;

        // Weighted Randomness "AI"
        const rand = Math.random();
        if (rand > 0.98) { this.type = 'juice'; this.value = 999; this.img = juiceCanvas; }      // 2% - JACKPOT
        else if (rand > 0.95) { this.type = 'cannabis'; this.value = 420; this.img = cannabisCanvas; } // 3% - RARE
        else if (rand > 0.60) { this.type = 'cup'; this.value = 100; this.img = cupCanvas; }      // 35% - UNCOMMON
        else { this.type = 'pill'; this.value = 50; this.img = pillCanvas; }                      // 60% - COMMON
    }

    draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.opacity;
        ctx.drawImage(this.img, -30, -30); // Center the pre-rendered image
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        this.angle += this.rotSpeed;

        if (this.dying) {
            this.opacity -= 0.15; // Faster fade
            this.scale += 0.15;   // Visible POP
        }
        else {
            if (this.scale < 1.0) this.scale += 0.02; // Grow in effect
        }

        // Reset if off screen (Object Pooling - Reuse instance)
        if (this.y > (rainCanvas.height / (window.devicePixelRatio || 1)) + 100 || this.opacity <= 0) {
            this.reset();
        }
    }
}

// Object Pool: Fixed number of items to prevent garbage collection spikes
const MAX_ITEMS = 25;
for (let i = 0; i < MAX_ITEMS; i++) {
    items.push(new RainItem());
    // Stagger start
    items[i].y = Math.random() * -500;
}

function handleTap(x, y) {
    let hit = false;
    items.forEach(item => {
        if (hit) return; // Only one item per tap

        // Hitbox optimization - Generous 60px radius (3600 sq)
        const dx = x - item.x;
        const dy = y - item.y;

        // Check if item is alive, reasonably close, and on screen
        if (dx * dx + dy * dy < 4000 && !item.dying && item.opacity > 0.5) {
            item.dying = true;
            hit = true;
            flashEffect = 0.5; // Visual feedback
            addScore(item.value);

            // Special Feedback for Rares
            if (item.type === 'juice' || item.type === 'cannabis') {
                const badge = document.getElementById("era-badge");
                const prevText = badge.innerText;
                badge.innerText = `+${item.value}!`;
                badge.classList.remove("opacity-0");
                badge.classList.add("scale-125", "bg-yellow-500", "text-black");
                setTimeout(() => {
                    badge.innerText = prevText;
                    badge.classList.remove("scale-125", "bg-yellow-500", "text-black");
                    if (audio.paused) badge.classList.add("opacity-0");
                }, 800);
            }
        }
    });
}

/* --- CONTROLS LOGIC --- */
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const nextBtn = document.getElementById("nextBtn");
const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");

let songHistory = [];

/* --- CONTROLS FUNCTIONS --- */
function togglePlay() {
    if (audio.paused) {
        audio.play().catch(() => { });
        updatePlayBtn(true);
    } else {
        audio.pause();
        updatePlayBtn(false);
    }
}

function updatePlayBtn(isPlaying) {
    if (isPlaying) {
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
    } else {
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
    }
}

playPauseBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextSong);

audio.onplay = () => updatePlayBtn(true);
audio.onpause = () => updatePlayBtn(false);

/* --- HISTORY LOGIC --- */
function addToHistory(song) {
    // Avoid duplicates if clicking previous/next rapidly
    if (songHistory.length > 0 && songHistory[0].path === song.path) return;

    songHistory.unshift(song);
    if (songHistory.length > 50) songHistory.pop();
    renderHistory();
}

function renderHistory() {
    if (songHistory.length === 0) {
        historyList.innerHTML = '<p class="text-white/30 text-sm text-center italic mt-10">Aún no has escuchado canciones...</p>';
        return;
    }

    historyList.innerHTML = songHistory.map((s, i) => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group" onclick="playFromHistory(${i})">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 text-xs font-bold text-white/50 group-hover:text-white group-hover:bg-purple-600 transition-colors">
                ${i + 1}
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="text-white font-bold text-sm truncate">${s.name}</h3>
                <p class="text-white/40 text-[10px] truncate">${s.album || "Unknown Album"}</p>
            </div>
            <div class="text-[10px] font-mono text-white/30 px-2 py-1 rounded bg-black/20">
                ${s.era || "N/A"}
            </div>
        </div>
    `).join('');
}

window.playFromHistory = (index) => {
    const s = songHistory[index];
    playSong(s, false);
    toggleHistory();
};

function toggleHistory() {
    historyPanel.classList.toggle("translate-y-[120%]");
}

historyBtn.addEventListener('click', toggleHistory);

/* --- VISUALIZER SETUP --- */
// Create EQ bars efficiently
const EQ_BAR_COUNT = 16;
const eqBars = [];
const fragment = document.createDocumentFragment();

for (let i = 0; i < EQ_BAR_COUNT; i++) {
    let div = document.createElement('div');
    div.className = "flex-1 bg-white/10 rounded-t-full transition-all duration-75";
    // Added transition for smoother fallback if data is jumpy, 
    // but typically requestAnimationFrame is fast enough.
    div.style.height = "10%";
    fragment.appendChild(div);
    eqBars.push(div);
}
eqContainer.appendChild(fragment);


/* --- MAIN ANIMATION LOOP --- */
function animate() {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

    // 1. Audio Analysis
    let bass = 0;
    if (analyser && isStarted && !audio.paused) {
        analyser.getByteFrequencyData(dataArray);

        // Update EQ Bars
        // dataArray has 32 items (fftSize/2). We have 16 bars.
        // We can map them directly or average.
        for (let i = 0; i < EQ_BAR_COUNT; i++) {
            // Use a slight curve to emphasize mids/highs or just linear
            // dataIndex from 0 to ~20 captures most musical content in small FFT
            const dataIndex = Math.floor(i * (dataArray.length / EQ_BAR_COUNT));
            const value = dataArray[dataIndex] || 0;
            // Scale 0-255 to 10-100%
            const height = 10 + (value / 255) * 90;
            eqBars[i].style.height = `${height}%`;
            eqBars[i].style.backgroundColor = colorMain;
        }

        // Calculate Bass Pulse (using first few frequencies)
        let bassSum = 0;
        for (let j = 0; j < 4; j++) bassSum += dataArray[j];
        bass = bassSum / 4; // Average 0-255
    } else {
        // Fallback idle animation
        eqBars.forEach((bar, i) => {
            const h = 10 + Math.sin(Date.now() * 0.005 + i * 0.5) * 5;
            bar.style.height = `${h}%`;
            bar.style.backgroundColor = colorMain;
        });
    }

    // 2. Rain Animation (Pooled)
    items.forEach(item => {
        item.update();
        item.draw(rainCtx);
    });

    // 3. Main Center Logo Animation
    // Canvas is now 400x400 to prevent clipping
    mainCtx.clearRect(0, 0, 400, 400);

    // Scale pulse based on bass if available, else simulated breath
    let targetPulse = isStarted && !audio.paused ? (bass / 255) : (Math.sin(Date.now() * 0.002) * 0.1);

    // Smooth smoothing
    pulse += (targetPulse - pulse) * 0.1;

    mainCtx.save();
    mainCtx.translate(200, 200); // Center of 400x400

    const scale = 1 + (pulse * 0.4) + (flashEffect * 0.3);
    mainCtx.scale(scale, scale);

    const grd = mainCtx.createRadialGradient(0, 0, 10, 0, 0, 160);
    grd.addColorStop(0, colorMain + "44");
    grd.addColorStop(1, "transparent");
    mainCtx.fillStyle = grd;
    mainCtx.fillRect(-200, -200, 400, 400);

    mainCtx.shadowColor = colorMain;
    mainCtx.shadowBlur = 20 + (flashEffect * 30) + (pulse * 20); // Pulse glow too
    mainCtx.fillStyle = flashEffect > 0.1 ? colorMain : "#fff";
    mainCtx.font = "900 130px Arial Black";
    mainCtx.textAlign = "center";
    mainCtx.textBaseline = "middle";
    mainCtx.fillText("999", 0, 0);
    mainCtx.restore();

    if (flashEffect > 0) flashEffect -= 0.05;

    requestAnimationFrame(animate);
}

// Start loop
animate();

/* --- AUDIO LOGIC --- */
const API = "https://juicewrldapi.com/juicewrld";

async function nextSong() {
    try {
        const r = await fetch(`${API}/radio/random/`);
        if (!r.ok) throw new Error("API Error");
        const d = await r.json();
        const s = d.song || d;
        playSong(s);
    } catch (e) {
        console.error("Next song error", e);
        setTimeout(nextSong, 2000);
    }
}

function playSong(s, shouldAddToHistory = true) {
    // Animate title change
    const titleEl = document.getElementById("title");
    titleEl.classList.remove("song-change");
    void titleEl.offsetWidth; // trigger reflow
    titleEl.classList.add("song-change");
    titleEl.innerText = s.name;

    document.getElementById("album").innerText = s.album || "999 Forever";
    let era = s.era ? (typeof s.era === 'string' ? s.era : s.era.name) : "Unreleased";
    const eras = { "GBGR": "#22c55e", "DRFL": "#3b82f6", "WOD": "#ef4444", "Unreleased": "#a855f7" };
    colorMain = eras[era] || "#a855f7";

    const badge = document.getElementById("era-badge");
    badge.innerText = era;
    badge.style.backgroundColor = colorMain;
    badge.classList.remove("opacity-0");
    badge.classList.remove("era-badge-change");
    void badge.offsetWidth;
    badge.classList.add("era-badge-change");

    document.getElementById("progress").style.backgroundColor = colorMain;
    audio.src = `${API}/files/download/?path=${encodeURIComponent(s.path)}`;

    if (shouldAddToHistory) addToHistory(s);

    if (isStarted) {
        audio.play().catch(() => { });
        updatePlayBtn(true);
    }
}

audio.ontimeupdate = () => { if (audio.duration) document.getElementById("progress").style.width = (audio.currentTime / audio.duration) * 100 + "%"; };
audio.onended = nextSong;

// Load first song
nextSong();
