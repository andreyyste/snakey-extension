import { useState } from 'react';
import Game from './Game';

function App() {
  const [score, setScore] = useState(0);

  return (
    <>
      {/* Floating score display positioned at the top of the browser viewport */}
      <div
        id="score-display"
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999999] flex items-center gap-3 bg-white px-6 py-2 rounded-full shadow-md border border-gray-100 font-sans pointer-events-auto"
      >
        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
        <span className="text-2xl font-bold text-slate-800 tracking-tight">{score}</span>
      </div>

      {/* Immediately mount the Game component */}
      <Game onScoreUpdate={setScore} />
    </>
  );
}

export default App;
