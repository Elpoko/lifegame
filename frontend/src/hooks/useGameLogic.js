import { useCallback } from 'react';
import axios from 'axios';

const useGameLogic = (API_URL, boardState, setBoardState, setStatus, setGameSettings) => {
  const fetchBoard = useCallback(async () => {
    setStatus({ isLoading: true, error: null });
    try {
      // First, initialize the board
      const initResponse = await axios.get(`${API_URL}/board`);
      const { board, rows, columns, p_live } = initResponse.data;
      if (board && Array.isArray(board) && rows && columns && typeof p_live === 'number') {
        setBoardState({ board, rows, columns });
        setGameSettings(prev => ({ ...prev, pLive: p_live }));
      } else {
        throw new Error('Invalid board data received during initialization');
      }

      // Then, clear the board
      const clearResponse = await axios.post(`${API_URL}/clear`);
      const clearedBoard = clearResponse.data.board;
      if (Array.isArray(clearedBoard)) {
        setBoardState(prev => ({ ...prev, board: clearedBoard }));
      } else {
        throw new Error('Invalid board data received during clearing');
      }
    } catch (error) {
      console.error('fetchBoard: Error:', error);
      setStatus({ isLoading: false, error: 'Failed to initialize or clear the board. Please try again.' });
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, [API_URL, setBoardState, setGameSettings, setStatus]);

  const updateBoard = useCallback(async () => {
    try {
      const response = await axios.post(`${API_URL}/update`);
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
  }, [API_URL, setBoardState, setGameSettings]);

  const randomizeBoard = useCallback(async () => {
    try {
      const response = await axios.post(`${API_URL}/randomize`, {}, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Randomize response:', response.data);
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ ...prev, board: response.data.board }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('randomizeBoard: Error:', error.response ? error.response.data : error.message);
      setStatus(prev => ({ ...prev, error: 'Failed to randomize the board. Please try again.' }));
    }
  }, [API_URL, setBoardState, setStatus]);

  const changeBoardSize = useCallback(async () => {
    try {
      const response = await axios.post(`${API_URL}/change_size`, { 
        rows: boardState.rows, 
        columns: boardState.columns 
      });
      if (response.data && Array.isArray(response.data.board)) {
        setBoardState(prev => ({ 
          ...prev, 
          board: response.data.board,
          rows: response.data.rows,
          columns: response.data.columns
        }));
      } else {
        throw new Error('Invalid board data received');
      }
    } catch (error) {
      console.error('changeBoardSize: Error:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to change board size. Please try again.' }));
    }
  }, [API_URL, boardState.rows, boardState.columns, setBoardState, setStatus]);

  const updatePLive = useCallback(async (newPLive) => {
    try {
      await axios.post(`${API_URL}/update_p_live`, { p_live: newPLive });
      setGameSettings(prev => ({ ...prev, pLive: newPLive }));
    } catch (error) {
      console.error('updatePLive: Error:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to update initial life probability. Please try again.' }));
    }
  }, [API_URL, setGameSettings, setStatus]);

  const fillBoard = useCallback(async () => {
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
  }, [API_URL, setBoardState, setStatus]);

  const clearBoard = useCallback(async () => {
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
  }, [API_URL, setBoardState, setStatus]);

  return {
    fetchBoard,
    updateBoard,
    randomizeBoard,
    changeBoardSize,
    updatePLive,
    fillBoard,
    clearBoard
  };
};

export default useGameLogic;