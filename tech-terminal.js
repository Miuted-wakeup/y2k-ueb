// Local commands with an optional, explicitly opened external Paint app. No shell, eval or new audio context.
(function (host) {
  'use strict';

  const PROMPT = 'PS C:\\Users\\muted>';
  const ART = Object.freeze({
    cat: String.raw` /\_/\
( o.o )
 > ^ <
connected, quietly.`,
    pc: String.raw` .---------------.
 |  NAVI  //  07 |
 |   > hello_   |
 |______________|
       |__|
    ___|__|___
   /__________\
`,
    kirby: String.raw`    .-"""-.
  /  o   o  \
 (     v     )
  \  .---.  /
   '(_)-(_)'`,
    flower: String.raw`    .-.-.
   (  :  )
  (  \|/  )
   ' /|\ '
      |
    \ | /
     \|/
      |
a little life in the wired.`
  });
  const COMMANDS = Object.freeze({
    help: ['help [comando]', 'Muestra esta guía o los detalles de un comando.'],
    paint: ['paint [abrir|minimizar|restaurar|cerrar]', 'Abre el Paint clásico en su propia zona del escritorio, fuera de la consola. Carga JSPaint externo y necesita Internet. Cerrar/minimizar conserva el dibujo mientras sigues en Tech; guárdalo antes de salir.'],
    fondo: ['fondo [lista|original|id]', 'Sin argumentos abre los fondos de Tech. lista muestra sus identificadores; original restaura el fondo inicial. Tu elección se guarda solo en este navegador.'],
    ascii: ['ascii [cat|pc|kirby|flower]', 'Dibuja en la consola. Sin argumento aparece un gato.'],
    shurelia: ['shurelia [30..180]', 'Abre la biblioteca de Shurelia en el panel derecho durante 90 segundos, o el tiempo que indiques. Repetir renueva la visita.'],
    talk: ['talk', 'Pide otro diálogo a Shurelia. También puedes tocar su retrato; durante una frase, el primer toque la completa.'],
    bye: ['bye', 'Devuelve a Shurelia a Home y restaura Lain y las estadísticas de NAVI.'],
    matrix: ['matrix [on|off]', 'Enciende lluvia digital durante 20 segundos; off la detiene. Con movimiento reducido, la señal queda estática.'],
    theme: ['theme [cyan|amber|green]', 'Cambia de verdad los colores de la consola. cyan restaura el original.'],
    ping: ['ping', 'Mide el tiempo de respuesta del navegador, aquí mismo y sin contactar servidores.'],
    date: ['date', 'Muestra la fecha y hora actuales de Bogotá.'],
    whoami: ['whoami', 'Muestra la identidad de esta consola y cuánto lleva abierta la sesión.'],
    specs: ['specs', 'Abre la ficha del equipo retro que decora esta web.'],
    neofetch: ['neofetch', 'Dibuja NAVI y muestra su ficha junto al tiempo real de esta sesión.'],
    quote: ['quote', 'Encuentra una pequeña nota distinta sobre este rincón de internet.'],
    history: ['history', 'Lista tus últimos comandos de esta visita. Flecha arriba/abajo permite volver a escribirlos.'],
    clear: ['clear / cls', 'Limpia el texto y apaga Matrix. La visita de Shurelia continúa hasta bye o su despedida.']
  });
  const NOTES = [
    'Una web hecha a mano también puede ser un lugar al que volver.',
    'No todo lo que brilla necesita una notificación.',
    'Un GIF, una canción y alguien al otro lado. A veces basta con eso.',
    'Guarda algo pequeño de hoy. El futuro también necesitará nostalgia.',
    'El wired es enorme. Este rincón no tiene prisa.'
  ];
  const mounts = new WeakMap();

  function parse(raw) {
    const parts = String(raw).trim().toLowerCase().split(/\s+/);
    return { name: parts[0] === 'cls' ? 'clear' : parts[0], args: parts.slice(1) };
  }

  function help(name) {
    if (name) return Object.hasOwn(COMMANDS, name) ? COMMANDS[name].join('\n') : `No hay ayuda para '${name}'. Escribe help.`;
    return 'NAVI // pequeños programas para quedarse un rato\n\n'
      + Object.values(COMMANDS).map(([usage, description]) => `${usage}\n  ${description}`).join('\n\n')
      + '\n\nLos comandos son locales; Paint carga JSPaint externo únicamente cuando lo abres.\nEl PC es una ficha retro, no un monitor de tu ordenador.\nEscape apaga Matrix y despide a la visita; las flechas recorren tus comandos.';
  }

  function mount(root, win = host) {
    if (!root) return null;
    if (mounts.has(root)) return mounts.get(root);
    const input = root.querySelector('#terminal-cli-input');
    const output = root.querySelector('#terminal-cli-output');
    const session = root.querySelector('#terminal-cli-session');
    const main = root.querySelector('.terminal-main');
    if (!input || !output || !session || !main) return null;
    const metrics = win.TechTerminalMetrics?.mount(root, win);
    const guest = win.TechTerminalGuest?.create(win);
    const history = [];
    const pending = new Set();
    const started = win.performance.now();
    let cursor = 0, draft = '', note = -1, rain = null, rainTimer = null, generation = 0, destroyed = false;
    const listeners = [];
    const listen = (element, event, callback) => {
      element.addEventListener(event, callback);
      listeners.push(() => element.removeEventListener(event, callback));
    };
    const scroll = () => { session.scrollTop = session.scrollHeight; };
    function append(text) {
      // Bounded scrollback; every character, including unrecognized input, stays text.
      output.textContent = (output.textContent + text).slice(-24000);
      scroll();
    }
    const uptime = () => {
      const seconds = Math.floor((win.performance.now() - started) / 1000);
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };
    function stopRain() {
      if (rainTimer !== null) win.clearTimeout(rainTimer);
      rainTimer = null;
      rain?.remove();
      rain = null;
      root.classList.remove('terminal-matrix-active');
    }
    function startRain() {
      stopRain();
      rain = win.document.createElement('div');
      rain.className = 'terminal-matrix';
      rain.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 18; index++) {
        const column = win.document.createElement('span');
        column.textContent = Array.from({ length: 26 }, () => '01ﾅﾋﾞｱｴｵ'[Math.floor(win.Math.random() * 8)]).join('\n');
        column.style.setProperty('--column', index);
        column.style.setProperty('--duration', `${4 + index % 4}s`);
        column.style.setProperty('--delay', `${-(index % 7)}s`);
        rain.appendChild(column);
      }
      main.prepend(rain);
      root.classList.add('terminal-matrix-active');
      rainTimer = win.setTimeout(stopRain, 20000);
    }
    function clear() {
      generation++;
      pending.forEach(timer => win.clearTimeout(timer));
      pending.clear();
      stopRain();
      output.textContent = '';
      session.scrollTop = 0;
    }
    function run(raw) {
      if (destroyed || !String(raw).trim()) return;
      raw = String(raw).slice(0, 500);
      const { name, args } = parse(raw);
      history.push(raw);
      if (history.length > 50) history.shift();
      cursor = history.length;
      draft = '';
      if (name === 'clear') { clear(); return; }
      append(`${PROMPT} ${raw}\n`);
      let response;
      if (args[0] === '--help') response = help(name);
      else switch (name) {
        case 'help': response = help(args[0] === 'cls' ? 'clear' : args[0]); break;
        case 'paint': response = win.TechPaint?.command(args, win) || 'Paint no está disponible en este momento. Puedes seguir usando la consola.'; break;
        case 'fondo': response = win.TechBackgrounds?.command(args, win) || 'El selector de fondos no está disponible en este momento.'; break;
        case 'ascii':
          response = Object.hasOwn(ART, args[0] || 'cat') ? ART[args[0] || 'cat'] : 'Elige: ascii cat, ascii pc, ascii kirby o ascii flower.';
          break;
        case 'shurelia': {
          const seconds = args.length ? Number(args[0]) : 90;
          if (args.length > 1 || !Number.isInteger(seconds) || seconds < 30 || seconds > 180) {
            response = 'Usa shurelia o shurelia 30..180 (segundos).'; break;
          }
          response = guest?.summon(seconds)
            ? `Biblioteca de Home conectada al panel derecho. Visita de ${seconds}s.\nToca su retrato o escribe talk; bye restaura NAVI.`
            : 'No se pudo abrir la visita. Puedes seguir usando la consola e intentarlo de nuevo.';
          break;
        }
        case 'talk': response = guest?.talk() ? 'Shurelia tiene algo que contarte…' : 'Primero escribe shurelia para invitarla.'; break;
        case 'bye': response = guest?.dismiss() ? 'Shurelia vuelve a Home. Puedes llamarla cuando quieras.' : 'Shurelia está en Home. Escribe shurelia para invitarla.'; break;
        case 'matrix':
          if (args.length > 1 || args[0] && !['on', 'off'].includes(args[0])) response = help('matrix');
          else if (args[0] === 'off') { stopRain(); response = 'Señal en reposo. Lluvia digital apagada.'; }
          else { startRain(); response = 'Lluvia digital encendida durante 20s. matrix off para detenerla.'; }
          break;
        case 'theme':
          if (args.length === 1 && ['cyan', 'amber', 'green'].includes(args[0])) {
            root.dataset.theme = args[0]; response = `Fósforo ${args[0]} encendido.`;
          } else response = help('theme');
          break;
        case 'ping': {
          const began = win.performance.now(), version = generation;
          const timer = win.setTimeout(() => {
            pending.delete(timer);
            if (!destroyed && version === generation) append(`PONG // navegador: ${(win.performance.now() - began).toFixed(2)} ms\nRespuesta local, sin salir de esta página.\n\n`);
          }, 0);
          pending.add(timer);
          response = 'Escuchando el pulso del navegador…';
          break;
        }
        case 'date': response = new win.Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'America/Bogota' }).format(new win.Date()) + '\nAmerica/Bogota'; break;
        case 'whoami': response = `muted@navi\nUn pequeño rincón del wired.\nEsta sesión lleva ${uptime()}.`; break;
        case 'history': response = history.map((value, index) => `${String(index + 1).padStart(2, ' ')}  ${value}`).join('\n'); break;
        case 'specs': response = 'NAVI // equipo retro de muted · 2007\nCPU     Intel Core 2 Duo E6600 @ 2.40GHz\nGPU     NVIDIA GeForce 8800 GTX · 768 MiB GDDR3\nRAM     4.00 GiB DDR2 800MHz\nHDD     250 GB SATA · 7200 RPM\nAUDIO   Sound Blaster X-Fi\nDISPLAY SyncMaster 226BW · 1680x1050 @ 60Hz\nSYSTEM  Windows Vista Ultimate x64'; break;
        case 'neofetch': response = `${ART.pc}\n\nmuted@navi\nOS: Windows Vista Ultimate x64\nShell: Windows PowerShell 1.0\nCPU: Intel Core 2 Duo E6600 @ 2.40GHz\nGPU: NVIDIA GeForce 8800 GTX\nMemory: 4.00 GiB DDR2\nSession: ${uptime()}\nTheme: ${root.dataset.theme || 'cyan'} // Lain NAVI`; break;
        case 'quote': note = (note + 1 + Math.floor(win.Math.random() * (NOTES.length - 1))) % NOTES.length; response = NOTES[note]; break;
        default: response = `Comando '${raw}' no reconocido. Prueba help, ascii o shurelia.`;
      }
      append(`${response}\n\n`);
    }
    listen(input, 'keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        const raw = input.value;
        input.value = '';
        run(raw);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (cursor === history.length) draft = input.value;
        cursor = Math.max(0, Math.min(history.length, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
        input.value = cursor < history.length ? history[cursor] : draft;
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (event.key === 'Escape') {
        stopRain();
        guest?.dismiss();
      }
    });
    root.querySelectorAll('.term-btn').forEach(button => listen(button, 'click', () => {
      run(button.dataset.cmd);
      // App commands can intentionally move focus outside the console.
      const active = win.document.activeElement;
      if (!active || active === win.document.body || root.contains(active)) input.focus({ preventScroll: true });
    }));
    listen(session, 'click', event => {
      if (event.target === session || event.target === output && !win.getSelection()?.toString()) input.focus({ preventScroll: true });
    });
    // Narrower panes wrap existing lines; keep the editable prompt in view after resize.
    listen(win, 'resize', scroll);
    const controller = {
      run,
      snapshot: () => ({ destroyed, matrix: !!rain, history: history.slice(), guest: guest?.snapshot() || { active: false } }),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clear();
        metrics?.destroy();
        guest?.destroy();
        listeners.splice(0).forEach(remove => remove());
        mounts.delete(root);
      }
    };
    listen(win, 'pagehide', event => {
      controller.destroy();
      if (event.persisted) win.addEventListener('pageshow', () => {
        if (root.isConnected) mount(root, win);
      }, { once: true });
    });
    mounts.set(root, controller);
    return controller;
  }
  const api = { mount, parse, help, ART, COMMANDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else host.TechTerminal = api;
})(typeof window === 'undefined' ? globalThis : window);
