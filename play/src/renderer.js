import { WebGPURenderer, Scene, OrthographicCamera, Color, ACESFilmicToneMapping } from 'three/webgpu';
export const PIXELS_PER_UNIT = 100;
export async function createRenderer() {
  const forceWebGL = new URLSearchParams(location.search).get('renderer') === 'webgl';
  const renderer = new WebGPURenderer({ antialias:true, alpha:true, forceWebGL, powerPreference:'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .86;
  renderer.setClearColor(0xffffff,0);
  await renderer.init();
  renderer.domElement.className = 'play-canvas';
  renderer.domElement.setAttribute('aria-hidden','true');
  document.body.append(renderer.domElement);
  const scene = new Scene();
  const device=renderer.backend.device;
  device?.addEventListener('uncapturederror',event=>console.error('WebGPU validation:',event.error.message));
  // Orthographic projection makes all six container boundaries exact at every depth.
  const camera = new OrthographicCamera(-1,1,1,-1,.1,50);
  camera.position.z=15;
  return { renderer, scene, camera, resize(width,height,ratio) {
    renderer.setPixelRatio(ratio); renderer.setSize(width,height);
    camera.left=-width/(2*PIXELS_PER_UNIT); camera.right=-camera.left;
    camera.top=height/(2*PIXELS_PER_UNIT); camera.bottom=-camera.top; camera.updateProjectionMatrix();
  }, dispose() { renderer.dispose(); renderer.domElement.remove(); } };
}
