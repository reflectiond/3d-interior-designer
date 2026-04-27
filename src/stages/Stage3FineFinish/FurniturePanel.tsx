import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import catalogData from '../../data/furniture-catalog.json';
import {
  type CatalogItem,
  getFurnitureTiles,
  findContainingRoom,
  isAllowedInRoom,
  hasCollision,
} from '../../domain/furniture/placement';
import { getDoorBlockedTiles, tilesIntersect } from '../../domain/geometry/openings';
import styles from '../Stage2RoughFinish/SidePanel.module.css';
import fStyles from './FurniturePanel.module.css';

const catalog = catalogData as CatalogItem[];
const catalogMap = new Map<string, CatalogItem>();
for (const item of catalog) {
  catalogMap.set(item.id, item);
}

interface FurniturePanelProps {
  onStartPlace: (item: CatalogItem) => void;
  placingItem: CatalogItem | null;
}

export function FurniturePanel({ onStartPlace, placingItem }: FurniturePanelProps) {
  const { furniture, rooms, layout, removeFurniture, updateFurniture } = useProjectStore();

  const doorBlockedTiles = layout ? getDoorBlockedTiles(layout.doors) : [];

  // Validates that an in-place edit (rotation toggle, mirror) keeps the piece
  // inside a single room and out of collisions with the rest of the layout.
  function isEditValid(
    fId: string,
    catalogId: string,
    position: { x: number; y: number },
    rotation: 0 | 90 | 180 | 270,
  ): boolean {
    const item = catalogMap.get(catalogId);
    if (!item) return false;
    const tiles = getFurnitureTiles(position, item, rotation);
    const room = findContainingRoom(tiles, rooms);
    if (!room) return false;
    if (!isAllowedInRoom(item, room.type)) return false;
    const others = furniture.filter((x) => x.id !== fId);
    if (hasCollision(tiles, others, catalogMap)) return false;
    if (tilesIntersect(tiles, doorBlockedTiles)) return false;
    return true;
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Мебель</h3>

      {/* Catalog */}
      <div className={fStyles.catalog}>
        {catalog.map((item) => {
          const w = (item.size_tiles.w * TILE_SIZE * 100).toFixed(0);
          const h = (item.size_tiles.h * TILE_SIZE * 100).toFixed(0);
          const colorKey = item.color_key as keyof typeof PALETTE.furniture;
          const color = PALETTE.furniture[colorKey] ?? PALETTE.furniture.chair;
          const isPlacing = placingItem?.id === item.id;

          return (
            <button
              key={item.id}
              className={`${fStyles.catalogItem} ${isPlacing ? fStyles.catalogItemActive : ''}`}
              onClick={() => onStartPlace(item)}
              title={`${item.name} (${w}×${h} см)`}
            >
              <div
                className={fStyles.preview}
                style={{
                  backgroundColor: color,
                  aspectRatio: `${item.size_tiles.w}/${item.size_tiles.h}`,
                }}
              />
              <span className={fStyles.itemName}>{item.name}</span>
              <span className={fStyles.itemSize}>
                {w}×{h} см
              </span>
            </button>
          );
        })}
      </div>

      {placingItem && (
        <p className={fStyles.hint}>
          Кликните на 2D-схему, чтобы разместить «{placingItem.name}». R — поворот, Esc — отмена.
        </p>
      )}

      {/* Placed furniture list */}
      {furniture.length > 0 && (
        <>
          <h4 className={fStyles.subTitle}>Размещённая мебель</h4>
          <ul className={styles.roomList}>
            {furniture.map((f, i) => {
              const item = catalog.find((c) => c.id === f.catalogId);
              return (
                <li
                  key={f.id}
                  className={styles.roomItem}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span className={styles.roomName}>
                    {i + 1}. {item?.name ?? f.catalogId} ({f.rotation}°)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {item?.rotatable && (
                      <button
                        className={fStyles.actionBtn}
                        onClick={() => {
                          // Validate the new rotation against the current footprint.
                          // For rectangular pieces 90°/270° swaps width/height, so the
                          // rotated rect may now cross a wall or another piece — reject
                          // silently in that case (consistent with placement behaviour).
                          const next = ((f.rotation + 90) % 360) as 0 | 90 | 180 | 270;
                          if (isEditValid(f.id, f.catalogId, f.position, next)) {
                            updateFurniture(f.id, { rotation: next });
                          }
                        }}
                        title="Повернуть"
                        aria-label="Повернуть"
                      >
                        ↻
                      </button>
                    )}
                    {item?.mirrorable && (
                      <button
                        className={fStyles.actionBtn}
                        onClick={() => {
                          // Mirror keeps the AABB footprint identical for symmetric
                          // boxes shipped today, but stays defensive for future
                          // asymmetric models — re-validate the same way as rotate.
                          if (isEditValid(f.id, f.catalogId, f.position, f.rotation)) {
                            updateFurniture(f.id, { mirrored: !f.mirrored });
                          }
                        }}
                        title="Отзеркалить"
                        aria-label="Отзеркалить"
                      >
                        ⇋
                      </button>
                    )}
                    <button
                      className={fStyles.actionBtn}
                      style={{ color: PALETTE.electrical.panel }}
                      onClick={() => removeFurniture(f.id)}
                      title="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
