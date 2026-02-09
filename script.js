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
    } catch(e) {
        console.warn("MediaElementSource already connected or error:", e);
    }

    analyser.fftSize = 64; // Small size for retro blocky look (32 data points)
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}


/* --- PLAY OVERLAY --- */
playOverlay.addEventListener('click', function() {
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
    if(currentScore > bestScore) {
        bestScore = currentScore;
        localStorage.setItem("999_best_score", bestScore);
        document.getElementById("best-val").innerText = bestScore.toString().padStart(6, '0');
    }
}
// Score over time when playing
setInterval(() => { if(!audio.paused) addScore(1); }, 1000);

/* --- LLUVIA --- */
function resize() { rainCanvas.width = window.innerWidth; rainCanvas.height = window.innerHeight; }
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
        if(this.type === 'cup') {
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(7, 15); ctx.lineTo(-7, 15); ctx.fill();
            if(this.state === 'full') { ctx.fillStyle = colorMain; ctx.fillRect(-8, -12, 16, 6); }
        } else {
            ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.roundRect(-10, -5, 20, 10, 5); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(0, -5, 10, 10);
        }
        ctx.restore();
    }
    update() { this.y += this.speed; this.angle += this.rotSpeed; if(this.dying) this.opacity -= 0.1; }
}

setInterval(() => { if(items.length < 15) items.push(new RainItem(Math.random() > 0.4 ? 'cup' : 'pill')); }, 700);

/* --- GESTOS E INTERACCIÓN --- */
rainCanvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    handleTap(e.touches[0]);
}, {passive: true});

rainCanvas.addEventListener('touchend', (e) => {
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;
    
    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
        nextSong();
    }
}, {passive: true});

rainCanvas.addEventListener('mousedown', (e) => {
    touchStartX = e.clientX;
    handleTap(e);
});
rainCanvas.addEventListener('mouseup', (e) => {
    let diffX = e.clientX - touchStartX;
    if (Math.abs(diffX) > 60) nextSong();
});

function handleTap(pos) {
    items.forEach(item => {
        const dx = pos.clientX - item.x;
        const dy = pos.clientY - item.y;
        if(Math.sqrt(dx*dx + dy*dy) < 50 && !item.dying) {
            item.dying = true;
            if(item.type === 'cup') { item.state = 'empty'; flashEffect = 1.0; addScore(100); }
            else { addScore(50); }
        }
    });
}

/* --- VISUALIZER SETUP --- */
// Create EQ bars efficiently
const EQ_BAR_COUNT = 16; 
const eqBars = [];
const fragment = document.createDocumentFragment();

for(let i=0; i<EQ_BAR_COUNT; i++) {
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
    rainCtx.clearRect(0,0, rainCanvas.width, rainCanvas.height);
    
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
        for(let j=0; j<4; j++) bassSum += dataArray[j];
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
        if(item.y > rainCanvas.height + 50 || item.opacity <= 0) items.splice(i, 1);
    });

    // 3. Main Center Logo Animation
    mainCtx.clearRect(0,0,350,350);
    
    // Scale pulse based on bass if available, else simulated breath
    let targetPulse = isStarted && !audio.paused ? (bass / 255) : (Math.sin(Date.now() * 0.002) * 0.1);
    
    // Smooth smoothing
    pulse += (targetPulse - pulse) * 0.1;
    
    mainCtx.save(); 
    mainCtx.translate(175, 175);
    
    const scale = 1 + (pulse * 0.4) + (flashEffect * 0.3);
    mainCtx.scale(scale, scale);
    
    const grd = mainCtx.createRadialGradient(0,0,10,0,0,160);
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
    
    if(flashEffect > 0) flashEffect -= 0.05;
    
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
        
        // Animate title change
        const titleEl = document.getElementById("title");
        titleEl.classList.remove("song-change");
        void titleEl.offsetWidth; // trigger reflow
        titleEl.classList.add("song-change");
        titleEl.innerText = s.name;
        
        document.getElementById("album").innerText = s.album || "999 Forever";
        let era = s.era ? (typeof s.era === 'string' ? s.era : s.era.name) : "Unreleased";
        const eras = {"GBGR": "#22c55e", "DRFL": "#3b82f6", "WOD": "#ef4444", "Unreleased": "#a855f7"};
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
        
        if(isStarted) {
            audio.play().catch(()=>{});
        }
    } catch(e) { 
        console.error("Next song error", e);
        // Optional: Show error state
        setTimeout(nextSong, 2000); 
    }
}

audio.ontimeupdate = () => { if(audio.duration) document.getElementById("progress").style.width = (audio.currentTime/audio.duration)*100 + "%"; };
audio.onended = nextSong;

// Load first song
nextSong();
