import React from 'react';

function Board({ boardState, status, isCustomizing, gameSettings, toggleCell }) {
  if (status.isLoading) {
    return <p>Loading board...</p>;
  }

  if (status.error) {
    return <p className="error">{status.error}</p>;
  }

  if (!boardState.board || !Array.isArray(boardState.board) || boardState.board.length === 0) {
    return <p>No board data available, board is not an array, or board has length 0.</p>;
  }

  return (
    <div className="board">
      {boardState.board.map((row, i) => (
        <div key={i} className="row">
          {Array.isArray(row) && row.map((cell, j) => (
            <div 
              key={j} 
              className={`cell ${cell ? 'alive' : 'dead'}`}
              onClick={() => toggleCell(i, j)}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;