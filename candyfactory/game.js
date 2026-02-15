// Deal or No Deal
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from candyfactory.cpp by Vikas Yadav

(function () {
    const CASE_MONIES = [
        1, 2, 4, 6, 8,
        10, 20, 40, 60, 80,
        100, 200, 400, 600, 800,
        1000, 2000, 4000, 6000, 8000,
        10000, 20000, 40000, 60000, 80000,
        100000, 200000, 400000, 600000, 800000
    ];
    const NUM_CASES = CASE_MONIES.length;
    const TOTAL_SUM = CASE_MONIES.reduce((sum, value) => sum + value, 0);
    const INITIAL_EV = TOTAL_SUM / NUM_CASES;
    // Boxes to open per round (player opens 28 total)
    const NCASE_TO_OPEN = [7, 6, 5, 4, 3, 2, 1];
    const NUM_ROUNDS = NCASE_TO_OPEN.length;
    const NUM_OFFERS = NUM_ROUNDS - 1; // final round is swap/keep, no banker offer

    const BRACKET = [
        [0.10, 0.25],
        [0.20, 0.35],
        [0.30, 0.45],
        [0.40, 0.55],
        [0.50, 0.65],
        [0.60, 0.75]
    ];

    let cases = [];        // { money, opened }
    let caseStatus = [];   // tracks which money values are eliminated
    let playerCase = -1;   // 0-indexed
    let currentRound = 0;
    let casesToOpenThisRound = 0;
    let casesOpenedThisRound = 0;
    let offerList = [];
    let stage = 'select';  // select | opening | offer | swap | finished
    let avgUnopened = 0;
    let offerMode = 'offer';
    let swapTarget = -1;
    let lastDecisionType = 'keep';
    const MAX_HISTORY = 8;
    const candyHistory = [];
    const PICK_TIME_SECONDS = 15;
    const HIGH_THRESHOLD = 1000;
    let pickTimerId = null;
    let pickTimeLeft = 0;
    let pickWarnPlayed = false;

    // --- Active Math Mode state ---
    let activeMode = false;
    let mathScore = { correct: 0, total: 0 };
    let challengeCallback = null;  // called after challenge answered
    let boxCountStreak = 0;        // streak for type 2 (boxes left) — skip after 3 correct
    let challengeRotation = 0;     // cycles through challenge types
    let lastOpenedValue = 0;       // value of last opened box (for challenge context)
    let prevTotal = 0;             // total before last box opened
    let pendingStatsUpdate = null; // deferred stats update { sum, count }

    const casesGridEl = document.getElementById('cases-grid');
    const statusEl = document.getElementById('status');
    const offerBoxEl = document.getElementById('offer-box');
    const offerAmountEl = document.getElementById('offer-amount');
    const dealBtnEl = document.getElementById('deal-btn');
    const nodealBtnEl = document.getElementById('nodeal-btn');
    const newGameBtnEl = document.getElementById('new-game-btn');
    const roundInfoEl = document.getElementById('round-info');
    const prevOffersEl = document.getElementById('prev-offers');
    const candyHistoryEl = document.getElementById('candy-history');
    const totalCandiesEl = document.getElementById('total-candies');
    const meanCandiesEl = document.getElementById('mean-candies');
    const probHighEl = document.getElementById('prob-high');
    const equallyNoteEl = document.getElementById('equally-note');
    const probBodyEl = document.getElementById('prob-body');
    const pickTimerEl = document.getElementById('pick-timer');
    const offerTitleEl = offerBoxEl.querySelector('h2');
    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');
    const closeInfoBtn = document.getElementById('close-info');
    const infoTabs = document.querySelectorAll('.info-tab');
    const infoPanels = document.querySelectorAll('.info-panel');

    // Math challenge elements
    const mathChallengeEl = document.getElementById('math-challenge');
    const mathQuestionEl = document.getElementById('math-question');
    const mathAnswerEl = document.getElementById('math-answer');
    const mathCheckEl = document.getElementById('math-check');
    const mathFeedbackEl = document.getElementById('math-feedback');
    const mathScoreEl = document.getElementById('math-score');
    const modeSelectEl = document.getElementById('mode-select');
    const candyStatsEl = document.querySelector('.candy-stats');
    const probTrackerEl = document.getElementById('prob-tracker');

    function initGame() {
        // Fill and shuffle cases (Fisher-Yates, matching original)
        cases = CASE_MONIES.map(m => ({ money: m, opened: false }));
        const rand = () => Math.random();
        for (let i = NUM_CASES - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [cases[i], cases[j]] = [cases[j], cases[i]];
        }
        caseStatus = Array(NUM_CASES).fill(true); // true = still in play
        playerCase = -1;
        currentRound = 0;
        casesToOpenThisRound = 0;
        casesOpenedThisRound = 0;
        offerList = [];
        stage = 'select';
        offerBoxEl.classList.remove('visible');
        statusEl.textContent =
            `Pick your candy box! Total candy pool ${formatCandies(TOTAL_SUM)} (EV ${formatCandies(Math.round(INITIAL_EV))}).`;
        statusEl.className = '';
        roundInfoEl.textContent = '';
        prevOffersEl.innerHTML = '';
        renderCases();
        renderMoneyBoard();
        offerMode = 'offer';
        swapTarget = -1;
        lastDecisionType = 'keep';
        stopPickTimer();
        startPickTimer();
        setupInfoModal();

        // Reset math state
        mathScore = { correct: 0, total: 0 };
        challengeRotation = 0;
        boxCountStreak = 0;
        lastOpenedValue = 0;
        prevTotal = 0;
        pendingStatsUpdate = null;
        updateMathScoreDisplay();
        hideMathChallenge();

        // Reset stats visibility for active mode
        if (activeMode) {
            candyStatsEl?.classList.remove('revealed');
            probTrackerEl?.classList.remove('revealed');
        }
    }

    function setupInfoModal() {
        if (!infoBtn || !infoModal) return;
        infoBtn.addEventListener('click', () => infoModal.classList.add('active'));
        closeInfoBtn?.addEventListener('click', () => infoModal.classList.remove('active'));
        infoModal.addEventListener('click', (evt) => {
            if (evt.target === infoModal) infoModal.classList.remove('active');
        });
        infoTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                infoTabs.forEach((t) => t.classList.remove('active'));
                infoPanels.forEach((panel) => panel.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.querySelector(`.info-panel[data-panel="${tab.dataset.tab}"]`);
                panel?.classList.add('active');
            });
        });
    }

    function renderCases() {
        casesGridEl.innerHTML = '';
        for (let i = 0; i < NUM_CASES; i++) {
            const btn = document.createElement('button');
            btn.className = 'case-btn';
            btn.dataset.idx = i;
            if (i === playerCase) {
                btn.classList.add('player-case');
                btn.textContent = '#' + (i + 1);
            } else if (cases[i].opened) {
                btn.classList.add('opened');
                btn.textContent = formatCandies(cases[i].money);
                btn.style.fontSize = '0.7rem';
            } else {
                btn.textContent = i + 1;
            }
            btn.addEventListener('click', () => onCaseClick(i));
            casesGridEl.appendChild(btn);
        }
    }

    function renderMoneyBoard() {
        const leftEl = document.getElementById('money-left');
        const rightEl = document.getElementById('money-right');
        leftEl.innerHTML = '';
        rightEl.innerHTML = '';
        const splitIndex = Math.ceil(NUM_CASES / 2);
        for (let i = 0; i < NUM_CASES; i++) {
            const row = document.createElement('div');
            row.className = 'money-row ' + (i < splitIndex ? 'money-low' : 'money-high');
            if (!caseStatus[i]) row.classList.add('eliminated');
            row.textContent = formatCandies(CASE_MONIES[i]);
            if (i < splitIndex) leftEl.appendChild(row);
            else rightEl.appendChild(row);
        }
    }

    function markMoneyValue(value) {
        for (let i = 0; i < CASE_MONIES.length; i++) {
            if (caseStatus[i] && CASE_MONIES[i] === value) {
                caseStatus[i] = false;
                return;
            }
        }
    }

    function onCaseClick(idx) {
        ensureAudioCtx(); // unlock audio on first user interaction
        if (stage === 'select') {
            selectPlayerCase(idx);
            return;
        }

        if (stage === 'opening') {
            if (idx === playerCase || cases[idx].opened) return;
            // Open this box
            sndCaseOpen();
            cases[idx].opened = true;
            casesOpenedThisRound++;
            // Mark money value as eliminated
            markMoneyValue(cases[idx].money);
            // Crowd reaction based on value eliminated
            const val = cases[idx].money;
            setTimeout(() => {
                if (val <= 800) sndClap();
                else if (val >= 50000) sndGasp();
            }, 150);

            // Store context for math challenges
            lastOpenedValue = val;
            prevTotal = getUnopenedSum() + val; // total BEFORE this box was opened

            if (activeMode) {
                // In active mode: update internal avg but defer stats display
                updateAvgInternal();
                renderCases();
                renderMoneyBoard();
                // Show math challenge, then continue game flow
                const remaining = casesToOpenThisRound - casesOpenedThisRound;
                showPostOpenChallenge(idx, remaining);
            } else {
                updateAvg();
                renderCases();
                renderMoneyBoard();
                continueAfterOpen(idx);
            }
        }
    }

    function continueAfterOpen(idx) {
        const remaining = casesToOpenThisRound - casesOpenedThisRound;
        if (remaining > 0) {
            statusEl.textContent = `Candy box #${idx + 1} had ${formatCandies(cases[idx].money)}. Open ${remaining} more box${remaining > 1 ? 'es' : ''}.`;
            roundInfoEl.textContent = `Round ${currentRound} — ${remaining} to open`;
            restartOpeningTimer();
        } else {
            const otherClosed = getRemainingClosed();
            if (otherClosed === 1) {
                stage = 'swap';
                statusEl.textContent = `Only two boxes left. Will you swap?`;
                roundInfoEl.textContent = `Final choice — swap or keep`;
                stopPickTimer();
                playRingSound();
                setTimeout(promptSwap, 1500);
                return;
            }
            if (currentRound > NUM_OFFERS) {
                finishGame(false, 0);
                return;
            }
            statusEl.textContent = `Candy box #${idx + 1} had ${formatCandies(cases[idx].money)}. The factory manager is calling...`;
            roundInfoEl.textContent = `Round ${currentRound} — Factory manager's offer`;
            stage = 'offer';
            stopPickTimer();
            offerMode = 'offer';
            playRingSound();
            if (activeMode) {
                // Show offer prediction challenge before the offer
                setTimeout(() => showOfferPredictionChallenge(), 2200);
            } else {
                setTimeout(showOffer, 2200);
            }
        }
    }

    function selectPlayerCase(idx, auto = false) {
        playerCase = idx;
        stage = 'opening';
        currentRound++;
        casesToOpenThisRound = NCASE_TO_OPEN[0];
        casesOpenedThisRound = 0;
        updateAvg();
        renderCases();
        stopPickTimer();
        if (pickTimerEl) pickTimerEl.textContent = '';
        const prefix = auto
            ? `Time's up! Candy box #${idx + 1} was chosen for you.`
            : `Your candy box is #${idx + 1}.`;
        statusEl.textContent = `${prefix} Open ${casesToOpenThisRound} candy boxes.`;
        roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound - casesOpenedThisRound} to open`;
        restartOpeningTimer();
    }

    function startPickTimer() {
        if (!pickTimerEl) return;
        pickTimeLeft = PICK_TIME_SECONDS;
        pickWarnPlayed = false;
        pickTimerEl.textContent = `Pick your candy box in ${pickTimeLeft}s`;
        pickTimerId = setInterval(() => {
            pickTimeLeft--;
            if (pickTimeLeft <= 0) {
                stopPickTimer();
                autoSelectPlayerCase();
            } else {
                pickTimerEl.textContent = `Pick your candy box in ${pickTimeLeft}s`;
                if (pickTimeLeft <= 5 && !pickWarnPlayed) {
                    pickWarnPlayed = true;
                    sndWarn();
                }
            }
        }, 1000);
    }

    function stopPickTimer() {
        if (pickTimerId) {
            clearInterval(pickTimerId);
            pickTimerId = null;
        }
    }

    function restartOpeningTimer() {
        if (stage !== 'opening') {
            stopPickTimer();
            return;
        }
        stopPickTimer();
        startPickTimer();
    }

    function autoSelectPlayerCase() {
        if (playerCase !== -1) return;
        const remaining = [];
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) remaining.push(i);
        }
        if (!remaining.length) return;
        const choice = remaining[Math.floor(Math.random() * remaining.length)];
        selectPlayerCase(choice, true);
    }

    function showOffer() {
        offerMode = 'offer';
        const left = BRACKET[currentRound - 1][0];
        const right = BRACKET[currentRound - 1][1];
        const alpha = Math.random();
        const fraction = left + (right - left) * alpha;
        const offer = Math.round(fraction * avgUnopened);
        offerList.push(offer);
        offerAmountEl.textContent = formatCandies(offer);
        offerBoxEl.classList.add('visible');
        offerTitleEl.textContent = "FACTORY MANAGER'S OFFER";
        statusEl.textContent = 'ACCEPT OR REJECT?';
        prevOffersEl.innerHTML = 'Previous offers: ' +
            offerList.map((o, i) => `<span>R${i + 1}: ${formatCandies(o)}</span>`).join(' | ');
        dealBtnEl.textContent = 'Accept';
        nodealBtnEl.textContent = 'Reject';
    }

    function onDeal() {
        if (offerMode === 'offer') {
            lastDecisionType = 'accept';
            sndDeal();
            const offer = offerList[offerList.length - 1];
            finishGame(true, offer);
        } else if (offerMode === 'swap') {
            lastDecisionType = 'swap';
            sndDeal();
            performSwap();
            finishGame(false, 0);
        }
    }

    function onNoDeal() {
        if (offerMode === 'offer') {
            lastDecisionType = 'reject';
            sndNoDeal();
            offerBoxEl.classList.remove('visible');
            currentRound++;
            casesToOpenThisRound = NCASE_TO_OPEN[currentRound - 1] || 0;
            casesOpenedThisRound = 0;
            stage = 'opening';
            statusEl.textContent = `Keep! Round ${currentRound} — Open ${casesToOpenThisRound} box${casesToOpenThisRound > 1 ? 'es' : ''}.`;
            roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound} to open`;
            restartOpeningTimer();
        } else if (offerMode === 'swap') {
            lastDecisionType = 'keep';
            sndNoDeal();
            finishGame(false, 0);
        }
    }

    function finishGame(isDeal, offer) {
        offerBoxEl.classList.remove('visible');
        stopPickTimer();
        stage = 'finished';
        offerMode = 'offer';
        swapTarget = -1;
        const playerMoney = cases[playerCase].money;

        // Reveal player's box
        sndBigReveal();
        cases[playerCase].opened = true;
        renderCases();
        markMoneyValue(playerMoney);
        renderMoneyBoard();

        const otherIdx = getRemainingClosedIndex();
        const otherValue = otherIdx !== -1 ? cases[otherIdx].money : null;
        if (otherIdx !== -1) {
            cases[otherIdx].opened = true;
        }
        const isGoodOutcome = isDeal ? (offer >= playerMoney) : (playerMoney >= INITIAL_EV);
        setTimeout(() => { isGoodOutcome ? sndWin() : sndLose(); }, 400);

        if (isDeal) {
            statusEl.textContent = `TRADE! You accepted ${formatCandies(offer)} candies! (Your box had ${formatCandies(playerMoney)})`;
        } else {
            const tail = otherValue !== null ? ` (other box had ${formatCandies(otherValue)})` : '';
            statusEl.textContent = `You kept candy box #${playerCase + 1} and won ${formatCandies(playerMoney)}!${tail}`;
        }
        roundInfoEl.textContent = 'Game over. Press New Game to play again.';

        addCandyHistoryEntry({
            decision: lastDecisionType,
            boxNumber: playerCase + 1,
            candiesWon: isDeal ? offer : playerMoney,
            yourBox: playerMoney,
            offer,
            otherValue: isDeal ? null : otherValue
        });
        lastDecisionType = 'keep';

        // Apply animations after a frame so browser registers initial state
        requestAnimationFrame(() => {
            statusEl.className = isGoodOutcome ? 'status-win' : 'status-lose';
            const caseBtn = casesGridEl.querySelector(`[data-idx="${playerCase}"]`);
            if (caseBtn) {
                caseBtn.classList.add(isGoodOutcome ? 'won' : 'lost');
                caseBtn.textContent = formatCandies(playerMoney);
            }
        });

        // In active mode: show median challenge then final summary
        if (activeMode) {
            // Reveal stats at game end
            candyStatsEl?.classList.add('revealed');
            probTrackerEl?.classList.add('revealed');

            setTimeout(() => {
                showMedianChallenge(() => {
                    showMathSummary();
                });
            }, 1500);
        }
    }

    // --- Stats helpers ---
    function getUnopenedSum() {
        let sum = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) sum += cases[i].money;
        }
        return sum;
    }

    function updateAvgInternal() {
        let sum = 0, count = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) {
                sum += cases[i].money;
                count++;
            }
        }
        avgUnopened = count > 0 ? sum / count : 0;
        pendingStatsUpdate = { sum, count };
    }

    function updateAvg() {
        let sum = 0, count = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) {
                sum += cases[i].money;
                count++;
            }
        }
        avgUnopened = count > 0 ? sum / count : 0;
        updateStats(sum, count);
    }

    function flushPendingStats() {
        if (pendingStatsUpdate) {
            updateStats(pendingStatsUpdate.sum, pendingStatsUpdate.count);
            pendingStatsUpdate = null;
            // Briefly reveal stats with highlight
            candyStatsEl?.classList.add('revealed');
            probTrackerEl?.classList.add('revealed');
            const totalCard = totalCandiesEl?.closest('.stat-chip');
            const meanCard = meanCandiesEl?.closest('.stat-chip');
            const probCard = probHighEl?.closest('.stat-chip');
            totalCard?.classList.add('stat-highlight');
            meanCard?.classList.add('stat-highlight');
            probCard?.classList.add('stat-highlight');
            setTimeout(() => {
                totalCard?.classList.remove('stat-highlight');
                meanCard?.classList.remove('stat-highlight');
                probCard?.classList.remove('stat-highlight');
            }, 900);
        }
    }

    function addCandyHistoryEntry(entry) {
        if (!candyHistoryEl) return;
        candyHistory.unshift(entry);
        if (candyHistory.length > MAX_HISTORY) candyHistory.pop();
        renderCandyHistory();
    }

    function renderCandyHistory() {
        if (!candyHistoryEl) return;
        if (!candyHistory.length) {
            candyHistoryEl.textContent = 'No candy adventures yet. Finish a round to record it!';
            return;
        }
        candyHistoryEl.innerHTML = '';
        candyHistory.forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'candy-history-card ' + entry.decision;
            const summary = document.createElement('div');
            summary.className = 'summary';
            summary.textContent = historySummary(entry);
            const details = document.createElement('div');
            details.className = 'details';
            details.textContent = historyDetails(entry);
            card.appendChild(summary);
            card.appendChild(details);
            candyHistoryEl.appendChild(card);
        });
    }

    function historySummary(entry) {
        switch (entry.decision) {
            case 'accept':
                return `Accepted ${formatCandies(entry.offer)} offer`;
            case 'reject':
                return `Rejected offer and kept box #${entry.boxNumber}`;
            case 'swap':
                return `Swapped to box #${entry.boxNumber}`;
            default:
                return `Kept box #${entry.boxNumber}`;
        }
    }

    function historyDetails(entry) {
        const bits = [`Won ${formatCandies(entry.candiesWon)}`];
        if (entry.decision === 'accept') {
            bits.push(`Your box had ${formatCandies(entry.yourBox)}`);
        } else {
            if (entry.otherValue !== null && entry.otherValue !== undefined) {
                bits.push(`Other box ${formatCandies(entry.otherValue)}`);
            }
        }
        return bits.join(' | ');
    }

    function updateStats(sum, unopenedCount) {
        if (!totalCandiesEl) return;
        const mean = unopenedCount ? sum / unopenedCount : 0;
        totalCandiesEl.textContent = `Total: ${sum.toLocaleString()}`;
        meanCandiesEl.textContent = `EV: ${Math.round(mean).toLocaleString()}`;
        const boxesRemaining = countUnopenedBoxes();
        const highRemaining = countHighUnopened();
        const probHigh = boxesRemaining ? (highRemaining / boxesRemaining) * 100 : 0;
        probHighEl.textContent = `BIG: ${probHigh.toFixed(1)}%`;
        if (equallyNoteEl) {
            equallyNoteEl.textContent = boxesRemaining
                ? `\u{1F4A1} ${boxesRemaining} boxes left \u2022 ${highRemaining} big \u2022 all equally likely`
                : 'All candy boxes revealed!';
        }
        appendProbHistory({
            round: stage === 'offer' ? currentRound : currentRound - 1,
            opened: casesOpenedThisRound,
            highLeft: highRemaining,
            prob: probHigh.toFixed(1),
            ev: Math.round(mean)
        });
    }

    function countUnopenedBoxes() {
        let total = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) total++;
        }
        return total;
    }

    function countHighUnopened() {
        let total = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened && cases[i].money > HIGH_THRESHOLD) total++;
        }
        return total;
    }

    function appendProbHistory(entry) {
        if (!probBodyEl) return;
        if (!probBodyEl.dataset.hasData) {
            probBodyEl.innerHTML = '';
            probBodyEl.dataset.hasData = '1';
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.round || 1}</td>
            <td>${entry.opened}</td>
            <td>${entry.highLeft}</td>
            <td>${entry.prob}%</td>
            <td>${formatCandies(entry.ev)}</td>`;
        probBodyEl.insertBefore(row, probBodyEl.firstChild);
        while (probBodyEl.rows.length > MAX_HISTORY) {
            probBodyEl.deleteRow(probBodyEl.rows.length - 1);
        }
    }

    function formatCandies(val) {
        return `${val.toLocaleString()} candies`;
    }

    function getRemainingClosed() {
        let count = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened && i !== playerCase) count++;
        }
        return count;
    }

    function getRemainingClosedIndex() {
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened && i !== playerCase) return i;
        }
        return -1;
    }

    function promptSwap() {
        offerMode = 'swap';
        swapTarget = getRemainingClosedIndex();
        if (swapTarget === -1) {
            finishGame(false, 0);
            return;
        }
        offerBoxEl.classList.add('visible');
        offerTitleEl.textContent = 'SWAP BOXES?';
        offerAmountEl.textContent = `Swap for box #${swapTarget + 1}?`;
        prevOffersEl.innerHTML = '';
        dealBtnEl.textContent = 'Swap';
        nodealBtnEl.textContent = 'Keep';
    }

    function performSwap() {
        if (swapTarget === -1) return;
        playerCase = swapTarget;
        swapTarget = -1;
        renderCases();
    }

    // =============================================
    // ACTIVE MATH MODE — Challenge System
    // =============================================

    function setActiveMode(on) {
        activeMode = on;
        document.body.classList.toggle('active-math-mode', on);
        if (mathScoreEl) mathScoreEl.style.display = on ? '' : 'none';
        if (on) {
            candyStatsEl?.classList.remove('revealed');
            probTrackerEl?.classList.remove('revealed');
        } else {
            candyStatsEl?.classList.add('revealed');
            probTrackerEl?.classList.add('revealed');
        }
    }

    function updateMathScoreDisplay() {
        if (!mathScoreEl) return;
        mathScoreEl.textContent = `Math Score: ${mathScore.correct} / ${mathScore.total}`;
    }

    // Shared handler refs so we can remove them cleanly
    let _mathCheckHandler = null;
    let _mathKeyHandler = null;

    function showMathChallenge(question, checkFn, onDone) {
        if (!mathChallengeEl) return;
        stopPickTimer(); // pause timer during challenge

        const qEl = document.getElementById('math-question');
        const aEl = document.getElementById('math-answer');
        const cBtn = document.getElementById('math-check');
        const fbEl = document.getElementById('math-feedback');

        qEl.innerHTML = question;
        aEl.value = '';
        fbEl.textContent = '';
        fbEl.className = 'math-feedback';
        mathChallengeEl.style.display = '';

        // Remove previous listeners if any
        if (_mathCheckHandler) cBtn.removeEventListener('click', _mathCheckHandler);
        if (_mathKeyHandler) aEl.removeEventListener('keydown', _mathKeyHandler);

        let answered = false;

        function doCheck() {
            if (answered) return;
            const userVal = aEl.value.trim();
            if (!userVal) return;
            answered = true;
            const result = checkFn(userVal);
            mathScore.total++;
            if (result.correct) {
                mathScore.correct++;
                fbEl.className = 'math-feedback correct';
                fbEl.textContent = result.message || 'Correct!';
            } else {
                fbEl.className = 'math-feedback wrong';
                fbEl.textContent = result.message || 'Not quite.';
            }
            updateMathScoreDisplay();
            // Clean up listeners
            cBtn.removeEventListener('click', _mathCheckHandler);
            aEl.removeEventListener('keydown', _mathKeyHandler);
            _mathCheckHandler = null;
            _mathKeyHandler = null;
            // Auto-dismiss after delay
            setTimeout(() => {
                hideMathChallenge();
                if (onDone) onDone(result.correct);
            }, result.correct ? 1500 : 2500);
        }

        _mathCheckHandler = doCheck;
        _mathKeyHandler = (e) => { if (e.key === 'Enter') doCheck(); };

        cBtn.addEventListener('click', _mathCheckHandler);
        aEl.addEventListener('keydown', _mathKeyHandler);

        // Focus after a tick so the overlay is visible
        setTimeout(() => aEl.focus(), 50);
    }

    function showUngradedChallenge(question, explanation, onDone) {
        if (!mathChallengeEl) return;
        stopPickTimer();

        const qEl = document.getElementById('math-question');
        const fbEl = document.getElementById('math-feedback');

        qEl.innerHTML = question;
        fbEl.textContent = '';
        fbEl.className = 'math-feedback';
        mathChallengeEl.style.display = '';

        // Hide input row, show explanation
        const inputRow = mathChallengeEl.querySelector('.math-input-row');
        inputRow.style.display = 'none';

        fbEl.className = 'math-feedback';
        fbEl.innerHTML = explanation + '<br><em style="font-size:0.85rem;color:#ffe066;">Click anywhere to continue</em>';

        function dismiss() {
            mathChallengeEl.removeEventListener('click', dismiss);
            inputRow.style.display = '';
            hideMathChallenge();
            if (onDone) onDone();
        }
        setTimeout(() => {
            mathChallengeEl.addEventListener('click', dismiss);
        }, 300);
    }

    function hideMathChallenge() {
        if (mathChallengeEl) mathChallengeEl.style.display = 'none';
        // Restore input row visibility
        const inputRow = mathChallengeEl?.querySelector('.math-input-row');
        if (inputRow) inputRow.style.display = '';
    }

    // Pick which challenge to show after opening a box
    // Only ONE challenge every OTHER box — keeps game fun and flowing
    function showPostOpenChallenge(idx, remainingToOpen) {
        // Hide stats in active mode
        candyStatsEl?.classList.remove('revealed');
        probTrackerEl?.classList.remove('revealed');

        const rot = challengeRotation++;

        // Skip every other box — no challenge, just flush stats and go
        if (rot % 2 !== 0) {
            flushPendingStats();
            continueAfterOpen(idx);
            return;
        }

        // Pick ONE challenge type on a rotating basis
        const cycle = Math.floor(rot / 2) % 5; // 5-step cycle
        let challenge;
        switch (cycle) {
            case 0: challenge = 'total'; break;
            case 1: challenge = 'ev'; break;
            case 2: challenge = 'probability'; break;
            case 3: challenge = 'total'; break;
            case 4: challenge = 'ev'; break;
        }

        // Early game: box count instead (only first round, skip after 3-streak)
        if (boxCountStreak < 3 && currentRound <= 1 && cycle <= 1) {
            challenge = 'boxCount';
        }

        runChallengeSequence([challenge], 0, () => {
            flushPendingStats();
            setTimeout(() => {
                if (activeMode && stage !== 'finished') {
                    candyStatsEl?.classList.remove('revealed');
                    probTrackerEl?.classList.remove('revealed');
                }
                continueAfterOpen(idx);
            }, 800);
        });
    }

    function runChallengeSequence(types, index, onAllDone) {
        if (index >= types.length) {
            onAllDone();
            return;
        }
        const type = types[index];
        const next = () => runChallengeSequence(types, index + 1, onAllDone);

        switch (type) {
            case 'total': showTotalChallenge(next); break;
            case 'boxCount': showBoxCountChallenge(next); break;
            case 'ev': showEVChallenge(next); break;
            case 'probability': showProbabilityChallenge(next); break;
            default: next(); break;
        }
    }

    // --- Challenge Type 1: New Total ---
    function showTotalChallenge(onDone) {
        const currentTotal = getUnopenedSum();
        const q = `The box had <strong>${lastOpenedValue.toLocaleString()}</strong> candies.<br>` +
            `Before that, the total was <strong>${prevTotal.toLocaleString()}</strong> candies.<br><br>` +
            `What's the new total of remaining candies?`;

        showMathChallenge(q, (answer) => {
            const num = parseNumber(answer);
            if (num === currentTotal) {
                return { correct: true, message: `Correct! ${currentTotal.toLocaleString()} candies remain.` };
            }
            return { correct: false, message: `The answer is ${currentTotal.toLocaleString()}. (${prevTotal.toLocaleString()} - ${lastOpenedValue.toLocaleString()} = ${currentTotal.toLocaleString()})` };
        }, (correct) => { onDone(); });
    }

    // --- Challenge Type 2: Boxes Left ---
    function showBoxCountChallenge(onDone) {
        const totalOpened = cases.filter(c => c.opened).length;
        const correct = NUM_CASES - totalOpened; // includes player's box
        const q = `You've opened <strong>${totalOpened}</strong> boxes so far (plus your box is set aside).<br><br>` +
            `How many unopened boxes remain (including yours)?`;

        showMathChallenge(q, (answer) => {
            const num = parseNumber(answer);
            if (num === correct) {
                boxCountStreak++;
                return { correct: true, message: `Correct! ${correct} boxes remain.` };
            }
            boxCountStreak = 0;
            return { correct: false, message: `The answer is ${correct}. (${NUM_CASES} total - ${totalOpened} opened = ${correct})` };
        }, (wasCorrect) => { onDone(); });
    }

    // --- Challenge Type 3: EV ---
    function showEVChallenge(onDone) {
        const sum = getUnopenedSum();
        const count = countUnopenedBoxes();
        const ev = count > 0 ? sum / count : 0;
        const evRounded = Math.round(ev);
        const q = `Total remaining candies: <strong>${sum.toLocaleString()}</strong><br>` +
            `Unopened boxes: <strong>${count}</strong><br><br>` +
            `What's the average (mean) candy value per box?<br><small>This is also called the EV (Expected Value). Round to the nearest whole number.</small>`;

        showMathChallenge(q, (answer) => {
            const num = parseNumber(answer);
            if (Math.abs(num - evRounded) <= 1) {
                return { correct: true, message: `Correct! EV is ${evRounded.toLocaleString()} candies.` };
            }
            return { correct: false, message: `The average (EV) is ${evRounded.toLocaleString()}. (${sum.toLocaleString()} ÷ ${count} = ${evRounded.toLocaleString()})` };
        }, () => { onDone(); });
    }

    // --- Challenge Type 4: Probability ---
    function showProbabilityChallenge(onDone) {
        const count = countUnopenedBoxes();
        const high = countHighUnopened();
        const pct = count > 0 ? (high / count) * 100 : 0;
        const pctRounded = Math.round(pct * 10) / 10;
        const q = `There are <strong>${high}</strong> boxes worth more than 1,000 candies still in play,<br>` +
            `out of <strong>${count}</strong> total unopened boxes.<br><br>` +
            `What percentage chance is your box BIG?<br><small>Round to one decimal place.</small>`;

        showMathChallenge(q, (answer) => {
            const num = parseFloat(answer.replace(/[%,]/g, ''));
            if (!isNaN(num) && Math.abs(num - pctRounded) <= 1) {
                return { correct: true, message: `Correct! ${pctRounded}% chance of a BIG box.` };
            }
            return { correct: false, message: `The answer is ${pctRounded}%. (${high}/${count} × 100 = ${pctRounded}%)` };
        }, () => { onDone(); });
    }

    // --- Challenge Type 5: Offer Prediction ---
    function showOfferPredictionChallenge() {
        const bracketIdx = currentRound - 1;
        if (bracketIdx < 0 || bracketIdx >= BRACKET.length) {
            showOffer();
            return;
        }
        const lo = BRACKET[bracketIdx][0];
        const hi = BRACKET[bracketIdx][1];
        const ev = Math.round(avgUnopened);
        const loOffer = Math.round(lo * avgUnopened);
        const hiOffer = Math.round(hi * avgUnopened);

        const q = `The manager offers between <strong>${Math.round(lo * 100)}%</strong> and <strong>${Math.round(hi * 100)}%</strong> of the average this round.<br>` +
            `The average (EV = mean) is <strong>${ev.toLocaleString()}</strong> candies.<br><br>` +
            `What's the <strong>lowest</strong> possible offer?<br><small>Round to the nearest candy.</small>`;

        showMathChallenge(q, (answer) => {
            const num = parseNumber(answer);
            if (Math.abs(num - loOffer) <= 100) {
                return { correct: true, message: `Correct! Lowest offer: ${loOffer.toLocaleString()} candies. (Highest: ${hiOffer.toLocaleString()})` };
            }
            return { correct: false, message: `The lowest offer is ${loOffer.toLocaleString()} candies. (${Math.round(lo * 100)}% of ${ev.toLocaleString()} = ${loOffer.toLocaleString()})` };
        }, () => {
            showOffer();
        });
    }

    // --- Challenge Type 6: Should you accept? (ungraded) ---
    function showOfferAdviceChallenge(offer, onDone) {
        const ev = Math.round(avgUnopened);
        const diff = offer - ev;
        const aboveBelow = diff >= 0 ? 'ABOVE' : 'BELOW';
        const q = `The offer is <strong>${offer.toLocaleString()}</strong> candies.<br>` +
            `The average (EV) of remaining boxes is <strong>${ev.toLocaleString()}</strong> candies.<br><br>` +
            `Is the offer above or below the average?`;
        const explanation = `The offer is <strong>${aboveBelow}</strong> the average by ${Math.abs(diff).toLocaleString()} candies.<br>` +
            (diff >= 0
                ? 'Mathematically, accepting is a good deal!'
                : 'Mathematically, rejecting gives you higher expected value.');
        showUngradedChallenge(q, explanation, onDone);
    }

    // --- Challenge Type 7: Median ---
    function showMedianChallenge(onDone) {
        const remaining = [];
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened || i === playerCase) {
                // include player's box since it's part of remaining
            }
            if (!cases[i].opened) remaining.push(cases[i].money);
        }
        // If game just ended, we opened the player's box — use values before final reveal
        // Actually let's just gather whatever's still conceptually "remaining"
        // At game end all boxes are opened, so let's reconstruct from the last state
        // Use values that were unopened right before the final reveal
        const vals = [];
        for (let i = 0; i < NUM_CASES; i++) {
            if (i === playerCase || (cases[i].opened === false)) {
                vals.push(cases[i].money);
            }
        }
        if (vals.length < 2) {
            // Not enough for median, skip
            onDone();
            return;
        }
        vals.sort((a, b) => a - b);
        let median;
        const mid = Math.floor(vals.length / 2);
        if (vals.length % 2 === 0) {
            median = (vals[mid - 1] + vals[mid]) / 2;
        } else {
            median = vals[mid];
        }

        const listStr = vals.map(v => v.toLocaleString()).join(', ');
        const q = `Here are the values of the last remaining boxes (sorted):<br>` +
            `<strong>${listStr}</strong><br><br>` +
            `What's the median value?`;

        showMathChallenge(q, (answer) => {
            const num = parseNumber(answer);
            if (Math.abs(num - median) <= 1) {
                return { correct: true, message: `Correct! The median is ${median.toLocaleString()} candies.` };
            }
            if (vals.length % 2 === 0) {
                return { correct: false, message: `The median is ${median.toLocaleString()}. (Average of middle two: ${vals[mid - 1].toLocaleString()} and ${vals[mid].toLocaleString()})` };
            }
            return { correct: false, message: `The median is ${median.toLocaleString()} (the middle value).` };
        }, () => { onDone(); });
    }

    function showMathSummary() {
        if (!mathChallengeEl || mathScore.total === 0) return;
        const pct = Math.round((mathScore.correct / mathScore.total) * 100);
        const q = `<div style="font-size:1.3rem;margin-bottom:10px;">Game Over!</div>` +
            `You got <strong>${mathScore.correct}</strong> out of <strong>${mathScore.total}</strong> math challenges right!<br>` +
            `That's <strong>${pct}%</strong> accuracy.` +
            (pct >= 80 ? '<br><br>Amazing math skills!' :
                pct >= 50 ? '<br><br>Good effort! Keep practicing!' :
                    '<br><br>Math takes practice — you\'ll get better!');
        const explanation = '<em style="color:#ffe066;">Click anywhere to close</em>';
        showUngradedChallenge(q, explanation, () => {});
    }

    function parseNumber(str) {
        // Strip commas, "candies", whitespace, % signs
        const cleaned = str.replace(/,/g, '').replace(/candies/gi, '').replace(/%/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? -Infinity : Math.round(num);
    }

    // --- Mode select setup ---
    if (modeSelectEl) {
        modeSelectEl.addEventListener('change', () => {
            setActiveMode(modeSelectEl.value === 'active');
        });
    }

    // --- Phone ring sound (synthesized via Web Audio API) ---
    let audioCtx = null;

    function ensureAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playRingSound() {
        ensureAudioCtx();
        const ctx = audioCtx;
        const now = ctx.currentTime;

        // Ring pattern: 0.5s on, 0.25s off, 0.5s on, 0.25s off, 0.5s on (fits in 2s)
        const pattern = [
            [0, 0.4],
            [0.6, 1.0],
            [1.2, 1.6]
        ];

        pattern.forEach(([start, end]) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.value = 440;
            osc2.type = 'sine';
            osc2.frequency.value = 480;

            gain.gain.value = 0.15;

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now + start);
            osc1.stop(now + end);
            osc2.start(now + start);
            osc2.stop(now + end);
        });
    }

    // --- Game sound effects ---
    function playTone(freq, dur, type, vol) {
        ensureAudioCtx();
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

    function sndCaseOpen() { playTone(700, 0.06, 'triangle', 0.1); }
    function sndBigReveal() {
        playTone(500, 0.08, 'triangle', 0.08);
        setTimeout(() => playTone(900, 0.1, 'triangle', 0.08), 60);
    }
    function sndDeal() {
        playTone(523, 0.12, 'sine', 0.1);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
        setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 200);
    }
    function sndNoDeal() { playTone(350, 0.15, 'triangle', 0.08); }
    function sndWin() {
        playTone(523, 0.12, 'sine', 0.1);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
        setTimeout(() => playTone(784, 0.18, 'sine', 0.12), 200);
        setTimeout(() => playTone(1047, 0.25, 'sine', 0.12), 320);
    }
    function sndLose() {
        playTone(300, 0.2, 'sine', 0.08);
        setTimeout(() => playTone(220, 0.3, 'sine', 0.08), 150);
    }
    function sndWarn() { playTone(880, 0.08, 'triangle', 0.06); }

    // Crowd reaction: soft clap for opening a low-$ case (good for player)
    function sndClap() {
        ensureAudioCtx();
        const ctx = audioCtx;
        const now = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
            const bufferSize = ctx.sampleRate * 0.04;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * 0.5;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const bandpass = ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.value = 2000;
            bandpass.Q.value = 0.8;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.12, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.04);
            src.connect(bandpass);
            bandpass.connect(gain);
            gain.connect(ctx.destination);
            src.start(now + i * 0.1);
        }
    }

    // Crowd reaction: gasp for opening a high-$ case (bad for player)
    function sndGasp() {
        playTone(600, 0.08, 'sine', 0.07);
        setTimeout(() => playTone(500, 0.1, 'sine', 0.09), 50);
        setTimeout(() => playTone(380, 0.15, 'sine', 0.1), 120);
        setTimeout(() => playTone(280, 0.2, 'sine', 0.08), 220);
    }

    dealBtnEl.addEventListener('click', onDeal);
    nodealBtnEl.addEventListener('click', onNoDeal);
    newGameBtnEl.addEventListener('click', initGame);
    initGame();
})();
