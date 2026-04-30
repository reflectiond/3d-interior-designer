import { useEffect, useRef } from 'react';
import { useProjectStore } from './store/projectStore';
import { StageNavigator } from './stages/StageNavigator';
import { Stage1LayoutSelection } from './stages/Stage1LayoutSelection/Stage1LayoutSelection';
import { Stage2RoughFinish } from './stages/Stage2RoughFinish/Stage2RoughFinish';
import { Stage3FineFinish } from './stages/Stage3FineFinish/Stage3FineFinish';
import { Stage4Summary } from './stages/Stage4Summary/Stage4Summary';
import { View2D } from './views/View2D/View2D';
import { saveToLocalStorage, restoreFromLocalStorage } from './persistence/localStorage';
import './App.css';

function App() {
  const state = useProjectStore();
  const { currentStage, layoutId } = state;
  const restored = useRef(false);

  // Restore from localStorage on first mount
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      restoreFromLocalStorage();
    }
  }, []);

  // Autosave to localStorage (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage(state);
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // Stage 1 показывает выбор планировки + полноразмерный 2D-просмотр
  // под ним (вертикальный page-scroll допустим). Stage 2-4 имеют
  // длинную боковую панель и канву — нужен viewport-fixed layout
  // (см. App.css → .app--fixed).
  const fixedViewport = currentStage > 1;

  return (
    <div className={`app${fixedViewport ? ' app--fixed' : ''}`}>
      <header className="app-header">
        <h1>3D Interior Designer</h1>
      </header>
      <StageNavigator />
      <main className="app-main">
        {currentStage === 1 && (
          <>
            <Stage1LayoutSelection />
            {layoutId !== null && <View2D />}
          </>
        )}
        {currentStage === 2 && <Stage2RoughFinish />}
        {currentStage === 3 && <Stage3FineFinish />}
        {currentStage === 4 && <Stage4Summary />}
      </main>
    </div>
  );
}

export default App;
