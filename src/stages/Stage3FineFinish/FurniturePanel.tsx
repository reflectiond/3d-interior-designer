import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import catalogData from '../../data/furniture-catalog.json';
import {
  type CatalogItem,
  getFurnitureTiles,
  findContainingRoom,
  hasCollision,
} from '../../domain/furniture/placement';
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
  const { furniture, rooms, removeFurniture, updateFurniture } = useProjectStore();

  // F8.7 (v1.13.0) — свобода размещения: редактирование валидирует только
  // containment + collision; без фильтра `allowed_rooms` и буфера у двери.
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
    const others = furniture.filter((x) => x.id !== fId);
    if (hasCollision(tiles, others, catalogMap)) return false;
    return true;
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Мебель</h3>

      {/* Каталог */}
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

      {/* Список размещённой мебели */}
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
                          // Проверяем новый поворот против текущего footprint'а.
                          // Для прямоугольных предметов 90°/270° меняют местами ширину и
                          // высоту, поэтому повёрнутый прямоугольник может пересечь стену
                          // или другой предмет — в этом случае молча отклоняем
                          // (поведение совпадает с размещением).
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
                          // Mirror сохраняет AABB-footprint для симметричных боксов,
                          // отгружаемых сегодня, но мы остаёмся защитными к будущим
                          // асимметричным моделям — валидируем так же, как и поворот.
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
