import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import catalogData from '../../data/furniture-catalog.json';
import type { CatalogItem } from '../../domain/furniture/placement';
import styles from '../Stage2RoughFinish/SidePanel.module.css';
import fStyles from './FurniturePanel.module.css';

const catalog = catalogData as CatalogItem[];

interface FurniturePanelProps {
  onStartPlace: (item: CatalogItem) => void;
  placingItem: CatalogItem | null;
}

export function FurniturePanel({ onStartPlace, placingItem }: FurniturePanelProps) {
  const { furniture, removeFurniture, updateFurniture } = useProjectStore();

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
                        onClick={() =>
                          updateFurniture(f.id, {
                            rotation: ((f.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                          })
                        }
                        title="Повернуть"
                      >
                        ↻
                      </button>
                    )}
                    {item?.mirrorable && (
                      <button
                        className={fStyles.actionBtn}
                        onClick={() => updateFurniture(f.id, { mirrored: !f.mirrored })}
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
