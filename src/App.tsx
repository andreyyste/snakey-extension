import { useState } from 'react';
import Game from './Game';

function App() {
  const [score, setScore] = useState(0);

  return (
    <>
      {/* Floating score display positioned at the top of the browser viewport */}
      <div id="score-display">
        <div className="score-dot"></div>
        <span>{score}</span>
      </div>

      {/* Immediately mount the Game component */}
      <Game onScoreUpdate={setScore} />
    </>
  );
}

export default App;
