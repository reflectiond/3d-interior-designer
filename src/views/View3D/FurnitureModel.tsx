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
  // Auto-scale + auto-center: вписать bbox модели в (widthM, heightM, depthM)
  // и сдвинуть так, чтобы она занимала ровно тот footprint, который ожидается
  // по `size_tiles` каталога. Kenney-модели могут иметь local origin в любом
  // углу bbox; без X/Z-центрирования они визуально смещены от позиции,
  // указанной в 2D-плане.
  const { sx, sy, sz, ox, oy, oz } = useMemo(() => {
    const bbox = new Box3().setFromObject(cloned);
    const size = new Vector3();
    bbox.getSize(size);
    const eps = 1e-4;
    const sx = widthM / Math.max(size.x, eps);
    const sy = scaleY ?? heightM / Math.max(size.y, eps);
    const sz = depthM / Math.max(size.z, eps);
    // Parent group (см. ProjectScene) уже расположена на (cx, heightM/2, cz):
    // её локальный (0,0,0) — это центр footprint'а на высоте heightM/2.
    // Мы хотим, чтобы:
    //   - центр bbox по X совпадал с локальным X=0 → ox = -bbox.center.x * sx
    //   - низ bbox по Y был на полу (мир Y=0) → oy = -bbox.min.y*sy - heightM/2
    //   - центр bbox по Z совпадал с локальным Z=0 → oz = -bbox.center.z * sz
    const ox = -((bbox.min.x + bbox.max.x) / 2) * sx;
    const oy = -bbox.min.y * sy - heightM / 2;
    const oz = -((bbox.min.z + bbox.max.z) / 2) * sz;
    return { sx, sy, sz, ox, oy, oz };
  }, [cloned, widthM, heightM, depthM, scaleY]);
  return (
    <primitive
      object={cloned}
      position={[ox, oy, oz]}
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
