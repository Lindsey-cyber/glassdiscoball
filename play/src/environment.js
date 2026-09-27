import { Scene, Color, Mesh, BoxGeometry, MeshBasicMaterial, BackSide, PMREMGenerator, DirectionalLight, HemisphereLight } from 'three/webgpu';
/** HDR studio reflected in the real facet normals. Static lighting needs one bake. */
export async function createEnvironment(renderer, scene) {
  const studio = new Scene();
  studio.background = new Color(.055,.065,.082);
  const room = new Mesh(new BoxGeometry(24,20,24),new MeshBasicMaterial({color:0x59616f,side:BackSide}));
  studio.add(room);
  function softbox(position,scale,color,intensity) {
    const m = new Mesh(new BoxGeometry(...scale),new MeshBasicMaterial({color:new Color(color).multiplyScalar(intensity)}));
    m.position.set(...position); m.lookAt(0,0,0); studio.add(m);
  }
  softbox([-5,5,5],[3,8,.1], '#f2f6ff', 10);
  softbox([6,2,3],[1.1,7,.1], '#c7e6ff', 6);
  softbox([0,8,-3],[7,2,.1], '#ffffff', 8);
  softbox([-4,-2,-6],[3,4,.1], '#b9c9e8', 3);
  softbox([5,-3,-5],[1.4,4,.1], '#d9cdec', 2);
  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(studio, .025, .1, 40, { size:256 });
  scene.environment = target.texture;
  scene.add(new HemisphereLight(0xe8f3ff,0x8b8fa2,.5));
  const key = new DirectionalLight(0xf1f7ff,2.2); key.position.set(-4,6,8); scene.add(key);
  const rim = new DirectionalLight(0xd8e7ff,1); rim.position.set(5,1,-3); scene.add(rim);
  if(renderer.backend.device) await renderer.backend.device.queue.onSubmittedWorkDone();
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  generator.dispose();
  return () => { scene.environment=null; target.dispose(); };
}
