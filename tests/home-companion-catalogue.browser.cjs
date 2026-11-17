// Render every configured message, not only a sample, with the real original atlas.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {startBrowser,pause}=require('./site-audio-browser-utils.cjs');
const messages=require('../home-companion-messages.js'),{EMOTIONS}=require('../home-companion.js');
(async()=>{
 const s=await startBrowser({prefix:'y2k-catalogue-audit-',instrument:'Math.random=()=>window.__testRandom??.1;'}),results=[];
 try{
  for(const protocol of ['http','file']){
   const url=protocol==='http'?s.origin+'/index.html?catalogue=audit':pathToFileURL(path.join(s.root,'index.html')).href+'?catalogue=audit';
   await s.navigate(url,'silent');
   await s.wait("document.querySelector('#home-companion').classList.contains('hc-art-ready')&&!document.querySelector('.hc-portrait').disabled");
   for(const [width,height]of[[1768,1016],[1440,900],[1024,900]]){
    await s.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(120);
    for(let index=0;index<messages.length;index++){
     const actual=await s.page(`(()=>{
      const root=document.querySelector('#home-companion'),d=root.homeCompanion,list=HomeCompanion.MESSAGES,target=${index};
      d.setReadingHeld(false);if(d.snapshot().typing)d.interact();
      if(d.snapshot().index!==target){
       const previous=d.snapshot().index;
       if(previous>=0){const step=(target-previous+list.length)%list.length;window.__testRandom=(step-.5)/(list.length-1);}
       d.interact();
      }
      if(d.snapshot().typing)d.interact();d.setReadingHeld(true);
      const b=root.querySelector('.hc-dialogue').getBoundingClientRect(),a=root.querySelector('.hc-message-link');
      const glyphs=[...root.querySelectorAll('.hc-glyph')];
      return{index:d.snapshot().index,plain:root.querySelector('.hc-plain').textContent,
       visual:glyphs.map(g=>g.dataset.glyph).join(''),expected:HomeCompanionArt.normalizeText(list[target].text).split(' ').join(''),
       inverted:glyphs.filter(g=>g.dataset.glyph==='¿'||g.dataset.glyph==='¡').map(g=>({char:g.dataset.glyph,transform:g.style.transform})),
       outside:glyphs.filter(g=>{const r=g.getBoundingClientRect();return r.x<b.x-1||r.right>b.right+1||r.y<b.y-1||r.bottom>b.bottom+1}).length,
       bubble:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},face:Number(root.querySelector('.hc-face').dataset.frame),
       link:a.hidden?null:{href:a.href,target:a.target,rel:a.rel,text:a.textContent,inert:a.inert},title:root.querySelector('.hc-portrait').getAttribute('title')};
     })()`);
     const expected=messages[index];assert.equal(actual.index,index);assert.equal(actual.plain,expected.text);assert.equal(actual.visual,actual.expected);
     assert.equal((actual.visual.match(/\?/g)||[]).length,(expected.text.match(/\?/g)||[]).length,expected.text);
     assert.equal((actual.visual.match(/¿/g)||[]).length,(expected.text.match(/¿/g)||[]).length,expected.text);
     assert.equal((actual.visual.match(/¡/g)||[]).length,(expected.text.match(/¡/g)||[]).length,expected.text);
     assert.ok(actual.inverted.every(g=>g.transform==='rotate(180deg)'));
     assert.equal(actual.outside,0,expected.text);assert.ok(actual.bubble.x>=0&&actual.bubble.y>=0&&actual.bubble.right<=width,expected.text);
     assert.equal(actual.face,EMOTIONS[expected.mood].rest);assert.equal(actual.title,null);
     if(expected.link){assert.equal(actual.link.href,expected.link.url);assert.equal(actual.link.target,'_blank');assert.match(actual.link.rel,/noopener/);assert.match(actual.link.rel,/noreferrer/);assert.equal(actual.link.inert,false);}
     else assert.equal(actual.link,null);
     results.push({protocol,width,height,index,inverted:actual.inverted.length,linked:!!expected.link});
     if(protocol==='http'&&width===1024&&(index===3||index===messages.length-1))await s.screenshot('message-'+index+'-'+width+'.png');
    }
    console.log('PASS '+protocol+' '+width+'x'+height+': all'+messages.length+' messages, real glyphs, punctuation, faces, links and bounds');
   }
   assert.equal(await s.host('SiteAudioShell.engine.snapshot().permission'),'silent');
  }
  assert.equal(s.requests.some(url=>/^https:\/\/(youtu\.be|(?:www\.)?youtube\.com)\//.test(url)),false,'No video is fetched automatically');
  assert.deepEqual(s.errors,[]);fs.writeFileSync(path.join(s.output,'catalogue.json'),JSON.stringify(results,null,2));
  console.log('PASS full catalogue: '+results.length+' rendered cases. Evidence: '+s.output);
 }catch(error){await s.screenshot('failure.png');console.error('Evidence: '+s.output);throw error;}
 finally{s.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
