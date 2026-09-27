import { MeshPhysicalNodeMaterial, Color, FrontSide } from 'three/webgpu';
import { attribute, uniform } from 'three/tsl';
/** Clear dichroic solids and genuinely silvered solids are separate render
 * passes. The opaque silver facets enter the transmission buffer, so front
 * glass can refract the rear mirrored shell instead of an empty white scene. */
export function createGlass() {
  const optical=attribute('optical','vec4'),worldScale=uniform(1);
  function make(silver) {
    const material=new MeshPhysicalNodeMaterial({
      color:new Color(silver?'#e2edf5':'#f5fbff'),
      metalness:silver?.99:0,roughness:.045,
      transmission:silver?0:.97,thickness:.04,ior:1.52,
      attenuationColor:new Color('#b4dce9'),attenuationDistance:2.4,
      iridescence:silver?.55:.85,iridescenceIOR:1.8,
      iridescenceThicknessRange:[290,430],dispersion:.28,
      clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1,
      side:FrontSide,
    });
    material.roughnessNode=optical.x.mul(.75);
    material.iridescenceThicknessNode=optical.y;
    if(!silver) {
      material.transmissionNode=optical.z;
      material.thicknessNode=attribute('glassThickness','float').mul(worldScale);
    }
    return material;
  }
  return {glass:make(false),mirror:make(true),worldScale};
}
