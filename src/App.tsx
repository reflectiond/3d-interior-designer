import { useProjectStore } from './store/projectStore';
import { StageNavigator } from './stages/StageNavigator';
import { Stage1LayoutSelection } from './stages/Stage1LayoutSelection/Stage1LayoutSelection';
import { Stage2RoughFinish } from './stages/Stage2RoughFinish/Stage2RoughFinish';
import { Stage3FineFinish } from './stages/Stage3FineFinish/Stage3FineFinish';
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
        {currentStage === 2 && <Stage2RoughFinish />}
        {currentStage === 3 && <Stage3FineFinish />}
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
