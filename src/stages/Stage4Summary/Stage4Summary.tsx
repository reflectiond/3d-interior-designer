import { useMemo, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { computeEstimate } from '../../domain/pricing/estimator';
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
      ),
    [rooms, flooring, ceiling, floorCovering, wallCovering, electricalRoutes, furniture],
  );

  const roughItems = estimate.items.filter((i) => i.category === 'rough');
  const fineItems = estimate.items.filter((i) => i.category === 'fine');
  const furnitureItems = estimate.items.filter((i) => i.category === 'furniture');

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

      {roughItems.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Черновая отделка</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Кол-во</th>
                <th>Мин. цена</th>
                <th>Макс. цена</th>
              </tr>
            </thead>
            <tbody>
              {roughItems.map((item, i) => (
                <tr key={`rough-${i}`}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.priceMin)}</td>
                  <td>{formatPrice(item.priceMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {fineItems.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Чистовая отделка</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Кол-во</th>
                <th>Мин. цена</th>
                <th>Макс. цена</th>
              </tr>
            </thead>
            <tbody>
              {fineItems.map((item, i) => (
                <tr key={`fine-${i}`}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.priceMin)}</td>
                  <td>{formatPrice(item.priceMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {furnitureItems.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Мебель</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Кол-во</th>
                <th>Мин. цена</th>
                <th>Макс. цена</th>
              </tr>
            </thead>
            <tbody>
              {furnitureItems.map((item, i) => (
                <tr key={`furn-${i}`}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.priceMin)}</td>
                  <td>{formatPrice(item.priceMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
