import { useState, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { FloorCoveringPanel } from './FloorCoveringPanel';
import { WallCoveringPanel } from './WallCoveringPanel';
import { FurniturePanel } from './FurniturePanel';
import { View2D } from '../../views/View2D/View2D';
import { View3D } from '../../views/View3D/View3D';
import type { CatalogItem } from '../../domain/furniture/placement';
import {
  getFurnitureTiles,
  findContainingRoom,
  isAllowedInRoom,
  hasCollision,
  getEffectiveSize,
} from '../../domain/furniture/placement';
import { getDoorBlockedTiles, tilesIntersect } from '../../domain/geometry/openings';
import catalogData from '../../data/furniture-catalog.json';
import panelStyles from '../Stage2RoughFinish/SidePanel.module.css';
import stageStyles from '../Stage2RoughFinish/Stage2RoughFinish.module.css';

type Tab = 'floor' | 'walls' | 'furniture';
type ViewMode = '2d' | '3d';

const TABS: { id: Tab; label: string }[] = [
  { id: 'floor', label: 'Пол' },
  { id: 'walls', label: 'Стены' },
  { id: 'furniture', label: 'Мебель' },
];

const catalogMap = new Map<string, CatalogItem>();
for (const item of catalogData as CatalogItem[]) {
  catalogMap.set(item.id, item);
}

export function Stage3FineFinish() {
  const [activeTab, setActiveTab] = useState<Tab>('floor');
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [placingItem, setPlacingItem] = useState<CatalogItem | null>(null);
  const [placingRotation, setPlacingRotation] = useState<0 | 90 | 180 | 270>(0);
  const { setStage, rooms, furniture, layout, addFurniture, updateFurniture } = useProjectStore();

  // F7.3.4 — door swing tiles forbid furniture placement
  const doorBlockedTiles = useMemo(
    () => (layout ? getDoorBlockedTiles(layout.doors) : []),
    [layout],
  );

  // F8.1 — drag-to-move handlers for placed furniture
  const validateMove = useCallback(
    (id: string, tx: number, ty: number): boolean => {
      const f = furniture.find((x) => x.id === id);
      if (!f) return false;
      const item = catalogMap.get(f.catalogId);
      if (!item) return false;
      const tiles = getFurnitureTiles({ x: tx, y: ty }, item, f.rotation);
      const room = findContainingRoom(tiles, rooms);
      if (!room) return false;
      if (!isAllowedInRoom(item, room.type)) return false;
      // Exclude self from collision check — the piece is allowed to occupy
      // its own current footprint while moving.
      const others = furniture.filter((x) => x.id !== id);
      if (hasCollision(tiles, others, catalogMap)) return false;
      // F7.3.4 — reject placements that would block a door swing
      if (tilesIntersect(tiles, doorBlockedTiles)) return false;
      return true;
    },
    [furniture, rooms, doorBlockedTiles],
  );

  const commitMove = useCallback(
    (id: string, tx: number, ty: number) => {
      updateFurniture(id, { position: { x: tx, y: ty } });
    },
    [updateFurniture],
  );

  const handleStartPlace = useCallback((item: CatalogItem) => {
    setPlacingItem(item);
    setPlacingRotation(0);
    setViewMode('2d');
  }, []);

  const handleFurniturePlace = useCallback(
    (tileX: number, tileY: number) => {
      if (!placingItem) return;

      const pos = { x: Math.floor(tileX), y: Math.floor(tileY) };
      const tiles = getFurnitureTiles(pos, placingItem, placingRotation);
      const room = findContainingRoom(tiles, rooms);

      if (!room) return;
      if (!isAllowedInRoom(placingItem, room.type)) return;
      if (hasCollision(tiles, furniture, catalogMap)) return;
      // F7.3.4 — reject placements that would block a door swing
      if (tilesIntersect(tiles, doorBlockedTiles)) return;

      addFurniture({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        catalogId: placingItem.id,
        position: pos,
        rotation: placingRotation,
        mirrored: false,
      });
    },
    [placingItem, placingRotation, rooms, furniture, addFurniture, doorBlockedTiles],
  );

  // Keyboard: R to rotate, Escape to cancel
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!placingItem) return;
      if (e.key === 'r' || e.key === 'R') {
        setPlacingRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
      }
      if (e.key === 'Escape') {
        setPlacingItem(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [placingItem]);

  return (
    <div className={stageStyles.layout}>
      <div className={panelStyles.panel}>
        <div className={panelStyles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${panelStyles.tab} ${activeTab === tab.id ? panelStyles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'floor' && <FloorCoveringPanel />}
        {activeTab === 'walls' && <WallCoveringPanel />}
        {activeTab === 'furniture' && (
          <FurniturePanel onStartPlace={handleStartPlace} placingItem={placingItem} />
        )}
      </div>
      <div className={stageStyles.canvas}>
        <div className={stageStyles.viewToggle}>
          <button
            className={`${stageStyles.toggleBtn} ${viewMode === '2d' ? stageStyles.toggleActive : ''}`}
            onClick={() => setViewMode('2d')}
          >
            2D-схема
          </button>
          <button
            className={`${stageStyles.toggleBtn} ${viewMode === '3d' ? stageStyles.toggleActive : ''}`}
            onClick={() => setViewMode('3d')}
          >
            Посмотреть в 3D
          </button>
        </div>
        {viewMode === '2d' ? (
          <View2D
            interactionMode={placingItem ? 'furniture' : 'none'}
            onFurniturePlace={handleFurniturePlace}
            placingPreview={
              placingItem
                ? (() => {
                    const { w, h } = getEffectiveSize(placingItem, placingRotation);
                    return {
                      width: w,
                      height: h,
                      isValid: (tx: number, ty: number) => {
                        const pos = { x: Math.floor(tx), y: Math.floor(ty) };
                        const tiles = getFurnitureTiles(pos, placingItem, placingRotation);
                        const room = findContainingRoom(tiles, rooms);
                        if (!room) return false;
                        if (!isAllowedInRoom(placingItem, room.type)) return false;
                        if (hasCollision(tiles, furniture, catalogMap)) return false;
                        if (tilesIntersect(tiles, doorBlockedTiles)) return false;
                        return true;
                      },
                    };
                  })()
                : null
            }
            furnitureDrag={placingItem ? null : { isValid: validateMove, onCommit: commitMove }}
          />
        ) : (
          <View3D />
        )}
        <div className={stageStyles.actions}>
          <button className={stageStyles.backBtn} onClick={() => setStage(2)}>
            ← Назад
          </button>
          <button className={stageStyles.nextBtn} onClick={() => setStage(4)}>
            Далее →
          </button>
        </div>
      </div>
    </div>
  );
}
