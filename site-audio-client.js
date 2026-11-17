// Explicit child facades. Native media/context ownership stays in the persistent parent.
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.SiteAudioClient = api.createClient({ window: host, Core: host.SiteAudioCore });
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
  const text = (value, max = 4096) => typeof value === 'string' && value.length <= max;
  const number = value => Number.isFinite(value) && value >= 0;
  const contexts = ['running','suspended','closed','interrupted','uninitialized','unsupported'];
  function validMedia(value) {
    return keys(value, ['src','index','title','artist','paused','playing','ended','currentTime','duration','volume','muted']) &&
      text(value.src) && ['paused','playing','ended','muted'].every(key => typeof value[key] === 'boolean') &&
      number(value.currentTime) && (value.duration === null || number(value.duration)) && number(value.volume) && value.volume <= 1 &&
      (value.index === undefined || Number.isInteger(value.index) && value.index >= 0) &&
      (value.title === undefined || text(value.title, 500)) && (value.artist === undefined || text(value.artist, 500));
  }
  function validState(value) {
    return keys(value, ['revision','permission','contextState','music','favorite','speech','entered','publicURL','section']) &&
      Number.isInteger(value.revision) && value.revision >= 0 && ['active','blocked','silent','unsupported'].includes(value.permission) &&
      contexts.includes(value.contextState) &&
      validMedia(value.music) && validMedia(value.favorite) &&
      keys(value.speech, ['supported','unlocked','contextState','activeNotes','blipsPlayed']) &&
      typeof value.speech.supported === 'boolean' && typeof value.speech.unlocked === 'boolean' &&
      (value.speech.contextState === undefined || contexts.includes(value.speech.contextState)) &&
      number(value.speech.activeNotes) && number(value.speech.blipsPlayed) &&
      typeof value.entered === 'boolean' && text(value.publicURL) && ['home','japan','music','canto','tech','sobre-mi','cosas'].includes(value.section);
  }
  const copy = state => ({ ...state, music: { ...state.music }, favorite: { ...state.favorite }, speech: { ...state.speech } });
  const error = (name, message) => Object.assign(new Error(message), { name });
  function createClient({ window: win, Core, timeout = 5000 }) {
    const info = Core?.frameInfo(win), isFrame = !!info;
    const empty = {src:'',paused:true,playing:false,ended:false,currentTime:0,duration:null,volume:.5,muted:false};
    let current = {revision:0,permission:'blocked',contextState:'uninitialized',music:{...empty,index:0,title:'',artist:''},favorite:{...empty},speech:{supported:false,unlocked:false,activeNotes:0,blipsPlayed:0},entered:false,publicURL:info?.publicURL||win.location.href,section:'home'};
    let destroyed = false, serial = 0, settled = !isFrame, readyTimer;
    const subscribers = new Set(), pending = new Map(), voices = new Set();
    let resolveReady, rejectReady;
    const ready = new Promise((resolve,reject) => { resolveReady=resolve; rejectReady=reject; });
    // Attach a handler immediately; consumers still receive the original rejection.
    ready.catch(() => {});
    const origin = info ? Core.messageOrigin(info.publicURL) : '';
    const targetOrigin = origin === 'null' ? '*' : origin;
    function send(kind, extra = {}) {
      if (!isFrame || destroyed) return false;
      win.parent.postMessage({channel:Core.PROTOCOL,kind,token:info.token,epoch:info.epoch,...extra},targetOrigin);
      return true;
    }
    function command(cmd) {
      if (!isFrame || destroyed) return Promise.reject(error('AbortError','Audio bridge is not active'));
      let bounded = false;
      try { bounded=plain(cmd)&&['music','favorite','speech','synth','tuner','chime'].includes(cmd.type)&&JSON.stringify(cmd).length<=2048; } catch (_) {}
      if (!bounded) return Promise.reject(error('TypeError','Invalid audio command'));
      const id = 'c' + ++serial;
      return new Promise((resolve,reject) => {
        const timer = win.setTimeout(() => { pending.delete(id); reject(error('TimeoutError','Audio command acknowledgement timed out')); },timeout);
        pending.set(id,{resolve,reject,timer,command:cmd}); send('command',{id,command:cmd});
      });
    }
    const quiet = cmd => { command(cmd).catch(() => {}); };
    const EventTargetCtor = win.EventTarget || EventTarget, EventCtor = win.Event || Event;
    class MediaFacade extends EventTargetCtor {
      constructor(type) { super(); Object.defineProperty(this,'type',{value:type}); this.stagedSource=null; }
      get src() { return current[this.type].src; }
      set src(value) { if (typeof value !== 'string') return; if(this.type==='favorite')this.stagedSource=value; else { const index=Core.PLAYLIST.findIndex(item=>new URL(item.src,info.publicURL).href===new URL(value,info.publicURL).href);if(index>=0)quiet({type:'music',action:'select',value:index}); } }
      get paused() { return current[this.type].paused; }
      get ended() { return current[this.type].ended; }
      get currentTime() { return current[this.type].currentTime; }
      set currentTime(value) { quiet({type:this.type,action:'seek',value:Number(value)}); }
      get duration() { return current[this.type].duration === null ? NaN : current[this.type].duration; }
      get volume() { return current[this.type].volume; }
      set volume(value) { quiet({type:this.type,action:'volume',value:Number(value)}); }
      get muted() { return current[this.type].muted; }
      set muted(value) { quiet({type:'music',action:'mute',value:!!value}); }
      play() { return command({type:this.type,action:'play',...(this.type==='favorite'&&this.stagedSource?{value:this.stagedSource}:{})}); }
      pause() { quiet({type:this.type,action:'pause'}); }
      sync(before, after) {
        const emit = type => this.dispatchEvent(new EventCtor(type));
        if(before.src!==after.src)emit('emptied');
        if(before.duration!==after.duration || before.src!==after.src)emit('loadedmetadata');
        if(before.paused!==after.paused)emit(after.paused?'pause':'play');
        if(!before.ended&&after.ended)emit('ended');
        if(before.volume!==after.volume||before.muted!==after.muted)emit('volumechange');
        if(before.currentTime!==after.currentTime)emit('timeupdate');
      }
    }
    const player=new MediaFacade('music'),favorite=new MediaFacade('favorite');
    function acceptState(state) {
      if (state.revision < current.revision) return;
      const before=current; current=copy(state);
      player.sync(before.music,current.music); favorite.sync(before.favorite,current.favorite);
      subscribers.forEach(fn=>{try{fn(copy(current));}catch(failure){win.console?.error('Audio state subscriber failed',failure);}});
      if(!settled){settled=true;win.clearTimeout(readyTimer);resolveReady(copy(current));}
    }
    function receive(event) {
      if(destroyed||event.source!==win.parent||event.origin!==origin)return;
      const m=event.data;
      if(!plain(m)||m.channel!==Core.PROTOCOL||m.token!==info.token||m.epoch!==info.epoch)return;
      if(m.kind==='state'&&keys(m,['channel','kind','token','epoch','state'])&&validState(m.state)){acceptState(m.state);return;}
      if(m.kind==='ack'&&keys(m,['channel','kind','token','epoch','id','ok','value','error','state'])&&text(m.id,80)&&typeof m.ok==='boolean'&&validState(m.state)&&
          (m.value===undefined||m.value===null||typeof m.value==='boolean'||Number.isFinite(m.value)||text(m.value,1000))&&
          (m.error===undefined||keys(m.error,['name','message'])&&text(m.error.name,80)&&text(m.error.message,1000))){
        const call=pending.get(m.id);if(!call)return;
        pending.delete(m.id);win.clearTimeout(call.timer);acceptState(m.state);
        if(m.ok){
          if(call.command.action==='seek'&&['music','favorite'].includes(call.command.type))(call.command.type==='music'?player:favorite).dispatchEvent(new EventCtor('seeked'));
          call.resolve(m.value);
        }else call.reject(error(m.error?.name||'Error',m.error?.message||'Audio command failed'));
        return;
      }
      if(m.kind==='replace'&&keys(m,['channel','kind','token','epoch','href'])&&text(m.href)){
        const route=Core.resolveRoute(m.href,info.publicURL);
        if(!route)return;
        const url=new URL(m.href,info.publicURL);
        if(Core.messageOrigin(url.href)!==origin||!/^[a-f0-9]{32}$/.test(url.searchParams.get(Core.FRAME_PARAM)||'')||! /^[1-9]\d*$/.test(url.searchParams.get(Core.EPOCH_PARAM)||''))return;
        win.location.replace(url.href);
      }
    }
    const navigate = event => {
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.hasAttribute('download'))return;
      const target=anchor.getAttribute('target');if(target&&target.toLowerCase()!=='_self')return;
      const href=anchor.getAttribute('href');if(!href)return;
      if(href==='#'){event.preventDefault();return;}
      const route=Core.resolveRoute(href,info.publicURL);
      if(!route){try{if(['http:','https:','file:'].includes(new URL(href,info.publicURL).protocol))anchor.setAttribute('target','_top');}catch(_){}return;}
      event.preventDefault();send('navigate',{href:route.href});
    };
    function createSpeechLease(name) {
      if(typeof name!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(name))throw error('TypeError','Invalid voice identifier');
      let released=false;
      const active=()=>!released&&!destroyed&&current.entered&&current.permission==='active'&&current.contextState==='running'&&current.speech.supported&&current.speech.unlocked;
      const lease={
        unlock(){if(active())return Promise.resolve(true);send('request-activation');return Promise.resolve(false);},
        playGlyph({character,index=0,mood='calm'}={}){
          if(!active()||current.music.muted||current.music.volume<=0||typeof character!=='string'||!/^\p{L}$|^\p{N}$/u.test(character)||!Number.isInteger(index)||index<0||index>1000000||!['warm','playful','sleepy','curious','serious','calm'].includes(mood))return false;
          quiet({type:'speech',action:'glyph',voiceId:name,character,index,mood});return true;
        },
        stop(){if(!released&&!destroyed)quiet({type:'speech',action:'stop',voiceId:name});},
        destroy(){if(released)return;released=true;voices.delete(lease);if(!destroyed)quiet({type:'speech',action:'release',voiceId:name});},
        snapshot(){return {...current.speech,contextState:current.contextState,unlocked:active()&&current.speech.unlocked};}
      };voices.add(lease);return lease;
    }
    function destroy() {
      if(destroyed)return;
      voices.forEach(voice=>voice.destroy());quiet({type:'synth',action:'stop'});quiet({type:'tuner',action:'stop'});
      destroyed=true;win.clearTimeout(readyTimer);win.removeEventListener('message',receive);win.removeEventListener('pagehide',leaving);win.removeEventListener('pageshow',showing);win.document?.removeEventListener('click',navigate);
      pending.forEach(call=>{win.clearTimeout(call.timer);call.reject(error('AbortError','Audio bridge was destroyed'));});pending.clear();subscribers.clear();
      if(!settled){settled=true;rejectReady(error('AbortError','Audio bridge was destroyed'));}
    }
    const leaving = event => {
      send('page-leaving',{persisted:!!event.persisted}); voices.forEach(voice=>voice.stop());quiet({type:'synth',action:'stop'});quiet({type:'tuner',action:'stop'});
      pending.forEach(call=>{win.clearTimeout(call.timer);call.reject(error('AbortError','Audio document is leaving'));});pending.clear();
      if(!event.persisted)destroy();
    };
    const showing = event => { if(event.persisted)send('hello'); };
    if(isFrame){
      // Opaque file origins still need source+capability validation; never leak that URL.
      if(win.document?.head){const meta=win.document.createElement('meta');meta.name='referrer';meta.content='no-referrer';win.document.head.appendChild(meta);}
      win.addEventListener('message',receive);win.addEventListener('pagehide',leaving);win.addEventListener('pageshow',showing);win.document?.addEventListener('click',navigate);
      readyTimer=win.setTimeout(()=>{if(!settled){settled=true;rejectReady(error('TimeoutError','Connection to site audio failed'));}},timeout);
      send('hello');
    }else resolveReady(copy(current));
    return {isFrame,ready,state:()=>copy(current),getPlayer:()=>player,getFavorite:()=>favorite,
      subscribe(fn){subscribers.add(fn);if(settled)fn(copy(current));return()=>subscribers.delete(fn);},command,createSpeechLease,
      requestActivation:()=>send('request-activation'),pageReady:()=>send('page-ready'),destroy};
  }
  return {createClient,validState};
});
