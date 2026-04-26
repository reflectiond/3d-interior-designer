import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { ScreedPanel } from './ScreedPanel';
import { CeilingPanel } from './CeilingPanel';
import { PlasterPanel } from './PlasterPanel';
import { ElectricalPanel } from './ElectricalPanel';
import { View2D } from '../../views/View2D/View2D';
import styles from './SidePanel.module.css';
import stageStyles from './Stage2RoughFinish.module.css';

type Tab = 'screed' | 'electrical' | 'plaster' | 'ceiling';

const TABS: { id: Tab; label: string }[] = [
  { id: 'screed', label: 'Стяжка' },
  { id: 'electrical', label: 'Электрика' },
  { id: 'plaster', label: 'Штукатурка' },
  { id: 'ceiling', label: 'Потолок' },
];

export function Stage2RoughFinish() {
  const [activeTab, setActiveTab] = useState<Tab>('screed');
  const { setStage } = useProjectStore();

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
        {activeTab === 'electrical' && <ElectricalPanel />}
        {activeTab === 'plaster' && <PlasterPanel />}
        {activeTab === 'ceiling' && <CeilingPanel />}
      </div>
      <div className={stageStyles.canvas}>
        <View2D />
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
