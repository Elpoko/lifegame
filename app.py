from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import random
import os
import logging
import threading

# Add this at the top of the file, after the imports
global UPDATE_COUNTER
UPDATE_COUNTER = 0

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='frontend/build', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

ROWS   = 8
COLUMNS = 8
P_LIVE = 0.5  # This is now the initial value
MAX_ROWS = 50
MAX_COLUMNS = 50

lock = threading.Lock()

class Board:
    def __init__(self, rows, columns):
        self.rows = min(rows, MAX_ROWS)
        self.columns = min(columns, MAX_COLUMNS)
        self.board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]
        self.previous_state = None
        self.p_live = P_LIVE  # Use the initial value

    def zero(self):
        self.board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]

    def randomize(self):
        with lock:
            logger.info(f"randomize: Randomizing board with P_LIVE: {self.p_live}")
            while True:
                self.board_state = [[1 if random.random() < self.p_live else 0 for _ in range(self.columns)] for _ in range(self.rows)]
                if self.check_for_life():
                    break
            logger.info(f"randomize: Board randomized. New state: {self.board_state}")

    def update(self):
        global UPDATE_COUNTER
        with lock:
            logger.info(f"update: Starting board update, id {UPDATE_COUNTER}. Current state: {self.board_state}")
            new_board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]
            for i in range(self.rows):
                for j in range(self.columns):
                    live_neighbors = count_live_neighbors(self, i, j)
                    new_board_state[i][j] = update_cell(self, live_neighbors, i, j)
            
            is_static = self.board_state == new_board_state
            self.previous_state = self.board_state
            self.board_state = new_board_state
            
            logger.info(f"update: Finished board update, id {UPDATE_COUNTER}. New state: {self.board_state}. Is static: {is_static}")
            UPDATE_COUNTER += 1
            return is_static

    def is_static(self):
        return self.previous_state == self.board_state

    def check_for_life(self):
        for i in range(self.rows):
            for j in range(self.columns):
                if self.board_state[i][j] == 1:
                    return True
        return False

    def customise(self):
        with lock:
            new_board = request.json.get('board')
            logger.info(f"customize: Customizing board. Received board: {new_board}")
            print("Received board:", new_board)  # Add this line for debugging
            if not new_board or len(new_board) != self.rows or any(len(row) != self.columns for row in new_board):
                print(f"Invalid input. Expected {self.rows}x{self.columns} board, got: {new_board}")  # Add this line
                return jsonify({"error": f"Invalid input. Please provide a {self.rows}x{self.columns} board."}), 400

            for i, row in enumerate(new_board):
                if not all(cell in [0, 1] for cell in row):
                    print(f"Invalid input in row {i+1}. Row contains values other than 0 or 1: {row}")  # Add this line
                    return jsonify({"error": f"Invalid input in row {i+1}. Please use only 0 or 1."}), 400

            self.board_state = new_board
            logger.info(f"customize: Board customized. New state: {self.board_state}")
            print("Board state updated:", self.board_state)  # Add this line
            return jsonify({"message": "Board customized successfully", "board": self.board_state})

    def change_size(self):
        with lock:
            data = request.json
            try:
                new_rows = int(data.get('rows', self.rows))
                new_columns = int(data.get('columns', self.columns))
            except ValueError:
                return jsonify({"error": "Invalid input. Rows and columns must be integers."}), 400
            
            if new_rows > MAX_ROWS or new_columns > MAX_COLUMNS:
                return jsonify({"error": f"Board size cannot exceed {MAX_ROWS}x{MAX_COLUMNS}."}), 400
            
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
            "columns": self.columns,
            "p_live": self.p_live  # Include p_live in the response
        }

    def clear(self):
        with lock:
            self.board_state = [[0 for _ in range(self.columns)] for _ in range(self.rows)]

    def fill(self):
        with lock:
            self.board_state = [[1 for _ in range(self.columns)] for _ in range(self.rows)]

    def set_p_live(self, p_live):
        self.p_live = max(0, min(1, p_live))  # Ensure p_live is between 0 and 1

    def set_board_state(self, new_state):
        with lock:
            logger.info(f"set_board_state: Changing board state from {self.board_state} to {new_state}")
            self.board_state = new_state

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
    with lock:
        logger.info(f"get_board: Sending current board state: {board.to_dict()}")
        return jsonify(board.to_dict())

@app.route('/api/randomize', methods=['POST'])
def randomize_board():
    try:
        p_live = request.json.get('p_live', board.p_live)
        board.set_p_live(p_live)
        board.randomize()
        return jsonify(board.to_dict())
    except Exception as e:
        app.logger.error(f"Error in randomize_board: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/update', methods=['POST'])
def update_board():
    logger.info("API - update_board: Received update request")
    is_static = board.update()
    return jsonify({"board": board.board_state, "isStatic": is_static})

@app.route('/api/change_size', methods=['POST'])
def change_board_size():
    return board.change_size()

@app.route('/api/customize', methods=['POST'])
def customize_board():
    return board.customise()

@app.route('/api/clear', methods=['POST'])
def clear_board():
    board.clear()
    return jsonify(board.to_dict())

@app.route('/api/fill', methods=['POST'])
def fill_board():
    board.fill()
    return jsonify(board.to_dict())

@app.route('/api/set_p_live', methods=['POST'])
def set_p_live():
    try:
        p_live = request.json.get('p_live')
        if p_live is not None:
            board.set_p_live(float(p_live))
            return jsonify({"message": "P_LIVE updated successfully", "p_live": board.p_live})
        else:
            return jsonify({"error": "Missing p_live parameter"}), 400
    except ValueError:
        return jsonify({"error": "Invalid p_live value"}), 400

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
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/start', methods=['POST'])
def start_game():
    global board
    with lock:
        print("Initial board state:", board)  # Log the initial state
        # ... rest of the function

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port)