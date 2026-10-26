import {createRig} from './rig.js';
import {Director,performancePose} from './performance-model.js';
import './style.css';
const $=id=>document.getElementById(id);
const director=new Director();let rig,clock=0,frameId=null,last=null,paused=false,disposed=false,nextInitiative=25;
let manual=null;const media=matchMedia('(prefers-reduced-motion: reduce)');
function announce(message){$('status').textContent=message;}
function settings(){return {strength:Number($('strength').value)/100,attitude:$('attitude').value,reducedMotion:media.matches};}
function play(action){manual=null;director.play(action,clock);$('tuck').textContent='Tuck away';nextInitiative=clock+25;}
function idle(){manual=null;director.idle();$('tuck').textContent='Tuck away';nextInitiative=clock+25;}
function draw(dt){
 const state=director.snapshot(clock);
 if($('autonomy').checked&&!media.matches&&!state.hidden&&state.action==='idle'&&!state.scene&&clock>=nextInitiative){play(['wave','caught','nod'][Math.floor(clock)%3]);nextInitiative=clock+25+Math.random()*15;}
 const current=director.snapshot(clock);const pose=performancePose(current,settings());
 // Restore a full authored neutral pose each frame, then layer one bounded reaction.
 // Parameter-like brow/mouth tracks in this export were visually inactive; do not pretend they work.
 rig.apply('wave Non Looping',0,1);
 rig.apply('blink_IDLE',media.matches ? 0.2 : (clock%2)/2,1);
 for(const clip of pose.clips)if(clip.mix>0)rig.apply(clip.name,clip.time,clip.mix);
 if(manual)rig.apply(manual.name,manual.time,manual.mix);
 rig.apply('hair '+$('hair').value,0,1);rig.apply('clothing '+$('outfit').value,0,1);rig.apply('glasses '+$('glasses').value,0,1);
 const breathing=media.matches?0:Math.sin(clock*1.7)*.003;
 $('puppet').style.transform=`translate(${pose.x}px,calc(${pose.y}px + ${pose.tuck*115}%)) rotate(${pose.rotation}deg) scale(${pose.scale+breathing})`;
 $('puppet').style.opacity=String(1-pose.tuck);
 $('phase').textContent=manual?'Manual clip preview':pose.label;
 $('line').textContent=$('subtitles').checked&&current.weight>.15?pose.caption:'';
 $('stage').classList.toggle('peeking',current.action==='tuck'||current.hidden);
 $('tuck').textContent=current.hidden||current.action==='tuck'?'Bring back':'Tuck away';
 for(const button of document.querySelectorAll('[data-action]'))button.setAttribute('aria-pressed',String(button.dataset.action===current.action));
 $('debug').textContent=JSON.stringify({action:current.action,scene:current.scene,hidden:current.hidden,weight:Number(current.weight.toFixed(3)),manual,source:'manual performance; no AI or microphone'},null,2);
 rig.draw(dt);
}
function frame(timestamp){frameId=null;if(disposed||paused||document.hidden)return;const dt=last===null?0:Math.min(.05,(timestamp-last)/1000);last=timestamp;clock+=dt;draw(dt);frameId=rig.runtime.requestAnimationFrame(frame);}
function pause(){paused=true;if(frameId!==null)rig.runtime.cancelAnimationFrame(frameId);frameId=null;last=null;}
function resume(){if(disposed)return;paused=false;last=null;if(frameId===null)frameId=rig.runtime.requestAnimationFrame(frame);}
function dispose(){if(disposed)return;pause();disposed=true;observer?.disconnect();rig?.dispose();}
let observer;
try{
 rig=await createRig($('performance'));rig.resize();
 observer=new ResizeObserver(()=>{rig.resize();if(paused)draw(0);});observer.observe($('puppet'));
 for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>play(button.dataset.action);
 $('scene').onclick=()=>{manual=null;director.runScene(clock);nextInitiative=clock+40;};
 $('cancel').onclick=idle;
 $('tuck').onclick=()=>{const state=director.snapshot(clock);if(state.hidden||state.action==='tuck')idle();else play('tuck');};
 $('strength').oninput=()=>{$('strength-value').textContent=$('strength').value+'%';};
 for(const button of document.querySelectorAll('[data-bg]'))button.onclick=()=>{$('stage').classList.remove('dark','checker');if(button.dataset.bg!=='soft')$('stage').classList.add(button.dataset.bg);};
 const effective=['blink_IDLE','hands on hips','blink 2','blink 3','blink 4','thoughtful','wave','wave Non Looping','back and forth','celebration'];
 const picker=document.createElement('select');picker.id='clip';
 for(const name of effective){const option=document.createElement('option');option.textContent=name;option.value=name;picker.append(option);}
 const label=document.createElement('label');label.textContent='Authored clip';label.append(picker);$('channels').append(label);
 for(const [name,title,value]of [['time','Clip position',50],['mix','Blend strength',70]]){const l=document.createElement('label');l.textContent=title;const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.value=String(value);input.id='clip-'+name;l.append(input);$('channels').append(l);input.oninput=()=>{director.idle();manual={name:picker.value,time:Number($('clip-time').value)/100,mix:Number($('clip-mix').value)/100};};}
 picker.onchange=()=>{director.idle();manual={name:picker.value,time:Number($('clip-time').value)/100,mix:Number($('clip-mix').value)/100};};
 $('clear-pose').onclick=idle;
 window.addEventListener('keydown',event=>{if(event.key==='Escape')idle();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frameId!==null)rig.runtime.cancelAnimationFrame(frameId);frameId=null;last=null;}else if(!paused)resume();});
 window.addEventListener('pagehide',dispose,{once:true});
 if(import.meta.hot)import.meta.hot.dispose(dispose);
 window.taviPerformance={play,idle,pause,resume,snapshot:()=>({...director.snapshot(clock),clock,manual}),seekScene(seconds){manual=null;director.runScene(clock-seconds);draw(0);},renderAt(action,age){manual=null;director.play(action,clock-age);draw(0);},dispose};
 announce('Performance ready');resume();
}catch(error){dispose();announce('Could not start performance: '+String(error));console.error(error);}
