import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';

/**
 * F15.3 (v1.16.0) — рендер мебели в 3D через glTF/GLB модель с
 * fallback'ом на простой Box.
 *
 * `useGLTF` использует Suspense — пока модель грузится, отображается
 * `BoxFallback`. Если URL невалиден или модель не загрузилась, дрей
 * выкинет Promise, и Suspense останется на fallback'е. Сцена не падает.
 *
 * `model.scene.clone(true)` нужен потому, что `useGLTF` кэширует один
 * экземпляр; без клонирования две инстанции одной мебели в сцене
 * перетягивают transform друг друга.
 */

interface BoxProps {
  widthM: number;
  heightM: number;
  depthM: number;
  color: string;
}

function BoxFallback({ widthM, heightM, depthM, color }: BoxProps) {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[widthM, heightM, depthM]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface GltfProps {
  url: string;
  rotation?: number;
  scaleY?: number;
}

function GltfModel({ url, rotation = 0, scaleY = 1 }: GltfProps) {
  const gltf = useGLTF(url);
  const cloned = gltf.scene.clone(true);
  return <primitive object={cloned} rotation={[0, rotation, 0]} scale={[1, scaleY, 1]} />;
}

interface FurnitureModelProps extends BoxProps {
  model3d?: { url: string; rotation?: number; scaleY?: number };
}

export function FurnitureModel({ model3d, ...box }: FurnitureModelProps) {
  if (!model3d) return <BoxFallback {...box} />;
  return (
    <Suspense fallback={<BoxFallback {...box} />}>
      <GltfModel url={model3d.url} rotation={model3d.rotation} scaleY={model3d.scaleY} />
    </Suspense>
  );
}
