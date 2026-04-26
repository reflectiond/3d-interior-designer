import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useElectricalRoutes } from '../../domain/electrical/useElectricalRoutes';
import { ScreedPanel } from './ScreedPanel';
import { CeilingPanel } from './CeilingPanel';
import { PlasterPanel } from './PlasterPanel';
import { ElectricalPanel } from './ElectricalPanel';
import { View2D } from '../../views/View2D/View2D';
import { View3D } from '../../views/View3D/View3D';
import styles from './SidePanel.module.css';
import stageStyles from './Stage2RoughFinish.module.css';

type Tab = 'screed' | 'electrical' | 'plaster' | 'ceiling';
type ViewMode = '2d' | '3d';

const TABS: { id: Tab; label: string }[] = [
  { id: 'screed', label: 'Стяжка' },
  { id: 'electrical', label: 'Электрика' },
  { id: 'plaster', label: 'Штукатурка' },
  { id: 'ceiling', label: 'Потолок' },
];

export function Stage2RoughFinish() {
  const [activeTab, setActiveTab] = useState<Tab>('screed');
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [pointType, setPointType] = useState<'socket' | 'switch'>('socket');
  const { setStage } = useProjectStore();

  // Auto-recompute BFS routes when electrical points change
  useElectricalRoutes();

  return (
    <div className={stageStyles.layout}>
      <div className={styles.panel}>
        <div className={styles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'screed' && <ScreedPanel />}
        {activeTab === 'electrical' && (
          <ElectricalPanel pointType={pointType} onPointTypeChange={setPointType} />
        )}
        {activeTab === 'plaster' && <PlasterPanel />}
        {activeTab === 'ceiling' && <CeilingPanel />}
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
            interactionMode={activeTab === 'electrical' ? 'electrical' : 'none'}
            electricalPointType={pointType}
          />
        ) : (
          <View3D />
        )}
        <div className={stageStyles.actions}>
          <button className={stageStyles.backBtn} onClick={() => setStage(1)}>
            ← Назад
          </button>
          <button className={stageStyles.nextBtn} onClick={() => setStage(3)}>
            Далее →
          </button>
        </div>
      </div>
    </div>
  );
}
