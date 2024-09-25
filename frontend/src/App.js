import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Set the API URL, defaulting to localhost if REACT_APP_API_URL is not set
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  // State variables
  const [board, setBoard] = useState([]); // Stores the current board state
  const [isRunning, setIsRunning] = useState(false); // Controls whether the simulation is running
  const [rows, setRows] = useState(8); // Number of rows in the board, initially set to 8
  const [columns, setColumns] = useState(8); // Number of columns in the board, initially set to 8
  const [customizing, setCustomizing] = useState(false); // Indicates if the board is being customized
  const [error, setError] = useState(null); // Error state for board fetching
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the initial board when the component mounts
  useEffect(() => {
    fetchBoard();
  }, []);

  // Set up an interval to update the board when the simulation is running
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(updateBoard, 500); // Update every 500ms
    }
    return () => clearInterval(interval); // Clean up the interval on unmount or when isRunning changes
  }, [isRunning]);

  // Fetch the board from the server
  const fetchBoard = async () => {
    setIsLoading(true);
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

        setBoard(boardData.board);
        setRows(boardData.rows);
        setColumns(boardData.columns);
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
      const response = await axios.post(`${API_URL}/randomize`);
      const boardData = response.data;
      if (boardData && Array.isArray(boardData.board) && 
          boardData.board.length === boardData.rows && 
          boardData.board.every(row => Array.isArray(row) && row.length === boardData.columns)) {
        setBoard(boardData.board);
        setRows(boardData.rows);
        setColumns(boardData.columns);
        console.log("randomizeBoard successful")
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
  const toggleRunning = () => {
    if (customizing) {
      setCustomizing(false);
    }
    setIsRunning(!isRunning);
  };

  // Change the board size on the server
  const changeBoardSize = async () => {
    const response = await axios.post(`${API_URL}/change_size`, { rows, columns });
    setBoard(response.data.board);
  };

  // Toggle the state of a cell when customizing the board
  const toggleCell = (i, j) => {
    if (!customizing) return;
    const updatedBoard = board.map((row, rowIndex) =>
      row.map((cell, colIndex) =>
        rowIndex === i && colIndex === j ? 1 - cell : cell
      )
    );
    setBoard(updatedBoard);
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
    setCustomizing(false);
    try {
      const response = await axios.post(`${API_URL}/customize`, { board });
      if (Array.isArray(response.data.board)) {
        setBoard(response.data.board);
      } else {
        console.error('finishCustomizing:Invalid board data received:', response.data);
      }
    } catch (error) {
      console.error('finishCustomizing:Error customizing board:', error);
    }
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
        <div>
          <input 
            type="number" 
            value={rows} 
            onChange={(e) => setRows(parseInt(e.target.value))} 
            min="1"
          />
          <input 
            type="number" 
            value={columns} 
            onChange={(e) => setColumns(parseInt(e.target.value))} 
            min="1"
          />
          <button onClick={changeBoardSize}>Change Size</button>
        </div>
        {customizing ? (
          <button onClick={finishCustomizing}>Finish Customizing</button>
        ) : (
          <button onClick={customizeBoard}>Custom Board</button>
        )}
      </div>
    </div>
  );
}

export default App;