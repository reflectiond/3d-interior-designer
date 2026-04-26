import { useProjectStore } from './store/projectStore';
import { StageNavigator } from './stages/StageNavigator';
import { Stage1LayoutSelection } from './stages/Stage1LayoutSelection/Stage1LayoutSelection';
import { View2D } from './views/View2D/View2D';
import './App.css';

function App() {
  const { currentStage, layoutId } = useProjectStore();

  return (
    <div className="app">
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
        {currentStage === 2 && (
          <div className="app-placeholder">
            <View2D />
            <p>Этап 2 — Черновая отделка (в разработке)</p>
          </div>
        )}
        {currentStage === 3 && (
          <div className="app-placeholder">
            <p>Этап 3 — Чистовая отделка (в разработке)</p>
          </div>
        )}
        {currentStage === 4 && (
          <div className="app-placeholder">
            <p>Этап 4 — Итоги (в разработке)</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
