// Tic Tac Toe
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from TicTacToe.c by Vikas Yadav

(function () {
    let DIM = 3;
    let board = [];      // 2D array: 0=empty, 'X', 'O'
    let currentPlayer;   // 'X' or 'O'
    let gameOver;
    let scores = { X: 0, O: 0, D: 0 };
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const dimSelect = document.getElementById('dim-select');
    const newGameBtn = document.getElementById('new-game');

    function init() {
        DIM = parseInt(dimSelect.value);
        board = Array.from({ length: DIM }, () => Array(DIM).fill(0));
        currentPlayer = 'X';
        gameOver = false;
        render();
        statusEl.textContent = "Your turn (X)";
    }

    function render() {
        boardEl.innerHTML = '';
        const cellSize = DIM >= 5 ? 64 : 80;
        const fontSize = DIM >= 5 ? '1.6rem' : '2.2rem';
        boardEl.style.gridTemplateColumns = `repeat(${DIM}, ${cellSize}px)`;
        for (let r = 0; r < DIM; r++) {
            for (let c = 0; c < DIM; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.width = cellSize + 'px';
                cell.style.height = cellSize + 'px';
                cell.style.fontSize = fontSize;
                if (board[r][c]) {
                    cell.textContent = board[r][c];
                    cell.classList.add('taken', board[r][c].toLowerCase());
                }
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.addEventListener('click', onCellClick);
                boardEl.appendChild(cell);
            }
        }
    }

    function onCellClick(e) {
        if (gameOver || currentPlayer !== 'X') return;
        const r = parseInt(e.target.dataset.r);
        const c = parseInt(e.target.dataset.c);
        if (board[r][c]) return;
        makeMove(r, c, 'X');
        if (!gameOver) {
            currentPlayer = 'O';
            statusEl.textContent = "Computer thinking...";
            setTimeout(computerMove, 300);
        }
    }

    function makeMove(r, c, mark) {
        board[r][c] = mark;
        render();
        const result = checkWin(r, c, mark);
        if (result) {
            highlightWin(result);
            const winner = mark;
            scores[winner]++;
            updateScores();
            statusEl.textContent = winner === 'X' ? "You win!" : "Computer wins!";
            gameOver = true;
            return;
        }
        if (isDraw()) {
            scores.D++;
            updateScores();
            statusEl.textContent = "It's a draw!";
            gameOver = true;
            return;
        }
    }

    function computerMove() {
        const move = getT3Move();
        if (move) {
            makeMove(move[0], move[1], 'O');
            if (!gameOver) {
                currentPlayer = 'X';
                statusEl.textContent = "Your turn (X)";
            }
        }
    }

    // --- Win detection ---
    function checkWin(r, c, mark) {
        // row
        let cells = [];
        for (let i = 0; i < DIM; i++) cells.push([r, i]);
        if (cells.every(([rr, cc]) => board[rr][cc] === mark)) return cells;

        // col
        cells = [];
        for (let i = 0; i < DIM; i++) cells.push([i, c]);
        if (cells.every(([rr, cc]) => board[rr][cc] === mark)) return cells;

        // main diag
        if (r === c) {
            cells = [];
            for (let i = 0; i < DIM; i++) cells.push([i, i]);
            if (cells.every(([rr, cc]) => board[rr][cc] === mark)) return cells;
        }

        // anti diag
        if (r + c === DIM - 1) {
            cells = [];
            for (let i = 0; i < DIM; i++) cells.push([i, DIM - 1 - i]);
            if (cells.every(([rr, cc]) => board[rr][cc] === mark)) return cells;
        }

        return null;
    }

    function isDraw() {
        // Board full = obvious draw
        let hasEmpty = false;
        for (let r = 0; r < DIM; r++)
            for (let c = 0; c < DIM; c++)
                if (!board[r][c]) { hasEmpty = true; break; }
        if (!hasEmpty) return true;

        // Early draw: check if ANY winning line is still possible for either player
        const lines = getAllLines();
        for (const line of lines) {
            let hasX = false, hasO = false;
            for (const [r, c] of line) {
                if (board[r][c] === 'X') hasX = true;
                if (board[r][c] === 'O') hasO = true;
            }
            // If a line has only X's (and empties), X can still win there
            // If a line has only O's (and empties), O can still win there
            if (!hasX || !hasO) return false; // at least one player can still complete this line
        }
        // Every line is blocked — guaranteed draw
        return true;
    }

    function getAllLines() {
        const lines = [];
        // Rows
        for (let r = 0; r < DIM; r++) {
            const line = [];
            for (let c = 0; c < DIM; c++) line.push([r, c]);
            lines.push(line);
        }
        // Columns
        for (let c = 0; c < DIM; c++) {
            const line = [];
            for (let r = 0; r < DIM; r++) line.push([r, c]);
            lines.push(line);
        }
        // Main diagonal
        const diag1 = [];
        for (let i = 0; i < DIM; i++) diag1.push([i, i]);
        lines.push(diag1);
        // Anti diagonal
        const diag2 = [];
        for (let i = 0; i < DIM; i++) diag2.push([i, DIM - 1 - i]);
        lines.push(diag2);
        return lines;
    }

    function highlightWin(cells) {
        const allCells = boardEl.querySelectorAll('.cell');
        cells.forEach(([r, c]) => {
            allCells[r * DIM + c].classList.add('win');
        });
    }

    // --- Newell-Simon AI (ported from C) ---
    function getT3Move() {
        let move;
        // 1. Win
        move = findWinMove('O');
        if (move) return move;
        // 2. Block
        move = findWinMove('X');
        if (move) return move;
        // 3. Fork
        move = findForkMove('O');
        if (move) return move;
        // 4. Block fork
        move = findForkMove('X');
        if (move) return move;
        // 5. Center
        move = findCenter();
        if (move) return move;
        // 6. Opposite corner
        move = findOppositeCorner();
        if (move) return move;
        // 7. Empty corner
        move = findEmptyCorner();
        if (move) return move;
        // 8. Empty side
        move = findEmptySide();
        if (move) return move;
        // 9. Any
        return findAny();
    }

    function findWinMove(mark) {
        for (let r = 0; r < DIM; r++) {
            for (let c = 0; c < DIM; c++) {
                if (!board[r][c]) {
                    board[r][c] = mark;
                    const win = checkWin(r, c, mark);
                    board[r][c] = 0;
                    if (win) return [r, c];
                }
            }
        }
        return null;
    }

    function findForkMove(mark) {
        for (let r = 0; r < DIM; r++) {
            for (let c = 0; c < DIM; c++) {
                if (!board[r][c]) {
                    board[r][c] = mark;
                    // Count how many winning moves exist after this placement
                    let winCount = 0;
                    for (let r2 = 0; r2 < DIM; r2++) {
                        for (let c2 = 0; c2 < DIM; c2++) {
                            if (!board[r2][c2]) {
                                board[r2][c2] = mark;
                                if (checkWin(r2, c2, mark)) winCount++;
                                board[r2][c2] = 0;
                            }
                        }
                    }
                    board[r][c] = 0;
                    if (winCount >= 2) return [r, c];
                }
            }
        }
        return null;
    }

    function findCenter() {
        const mid = Math.floor(DIM / 2);
        if (!board[mid][mid]) return [mid, mid];
        if (DIM % 2 === 0) {
            if (!board[mid - 1][mid]) return [mid - 1, mid];
            if (!board[mid][mid - 1]) return [mid, mid - 1];
            if (!board[mid - 1][mid - 1]) return [mid - 1, mid - 1];
        }
        return null;
    }

    function findOppositeCorner() {
        const corners = [[0, 0, DIM - 1, DIM - 1], [0, DIM - 1, DIM - 1, 0],
                         [DIM - 1, 0, 0, DIM - 1], [DIM - 1, DIM - 1, 0, 0]];
        for (const [r, c, or_, oc] of corners) {
            if (board[r][c] === 'X' && !board[or_][oc]) return [or_, oc];
        }
        return null;
    }

    function findEmptyCorner() {
        const corners = [[0, 0], [0, DIM - 1], [DIM - 1, 0], [DIM - 1, DIM - 1]];
        for (const [r, c] of corners) {
            if (!board[r][c]) return [r, c];
        }
        return null;
    }

    function findEmptySide() {
        for (let r = 0; r < DIM; r++) {
            for (let c = 0; c < DIM; c++) {
                if (!board[r][c] && (r === 0 || r === DIM - 1 || c === 0 || c === DIM - 1)
                    && !(r === 0 && c === 0) && !(r === 0 && c === DIM - 1)
                    && !(r === DIM - 1 && c === 0) && !(r === DIM - 1 && c === DIM - 1)) {
                    return [r, c];
                }
            }
        }
        return null;
    }

    function findAny() {
        for (let r = 0; r < DIM; r++)
            for (let c = 0; c < DIM; c++)
                if (!board[r][c]) return [r, c];
        return null;
    }

    function updateScores() {
        document.getElementById('score-x').textContent = scores.X;
        document.getElementById('score-o').textContent = scores.O;
        document.getElementById('score-d').textContent = scores.D;
    }

    newGameBtn.addEventListener('click', init);
    dimSelect.addEventListener('change', init);
    init();
})();
