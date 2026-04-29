import { useMemo, useCallback, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { computeEstimate } from '../../domain/pricing/estimator';
import {
  groupEstimateByWorkType,
  formatGroupQuantity,
  type EstimateGroup,
} from '../../domain/pricing/groupEstimate';
import type { CatalogItem } from '../../domain/furniture/placement';
import { exportProjectJSON, importProjectJSON } from '../../persistence/jsonExportImport';
import { exportPDF } from '../../export/pdfExporter';
import { exportPNG } from '../../export/imageExporter';
import { capture2DSnapshot, capture3DSnapshot } from '../../export/snapshots';
import { View3DSnapshot } from '../../export/snapshot/View3DSnapshot';
import { View2D } from '../../views/View2D/View2D';
import catalogData from '../../data/furniture-catalog.json';
import styles from './Stage4Summary.module.css';

const catalogMap = new Map<string, CatalogItem>();
for (const item of catalogData as CatalogItem[]) {
  catalogMap.set(item.id, item);
}

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

interface CategorySectionProps {
  title: string;
  groups: EstimateGroup[];
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}

function CategorySection({ title, groups, expanded, onToggle }: CategorySectionProps) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.estimateList}>
        {groups.map((g) => {
          const key = `${g.category}:${g.workType}`;
          const isOpen = !!expanded[key];
          // F9.1.7 (v1.12.0): groups with a single line have nothing to expand
          // — render a neutral bullet instead of the chevron, and disable the
          // toggle so the row doesn't pretend to be interactive.
          const expandable = g.items.length > 1;
          return (
            <li key={key} className={styles.estimateItem}>
              <button
                type="button"
                className={styles.estimateRow}
                onClick={expandable ? () => onToggle(key) : undefined}
                aria-expanded={expandable ? isOpen : undefined}
                disabled={!expandable}
                style={!expandable ? { cursor: 'default' } : undefined}
              >
                <span className={styles.disclosure} aria-hidden="true">
                  {expandable ? (isOpen ? '▼' : '▶') : '•'}
                </span>
                <span className={styles.estimateName}>{g.workType}</span>
                <span className={styles.estimateQty}>{formatGroupQuantity(g)}</span>
                <span className={styles.estimatePrice}>
                  {formatPrice(g.totalPriceMin)} — {formatPrice(g.totalPriceMax)}
                </span>
              </button>
              {isOpen && expandable && (
                <ul className={styles.estimateDetails}>
                  {g.items.map((item, i) => (
                    <li key={`${key}-detail-${i}`} className={styles.estimateDetailRow}>
                      <span className={styles.estimateName}>{item.name}</span>
                      <span className={styles.estimateQty}>{item.quantity}</span>
                      <span className={styles.estimatePrice}>
                        {formatPrice(item.priceMin)} — {formatPrice(item.priceMax)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Stage4Summary() {
  const state = useProjectStore();
  const {
    rooms,
    flooring,
    ceiling,
    floorCovering,
    wallCovering,
    electricalRoutes,
    furniture,
    layout,
    layoutId,
    setStage,
  } = state;

  const projectId = layoutId !== null ? `layout${layoutId}` : null;

  const estimate = useMemo(
    () =>
      computeEstimate(
        rooms,
        flooring,
        ceiling,
        floorCovering,
        wallCovering,
        electricalRoutes,
        furniture,
        catalogMap,
        layout?.windows ?? [],
        layout?.doors ?? [],
      ),
    [rooms, flooring, ceiling, floorCovering, wallCovering, electricalRoutes, furniture, layout],
  );

  const allGroups = useMemo(() => groupEstimateByWorkType(estimate.items), [estimate.items]);
  const roughGroups = allGroups.filter((g) => g.category === 'rough');
  const fineGroups = allGroups.filter((g) => g.category === 'fine');
  const furnitureGroups = allGroups.filter((g) => g.category === 'furniture');

  // F9.1.3 — все группы по умолчанию свёрнуты
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExportPDF = useCallback(() => {
    const snapshot2D = capture2DSnapshot();
    const snapshot3D = capture3DSnapshot();
    exportPDF(estimate, snapshot2D, snapshot3D, projectId).catch((err: unknown) => {
      console.error('PDF export failed:', err);
      alert('Не удалось экспортировать PDF. Попробуйте перезагрузить страницу.');
    });
  }, [estimate, projectId]);

  const handleExportPNG = useCallback(() => {
    const snapshot2D = capture2DSnapshot();
    exportPNG(snapshot2D, estimate, projectId).catch((err: unknown) => {
      console.error('PNG export failed:', err);
      alert('Не удалось экспортировать PNG. Попробуйте перезагрузить страницу.');
    });
  }, [estimate, projectId]);

  const handleExportJSON = () => {
    exportProjectJSON(state);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      importProjectJSON(text);
    };
    input.click();
  };

  return (
    <div className={styles.container}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -10000,
          top: -10000,
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
      >
        <View2D />
      </div>
      <View3DSnapshot />

      <h2 className={styles.heading}>Итоговая смета</h2>

      {roughGroups.length > 0 && (
        <CategorySection
          title="Черновая отделка"
          groups={roughGroups}
          expanded={expanded}
          onToggle={toggleGroup}
        />
      )}

      {fineGroups.length > 0 && (
        <CategorySection
          title="Чистовая отделка"
          groups={fineGroups}
          expanded={expanded}
          onToggle={toggleGroup}
        />
      )}

      {furnitureGroups.length > 0 && (
        <CategorySection
          title="Мебель"
          groups={furnitureGroups}
          expanded={expanded}
          onToggle={toggleGroup}
        />
      )}

      <div className={styles.total}>
        <span>Итого:</span>
        <span className={styles.totalRange}>
          {formatPrice(estimate.totalMin)} — {formatPrice(estimate.totalMax)}
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={() => setStage(3)}>
          ← Назад
        </button>
        <button className={styles.actionBtn} onClick={handleExportPDF}>
          Сохранить как PDF
        </button>
        <button className={styles.actionBtn} onClick={handleExportPNG}>
          Сохранить как PNG
        </button>
        <button className={styles.actionBtn} onClick={handleExportJSON}>
          Сохранить проект (JSON)
        </button>
        <button className={styles.actionBtn} onClick={handleImportJSON}>
          Загрузить проект
        </button>
      </div>
    </div>
  );
}
