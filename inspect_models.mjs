import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
import path from 'path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const modelsDir = './public/models';
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.glb'));

for (const file of files) {
  const doc = await io.read(path.join(modelsDir, file));
  const root = doc.getRoot();
  const meshes = root.listMeshes();
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION');
      if (posAccessor) {
        const arr = posAccessor.getArray();
        for (let i = 0; i < arr.length; i += 3) {
          minX = Math.min(minX, arr[i]);
          maxX = Math.max(maxX, arr[i]);
          minY = Math.min(minY, arr[i+1]);
          maxY = Math.max(maxY, arr[i+1]);
          minZ = Math.min(minZ, arr[i+2]);
          maxZ = Math.max(maxZ, arr[i+2]);
        }
      }
    }
  }
  
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  
  console.log(`${file}: size=[${sizeX.toFixed(2)}, ${sizeY.toFixed(2)}, ${sizeZ.toFixed(2)}] bounds=[${minX.toFixed(2)},${minY.toFixed(2)},${minZ.toFixed(2)} → ${maxX.toFixed(2)},${maxY.toFixed(2)},${maxZ.toFixed(2)}]`);
}
