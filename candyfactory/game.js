// Deal or No Deal
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from candyfactory.cpp by Vikas Yadav

(function () {
    const pName = typeof getActivePlayer === 'function' ? getActivePlayer() : 'You';
    const CASE_MONIES = [
        10, 20, 40, 60, 80,
        100, 200, 400, 600, 800,
        1000, 2000, 4000, 6000, 8000,
        10000, 20000, 40000, 60000, 80000,
        100000, 200000, 400000, 600000, 800000
    ];
    const NUM_CASES = CASE_MONIES.length;
    const TOTAL_SUM = CASE_MONIES.reduce((sum, value) => sum + value, 0);
    const INITIAL_EV = TOTAL_SUM / NUM_CASES;
    const MIN_EV = Math.min(...CASE_MONIES);
    const MAX_EV = Math.max(...CASE_MONIES);
    const POINTER_MIN_EV = 10;
    const POINTER_MAX_EV = MAX_EV;
    const POINTER_T = 150000;
    const POINTER_LINEAR_PORTION = 0.65;
    // Boxes to open per round (player opens 23 total, rounds 1-2 repeat)
    const NCASE_TO_OPEN = [6, 6, 4, 4, 2, 1];
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
    const CHALLENGE_POOL = [
        'total', 'ev', 'probability', 'boxCount',
        'range', 'lowCount', 'fraction', 'double',
        'halfEv', 'maxLeft', 'minLeft', 'sumTwo',
        'pctEliminated', 'oddsRatio', 'compareOffer',
        'roundedEv', 'totalOpened', 'bigSmallDiff',
        'tenPercent', 'halvesCount'
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
    let pickWarnSecond = null;

    // --- Active Math Mode state ---
    let activeMode = false; // synced from DOM in mode-select setup below
    let mathScore = { correct: 0, total: 0 };
    let boxCountStreak = 0;        // streak for type 2 (boxes left) — skip after 3 correct
    let challengeRotation = 0;     // drives challenge frequency
    let challengeDeck = [];
    let lastChallengeType = null;
    let lastOpenedValue = 0;       // value of last opened box (for challenge context)
    let prevTotal = 0;             // total before last box opened
    let pendingStatsUpdate = null; // deferred stats update { sum, count }
    let medianSnapshot = [];       // captured before final reveal for median challenge

    const casesGridEl = document.getElementById('cases-grid');
    const statusEl = document.getElementById('status');
    const offerBoxEl = document.getElementById('offer-box');
    const offerBackdropEl = document.getElementById('offer-backdrop');
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
    const mathHintBtn = document.getElementById('math-hint');
    const mathHintNoteEl = document.getElementById('math-hint-note');
    const mathScoreEl = document.getElementById('math-score');
    const modeSelectEl = document.getElementById('mode-select');
    const candyStatsEl = document.querySelector('.candy-stats');
    const probTrackerEl = document.getElementById('prob-tracker');
    const probTitleEl = document.getElementById('prob-title');
    const rulesCardEl = document.querySelector('.game-rules-card');
    const evPointerEl = document.getElementById('ev-pointer');
    const evOfferMarkersEl = document.getElementById('ev-offer-markers');
    const PROB_EMPTY_ROW_HTML = '<tr><td colspan="5" class="tracker-empty">No data yet. Reject an offer to start tracking!</td></tr>';
    let infoModalInitialized = false;
    let currentGameNumber = 0;

    // --- Persistence helpers ---
    function loadSavedState() {
        try {
            var raw = gameGet('candy_history');
            if (raw) {
                var saved = JSON.parse(raw);
                candyHistory.length = 0;
                saved.forEach(function (e) { candyHistory.push(e); });
            }
        } catch (e) {}
        try {
            var gn = gameGet('candy_game_num');
            if (gn !== null) currentGameNumber = parseInt(gn, 10) || 0;
        } catch (e) {}
        try {
            var ms = gameGet('candy_math_score');
            if (ms) {
                var parsed = JSON.parse(ms);
                mathScore.correct = parsed.correct || 0;
                mathScore.total = parsed.total || 0;
            }
        } catch (e) {}
    }

    function saveState() {
        try {
            gameSet('candy_history', JSON.stringify(candyHistory));
            gameSet('candy_game_num', String(currentGameNumber));
            gameSet('candy_math_score', JSON.stringify(mathScore));
        } catch (e) {}
    }

    function initGame() {
        currentGameNumber += 1;
        rulesCardEl?.classList.add('hidden');
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
        offerBackdropEl.classList.remove('visible');
        statusEl.textContent =
            `Pick your candy box! Total candy pool ${formatCandies(TOTAL_SUM)} (EV ${formatCandies(Math.round(INITIAL_EV))}).`;
        statusEl.className = '';
        roundInfoEl.textContent = '';
        prevOffersEl.innerHTML = '';
        resetProbabilityTracker();
        updateProbTrackerTitle();
        refillChallengeDeck();
        resetOfferMarkers();
        renderCases();
        renderMoneyBoard();
        offerMode = 'offer';
        swapTarget = -1;
        lastDecisionType = 'keep';
        stopPickTimer();
        startPickTimer();

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
        candyStatsEl?.classList.remove('revealed');
        probTrackerEl?.classList.remove('revealed');
        updateEVPointer(INITIAL_EV);
    }

    function setupInfoModal() {
        if (infoModalInitialized || !infoBtn || !infoModal) return;
        infoModalInitialized = true;
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

function resetProbabilityTracker() {
    if (!probBodyEl) return;
    probBodyEl.innerHTML = PROB_EMPTY_ROW_HTML;
    delete probBodyEl.dataset.hasData;
}

function updateProbTrackerTitle() {
    if (probTitleEl) {
        if (stage === 'landing' || currentGameNumber === 0) {
            probTitleEl.textContent = '\u{1F4CA} Probability Tracker';
        } else {
            probTitleEl.textContent = `\u{1F4CA} Probability Tracker — Game ${currentGameNumber}`;
        }
    }
}

    function resetOfferMarkers() {
        if (evOfferMarkersEl) {
            evOfferMarkersEl.innerHTML = '';
        }
    }

    function showLandingState() {
        stage = 'landing';
        rulesCardEl?.classList.remove('hidden');
        offerBackdropEl.classList.remove('visible');
        offerMode = 'offer';
        swapTarget = -1;
        lastDecisionType = 'keep';
        statusEl.textContent = '';
        statusEl.className = '';
        roundInfoEl.innerHTML = '<span style="font-size:1.4rem;">Read the rules below, then tap New Game when ready.</span>';
        prevOffersEl.innerHTML = '';
        currentRound = 0;
        casesToOpenThisRound = 0;
        casesOpenedThisRound = 0;
        offerList = [];
        cases = CASE_MONIES.map(m => ({ money: m, opened: false }));
        caseStatus = Array(NUM_CASES).fill(true);
        playerCase = -1;
        renderCases();
        renderMoneyBoard();
        stopPickTimer();
        if (pickTimerEl) pickTimerEl.textContent = '';
        resetProbabilityTracker();
        candyStatsEl?.classList.remove('revealed');
        probTrackerEl?.classList.remove('revealed');
        renderCandyHistory();
        updateEVPointer(INITIAL_EV);
        resetOfferMarkers();
        refillChallengeDeck();
        updateProbTrackerTitle();
    }

    function refillChallengeDeck() {
        challengeDeck = CHALLENGE_POOL.slice();
        for (let i = challengeDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [challengeDeck[i], challengeDeck[j]] = [challengeDeck[j], challengeDeck[i]];
        }
    }

    function drawChallengeType() {
        if (!challengeDeck.length) {
            refillChallengeDeck();
        }
        // Avoid back-to-back same type
        let type = challengeDeck.shift();
        if (type === lastChallengeType && challengeDeck.length > 0) {
            challengeDeck.push(type);
            type = challengeDeck.shift();
        }
        lastChallengeType = type;
        return type;
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

function onCaseClick(idx, autoAction = false) {
    ensureAudioCtx(); // unlock audio on first user interaction
    if (stage === 'select') {
        selectPlayerCase(idx, autoAction);
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
            showPostOpenChallenge(idx, remaining, autoAction);
        } else {
            updateAvg();
            renderCases();
            renderMoneyBoard();
            continueAfterOpen(idx, autoAction);
        }
    }
}

function continueAfterOpen(idx, autoOpened = false) {
    const remaining = casesToOpenThisRound - casesOpenedThisRound;
    const revealText = `Candy box #${idx + 1} had ${formatCandies(cases[idx].money)}.`;
    const autoNote = autoOpened ? ' Timer expired, so I opened it for you.' : '';
    if (remaining > 0) {
        statusEl.textContent = `${revealText}${autoNote} Open ${remaining} more box${remaining > 1 ? 'es' : ''}.`;
        roundInfoEl.textContent = `Round ${currentRound} — ${remaining} to open`;
        restartOpeningTimer();
    } else {
        const otherClosed = getRemainingClosed();
        if (otherClosed === 1) {
            stage = 'swap';
            statusEl.textContent = `${revealText}${autoNote} Only two boxes left. Will you swap?`;
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
        statusEl.textContent = `${revealText}${autoNote} The factory manager is calling...`;
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
            ? `Time's up! Candy box <span class="status-hl">#${idx + 1}</span> was chosen for ${pName}.`
            : `${pName}'s candy box is <span class="status-hl">#${idx + 1}</span>.`;
        statusEl.innerHTML = `${prefix} Open <span class="status-hl">${casesToOpenThisRound}</span> candy boxes.`;
        statusEl.classList.add('status-action');
        roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound - casesOpenedThisRound} to open`;
        restartOpeningTimer();
    }

function startPickTimer() {
    if (!pickTimerEl) return;
    pickTimeLeft = PICK_TIME_SECONDS;
    pickWarnSecond = null;
    pickTimerEl.textContent = `${stage === 'opening' ? 'Open a candy box' : 'Pick your candy box'} in ${pickTimeLeft}s`;
    pickTimerId = setInterval(() => {
        pickTimeLeft--;
        if (pickTimeLeft <= 0) {
            stopPickTimer();
            if (stage === 'select') {
                autoSelectPlayerCase();
            } else if (stage === 'opening') {
                autoOpenCase();
            }
        } else {
            const prompt = stage === 'opening'
                ? 'Open a candy box'
                : 'Pick your candy box';
            pickTimerEl.textContent = `${prompt} in ${pickTimeLeft}s`;
            if (pickTimeLeft <= 5 && pickWarnSecond !== pickTimeLeft) {
                pickWarnSecond = pickTimeLeft;
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

function autoOpenCase() {
    if (stage !== 'opening') return;
    if ((casesToOpenThisRound - casesOpenedThisRound) <= 0) return;
    const candidates = [];
    for (let i = 0; i < NUM_CASES; i++) {
        if (i !== playerCase && !cases[i].opened) candidates.push(i);
    }
    if (!candidates.length) return;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    onCaseClick(choice, true);
}

    function showOffer() {
        offerMode = 'offer';
        const left = BRACKET[currentRound - 1][0];
        const right = BRACKET[currentRound - 1][1];
        const alpha = Math.random();
        const fraction = left + (right - left) * alpha;
        const offer = Math.round(fraction * avgUnopened);
        offerList.push(offer);
        updateOfferMarkers();
        offerAmountEl.textContent = formatCandies(offer);
        offerBackdropEl.classList.add('visible');
        offerTitleEl.textContent = "FACTORY MANAGER'S OFFER";
        statusEl.textContent = 'ACCEPT OR REJECT?';
        prevOffersEl.innerHTML = 'Previous offers: ' +
            offerList.map((o, i) => `<span>R${i + 1}: ${formatCandies(o)}</span>`).join(' | ');
        dealBtnEl.textContent = 'Accept';
        nodealBtnEl.textContent = 'Reject';
    }

    function onDeal() {
        if (stage !== 'offer' && stage !== 'swap') return;
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
        if (stage !== 'offer' && stage !== 'swap') return;
        if (offerMode === 'offer') {
            lastDecisionType = 'reject';
            sndNoDeal();
            offerBackdropEl.classList.remove('visible');
            currentRound++;
            casesToOpenThisRound = NCASE_TO_OPEN[currentRound - 1] || 0;
            casesOpenedThisRound = 0;
            stage = 'opening';
            statusEl.innerHTML = `Keep! Round <span class="status-hl">${currentRound}</span> — Open <span class="status-hl">${casesToOpenThisRound}</span> box${casesToOpenThisRound > 1 ? 'es' : ''}.`;
            statusEl.classList.add('status-action');
            roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound} to open`;
            restartOpeningTimer();
        } else if (offerMode === 'swap') {
            lastDecisionType = 'keep';
            sndNoDeal();
            finishGame(false, 0);
        }
    }

    function finishGame(isDeal, offer) {
        offerBackdropEl.classList.remove('visible');
        stopPickTimer();
        stage = 'finished';
        offerMode = 'offer';
        swapTarget = -1;
        const playerMoney = cases[playerCase].money;

        // Snapshot remaining values for median challenge (before we open everything)
        medianSnapshot = [];
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened) medianSnapshot.push(cases[i].money);
        }

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
            statusEl.textContent = `TRADE! ${pName} accepted ${formatCandies(offer)} candies! (${pName}'s box had ${formatCandies(playerMoney)})`;
        } else {
            const tail = otherValue !== null ? ` (other box had ${formatCandies(otherValue)})` : '';
            statusEl.textContent = `${pName} kept candy box #${playerCase + 1} and won ${formatCandies(playerMoney)}!${tail}`;
        }
        roundInfoEl.textContent = 'Game over. Press New Game to play again.';

        addCandyHistoryEntry({
            decision: lastDecisionType,
            boxNumber: playerCase + 1,
            candiesWon: isDeal ? offer : playerMoney,
            yourBox: playerMoney,
            offer,
            otherValue: isDeal ? null : otherValue,
            gameNumber: currentGameNumber
        });
        saveState();
        lastDecisionType = 'keep';
        resetProbabilityTracker();
        probTrackerEl?.classList.remove('revealed');

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
    function calcEVRatio(value) {
        const min = POINTER_MIN_EV;
        const max = POINTER_MAX_EV;
        const mid = POINTER_T;
        const a = POINTER_LINEAR_PORTION;
        if (value <= min) return 0;
        if (value >= max) return 1;
        if (value <= mid) {
            return a * ((value - min) / (mid - min));
        }
        const logSpan = Math.log(max / mid);
        const portion = Math.log(value / mid) / logSpan;
        return a + (1 - a) * portion;
    }

    function updateEVPointer(value) {
        if (!evPointerEl) return;
        const clamped = Math.min(Math.max(value, POINTER_MIN_EV), POINTER_MAX_EV);
        const ratio = calcEVRatio(clamped);
        evPointerEl.style.left = `${(ratio * 100).toFixed(2)}%`;
        evPointerEl.dataset.ev = Math.round(value).toLocaleString();
    }

    function updateOfferMarkers() {
        if (!evOfferMarkersEl) return;
        evOfferMarkersEl.innerHTML = '';
        if (!offerList.length) return;
        offerList.forEach((offer, idx) => {
            const marker = document.createElement('div');
            marker.className = 'ev-offer-marker' + (idx === offerList.length - 1 ? ' latest' : '');
            const clamped = Math.min(Math.max(offer, POINTER_MIN_EV), POINTER_MAX_EV);
            const ratio = calcEVRatio(clamped);
            marker.style.left = `${(ratio * 100).toFixed(2)}%`;
            evOfferMarkersEl.appendChild(marker);
        });
    }

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
        const prefix = entry.gameNumber ? `Game ${entry.gameNumber}: ` : '';
        switch (entry.decision) {
            case 'accept':
                return `${prefix}Accepted ${formatCandies(entry.offer)} offer`;
            case 'reject':
                return `${prefix}Rejected offer and kept box #${entry.boxNumber}`;
            case 'swap':
                return `${prefix}Swapped to box #${entry.boxNumber}`;
            default:
                return `${prefix}Kept box #${entry.boxNumber}`;
        }
    }

    function historyDetails(entry) {
        const bits = [`Won ${formatCandies(entry.candiesWon)}`];
        if (entry.decision === 'accept') {
            bits.push(`${pName}'s box had ${formatCandies(entry.yourBox)}`);
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
        updateEVPointer(mean);
        const boxesRemaining = countUnopenedBoxes();
        const highRemaining = countHighUnopened();
        const probHigh = boxesRemaining ? (highRemaining / boxesRemaining) * 100 : 0;
        probHighEl.textContent = `BIG: ${probHigh.toFixed(1)}%`;
        if (equallyNoteEl) {
            equallyNoteEl.textContent = boxesRemaining
                ? `\u{1F4A1} ${boxesRemaining} boxes left \u2022 ${highRemaining} big \u2022 all equally likely`
                : 'All candy boxes revealed!';
        }

        const displayRound = Math.max(currentRound, 1);
        appendProbHistory({
            round: displayRound,
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
            <td>${entry.round ?? 1}</td>
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
        return `${val.toLocaleString()} \u{1F36C}`;
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
        offerBackdropEl.classList.add('visible');
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

    function formatScoreValue(val) {
        const rounded = Math.round(val * 10) / 10;
        return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    }

    function updateMathScoreDisplay() {
        if (!mathScoreEl) return;
        const display = formatScoreValue(mathScore.correct);
        mathScoreEl.textContent = `Math Score: ${display} / ${mathScore.total}`;
    }

    // Shared handler refs so we can remove them cleanly
    let _mathCheckHandler = null;
    let _mathKeyHandler = null;
    let _mathHintHandler = null;

    let _mathPassHandler = null;

    function showMathChallenge(question, checkFn, onDone, hintText = null) {
        if (!mathChallengeEl) return;
        stopPickTimer(); // pause timer during challenge

        const qEl = document.getElementById('math-question');
        const aEl = document.getElementById('math-answer');
        const cBtn = document.getElementById('math-check');
        const fbEl = document.getElementById('math-feedback');
        const hBtn = mathHintBtn;
        const hintNoteEl = mathHintNoteEl;
        const passBtn = document.getElementById('math-pass');

        qEl.innerHTML = question;
        aEl.value = '';
        fbEl.textContent = '';
        fbEl.className = 'math-feedback';
        mathChallengeEl.style.display = '';
        if (hintNoteEl) {
            hintNoteEl.textContent = '';
        }

        // Remove previous listeners if any
        if (_mathCheckHandler) cBtn.removeEventListener('click', _mathCheckHandler);
        if (_mathKeyHandler) aEl.removeEventListener('keydown', _mathKeyHandler);
        if (hBtn && _mathHintHandler) {
            hBtn.removeEventListener('click', _mathHintHandler);
            _mathHintHandler = null;
        }
        if (passBtn && _mathPassHandler) {
            passBtn.removeEventListener('click', _mathPassHandler);
            _mathPassHandler = null;
        }

        let answered = false;
        let hintUsed = false;

        if (hBtn) {
            if (hintText) {
                hBtn.style.display = '';
                hBtn.disabled = false;
                _mathHintHandler = () => {
                    if (hintUsed) return;
                    hintUsed = true;
                    hBtn.disabled = true;
                    if (hintNoteEl) {
                        hintNoteEl.textContent = `Hint: ${hintText}`;
                    }
                };
                hBtn.addEventListener('click', _mathHintHandler);
            } else {
                hBtn.style.display = 'none';
            }
        } else if (hintNoteEl) {
            hintNoteEl.textContent = '';
        }

        // Pass button — skip without penalty
        if (passBtn) {
            passBtn.style.display = '';
            _mathPassHandler = () => {
                if (answered) return;
                answered = true;
                cleanup();
                const result = checkFn('__PASS__');
                fbEl.className = 'math-feedback';
                fbEl.textContent = result.message || 'Skipped.';
                setTimeout(() => {
                    hideMathChallenge();
                    if (onDone) onDone(false);
                }, 1800);
            };
            passBtn.addEventListener('click', _mathPassHandler);
        }

        function cleanup() {
            cBtn.removeEventListener('click', _mathCheckHandler);
            aEl.removeEventListener('keydown', _mathKeyHandler);
            if (hBtn && _mathHintHandler) {
                hBtn.removeEventListener('click', _mathHintHandler);
                _mathHintHandler = null;
            }
            if (passBtn && _mathPassHandler) {
                passBtn.removeEventListener('click', _mathPassHandler);
                _mathPassHandler = null;
            }
            _mathCheckHandler = null;
            _mathKeyHandler = null;
        }

        function doCheck() {
            if (answered) return;
            const userVal = aEl.value.trim();
            if (!userVal) return;
            answered = true;
            const result = checkFn(userVal);
            mathScore.total++;
            if (result.correct) {
                const earned = hintUsed ? 0.5 : 1;
                mathScore.correct += earned;
                fbEl.className = 'math-feedback correct';
                const baseMsg = result.message || 'Correct!';
                fbEl.textContent = hintUsed ? `${baseMsg} (Hint used: +0.5 point)` : baseMsg;
            } else {
                fbEl.className = 'math-feedback wrong';
                fbEl.textContent = result.message || 'Not quite.';
            }
            updateMathScoreDisplay();
            cleanup();
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
        if (mathHintBtn) {
            mathHintBtn.style.display = 'none';
            mathHintBtn.disabled = true;
        }
        if (mathHintNoteEl) mathHintNoteEl.textContent = '';
        if (_mathHintHandler && mathHintBtn) {
            mathHintBtn.removeEventListener('click', _mathHintHandler);
            _mathHintHandler = null;
        }

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
function showPostOpenChallenge(idx, remainingToOpen, autoOpened = false) {
        // Hide stats in active mode
        candyStatsEl?.classList.remove('revealed');
        probTrackerEl?.classList.remove('revealed');

        const rot = challengeRotation++;

        // Show challenge every 4th box (at least 3 boxes apart)
        if (rot % 4 !== 0) {
            flushPendingStats();
            continueAfterOpen(idx, autoOpened);
            return;
        }

        let challenge = drawChallengeType();

        // Early game: box count instead (only first round, skip after 3-streak)
        if (boxCountStreak < 3 && currentRound <= 1) {
            challenge = 'boxCount';
        }

        runChallengeSequence([challenge], 0, () => {
            flushPendingStats();
            setTimeout(() => {
                if (activeMode && stage !== 'finished') {
                    candyStatsEl?.classList.remove('revealed');
                    probTrackerEl?.classList.remove('revealed');
                }
                continueAfterOpen(idx, autoOpened);
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

        const challengeFn = CHALLENGE_FNS[type];
        if (challengeFn) { challengeFn(next); } else { next(); }
    }

    function getUnopenedValues() {
        return cases.filter(c => !c.opened).map(c => c.money);
    }
    function getOpenedValues() {
        return cases.filter(c => c.opened).map(c => c.money);
    }

    // --- Challenge: Range (max - min of remaining) ---
    function showRangeChallenge(onDone) {
        const vals = getUnopenedValues();
        const mx = Math.max(...vals), mn = Math.min(...vals);
        const ans = mx - mn;
        const q = `The highest remaining candy value is <strong>${mx.toLocaleString()}</strong>.<br>` +
            `The lowest is <strong>${mn.toLocaleString()}</strong>.<br><br>What's the range (highest minus lowest)?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `The range is ${ans.toLocaleString()}. (${mx.toLocaleString()} - ${mn.toLocaleString()})` };
            return parseNumber(a) === ans
                ? { correct: true, message: `Correct! The range is ${ans.toLocaleString()}.` }
                : { correct: false, message: `The range is ${ans.toLocaleString()}. (${mx.toLocaleString()} - ${mn.toLocaleString()})` };
        }, () => onDone(), 'Subtract the smallest remaining value from the largest.');
    }

    // --- Challenge: Count low boxes (≤ 1000) ---
    function showLowCountChallenge(onDone) {
        const vals = getUnopenedValues();
        const low = vals.filter(v => v <= 1000).length;
        const count = vals.length;
        const q = `Out of <strong>${count}</strong> unopened boxes, how many have <strong>1,000 or fewer</strong> candies?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `There are ${low} small boxes (≤ 1,000).` };
            return parseNumber(a) === low
                ? { correct: true, message: `Correct! ${low} boxes have 1,000 or fewer candies.` }
                : { correct: false, message: `There are ${low} small boxes (≤ 1,000).` };
        }, () => onDone(), 'Count the boxes on the board with values of 1,000 or less.');
    }

    // --- Challenge: Fraction simplification ---
    function showFractionChallenge(onDone) {
        const count = countUnopenedBoxes();
        const high = countHighUnopened();
        function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
        const g = gcd(high, count);
        const numSimp = high / g, denSimp = count / g;
        const q = `<strong>${high}</strong> out of <strong>${count}</strong> boxes are BIG (> 1,000 candies).<br><br>` +
            `Simplify the fraction ${high}/${count}.<br><small>Write as a/b (e.g. 3/5)</small>`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Simplified: ${numSimp}/${denSimp}` };
            const parts = a.replace(/\s/g, '').split('/');
            if (parts.length === 2 && parseInt(parts[0]) === numSimp && parseInt(parts[1]) === denSimp) {
                return { correct: true, message: `Correct! ${numSimp}/${denSimp}` };
            }
            return { correct: false, message: `Simplified: ${numSimp}/${denSimp}` };
        }, () => onDone(), 'Find the biggest number that divides both top and bottom evenly.');
    }

    // --- Challenge: Double a value ---
    function showDoubleChallenge(onDone) {
        const val = lastOpenedValue;
        const ans = val * 2;
        const q = `The last box had <strong>${val.toLocaleString()}</strong> candies.<br><br>` +
            `What's <strong>double</strong> that amount?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Double ${val.toLocaleString()} = ${ans.toLocaleString()}` };
            return parseNumber(a) === ans
                ? { correct: true, message: `Correct! ${ans.toLocaleString()} candies.` }
                : { correct: false, message: `Double ${val.toLocaleString()} = ${ans.toLocaleString()}` };
        }, () => onDone(), 'Multiply the value by 2.');
    }

    // --- Challenge: Half of EV ---
    function showHalfEvChallenge(onDone) {
        const sum = getUnopenedSum();
        const count = countUnopenedBoxes();
        const ev = count > 0 ? sum / count : 0;
        const half = Math.round(ev / 2);
        const tol = Math.max(250, Math.round(half * 0.05));
        const q = `The current EV (average) is about <strong>${Math.round(ev).toLocaleString()}</strong> candies.<br><br>` +
            `What's <strong>half</strong> of the EV?<br><small>A close estimate is fine.</small>`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Half the EV is about ${half.toLocaleString()}.` };
            return Math.abs(parseNumber(a) - half) <= tol
                ? { correct: true, message: `Correct! About ${half.toLocaleString()} candies.` }
                : { correct: false, message: `Half the EV is about ${half.toLocaleString()}.` };
        }, () => onDone(), 'Divide the EV by 2.');
    }

    // --- Challenge: What's the highest value left? ---
    function showMaxLeftChallenge(onDone) {
        const vals = getUnopenedValues();
        const mx = Math.max(...vals);
        const q = `Look at the money boards.<br><br>What's the <strong>highest</strong> candy value still in play?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `The highest is ${mx.toLocaleString()}.` };
            return parseNumber(a) === mx
                ? { correct: true, message: `Correct! ${mx.toLocaleString()} is the biggest prize still in play.` }
                : { correct: false, message: `The highest is ${mx.toLocaleString()}.` };
        }, () => onDone(), 'Check the money boards for the largest value not crossed out.');
    }

    // --- Challenge: What's the lowest value left? ---
    function showMinLeftChallenge(onDone) {
        const vals = getUnopenedValues();
        const mn = Math.min(...vals);
        const q = `Look at the money boards.<br><br>What's the <strong>lowest</strong> candy value still in play?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `The lowest is ${mn.toLocaleString()}.` };
            return parseNumber(a) === mn
                ? { correct: true, message: `Correct! ${mn.toLocaleString()} is the smallest still in play.` }
                : { correct: false, message: `The lowest is ${mn.toLocaleString()}.` };
        }, () => onDone(), 'Check the money boards for the smallest value not crossed out.');
    }

    // --- Challenge: Add two opened values ---
    function showSumTwoChallenge(onDone) {
        const opened = getOpenedValues();
        if (opened.length < 2) { onDone(); return; }
        const i1 = Math.floor(Math.random() * opened.length);
        let i2 = Math.floor(Math.random() * opened.length);
        while (i2 === i1 && opened.length > 1) i2 = Math.floor(Math.random() * opened.length);
        const v1 = opened[i1], v2 = opened[i2];
        const ans = v1 + v2;
        const q = `Two boxes you've opened had <strong>${v1.toLocaleString()}</strong> and <strong>${v2.toLocaleString()}</strong> candies.<br><br>` +
            `What's their sum?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `${v1.toLocaleString()} + ${v2.toLocaleString()} = ${ans.toLocaleString()}` };
            return parseNumber(a) === ans
                ? { correct: true, message: `Correct! ${ans.toLocaleString()} candies total.` }
                : { correct: false, message: `${v1.toLocaleString()} + ${v2.toLocaleString()} = ${ans.toLocaleString()}` };
        }, () => onDone(), 'Add the two values together.');
    }

    // --- Challenge: Percentage of boxes eliminated ---
    function showPctEliminatedChallenge(onDone) {
        const opened = cases.filter(c => c.opened).length;
        const pct = Math.round((opened / NUM_CASES) * 100);
        const q = `You've opened <strong>${opened}</strong> out of <strong>${NUM_CASES}</strong> total boxes.<br><br>` +
            `What percentage of boxes have been eliminated?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `${pct}% eliminated. (${opened}/${NUM_CASES} × 100)` };
            const num = parseFloat(a.replace(/[%,]/g, ''));
            return (!isNaN(num) && Math.abs(num - pct) <= 2)
                ? { correct: true, message: `Correct! ${pct}% of boxes eliminated.` }
                : { correct: false, message: `${pct}% eliminated. (${opened}/${NUM_CASES} × 100)` };
        }, () => onDone(), 'Divide opened boxes by total boxes, then multiply by 100.');
    }

    // --- Challenge: Odds ratio (big : small) ---
    function showOddsRatioChallenge(onDone) {
        const vals = getUnopenedValues();
        const big = vals.filter(v => v > 1000).length;
        const small = vals.filter(v => v <= 1000).length;
        if (small === 0 || big === 0) { onDone(); return; }
        const q = `There are <strong>${big}</strong> BIG boxes and <strong>${small}</strong> small boxes remaining.<br><br>` +
            `What are the odds of picking a BIG box?<br><small>Write as big:small (e.g. 3:2)</small>`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Odds are ${big}:${small} in favor of BIG.` };
            const parts = a.replace(/\s/g, '').split(':');
            if (parts.length === 2) {
                const r1 = parseInt(parts[0]), r2 = parseInt(parts[1]);
                if (r1 * small === r2 * big) return { correct: true, message: `Correct! ${big}:${small} odds for BIG.` };
            }
            return { correct: false, message: `Odds are ${big}:${small} in favor of BIG.` };
        }, () => onDone(), 'Write the number of BIG boxes, then a colon, then the number of small boxes.');
    }

    // --- Challenge: Is the last offer above or below EV? ---
    function showCompareOfferChallenge(onDone) {
        if (offerList.length === 0) { onDone(); return; }
        const lastOffer = offerList[offerList.length - 1];
        const ev = Math.round(avgUnopened);
        const relation = lastOffer > ev ? 'above' : lastOffer < ev ? 'below' : 'equal to';
        const q = `The last offer was <strong>${lastOffer.toLocaleString()}</strong> candies.<br>` +
            `The current EV is about <strong>${ev.toLocaleString()}</strong>.<br><br>` +
            `Was the offer <strong>above</strong> or <strong>below</strong> the EV?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `The offer was ${relation} the EV.` };
            const lower = a.toLowerCase().trim();
            if (lower === relation || (relation === 'equal to' && (lower === 'equal' || lower === 'same'))) {
                return { correct: true, message: `Correct! The offer was ${relation} the EV.` };
            }
            return { correct: false, message: `The offer was ${relation} the EV.` };
        }, () => onDone(), 'Compare the offer number to the EV number. Which is bigger?');
    }

    // --- Challenge: Round EV to nearest thousand ---
    function showRoundedEvChallenge(onDone) {
        const sum = getUnopenedSum();
        const count = countUnopenedBoxes();
        const ev = count > 0 ? sum / count : 0;
        const rounded = Math.round(ev / 1000) * 1000;
        const q = `The exact EV is about <strong>${Math.round(ev).toLocaleString()}</strong> candies.<br><br>` +
            `Round this to the nearest <strong>thousand</strong>.`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Rounded to nearest thousand: ${rounded.toLocaleString()}` };
            return parseNumber(a) === rounded
                ? { correct: true, message: `Correct! ${rounded.toLocaleString()} candies.` }
                : { correct: false, message: `Rounded to nearest thousand: ${rounded.toLocaleString()}` };
        }, () => onDone(), 'Look at the hundreds digit. 500+ rounds up, below 500 rounds down.');
    }

    // --- Challenge: How many total candies have been eliminated? ---
    function showTotalOpenedChallenge(onDone) {
        const openedSum = getOpenedValues().reduce((s, v) => s + v, 0);
        const q = `Think about all the boxes you've opened so far.<br><br>` +
            `What's the <strong>total</strong> of all eliminated candy values?<br><small>Hint: Total start was ${TOTAL_SUM.toLocaleString()}. Current remaining is ${getUnopenedSum().toLocaleString()}.</small>`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Total eliminated: ${openedSum.toLocaleString()}. (${TOTAL_SUM.toLocaleString()} - ${getUnopenedSum().toLocaleString()})` };
            return parseNumber(a) === openedSum
                ? { correct: true, message: `Correct! ${openedSum.toLocaleString()} candies eliminated.` }
                : { correct: false, message: `Total eliminated: ${openedSum.toLocaleString()}. (${TOTAL_SUM.toLocaleString()} - ${getUnopenedSum().toLocaleString()})` };
        }, () => onDone(), 'Subtract the current remaining total from the starting total.');
    }

    // --- Challenge: Difference between big and small box counts ---
    function showBigSmallDiffChallenge(onDone) {
        const vals = getUnopenedValues();
        const big = vals.filter(v => v > 1000).length;
        const small = vals.filter(v => v <= 1000).length;
        const diff = Math.abs(big - small);
        const more = big > small ? 'BIG' : big < small ? 'small' : 'equal';
        const q = `There are <strong>${big}</strong> BIG boxes (> 1,000) and <strong>${small}</strong> small boxes (≤ 1,000).<br><br>` +
            `How many <strong>more</strong> ${more === 'equal' ? 'of one type' : more + ' boxes'} are there?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `Difference: ${diff}. (${big} BIG vs ${small} small)` };
            return parseNumber(a) === diff
                ? { correct: true, message: `Correct! ${diff} more ${more} boxes.` }
                : { correct: false, message: `Difference: ${diff}. (${Math.max(big, small)} - ${Math.min(big, small)})` };
        }, () => onDone(), 'Subtract the smaller count from the larger count.');
    }

    // --- Challenge: 10% of remaining total ---
    function showTenPercentChallenge(onDone) {
        const sum = getUnopenedSum();
        const ans = Math.round(sum / 10);
        const q = `The total remaining candies is <strong>${sum.toLocaleString()}</strong>.<br><br>` +
            `What's <strong>10%</strong> of that total?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `10% of ${sum.toLocaleString()} = ${ans.toLocaleString()}` };
            return Math.abs(parseNumber(a) - ans) <= 1
                ? { correct: true, message: `Correct! ${ans.toLocaleString()} candies.` }
                : { correct: false, message: `10% of ${sum.toLocaleString()} = ${ans.toLocaleString()}` };
        }, () => onDone(), 'Move the decimal point one place to the left (divide by 10).');
    }

    // --- Challenge: How many boxes in each half (above/below median)? ---
    function showHalvesCountChallenge(onDone) {
        const vals = getUnopenedValues().sort((a, b) => a - b);
        const mid = vals[Math.floor(vals.length / 2)];
        const below = vals.filter(v => v < mid).length;
        const above = vals.filter(v => v > mid).length;
        const q = `There are <strong>${vals.length}</strong> unopened boxes.<br>` +
            `The middle value (median) is about <strong>${mid.toLocaleString()}</strong>.<br><br>` +
            `How many boxes are worth <strong>more</strong> than ${mid.toLocaleString()}?`;
        showMathChallenge(q, (a) => {
            if (a === '__PASS__') return { correct: false, message: `${above} boxes are above the median.` };
            return parseNumber(a) === above
                ? { correct: true, message: `Correct! ${above} boxes above the median.` }
                : { correct: false, message: `${above} boxes are above the median.` };
        }, () => onDone(), 'Count values strictly greater than the median.');
    }

    const CHALLENGE_FNS = {
        total: showTotalChallenge,
        boxCount: showBoxCountChallenge,
        ev: showEVChallenge,
        probability: showProbabilityChallenge,
        range: showRangeChallenge,
        lowCount: showLowCountChallenge,
        fraction: showFractionChallenge,
        double: showDoubleChallenge,
        halfEv: showHalfEvChallenge,
        maxLeft: showMaxLeftChallenge,
        minLeft: showMinLeftChallenge,
        sumTwo: showSumTwoChallenge,
        pctEliminated: showPctEliminatedChallenge,
        oddsRatio: showOddsRatioChallenge,
        compareOffer: showCompareOfferChallenge,
        roundedEv: showRoundedEvChallenge,
        totalOpened: showTotalOpenedChallenge,
        bigSmallDiff: showBigSmallDiffChallenge,
        tenPercent: showTenPercentChallenge,
        halvesCount: showHalvesCountChallenge
    };

    // --- Challenge Type 1: New Total ---
    function showTotalChallenge(onDone) {
        const currentTotal = getUnopenedSum();
        const q = `The box had <strong>${lastOpenedValue.toLocaleString()}</strong> candies.<br>` +
            `Before that, the total was <strong>${prevTotal.toLocaleString()}</strong> candies.<br><br>` +
            `What's the new total of remaining candies?`;

        showMathChallenge(q, (answer) => {
            if (answer === '__PASS__') return { correct: false, message: `The answer is ${currentTotal.toLocaleString()}. (${prevTotal.toLocaleString()} - ${lastOpenedValue.toLocaleString()})` };
            const num = parseNumber(answer);
            if (num === currentTotal) {
                return { correct: true, message: `Correct! ${currentTotal.toLocaleString()} candies remain.` };
            }
            return { correct: false, message: `The answer is ${currentTotal.toLocaleString()}. (${prevTotal.toLocaleString()} - ${lastOpenedValue.toLocaleString()})` };
        }, (correct) => { onDone(); }, 'Subtract the opened box value from the previous total.');
    }

    // --- Challenge Type 2: Boxes Left ---
    function showBoxCountChallenge(onDone) {
        const totalOpened = cases.filter(c => c.opened).length;
        const correct = NUM_CASES - totalOpened; // includes player's box
        const q = `You've opened <strong>${totalOpened}</strong> boxes so far (plus your box is set aside).<br><br>` +
            `How many unopened boxes remain (including yours)?`;

        showMathChallenge(q, (answer) => {
            if (answer === '__PASS__') { boxCountStreak = 0; return { correct: false, message: `The answer is ${correct}. (${NUM_CASES} - ${totalOpened} = ${correct})` }; }
            const num = parseNumber(answer);
            if (num === correct) {
                boxCountStreak++;
                return { correct: true, message: `Correct! ${correct} boxes remain.` };
            }
            boxCountStreak = 0;
            return { correct: false, message: `The answer is ${correct}. (${NUM_CASES} - ${totalOpened} = ${correct})` };
        }, (wasCorrect) => { onDone(); }, 'Start with 25 boxes and subtract the ones you have opened.');
    }

    // --- Challenge Type 3: EV ---
    function showEVChallenge(onDone) {
        const sum = getUnopenedSum();
        const count = countUnopenedBoxes();
        const ev = count > 0 ? sum / count : 0;
        const evRounded = Math.round(ev);
        // Allow approximate answers — within 5% or 500, whichever is larger
        const tolerance = Math.max(500, Math.round(evRounded * 0.05));
        const q = `Total remaining candies: <strong>${sum.toLocaleString()}</strong><br>` +
            `Unopened boxes: <strong>${count}</strong><br><br>` +
            `What's the approximate average (mean) candy value per box?<br><small>This is the EV (Expected Value). A close estimate is fine!</small>`;

        showMathChallenge(q, (answer) => {
            if (answer === '__PASS__') return { correct: false, message: `The average (EV) is ${evRounded.toLocaleString()}. (${sum.toLocaleString()} ÷ ${count})` };
            const num = parseNumber(answer);
            if (Math.abs(num - evRounded) <= tolerance) {
                return { correct: true, message: `Correct! EV is about ${evRounded.toLocaleString()} candies.` };
            }
            return { correct: false, message: `The average (EV) is ${evRounded.toLocaleString()}. (${sum.toLocaleString()} ÷ ${count})` };
        }, () => { onDone(); }, 'Divide the remaining total candies by the number of unopened boxes. A close estimate counts!');
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
            if (answer === '__PASS__') return { correct: false, message: `The answer is ${pctRounded}%. (${high}/${count} × 100)` };
            const num = parseFloat(answer.replace(/[%,]/g, ''));
            if (!isNaN(num) && Math.abs(num - pctRounded) <= 2) {
                return { correct: true, message: `Correct! ${pctRounded}% chance of a BIG box.` };
            }
            return { correct: false, message: `The answer is ${pctRounded}%. (${high}/${count} × 100)` };
        }, () => { onDone(); }, 'Take big boxes left ÷ total boxes left, then multiply by 100.');
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
            if (answer === '__PASS__') return { correct: false, message: `The lowest offer is ${loOffer.toLocaleString()}. (${Math.round(lo * 100)}% of ${ev.toLocaleString()})` };
            const num = parseNumber(answer);
            if (Math.abs(num - loOffer) <= 100) {
                return { correct: true, message: `Correct! Lowest offer: ${loOffer.toLocaleString()} candies. (Highest: ${hiOffer.toLocaleString()})` };
            }
            return { correct: false, message: `The lowest offer is ${loOffer.toLocaleString()}. (${Math.round(lo * 100)}% of ${ev.toLocaleString()})` };
        }, () => {
            showOffer();
        }, 'Multiply the lower percentage for this round by the EV to get the lowest offer.');
    }

    // --- Challenge Type 7: Median ---
    // Called from finishGame with pre-captured values (before final reveal opens all boxes)
    function showMedianChallenge(onDone) {
        const vals = medianSnapshot;
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
            if (answer === '__PASS__') return { correct: false, message: `The median is ${median.toLocaleString()}.` };
            const num = parseNumber(answer);
            if (Math.abs(num - median) <= 1) {
                return { correct: true, message: `Correct! The median is ${median.toLocaleString()} candies.` };
            }
            if (vals.length % 2 === 0) {
                return { correct: false, message: `The median is ${median.toLocaleString()}. (Average of middle two: ${vals[mid - 1].toLocaleString()} and ${vals[mid].toLocaleString()})` };
            }
            return { correct: false, message: `The median is ${median.toLocaleString()} (the middle value).` };
        }, () => { onDone(); }, 'Sort the values. If you have an odd number, pick the middle one; if even, average the two middle numbers.');
    }

    function showMathSummary() {
        if (!mathChallengeEl || mathScore.total === 0) return;
        const pct = Math.round((mathScore.correct / mathScore.total) * 100);
        const correctDisplay = formatScoreValue(mathScore.correct);
        const q = `<div style="font-size:1.3rem;margin-bottom:10px;">Game Over!</div>` +
            `${pName} got <strong>${correctDisplay}</strong> out of <strong>${mathScore.total}</strong> math challenges right!<br>` +
            `That's <strong>${pct}%</strong> accuracy.` +
            (pct >= 80 ? '<br><br>Amazing math skills!' :
                pct >= 50 ? '<br><br>Good effort! Keep practicing!' :
                    '<br><br>Math takes practice — you\'ll get better!');
        const explanation = '<em style="color:#ffe066;">Click anywhere to close</em>';
        showUngradedChallenge(q, explanation, () => {});
    }

    function parseNumber(str) {
        // Strip commas, "candies", whitespace, % signs
        const cleaned = str.replace(/,/g, '').replace(/candies/gi, '').replace(/\u{1F36C}/gu, '').replace(/%/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? -Infinity : Math.round(num);
    }

    // --- Mode select setup ---
    if (modeSelectEl) {
        modeSelectEl.addEventListener('change', () => {
            setActiveMode(modeSelectEl.value === 'active');
        });
        setActiveMode(modeSelectEl.value === 'active');
    }

    // --- Phone ring sound (synthesized via Web Audio API) ---
    let audioCtx = null;

    function ensureAudioCtx() {
        if (!audioCtx) {
            audioCtx = window._audioBlessed || new (window.AudioContext || window.webkitAudioContext)();
            window.audioCtx = audioCtx;
        }
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
    setupInfoModal();
    loadSavedState();
    renderCandyHistory();
    showLandingState();
})();
