'use strict';
const $ = id => document.getElementById(id);
const editor = $('editor');
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const SETTINGS = ['mode','font','size','line-height','padding','background','foreground','color-a','color-b','name-a','name-b','ratio','heading','footer'];
const defaults = {mode:'novel',font:'serif',size:'23','line-height':'1.75',padding:'64',background:'#f2ede6',foreground:'#2c3545','color-a':'#ad4052','color-b':'#345679','name-a':'CHARACTER A','name-b':'CHARACTER B',ratio:'auto',heading:'EXCERPT / 001',footer:'— ARCHIVE —'};
const presets = {
  paper:{background:'#f2ede6',foreground:'#2c3545','color-a':'#ad4052','color-b':'#345679',font:'serif'},
  night:{background:'#192235',foreground:'#e8e4e4','color-a':'#f09bad','color-b':'#92b7dd',font:'serif'},
  rose:{background:'#f2e3e6',foreground:'#463440','color-a':'#a43752','color-b':'#59628b',font:'serif'},
  mono:{background:'#eeeeee',foreground:'#292929','color-a':'#555555','color-b':'#666666',font:'sans'}
};
let lastSelection = null;
let scheduled = false;
let toastTimer;
let saveTimer;
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2800);}
function settings(){return Object.fromEntries(SETTINGS.map(id=>[id,$(id).value]));}
function setSettings(o){for(const id of SETTINGS) if(Object.prototype.hasOwnProperty.call(o,id)) $(id).value=o[id];updateLabels();}
function updateLabels(){for(const id of ['size','line-height','padding']) $(id+'-label').textContent=$(id).value+(id==='size'||id==='padding'?'px':'');}
function getParagraph(node){let n=node?.nodeType===Node.TEXT_NODE?node.parentElement:node;while(n && n!==editor){if(n.parentElement===editor && /^(P|DIV|H[1-6])$/.test(n.tagName))return n;n=n.parentElement;}return null;}
function getFocusedParagraph(){const s=window.getSelection();return getParagraph(s?.anchorNode);}
function updateSpeakerSelection(){const speaker=getFocusedParagraph()?.dataset.speaker||'narration';document.querySelectorAll('.speaker-choice').forEach(b=>b.classList.toggle('active',b.dataset.speaker===speaker));}
function saveSelection(){const s=window.getSelection();if(s&&s.rangeCount&&editor.contains(s.anchorNode))lastSelection=s.getRangeAt(0).cloneRange();}
function restoreSelection(){if(!lastSelection)return;const s=window.getSelection();s.removeAllRanges();try{s.addRange(lastSelection);}catch{editor.focus();}}
function cleanPastedText(text){return text.replace(/\r\n?/g,'\n');}
editor.addEventListener('paste',e=>{e.preventDefault();const t=cleanPastedText(e.clipboardData.getData('text/plain'));document.execCommand('insertText',false,t);scheduleUpdate();});
editor.addEventListener('input',scheduleUpdate);
editor.addEventListener('keyup',()=>{saveSelection();updateSpeakerSelection();});
editor.addEventListener('mouseup',()=>{saveSelection();updateSpeakerSelection();});
editor.addEventListener('focus',updateSpeakerSelection);
document.querySelectorAll('[data-command]').forEach(button=>{button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>{editor.focus();restoreSelection();document.execCommand(button.dataset.command,false,null);saveSelection();scheduleUpdate();});});
$('clear-format').addEventListener('mousedown',e=>e.preventDefault());
$('clear-format').addEventListener('click',()=>{editor.focus();restoreSelection();document.execCommand('removeFormat',false,null);saveSelection();scheduleUpdate();});
$('selection-color').addEventListener('pointerdown',()=>saveSelection());
$('selection-color').addEventListener('input',e=>{editor.focus();restoreSelection();document.execCommand('styleWithCSS',false,true);document.execCommand('foreColor',false,e.target.value);saveSelection();scheduleUpdate();});
document.querySelectorAll('.speaker-choice').forEach(b=>b.addEventListener('click',()=>{const p=getFocusedParagraph()||getParagraph(lastSelection?.startContainer);if(!p){toast('먼저 편집기에서 지정할 문단을 클릭해 줘.');return;}if(b.dataset.speaker==='narration')delete p.dataset.speaker;else p.dataset.speaker=b.dataset.speaker;updateSpeakerSelection();scheduleUpdate();}));
$('reset-content').addEventListener('click',()=>{if(!confirm('원문을 모두 지울까?'))return;editor.innerHTML='<p></p>';lastSelection=null;scheduleUpdate();});
$('reset-style').addEventListener('click',()=>{if(!confirm('디자인 설정을 기본값으로 되돌릴까? 원문은 유지돼.'))return;setSettings(defaults);selectPreset('paper');scheduleUpdate();});
for(const id of SETTINGS){$(id).addEventListener('input',()=>{updateLabels();if(['background','foreground','color-a','color-b','font'].includes(id))selectPreset(null);scheduleUpdate();});}
function selectPreset(name){document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('selected',b.dataset.preset===name));}
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>{setSettings({...settings(),...presets[b.dataset.preset]});selectPreset(b.dataset.preset);scheduleUpdate();}));
function scheduleUpdate(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{renderPreview();}catch(e){console.error(e);toast('미리보기 생성 중 오류가 발생했어.');}scheduleSave();});}
function scheduleSave(){clearTimeout(saveTimer);$('save-status').textContent='저장 중...';saveTimer=setTimeout(()=>{try{localStorage.setItem('excerpt-studio-pages-v2',JSON.stringify(serialize()));$('save-status').textContent='자동 저장됨';}catch(e){$('save-status').textContent='저장 실패';}},350);}
function serialize(){return {version:2,html:editor.innerHTML,settings:settings()};}
function sanitizeImportedHtml(html){const doc=new DOMParser().parseFromString('<div id="root">'+html+'</div>','text/html');const root=doc.getElementById('root');root.querySelectorAll('script,style,iframe,object,embed,svg,math,form,link,meta').forEach(n=>n.remove());for(const el of root.querySelectorAll('*')){for(const attr of [...el.attributes]){if(!['data-speaker','style'].includes(attr.name))el.removeAttribute(attr.name);}if(el.hasAttribute('style')){const safe=[];for(const prop of ['color','font-weight','font-style','text-decoration','text-decoration-line']){const v=el.style.getPropertyValue(prop);if(v && !/[;{}<>]/.test(v))safe.push(`${prop}: ${v}`);}if(safe.length)el.setAttribute('style',safe.join('; '));else el.removeAttribute('style');}if(el.dataset.speaker && !['a','b'].includes(el.dataset.speaker))delete el.dataset.speaker;}
return root.innerHTML;}
function loadProject(project){if(!project||typeof project!=='object'||typeof project.html!=='string'||typeof project.settings!=='object')throw Error('프로젝트 형식이 올바르지 않음');editor.innerHTML=sanitizeImportedHtml(project.html);setSettings({...defaults,...project.settings});lastSelection=null;selectPreset(null);scheduleUpdate();}
$('export-project').addEventListener('click',()=>{downloadBlob(new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),'excerpt-studio-project.json');toast('작업 파일을 저장했어.');});
$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const p=JSON.parse(await file.text());loadProject(p);toast('프로젝트를 불러왔어.');}catch(err){toast('프로젝트 파일을 읽지 못했어.');}e.target.value='';});
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function collectSegments(node,style={}){const out=[];const walk=(n,s)=>{if(n.nodeType===Node.TEXT_NODE){if(n.nodeValue)out.push({...s,text:n.nodeValue});return;}if(n.nodeType!==Node.ELEMENT_NODE)return;const next={...s};const tag=n.tagName;const css=getComputedStyle(n);if(['B','STRONG'].includes(tag)||['bold','bolder'].includes(n.style.fontWeight)||Number(n.style.fontWeight)>=600)next.bold=true;
if(['I','EM'].includes(tag)||n.style.fontStyle==='italic')next.italic=true;if(tag==='U'||(n.style.textDecorationLine||'').includes('underline'))next.underline=true;
if(tag==='S'||tag==='STRIKE'||(n.style.textDecorationLine||'').includes('line-through'))next.strike=true;
if(n.style.color&&n.style.color!=='inherit')next.color=css.color;
if(tag==='BR'){out.push({...next,text:'\n'});return;}for(const c of n.childNodes)walk(c,next);};walk(node,style);return out;}
function blocks(){const result=[];const childElements=[...editor.childNodes];for(const child of childElements){if(child.nodeType===Node.TEXT_NODE){if(child.textContent.trim())result.push({speaker:'narration',segments:[{text:child.textContent}]});continue;}if(child.nodeType!==Node.ELEMENT_NODE)continue;const speaker=child.dataset?.speaker||'narration';const segments=collectSegments(child);result.push({speaker,segments});}if(!result.length)result.push({speaker:'narration',segments:[]});return result;}
function fontFamily(font){if(font==='sans')return '"Apple SD Gothic Neo","Malgun Gothic",Arial,sans-serif';if(font==='mono')return 'Consolas,"Courier New",monospace';return '"AppleMyungjo","Batang","Nanum Myeongjo",Georgia,serif';}
function fontString(piece,px,family){return `${piece.italic?'italic ':''}${piece.bold?'700 ':'400 '}${px}px ${family}`;}
function drawRounded(c,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+rr,y);c.arcTo(x+w,y,x+w,y+h,rr);c.arcTo(x+w,y+h,x,y+h,rr);c.arcTo(x,y+h,x,y,rr);c.arcTo(x,y,x+w,y,rr);c.closePath();}
function rgba(hex,a){let m=/^#([a-f\d]{6})$/i.exec(hex);if(!m)return `rgba(120,120,120,${a})`;const n=parseInt(m[1],16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
function wrapSegments(c,segments,maxWidth,px,family){const lines=[{pieces:[],width:0}];function next(){lines.push({pieces:[],width:0});}for(const s of segments){const tokens=s.text.split(/(\n|\s+|(?<=[가-힣])(?=[가-힣]))/u).filter(x=>x!=='' );for(const token of tokens){if(token==='\n'){next();continue;}c.font=fontString(s,px,family);const w=c.measureText(token).width;let cur=lines[lines.length-1];if(/^\s+$/.test(token)&&cur.width===0)continue;if(cur.width+w>maxWidth&&cur.width>0){next();cur=lines[lines.length-1];if(/^\s+$/.test(token))continue;}
if(w>maxWidth&&cur.width===0){for(const char of [...token]){c.font=fontString(s,px,family);const cw=c.measureText(char).width;if(cur.width+cw>maxWidth&&cur.width>0){next();cur=lines[lines.length-1];}cur.pieces.push({...s,text:char,width:cw});cur.width+=cw;}continue;}
cur.pieces.push({...s,text:token,width:w});cur.width+=w;}}return lines;}
function drawLine(c,line,x,y,px,family,defaultColor){let xx=x;for(const p of line.pieces){c.font=fontString(p,px,family);c.fillStyle=p.color||defaultColor;c.fillText(p.text,xx,y);if(p.underline||p.strike){c.strokeStyle=c.fillStyle;c.lineWidth=Math.max(1,px/17);c.beginPath();const yy=p.strike?y-px*.30:y+px*.13;c.moveTo(xx,yy);c.lineTo(xx+p.width,yy);c.stroke();}xx+=p.width;}}
function createCanvas(s,allBlocks,target,draw){const W=900;const padding=Number(s.padding);const px=Number(s.size);const lh=px*Number(s['line-height']);const margin= Math.max(15,px*.86);const family=fontFamily(s.font);const heading=String(s.heading).trim();const footer=String(s.footer).trim();const mode=s.mode;const maxW=W-padding*2;const titleH=heading?60:0;const footerH=footer?65:0;const placements=[];let y=padding+titleH;
const narrColor=s.foreground;
for(const block of allBlocks){const speaker=block.speaker==='a'||block.speaker==='b'?block.speaker:'narration';const selected= speaker!=='narration';const bubble=selected&&mode==='chat';const quote=selected&&mode==='hybrid';const indent=bubble?28:quote?25:0;const innerPad=bubble?24:0;const labelH=bubble?28:0;const textW=Math.max(80,maxW-indent-2*innerPad);
const lines=wrapSegments(target,block.segments,textW,px,family);const textH=Math.max(lh,lines.length*lh);const totalH=textH+labelH+innerPad*(bubble?2:0);placements.push({speaker,bubble,quote,indent,innerPad,labelH,lines,y,textH,totalH,textW});y+=totalH+margin;}
if(placements.length)y-=margin;
y+=footerH+padding;let H=Math.ceil(y);
const ratios={ '1:1':1,'3:4':4/3,'9:16':16/9 };if(ratios[s.ratio])H=Math.max(H,Math.ceil(W*ratios[s.ratio]));
if(!draw)return {width:W,height:H};
if(H>14000)throw new Error('이미지가 너무 길어. 글을 나눠서 저장해 줘.');
target.canvas.width=W;target.canvas.height=H;target.clearRect(0,0,W,H);target.fillStyle=s.background;target.fillRect(0,0,W,H);target.textBaseline='alphabetic';
if(heading){target.font=`600 13px ${fontFamily('sans')}`;target.letterSpacing='2px';target.textAlign='center';target.fillStyle=s['color-a'];target.fillText(heading,W/2,padding+20);target.textAlign='left';target.letterSpacing='0px';}
for(const p of placements){let x=padding,baseY=p.y;if(p.bubble){const bg=p.speaker==='a'?s['color-a']:s['color-b'];target.fillStyle=rgba(bg,.13);drawRounded(target,x+ (p.speaker==='b'?30:0),baseY,maxW-30,p.totalH,12);target.fill();x+=p.innerPad+(p.speaker==='b'?30:0);baseY+=p.innerPad;target.fillStyle=bg;target.font=`700 12px ${fontFamily('sans')}`;target.fillText(p.speaker==='a'?s['name-a']:s['name-b'],x,baseY+12);baseY+=p.labelH;}
else if(p.quote){const bg=p.speaker==='a'?s['color-a']:s['color-b'];target.fillStyle=bg;target.fillRect(x,p.y+5,3,p.totalH-9);x+=p.indent;}
const fallback=p.speaker==='a'?s['color-a']:p.speaker==='b'?s['color-b']:narrColor;
p.lines.forEach((line,i)=>drawLine(target,line,x,baseY+px+(i*lh),px,family,fallback));}
if(footer){target.textAlign='center';target.fillStyle=rgba(s.foreground,.58);target.font=`400 12px ${fontFamily('sans')}`;target.fillText(footer,W/2,H-padding+11);target.textAlign='left';}
return {width:W,height:H};}
function renderPreview(){const s=settings();const b=blocks();const meta=createCanvas(s,b,ctx,true);$('character-count').textContent=`${editor.innerText.trim().length}자`;$('preview-size').textContent=`${meta.width} × ${meta.height}px`;}
function downloadPng(){const button=$('download-png');button.disabled=true;button.textContent='생성 중...';try{const s=settings(),b=blocks();const meta=createCanvas(s,b,ctx,false);const scale=2;if(meta.height*scale>28000)throw Error('이미지가 너무 길어. 발췌를 나눠서 저장해 줘.');const off=document.createElement('canvas');const c=off.getContext('2d');off.width=meta.width*scale;off.height=meta.height*scale;c.scale(scale,scale);
// drawing at logical coordinates on an offscreen high-resolution canvas
const proxy=new Proxy(c,{get(t,k){if(k==='canvas')return {get width(){return meta.width;},set width(_v){},get height(){return meta.height;},set height(_v){}};const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}});
createCanvas(s,b,proxy,true);
off.toBlob(blob=>{if(blob){downloadBlob(blob,'excerpt-'+new Date().toISOString().slice(0,10)+'.png');toast('PNG를 저장했어!');}else toast('이미지를 저장하지 못했어.');button.disabled=false;button.textContent='↧ PNG 저장';},'image/png');}catch(e){console.error(e);toast(e.message||'PNG 출력 실패');button.disabled=false;button.textContent='↧ PNG 저장';}}
$('download-png').addEventListener('click',downloadPng);
$('download-png-bottom').addEventListener('click',downloadPng);
try{const prev=localStorage.getItem('excerpt-studio-pages-v2');if(prev)loadProject(JSON.parse(prev));else{setSettings(defaults);renderPreview();}}catch(e){console.warn('Could not load saved project',e);setSettings(defaults);renderPreview();}
