import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : `http://localhost:${process.env.PORT || 5000}/api`;

console.log('API_URL:', API_URL);

function App() {
  const [boardState, setBoardState] = useState({ board: [], rows: 8, columns: 8 });
  const [status, setStatus] = useState({ isLoading: true, error: null });
  const [gameSettings, setGameSettings] = useState({ isRunning: false, pLive: 0.5, refreshInterval: 200 });
  const [isCustomizing, setIsCustomizing] = useState(false);

  const fetchBoard = useCallback(async () => {
    setStatus({ isLoading: true, error: null });
    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(`${API_URL}/board?t=${timestamp}`, { timeout: 10000 });
      const { board, rows, columns, p_live } = response.data;
      
      if (board && Array.isArray(board) && rows && columns && typeof p_live === 'number') {
        setBoardState({ board, rows, columns });
        setGameSettings(prev => ({ ...prev, pLive: p_live }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('fetchBoard: Error:', error);
      setStatus({ isLoading: false, error: 'Failed to fetch the board. Please try again.' });
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchBoard().then(() => {
      if (!isMounted) {
        console.log('Component unmounted, not updating state');
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchBoard]);

  const updateBoard = useCallback(async () => {
    if (!gameSettings.isRunning) return;
    
    try {
      const response = await axios.post(`${API_URL}/update`, null, { timeout: 5000 });
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ ...prev, board: response.data.board }));
        if (response.data.isStatic) {
          setGameSettings(prev => ({ ...prev, isRunning: false }));
        }
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('updateBoard: Error:', error);
      setGameSettings(prev => ({ ...prev, isRunning: false }));
    }
  }, [gameSettings.isRunning]);

  useEffect(() => {
    let intervalId;
    if (gameSettings.isRunning) {
      console.log(`Setting up interval for ${gameSettings.refreshInterval}ms`);
      intervalId = setInterval(updateBoard, gameSettings.refreshInterval);
    }
    return () => {
      if (intervalId) {
        console.log('Cleaning up board update interval');
        clearInterval(intervalId);
      }
    };
  }, [gameSettings.isRunning, gameSettings.refreshInterval, updateBoard]);

  useEffect(() => {
    let fadeOutTimer;
    if (status.error) {
      fadeOutTimer = setTimeout(() => {
        setStatus(prev => ({ ...prev, error: null }));
      }, 5000);
    }
    return () => {
      if (fadeOutTimer) {
        console.log('Cleaning up error fade out timer');
        clearTimeout(fadeOutTimer);
      }
    };
  }, [status.error]);

  useEffect(() => {
    let debounceTimer;
    const debouncedChangeBoardSize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        changeBoardSize();
      }, 500);
    };

    debouncedChangeBoardSize();

    return () => {
      if (debounceTimer) {
        console.log('Cleaning up board size change debounce timer');
        clearTimeout(debounceTimer);
      }
    };
  }, [boardState.rows, boardState.columns]);

  const toggleCell = useCallback((i, j) => {
    if (gameSettings.isRunning) return; // Prevent toggling while the game is running
    setBoardState(prev => ({
      ...prev,
      board: prev.board.map((row, rowIndex) =>
        rowIndex === i
          ? row.map((cell, colIndex) =>
              colIndex === j ? 1 - cell : cell
            )
          : row
      )
    }));
    setIsCustomizing(true);
  }, [gameSettings.isRunning]);

  const startCustomizing = () => {
    if (gameSettings.isRunning) {
      setGameSettings(prev => ({ ...prev, isRunning: false }));
    }
    setIsCustomizing(true);
  };

  const finishCustomizing = async () => {
    if (!isCustomizing) return;
    
    try {
      const response = await axios.post(`${API_URL}/customize`, { board: boardState.board });
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ ...prev, board: response.data.board }));
        setIsCustomizing(false);
        setStatus(prev => ({ ...prev, error: null }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('finishCustomizing: Error:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to update custom board. Please try again.' }));
    }
  };

  const toggleRunning = async () => {
    if (isCustomizing) {
      await finishCustomizing();
    }
    setGameSettings(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const randomizeBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/randomize`, { p_live: gameSettings.pLive });
      const { board, rows, columns } = response.data;
      setBoardState({ board, rows, columns });
    } catch (error) {
      console.error('Error randomizing board:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to randomize the board. Please try again.' }));
    }
  };

  const changeBoardSize = async () => {
    const { rows, columns } = boardState;
    if (rows <= 0 || columns <= 0 || rows > 50 || columns > 50) {
      setStatus(prev => ({ ...prev, error: 'Invalid board size. Size must be between 1x1 and 50x50.' }));
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/change_size`, { rows, columns });
      const { board, rows: newRows, columns: newColumns } = response.data;
      setBoardState({ board, rows: newRows, columns: newColumns });
      setStatus(prev => ({ ...prev, error: null }));
    } catch (error) {
      console.error('Error changing board size:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to change board size. Please try again.' }));
    }
  };

  const updatePLive = async (newValue) => {
    try {
      await axios.post(`${API_URL}/set_p_live`, { p_live: newValue });
      setGameSettings(prev => ({ ...prev, pLive: newValue }));
    } catch (error) {
      console.error('Error updating P_LIVE:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to update initial life probability. Please try again.' }));
    }
  };

  const updateRefreshInterval = (newValue) => {
    setGameSettings(prev => ({ ...prev, refreshInterval: newValue }));
  };

  const clearBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/clear`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ ...prev, board: response.data.board }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('clearBoard: Error:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to clear the board. Please try again.' }));
    }
  };

  const fillBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/fill`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ ...prev, board: response.data.board }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('fillBoard: Error:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to fill the board. Please try again.' }));
    }
  };

  return (
    <div className="App">
      <h1>Game of Life</h1>
      <div className="board">
        {status.isLoading ? (
          <p>Loading board...</p>
        ) : status.error ? (
          <p className="error">{status.error}</p>
        ) : boardState.board && Array.isArray(boardState.board) && boardState.board.length > 0 ? (
          boardState.board.map((row, i) => (
            <div key={i} className="row">
              {Array.isArray(row) && row.map((cell, j) => (
                <div 
                  key={j} 
                  className={`cell ${cell ? 'alive' : 'dead'}`}
                  onClick={() => toggleCell(i, j)}
                ></div>
              ))}
            </div>
          ))
        ) : (
          <p>No board data available.</p>
        )}
      </div>
      <div className="controls">
        <button onClick={randomizeBoard}>Randomize</button>
        <button onClick={toggleRunning}>{gameSettings.isRunning ? 'Stop' : 'Start'}</button>
        <button onClick={clearBoard}>Clear</button>
        <button onClick={fillBoard}>Fill</button>
        {isCustomizing ? (
          <button onClick={finishCustomizing}>Finish Customizing</button>
        ) : (
          <button onClick={startCustomizing}>Customize</button>
        )}
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
      {status.error && (
        <p className="size-error fade-out">{status.error}</p>
      )}
    </div>
  );
}

export default App;