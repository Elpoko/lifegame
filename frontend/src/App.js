import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// Set the API URL based on the environment
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : `http://localhost:${process.env.PORT || 5000}/api`;

console.log('API_URL:', API_URL);  // Log the API_URL for debugging

function App() {
  // State variables
  const [board, setBoard] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [rows, setRows] = useState(8);
  const [columns, setColumns] = useState(8);
  const [customizing, setCustomizing] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sizeError, setSizeError] = useState(null);
  const [pLive, setPLive] = useState(0.5);
  const [refreshInterval, setRefreshInterval] = useState(200);

  const updateIntervalRef = useRef(null);

  // Memoize functions that are used in useEffect dependencies
  const fetchBoard = useCallback(async () => {
    setIsLoading(true);
    console.log('Fetching board from:', API_URL);
    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(`${API_URL}/board?t=${timestamp}`, { timeout: 10000 });
      console.log('fetchBoard: Fetched board data:', response.data);
      
      const boardData = response.data;
      
      if (boardData && Array.isArray(boardData.board) && boardData.rows && boardData.columns && typeof boardData.p_live === 'number') {
        console.log('fetchBoard: Setting board state:', boardData.board);
        setBoard(boardData.board);
        setRows(boardData.rows);
        setColumns(boardData.columns);
        setPLive(boardData.p_live);
        setError(null);
      } else {
        console.error('fetchBoard: Error: Invalid board data', boardData);
        setError('Invalid board data received. Please try again.');
      }
    } catch (error) {
      console.error('fetchBoard: Error fetching board:', error.message, error.stack);
      if (error.response) {
        console.error('Error response:', error.response.data, error.response.status);
      } else if (error.request) {
        console.error('Error request:', error.request);
      }
      setError('Failed to fetch the board. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch the initial board when the component mounts
  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Memoize the updateBoard function
  const updateBoard = useCallback(async () => {
    if (!isRunning) {
      console.log('updateBoard called but game is not running, skipping update');
      return;
    }
    try {
      console.log('updateBoard: Updating board');
      const response = await axios.post(`${API_URL}/update`, null, { timeout: 5000 });
      console.log('updateBoard: Update response:', response.data);
      if (response.data && Array.isArray(response.data.board)) {
        console.log('updateBoard: Setting new board state:', response.data.board);
        setBoard(response.data.board);
        if (response.data.isStatic) {
          console.log("Board has reached a static state, stopping game");
          setIsRunning(false);
        }
      } else {
        console.error('updateBoard: Invalid board data received:', response.data);
      }
    } catch (error) {
      console.error('updateBoard: Error updating board:', error);
      if (error.code === 'ECONNABORTED') {
        console.error('Request timed out');
      }
      setIsRunning(false);
    }
  }, [isRunning, API_URL]);

  // Modified useEffect for board updates
  useEffect(() => {
    let intervalId;
    if (isRunning) {
      console.log(`Setting up interval for ${refreshInterval}ms`);
      intervalId = setInterval(updateBoard, refreshInterval);
    } else {
      console.log('Clearing interval');
    }

    return () => {
      if (intervalId) {
        console.log('Cleaning up interval');
        clearInterval(intervalId);
      }
    };
  }, [isRunning, refreshInterval, updateBoard]);

  // Validate the board structure
  const isValidBoard = useCallback((board) => {
    if (!Array.isArray(board) || board.length !== rows) {
      return false;
    }
    for (let i = 0; i < rows; i++) {
      if (!Array.isArray(board[i]) || board[i].length !== columns) {
        return false;
      }
      for (let j = 0; j < columns; j++) {
        if (typeof board[i][j] !== 'number' || (board[i][j] !== 0 && board[i][j] !== 1)) {
          return false;
        }
      }
    }
    return true;
  }, [rows, columns]);

  // Request a new randomized board from the server
  const randomizeBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/randomize`, { p_live: pLive });
      const boardData = response.data;
      if (boardData && Array.isArray(boardData.board) && 
          boardData.board.length === boardData.rows && 
          boardData.board.every(row => Array.isArray(row) && row.length === boardData.columns)) {
        setBoard(boardData.board);
        setRows(boardData.rows);
        setColumns(boardData.columns);
        console.log("randomizeBoard successful")
        console.log(boardData)
      } else {
        console.error('randomizeBoard:Invalid board data received:', boardData);
      }
    } catch (error) {
      console.error('Error randomizing board:', error);
    }
  };

  // Modified toggleRunning function
  const toggleRunning = async () => {
    if (customizing) {
      await finishCustomizing();
    }
    setIsRunning(prevIsRunning => !prevIsRunning);
  };

  // Change the board size on the server
  const changeBoardSize = async () => {
    if (rows <= 0 || columns <= 0 || rows > 50 || columns > 50) {
      setSizeError('Invalid board size. Size must be between 1x1 and 50x50.');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/change_size`, { rows, columns });
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
        setRows(response.data.rows);
        setColumns(response.data.columns);
        setSizeError(null);
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Error changing board size:', error);
      if (error.response && error.response.status === 400) {
        setSizeError('Board size too large. Maximum size is 50x50.');
      } else {
        setSizeError('Failed to change board size. Please try again.');
      }
    }
  };

  // Toggle the state of a cell when customizing the board
  const toggleCell = useCallback((i, j) => {
    if (!customizing) return;
    setBoard(prevBoard => {
      const newBoard = prevBoard.map((row, rowIndex) =>
        row.map((cell, colIndex) =>
          rowIndex === i && colIndex === j ? (cell === 1 ? 0 : 1) : cell
        )
      );
      console.log('Cell toggled:', i, j, 'New board state:', newBoard);
      return newBoard;
    });
  }, [customizing]);

  // Enter customization mode
  const customizeBoard = () => {
    if (isRunning) {
      setIsRunning(false);
    }
    setCustomizing(true);
  };

  // Finish customizing and send the custom board to the server
  const finishCustomizing = async () => {
    try {
      console.log('Sending custom board to server:', board);
      const response = await axios.post(`${API_URL}/customize`, { board });
      console.log('Server response:', response.data);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
        console.log('Custom board set successfully:', response.data.board);
      } else {
        console.error('finishCustomizing: Invalid board data received:', response.data);
        setError('Failed to set custom board. Please try again.');
      }
    } catch (error) {
      console.error('finishCustomizing: Error customizing board:', error);
      setError('Failed to set custom board. Please try again.');
    } finally {
      setCustomizing(false);  // Always set customizing to false when finished
    }
  };

  // New useEffect hook to handle error fading
  useEffect(() => {
    let timer;
    if (sizeError) {
      timer = setTimeout(() => {
        setSizeError(null);
      }, 5000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [sizeError]);

  // New function to clear the board
  const clearBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/clear`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
        console.log('clearBoard: Board cleared successfully');
      } else {
        console.error('clearBoard: Invalid board data received:', response.data);
        setError('Failed to clear the board. Please try again.');
      }
    } catch (error) {
      console.error('clearBoard: Error clearing board:', error);
      setError('Failed to clear the board. Please try again.');
    }
  };

  // New function to fill the board
  const fillBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/fill`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
        console.log('fillBoard: Board filled successfully');
      } else {
        console.error('fillBoard: Invalid board data received:', response.data);
        setError('Failed to fill the board. Please try again.');
      }
    } catch (error) {
      console.error('fillBoard: Error filling board:', error);
      setError('Failed to fill the board. Please try again.');
    }
  };

  // New function to update P_LIVE
  const updatePLive = async (newValue) => {
    try {
      await axios.post(`${API_URL}/set_p_live`, { p_live: newValue });
      setPLive(newValue);
    } catch (error) {
      console.error('Error updating P_LIVE:', error);
      setError('Failed to update initial life probability. Please try again.');
    }
  };
  // New function to update refresh interval
  const updateRefreshInterval = (newValue) => {
    setRefreshInterval(newValue);
  };

  // Render the component
  return (
    <div className="App">
      <h1>Game of Life</h1>
      {/* Render the board */}
      <div className="board">
        {isLoading ? (
          <p>Loading board...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : board && Array.isArray(board) && board.length > 0 ? (
          board.map((row, i) => (
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
      {/* Control buttons and inputs */}
      <div className="controls">
        <button onClick={randomizeBoard}>Randomize</button>
        <button onClick={toggleRunning}>{isRunning ? 'Stop' : 'Start'}</button>
        <button onClick={clearBoard}>Clear</button>
        <button onClick={fillBoard}>Fill</button>
        <div>
          <input 
            type="number" 
            value={rows} 
            onChange={(e) => setRows(parseInt(e.target.value))} 
            min="1"
            max="50"
          />
          <input 
            type="number" 
            value={columns} 
            onChange={(e) => setColumns(parseInt(e.target.value))} 
            min="1"
            max="50"
          />
          <button onClick={changeBoardSize}>Change Size</button>
        </div>
        {customizing ? (
          <button onClick={finishCustomizing}>Finish Customizing</button>
        ) : (
          <button onClick={customizeBoard}>Custom Board</button>
        )}
        {/* New slider for P_LIVE */}
        <div className="p-live-control">
          <label htmlFor="p-live-slider">Initial Life Probability: {pLive.toFixed(2)}</label>
          <input
            id="p-live-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={pLive}
            onChange={(e) => updatePLive(parseFloat(e.target.value))}
          />
        </div>
        {/* New slider for refresh interval */}
        <div className="refresh-interval-control">
          <label htmlFor="refresh-interval-slider">
            Step duration: {refreshInterval}ms
          </label>
          <input
            id="refresh-interval-slider"
            type="range"
            min="50"
            max="1000"
            step="50"
            value={refreshInterval}
            onChange={(e) => updateRefreshInterval(parseInt(e.target.value))}
          />
        </div>
      </div>
      {/* Updated section for size-related errors with fade-out animation */}
      {sizeError && (
        <p className="size-error fade-out">{sizeError}</p>
      )}
    </div>
  );
}

export default App;