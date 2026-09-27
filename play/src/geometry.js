import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { random } from './random.js';

/** Spherical Voronoi cells: dual of a jittered spherical Delaunay hull.
 * Each cell is an individual closed, bevelled glass solid, not a texture.
 */
export function createFacets(count, seed) {
  const rng = random(seed), points = [], rings = Array.from({ length: count }, () => []);
  const spacing = Math.sqrt(4 * Math.PI / count);
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + 0.5) / count, angle = i * Math.PI * (3 - Math.sqrt(5));
    const p = new Vector3(Math.cos(angle) * Math.sqrt(1-y*y), y, Math.sin(angle) * Math.sqrt(1-y*y));
    p.add(new Vector3(rng.normal(), rng.normal(), rng.normal()).multiplyScalar(spacing * 0.20)).normalize();
    points.push(p);
  }
  const indices = new Map(points.map((p, i) => [p, i]));
  const hull = new ConvexHull().setFromPoints(points);
  for (const face of hull.faces) {
    let edge = face.edge;
    do { rings[indices.get(edge.head().point)].push(face.normal.clone()); edge = edge.next; } while (edge !== face.edge);
  }
  const pieces = points.map((n, i) => {
    const u = new Vector3().crossVectors(Math.abs(n.y) > .9 ? new Vector3(1,0,0) : new Vector3(0,1,0), n).normalize();
    const v = new Vector3().crossVectors(n,u);
    const origin = n.clone().multiplyScalar(.982);
    const polygon = rings[i].map(p => {
      const projected = p.clone().multiplyScalar(.982 / p.dot(n)).sub(origin);
      return { x: projected.dot(u) * .987, y: projected.dot(v) * .987 };
    }).sort((a,b) => Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
    const thickness = .026 + rng() * .018, bevel = .009;
    const vertices = [], hullVertices = [], positions = [], optical = [];
    // Four rings: face, upper edge, lower edge, back. Both broad faces flat.
    for (const [inset, z] of [[.955, thickness/2],[1, thickness/2-bevel],[1,-thickness/2+bevel],[.955,-thickness/2]]) {
      for (const p of polygon) {
        const point = u.clone().multiplyScalar(p.x*inset).addScaledVector(v,p.y*inset).addScaledVector(n,z);
        vertices.push(point); hullVertices.push(...point.toArray());
      }
    }
    const m = polygon.length;
    const emit = (a,b,c) => { for (const j of [a,b,c]) positions.push(...vertices[j].toArray()); };
    for (let j=1;j<m-1;j++) { emit(0,j,j+1); emit(3*m,3*m+j+1,3*m+j); }
    for (let k=0;k<3;k++) for(let j=0;j<m;j++) {
      const a=k*m+j,b=k*m+(j+1)%m,c=(k+1)*m+(j+1)%m,d=(k+1)*m+j;
      emit(a,d,b); emit(b,d,c);
    }
    const film = 270 + rng()*115;
    const silver = rng() < .23;
    for(let j=0;j<positions.length/3;j++) optical.push(.06+rng()*0.002, film, silver ? .16 : .87, silver ? .88 : .06);
    // One cell uses one optical value (no grain/noise painted onto its faces).
    for(let j=4;j<optical.length;j+=4) optical[j]=optical[0];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('optical',new Float32BufferAttribute(optical,4));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    let area=0;
    for(let j=0;j<m;j++) { const a=polygon[j],b=polygon[(j+1)%m]; area+=a.x*b.y-b.x*a.y; }
    return { geometry, hull: new Float32Array(hullVertices), center: origin, normal:n, area:Math.abs(area)/2, thickness, radius:geometry.boundingSphere.radius };
  });
  // Exact assembled bounding radius; map its silhouette to the portrait's diameter.
  let radius=0;
  for(const p of pieces) for(let i=0;i<p.hull.length;i+=3) radius=Math.max(radius,new Vector3().fromArray(p.hull,i).add(p.center).length());
  return { pieces, radius };
}
