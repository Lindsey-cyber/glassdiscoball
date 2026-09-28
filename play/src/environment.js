import { Scene, Color, Mesh, BoxGeometry, MeshBasicMaterial, BackSide, FrontSide, PMREMGenerator, SpotLight, HemisphereLight, Vector3 } from 'three/webgpu';

// Radiance sources and direct lamps describe the same rooms. Materials never
// change color when a preset changes. Positions are in ball-radius units.
export const LIGHTING_PRESETS={
 default:{label:'Default',room:'#61666c',ceiling:'#a5a8ac',floor:'#646970',ambient:.16,ground:.09,projection:.10,
  panels:[[-4,2.5,5,3.3,3.7,'#eef4ff',2.1,'window'],[5,1,1,1.1,5,'#e8edf2',.85],[1,6,-2,4,2,'#ffffff',1.3],[-3,0,-5,2,4,'#939da8',.42],[1,0,6,1.1,7,'#090b0f',1]],
  lamps:[{p:[-4,3,5],color:'#f1f5ff',power:18,spread:.32},{p:[5,1,1],color:'#f3f4f5',power:5,spread:.2},{p:[1,6,-2],color:'#ffffff',power:8,spread:.35}]},
 sunset:{label:'Warm Sunset',room:'#656568',ceiling:'#92969e',floor:'#535257',ambient:.08,ground:.22,projection:.48,
  panels:[[-5,.9,5,4.8,2.2,'#ffca8a',4.5,'window'],[4,3,3,1,5,'#d8e9ff',.8],[0,5,-4,4,.45,'#fff0d6',1.8],[0,0,6,2,6,'#07080b',1]],
  lamps:[{p:[-5,.9,5],color:'#ffca8a',power:58,spread:.10},{p:[4,3,3],color:'#d8e9ff',power:5,spread:.28},{p:[0,5,-4],color:'#fff0d6',power:8,spread:.12}]},
 night:{label:'Night Spotlight',room:'#343b47',ceiling:'#596371',floor:'#242a34',ambient:.018,ground:.34,projection:.90,
  panels:[[-2,5,4,.65,.8,'#f5f8ff',14],[4,2,-3,.25,5,'#c5d7ed',4],[-4,0,1,.2,4,'#ffffff',1.7],[1,-3,5,3,.15,'#9ca7b8',.8],[0,3,-6,3.5,1.4,'#bac7d8',1.1]],
  lamps:[{p:[-2,5,4],color:'#f5f8ff',power:85,spread:.025,angle:.34},{p:[4,2,-3],color:'#c5d7ed',power:12,spread:.06},{p:[-4,0,1],color:'#ffffff',power:3,spread:.07}]},
 neon:{label:'Neon Mix',room:'#393e48',ceiling:'#6a707a',floor:'#303945',ambient:.025,ground:.28,projection:.65,
  panels:[[-4,1.3,4,1.6,5,'#68dcff',4],[4,0,3,.9,4,'#f094c7',3.2],[.5,5,3,2,1.2,'#ffffff',4],[-2,1,-5,.35,4,'#5485ef',2],[1,0,5,1.3,5,'#06080b',1]],
  lamps:[{p:[-4,1.3,4],color:'#68dcff',power:32,spread:.07},{p:[4,0,3],color:'#f094c7',power:23,spread:.06},{p:[.5,5,3],color:'#ffffff',power:28,spread:.05}]},
};
export async function createEnvironment(renderer,scene) {
  const anchor=new Vector3();let scale=1,current='default',target=null,disposed=false,revision=0;
  const ambient=new HemisphereLight(0xf1f4fa,0x3b3d42,.1);scene.add(ambient);
  const lights=Array.from({length:3},()=>{const l=new SpotLight(0xffffff,1,0,Math.PI/2.7,.6,2);scene.add(l,l.target);return l;});
  const sources=lights.map(()=>({position:new Vector3(),direction:new Vector3(),color:new Color(),power:0,spread:0,angle:1}));
  function align(){
    const data=LIGHTING_PRESETS[current];
    data.lamps.forEach((lamp,i)=>{
      const light=lights[i];light.position.fromArray(lamp.p).multiplyScalar(scale).add(anchor);light.target.position.copy(anchor);
      light.color.set(lamp.color);light.intensity=lamp.power*scale*scale;light.angle=lamp.angle||1.15;
      const source=sources[i];source.position.copy(light.position);source.direction.subVectors(anchor,light.position).normalize();source.color.copy(light.color);
      source.power=lamp.power;source.spread=lamp.spread;source.angle=light.angle;
    });
  }
  async function setPreset(name){
    if(!LIGHTING_PRESETS[name]||disposed)return;
    const ticket=++revision,data=LIGHTING_PRESETS[name],studio=new Scene();
    const owned=[];
    function box(position,size,color,intensity=1,side){
      const material=new MeshBasicMaterial({color:new Color(color).multiplyScalar(intensity),side:side??FrontSide});
      const mesh=new Mesh(new BoxGeometry(...size),material);mesh.position.set(...position);studio.add(mesh);owned.push(mesh);return mesh;
    }
    box([0,0,0],[22,18,22],data.room,1,BackSide);
    box([0,8,0],[21,.1,21],data.ceiling);
    box([0,-8,0],[21,.1,21],data.floor);
    // Real rectangular window panes, dark mullions and reflection flags.
    for(const [x,y,z,w,h,color,radiance,kind] of data.panels){
      if(kind==='window'){
        const facing=new Vector3(x,y,z).negate().normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),facing).normalize();
        for(let ix=0;ix<3;ix++)for(let iy=0;iy<2;iy++){
          const p=new Vector3(x,y,z).addScaledVector(right,(ix-1)*w/3);p.y+=(iy-.5)*h/2;
          const m=box(p.toArray(),[w/3*.94,h/2*.94,.025],color,radiance*(.83+ix*.06+iy*.025));m.lookAt(0,0,0);
        }
      }else{const m=box([x,y,z],[w,h,.025],color,radiance);m.lookAt(0,0,0);}
    }
    // Louvered studio walls: real narrow neutral reflectors and dark flags.
    // Their angular scale is comparable to a small mirror's reflection cone;
    // neighboring tiles see different room surfaces instead of a flat grey box.
    const fill=name==='night'?.32:name==='neon'?.55:.95;
    for(let wall=0;wall<4;wall++)for(let i=0;i<38;i++){
      const along=-8.5+i*.46,bright=i%5===0||i%5===3;
      const h=2.8+((i*7+wall*3)%9)*.56,y=-1.7+((i*3)%7)*.6;
      const position=wall%2===0?[along,y,wall===0?8.8:-8.8]:[wall===1?8.8:-8.8,y,along];
      const m=box(position,[.14+(i%3)*.06,h,.06],bright?'#d4d7dd':'#0b0f16',bright?fill:1);
      m.lookAt(0,y,0);
    }
    // Alternating ceiling beams and floor panels remain neutral in all presets.
    for(let i=0;i<17;i++){
      const x=-8+i;
      box([x,7.7,-.5],[.23, .12,11],i%3?'#181e27':'#cbd0d7',i%3?1:fill);
      box([x,-7.7,1],[.42,.1,12],i%4?'#949ca6':'#252c37',fill*.85);
    }
    const generator=new PMREMGenerator(renderer),next=generator.fromScene(studio,0,.1,40,{size:256});
    if(renderer.backend.device)await renderer.backend.device.queue.onSubmittedWorkDone();
    generator.dispose();owned.forEach(m=>{m.geometry.dispose();m.material.dispose();});
    if(disposed||ticket!==revision){next.dispose();return;}
    const previous=target;target=next;current=name;scene.environment=target.texture;ambient.intensity=data.ambient;align();previous?.dispose();
  }
  await setPreset('default');
  return {sources,get name(){return current;},get settings(){return LIGHTING_PRESETS[current];},setPreset,place(center,s){anchor.copy(center);scale=s;align();},dispose(){disposed=true;revision++;scene.environment=null;target?.dispose();scene.remove(ambient);lights.forEach(l=>{scene.remove(l,l.target);l.dispose();});}};
}
