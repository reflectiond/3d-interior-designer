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
  // F8.5.1 (v1.13.0) — текущая выбранная на канве размещённая мебель.
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const { setStage, rooms, furniture, addFurniture, updateFurniture, removeFurniture } =
    useProjectStore();

  // F8.7 (v1.13.0) — свобода размещения: ограничения `allowed_rooms` и буфера
  // дверей убраны. Остались containment и collision.

  // F8.1 — обработчики drag-to-move для размещённой мебели
  const validateMove = useCallback(
    (id: string, tx: number, ty: number): boolean => {
      const f = furniture.find((x) => x.id === id);
      if (!f) return false;
      const item = catalogMap.get(f.catalogId);
      if (!item) return false;
      const tiles = getFurnitureTiles({ x: tx, y: ty }, item, f.rotation);
      const room = findContainingRoom(tiles, rooms);
      if (!room) return false;
      // Исключаем самого себя из проверки коллизий — предмет вправе занимать
      // собственный текущий footprint во время перемещения.
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
    // F8.5 — выбор нового предмета в каталоге снимает предыдущее выделение.
    setSelectedFurnitureId(null);
  }, []);

  const handleFurniturePlace = useCallback(
    (tileX: number, tileY: number) => {
      if (!placingItem) return;

      const pos = { x: Math.floor(tileX), y: Math.floor(tileY) };
      const tiles = getFurnitureTiles(pos, placingItem, placingRotation);
      const room = findContainingRoom(tiles, rooms);

      if (!room) return;
      // F8.7 (v1.13.0): без фильтра по типу комнаты, без буфера у двери.
      if (hasCollision(tiles, furniture, catalogMap)) return;

      addFurniture({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        catalogId: placingItem.id,
        position: pos,
        rotation: placingRotation,
        mirrored: false,
      });

      // F8.6.1 (v1.12.0): single-shot — после успешного commit'а выходим из режима
      // размещения, чтобы случайные дальнейшие клики не создавали ещё один предмет.
      // Зеркалит F11.2.9 (single-shot tool) в редакторе планировок.
      setPlacingItem(null);
      setPlacingRotation(0);
    },
    [placingItem, placingRotation, rooms, furniture, addFurniture],
  );

  // Обработчики клавиатуры разделены на два эффекта, чтобы списки зависимостей оставались узкими.
  // 1) Клавиши в режиме размещения: R вращает, Escape отменяет.
  // F8.5.3-fix (v1.17.0): используем `e.code` вместо `e.key` для буквенных
  // клавиш — `e.key` зависит от раскладки (русская К на физической R даёт
  // `e.key === 'к'`, не `'R'`). Стрелки/Delete/Escape остаются на `e.key`,
  // т.к. они layout-independent.
  useEffect(() => {
    if (!placingItem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        setPlacingRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
      }
      if (e.key === 'Escape') {
        setPlacingItem(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [placingItem]);

  // 2) F8.5.3 (v1.13.0) — клавиши в режиме selection: R вращает, M зеркалит,
  //    Delete/Backspace удаляет, стрелки сдвигают на 1 тайл (с валидацией).
  useEffect(() => {
    if (placingItem || !selectedFurnitureId || activeTab !== 'furniture') return;
    const handleKey = (e: KeyboardEvent) => {
      // Не перехватываем клавиши, пока пользователь печатает в input/textarea.
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const f = furniture.find((x) => x.id === selectedFurnitureId);
      if (!f) return;
      const item = catalogMap.get(f.catalogId);
      if (!item) return;

      if (e.code === 'KeyR') {
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
      if (e.code === 'KeyM') {
        if (!item.mirrorable) return;
        // Mirror в текущем каталоге сохраняет симметричный footprint, валидация не нужна.
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
      // Ось y тайлов направлена вверх (View2D инвертирует при рендере); Up arrow → +y в tile-space.
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
                        // F8.7 (v1.13.0): без фильтра по типу комнаты, без буфера у двери.
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
