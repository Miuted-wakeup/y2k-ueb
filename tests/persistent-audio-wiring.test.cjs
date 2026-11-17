const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = ['index','japan','music','canto','tech','sobre-mi','cosas'];
test('every direct section loads the shared host before legacy scripts and has a no-JS fallback',()=>{
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page+'.html'),'utf8'),head=html.split('</head>')[0];
    let previous=-1;
    for(const name of ['site-audio-core.js','home-companion-speech.js','site-audio-engine.js','site-audio-client.js','site-audio-shell.js']){
      const position=head.indexOf('src="'+name+'"');assert.ok(position>previous,page+': '+name+' loads in order');previous=position;
    }
    assert.ok(head.indexOf('<meta name="referrer" content="no-referrer"')>0&&head.indexOf('<meta name="referrer" content="no-referrer"')<head.indexOf('<link'),page+': referrer policy precedes all resource requests');
    assert.match(head,/href="site-audio-shell\.css"/);assert.match(head,/<noscript>/);
    assert.equal((html.match(/src="home-companion-speech\.js"/g)||[]).length,1,page+': no duplicate factory');
    assert.doesNotMatch(html,/section-loading\.(js|css|png)/);
  }
});
