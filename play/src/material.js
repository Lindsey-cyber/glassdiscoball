import { MeshPhysicalNodeMaterial, Color, FrontSide } from 'three/webgpu';
import { attribute, uniform } from 'three/tsl';
/** An actual opaque silver backing beneath a separate thin glass solid.
 * The backing is rendered into Three's transmission buffer first. The glass
 * remains refractive, but the finished mirror is intentionally opaque. */
export function createGlass() {
  const worldScale=uniform(1),roughness=attribute('tileRoughness','float');
  const mirror=new MeshPhysicalNodeMaterial({color:new Color('#f4f5f6'),metalness:1,roughness:.065,envMapIntensity:1,side:FrontSide});
  mirror.roughnessNode=roughness;
  const glass=new MeshPhysicalNodeMaterial({color:0xffffff,metalness:0,roughness:.032,transmission:1,ior:1.52,thickness:.006,attenuationColor:0xf5faff,attenuationDistance:6,dispersion:.015,iridescence:0,side:FrontSide});
  glass.roughnessNode=roughness;
  glass.thicknessNode=worldScale.mul(.006);
  return {glass,mirror,worldScale};
}
