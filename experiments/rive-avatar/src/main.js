import {Rive, Layout, Fit, Alignment, StateMachineInputType, RuntimeLoader} from '@rive-app/webgl2';
import wasmUrl from '@rive-app/webgl2/rive.wasm?url';
import './style.css';
RuntimeLoader.setWasmUrl(wasmUrl);
const $=id=>document.getElementById(id);
let instance,buffer,contents={},generation=0,currentFile='Rive Avatar by nasmith';
let artboard='AvatarCreationUI',machine='State Machine 1';
let catalog=[],selectedId='mascot';
const stage=$('stage');
function status(message){$('status').textContent=message;}
function options(element,values,selected){element.replaceChildren(...values.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;option.selected=value===selected;return option;}));}
function control(name,type,value,onChange,values){
 const row=document.createElement('div');row.className='control';
 const label=document.createElement('label');label.textContent=name;const id=`control-${$('inputs').querySelectorAll('.control').length}`;label.htmlFor=id;
 let input;
 if(type==='trigger'){input=document.createElement('button');input.textContent='Play';input.onclick=onChange;}
 else if(type==='enumType'){input=document.createElement('select');options(input,values??[],value);input.onchange=()=>onChange(input.value);}
 else{input=document.createElement('input');input.type=type==='boolean'?'checkbox':type==='number'||type==='integer'?'number':type==='color'?'color':'text';if(input.type==='checkbox')input.checked=value;else input.value=value??'';if(input.type==='number')input.step='any';input.oninput=()=>{const next=input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value;if(typeof next==='number'&&!Number.isFinite(next))return;onChange(next);};}
 input.id=id;row.append(label,input);$('inputs').append(row);
}
function inspectModels(vm,prefix='',depth=0){
 if(!vm||depth>3)return [];
 return vm.properties.map(property=>{
  const path=prefix+property.name;
  if(property.type==='viewModel'){return {name:path,type:property.type,children:inspectModels(vm.viewModel(property.name),path+'/',depth+1)};}
  const getter=property.type==='enumType'?'enum':property.type==='integer'?'number':property.type;
  if(!['number','string','boolean','color','trigger','enum'].includes(getter))return {name:path,type:property.type};
  try{
   const field=vm[getter](property.name);if(!field)return {name:path,type:property.type};
   const value=field.value;
   if(property.type==='color'){const hex='#'+((value>>>0)&0xffffff).toString(16).padStart(6,'0');control(path,'color',hex,next=>{field.value=(0xff000000|parseInt(next.slice(1),16))>>>0;});}
   else control(path,property.type,value,next=>{if(property.type==='trigger')field.trigger();else field.value=next;},field.values);
   return {name:path,type:property.type,value,values:field.values};
  }catch(error){return {name:path,type:property.type,error:String(error)};}
 });
}
function inspect(){
 $('inputs').replaceChildren();
 const board=contents.artboards?.find(a=>a.name===artboard);
 const hasInputs=board?.stateMachines?.find(sm=>sm.name===machine)?.inputs?.length;
 const inputs=(hasInputs?instance.stateMachineInputs(machine):[])??[];
 const raw=inputs.map(input=>{
  const type=input.type===StateMachineInputType.Number?'number':input.type===StateMachineInputType.Boolean?'boolean':'trigger';
  control(input.name,type,input.value,value=>{if(type==='trigger')input.fire();else input.value=value;});
  return {name:input.name,type,value:input.value};
 });
 const dataBindings=inspectModels(instance.viewModelInstance);
 const models=[];for(let i=0;i<instance.viewModelCount;i++){const vm=instance.viewModelByIndex(i);models.push({name:vm.name,properties:vm.properties,instances:vm.instanceNames});}
 const report={file:currentFile,artboard,machine,contents,stateMachineInputs:raw,dataBindings,viewModels:models};
 $('inspection').textContent=JSON.stringify(report,null,2);
 if(!$('inputs').childElementCount)$('inputs').textContent='No top-level inputs exposed. Try the controls inside the character preview or another artboard.';
 window.riveLab={instance,report};
}
function load(nextArtboard=artboard,nextMachine=machine){
 artboard=nextArtboard;machine=nextMachine;const token=++generation;
 instance?.cleanup();status('Loading character?');
 stage.classList.remove('peeking','retracted');$('retract').textContent='Tuck away';
 instance=new Rive({buffer,canvas:$('avatar'),artboard,stateMachine:machine||undefined,autoplay:true,autoBind:true,layout:new Layout({fit:Fit.Contain,alignment:Alignment.Center}),
 onLoad:()=>requestAnimationFrame(()=>{
  if(token!==generation)return;
  contents=instance.contents;
  const boards=contents.artboards??[];
  options($('artboard'),boards.map(a=>a.name),artboard);
  const current=boards.find(a=>a.name===artboard)??boards[0];
  options($('machine'),['',...(current?.stateMachines??[]).map(s=>s.name)],machine);
  if(!artboard){artboard=current?.name;}
  if(!machine&&current?.stateMachines?.length){load(current.name,current.stateMachines[0].name);return;}
  $('animations').replaceChildren(...(current?.animations??[]).map(name=>{const button=document.createElement('button');button.textContent=name;button.onclick=()=>{instance.stop();instance.play(name,false);};return button;}));
  instance.resizeDrawingSurfaceToCanvas();if(selectedId==='mascot'&&artboard==='lyla animation')chibiGesture();inspect();status('Character ready');
 }),onLoadError:error=>status('Could not load character: '+String(error))});
}
$('artboard').onchange=()=>{const board=contents.artboards.find(a=>a.name===$('artboard').value);load(board.name,board.stateMachines?.[0]?.name??'');};
$('machine').onchange=()=>load(artboard,$('machine').value);
$('reset').onclick=()=>{$('chibi-hair').value='Pink';$('chibi-outfit').value='green';$('chibi-glasses').value='blue';load();};
$('peek').onclick=()=>{stage.classList.remove('retracted');stage.classList.toggle('peeking');$('retract').textContent='Tuck away';};
$('retract').onclick=()=>{stage.classList.remove('peeking');stage.classList.toggle('retracted');$('retract').textContent=stage.classList.contains('retracted')?'Bring back':'Tuck away';};
for(const button of document.querySelectorAll('[data-background]'))button.onclick=()=>{stage.classList.remove('dark','checker');if(button.dataset.background!=='soft')stage.classList.add(button.dataset.background);for(const b of document.querySelectorAll('[data-background]'))b.setAttribute('aria-pressed',String(b===button));};
function chibiGesture(name='blink_IDLE'){
 if(selectedId!=='mascot')return;
 if(artboard!=='lyla animation'){load('lyla animation','State Machine 1');return;}
 instance.stop();
 instance.play(['hair '+$('chibi-hair').value,'clothing '+$('chibi-outfit').value,'glasses '+$('chibi-glasses').value,name],false);
}
$('character-only').onclick=()=>load('lyla animation','State Machine 1');
$('creator-ui').onclick=()=>load('MasterArtboard','State Machine 1');
for(const button of document.querySelectorAll('[data-gesture]'))button.onclick=()=>chibiGesture(button.dataset.gesture);
for(const id of ['chibi-hair','chibi-outfit','chibi-glasses'])$(id).onchange=()=>chibiGesture();
$('file').onchange=async()=>{$('chibi-tools').hidden=true;const file=$('file').files[0];if(!file)return;buffer=await file.arrayBuffer();currentFile=file.name;artboard=undefined;machine=undefined;load();};
async function original(){
 try{
  const asset=catalog.find(a=>a.id===selectedId)??catalog[0];
  status('Loading '+asset.name+'...');
  const response=await fetch('/assets/'+asset.file);if(!response.ok)throw new Error('Asset HTTP '+response.status);
  buffer=await response.arrayBuffer();currentFile=asset.name+' by '+asset.author;
  $('credit').textContent=currentFile;$('credit').href=asset.source;
  $('reference-note').textContent=asset.id==='mascot'?'Full-body chibi-style character: color customization and emotion animations.':asset.id==='character-customizer'?'Cartoon human head: accessories, hair colors, and a wink.':asset.id==='pixel-avatar'?'Pixel-art head: multiple face parts, hair styles, and tracking.':'Stylized avatar creator: explore its built-in controls.';
  $('chibi-tools').hidden=asset.id!=='mascot';
  load(asset.id==='mascot'?'lyla animation':asset.artboard,asset.stateMachine);
 }catch(error){status(String(error));}
}
$('reference').onchange=()=>{selectedId=$('reference').value;void original();};
$('original').onclick=()=>void original();
$('export').onclick=()=>{const blob=new Blob([$('inspection').textContent],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rive-avatar-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(()=>instance?.resizeDrawingSurfaceToCanvas()).observe($('puppet'));
window.addEventListener('pagehide',()=>instance?.cleanup());
async function start(){
 try{const response=await fetch('/assets/catalog.json');if(!response.ok)throw new Error('Could not load character catalog');catalog=await response.json();options($('reference'),catalog.map(a=>a.id),selectedId);for(const option of $('reference').options)option.textContent=catalog.find(a=>a.id===option.value).name;await original();}
 catch(error){status(String(error));}
}
void start();
