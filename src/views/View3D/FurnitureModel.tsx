import { Suspense, useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import { useGLTF } from '@react-three/drei';

/**
 * F15.3 (v1.16.0) — рендер мебели в 3D через glTF/GLB модель с
 * fallback'ом на простой Box.
 *
 * Дополнительно: модель авто-масштабируется так, чтобы её bounding box
 * вписался в `[widthM, heightM, depthM]` (размеры из size_tiles каталога
 * + height_m). Kenney и другие источники имеют native dimensions,
 * которые редко совпадают с заданным footprint'ом, поэтому без скейла
 * мебель оказывалась бы либо больше, либо меньше отведённого места.
 * `meta.scaleY` позволяет вручную перетереть Y-скейл если у модели
 * нестандартная вертикаль (Z-up etc).
 *
 * `gltf.scene.clone(true)` нужен потому что `useGLTF` кэширует один
 * экземпляр; без клонирования две инстанции одной мебели делят transform.
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

interface GltfProps extends BoxProps {
  url: string;
  rotation?: number;
  scaleY?: number;
}

function GltfModel({ url, widthM, heightM, depthM, rotation = 0, scaleY }: GltfProps) {
  const gltf = useGLTF(url);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf]);
  // Auto-scale: вписать bbox модели в (widthM, heightM, depthM). Подсчёт
  // bbox происходит ОДИН раз на mount (useMemo + dep на cloned).
  const { sx, sy, sz, cy } = useMemo(() => {
    const bbox = new Box3().setFromObject(cloned);
    const size = new Vector3();
    bbox.getSize(size);
    const eps = 1e-4;
    const sx = widthM / Math.max(size.x, eps);
    const sy = scaleY ?? heightM / Math.max(size.y, eps);
    const sz = depthM / Math.max(size.z, eps);
    // После скейла bbox.min.y * sy — низ модели; смещаем модель так,
    // чтобы её низ касался y=0 локальной системы (которая уже у пола
    // комнаты после group position[cx, hm/2, cz]).
    const cy = -(bbox.min.y * sy) - heightM / 2;
    return { sx, sy, sz, cy };
  }, [cloned, widthM, heightM, depthM, scaleY]);
  return (
    <primitive
      object={cloned}
      position={[0, cy, 0]}
      rotation={[0, rotation, 0]}
      scale={[sx, sy, sz]}
    />
  );
}

interface FurnitureModelProps extends BoxProps {
  model3d?: { url: string; rotation?: number; scaleY?: number };
}

export function FurnitureModel({ model3d, ...box }: FurnitureModelProps) {
  if (!model3d) return <BoxFallback {...box} />;
  return (
    <Suspense fallback={<BoxFallback {...box} />}>
      <GltfModel
        url={model3d.url}
        widthM={box.widthM}
        heightM={box.heightM}
        depthM={box.depthM}
        color={box.color}
        rotation={model3d.rotation}
        scaleY={model3d.scaleY}
      />
    </Suspense>
  );
}
