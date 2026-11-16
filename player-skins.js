// Presentation only: the original shared player remains the sole audio controller.
// This file is deliberately not loaded by Sobre mí.
(() => {
  if (window.SiteAudioShell?.isHost) return;
  const client = window.SiteAudioClient?.isFrame ? window.SiteAudioClient : null;
  const init = () => {
    const bar = document.querySelector('[data-player-skin]');
    if (!bar) return;
    const audio = client ? client.getPlayer() : bar.querySelector('#audio-player');
    const play = bar.querySelector('#np-play');
    const label = bar.querySelector('#np-label');
    const volume = bar.querySelector('#np-volume');
    const progress = bar.querySelector('#np-progress');
    const paintProgress = () => progress.style.setProperty('--np-fill', `${progress.value}%`);
    const sync = () => {
      const playing = !audio.paused && !audio.ended;
      bar.classList.toggle('np-playing', playing);
      play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
      play.title = playing ? 'Pausar' : 'Reproducir';
      const state = playing ? 'SONANDO' : audio.currentTime > 0 ? 'EN PAUSA' : 'EN ESPERA';
      if (label.textContent !== state) label.textContent = state;
      bar.querySelector('#np-volume-value').textContent = `${Math.round(audio.volume * 100)}%`;
      volume.style.setProperty('--np-fill', `${audio.volume * 100}%`);
      paintProgress();
    };
    ['play', 'pause', 'ended', 'emptied', 'seeked', 'volumechange'].forEach(event => audio.addEventListener(event, sync));
    ['timeupdate', 'loadedmetadata'].forEach(event => audio.addEventListener(event, paintProgress));
    progress.addEventListener('input', paintProgress);
    sync();
  };
  const ready = () => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  };
  if (client) client.ready.then(ready, ready); else ready();
})();
