// Tic Tac Toe
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from TicTacToe.c by Vikas Yadav

(function () {
    const pName = typeof getActivePlayer === 'function' ? getActivePlayer() : 'You';
    let DIM = 3;
    let board = [];      // 2D array: 0=empty, 'X', 'O'
    let currentPlayer;   // 'X' or 'O'
    let gameOver;
    let scores = (function () {
        if (typeof gameGet === 'function') {
            try { var s = gameGet('ttt_scores'); if (s) return JSON.parse(s); } catch(e) {}
        }
        return { X: 0, O: 0, D: 0 };
    })();
    let gameCounter = 0;
    let boardHistory = [];
    let moveHistory = [];
    let firstPlayer = 'X';
    let timerMode = 'unlimited';
    let timerValues = { X: 0, O: 0 };
    let timerInterval = null;
    let currentTimerPlayer = null;
    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const dimSelect = document.getElementById('dim-select');
    const newGameBtn = document.getElementById('new-game');
    const boardHistoryEl = document.getElementById('board-history');
    const gameRulesInlineEl = document.getElementById('game-rules-inline');
    const historyPanelTitleEl = document.getElementById('history-panel-title');
    const rulesBtn = document.getElementById('rules-btn');
    const rulesModal = document.getElementById('rules-modal');
    const rulesClose = document.getElementById('rules-close');
    const learningModeBtn = document.getElementById('learning-mode-btn');
    const playAsComputerBtn = document.getElementById('play-as-computer-btn');
    const computerBtn = document.getElementById('computer-btn');
    const computerModal = document.getElementById('computer-modal');
    const computerClose = document.getElementById('computer-close');
    const modalLearningBtn = document.getElementById('modal-learning-btn');
    const modalPlayAsBtn = document.getElementById('modal-play-as-btn');
    const minimaxControls = document.getElementById('minimax-controls');
    const minimaxControlsNote = document.getElementById('minimax-controls-note');
    const learningPanel = document.getElementById('learning-panel');
    const learningIntroContent = document.getElementById('learning-intro-content');
    let hasStartedGame = false;
    let firstInit = true;
    const timerModeSelect = document.getElementById('timer-mode');
    const learningToggle = document.getElementById('learning-mode');
    const learningLog = document.getElementById('learning-log');
    const learningNote = document.getElementById('learning-note');
    const learningTree = document.getElementById('learning-tree');
    const moveListLeft = document.getElementById('move-list-left');
    const moveListRight = document.getElementById('move-list-right');
    const timerXEl = document.getElementById('timer-x')?.querySelector('.timer-text');
    const timerOEl = document.getElementById('timer-o')?.querySelector('.timer-text');
    const aiSelect = document.getElementById('ai-select');
    const tossBtn = document.getElementById('toss-btn');
    const tossResultEl = document.getElementById('toss-result');
    const playAsComputerToggle = document.getElementById('play-as-computer');
    const coachFeedbackEl = document.getElementById('coach-feedback');
    let learningMode = false;
    let playAsComputer = false;
    let aiAlgorithm = 'newell-simon'; // 'newell-simon' or 'minimax'
    let waitingForKidO = false;  // true when kid needs to pick O's move
    let coachStreak = 0;         // how many correct picks in a row

    function updateInfoPanel() {
        if (!historyPanelTitleEl || !boardHistoryEl || !gameRulesInlineEl) return;
        if (!hasStartedGame) {
            historyPanelTitleEl.textContent = 'Game Rules';
            gameRulesInlineEl.style.display = 'block';
            boardHistoryEl.style.display = 'none';
        } else {
            historyPanelTitleEl.textContent = 'Board History';
            gameRulesInlineEl.style.display = 'none';
            boardHistoryEl.style.display = '';
        }
    }

    function updateLearningPanelVisibility() {
        if (!learningPanel) return;
        const showPanel = !hasStartedGame || learningMode || playAsComputer;
        learningPanel.style.display = showPanel ? '' : 'none';
        // Show intro text only on landing page, hide once game started
        if (learningIntroContent) {
            learningIntroContent.style.display = hasStartedGame ? 'none' : '';
        }
    }

    function init() {
        if (firstInit) {
            firstInit = false;
        } else {
            hasStartedGame = true;
        }
        DIM = parseInt(dimSelect.value);
        if (aiSelect) aiAlgorithm = aiSelect.value;
        board = Array.from({ length: DIM }, () => Array(DIM).fill(0));
        currentPlayer = firstPlayer;
        gameOver = false;
        moveHistory = [];
        waitingForKidO = false;
        coachStreak = 0;
        hideCoachFeedback();
        render();
        renderMoveList();
        resetTimers();
        startTimer(currentPlayer);
        statusEl.className = '';
        boardEl.className = '';
        if (currentPlayer === 'X') {
            statusEl.textContent = pName + "'s turn (X)";
        } else if (playAsComputer && DIM === 3 && aiAlgorithm === 'minimax') {
            waitingForKidO = true;
            statusEl.textContent = "🎯 Computer goes first — pick O's opening move!";
            startTimer('O');
        } else {
            statusEl.textContent = "Computer starts...";
            setTimeout(computerMove, 400);
        }
        updateLearningAvailability();
        updatePlayAsComputerAvailability();
        syncIconToggleStates();
        setLearningBaseMessage();
        updateInfoPanel();
        updateLearningPanelVisibility();
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
        if (gameOver) return;
        const r = parseInt(e.target.dataset.r);
        const c = parseInt(e.target.dataset.c);
        if (board[r][c]) return;
        ensureAudio();

        // "Think Like the Computer" mode: kid picks O's move
        if (waitingForKidO) {
            sndPlace();
            hideCoachFeedback();
            // Run minimax BEFORE placing the move to get the computer's choice
            const minimaxResult = (DIM === 3) ? getMinimaxMove() : null;
            const aiMove = minimaxResult ? minimaxResult.bestMove : getT3Move();
            const kidMove = [r, c];
            const matched = aiMove && aiMove[0] === r && aiMove[1] === c;

            makeMove(r, c, 'O');
            waitingForKidO = false;

            // Show comparison feedback
            showCoachFeedback(kidMove, aiMove, matched, minimaxResult);

            if (!gameOver) {
                currentPlayer = 'X';
                statusEl.textContent = pName + "'s turn (X)";
                startTimer('X');
            }
            return;
        }

        // Normal X move
        if (currentPlayer !== 'X') return;
        sndTap();
        hideCoachFeedback();
        makeMove(r, c, 'X');
        if (!gameOver) {
            currentPlayer = 'O';
            if (playAsComputer && DIM === 3 && aiAlgorithm === 'minimax') {
                waitingForKidO = true;
                statusEl.textContent = "🎯 Now think like the computer — pick O's best move!";
                startTimer('O');
            } else {
                statusEl.textContent = "Computer thinking...";
                startTimer('O');
                setTimeout(computerMove, 300);
            }
        }
    }

    function makeMove(r, c, mark) {
        board[r][c] = mark;
        recordMove(mark, r, c);
        render();
        const result = checkWin(r, c, mark);
        if (result) {
            const winner = mark;
            scores[winner]++;
            updateScores();
            statusEl.textContent = winner === 'X' ? pName + " wins!" : "Computer wins!";
            gameOver = true;
            stopTimer();
            recordBoard(winner === 'X' ? pName + ' won!' : 'Computer won!', result);
            // Apply animations after a frame so browser registers initial state
            requestAnimationFrame(() => {
                highlightWin(result, mark);
                statusEl.className = winner === 'X' ? 'status-win' : 'status-lose';
                boardEl.classList.add(winner === 'X' ? 'board-win' : 'board-lose');
                if (winner === 'X') sndWin(); else sndLose();
            });
            return;
        }
        if (isDraw()) {
            scores.D++;
            updateScores();
            statusEl.textContent = "It's a draw!";
            gameOver = true;
            stopTimer();
            recordBoard('Draw', null);
            requestAnimationFrame(() => {
                statusEl.className = 'status-draw';
                sndDraw();
            });
            return;
        }
    }

    function computerMove() {
        let moveInfo = null;
        let move = null;
        const useMinimax = aiAlgorithm === 'minimax' && DIM === 3;

        if (useMinimax) {
            moveInfo = getMinimaxMove();
            move = moveInfo?.bestMove;
            if (moveInfo && learningMode) updateLearningLog(moveInfo);
        }
        if (!move) {
            move = getT3Move();
        }
        // Update learning log status
        if (learningLog) {
            if (useMinimax && learningMode && moveInfo) {
                // already updated above
            } else if (learningMode && DIM === 3 && aiAlgorithm !== 'minimax') {
                learningLog.textContent = "Switch the Brain to \"MiniMax\" to see the computer's pretend moves.";
            } else if (learningMode && DIM !== 3) {
                learningLog.textContent = "MiniMax only works on 3×3 boards. Switch sizes to try it.";
            }
        }
        if (move) {
            sndPlace();
            makeMove(move[0], move[1], 'O');
            if (!gameOver) {
                currentPlayer = 'X';
                statusEl.textContent = pName + "'s turn (X)";
                startTimer('X');
            }
        }
    }

    // --- MiniMax learning helpers (3x3) ---
    function cloneBoard() {
        return board.map(row => [...row]);
    }

    function getMinimaxMove() {
        let bestScore = -Infinity;
        let bestMove = null;
        const considered = [];
        const mid = Math.floor(DIM / 2);
        for (let c = 0; c < DIM; c++) {
            for (let r = 0; r < DIM; r++) {
                if (!board[r][c]) {
                    board[r][c] = 'O';
                    const scenario = describeOpponentReply([r, c]);
                    const score = minimax(false, 0);
                    board[r][c] = 0;
                    considered.push({ move: [r, c], score, scenario });
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = [r, c];
                    }
                }
            }
        }
        const topCandidates = considered.filter(({ score }) => score === bestScore);
        const priority = ([r, c]) => {
            const isCenter = DIM === 3 && r === mid && c === mid;
            const isCorner = (r === 0 || r === DIM - 1) && (c === 0 || c === DIM - 1);
            if (isCenter) return 3;
            if (isCorner) return 2;
            return 1; // sides
        };
        topCandidates.sort((a, b) => priority(b.move) - priority(a.move));
        const pick = topCandidates[0];
        if (pick) {
            bestMove = pick.move;
            bestScore = pick.score;
        }
        if (!bestMove) return null;
        return {
            bestMove,
            considered,
            summary: describeScore(bestScore)
        };
    }

    function describeOpponentReply(move) {
        // board[r][c] is already 'O' — set by caller (getMinimaxMove)
        const boardAfterO = cloneBoard();
        let bestScore = Infinity;
        let bestMove = null;
        let boardAfterReply = null;
        for (let rr = 0; rr < DIM; rr++) {
            for (let cc = 0; cc < DIM; cc++) {
                if (!board[rr][cc]) {
                    board[rr][cc] = 'X';
                    const score = minimax(true, 1);
                    if (score < bestScore) {
                        bestScore = score;
                        bestMove = [rr, cc];
                        boardAfterReply = cloneBoard();
                    }
                    board[rr][cc] = 0;
                }
            }
        }
        if (!boardAfterReply) boardAfterReply = boardAfterO;
        // Don't reset board[r][c] — caller manages the cell lifecycle
        return {
            boardAfterO,
            boardAfterReply,
            bestReply: bestMove,
            replySummary: describeScore(bestScore),
            bestScore
        };
    }

    function minimax(isComputer, depth) {
        const winner = evaluateWinner();
        if (winner === 'O') return 10 - depth;
        if (winner === 'X') return depth - 10;
        if (isFull()) return 0;

        if (isComputer) {
            let best = -Infinity;
            for (let r = 0; r < DIM; r++) {
                for (let c = 0; c < DIM; c++) {
                    if (!board[r][c]) {
                        board[r][c] = 'O';
                        best = Math.max(best, minimax(false, depth + 1));
                        board[r][c] = 0;
                    }
                }
            }
            return best;
        } else {
            let best = Infinity;
            for (let r = 0; r < DIM; r++) {
                for (let c = 0; c < DIM; c++) {
                    if (!board[r][c]) {
                        board[r][c] = 'X';
                        best = Math.min(best, minimax(true, depth + 1));
                        board[r][c] = 0;
                    }
                }
            }
            return best;
        }
    }

    function evaluateWinner() {
        for (const line of getAllLines()) {
            const first = board[line[0][0]][line[0][1]];
            if (!first) continue;
            if (line.every(([r, c]) => board[r][c] === first)) return first;
        }
        return null;
    }

    function isFull() {
        for (let r = 0; r < DIM; r++)
            for (let c = 0; c < DIM; c++)
                if (!board[r][c]) return false;
        return true;
    }

    function describeScore(score) {
        if (score >= 9) return "😄 I win no matter what you do!";
        if (score >= 1) return "🙂 I'm safe — you can't beat me here.";
        if (score <= -9) return "😰 Yikes — you'd win if I go there!";
        if (score < 0) return "😟 Not great — you'd be ahead.";
        return "😐 Fair — we'd tie if we both play smart.";
    }

    function scoreEmoji(score) {
        if (score >= 9) return '😄';
        if (score >= 1) return '🙂';
        if (score <= -9) return '😰';
        if (score < 0) return '😟';
        return '😐';
    }

    function setLearningBaseMessage() {
        if (learningTree) learningTree.innerHTML = '';
        if (!learningLog) return;
        if (DIM !== 3) {
            learningLog.textContent = "This only works on a 3×3 board — switch the grid size to try it!";
            return;
        }
        if (aiAlgorithm !== 'minimax') {
            learningLog.textContent = "The computer is using Newell & Simon's strategy right now. Switch the Brain to \"MiniMax\" to see it think!";
            return;
        }
        if (!learningMode) {
            learningLog.textContent = "Click the 🧠 button above to peek inside the computer's brain!";
        } else {
            learningLog.textContent = "Ready! Make your move and watch me think...";
        }
    }

    function updateLearningLog(info) {
        if (!learningLog || !info || !learningMode || DIM !== 3) return;
        const bestEmoji = scoreEmoji(info.considered.find(
            c => c.move[0] === info.bestMove[0] && c.move[1] === info.bestMove[1]
        )?.score ?? 0);
        let html = `<p><strong>🧠 Here's what I imagined...</strong></p>`;
        html += `<p>I tried every empty square in my head and played out the whole game for each one:</p><ol>`;
        info.considered.forEach(({ move, score }) => {
            const label = squareLabel(move);
            html += `<li><strong>"What if I go ${label}?"</strong> → ${scoreEmoji(score)} ${describeScore(score)}</li>`;
        });
        html += `</ol>`;
        html += `<p>${bestEmoji} <strong>My pick:</strong> <span class="highlight-move">${squareLabel(info.bestMove)}</span> — it gives me the happiest ending!</p>`;
        // Check for symmetry pairs
        const scores = info.considered.map(c => c.score);
        const uniqueScores = new Set(scores);
        if (uniqueScores.size < scores.length) {
            html += `<p class="learning-tip">Notice some squares got the same score? That's because they're <strong>mirror images</strong> of each other — the board looks the same if you flip it!</p>`;
        }
        learningLog.innerHTML = html;
        renderLearningTree(info);
    }

    function squareLabel([r, c]) {
        if (DIM === 3) {
            const rows = ['top', 'middle', 'bottom'];
            const cols = ['left', 'center', 'right'];
            return `${rows[r]}-${cols[c]}`;
        }
        return `row ${r + 1}, col ${c + 1}`;
    }

    // --- "Think Like the Computer" coach feedback ---
    function showCoachFeedback(kidMove, aiMove, matched, minimaxResult) {
        if (!coachFeedbackEl) return;
        const kidLabel = squareLabel(kidMove);
        const aiLabel = aiMove ? squareLabel(aiMove) : '???';
        let html = '';

        if (matched) {
            coachStreak++;
            const cheers = ['Nice!', 'Great thinking!', 'You nailed it!', 'Wow, perfect!', 'Brilliant!'];
            const cheer = cheers[Math.min(coachStreak - 1, cheers.length - 1)];
            html += `<div class="coach-result coach-match">`;
            html += `<strong>⭐ ${cheer}</strong> You picked <strong>${kidLabel}</strong> — `;
            html += `exactly what MiniMax would choose!`;
            if (coachStreak >= 3) {
                html += `<br>🔥 ${coachStreak} in a row! You're thinking like a real computer!`;
            }
            html += `</div>`;
        } else {
            coachStreak = 0;
            html += `<div class="coach-result coach-diff">`;
            html += `<strong>🤔 Close!</strong> You picked <strong>${kidLabel}</strong>, `;
            html += `but MiniMax would pick <strong>${aiLabel}</strong>.`;
            html += `</div>`;

            // Explain WHY minimax picked differently
            if (minimaxResult && minimaxResult.considered.length > 0) {
                const kidEntry = minimaxResult.considered.find(
                    c => c.move[0] === kidMove[0] && c.move[1] === kidMove[1]
                );
                const aiEntry = minimaxResult.considered.find(
                    c => c.move[0] === aiMove[0] && c.move[1] === aiMove[1]
                );
                if (kidEntry && aiEntry) {
                    html += `<div class="coach-explain">`;
                    html += `<p><strong>Here's why:</strong></p>`;
                    html += `<p>Your pick (${kidLabel}): ${scoreEmoji(kidEntry.score)} ${describeScore(kidEntry.score)}</p>`;
                    html += `<p>MiniMax pick (${aiLabel}): ${scoreEmoji(aiEntry.score)} ${describeScore(aiEntry.score)}</p>`;
                    if (aiEntry.score > kidEntry.score) {
                        html += `<p class="coach-tip">The computer's pick leads to a happier ending because it looked ahead at every possible move you could make!</p>`;
                    } else {
                        html += `<p class="coach-tip">Both moves are actually close — your instinct isn't bad! Keep practicing.</p>`;
                    }
                    html += `</div>`;
                }
            }
        }

        coachFeedbackEl.innerHTML = html;
        coachFeedbackEl.style.display = 'block';
    }

    function hideCoachFeedback() {
        if (coachFeedbackEl) coachFeedbackEl.style.display = 'none';
    }

    function updateLearningAvailability() {
        const minimaxAvailable = DIM === 3 && aiAlgorithm === 'minimax';
        if (learningToggle) {
            if (!minimaxAvailable) {
                learningMode = false;
                learningToggle.checked = false;
                learningToggle.disabled = true;
            } else {
                learningToggle.disabled = false;
                learningToggle.checked = learningMode;
            }
        }
        if (learningNote) {
            if (DIM !== 3) {
                learningNote.textContent = "Only works on 3×3 — bigger boards have too many possibilities to show!";
            } else if (aiAlgorithm !== 'minimax') {
                learningNote.textContent = "Switch the Brain to \"MiniMax\" to unlock these features!";
            } else {
                learningNote.textContent = learningMode
                    ? "Watch the computer play \"What If\" after each of your moves!"
                    : "";
            }
        }
    }

    function updatePlayAsComputerAvailability() {
        const available = DIM === 3 && aiAlgorithm === 'minimax';
        if (playAsComputerToggle) {
            if (!available) {
                playAsComputer = false;
                playAsComputerToggle.checked = false;
                playAsComputerToggle.disabled = true;
            } else {
                playAsComputerToggle.disabled = false;
                playAsComputerToggle.checked = playAsComputer;
            }
        }
    }

    function formatMove([r, c]) {
        return `row ${r + 1}, column ${c + 1}`;
    }

    function recordMove(mark, r, c) {
        moveHistory.push({
            player: mark,
            row: r,
            col: c,
        });
        renderMoveList();
    }

    function renderMoveList() {
        if (!moveListLeft || !moveListRight) return;
        const playerLists = {
            X: moveListLeft,
            O: moveListRight,
        };
        ["X", "O"].forEach((mark) => {
            const moves = moveHistory.filter((entry) => entry.player === mark);
            if (!moves.length) {
                playerLists[mark].innerHTML = '<li>No moves yet.</li>';
            } else {
                playerLists[mark].innerHTML = moves
                    .map(
                        (entry) =>
                            `<li>(${entry.row + 1}, ${entry.col + 1})</li>`
                    )
                    .join("");
            }
        });
    }

    function resetTimers() {
        timerValues.X = 0;
        timerValues.O = 0;
        updateTimerDisplay();
        stopTimer();
    }

    function startTimer(player) {
        if (!timerXEl || !timerOEl) return;
        stopTimer();
        currentTimerPlayer = player;
        timerInterval = setInterval(() => {
            timerValues[player] += 1;
            updateTimerDisplay();
            checkForTimeout();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        currentTimerPlayer = null;
    }

    function updateTimerDisplay() {
        if (timerXEl) timerXEl.textContent = formatTime(timerValues.X);
        if (timerOEl) timerOEl.textContent = formatTime(timerValues.O);
    }

    function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60)
            .toString()
            .padStart(2, "0");
        const seconds = (totalSeconds % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
    }

    function checkForTimeout() {
        if (timerMode === "unlimited" || !currentTimerPlayer) return;
        const limitSeconds = parseInt(timerMode, 10) * 60;
        if (timerValues[currentTimerPlayer] >= limitSeconds) {
            gameOver = true;
            stopTimer();
            if (currentTimerPlayer === "X") {
                scores.O++;
                updateScores();
                statusEl.textContent = "Time's up! Computer wins on time.";
                recordBoard("Computer won on time", null);
            } else {
                scores.X++;
                updateScores();
                statusEl.textContent = "Time's up! " + pName + " wins on time.";
                recordBoard(pName + " won on time", null);
            }
        }
    }

    function renderLearningTree(info) {
        if (!learningTree) return;
        if (!learningMode || DIM !== 3) {
            learningTree.innerHTML = '';
            return;
        }
        const sorted = [...info.considered].sort((a, b) => b.score - a.score);
        learningTree.innerHTML = '';
        if (!sorted.length) return;

        const heading = document.createElement('p');
        heading.className = 'branch-text';
        heading.innerHTML = '<strong>🔍 The "What If" Tree</strong> — here are the top moves I imagined (blue = my move, pink = your best reply):';
        learningTree.appendChild(heading);

        sorted.slice(0, 4).forEach(entry => {
            const branch = document.createElement('div');
            branch.className = 'learning-branch';
            const isBest = info.bestMove && entry.move[0] === info.bestMove[0] && entry.move[1] === info.bestMove[1];
            if (isBest) branch.classList.add('best');

            const text = document.createElement('div');
            text.className = 'branch-text';
            const emoji = scoreEmoji(entry.score);
            const label = squareLabel(entry.move);
            const replyLabel = entry.scenario.bestReply ? squareLabel(entry.scenario.bestReply) : null;

            let html = `<strong>${isBest ? '⭐ ' : ''}What if I go ${label}?</strong><br>`;
            html += `${emoji} ${describeScore(entry.score)}<br>`;
            if (replyLabel) {
                html += `Your best answer: <span class="highlight-reply-text">${replyLabel}</span>`;
            } else {
                html += `No squares left — game over!`;
            }
            text.innerHTML = html;

            const boardsWrap = document.createElement('div');
            boardsWrap.className = 'branch-boards';

            const moveHighlight = {};
            moveHighlight[`${entry.move[0]},${entry.move[1]}`] = 'highlight-move';
            const board1 = createMiniBoard(entry.scenario.boardAfterO, moveHighlight);

            const replyHighlight = {};
            if (entry.scenario.bestReply) {
                replyHighlight[`${entry.scenario.bestReply[0]},${entry.scenario.bestReply[1]}`] = 'highlight-reply';
            }
            const board2 = createMiniBoard(entry.scenario.boardAfterReply, replyHighlight);

            // Add tiny labels under mini boards
            const wrap1 = document.createElement('div');
            wrap1.className = 'mini-board-labeled';
            wrap1.appendChild(board1);
            const lbl1 = document.createElement('div');
            lbl1.className = 'mini-board-label';
            lbl1.textContent = 'I go here';
            wrap1.appendChild(lbl1);

            const wrap2 = document.createElement('div');
            wrap2.className = 'mini-board-labeled';
            wrap2.appendChild(board2);
            const lbl2 = document.createElement('div');
            lbl2.className = 'mini-board-label';
            lbl2.textContent = 'You reply';
            wrap2.appendChild(lbl2);

            const arrow = document.createElement('span');
            arrow.className = 'branch-arrow';
            arrow.textContent = '→';

            boardsWrap.appendChild(wrap1);
            boardsWrap.appendChild(arrow);
            boardsWrap.appendChild(wrap2);

            branch.appendChild(text);
            branch.appendChild(boardsWrap);
            learningTree.appendChild(branch);
        });
    }

    function createMiniBoard(snapshot, highlightMap = {}) {
        const dim = snapshot.length;
        const mini = document.createElement('div');
        mini.className = 'mini-board';
        mini.style.gridTemplateColumns = `repeat(${dim}, 18px)`;
        mini.style.gap = '2px';
        for (let r = 0; r < dim; r++) {
            for (let c = 0; c < dim; c++) {
                const cell = document.createElement('div');
                cell.className = 'mini-cell';
                cell.style.width = '18px';
                cell.style.height = '18px';
                cell.style.fontSize = '0.55rem';
                const val = snapshot[r][c];
                if (val) {
                    cell.textContent = val;
                    cell.classList.add(val.toLowerCase());
                }
                const key = `${r},${c}`;
                if (highlightMap[key]) {
                    cell.classList.add(highlightMap[key]);
                }
                mini.appendChild(cell);
            }
        }
        return mini;
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
        outer: for (let r = 0; r < DIM; r++)
            for (let c = 0; c < DIM; c++)
                if (!board[r][c]) { hasEmpty = true; break outer; }
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

    function highlightWin(cells, mark) {
        const allCells = boardEl.querySelectorAll('.cell');
        const cls = mark === 'X' ? 'win' : 'lose';
        cells.forEach(([r, c]) => {
            allCells[r * DIM + c].classList.add(cls);
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
        if (typeof gameSet === 'function') {
            gameSet('ttt_scores', JSON.stringify(scores));
        }
    }

    function recordBoard(result, winCells) {
        gameCounter++;
        hasStartedGame = true;
        updateInfoPanel();
        const snapshot = board.map(row => [...row]);
        boardHistory.unshift({
            game: gameCounter,
            dim: DIM,
            result,
            board: snapshot,
            winCells: winCells || []
        });
        if (boardHistory.length > 10) boardHistory.pop();
        renderBoardHistory();
    }

    function renderBoardHistory() {
        if (!boardHistoryEl) return;
        if (!boardHistory.length) {
            boardHistoryEl.textContent = 'No completed games yet.';
            return;
        }
        boardHistoryEl.innerHTML = '';
        boardHistory.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'history-entry';

            const header = document.createElement('div');
            header.className = 'history-header';
            const resultCls = entry.result === 'You won!' ? 'hw' :
                              entry.result === 'Computer won!' ? 'hl' : 'hd';
            header.innerHTML = `<span>Game ${entry.game}</span><span class="${resultCls}">${entry.result}</span><span class="history-dim">${entry.dim}&times;${entry.dim}</span>`;
            div.appendChild(header);

            const miniBoard = document.createElement('div');
            miniBoard.className = 'mini-board';
            const cellSize = entry.dim >= 5 ? 16 : entry.dim >= 4 ? 20 : 24;
            const fontSize = entry.dim >= 5 ? '0.5rem' : entry.dim >= 4 ? '0.6rem' : '0.7rem';
            miniBoard.style.gridTemplateColumns = `repeat(${entry.dim}, ${cellSize}px)`;
            miniBoard.style.gap = '2px';

            const winSet = new Set(entry.winCells.map(([r, c]) => `${r},${c}`));

            for (let r = 0; r < entry.dim; r++) {
                for (let c = 0; c < entry.dim; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'mini-cell';
                    cell.style.width = cellSize + 'px';
                    cell.style.height = cellSize + 'px';
                    cell.style.fontSize = fontSize;
                    const val = entry.board[r][c];
                    if (val) {
                        cell.textContent = val;
                        cell.classList.add(val.toLowerCase());
                    }
                    if (winSet.has(`${r},${c}`)) {
                        cell.classList.add('mini-win');
                    }
                    miniBoard.appendChild(cell);
                }
            }
            div.appendChild(miniBoard);
            boardHistoryEl.appendChild(div);
        });
    }

    // --- Sound effects (Web Audio API) ---
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playTone(freq, dur, type, vol) {
        ensureAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + dur);
    }

    function sndTap() { playTone(600, 0.06, 'triangle', 0.1); }
    function sndPlace() { playTone(400, 0.08, 'triangle', 0.07); }
    function sndWin() {
        playTone(523, 0.12, 'sine', 0.1);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
        setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 200);
    }
    function sndLose() {
        playTone(300, 0.2, 'sine', 0.08);
        setTimeout(() => playTone(220, 0.3, 'sine', 0.08), 150);
    }
    function sndDraw() { playTone(350, 0.25, 'triangle', 0.06); }

    newGameBtn.addEventListener('click', init);
    dimSelect.addEventListener('change', init);
    if (aiSelect) aiSelect.addEventListener('change', init);

    // Rules modal with tabs
    if (rulesBtn && rulesModal && rulesClose) {
        rulesBtn.addEventListener('click', () => {
            rulesModal.style.display = 'flex';
        });
        rulesClose.addEventListener('click', () => {
            rulesModal.style.display = 'none';
        });
        rulesModal.addEventListener('click', (e) => {
            if (e.target === rulesModal) rulesModal.style.display = 'none';
        });
        // Tab switching
        rulesModal.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                rulesModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                rulesModal.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById(tab.dataset.tab);
                if (panel) panel.classList.add('active');
            });
        });
    }

    // Computer brain modal
    if (computerBtn && computerModal && computerClose) {
        computerBtn.addEventListener('click', () => {
            syncComputerModal();
            computerModal.style.display = 'flex';
        });
        computerClose.addEventListener('click', () => {
            computerModal.style.display = 'none';
        });
        computerModal.addEventListener('click', (e) => {
            if (e.target === computerModal) computerModal.style.display = 'none';
        });
        // Brain picker radio buttons
        computerModal.querySelectorAll('input[name="brain-pick"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (aiSelect) {
                    aiSelect.value = radio.value;
                }
                aiAlgorithm = radio.value;
                syncComputerModal();
                syncIconToggleStates();
                updateLearningAvailability();
                updatePlayAsComputerAvailability();
                setLearningBaseMessage();
                init();
            });
        });
        // Modal toggle buttons
        if (modalLearningBtn) {
            modalLearningBtn.addEventListener('click', () => {
                if (DIM !== 3 || aiAlgorithm !== 'minimax') return;
                learningMode = !learningMode;
                if (learningToggle) learningToggle.checked = learningMode;
                syncIconToggleStates();
                syncComputerModal();
                updateLearningAvailability();
                setLearningBaseMessage();
                updateLearningPanelVisibility();
            });
        }
        if (modalPlayAsBtn) {
            modalPlayAsBtn.addEventListener('click', () => {
                handlePlayAsComputerToggle();
                syncComputerModal();
                updateLearningPanelVisibility();
            });
        }
    }

    function syncComputerModal() {
        const isMinimax = aiAlgorithm === 'minimax';
        const available = isMinimax && DIM === 3;
        // Show/hide detail panels
        const detailNS = document.getElementById('brain-detail-ns');
        const detailMM = document.getElementById('brain-detail-mm');
        if (detailNS) detailNS.style.display = isMinimax ? 'none' : 'block';
        if (detailMM) detailMM.style.display = isMinimax ? 'block' : 'none';
        if (minimaxControlsNote) minimaxControlsNote.style.display = (isMinimax && DIM !== 3) ? 'block' : 'none';
        // Sync radio
        const radio = computerModal?.querySelector(`input[value="${aiAlgorithm}"]`);
        if (radio) radio.checked = true;
        // Sync button states
        if (modalLearningBtn) {
            modalLearningBtn.classList.toggle('active', learningMode);
            modalLearningBtn.classList.toggle('disabled', !available);
        }
        if (modalPlayAsBtn) {
            modalPlayAsBtn.classList.toggle('active', playAsComputer);
            modalPlayAsBtn.classList.toggle('disabled', !available);
        }
    }

    // Icon toggle buttons for learning mode & play-as-computer
    function syncIconToggleStates() {
        const minimaxAvailable = DIM === 3 && aiAlgorithm === 'minimax';
        if (learningModeBtn) {
            learningModeBtn.classList.toggle('active', learningMode);
            learningModeBtn.classList.toggle('disabled', !minimaxAvailable);
        }
        if (playAsComputerBtn) {
            playAsComputerBtn.classList.toggle('active', playAsComputer);
            playAsComputerBtn.classList.toggle('disabled', !minimaxAvailable);
        }
    }

    if (learningModeBtn) {
        learningModeBtn.addEventListener('click', () => {
            if (DIM !== 3 || aiAlgorithm !== 'minimax') return;
            learningMode = !learningMode;
            if (learningToggle) learningToggle.checked = learningMode;
            syncIconToggleStates();
            updateLearningAvailability();
            setLearningBaseMessage();
            updateLearningPanelVisibility();
        });
    }
    if (learningToggle) {
        learningToggle.addEventListener('change', () => {
            if (DIM !== 3) {
                learningToggle.checked = false;
                return;
            }
            learningMode = learningToggle.checked;
            syncIconToggleStates();
            updateLearningAvailability();
            setLearningBaseMessage();
            updateLearningPanelVisibility();
        });
    }
    function handlePlayAsComputerToggle() {
        if (DIM !== 3 || aiAlgorithm !== 'minimax') return;
        playAsComputer = !playAsComputer;
        if (playAsComputerToggle) playAsComputerToggle.checked = playAsComputer;
        syncIconToggleStates();
        if (!playAsComputer) {
            if (waitingForKidO) {
                waitingForKidO = false;
                hideCoachFeedback();
                statusEl.textContent = "Computer thinking...";
                setTimeout(computerMove, 300);
            }
        } else {
            if (!gameOver && currentPlayer === 'O') {
                waitingForKidO = true;
                statusEl.textContent = "🎯 Now think like the computer — pick O's best move!";
            }
        }
    }
    if (playAsComputerBtn) {
        playAsComputerBtn.addEventListener('click', handlePlayAsComputerToggle);
    }
    if (playAsComputerToggle) {
        playAsComputerToggle.addEventListener('change', () => {
            if (DIM !== 3) {
                playAsComputerToggle.checked = false;
                return;
            }
            handlePlayAsComputerToggle();
        });
    }
    if (tossBtn) {
        tossBtn.addEventListener('click', () => {
            firstPlayer = Math.random() < 0.5 ? 'X' : 'O';
            if (tossResultEl) {
                tossResultEl.textContent =
                    firstPlayer === 'X'
                        ? "Toss: " + pName + " (X) starts"
                        : "Toss: Computer (O) starts";
            }
            init();
        });
    }
    if (timerModeSelect) {
        timerModeSelect.addEventListener('change', () => {
            timerMode = timerModeSelect.value;
            resetTimers();
        });
    }
    // Display loaded scores
    updateScores();

    // Set player name in static labels
    var pxLabel = document.getElementById('player-x-label');
    var sxLabel = document.getElementById('score-x-label');
    if (pxLabel) pxLabel.textContent = pName + ' (X)';
    if (sxLabel) sxLabel.textContent = pName + ' (X)';

    init();
})();
