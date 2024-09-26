import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Set the API URL based on the environment
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : `http://localhost:${process.env.PORT || 5000}/api`;

console.log('API_URL:', API_URL);  // Log the API_URL for debugging

function App() {
  // State variables
  const [board, setBoard] = useState([]); // Stores the current board state
  const [isRunning, setIsRunning] = useState(false); // Controls whether the simulation is running
  const [rows, setRows] = useState(8); // Number of rows in the board, initially set to 8
  const [columns, setColumns] = useState(8); // Number of columns in the board, initially set to 8
  const [customizing, setCustomizing] = useState(false); // Indicates if the board is being customized
  const [error, setError] = useState(null); // Error state for board fetching
  const [isLoading, setIsLoading] = useState(true);
  const [sizeError, setSizeError] = useState(null); // New state for size-related errors
  const [pLive, setPLive] = useState(0.5); // New state for P_LIVE
  const [refreshInterval, setRefreshInterval] = useState(200); // Default to 200ms

  // Fetch the initial board when the component mounts
  useEffect(() => {
    fetchBoard();
  }, []);

  // Set up an interval to update the board when the simulation is running
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(updateBoard, refreshInterval);
    }
    return () => clearInterval(interval);
  }, [isRunning, refreshInterval]); // Add refreshInterval as a dependency

  // Fetch the board from the server
  const fetchBoard = async () => {
    setIsLoading(true);
    console.log(API_URL);
    try {
      const response = await axios.get(`${API_URL}/board`);
      console.log('fetchBoard Raw response:', response);
      console.log('fetchBoard Response data:', response.data);
      
      const boardData = response.data;
      console.log('fetchBoard Board data:', boardData);
      
      if (boardData && Array.isArray(boardData.board)) {
        console.log('Board array:', boardData.board);
        console.log('fetchBoard Rows:', boardData.rows);
        console.log('fetchBoard Columns:', boardData.columns);
        console.log('fetchBoard P_LIVE:', boardData.p_live);

        setBoard(boardData.board);
        setRows(boardData.rows);
        setColumns(boardData.columns);
        setPLive(boardData.p_live);  // Set the initial p_live value from the server
        setError(null); // Clear any previous errors
      } else {
        console.error('Error: Invalid board data');
        console.log('Invalid board data:', boardData);
      }
    } catch (error) {
      console.error('Error fetching board:', error);
      setError('Failed to fetch the board. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Validate the board structure
  const isValidBoard = (board) => {
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
  };

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

  // Update the board state by requesting the next generation from the server
  const updateBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/update`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
        
        if (response.data.isStatic) {
          setIsRunning(false);
          console.log("Board has reached a static state");
        }
      } else {
        console.error('updateBoard:Invalid board data received:', response.data);
      }
    } catch (error) {
      console.error('updateBoard:Error updating board:', error);
      setIsRunning(false);  // Stop the simulation if there's an error
    }
  };

  // Toggle the simulation running state
  const toggleRunning = async () => {
    if (customizing) {
      // If we're customizing, save the board before starting
      await finishCustomizing();
    }
    setIsRunning(!isRunning);
    setCustomizing(false);
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
  const toggleCell = (i, j) => {
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
  };

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
    return () => clearTimeout(timer);
  }, [sizeError]);

  // New function to clear the board
  const clearBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/clear`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
      } else {
        console.error('clearBoard: Invalid board data received:', response.data);
      }
    } catch (error) {
      console.error('Error clearing board:', error);
    }
  };

  // New function to fill the board
  const fillBoard = async () => {
    try {
      const response = await axios.post(`${API_URL}/fill`);
      if (response.data && Array.isArray(response.data.board)) {
        setBoard(response.data.board);
      } else {
        console.error('fillBoard: Invalid board data received:', response.data);
      }
    } catch (error) {
      console.error('Error filling board:', error);
    }
  };

  // New function to update P_LIVE
  const updatePLive = async (newValue) => {
    setPLive(newValue);
    try {
      await axios.post(`${API_URL}/set_p_live`, { p_live: newValue });
    } catch (error) {
      console.error('Error updating P_LIVE:', error);
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
          <button onClick={() => setCustomizing(false)}>Finish Customizing</button>
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