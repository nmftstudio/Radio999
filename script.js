const rainCanvas = document.getElementById("rainCanvas");
const rainCtx = rainCanvas.getContext("2d");
const mainCanvas = document.getElementById("mainCanvas");
const mainCtx = mainCanvas.getContext("2d");
const audio = document.getElementById("audio");
const playOverlay = document.getElementById("playOverlay");
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


/* --- PLAY OVERLAY --- */
playOverlay.addEventListener('click', function () {
    this.classList.add('hidden');
    isStarted = true;

    // Initialize Web Audio on user gesture
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    audio.play().catch(e => console.log('Play error:', e));

    // Start the main loop if not already running explicitly (though animate() runs always)
});

/* --- SWIPE ENGINE --- */
let touchStartX = 0;
let touchStartY = 0;

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

/* --- LLUVIA --- */
function resize() {
    // Rain Canvas now lives inside #game-area
    const container = document.getElementById("game-area");
    rainCanvas.width = container.clientWidth;
    rainCanvas.height = container.clientHeight;
}
window.addEventListener('resize', resize);
resize();

class RainItem {
    constructor(type) {
        this.type = type;
        this.x = Math.random() * rainCanvas.width;
        this.y = -50;
        this.speed = 2 + Math.random() * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
        this.dying = false; this.opacity = 1; this.state = 'full';
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.globalAlpha = this.opacity;
        if (this.type === 'cup') {
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(7, 15); ctx.lineTo(-7, 15); ctx.fill();
            if (this.state === 'full') { ctx.fillStyle = colorMain; ctx.fillRect(-8, -12, 16, 6); }
        } else {
            ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.roundRect(-10, -5, 20, 10, 5); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(0, -5, 10, 10);
        }
        ctx.restore();
    }
    update() { this.y += this.speed; this.angle += this.rotSpeed; if (this.dying) this.opacity -= 0.1; }
}

setInterval(() => { if (items.length < 15) items.push(new RainItem(Math.random() > 0.4 ? 'cup' : 'pill')); }, 700);

/* --- GESTOS E INTERACCIÓN --- */
// Gestures mainly for main visualizer area, but buttons handle navigation now.
// Keeping swipe for game area too.
const gameArea = document.getElementById("game-area");

gameArea.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    // Check if rain item clicked (game logic)
    const rect = rainCanvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    handleTap(x, y);
}, { passive: true });

gameArea.addEventListener('touchend', (e) => {
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;

    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
        nextSong();
    }
}, { passive: true });

gameArea.addEventListener('mousedown', (e) => {
    touchStartX = e.clientX;
    const rect = rainCanvas.getBoundingClientRect();
    handleTap(e.clientX - rect.left, e.clientY - rect.top);
});
gameArea.addEventListener('mouseup', (e) => {
    let diffX = e.clientX - touchStartX;
    if (Math.abs(diffX) > 60) nextSong();
});

function handleTap(x, y) {
    items.forEach(item => {
        const dx = x - item.x;
        const dy = y - item.y;
        if (Math.sqrt(dx * dx + dy * dy) < 50 && !item.dying) {
            item.dying = true;
            if (item.type === 'cup') { item.state = 'empty'; flashEffect = 1.0; addScore(100); }
            else { addScore(50); }
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
const closeHistory = document.getElementById("closeHistory");

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
    playSong(s, false); // false = don't add to history again immediately or handle duplicates logic
    toggleHistory();
};

function toggleHistory() {
    historyPanel.classList.toggle("translate-y-[120%]");
}

historyBtn.addEventListener('click', toggleHistory);
closeHistory.addEventListener('click', toggleHistory);

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

    // 2. Rain Animation
    items.forEach((item, i) => {
        item.update(); item.draw(rainCtx);
        if (item.y > rainCanvas.height + 50 || item.opacity <= 0) items.splice(i, 1);
    });

    // 3. Main Center Logo Animation
    mainCtx.clearRect(0, 0, 350, 350);

    // Scale pulse based on bass if available, else simulated breath
    let targetPulse = isStarted && !audio.paused ? (bass / 255) : (Math.sin(Date.now() * 0.002) * 0.1);

    // Smooth smoothing
    pulse += (targetPulse - pulse) * 0.1;

    mainCtx.save();
    mainCtx.translate(175, 175);

    const scale = 1 + (pulse * 0.4) + (flashEffect * 0.3);
    mainCtx.scale(scale, scale);

    const grd = mainCtx.createRadialGradient(0, 0, 10, 0, 0, 160);
    grd.addColorStop(0, colorMain + "44");
    grd.addColorStop(1, "transparent");
    mainCtx.fillStyle = grd;
    mainCtx.fillRect(-175, -175, 350, 350);

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
