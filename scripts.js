// The parent is presentation-free; owned child documents wait for canonical state.
(function (host) {
  'use strict';
  if (host.SiteAudioShell?.isHost) return;
  const client = host.SiteAudioClient?.isFrame ? host.SiteAudioClient : null;
  let initialized = false;
  function execute() {
    if (initialized) return;
    initialized = true;
    const onReady = (event, callback) => {
      const passed = event === 'load' ? document.readyState === 'complete' : document.readyState !== 'loading';
      if (passed) Promise.resolve().then(callback);
      else (event === 'load' ? host : document).addEventListener(event, callback, { once: true });
    };
    const getPlayer = () => client ? client.getPlayer() : document.getElementById('audio-player');
    const handleAudioFailure = failure => { if (failure?.name === 'NotAllowedError') client?.requestActivation(); };
    const sendAudio = command => client.command(command).catch(handleAudioFailure);
    const renderHostedPlayer = () => {
      const state = client.state().music;
      npIndex = state.index; isPlaying = state.playing; startFrom = state.currentTime; npVolume = state.volume;
      const set = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
      set('np-title', state.title); set('np-artist', state.artist); set('np-current-time', formatTime(state.currentTime)); set('np-duration', formatTime(state.duration));
      const play = document.getElementById('np-play'); if (play) play.textContent = state.playing ? '⏸' : '▶';
      const volume = document.getElementById('np-volume'); if (volume) volume.value = state.volume;
      const progress = document.getElementById('np-progress'); if (progress) progress.value = state.duration ? state.currentTime / state.duration * 100 : 0;
    };
    const initHostedPlayer = () => {
      const player = getPlayer();
      const bind = (id, event, callback) => document.getElementById(id)?.addEventListener(event, callback);
      bind('np-play', 'click', () => player.paused ? player.play().catch(handleAudioFailure) : player.pause());
      bind('np-next', 'click', () => sendAudio({type:'music',action:'next'}));
      bind('np-prev', 'click', () => sendAudio({type:'music',action:'prev'}));
      bind('np-volume', 'input', event => { player.volume = event.target.value; });
      bind('np-progress', 'input', event => { if (Number.isFinite(player.duration)) player.currentTime = Number(event.target.value) / 100 * player.duration; });
      client.subscribe(renderHostedPlayer);
      renderHostedPlayer();
    };
onReady('load', () => {
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

  // All sections share the same background-first wait and smooth opacity fade.
  setTimeout(() => {
    document.querySelectorAll(
      '.panel, #site-header, #site-nav, #main-wrapper, #site-footer, #section-sobre-mi .sm-late-reveal'
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
  "aprender japonés 日本語", "fotografía analógica", "Japon antiguo",
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
onReady('DOMContentLoaded', () => {
  updateDaily();
  updateClock();
  setInterval(updateClock, 1000);
  initRunner();
  initPanelControls();
  initNowPlaying();
  initOmikuji();
  createFallingElements();
  initTechSection();
  initSobreMiSection();
  client?.pageReady();
});

/* ============================================================
   DEFAULT VISUAL SCALE
   ============================================================ */
function updateSiteScale() {
  const root = document.documentElement;
  const preferred = Number(getComputedStyle(root).getPropertyValue('--site-default-scale')) || 1.3;
  // Preserve the 1024px canvas; scrollable sections keep their preferred scale.
  // Never shrink below the original design or alter the browser's own zoom.
  let scale = CSS.supports('zoom', '1.3')
    ? Math.max(1, Math.min(preferred, window.innerWidth / 1024))
    : 1;
  const apply = () => {
    root.style.setProperty('--site-scale', scale);
    // CSS zoom does not change media-query dimensions, unlike browser zoom.
    root.classList.toggle('site-compact-height', window.innerHeight / scale <= 850);
    root.classList.toggle('site-narrow-layout', window.innerWidth / scale <= 1280);
  };
  apply();
  // The locked sidebar cannot scroll. Fit its actual contents, including the
  // banners whose height grows with their width, instead of guessing a height.
  const sidebar = document.getElementById('sm-sidebar');
  for (let attempt = 0; sidebar && scale > 1 && attempt < 6; attempt++) {
    const overflow = sidebar.scrollHeight - sidebar.clientHeight;
    if (overflow <= 0) break;
    scale = Math.max(1, scale * window.innerHeight / (window.innerHeight + (overflow + 2) * scale));
    apply();
  }
}

updateSiteScale();
window.addEventListener('resize', updateSiteScale);

/* ============================================================
   CURSOR TRAIL
   ============================================================ */
document.addEventListener('mousemove', (e) => {
  const spark = document.createElement('span');
  spark.classList.add('cursor-spark');
  const scale = Number(getComputedStyle(document.documentElement).zoom) || 1;
  spark.style.left = e.pageX / scale + 'px';
  spark.style.top = e.pageY / scale + 'px';
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
          body.style.display === 'none' ? '' : 'none';
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
  { title: "aishite aishite aishite", artist: "kikuo", src: "assets/music/aishite.mp3" },
  { title: "Remember Summer Days", artist: "Anri", src: "assets/music/yt-3agc6do-624.mp3" },
  { title: "Heroes (NightCore)", artist: "Canal: luna love", src: "assets/music/yt-hxrwlmloaeo.mp3" },
  { title: "Color Your Night", artist: "Lotus Juice, Azumi Takahashi & ATLUS Sound Team", src: "assets/music/yt-j9sn1nfgqq8.mp3" },
  { title: "Looping the Rooms feat. Hatsune Miku", artist: "Canal: rusino / ルシノ", src: "assets/music/yt-icbdykfxpms.mp3" }
];

let npIndex = client ? client.state().music.index : parseInt(localStorage.getItem('npIndex') || Math.floor(Math.random() * playlist.length));
let isPlaying = client ? client.state().music.playing : localStorage.getItem('isPlaying') === 'true'; // default false
let startFrom = client ? client.state().music.currentTime : parseFloat(localStorage.getItem('npTime') || 0);
let npVolume = client ? client.state().music.volume : parseFloat(localStorage.getItem('npVolume') || 0.5);

function updateNP() {
  if (client) { renderHostedPlayer(); return; }
  const titleEl = document.getElementById('np-title');
  const artistEl = document.getElementById('np-artist');
  const audio = getPlayer();
  const playBtn = document.getElementById('np-play');

  if (titleEl) titleEl.textContent = playlist[npIndex].title;
  if (artistEl) artistEl.textContent = playlist[npIndex].artist;

  if (audio) {
    if (!audio.src.includes(playlist[npIndex].src)) {
      audio.src = playlist[npIndex].src;
      audio.currentTime = startFrom;
      startFrom = 0;
    }

    localStorage.setItem('npIndex', npIndex);

    if (isPlaying) {
      audio.play().then(() => {
        if (playBtn) playBtn.textContent = '⏸';
      }).catch(() => {
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
  if (client) { initHostedPlayer(); return; }
  const nextBtn = document.getElementById('np-next');
  const prevBtn = document.getElementById('np-prev');
  const playBtn = document.getElementById('np-play');
  const audio = getPlayer();

  if (playBtn && audio) {
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().then(() => {
          playBtn.textContent = '⏸';
          isPlaying = true;
          localStorage.setItem('isPlaying', 'true');
        }).catch(() => { });
      } else {
        audio.pause();
        playBtn.textContent = '▶';
        isPlaying = false;
        localStorage.setItem('isPlaying', 'false');
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
const favAudio = client ? client.getFavorite() : new Audio('assets/music/vivarium.mp3');
const favBtn = document.getElementById('fav-play-btn');
const favEq = document.getElementById('fav-eq');

if (favBtn) {
  const favVol = document.getElementById('fav-volume');
  if (favVol) {
    if (!client) favAudio.volume = favVol.value; else favVol.value = favAudio.volume;
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

  const paintFavorite = () => {
    favBtn.textContent = favAudio.paused ? '▶ PLAY' : '■ STOP';
    if (favEq) favEq.style.display = favAudio.paused ? 'none' : 'flex';
  };
  if (client) { ['play','pause','ended','emptied'].forEach(event => favAudio.addEventListener(event, paintFavorite)); paintFavorite(); }
  favBtn.addEventListener('click', () => {
    if (client) {
      if (favAudio.paused) favAudio.play().catch(handleAudioFailure);
      else sendAudio({type:'favorite',action:'stop'});
      return;
    }
    const audio = getPlayer();
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
    if (client) { paintFavorite(); return; }
    const audio = getPlayer();
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
  } else if (bodyId === 'section-canto') {
    symbols = ['♪', '歌', '声', '♫', '★', '♩', '響'];
  } else if (bodyId === 'section-tech') {
    symbols = ['🫧', '✧', '💧', '❄', '⌘', '✦'];
  } else if (bodyId === 'section-sobre-mi') {
    symbols = ['♥', '★', '🌹', '✦', '✧', '🌸'];
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

// --- SUPER SYNTH LOGIC ---
let audioCtx;
let currentOsc = null;
let currentFilter = null;
let currentLFO = null;
let synthType = 'sawtooth';

// Cambiar modos de sonido (Buzz, 8-bit, Alien)
document.querySelectorAll('.synth-mode').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.synth-mode').forEach(b => b.classList.remove('active-mode'));
    e.target.classList.add('active-mode');
    synthType = e.target.getAttribute('data-type');
  });
});

// Barra Wah-Wah
const wahSlider = document.getElementById('synth-wah');
const face = document.getElementById('synth-face');

if (wahSlider && face) {
  wahSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    // Cambiar el filtro si está sonando
    if (client) sendAudio({type:'synth',action:'filter',filter:Number(val)});
    if (currentFilter) {
      currentFilter.frequency.value = val;
    }
    // Cambiar la boca de la cara
    if (val < 800) face.innerText = '(・_・)';
    else if (val < 2000) face.innerText = '(・o・)';
    else face.innerText = '(・O・)';
  });
}

// Reproducir notas
document.querySelectorAll('.synth-key').forEach(btn => {
  // Soportar mouse y táctil
  btn.addEventListener('mousedown', () => startNote(btn.getAttribute('data-freq')));
  btn.addEventListener('mouseup', stopNote);
  btn.addEventListener('mouseleave', stopNote);

  btn.addEventListener('touchstart', (e) => { e.preventDefault(); startNote(btn.getAttribute('data-freq')); });
  btn.addEventListener('touchend', stopNote);
});

function startNote(freq) {
  if (client) {
    sendAudio({type:'synth',action:'start',frequency:Number(freq),wave:synthType,filter:Number(wahSlider?.value || 3000)});
  } else {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  stopNote(); // Detener cualquier nota previa

  currentOsc = audioCtx.createOscillator();
  currentFilter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();

  currentOsc.type = synthType;
  currentOsc.frequency.value = parseFloat(freq);

  // El filtro Wah-Wah (Lowpass)
  currentFilter.type = 'lowpass';
  currentFilter.frequency.value = wahSlider ? wahSlider.value : 3000;
  currentFilter.Q.value = 5; // Le da resonancia para que suene más "plástico"

  // Modo Alien: Agrega vibrato loco
  if (synthType === 'sine') {
    currentLFO = audioCtx.createOscillator();
    currentLFO.frequency.value = 6; // Velocidad del temblor
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 30; // Profundidad del temblor
    currentLFO.connect(lfoGain);
    lfoGain.connect(currentOsc.frequency);
    currentLFO.start();
  }

  gainNode.gain.value = 0.05; // Volumen bajo para no reventar parlantes

  currentOsc.connect(currentFilter);
  currentFilter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  currentOsc.start();
  }

  // Animación alocada
  if (face) {
    face.style.textShadow = '0 0 20px var(--accent)';
    face.style.transform = 'scale(1.2) rotate(' + (Math.random() * 10 - 5) + 'deg)';
  }
}

function stopNote() {
  if (client) sendAudio({type:'synth',action:'stop'});
  if (currentOsc) {
    try { currentOsc.stop(); } catch (e) { }
    currentOsc = null;
  }
  if (currentLFO) {
    try { currentLFO.stop(); } catch (e) { }
    currentLFO = null;
  }
  if (face) {
    face.style.textShadow = 'none';
    face.style.transform = 'scale(1) rotate(0deg)';
  }
}

/* ============================================================
   OMIKUJI (FORTUNA JAPONESA DIARIA)
   ============================================================ */
function initOmikuji() {
  const btn = document.getElementById('omikuji-btn');
  const badge = document.getElementById('omikuji-result-badge');
  const text = document.getElementById('omikuji-result-text');
  const lucky = document.getElementById('omikuji-result-lucky');
  const item = document.getElementById('omikuji-item');

  if (!btn || !badge || !text) return;

  const fortunes = [
    {
      badge: "大吉 (DAIKICHI)",
      text: "Gran fortuna. Hoy descubrirás una canción que resonará contigo por años.",
      item: "Té verde caliente & audífonos viejos"
    },
    {
      badge: "中吉 (CHUKICHI)",
      text: "Media fortuna. Tu próximo proyecto digital tendrá una chispa nostálgica especial.",
      item: "Un casete grabado a mano"
    },
    {
      badge: "吉 (KICHI)",
      text: "Buena fortuna. Noche perfecta para escuchar un álbum completo sin interrupciones.",
      item: "Lluvia suave en la ventana"
    },
    {
      badge: "小吉 (SHOKICHI)",
      text: "Pequeña fortuna. Una persona del pasado recordará con cariño un momento contigo.",
      item: "Un libro en japonés de segunda mano"
    },
    {
      badge: "末吉 (SUEKICHI)",
      text: "Fortuna futura. La paciencia de hoy traerá un hallazgo creativo hermoso mañana.",
      item: "Un cuaderno de notas cuadriculado"
    },
    {
      badge: "超大吉 (SUPER DAIKICHI)",
      text: "¡Fortuna legendaria! La vibra Y2K está al 100%. Momento ideal para crear algo nuevo.",
      item: "Luz de neón roja & sintetizador"
    }
  ];

  btn.addEventListener('click', () => {
    btn.disabled = true;
    text.innerText = "Agitando el cilindro de bambú... (ガラガラ)";
    badge.innerText = "おみくじ中...";

    setTimeout(() => {
      const result = fortunes[Math.floor(Math.random() * fortunes.length)];
      badge.innerText = result.badge;
      text.innerText = result.text;
      if (lucky && item) {
        lucky.style.display = 'block';
        item.innerText = result.item;
      }
      btn.disabled = false;
      btn.innerText = "Volver a tirar (もう一度)";
    }, 500);
  });
}

/* ============================================================
   TECH SECTION INTERACTIVITY (FRUTIGER AERO)
   ============================================================ */
function initTechSection() {
  // 1. Vista Analog Clock
  const hourHand = document.getElementById('vista-hour-hand');
  const minuteHand = document.getElementById('vista-minute-hand');
  const secondHand = document.getElementById('vista-second-hand');

  function updateAnalogClock() {
    if (!hourHand || !minuteHand || !secondHand) return;
    const now = new Date();
    const secs = now.getSeconds();
    const mins = now.getMinutes();
    const hours = now.getHours();

    const secDeg = (secs / 60) * 360;
    const minDeg = ((mins + secs / 60) / 60) * 360;
    const hourDeg = (((hours % 12) + mins / 60) / 12) * 360;

    secondHand.style.transform = `rotate(${secDeg}deg)`;
    minuteHand.style.transform = `rotate(${minDeg}deg)`;
    hourHand.style.transform = `rotate(${hourDeg}deg)`;
  }

  if (hourHand) {
    updateAnalogClock();
    setInterval(updateAnalogClock, 1000);
  }

  // 2. MSN Nudge Button
  const nudgeBtn = document.getElementById('msn-nudge-btn');
  const msnCard = document.getElementById('panel-msn');
  if (nudgeBtn && msnCard) {
    nudgeBtn.addEventListener('click', () => {
      msnCard.classList.add('nudging');
      setTimeout(() => msnCard.classList.remove('nudging'), 800);
    });
  }

  // 3. Tech-only local programs; other sections never mount this runtime.
  if (document.body.id === 'section-tech') {
    window.TechTerminal?.mount(document.querySelector('.tech-terminal'), window);
  }
}

/* ============================================================
   SOBRE MÍ SECTION INTERACTIVITY (CYBER BARD & VOCAL ROUTINE)
   ============================================================ */
function initSobreMiSection() {
  if (document.body.id !== 'section-sobre-mi') return;

  // About-only skin: keep the shared audio, playlist and navigation persistence.
  const player = document.getElementById('now-playing-bar');
  const playerAudio = getPlayer();
  const playerPlay = document.getElementById('np-play');
  const playerStop = document.getElementById('sm-np-stop');
  if (player && playerAudio && playerPlay && playerStop) {
    const syncPlayerSkin = () => {
      const playing = !playerAudio.paused;
      player.classList.toggle('sm-winamp-playing', playing);
      playerPlay.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
      playerPlay.title = playing ? 'Pausar' : 'Reproducir';
      document.getElementById('np-label').textContent = playing
        ? 'REPRODUCIENDO' : playerAudio.currentTime > 0 ? 'EN PAUSA' : 'DETENIDO';
      document.getElementById('sm-np-volume-value').textContent = `${Math.round(playerAudio.volume * 100)}%`;
    };
    ['play', 'pause', 'volumechange', 'seeked', 'emptied'].forEach(event => {
      playerAudio.addEventListener(event, syncPlayerSkin);
    });
    playerStop.addEventListener('click', () => {
      if (client) { sendAudio({type:'music',action:'stop'}); return; }
      playerAudio.pause();
      playerAudio.currentTime = 0;
      isPlaying = false;
      startFrom = 0;
      localStorage.setItem('isPlaying', 'false');
      localStorage.setItem('npTime', '0');
      playerPlay.textContent = '▶';
      document.getElementById('np-progress').value = 0;
      document.getElementById('np-current-time').textContent = '0:00';
      syncPlayerSkin();
    });
    syncPlayerSkin();
  }

  // 1. Selector de Fases de la Rutina Vocal
  const phaseTabs = document.querySelectorAll('.sm-routine-tab-btn');
  const phasePanes = document.querySelectorAll('.sm-phase-pane');

  phaseTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const phaseNum = btn.getAttribute('data-phase');
      if (!phaseNum) return;
      const targetPane = document.getElementById(`phase-${phaseNum}`);
      if (!targetPane) return;

      closeMiniPlayers();
      phaseTabs.forEach(t => t.classList.remove('active'));
      phasePanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      targetPane.classList.add('active');
    });
  });

  // 1.1 Reproductor Mini Cyber TV (YouTube Embed Interactivo)
  const playerToggles = document.querySelectorAll('.sm-yt-player-toggle');
  const playerCloses = document.querySelectorAll('.sm-cyber-tv-close');

  function closeMiniPlayer(container) {
    container.style.display = 'none';
    const frameWrap = container.querySelector('.sm-cyber-tv-frame-wrap');
    if (frameWrap) frameWrap.replaceChildren();
    playerToggles.forEach(toggle => {
      if (toggle.getAttribute('data-target') === container.id) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function closeMiniPlayers() {
    document.querySelectorAll('.sm-cyber-tv-embed').forEach(closeMiniPlayer);
  }

  function showMiniTvHelp(frameWrap, message, videoId) {
    const help = document.createElement('p');
    help.className = 'sm-tv-help';
    help.textContent = message;
    if (videoId) {
      const link = document.createElement('a');
      link.href = `https://www.youtube.com/watch?v=${videoId}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Abrir en YouTube ↗';
      help.textContent += ' ';
      help.appendChild(link);
    }
    frameWrap.appendChild(help);
  }

  playerToggles.forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const container = document.getElementById(targetId);
    if (!container) return;
    btn.setAttribute('aria-controls', targetId);
    btn.setAttribute('aria-expanded', 'false');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Mini TV');

    btn.addEventListener('click', () => {
      const videoId = btn.getAttribute('data-video');
      const isHidden = container.style.display === 'none' || !container.style.display;
      if (!isHidden) {
        closeMiniPlayer(container);
        return;
      }

      closeMiniPlayers();
      const frameWrap = container.querySelector('.sm-cyber-tv-frame-wrap');
      if (!frameWrap) return;
      container.style.display = 'block';
      btn.setAttribute('aria-expanded', 'true');

      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) {
        showMiniTvHelp(frameWrap, 'Este vídeo no está disponible. Revisa su enlace.');
        return;
      }

      if (location.protocol !== 'http:' && location.protocol !== 'https:') {
        // file:// cannot provide the HTTP Referer required by YouTube (error 153).
        showMiniTvHelp(frameWrap, 'Abre la página desde un servidor local para usar la Mini TV.', videoId);
      } else {
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '240';
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
        iframe.title = 'Reproductor de YouTube';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        // Start inside YouTube's controls, never automatically behind the reading viewport.
        frameWrap.appendChild(iframe);
        showMiniTvHelp(frameWrap, 'Si la Mini TV no carga, abre el vídeo en YouTube.', videoId);
      }
      playRetroChime(640);
    });
  });

  playerCloses.forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    btn.setAttribute('aria-controls', targetId);
    btn.setAttribute('aria-label', 'Cerrar Mini TV');
    btn.addEventListener('click', () => {
      const container = document.getElementById(targetId);
      if (container) closeMiniPlayer(container);
    });
  });

  // 2. Selector de Estado Vocal (Cyber ID)
  const stateBtns = document.querySelectorAll('.sm-state-pill-btn');
  const activeStateTxt = document.getElementById('sm-active-state-txt');

  stateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const newState = btn.getAttribute('data-state');
      stateBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (activeStateTxt) {
        activeStateTxt.textContent = newState;
      }
      playRetroChime(580);
    });
  });

  // 3. Checklist Diario de Práctica Vocal & Racha Persistida
  const checkBoxes = document.querySelectorAll('.sm-routine-check');
  const progressFill = document.getElementById('sm-tracker-progress-fill');
  const pctText = document.getElementById('sm-tracker-pct-text');
  const streakCountEl = document.getElementById('sm-streak-count');

  let currentStreak = parseInt(localStorage.getItem('sm_vocal_streak') || '5', 10);
  if (streakCountEl) {
    streakCountEl.textContent = `${currentStreak} DÍAS`;
  }

  function updateVocalProgress(playChime = false) {
    if (checkBoxes.length === 0) return;
    let checkedCount = 0;
    const savedState = {};

    checkBoxes.forEach((cb, idx) => {
      const step = cb.getAttribute('data-step') || idx;
      const row = cb.closest('.sm-check-row');
      if (cb.checked) {
        checkedCount++;
        savedState[step] = true;
        if (row) row.classList.add('checked');
      } else {
        savedState[step] = false;
        if (row) row.classList.remove('checked');
      }
    });

    const pct = Math.round((checkedCount / checkBoxes.length) * 100);
    if (progressFill) progressFill.style.width = pct + '%';
    if (pctText) pctText.textContent = pct + '%';

    try {
      localStorage.setItem('sm_vocal_checklist', JSON.stringify(savedState));
      localStorage.setItem('sm_vocal_pct', pct);
    } catch (e) {}

    // Manejo de racha si se completa el 100%
    if (pct === 100) {
      const today = new Date().toISOString().slice(0, 10);
      const lastCompletedDate = localStorage.getItem('sm_vocal_streak_last_date');
      if (lastCompletedDate !== today) {
        currentStreak++;
        try {
          localStorage.setItem('sm_vocal_streak', currentStreak);
          localStorage.setItem('sm_vocal_streak_last_date', today);
        } catch (e) {}
        if (streakCountEl) {
          streakCountEl.textContent = `${currentStreak} DÍAS`;
        }
      }
    }

    if (playChime && checkedCount > 0) {
      playRetroChime(pct === 100 ? 880 : 520);
    }
  }

  // Cargar estado previo de checklist desde localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('sm_vocal_checklist') || '{}');
    checkBoxes.forEach((cb, idx) => {
      const step = cb.getAttribute('data-step') || idx;
      if (saved[step]) {
        cb.checked = true;
      }
    });
    updateVocalProgress(false);
  } catch (e) {
    updateVocalProgress(false);
  }

  checkBoxes.forEach(cb => {
    cb.addEventListener('change', () => updateVocalProgress(true));
  });

  // 4. Generador de Tonos de Afinación (A4 440Hz, C4, E4, etc.)
  let tunerAudioCtx = null;
  let activeOsc = null;
  let activeGain = null;
  let stopTimeoutId = null;

  const tunerFreqDisplay = document.getElementById('sm-tuner-freq');
  const tunerWave = document.getElementById('sm-tuner-wave');
  const tunerBtns = document.querySelectorAll('.sm-tuner-key-btn');
  const stopTunerBtn = document.getElementById('sm-tuner-stop');

  function ensureAudioContext() {
    if (!tunerAudioCtx) {
      tunerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (tunerAudioCtx.state === 'suspended') {
      tunerAudioCtx.resume();
    }
    return tunerAudioCtx;
  }

  function stopTunerTone() {
    if (client) sendAudio({type:'tuner',action:'stop'});
    if (stopTimeoutId) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    if (activeOsc) {
      const oscToStop = activeOsc;
      const gainToStop = activeGain;
      activeOsc = null;
      activeGain = null;

      try {
        if (gainToStop && tunerAudioCtx && tunerAudioCtx.state === 'running') {
          const now = tunerAudioCtx.currentTime;
          gainToStop.gain.cancelScheduledValues(now);
          gainToStop.gain.setValueAtTime(gainToStop.gain.value, now);
          gainToStop.gain.linearRampToValueAtTime(0.0001, now + 0.08);
          stopTimeoutId = setTimeout(() => {
            try {
              oscToStop.stop();
              oscToStop.disconnect();
            } catch (e) {}
          }, 90);
        } else {
          oscToStop.stop();
          oscToStop.disconnect();
        }
      } catch (e) {
        try { oscToStop.stop(); } catch (err) {}
      }
    }
    tunerBtns.forEach(b => b.classList.remove('active-tone'));
    if (tunerWave) tunerWave.classList.remove('sounding');
  }

  function playTunerTone(freq, noteName) {
    if (client) {
      stopTunerTone();
      sendAudio({type:'tuner',action:'start',frequency:Number(freq)});
      if (tunerFreqDisplay) tunerFreqDisplay.textContent = `${parseFloat(freq).toFixed(1)} Hz (${noteName})`;
      if (tunerWave) tunerWave.classList.add('sounding');
      return;
    }
    const ctx = ensureAudioContext();
    stopTunerTone();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(parseFloat(freq), ctx.currentTime);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    activeOsc = osc;
    activeGain = gain;

    if (tunerFreqDisplay) {
      tunerFreqDisplay.textContent = `${parseFloat(freq).toFixed(1)} Hz (${noteName})`;
    }
    if (tunerWave) {
      tunerWave.classList.add('sounding');
    }
  }

  tunerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const freq = btn.getAttribute('data-freq');
      const note = btn.getAttribute('data-note') || '';
      if (!freq) return;

      if (btn.classList.contains('active-tone')) {
        stopTunerTone();
      } else {
        tunerBtns.forEach(b => b.classList.remove('active-tone'));
        btn.classList.add('active-tone');
        playTunerTone(freq, note);
      }
    });
  });

  if (stopTunerBtn) {
    stopTunerBtn.addEventListener('click', stopTunerTone);
  }

  // A collapsed archive must not keep playing media behind hidden controls.
  const vocalArchive = document.getElementById('sm-vocal-archive');
  if (vocalArchive) {
    vocalArchive.addEventListener('toggle', () => {
      if (vocalArchive.open) return;
      stopTunerTone();
      closeMiniPlayers();
    });
  }

  // 5. Tablero de Estampas Y2K Interactivo con Persistencia Completa
  const stampWall = document.getElementById('stamp-display-wall');
  const stampButtons = document.querySelectorAll('.sm-stamp-btn');
  const stampCountEl = document.getElementById('stamp-count');
  const clearStampsBtn = document.getElementById('sm-clear-stamps');

  const defaultStamps = [
    { char: '♥', rot: -8 },
    { char: '⚡', rot: 12 },
    { char: '🎤', rot: -15 },
    { char: '★', rot: 6 },
    { char: '🌹', rot: -4 },
    { char: '✦', rot: 10 },
    { char: '🌸', rot: -12 }
  ];

  let currentStamps = [];
  try {
    const savedStamps = JSON.parse(localStorage.getItem('sm_stamps_wall') || 'null');
    if (Array.isArray(savedStamps) && savedStamps.length > 0) {
      currentStamps = savedStamps;
    } else {
      currentStamps = defaultStamps;
    }
  } catch (e) {
    currentStamps = defaultStamps;
  }

  function renderStampWall() {
    if (!stampWall) return;
    stampWall.innerHTML = '';
    currentStamps.forEach(s => {
      const span = document.createElement('span');
      span.textContent = s.char;
      span.style.display = 'inline-block';
      span.style.transform = `rotate(${s.rot}deg)`;
      stampWall.appendChild(span);
    });
    if (stampCountEl) {
      stampCountEl.textContent = currentStamps.length;
    }
  }

  renderStampWall();

  if (stampWall && stampButtons.length > 0) {
    stampButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const stampChar = btn.getAttribute('data-stamp');
        if (!stampChar) return;

        const rot = Math.floor(Math.random() * 36 - 18);
        currentStamps.push({ char: stampChar, rot: rot });
        if (currentStamps.length > 30) {
          currentStamps.shift();
        }

        renderStampWall();
        try {
          localStorage.setItem('sm_stamps_wall', JSON.stringify(currentStamps));
          localStorage.setItem('sm_stamps_count', currentStamps.length);
        } catch (e) {}

        playRetroChime(660);
      });
    });
  }

  if (clearStampsBtn && stampWall) {
    clearStampsBtn.addEventListener('click', () => {
      currentStamps = [{ char: '♥', rot: -6 }, { char: '⚡', rot: 8 }];
      renderStampWall();
      try {
        localStorage.setItem('sm_stamps_wall', JSON.stringify(currentStamps));
        localStorage.setItem('sm_stamps_count', currentStamps.length);
      } catch (e) {}
    });
  }

  // Helper para chimes retro (utiliza el AudioContext compartido)
  function playRetroChime(freq = 520) {
    if (client) { sendAudio({type:'chime',frequency:Number(freq)}); return; }
    try {
      const ctx = ensureAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.2);
    } catch (e) {}
  }
}

    // Preserve classic identifiers for existing inline code and local inspection.
    Object.assign(host, { updateDaily, updateClock, updateSiteScale, initRunner, initPanelControls,
      formatTime, updateNP, initNowPlaying, createFallingElements, startNote, stopNote, initOmikuji, initTechSection, initSobreMiSection });
    Object.defineProperties(host, {
      playlist: { configurable:true, get:()=>playlist }, favAudio: { configurable:true, get:()=>favAudio },
      npIndex: { configurable:true, get:()=>npIndex, set:value=>{ npIndex=value; if(client)sendAudio({type:'music',action:'select',value}); } },
      isPlaying: { configurable:true, get:()=>isPlaying, set:value=>{ isPlaying=value; if(client)sendAudio({type:'music',action:value?'play':'pause'}); } },
      startFrom: { configurable:true, get:()=>startFrom, set:value=>{ startFrom=value; if(client)sendAudio({type:'music',action:'seek',value}); } },
      npVolume: { configurable:true, get:()=>npVolume, set:value=>{ npVolume=value; if(client)sendAudio({type:'music',action:'volume',value}); } }
    });
  }
  if (client) client.ready.then(execute, () => {
    execute();
    const note=document.createElement('p');note.id='site-audio-connection-error';note.setAttribute('role','alert');
    note.textContent='Conexión de audio no disponible. Recarga esta sección.';document.body.appendChild(note);
  });
  else execute();
})(window);
