import styles from './SidePanel.module.css';

export function PlasterPanel() {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Штукатурка стен</h3>
      <div className={styles.infoBox}>
        <p>Штукатурка стен — выполняется автоматически для всех внутренних стен.</p>
        <p className={styles.infoNote}>Учитывается в смете (площадь всех стен × цена за м²).</p>
      </div>
    </div>
  );
}
