const diaryEntries = [
  "今日は音楽を聴きながら何も考えたくない日。",
  "extraño el internet de antes. todo era más mágico.",
  "aprendí 5 palabras nuevas en japonés ✦",
  "el cielo estaba raro hoy, de ese color que no tiene nombre.",
  "me quedé hasta las 3am mirando videos viejos de youtube.",
  "hoy todo sonó a soundtrack de algo importante.",
  "思ったより悪くない一日だった。",
  "necesito más horas para todo lo que quiero hacer.",
  "descubrí una canción que siento que siempre existió en mi vida.",
  "días así son los que quiero recordar.",
  "el mundo digital es mi lugar favorito del mundo real.",
  "hoy canté solo para mí y fue suficiente.",
  "algo en el aire hoy se sentía como nostalgia del futuro.",
  "今日もがんばった。それで十分。",
  "vi una película vieja y me acordé de quién era antes.",
  "todo está bien aunque no lo parezca.",
  "la tecnología vieja me hace sentir en casa.",
  "hoy coleccioné momentos en vez de cosas.",
  "quiero que este sitio dure para siempre.",
  "estar en línea a las 2am tiene su propia magia.",
  "感謝してる、今日という日に。",
  "algunos días son solo para existir tranquilo.",
  "escuché the mismo álbum tres veces seguidas sin culpa.",
  "el pasado del internet era más honesto.",
  "hoy me sentí exactamente como una canción de city pop.",
  "nada extraordinario pero tampoco lo necesitaba.",
  "aprendí algo nuevo y eso ya hace al día válido.",
  "今日はただ、ここにいる。",
  "el glitch es parte de la estética.",
  "mañana será otro capítulo."
];

const obsessions = [
  "city pop 🎵", "japanese street fashion", "Y2K aesthetics ✦",
  "old web archives", "anime openings de 2005", "synth music",
  "aprender japonés 日本語", "fotografía analógica", "web design retro",
  "videojuegos viejos", "lo-fi beats", "fashion history"
];

function updateDaily() {
  const now = new Date();
  
  // Format: 2025.01.23 ★
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}.${month}.${day} ★`;
  
  const dailyDateEl = document.getElementById('daily-date');
  if (dailyDateEl) dailyDateEl.innerText = dateStr;

  // Pick deterministically based on date
  const dayIndex = Math.floor(Date.now() / 86400000);
  
  const entryEl = document.getElementById('daily-entry');
  if (entryEl) {
    entryEl.innerText = diaryEntries[dayIndex % diaryEntries.length];
  }
  
  const obsessionEl = document.getElementById('obsession-text');
  if (obsessionEl) {
    obsessionEl.innerText = obsessions[dayIndex % obsessions.length];
  }
}

function updateClock() {
  const now = new Date();
  
  // Time HH:MM:SS
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${h}:${m}:${s}`;
  
  const clockTimeEl = document.getElementById('clock-time');
  if (clockTimeEl) clockTimeEl.innerText = timeStr;

  // Date YYYY.MM.DD (Day)
  const daysJP = ['日', '月', '火', '水', '木', '金', '土'];
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const dayJP = daysJP[now.getDay()];
  const dateStr = `${year}.${month}.${date} (${dayJP})`;
  
  const clockDateEl = document.getElementById('clock-date');
  if (clockDateEl) clockDateEl.innerText = dateStr;
}

// Initial call
document.addEventListener('DOMContentLoaded', () => {
  updateDaily();
  updateClock();
  setInterval(updateClock, 1000);
  initRunner();
  initPanelControls();
  initNowPlaying();
});

/* ============================================================
   CURSOR TRAIL
   ============================================================ */
document.addEventListener('mousemove', (e) => {
  const spark = document.createElement('span');
  spark.classList.add('cursor-spark');
  spark.style.left = e.pageX + 'px';
  spark.style.top = e.pageY + 'px';
  spark.innerText = ['✦', '★', '♥', '✿', '⊹'][Math.floor(Math.random() * 5)];
  document.body.appendChild(spark);
  setTimeout(() => spark.remove(), 600);
});

/* ============================================================
   RUNNER MASCOT
   ============================================================ */
function initRunner() {
  const runner = document.getElementById('runner');
  if (!runner) return;

  function run() {
    runner.style.display = 'block';
    runner.style.animation = 'run-across 8s linear forwards';
    
    setTimeout(() => {
      runner.style.display = 'none';
      runner.style.animation = 'none';
      // Recursive call with random interval
      setTimeout(run, Math.random() * 45000 + 45000);
    }, 8000);
  }

  // First run
  setTimeout(run, Math.random() * 45000 + 45000);
}

/* ============================================================
   PANEL CONTROLS
   ============================================================ */
function initPanelControls() {
  document.querySelectorAll('.panel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.panel');
      const body = panel.querySelector('.panel-body');
      const action = btn.innerText.trim();
      
      if (action === '✕') {
        panel.style.display = 'none';
      }
      if (action === '─') {
        body.style.display = 
          body.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}

/* ============================================================
   NOW PLAYING BAR
   ============================================================ */
const playlist = [
  { title: "Onii Yuukai", artist: "Vocaloid", src: "assets/music/onii_yuukai.mp3" },
  { title: "Matryoshka", artist: "Hatsune Miku & Gumi", src: "assets/music/matryoshka.mp3" },
  { title: "hatachi no koi", artist: "sped up", src: "assets/music/hatachi.mp3" },
  { title: "Fly, Kirby!", artist: "Kirby's Return to Dream Land", src: "assets/music/kirby.mp3" },
  { title: "TouhouMAD - Nitori Get Down!", artist: "小野崎人", src: "assets/music/nitori.mp3" },
  { title: "aishite aishite aishite", artist: "kikuo", src: "assets/music/aishite.mp3" }
];

let npIndex = parseInt(localStorage.getItem('npIndex') || Math.floor(Math.random() * playlist.length));
let isPlaying = false;

function updateNP() {
  const titleEl = document.getElementById('np-title');
  const artistEl = document.getElementById('np-artist');
  const audio = document.getElementById('audio-player');
  const playBtn = document.getElementById('np-play');
  
  if (titleEl) titleEl.textContent = playlist[npIndex].title;
  if (artistEl) artistEl.textContent = playlist[npIndex].artist;
  
  if (audio) {
    audio.src = playlist[npIndex].src;
    localStorage.setItem('npIndex', npIndex);
    if (isPlaying) {
      audio.play().catch(e => console.log("Interaction required to play"));
      if (playBtn) playBtn.textContent = '⏸';
    } else {
      if (playBtn) playBtn.textContent = '▶';
    }
  }
}

function initNowPlaying() {
  const nextBtn = document.getElementById('np-next');
  const prevBtn = document.getElementById('np-prev');
  const playBtn = document.getElementById('np-play');
  const audio = document.getElementById('audio-player');

  if (playBtn && audio) {
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playBtn.textContent = '⏸';
        isPlaying = true;
      } else {
        audio.pause();
        playBtn.textContent = '▶';
        isPlaying = false;
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      npIndex = (npIndex + 1) % playlist.length;
      updateNP();
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      npIndex = (npIndex - 1 + playlist.length) % playlist.length;
      updateNP();
    });
  }

  // Audio ends -> next song
  if (audio) {
    audio.addEventListener('ended', () => {
      npIndex = (npIndex + 1) % playlist.length;
      updateNP();
    });

    // Volume control
    const volSlider = document.getElementById('np-volume');
    if (volSlider) {
      audio.volume = volSlider.value;
      volSlider.addEventListener('input', () => {
        audio.volume = volSlider.value;
      });
    }
  }

  updateNP();
}

