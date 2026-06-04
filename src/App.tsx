import { useState, useEffect } from 'react';
import Game from './Game';

function ScoreDisplay() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      setScore((e as CustomEvent).detail);
    };
    window.addEventListener('snakey-score-update', handleUpdate);
    return () => {
      window.removeEventListener('snakey-score-update', handleUpdate);
    };
  }, []);

  return <span>{score}</span>;
}

function App() {
  return (
    <>
      {/* Floating score display positioned at the top of the browser viewport */}
      <div id="score-display">
        <div className="score-dot"></div>
        <ScoreDisplay />
      </div>

      {/* Immediately mount the Game component */}
      <Game />
    </>
  );
}

export default App;
