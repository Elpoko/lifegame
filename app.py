from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import random
import os

app = Flask(__name__, static_folder='frontend/build', static_url_path='')
CORS(app)

ROWS   = 8
COLUMNS = 8
P_LIVE = 0.5

class Board:
    def __init__(self, rows, columns):
        self.rows = rows
        self.columns = columns
        self.board_state = [[0 for _ in range(columns)] for _ in range(rows)]
        self.previous_state = None

    def zero(self):
        self.board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]

    def randomize(self):
        while True:
            self.board_state = [[1 if random.random() < P_LIVE else 0 for _ in range(self.columns)] for _ in range(self.rows)]
            if self.check_for_life():
                break

    def update(self):
        new_board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]
        for i in range(self.rows):
            for j in range(self.columns):
                live_neighbors = count_live_neighbors(self, i, j)
                new_board_state[i][j] = update_cell(self, live_neighbors, i, j)
        
        self.previous_state = self.board_state
        self.board_state = new_board_state
        
        return self.is_static()

    def is_static(self):
        return self.previous_state == self.board_state

    def check_for_life(self):
        for i in range(self.rows):
            for j in range(self.columns):
                if self.board_state[i][j] == 1:
                    return True
        return False

    def customise(self):
        new_board = request.json.get('board')
        if not new_board or len(new_board) != self.rows or any(len(row) != self.columns for row in new_board):
            return jsonify({"error": f"Invalid input. Please provide a {self.rows}x{self.columns} board."}), 400

        for i, row in enumerate(new_board):
            if not all(cell in [0, 1] for cell in row):
                return jsonify({"error": f"Invalid input in row {i+1}. Please use only 0 or 1."}), 400

        self.board_state = new_board
        return jsonify({"message": "Board customized successfully", "board": self.board_state})

    def change_size(self):
        data = request.json
        try:
            new_rows = int(data.get('rows', self.rows))
            new_columns = int(data.get('columns', self.columns))
        except ValueError:
            return jsonify({"error": "Invalid input. Rows and columns must be integers."}), 400
        
        self.rows = new_rows
        self.columns = new_columns 
        self.board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]
        return jsonify({
            "message": f"Board size changed to {self.rows} rows x {self.columns} columns.",
            "rows": self.rows,
            "columns": self.columns,
            "board": self.board_state
        })

    def save_board(self):
        board_data = {
            "rows": self.rows,
            "columns": self.columns,
            "board_state": self.board_state
        }
        return jsonify(board_data)

    def to_dict(self):
        return {
            "board": self.board_state,
            "rows": self.rows,
            "columns": self.columns
        }

def count_live_neighbors(board, row, col):
    live_neighbors = 0
    for i in range(row - 1, row + 2):
        for j in range(col - 1, col + 2):
            if i == row and j == col:
                continue
            if 0 <= i < board.rows and 0 <= j < board.columns:
                live_neighbors += board.board_state[i][j]
    return live_neighbors

def update_cell(board, live_neighbors, row, col):
    current_state = board.board_state[row][col]
    if current_state == 1 and (live_neighbors < 2 or live_neighbors > 3):
        return 0
    elif current_state == 0 and live_neighbors == 3:
        return 1
    else:
        return current_state

board = Board(ROWS, COLUMNS)

@app.route('/api/board', methods=['GET'])
def get_board():
    return jsonify(board.to_dict())

@app.route('/api/randomize', methods=['POST'])
def randomize_board():
    try:
        board.randomize()
        return jsonify(board.to_dict())
    except Exception as e:
        app.logger.error(f"Error in randomize_board: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/update', methods=['POST'])
def update_board():
    is_static = board.update()
    return jsonify({"board": board.board_state, "isStatic": is_static})

@app.route('/api/change_size', methods=['POST'])
def change_board_size():
    return board.change_size()

@app.route('/api/customize', methods=['POST'])
def customize_board():
    return board.customise()

@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    app.logger.info(f"Requested path: {path}")
    app.logger.info(f"Static folder: {app.static_folder}")
    app.logger.info(f"Does static folder exist? {os.path.exists(app.static_folder)}")
    
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        app.logger.info(f"Serving file: {path}")
        return send_from_directory(app.static_folder, path)
    else:
        index_path = os.path.join(app.static_folder, 'index.html')
        app.logger.info(f"Attempting to serve index.html from {index_path}")
        app.logger.info(f"Does index.html exist? {os.path.exists(index_path)}")
        
        if os.path.exists(index_path):
            app.logger.info("Serving index.html")
            return send_from_directory(app.static_folder, 'index.html')
        else:
            app.logger.error("index.html not found")
            return "index.html not found", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)