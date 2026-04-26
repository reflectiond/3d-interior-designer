import { useState } from 'react';
import { LayoutSchema } from '../../domain/geometry/types';
import type { Layout } from '../../domain/geometry/types';
import { useProjectStore } from '../../store/projectStore';
import { LayoutCard } from './LayoutCard';
import styles from './Stage1LayoutSelection.module.css';

import layout1Data from '../../data/layouts/layout1.json';
import layout2Data from '../../data/layouts/layout2.json';
import layout3Data from '../../data/layouts/layout3.json';

function parseLayout(data: unknown): Layout {
  return LayoutSchema.parse(data);
}

const layouts: Layout[] = [
  parseLayout(layout1Data),
  parseLayout(layout2Data),
  parseLayout(layout3Data),
];

export function Stage1LayoutSelection() {
  const { layoutId, selectLayout, currentStage, setStage } = useProjectStore();
  const [pendingLayout, setPendingLayout] = useState<Layout | null>(null);

  const hasWork = currentStage > 1 || layoutId !== null;

  const handleSelect = (layout: Layout) => {
    if (hasWork && layoutId !== null && layout.id !== layoutId) {
      setPendingLayout(layout);
    } else {
      selectLayout(layout);
    }
  };

  const confirmChange = () => {
    if (pendingLayout) {
      selectLayout(pendingLayout);
      setStage(1);
      setPendingLayout(null);
    }
  };

  const cancelChange = () => {
    setPendingLayout(null);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Выберите планировку</h2>
      <div className={styles.grid}>
        {layouts.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            isSelected={layoutId === layout.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {layoutId !== null && (
        <div className={styles.actions}>
          <button className={styles.nextButton} onClick={() => setStage(2)}>
            Далее →
          </button>
        </div>
      )}

      {pendingLayout && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <h3>Сменить планировку?</h3>
            <p>Все ваши изменения будут сброшены.</p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={cancelChange}>
                Отмена
              </button>
              <button className={styles.confirmBtn} onClick={confirmChange}>
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
