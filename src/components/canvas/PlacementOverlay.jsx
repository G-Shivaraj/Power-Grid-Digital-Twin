import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Center, Resize } from '@react-three/drei';
import * as THREE from 'three';


export default function PlacementOverlay() {
  const { scene } = useGLTF('/models/factory.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.35;
        child.material.color = new THREE.Color('#EF4444');
        child.material.emissive = new THREE.Color('#EF4444');
        child.material.emissiveIntensity = 0.5;
      }
    });
    return clone;
  }, [scene]);

  const ghostRef = useRef();
  const { raycaster, camera } = useThree();
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const target = useRef(new THREE.Vector3());

  useFrame(({ pointer }) => {
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(groundPlane, target.current);
    if (ghostRef.current && target.current) {
      ghostRef.current.position.x = target.current.x;
      ghostRef.current.position.z = target.current.z;
      ghostRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group ref={ghostRef} position={[0, 0, 0]}>
      <Center bottom>
        <Resize scale={3.5}>
          <primitive object={clonedScene} />
        </Resize>
      </Center>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.0, 2.2, 32]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.5} />
      </mesh>
      <pointLight position={[0, 2.0, 0]} color="#EF4444" intensity={3} distance={6} />
    </group>
  );
}

useGLTF.preload('/models/factory.glb');
