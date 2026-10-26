import {RuntimeLoader} from '@rive-app/webgl2';
import wasmUrl from '@rive-app/webgl2/rive.wasm?url';
RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.setWasmFallbackUrl(null);
export async function inspectRig(){
 const runtime=await RuntimeLoader.awaitInstance();
 const bytes=new Uint8Array(await (await fetch('/assets/mascot.riv')).arrayBuffer());
 const file=await runtime.load(bytes,undefined,false);
 const board=file.artboardByName('lyla animation');
 try{
  const clips=[];
  for(let i=0;i<board.animationCount();i++){
   const animation=board.animationByIndex(i);
   const instance=new runtime.LinearAnimationInstance(animation,board);
   const read=(object,key)=>typeof object[key]==='function'?object[key]():object[key];
   clips.push({name:read(animation,'name'),duration:read(animation,'duration'),fps:read(animation,'fps'),start:read(animation,'workStart'),end:read(animation,'workEnd'),loop:read(animation,'loopValue'),animationProps:i===0?Object.getOwnPropertyNames(Object.getPrototypeOf(animation)):undefined,instanceProps:i===0?Object.getOwnPropertyNames(Object.getPrototypeOf(instance)):undefined});
   instance.delete();
  }
  return clips;
 }finally{board.delete();file.delete();}
}

const read=(object,key)=>typeof object[key]==='function'?object[key]():object[key];
export async function createRig(canvas){
 const runtime=await RuntimeLoader.awaitInstance();
 const bytes=new Uint8Array(await (await fetch('/assets/mascot.riv')).arrayBuffer());
 const file=await runtime.load(bytes,undefined,false);
 const renderer=runtime.makeRenderer(canvas,true);
 let board=file.artboardByName('lyla animation');
 let clips=new Map();
 function collect(){clips=new Map();for(let i=0;i<board.animationCount();i++){const clip=board.animationByIndex(i);clips.set(read(clip,'name'),{definition:clip,instance:new runtime.LinearAnimationInstance(clip,board),time:0});}}
 collect();
 let disposed=false;
 return {
  runtime,
  get clips(){return [...clips.keys()];},
  apply(name,value,mix=1){const clip=clips.get(name);if(!clip)throw new Error('Missing rig track: '+name);const seconds=Math.max(0,Math.min(1,value))*read(clip.definition,'duration')/read(clip.definition,'fps');clip.instance.advance(seconds-clip.time);clip.time=seconds;clip.instance.apply(mix);},
  duration(name){const clip=clips.get(name);return read(clip.definition,'duration')/read(clip.definition,'fps');},
  resize(){const ratio=Math.min(devicePixelRatio||1,2);const box=canvas.getBoundingClientRect();const width=Math.round(box.width*ratio),height=Math.round(box.height*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}},
  draw(dt=0){if(disposed)return;board.advance(dt);renderer.clear();renderer.save();renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},read(board,'bounds'));board.draw(renderer);renderer.restore();renderer.flush();runtime.resolveAnimationFrame();},
  reset(){if(disposed)return;for(const clip of clips.values())clip.instance.delete();board.delete();board=file.artboardByName('lyla animation');collect();},
  dispose(){if(disposed)return;disposed=true;renderer.bindContext?.();for(const clip of clips.values())clip.instance.delete();board.delete();file.delete();renderer.delete();},
 };
}
