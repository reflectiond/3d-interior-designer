import { useProjectStore } from '../store/projectStore';
import type { Stage } from '../store/projectStore';
import styles from './StageNavigator.module.css';

const STAGES: { id: Stage; label: string }[] = [
  { id: 1, label: '1. Планировка' },
  { id: 2, label: '2. Черновая отделка' },
  { id: 3, label: '3. Чистовая отделка' },
  { id: 4, label: '4. Итоги' },
];

export function StageNavigator() {
  const { currentStage, setStage, layoutId } = useProjectStore();

  const handleClick = (stage: Stage) => {
    // Can go back freely, forward only if layout is selected
    if (stage <= currentStage || (stage > currentStage && layoutId !== null)) {
      setStage(stage);
    }
  };

  return (
    <nav className={styles.nav} aria-label="Этапы">
      {STAGES.map(({ id, label }) => (
        <button
          key={id}
          className={`${styles.step} ${id === currentStage ? styles.active : ''} ${id < currentStage ? styles.completed : ''}`}
          onClick={() => handleClick(id)}
          disabled={id > currentStage && layoutId === null}
          aria-current={id === currentStage ? 'step' : undefined}
        >
          <span className={styles.number}>{id}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
