import { MeshPhysicalNodeMaterial, Color, FrontSide } from 'three/webgpu';
import { attribute } from 'three/tsl';
export function createGlass() {
  const optical = attribute('optical', 'vec4');
  const material = new MeshPhysicalNodeMaterial({
    color: new Color('#edf6fa'), metalness: .06, roughness: .065,
    transmission: .87, thickness: .045, ior: 1.52,
    attenuationColor: new Color('#d3e8f4'), attenuationDistance: 2.8,
    iridescence: .42, iridescenceIOR: 1.34,
    iridescenceThicknessRange: [270,385], dispersion: .22,
    clearcoat: 1, clearcoatRoughness: .045, envMapIntensity: 1,
    side: FrontSide,
  });
  material.roughnessNode = optical.x;
  material.iridescenceThicknessNode = optical.y;
  material.transmissionNode = optical.z;
  material.metalnessNode = optical.w;
  return material;
}
