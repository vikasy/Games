// Deal or No Deal
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from dealnodeal.cpp by Vikas Yadav

(function () {
    const NUM_CASES = 26;
    const NUM_ROUNDS = 11;
    const NUM_OFFERS = NUM_ROUNDS - 2; // 9 offer rounds

    const CASE_MONIES = [
        0.01, 1, 5, 10, 25, 50, 75,
        100, 200, 300, 400, 500, 750, 1000, 5000, 10000, 25000,
        50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000
    ];

    // Banker bracket per round (from original)
    const BRACKET = [
        [0.10, 0.25], [0.20, 0.35], [0.20, 0.35], [0.20, 0.35],
        [0.30, 0.45], [0.40, 0.55], [0.50, 0.65], [0.60, 0.75], [0.70, 0.85]
    ];

    // Cases to open per round (rounds 1-10)
    const NCASE_TO_OPEN = [6, 5, 4, 3, 2, 1, 1, 1, 1, 1];

    let cases = [];        // { money, opened }
    let caseStatus = [];   // tracks which money values are eliminated
    let playerCase = -1;   // 0-indexed
    let currentRound = 0;
    let casesToOpenThisRound = 0;
    let casesOpenedThisRound = 0;
    let offerList = [];
    let stage = 'select';  // select | opening | offer | finished
    let avgUnopened = 0;

    const casesGridEl = document.getElementById('cases-grid');
    const statusEl = document.getElementById('status');
    const offerBoxEl = document.getElementById('offer-box');
    const offerAmountEl = document.getElementById('offer-amount');
    const dealBtnEl = document.getElementById('deal-btn');
    const nodealBtnEl = document.getElementById('nodeal-btn');
    const newGameBtnEl = document.getElementById('new-game-btn');
    const roundInfoEl = document.getElementById('round-info');
    const prevOffersEl = document.getElementById('prev-offers');

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
        statusEl.textContent = 'Select your million-dollar briefcase!';
        statusEl.className = '';
        roundInfoEl.textContent = '';
        prevOffersEl.innerHTML = '';
        renderCases();
        renderMoneyBoard();
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
                btn.textContent = formatMoney(cases[i].money);
                btn.style.fontSize = '0.6rem';
            } else {
                btn.textContent = i + 1;
            }
            btn.addEventListener('click', () => onCaseClick(i));
            casesGridEl.appendChild(btn);
        }
        // Fill last row if needed (26 cases = 4 rows of 6 + 1 row of 2)
    }

    function renderMoneyBoard() {
        const leftEl = document.getElementById('money-left');
        const rightEl = document.getElementById('money-right');
        leftEl.innerHTML = '';
        rightEl.innerHTML = '';
        for (let i = 0; i < NUM_CASES; i++) {
            const row = document.createElement('div');
            row.className = 'money-row ' + (i < 13 ? 'money-low' : 'money-high');
            if (!caseStatus[i]) row.classList.add('eliminated');
            row.textContent = formatMoney(CASE_MONIES[i]);
            if (i < 13) leftEl.appendChild(row);
            else rightEl.appendChild(row);
        }
    }

    function onCaseClick(idx) {
        ensureAudioCtx(); // unlock audio on first user interaction
        if (stage === 'select') {
            playerCase = idx;
            stage = 'opening';
            currentRound = 1;
            casesToOpenThisRound = NCASE_TO_OPEN[0];
            casesOpenedThisRound = 0;
            updateAvg();
            renderCases();
            statusEl.textContent = `Your case is #${idx + 1}. Open ${casesToOpenThisRound} briefcases.`;
            roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound - casesOpenedThisRound} to open`;
            return;
        }

        if (stage === 'opening') {
            if (idx === playerCase || cases[idx].opened) return;
            // Open this case
            cases[idx].opened = true;
            casesOpenedThisRound++;
            // Mark money value as eliminated
            const moneyIdx = CASE_MONIES.indexOf(cases[idx].money);
            if (moneyIdx >= 0) caseStatus[moneyIdx] = false;
            updateAvg();
            renderCases();
            renderMoneyBoard();

            const remaining = casesToOpenThisRound - casesOpenedThisRound;
            if (remaining > 0) {
                statusEl.textContent = `Case #${idx + 1} had ${formatMoney(cases[idx].money)}. Open ${remaining} more.`;
                roundInfoEl.textContent = `Round ${currentRound} — ${remaining} to open`;
            } else {
                // Round complete — check if this is the last round
                if (currentRound >= NUM_OFFERS + 1) {
                    // Final round (10): reveal player's case
                    finishGame(false, 0);
                    return;
                }
                // Banker offer
                statusEl.textContent = `Case #${idx + 1} had ${formatMoney(cases[idx].money)}. The banker is calling...`;
                roundInfoEl.textContent = `Round ${currentRound} — Banker's offer`;
                stage = 'offer';
                playRingSound();
                setTimeout(showOffer, 2200); // wait for ring to finish
            }
        }
    }

    function showOffer() {
        const left = BRACKET[currentRound - 1][0];
        const right = BRACKET[currentRound - 1][1];
        const alpha = Math.random();
        const fraction = left + (right - left) * alpha;
        const offer = Math.round(fraction * avgUnopened);
        offerList.push(offer);
        offerAmountEl.textContent = '$' + offer.toLocaleString();
        offerBoxEl.classList.add('visible');
        statusEl.textContent = 'DEAL or NO DEAL?';
        prevOffersEl.innerHTML = 'Previous offers: ' +
            offerList.map((o, i) => `<span>R${i + 1}: $${o.toLocaleString()}</span>`).join(' | ');
    }

    function onDeal() {
        const offer = offerList[offerList.length - 1];
        finishGame(true, offer);
    }

    function onNoDeal() {
        offerBoxEl.classList.remove('visible');
        currentRound++;
        if (currentRound > NUM_ROUNDS - 1) {
            // No more rounds — player gets their case
            finishGame(false, 0);
            return;
        }
        casesToOpenThisRound = NCASE_TO_OPEN[currentRound - 1];
        casesOpenedThisRound = 0;
        stage = 'opening';
        statusEl.textContent = `NO DEAL! Round ${currentRound} — Open ${casesToOpenThisRound} briefcase${casesToOpenThisRound > 1 ? 's' : ''}.`;
        roundInfoEl.textContent = `Round ${currentRound} — ${casesToOpenThisRound} to open`;
    }

    function finishGame(isDeal, offer) {
        offerBoxEl.classList.remove('visible');
        stage = 'finished';
        const playerMoney = cases[playerCase].money;
        const won = isDeal ? offer : playerMoney;

        // Reveal player's case
        cases[playerCase].opened = true;
        renderCases();

        // Determine if good or bad outcome
        const isGoodOutcome = isDeal ? (offer >= playerMoney) : (playerMoney >= 50000);
        const caseBtn = casesGridEl.querySelector(`[data-idx="${playerCase}"]`);

        if (isDeal) {
            const better = offer >= playerMoney;
            statusEl.textContent = `DEAL! You won $${offer.toLocaleString()}! (Your case had ${formatMoney(playerMoney)})`;
            statusEl.className = better ? 'status-win' : 'status-lose';
        } else {
            statusEl.textContent = `You kept your case #${playerCase + 1} and won ${formatMoney(playerMoney)}!`;
            statusEl.className = isGoodOutcome ? 'status-win' : 'status-lose';
        }

        if (caseBtn) caseBtn.classList.add(isGoodOutcome ? 'won' : 'lost');
        roundInfoEl.textContent = 'Game over. Press New Game to play again.';
    }

    function updateAvg() {
        let sum = 0, count = 0;
        for (let i = 0; i < NUM_CASES; i++) {
            if (!cases[i].opened && i !== playerCase) {
                sum += cases[i].money;
                count++;
            }
        }
        // Include player's case in average
        sum += cases[playerCase >= 0 ? playerCase : 0].money;
        count++;
        avgUnopened = count > 0 ? sum / count : 0;
    }

    function formatMoney(val) {
        if (val >= 1) return '$' + val.toLocaleString();
        return '$0.01';
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
        const ringDuration = 2.0; // 2 seconds
        const ringFreq1 = 440;    // Hz (A4)
        const ringFreq2 = 480;    // Hz (B4-ish) — classic US phone ring is dual-tone

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
            osc1.frequency.value = ringFreq1;
            osc2.type = 'sine';
            osc2.frequency.value = ringFreq2;

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

    dealBtnEl.addEventListener('click', onDeal);
    nodealBtnEl.addEventListener('click', onNoDeal);
    newGameBtnEl.addEventListener('click', initGame);
    initGame();
})();
