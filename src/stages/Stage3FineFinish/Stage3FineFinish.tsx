import { useState, useCallback, useEffect } from 'react';
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
  hasCollision,
  getEffectiveSize,
} from '../../domain/furniture/placement';
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
  // F8.5.1 (v1.13.0) — currently selected placed furniture on canvas.
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const { setStage, rooms, furniture, addFurniture, updateFurniture, removeFurniture } =
    useProjectStore();

  // F8.7 (v1.13.0) — placement freedom: `allowed_rooms` and door buffer
  // restrictions are removed. Containment and collision remain.

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
      // Exclude self from collision check — the piece is allowed to occupy
      // its own current footprint while moving.
      const others = furniture.filter((x) => x.id !== id);
      if (hasCollision(tiles, others, catalogMap)) return false;
      return true;
    },
    [furniture, rooms],
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
    // F8.5 — picking a new piece in the catalog clears any prior selection.
    setSelectedFurnitureId(null);
  }, []);

  const handleFurniturePlace = useCallback(
    (tileX: number, tileY: number) => {
      if (!placingItem) return;

      const pos = { x: Math.floor(tileX), y: Math.floor(tileY) };
      const tiles = getFurnitureTiles(pos, placingItem, placingRotation);
      const room = findContainingRoom(tiles, rooms);

      if (!room) return;
      // F8.7 (v1.13.0): no room-type filter, no door buffer.
      if (hasCollision(tiles, furniture, catalogMap)) return;

      addFurniture({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        catalogId: placingItem.id,
        position: pos,
        rotation: placingRotation,
        mirrored: false,
      });

      // F8.6.1 (v1.12.0): single-shot — drop placement mode after a successful
      // commit so accidental further canvas clicks don't spawn another piece.
      // Mirrors F11.2.9 (single-shot tool) in the layout editor.
      setPlacingItem(null);
      setPlacingRotation(0);
    },
    [placingItem, placingRotation, rooms, furniture, addFurniture],
  );

  // Keyboard handlers split into two effects so the dependency lists stay tight.
  // 1) Placement-mode keys: R rotates, Escape cancels.
  useEffect(() => {
    if (!placingItem) return;
    const handleKey = (e: KeyboardEvent) => {
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

  // 2) F8.5.3 (v1.13.0) — selection-mode keys: R rotate, M mirror,
  //    Delete/Backspace remove, arrow keys nudge by 1 tile (validated).
  useEffect(() => {
    if (placingItem || !selectedFurnitureId || activeTab !== 'furniture') return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't grab keys when the user is typing in an input/textarea.
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const f = furniture.find((x) => x.id === selectedFurnitureId);
      if (!f) return;
      const item = catalogMap.get(f.catalogId);
      if (!item) return;

      if (e.key === 'r' || e.key === 'R') {
        if (!item.rotatable) return;
        const nextRot = ((f.rotation + 90) % 360) as 0 | 90 | 180 | 270;
        // F8.5.3-fix (v1.17.0): вращаем вокруг центра footprint'а.
        // Раньше использовалась `f.position` (bottom-left), что для
        // асимметричных предметов (6×3 → 3×6) приводило к тому, что
        // повёрнутый предмет выходил за границы комнаты в одну
        // сторону, и `findContainingRoom` возвращал null → silent fail.
        const oldEff = getEffectiveSize(item, f.rotation);
        const newEff = getEffectiveSize(item, nextRot);
        const newPos = {
          x: f.position.x + Math.round((oldEff.w - newEff.w) / 2),
          y: f.position.y + Math.round((oldEff.h - newEff.h) / 2),
        };
        const tiles = getFurnitureTiles(newPos, item, nextRot);
        const room = findContainingRoom(tiles, rooms);
        if (!room) return;
        const others = furniture.filter((x) => x.id !== f.id);
        if (hasCollision(tiles, others, catalogMap)) return;
        updateFurniture(f.id, { rotation: nextRot, position: newPos });
        e.preventDefault();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        if (!item.mirrorable) return;
        // Mirror keeps footprint symmetric for current catalog, no validation needed.
        updateFurniture(f.id, { mirrored: !f.mirrored });
        e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeFurniture(f.id);
        setSelectedFurnitureId(null);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedFurnitureId(null);
        return;
      }
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowDown' ? -1 : e.key === 'ArrowUp' ? 1 : 0;
      if (dx === 0 && dy === 0) return;
      // Tile y-axis is up (View2D inverts on render); Up arrow → +y in tile space.
      const nx = f.position.x + dx;
      const ny = f.position.y + dy;
      const tiles = getFurnitureTiles({ x: nx, y: ny }, item, f.rotation);
      const room = findContainingRoom(tiles, rooms);
      if (!room) return;
      const others = furniture.filter((x) => x.id !== f.id);
      if (hasCollision(tiles, others, catalogMap)) return;
      updateFurniture(f.id, { position: { x: nx, y: ny } });
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    placingItem,
    selectedFurnitureId,
    activeTab,
    furniture,
    rooms,
    updateFurniture,
    removeFurniture,
  ]);

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
                        // F8.7 (v1.13.0): no room-type filter, no door buffer.
                        if (hasCollision(tiles, furniture, catalogMap)) return false;
                        return true;
                      },
                    };
                  })()
                : null
            }
            furnitureDrag={placingItem ? null : { isValid: validateMove, onCommit: commitMove }}
            selectedFurnitureId={activeTab === 'furniture' ? selectedFurnitureId : null}
            onSelectFurniture={activeTab === 'furniture' ? setSelectedFurnitureId : undefined}
          />
        ) : (
          <View3D
            selectedFurnitureId={activeTab === 'furniture' ? selectedFurnitureId : null}
            onSelectFurniture={activeTab === 'furniture' ? setSelectedFurnitureId : undefined}
          />
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
