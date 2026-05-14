window.addEventListener('load', () => {

  // Layer 1 - Body fade in (Background + immediate elements)
  document.body.style.transition = 'opacity 0.8s ease';
  document.body.style.opacity = '1';

  // Also make GIF images inside panels appear early
  document.querySelectorAll(
    '.panel img, #avatar-img, #mini-avatar'
  ).forEach(el => {
    el.style.transition = 'opacity 0.6s ease';
    el.style.opacity = '1';
  });

  // Layer 2 - panels appear 700ms later
  setTimeout(() => {
    document.querySelectorAll(
      '.panel, #site-header, #site-nav, #main-wrapper, #site-footer'
    ).forEach(el => {
      el.style.transition = 'opacity 0.5s ease';
      el.style.opacity = '1';
    });
  }, 700);

});

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
  "city pop 🎵", "moda callejera japonesa", "estética Y2K ✦",
  "archivos de la web antigua", "openings de anime de 2005", "música synth",
  "aprender japonés 日本語", "fotografía analógica", "diseño web retro",
  "videojuegos viejos", "beats lo-fi", "historia de la moda"
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

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
let isPlaying = localStorage.getItem('isPlaying') === 'true';
let startFrom = parseFloat(localStorage.getItem('npTime') || 0);
let npVolume = parseFloat(localStorage.getItem('npVolume') || 0.5);

function updateNP() {
  const titleEl = document.getElementById('np-title');
  const artistEl = document.getElementById('np-artist');
  const audio = document.getElementById('audio-player');
  const playBtn = document.getElementById('np-play');
  
  if (titleEl) titleEl.textContent = playlist[npIndex].title;
  if (artistEl) artistEl.textContent = playlist[npIndex].artist;
  
  if (audio) {
    // Only set src if it's different or empty
    if (!audio.src.includes(playlist[npIndex].src)) {
      audio.src = playlist[npIndex].src;
      audio.currentTime = startFrom;
      startFrom = 0; // Reset for next song change
    }
    
    localStorage.setItem('npIndex', npIndex);
    if (isPlaying) {
      audio.play().then(() => {
        if (playBtn) playBtn.textContent = '⏸';
      }).catch(e => {
        console.log("Autoplay bloqueado");
        isPlaying = false;
        localStorage.setItem('isPlaying', 'false');
        if (playBtn) playBtn.textContent = '▶';
      });
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
      localStorage.setItem('isPlaying', isPlaying);
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
      volSlider.value = npVolume;
      audio.volume = npVolume;
      volSlider.addEventListener('input', () => {
        audio.volume = volSlider.value;
        localStorage.setItem('npVolume', volSlider.value);
      });
    }

    const mainProgress = document.getElementById('np-progress');
    const curTimeEl = document.getElementById('np-current-time');
    const durationEl = document.getElementById('np-duration');

    audio.addEventListener('timeupdate', () => {
      localStorage.setItem('npTime', audio.currentTime);
      if (curTimeEl) curTimeEl.textContent = formatTime(audio.currentTime);
      
      if (mainProgress && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        mainProgress.value = pct;
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (durationEl) durationEl.textContent = formatTime(audio.duration);
    });

    if (mainProgress) {
      mainProgress.addEventListener('input', () => {
        if (!isNaN(audio.duration)) {
          const time = (mainProgress.value / 100) * audio.duration;
          audio.currentTime = time;
        }
      });
    }

  }

  updateNP();
}

/* Favorite Song Logic (Japan Section) */
const favAudio = new Audio('assets/music/vivarium.mp3');
const favBtn = document.getElementById('fav-play-btn');
const favEq = document.getElementById('fav-eq');

if (favBtn) {
  const favVol = document.getElementById('fav-volume');
  if (favVol) {
    favAudio.volume = favVol.value;
    favVol.addEventListener('input', () => {
      favAudio.volume = favVol.value;
    });
  }

  const favProgress = document.getElementById('fav-progress');
  const favRewind = document.getElementById('fav-rewind');
  const favForward = document.getElementById('fav-forward');

  const favTimeEl = document.getElementById('fav-time');

  if (favProgress) {
    favAudio.addEventListener('timeupdate', () => {
      const pct = (favAudio.currentTime / favAudio.duration) * 100;
      favProgress.value = pct || 0;
      if (favTimeEl) {
        favTimeEl.textContent = `${formatTime(favAudio.currentTime)} / ${formatTime(favAudio.duration)}`;
      }
    });
    favProgress.addEventListener('input', () => {
      const time = (favProgress.value / 100) * favAudio.duration;
      favAudio.currentTime = time;
    });
  }

  if (favRewind) {
    favRewind.addEventListener('click', () => {
      favAudio.currentTime = Math.max(0, favAudio.currentTime - 5);
    });
  }
  if (favForward) {
    favForward.addEventListener('click', () => {
      favAudio.currentTime = Math.min(favAudio.duration, favAudio.currentTime + 5);
    });
  }

  favBtn.addEventListener('click', () => {
    const audio = document.getElementById('audio-player');
    if (favAudio.paused) {
      if (audio) audio.pause();
      favAudio.play();
      favBtn.textContent = '■ STOP';
      favEq.style.display = 'flex';
    } else {
      favAudio.pause();
      favAudio.currentTime = 0;
      if (audio) audio.play();
      favBtn.textContent = '▶ PLAY';
      favEq.style.display = 'none';
    }
  });

  favAudio.addEventListener('ended', () => {
    const audio = document.getElementById('audio-player');
    favBtn.textContent = '▶ PLAY';
    favEq.style.display = 'none';
    if (audio) audio.play();
  });
}

function createFallingElements() {
  const bodyId = document.body.id;
  let symbols = [];
  let isMusicPage = false;

  if (bodyId === 'section-japan') {
    symbols = ['桜', '✿', '⌘'];
  } else if (bodyId === 'section-music') {
    symbols = ['♪', '♩', '♫', '♬'];
    isMusicPage = true;
  } else {
    // Default (index and others)
    symbols = ['✦', '★', '♥'];
  }

  for (let i = 0; i < 15; i++) {
    const el = document.createElement('div');
    el.className = 'falling-element';
    
    if (isMusicPage && Math.random() < 0.2) {
      const img = document.createElement('img');
      img.src = 'assets/images/music/falling-char.png';
      img.style.height = '32px';
      img.style.width = 'auto';
      img.style.display = 'block';
      el.appendChild(img);
    } else {
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    }

    const duration = 6 + Math.random() * 10;
    const delay = -(Math.random() * 10);
    const size = 20 + Math.random() * 18;
    const opacity = 0.4 + Math.random() * 0.4;
    const left = Math.random() * 100;

    el.style.position = 'fixed';
    el.style.top = '-40px';
    el.style.left = left + 'vw';
    el.style.fontSize = size + 'px';
    el.style.opacity = opacity;
    el.style.zIndex = '1';
    el.style.pointerEvents = 'none';
    el.style.animation = `fall-down ${duration}s linear ${delay}s infinite`;
    
    const computedStyle = getComputedStyle(document.body);
    const accent = computedStyle.getPropertyValue('--accent').trim();
    const primary = computedStyle.getPropertyValue('--primary').trim();
    el.style.color = Math.random() > 0.5 ? accent : primary;

    document.body.appendChild(el);
  }
}

window.addEventListener('DOMContentLoaded', createFallingElements);



