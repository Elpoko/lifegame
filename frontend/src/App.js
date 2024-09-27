import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import Board from './components/Board';
import Controls from './components/Controls';
import useGameLogic from './hooks/useGameLogic';
import { API_URL } from './config';

function App() {
  const [boardState, setBoardState] = useState({ board: [], rows: 8, columns: 8 });
  const [status, setStatus] = useState({ isLoading: true, error: null });
  const [gameSettings, setGameSettings] = useState({ isRunning: false, pLive: 0.5, refreshInterval: 200 });
  const [isCustomizing, setIsCustomizing] = useState(false);

  const { 
    fetchBoard, 
    updateBoard, 
    randomizeBoard, 
    changeBoardSize, 
    updatePLive, 
    fillBoard, 
    clearBoard 
  } = useGameLogic(API_URL, boardState, setBoardState, setStatus, setGameSettings);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const toggleCell = useCallback((i, j) => {
    if (gameSettings.isRunning) return;
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

  const toggleCustomizing = useCallback(async () => {
    if (isCustomizing) {
      try {
        const response = await axios.post(`${API_URL}/customize`, { board: boardState.board });
        if (response.data && Array.isArray(response.data.board)) {
          setBoardState(prev => ({ ...prev, board: response.data.board }));
          setStatus(prev => ({ ...prev, error: null }));
        } else {
          throw new Error('Invalid board data received');
        }
      } catch (error) {
        console.error('toggleCustomizing: Error:', error);
        setStatus(prev => ({ ...prev, error: 'Failed to update custom board. Please try again.' }));
        return;
      }
    } else {
      if (gameSettings.isRunning) {
        setGameSettings(prev => ({ ...prev, isRunning: false }));
      }
    }
    setIsCustomizing(prev => !prev);
  }, [isCustomizing, boardState.board, gameSettings.isRunning, API_URL]);

  const toggleRunning = useCallback(async () => {
    if (isCustomizing) {
      await toggleCustomizing();
    }
    setGameSettings(prev => ({ ...prev, isRunning: !prev.isRunning }));
  }, [isCustomizing, toggleCustomizing]);

  useEffect(() => {
    let intervalId;
    if (gameSettings.isRunning) {
      const runUpdate = async () => {
        await updateBoard();
        intervalId = setTimeout(runUpdate, gameSettings.refreshInterval);
      };
      runUpdate();
    }
    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [gameSettings.isRunning, gameSettings.refreshInterval, updateBoard]);

  return (
    <div className="App">
      <h1>Game of Life</h1>
      <Board
        boardState={boardState}
        status={status}
        isCustomizing={isCustomizing}
        gameSettings={gameSettings}
        toggleCell={toggleCell}
      />
      <Controls
        gameSettings={gameSettings}
        setGameSettings={setGameSettings}
        boardState={boardState}
        setBoardState={setBoardState}
        randomizeBoard={randomizeBoard}
        toggleRunning={toggleRunning}
        clearBoard={clearBoard}
        fillBoard={fillBoard}
        toggleCustomizing={toggleCustomizing}
        changeBoardSize={changeBoardSize}
        updatePLive={updatePLive}
        isCustomizing={isCustomizing}
      />
      {status.error && (
        <p className="size-error fade-out">{status.error}</p>
      )}
      <div className="todos-section">
        <h2>Todos</h2>
        <ul style={{ textAlign: 'left', listStyleType: 'disc', paddingLeft: '20px' }}>
            <li>Add some presets</li>
            <li>Make board infinite</li>
            <li>Add board wrap option?</li>
            <li>Make multiplayer possible</li>
            <li>Allow drag to select on board</li>
        </ul>
      </div>
      <div className="footer">
        <p><a href="https://tommccarthy.net">Back to homepage</a></p>
      </div>
    </div>
  );
}

export default App;