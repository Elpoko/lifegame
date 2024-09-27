import React from 'react';

function Controls({
  gameSettings,
  setGameSettings,
  boardState,
  setBoardState,
  randomizeBoard,
  toggleRunning,
  clearBoard,
  fillBoard,
  toggleCustomizing,
  changeBoardSize,
  updatePLive,
  isCustomizing
}) {
  const updateRefreshInterval = (newValue) => {
    setGameSettings(prev => ({ ...prev, refreshInterval: newValue }));
  };

  return (
    <div className="controls">
      <button onClick={randomizeBoard}>Randomize</button>
      <button onClick={toggleRunning}>{gameSettings.isRunning ? 'Stop' : 'Start'}</button>
      <button onClick={clearBoard}>Clear</button>
      <button onClick={fillBoard}>Fill</button>
      <button onClick={toggleCustomizing}>
        {isCustomizing ? 'Finish Customizing' : 'Customize'}
      </button>
      <div>
        <input 
          type="number" 
          value={boardState.rows} 
          onChange={(e) => setBoardState(prev => ({ ...prev, rows: parseInt(e.target.value) }))} 
          min="1"
          max="50"
        />
        <input 
          type="number" 
          value={boardState.columns} 
          onChange={(e) => setBoardState(prev => ({ ...prev, columns: parseInt(e.target.value) }))} 
          min="1"
          max="50"
        />
        <button onClick={changeBoardSize}>Change Size</button>
      </div>
      <div className="p-live-control">
        <label htmlFor="p-live-slider">Initial Life Probability: {gameSettings.pLive.toFixed(2)}</label>
        <input
          id="p-live-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={gameSettings.pLive}
          onChange={(e) => updatePLive(parseFloat(e.target.value))}
        />
      </div>
      <div className="refresh-interval-control">
        <label htmlFor="refresh-interval-slider">
          Step duration: {gameSettings.refreshInterval}ms
        </label>
        <input
          id="refresh-interval-slider"
          type="range"
          min="50"
          max="1000"
          step="50"
          value={gameSettings.refreshInterval}
          onChange={(e) => updateRefreshInterval(parseInt(e.target.value))}
        />
      </div>
    </div>
  );
}

export default Controls;