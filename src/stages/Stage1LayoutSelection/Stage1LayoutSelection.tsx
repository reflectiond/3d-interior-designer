import { useEffect, useRef, useState } from 'react';
import { LayoutSchema } from '../../domain/geometry/types';
import type { Layout } from '../../domain/geometry/types';
import { useProjectStore } from '../../store/projectStore';
import { LayoutCard } from './LayoutCard';
import {
  loadCustomLayouts,
  importCustomLayout,
  deleteCustomLayout,
  MAX_CUSTOM_LAYOUTS,
  type CustomLayoutEntry,
} from '../../persistence/customLayouts';
import styles from './Stage1LayoutSelection.module.css';

import layout1Data from '../../data/layouts/layout1.json';
import layout2Data from '../../data/layouts/layout2.json';
import layout3Data from '../../data/layouts/layout3.json';

function parseLayout(data: unknown): Layout {
  return LayoutSchema.parse(data);
}

const builtInLayouts: Layout[] = [
  parseLayout(layout1Data),
  parseLayout(layout2Data),
  parseLayout(layout3Data),
];

export function Stage1LayoutSelection() {
  const { layoutId, selectLayout, currentStage, setStage } = useProjectStore();
  const [pendingLayout, setPendingLayout] = useState<Layout | null>(null);
  const [customs, setCustoms] = useState<CustomLayoutEntry[]>(() => loadCustomLayouts());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F14.2 — реактивная синхронизация со storage в случае изменений из других вкладок.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === '3d-interior-designer-custom-layouts') setCustoms(loadCustomLayouts());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  // F14.1 — клик по кнопке открывает hidden file input.
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволить повторно выбрать тот же файл
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = importCustomLayout(json);
      if (!result.ok) {
        if (result.reason === 'limit') {
          alert(`Достигнут лимит ${MAX_CUSTOM_LAYOUTS} импортированных планировок.`);
        } else {
          alert('Файл не прошёл валидацию схемы планировки.');
        }
        return;
      }
      setCustoms(loadCustomLayouts());
    } catch {
      alert('Не удалось прочитать JSON: файл повреждён или имеет неверный формат.');
    }
  };

  const handleDeleteCustom = (entryId: string, layoutOfEntry: Layout) => {
    deleteCustomLayout(entryId);
    setCustoms(loadCustomLayouts());
    // Если удалили выбранную сейчас — снимем выбор.
    if (layoutId === layoutOfEntry.id) {
      useProjectStore.setState({ layoutId: null });
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Выберите планировку</h2>

      <div className={styles.toolbar}>
        <button
          className={styles.importBtn}
          onClick={handleImportClick}
          data-testid="import-layout-btn"
        >
          Загрузить планировку из файла
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className={styles.hiddenInput}
          data-testid="import-layout-input"
        />
      </div>

      <div className={styles.grid}>
        {builtInLayouts.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            isSelected={layoutId === layout.id}
            onSelect={handleSelect}
          />
        ))}
        {customs.map((entry) => (
          <LayoutCard
            key={entry.entryId}
            layout={entry.layout}
            isSelected={layoutId === entry.layout.id}
            onSelect={handleSelect}
            isCustom
            onDelete={() => handleDeleteCustom(entry.entryId, entry.layout)}
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
