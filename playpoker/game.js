// Texas Hold'em Poker — hand evaluation engine + betting
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from PlayPoker.c by Vikas Yadav

(function () {
    const SUITS = ['heart', 'spade', 'club', 'diamond'];
    const SUIT_SYMBOLS = { heart: '\u2665', spade: '\u2660', club: '\u2663', diamond: '\u2666' };
    const FACE_NAMES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const FACE_WORDS = ['Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Jack','Queen','King','Ace'];
    const FACE_PLURALS = ['Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens','Jacks','Queens','Kings','Aces'];
    const RANK_NAMES = [
        'Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House',
        'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card'
    ];

    const NUM_PLAYERS = 4;
    const PLAYER_NAMES = ['You', 'Alice', 'Bob', 'Charlie'];
    const STARTING_CHIPS = 1000;
    const SMALL_BLIND = 10;
    const BIG_BLIND = 20;
    const AI_DELAY = 500;

    let deck, communityCards, players, stage, pot, dealerIdx;
    let currentBet, currentPlayerIdx, bettingRoundOver;
    let handInProgress = false;
    let gameOver = false;
    let topOfDeck = 0;
    let raisesThisRound = 0;
    const MAX_RAISES_PER_ROUND = 5;
    let difficulty = 'easy';       // 'easy', 'medium', 'hard'
    let mcSmartPlayer = -1;        // medium mode: which AI uses MC this hand
    const MC_AI_SIMS = 1000;       // simulations for AI Monte Carlo
    let lastHandWinners = [];
    let lastTieBreakNotes = [];

    const tableEl = document.querySelector('.table');
    const communityCardsEl = document.getElementById('community-cards');
    const playersEl = document.getElementById('players');
    const statusEl = document.getElementById('status');
    const potEl = document.getElementById('pot-display');
    const tieBreakEl = document.getElementById('tie-break-info');
    const dealBtn = document.getElementById('deal-btn');
    const actionsEl = document.getElementById('actions');
    const foldBtn = document.getElementById('fold-btn');
    const checkBtn = document.getElementById('check-btn');
    const callBtn = document.getElementById('call-btn');
    const raiseBtn = document.getElementById('raise-btn');
    const raiseInput = document.getElementById('raise-amount');
    const difficultySelect = document.getElementById('difficulty-select');
    const rankingsBtn = document.getElementById('rankings-btn');
    const rankingsOverlay = document.getElementById('rankings-overlay');
    const rankingsClose = document.getElementById('rankings-close');
    const rankingsTabButtons = document.querySelectorAll('.rankings-tab-btn');
    const rankingTabPanels = {
        hand: document.getElementById('rankings-tab-hand'),
        tie: document.getElementById('rankings-tab-tie')
    };

    function faceWord(val) {
        return FACE_WORDS[val] || FACE_NAMES[val] || String(val);
    }

    function facePlural(val) {
        return FACE_PLURALS[val] || `${faceWord(val)}s`;
    }

    function setTieBreakInfo(text) {
        if (!tieBreakEl) return;
        if (text) {
            tieBreakEl.textContent = text;
            tieBreakEl.style.display = 'block';
        } else {
            tieBreakEl.textContent = '';
            tieBreakEl.style.display = 'none';
        }
    }

    function activateRankingTab(tab) {
        const panels = Object.values(rankingTabPanels).filter(Boolean);
        if (!panels.length) return;
        Array.from(rankingsTabButtons).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        Object.keys(rankingTabPanels).forEach(key => {
            const panel = rankingTabPanels[key];
            if (panel) panel.classList.toggle('active', key === tab);
        });
    }

    if (Object.values(rankingTabPanels).some(Boolean)) {
        activateRankingTab('hand');
    }

    // --- Initialization ---
    function init() {
        dealerIdx = -1; // will become 0 on first deal
        players = PLAYER_NAMES.map((name, i) => ({
            name, hole: [], rank: null, rankVal: 10, best5: [],
            chips: STARTING_CHIPS, currentBet: 0, folded: false, allIn: false,
            isDealer: false, busted: false, totalContribution: 0
        }));
        gameOver = false;
        lastTieBreakNotes = [];
        setTieBreakInfo('');
        statusEl.textContent = 'Press Deal to start a new hand.';
        dealBtn.style.display = '';
        dealBtn.disabled = false;
        hideActions();
        pot = 0;
        renderAll();
    }

    function shuffleDeck() {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    function dealCard() { return deck[topOfDeck++]; }

    // --- Deal a new hand ---
    function dealNewHand() {
        if (gameOver) return;
        ensureAudio();
        sndDeal();
        lastTieBreakNotes = [];
        setTieBreakInfo('');

        deck = [];
        for (let s = 0; s < 4; s++)
            for (let f = 0; f < 13; f++)
                deck.push({ face: f, suit: SUITS[s] });
        topOfDeck = 0;
        shuffleDeck();

        communityCards = [];
        pot = 0;
        currentBet = 0;

        // Rotate dealer
        dealerIdx = nextActivePlayer(dealerIdx);
        players.forEach((p, i) => {
            p.hole = [];
            p.rank = null;
            p.rankVal = 10;
            p.best5 = [];
            p.currentBet = 0;
            p.folded = false;
            p.allIn = false;
            p.isDealer = (i === dealerIdx);
            p.totalContribution = 0;
        });

        // Deal 2 hole cards to active (non-busted) players
        for (let round = 0; round < 2; round++)
            for (let i = 0; i < NUM_PLAYERS; i++)
                if (!players[i].busted) players[i].hole.push(dealCard());

        handInProgress = true;
        lastHandWinners = [];
        dealBtn.style.display = 'none';
        stage = 0; // pre-flop
        markAllUnacted();

        // Set difficulty and pick smart AI for medium mode
        difficulty = difficultySelect.value;
        if (difficulty === 'medium') {
            // Pick one random non-busted AI player to use MC
            const aiCandidates = [];
            for (let i = 1; i < NUM_PLAYERS; i++)
                if (!players[i].busted) aiCandidates.push(i);
            mcSmartPlayer = aiCandidates.length > 0
                ? aiCandidates[Math.floor(Math.random() * aiCandidates.length)]
                : -1;
        } else {
            mcSmartPlayer = -1;
        }

        // Post blinds
        const sbIdx = nextActivePlayer(dealerIdx);
        const bbIdx = nextActivePlayer(sbIdx);
        const sbAmount = postBlind(sbIdx, SMALL_BLIND);
        const bbAmount = postBlind(bbIdx, BIG_BLIND);
        currentBet = Math.max(sbAmount, bbAmount);

        difficultySelect.disabled = true;
        statusEl.textContent = 'Pre-flop betting.';
        renderAll();

        // First to act pre-flop is after big blind
        currentPlayerIdx = nextActivePlayer(bbIdx);
        startBettingRound();
    }

    function postBlind(idx, amount) {
        const p = players[idx];
        const actual = Math.min(amount, p.chips);
        p.chips -= actual;
        p.currentBet = actual;
        p.totalContribution += actual;
        pot += actual;
        if (p.chips === 0) p.allIn = true;
        return actual;
    }

    // --- Active player helpers ---
    function nextActivePlayer(fromIdx) {
        let idx = (fromIdx + 1) % NUM_PLAYERS;
        let count = 0;
        while ((players[idx].busted || players[idx].folded || players[idx].allIn) && count < NUM_PLAYERS) {
            idx = (idx + 1) % NUM_PLAYERS;
            count++;
        }
        return idx;
    }

    function activePlayers() {
        return players.filter(p => !p.busted && !p.folded);
    }

    function activeNonAllInPlayers() {
        return players.filter(p => !p.busted && !p.folded && !p.allIn);
    }

    function playersStillInHand() {
        return players.filter(p => !p.busted && !p.folded);
    }

    // --- Betting round ---
    function startBettingRound() {
        bettingRoundOver = false;
        raisesThisRound = 0;
        advanceAction();
    }

    function advanceAction() {
        // Check if only one player left (everyone else folded)
        const inHand = playersStillInHand();
        if (inHand.length === 1) {
            winByFold(inHand[0]);
            return;
        }

        // Check if betting round is complete: all active non-all-in players have matched currentBet
        if (isBettingRoundComplete()) {
            endBettingRound();
            return;
        }

        // Skip busted, folded, all-in players
        if (players[currentPlayerIdx].busted || players[currentPlayerIdx].folded || players[currentPlayerIdx].allIn) {
            currentPlayerIdx = nextActivePlayer(currentPlayerIdx);
        }

        renderAll();

        if (currentPlayerIdx === 0 && !players[0].busted && !players[0].folded && !players[0].allIn) {
            // Human's turn
            showActions();
        } else {
            // AI's turn
            hideActions();
            const thinkMsg = (difficulty === 'hard') ? 'thinking hard...' :
                (difficulty === 'medium' && currentPlayerIdx === mcSmartPlayer) ? 'thinking carefully...' : 'thinking...';
            statusEl.textContent = `${players[currentPlayerIdx].name} is ${thinkMsg}`;
            setTimeout(() => aiAct(currentPlayerIdx), AI_DELAY);
        }
    }

    function isBettingRoundComplete() {
        const eligible = activeNonAllInPlayers();
        if (eligible.length === 0) return true;
        return eligible.every(p => p.currentBet === currentBet && p._actedThisRound);
    }

    function markAllUnacted() {
        players.forEach(p => p._actedThisRound = false);
    }

    // --- Player actions ---
    function playerFold(idx) {
        players[idx].folded = true;
        sndFold();
        logAction(idx, 'folds');
        moveToNextPlayer();
    }

    function playerCheck(idx) {
        players[idx]._actedThisRound = true;
        logAction(idx, 'checks');
        moveToNextPlayer();
    }

    function playerCall(idx) {
        const p = players[idx];
        const toCall = currentBet - p.currentBet;
        const actual = Math.min(toCall, p.chips);
        p.chips -= actual;
        p.currentBet += actual;
        p.totalContribution += actual;
        pot += actual;
        if (p.chips === 0) p.allIn = true;
        p._actedThisRound = true;
        sndChip();
        logAction(idx, p.allIn ? `goes all-in ($${p.currentBet})` : `calls $${actual}`);
        moveToNextPlayer();
    }

    function playerRaise(idx, raiseAmount) {
        const p = players[idx];
        const toCall = currentBet - p.currentBet;
        if (p.chips <= toCall) {
            playerCall(idx);
            return;
        }

        const desired = Math.max(BIG_BLIND, raiseAmount);
        const maxRaise = p.chips - toCall;
        const actualRaise = Math.min(desired, maxRaise);
        if (actualRaise <= 0) {
            playerCall(idx);
            return;
        }

        const targetBet = currentBet + actualRaise;
        const toAdd = targetBet - p.currentBet;
        p.chips -= toAdd;
        p.currentBet = targetBet;
        p.totalContribution += toAdd;
        pot += toAdd;
        if (p.chips === 0) p.allIn = true;
        p._actedThisRound = true;
        currentBet = Math.max(currentBet, p.currentBet);
        raisesThisRound++;

        players.forEach((other, i) => {
            if (i !== idx && !other.folded && !other.busted && !other.allIn) {
                other._actedThisRound = false;
            }
        });
        sndChip();
        logAction(idx, p.allIn ? `goes all-in ($${p.currentBet})` : `raises to $${currentBet}`);
        moveToNextPlayer();
    }

    function moveToNextPlayer() {
        currentPlayerIdx = (currentPlayerIdx + 1) % NUM_PLAYERS;
        advanceAction();
    }

    function logAction(idx, action) {
        statusEl.textContent = `${players[idx].name} ${action}.`;
    }

    // --- AI betting ---
    function aiRaiseOrCall(idx, amount) {
        if (raisesThisRound >= MAX_RAISES_PER_ROUND) {
            const toCall = currentBet - players[idx].currentBet;
            if (toCall > 0) playerCall(idx); else playerCheck(idx);
        } else {
            playerRaise(idx, amount);
        }
    }

    function aiAct(idx) {
        const useMC = (difficulty === 'hard') || (difficulty === 'medium' && idx === mcSmartPlayer);
        if (useMC) {
            aiActMonteCarlo(idx);
        } else {
            aiActHeuristic(idx);
        }
    }

    // Heuristic AI (Easy mode / non-smart players in Medium)
    function aiActHeuristic(idx) {
        const p = players[idx];
        const toCall = currentBet - p.currentBet;

        if (stage === 0) {
            const score = scoreHoleCards(p.hole);
            if (toCall > 0) {
                if (score < 3) { playerFold(idx); return; }
                if (score >= 7) { aiRaiseOrCall(idx, BIG_BLIND * Math.ceil(score / 3)); return; }
                playerCall(idx);
            } else {
                if (score >= 7) { aiRaiseOrCall(idx, BIG_BLIND * 2); return; }
                playerCheck(idx);
            }
        } else {
            const tempPlayer = { hole: p.hole, rank: null, rankVal: 10, best5: [] };
            const available = [...p.hole, ...communityCards];
            if (available.length >= 5) {
                evaluateHand(tempPlayer);
            } else {
                tempPlayer.rankVal = 9;
            }
            const handVal = tempPlayer.rankVal;

            if (toCall > 0) {
                if (handVal >= 9 && Math.random() < 0.6) { playerFold(idx); return; }
                if (handVal >= 8 && Math.random() < 0.3) { playerFold(idx); return; }
                if (handVal <= 5) { aiRaiseOrCall(idx, BIG_BLIND * (6 - handVal)); return; }
                playerCall(idx);
            } else {
                if (handVal <= 5) { aiRaiseOrCall(idx, BIG_BLIND * (6 - handVal)); return; }
                if (handVal <= 7 && Math.random() < 0.3) { aiRaiseOrCall(idx, BIG_BLIND); return; }
                playerCheck(idx);
            }
        }
    }

    // Monte Carlo AI (Hard mode / smart player in Medium)
    function aiActMonteCarlo(idx) {
        const p = players[idx];
        const toCall = currentBet - p.currentBet;
        const opponents = players.filter((player, i) => i !== idx && !player.busted && !player.folded).length;
        const winPct = monteCarloWinPctFor(p.hole, communityCards, MC_AI_SIMS, opponents);
        const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

        if (toCall === 0) {
            // No bet to match
            if (winPct >= 0.80) { aiRaiseOrCall(idx, BIG_BLIND * 4); return; }
            if (winPct >= 0.65) { aiRaiseOrCall(idx, BIG_BLIND * 2); return; }
            if (winPct >= 0.45 && Math.random() < 0.3) { aiRaiseOrCall(idx, BIG_BLIND); return; }
            playerCheck(idx);
        } else {
            // Must call or fold
            if (winPct < potOdds * 0.85) { playerFold(idx); return; }
            if (winPct >= 0.80) { aiRaiseOrCall(idx, BIG_BLIND * 4); return; }
            if (winPct >= 0.65) { aiRaiseOrCall(idx, BIG_BLIND * 2); return; }
            playerCall(idx);
        }
    }

    // MC sim with configurable simulation count (used by AI)
    function monteCarloWinPctFor(hole, community, numSims, numOpponents = NUM_PLAYERS - 1) {
        const numCommunity = community.length;
        const cardsToComplete = 5 - numCommunity;
        const opponents = Math.max(0, numOpponents);
        const cardsNeeded = cardsToComplete + 2 * opponents;

        const used = new Set();
        hole.forEach(c => used.add(c.face * 4 + SUITS.indexOf(c.suit)));
        community.forEach(c => used.add(c.face * 4 + SUITS.indexOf(c.suit)));

        const remaining = [];
        for (let f = 0; f < 13; f++)
            for (let s = 0; s < 4; s++)
                if (!used.has(f * 4 + s))
                    remaining.push({ face: f, suit: SUITS[s] });

        let wins = 0, ties = 0;

        for (let sim = 0; sim < numSims; sim++) {
            for (let i = 0; i < cardsNeeded && i < remaining.length - 1; i++) {
                const j = i + Math.floor(Math.random() * (remaining.length - i));
                const tmp = remaining[i]; remaining[i] = remaining[j]; remaining[j] = tmp;
            }

            const fullComm = [...community];
            for (let i = 0; i < cardsToComplete; i++) fullComm.push(remaining[i]);

            const playerAll = [...hole, ...fullComm];
            const playerRank = bestRankOf(playerAll);

            let playerWins = true, isTie = false;
            for (let opp = 0; opp < opponents; opp++) {
                const base = cardsToComplete + opp * 2;
                const oppAll = [remaining[base], remaining[base + 1], ...fullComm];
                const oppRank = bestRankOf(oppAll);
                const cmp = compareRanks(playerRank, oppRank);
                if (cmp < 0) { playerWins = false; break; }
                if (cmp === 0) isTie = true;
            }
            if (playerWins && !isTie) wins++;
            else if (playerWins && isTie) ties++;
        }

        return wins / numSims + 0.5 * ties / numSims;
    }

    function scoreHoleCards(hole) {
        // Score 0-10: higher = better
        const f1 = hole[0].face, f2 = hole[1].face;
        const suited = hole[0].suit === hole[1].suit;
        let score = 0;

        // Pair bonus
        if (f1 === f2) {
            score += 5 + Math.floor(f1 / 3); // pair of 2s=5, pair of aces=9
        } else {
            // High card value
            const high = Math.max(f1, f2);
            score += Math.floor(high / 4); // 0-3
            // Connectedness
            if (Math.abs(f1 - f2) <= 2) score += 1;
        }
        if (suited) score += 1;
        // AK, AQ suited bonus
        if ((f1 === 12 || f2 === 12) && (f1 >= 10 || f2 >= 10)) score += 2;

        return Math.min(score, 10);
    }

    // --- End of betting round / stage progression ---
    function endBettingRound() {
        hideActions();
        // Reset bets for next round
        players.forEach(p => { p.currentBet = 0; p._actedThisRound = false; });
        currentBet = 0;

        // If only one non-all-in player and others are all-in, skip remaining rounds
        const canAct = activeNonAllInPlayers();
        const inHand = playersStillInHand();

        if (inHand.length === 1) {
            winByFold(inHand[0]);
            return;
        }

        stage++;
        if (stage === 1) {
            for (let i = 0; i < 3; i++) communityCards.push(dealCard());
            statusEl.textContent = 'The Flop.';
        } else if (stage === 2) {
            communityCards.push(dealCard());
            statusEl.textContent = 'The Turn.';
        } else if (stage === 3) {
            communityCards.push(dealCard());
            statusEl.textContent = 'The River.';
        } else if (stage >= 4) {
            showdown();
            return;
        }

        renderAll();

        // If nobody can bet (all all-in or only 1 can act), auto-advance
        if (canAct.length <= 1) {
            setTimeout(() => endBettingRound(), 800);
            return;
        }

        // Start next betting round from first active after dealer
        currentPlayerIdx = nextActivePlayer(dealerIdx);
        markAllUnacted();
        startBettingRound();
    }

    // --- Showdown ---
    function showdown() {
        stage = 4;
        const inHand = playersStillInHand();
        inHand.forEach(p => evaluateHand(p));

        const sidePots = buildSidePots();
        const winnings = new Map();
        const summaries = [];
        const tieBreakNotes = [];

        const awardPot = (potAmount, potWinners, label) => {
            if (!potWinners.length) return;
            const share = Math.floor(potAmount / potWinners.length);
            potWinners.forEach(idx => {
                players[idx].chips += share;
                winnings.set(idx, (winnings.get(idx) || 0) + share);
            });
            const remainder = potAmount - share * potWinners.length;
            if (remainder > 0) {
                players[potWinners[0]].chips += remainder;
                winnings.set(potWinners[0], (winnings.get(potWinners[0]) || 0) + remainder);
            }
            summaries.push(label);
        };

        if (sidePots.length === 0) {
            const eligible = [];
            players.forEach((p, idx) => {
                if (!p.folded && !p.busted) eligible.push(idx);
            });
            const winners = determinePotWinners(eligible, tieBreakNotes);
            if (winners.length) {
                const label = `${winners.map(i => players[i].name).join(' & ')} wins $${pot} with ${RANK_NAMES[players[winners[0]].rankVal]}`;
                awardPot(pot, winners, label);
            }
        } else {
            sidePots.forEach((potInfo, idx) => {
                const winners = determinePotWinners(potInfo.eligible, tieBreakNotes);
                if (winners.length) {
                    const label = idx === 0
                        ? `${winners.map(i => players[i].name).join(' & ')} wins $${potInfo.amount} with ${RANK_NAMES[players[winners[0]].rankVal]}`
                        : `Side pot ${idx}: ${winners.map(i => players[i].name).join(' & ')} wins $${potInfo.amount}`;
                    awardPot(potInfo.amount, winners, label);
                }
            });
        }

        pot = 0;
        statusEl.textContent = summaries.length
            ? summaries.join('. ') + '.'
            : 'Showdown complete.';
        lastHandWinners = Array.from(winnings.keys());
        lastTieBreakNotes = tieBreakNotes.slice();
        setTieBreakInfo(tieBreakNotes.length ? tieBreakNotes.join(' ') : '');
        endHand();
    }

    function winByFold(winner) {
        const idx = players.indexOf(winner);
        winner.chips += pot;
        statusEl.textContent = `${winner.name} wins $${pot} — everyone else folded!`;
        pot = 0;
        stage = 4; // so cards are revealed
        lastHandWinners = [idx];
        lastTieBreakNotes = [];
        setTieBreakInfo('');
        endHand();
    }

    function endHand() {
        handInProgress = false;
        hideActions();
        difficultySelect.disabled = false;

        // Mark busted players
        players.forEach(p => {
            if (p.chips <= 0 && !p.busted) {
                p.busted = true;
                p.chips = 0;
            }
        });

        // Check for game over
        const alive = players.filter(p => !p.busted);
        if (alive.length === 1) {
            gameOver = true;
            statusEl.textContent += ` ${alive[0].name} wins the game!`;
            dealBtn.style.display = 'none';
        } else {
            dealBtn.style.display = '';
            dealBtn.disabled = false;
        }

        renderAll();

        // Apply win/loss animations after a frame so browser registers the initial state
        if (stage === 4) {
            requestAnimationFrame(() => {
                const boxes = playersEl.querySelectorAll('.player-box');
                const winnerIdxs = lastHandWinners.length ? lastHandWinners : decideWinnerFromActive();
                const humanWon = winnerIdxs.includes(0);
                const humanLost = !humanWon && !players[0].folded;
                if (humanWon) sndWin(); else if (humanLost) sndLose();
                boxes.forEach((box, i) => {
                    if (winnerIdxs.includes(i)) box.classList.add('anim-win');
                    if (i === 0 && humanLost) box.classList.add('anim-lose');
                });
            });
        }
    }

    function decideWinnerFromActive() {
        const inHand = [];
        players.forEach((p, i) => { if (!p.busted && !p.folded) inHand.push(i); });
        let bestIdx = [inHand[0]];
        for (let k = 1; k < inHand.length; k++) {
            const i = inHand[k];
            const cmp = comparePlayers(i, bestIdx[0]);
            if (cmp > 0) bestIdx = [i];
            else if (cmp === 0) bestIdx.push(i);
        }
        return bestIdx;
    }

    // --- Human action handlers ---
    function showActions() {
        const p = players[0];
        const toCall = currentBet - p.currentBet;

        actionsEl.style.display = 'flex';

        const canCheck = toCall === 0 && !p.allIn && !p.folded;
        const canCall = toCall > 0 && !p.allIn && !p.folded && p.chips > 0;

        if (checkBtn) {
            checkBtn.disabled = !canCheck;
        }
        if (callBtn) {
            callBtn.disabled = !canCall;
            callBtn.textContent = toCall > 0 ? `Call $${Math.min(toCall, p.chips)}` : 'Call';
        }

        raiseInput.min = BIG_BLIND;
        raiseInput.max = p.chips - (toCall > 0 ? toCall : 0);
        raiseInput.value = BIG_BLIND;

        // Disable raise if can't afford it or raise cap reached
        const canRaise = p.chips > toCall && raisesThisRound < MAX_RAISES_PER_ROUND;
        raiseBtn.disabled = !canRaise;
        raiseInput.disabled = !canRaise;

        if (raisesThisRound >= MAX_RAISES_PER_ROUND) {
            statusEl.textContent = `Your turn. (Raise cap reached — ${MAX_RAISES_PER_ROUND} raises this round)`;
        } else {
            statusEl.textContent = 'Your turn.';
        }
    }

    function hideActions() {
        actionsEl.style.display = 'none';
    }

    function onFold() {
        hideActions();
        playerFold(0);
    }

    function onCheck() {
        if (currentBet - players[0].currentBet > 0 || players[0].allIn) return;
        hideActions();
        playerCheck(0);
    }

    function onCall() {
        const toCall = currentBet - players[0].currentBet;
        if (toCall <= 0 || players[0].allIn) return;
        hideActions();
        playerCall(0);
    }

    function onRaise() {
        hideActions();
        let amount = parseInt(raiseInput.value) || BIG_BLIND;
        amount = Math.max(BIG_BLIND, amount);
        const p = players[0];
        const maxRaise = p.chips - (currentBet - p.currentBet);
        amount = Math.min(amount, maxRaise);
        playerRaise(0, amount);
    }

    // --- Hand Evaluation Engine (ported from C) ---
    function evaluateHand(player) {
        const allCards = [...player.hole, ...communityCards];
        if (allCards.length < 5) return;
        let bestRank = null;
        let bestVal = 10;
        let bestHigh = -1;
        let bestKicker = -1;
        let bestHigh2 = -1;
        let bestCombo = null;

        const combos = combinations(allCards, 5);
        for (const hand of combos) {
            const r = rankHand(hand);
            if (r.rankVal < bestVal ||
                (r.rankVal === bestVal && r.high > bestHigh) ||
                (r.rankVal === bestVal && r.high === bestHigh && r.high2 > bestHigh2) ||
                (r.rankVal === bestVal && r.high === bestHigh && r.high2 === bestHigh2 && r.kicker > bestKicker)) {
                bestVal = r.rankVal;
                bestHigh = r.high;
                bestHigh2 = r.high2;
                bestKicker = r.kicker;
                bestRank = r;
                bestCombo = hand;
            }
        }
        player.rankVal = bestVal;
        player.rank = bestRank;
        player.best5 = bestCombo;
    }

    function rankHand(hand) {
        const sorted = [...hand].sort((a, b) => a.face - b.face);
        const faces = sorted.map(c => c.face);
        const suits = sorted.map(c => c.suit);

        const isFlush = suits.every(s => s === suits[0]);

        let isStraight = false;
        let straightHigh = -1;
        let consecutive = true;
        for (let i = 1; i < 5; i++) {
            if (faces[i] !== faces[i - 1] + 1) { consecutive = false; break; }
        }
        if (consecutive) { isStraight = true; straightHigh = faces[4]; }
        if (!isStraight && faces[0] === 0 && faces[1] === 1 && faces[2] === 2 && faces[3] === 3 && faces[4] === 12) {
            isStraight = true;
            straightHigh = 3;
        }

        const counts = {};
        faces.forEach(f => { counts[f] = (counts[f] || 0) + 1; });
        const groups = Object.entries(counts).map(([f, c]) => ({ face: parseInt(f), count: c }));
        groups.sort((a, b) => b.count - a.count || b.face - a.face);

        if (isStraight && isFlush) {
            if (straightHigh === 12) return { rankVal: 0, high: 12, high2: -1, kicker: -1 };
            return { rankVal: 1, high: straightHigh, high2: -1, kicker: -1 };
        }
        if (groups[0].count === 4) {
            return { rankVal: 2, high: groups[0].face, high2: -1, kicker: groups[1].face };
        }
        if (groups[0].count === 3 && groups[1].count === 2) {
            return { rankVal: 3, high: groups[0].face, high2: groups[1].face, kicker: groups[1].face };
        }
        if (isFlush) {
            return { rankVal: 4, high: faces[4], high2: -1, kicker: faces[3] };
        }
        if (isStraight) {
            return { rankVal: 5, high: straightHigh, high2: -1, kicker: -1 };
        }
        if (groups[0].count === 3) {
            const kicker = groups.length > 1 ? Math.max(...groups.slice(1).map(g => g.face)) : -1;
            return { rankVal: 6, high: groups[0].face, high2: -1, kicker };
        }
        if (groups[0].count === 2 && groups[1].count === 2) {
            const highPair = Math.max(groups[0].face, groups[1].face);
            const lowPair = Math.min(groups[0].face, groups[1].face);
            return { rankVal: 7, high: highPair, high2: lowPair, kicker: groups[2].face };
        }
        if (groups[0].count === 2) {
            const kicker = Math.max(...groups.slice(1).map(g => g.face));
            return { rankVal: 8, high: groups[0].face, high2: -1, kicker };
        }
        return { rankVal: 9, high: faces[4], high2: faces[3], kicker: faces[2] };
    }

    function combinations(arr, k) {
        const result = [];
        function combo(start, chosen) {
            if (chosen.length === k) { result.push([...chosen]); return; }
            for (let i = start; i < arr.length; i++) {
                chosen.push(arr[i]);
                combo(i + 1, chosen);
                chosen.pop();
            }
        }
        combo(0, []);
        return result;
    }

    function comparePlayers(a, b) {
        return comparePlayerRanks(a, b).cmp;
    }

    function comparePlayerRanks(a, b) {
        const ra = players[a].rank, rb = players[b].rank;
        if (!ra && !rb) return { cmp: 0, detail: '' };
        if (!ra) return { cmp: -1, detail: '' };
        if (!rb) return { cmp: 1, detail: '' };
        if (ra.rankVal !== rb.rankVal) {
            return { cmp: ra.rankVal < rb.rankVal ? 1 : -1, detail: '' };
        }
        return compareEqualRank(a, b);
    }

    function compareEqualRank(idxA, idxB) {
        const ra = players[idxA].rank;
        const rb = players[idxB].rank;
        const nameA = players[idxA].name;
        const nameB = players[idxB].name;
        const label = RANK_NAMES[ra.rankVal];
        const tieMsg = `Tie break: ${nameA} and ${nameB} share identical ${label} hands — pot is split.`;

        const announce = (winnerIdx, detail) => ({
            cmp: winnerIdx === idxA ? 1 : -1,
            detail
        });

        const winnerInfo = (condition, detailBuilder) => {
            if (!condition) return null;
            const winnerIdx = condition > 0 ? idxA : idxB;
            const loserIdx = winnerIdx === idxA ? idxB : idxA;
            return announce(winnerIdx, detailBuilder(winnerIdx, loserIdx));
        };

        switch (ra.rankVal) {
            case 0: // Royal Flush
                return { cmp: 0, detail: tieMsg };
            case 1: // Straight Flush
            case 5: { // Straight
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const winnerRank = players[winnerIdx].rank;
                    const loserRank = players[loserIdx].rank;
                    const detail = `Tie break: both had ${label}. ${players[winnerIdx].name}'s highest card (${faceWord(winnerRank.high)}) beats ${players[loserIdx].name}'s ${faceWord(loserRank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 2: { // Four of a Kind
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const winnerRank = players[winnerIdx].rank;
                    const loserRank = players[loserIdx].rank;
                    const detail = `Tie break: both made Four of a Kind. ${players[winnerIdx].name}'s four ${facePlural(winnerRank.high)} beat ${players[loserIdx].name}'s ${facePlural(loserRank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both had the same quads; ${players[winnerIdx].name}'s kicker ${faceWord(players[winnerIdx].rank.kicker)} beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 3: { // Full House
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both made a Full House. ${players[winnerIdx].name}'s trips of ${facePlural(players[winnerIdx].rank.high)} beat ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.high2 !== rb.high2) {
                    const winnerIdx = ra.high2 > rb.high2 ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both had the same trips; ${players[winnerIdx].name}'s pair of ${facePlural(players[winnerIdx].rank.high2)} beats ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high2)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 4: { // Flush
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both made a Flush. ${players[winnerIdx].name}'s highest card (${faceWord(players[winnerIdx].rank.high)}) beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both flushes had ${faceWord(players[winnerIdx].rank.high)} high; ${players[winnerIdx].name}'s next card (${faceWord(players[winnerIdx].rank.kicker)}) beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 6: { // Three of a Kind
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both hit Three of a Kind. ${players[winnerIdx].name}'s ${facePlural(players[winnerIdx].rank.high)} beat ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: trips matched; ${players[winnerIdx].name}'s kicker ${faceWord(players[winnerIdx].rank.kicker)} beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 7: { // Two Pair
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both held Two Pair. ${players[winnerIdx].name}'s top pair of ${facePlural(players[winnerIdx].rank.high)} beats ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.high2 !== rb.high2) {
                    const winnerIdx = ra.high2 > rb.high2 ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: top pairs matched; ${players[winnerIdx].name}'s second pair of ${facePlural(players[winnerIdx].rank.high2)} beats ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high2)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: pairs matched; ${players[winnerIdx].name}'s kicker ${faceWord(players[winnerIdx].rank.kicker)} beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 8: { // One Pair
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: both had a pair. ${players[winnerIdx].name}'s pair of ${facePlural(players[winnerIdx].rank.high)} beats ${players[loserIdx].name}'s ${facePlural(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: pairs matched; ${players[winnerIdx].name}'s kicker ${faceWord(players[winnerIdx].rank.kicker)} beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            case 9: { // High Card
                if (ra.high !== rb.high) {
                    const winnerIdx = ra.high > rb.high ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: high-card battle. ${players[winnerIdx].name}'s ${faceWord(players[winnerIdx].rank.high)} high beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.high)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.high2 !== rb.high2) {
                    const winnerIdx = ra.high2 > rb.high2 ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: top cards matched; ${players[winnerIdx].name}'s next card (${faceWord(players[winnerIdx].rank.high2)}) beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.high2)}.`;
                    return announce(winnerIdx, detail);
                }
                if (ra.kicker !== rb.kicker) {
                    const winnerIdx = ra.kicker > rb.kicker ? idxA : idxB;
                    const loserIdx = winnerIdx === idxA ? idxB : idxA;
                    const detail = `Tie break: still tied; ${players[winnerIdx].name}'s third card (${faceWord(players[winnerIdx].rank.kicker)}) beats ${players[loserIdx].name}'s ${faceWord(players[loserIdx].rank.kicker)}.`;
                    return announce(winnerIdx, detail);
                }
                return { cmp: 0, detail: tieMsg };
            }
            default:
                return { cmp: 0, detail: tieMsg };
        }
    }

    function determinePotWinners(eligibleIdxs, tieBreakNotes) {
        if (!eligibleIdxs.length) return [];
        let best = [eligibleIdxs[0]];
        let tieBreakDetail = null;
        for (let i = 1; i < eligibleIdxs.length; i++) {
            const idx = eligibleIdxs[i];
            const comparison = comparePlayerRanks(idx, best[0]);
            if (comparison.cmp > 0) {
                best = [idx];
                tieBreakDetail = comparison.detail || tieBreakDetail;
            } else if (comparison.cmp === 0) {
                best.push(idx);
                if (comparison.detail) tieBreakDetail = comparison.detail;
            } else if (comparison.cmp < 0 && comparison.detail) {
                tieBreakDetail = comparison.detail;
            }
        }
        if (tieBreakDetail && tieBreakNotes) tieBreakNotes.push(tieBreakDetail);
        return best;
    }

    function buildSidePots() {
        const contributions = players
            .map((p, idx) => ({ idx, amount: p.totalContribution }))
            .filter(entry => entry.amount > 0);
        if (!contributions.length) return [];
        contributions.sort((a, b) => a.amount - b.amount);
        const pots = [];
        let prev = 0;
        for (let i = 0; i < contributions.length; i++) {
            const contrib = contributions[i].amount;
            const chunk = contrib - prev;
            const remaining = contributions.length - i;
            if (chunk > 0 && remaining > 0) {
                const eligible = contributions
                    .slice(i)
                    .map(entry => entry.idx)
                    .filter(idx => !players[idx].folded && !players[idx].busted);
                if (eligible.length > 0) {
                    pots.push({ amount: chunk * remaining, eligible });
                }
                prev = contrib;
            } else {
                prev = contrib;
            }
        }
        return pots;
    }

    // --- Rendering ---
    function renderAll() {
        renderCommunity();
        renderPlayers();
        renderPot();
    }

    function renderCommunity() {
        communityCardsEl.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            if (i < communityCards.length) {
                communityCardsEl.appendChild(createCardEl(communityCards[i], false));
            } else {
                communityCardsEl.appendChild(createCardEl(null, true));
            }
        }
    }

    function renderPlayers() {
        playersEl.innerHTML = '';
        const winnerIdxs = stage === 4
            ? (lastHandWinners.length ? lastHandWinners : decideWinnerFromActive())
            : [];
        players.forEach((p, i) => {
            const box = document.createElement('div');
            let cls = 'player-box';
            if (i === 0) cls += ' human';
            if (winnerIdxs.includes(i)) cls += ' winner';
            if (p.folded) cls += ' folded';
            if (p.busted) cls += ' busted';
            if (p.allIn) cls += ' all-in';
            box.className = cls;

            // Dealer chip
            if (p.isDealer && !p.busted) {
                const dealerChip = document.createElement('span');
                dealerChip.className = 'dealer-chip';
                dealerChip.textContent = 'D';
                box.appendChild(dealerChip);
            }

            const nameEl = document.createElement('div');
            nameEl.className = 'name';
            nameEl.textContent = p.name;
            box.appendChild(nameEl);

            // Chips display
            const chipsEl = document.createElement('div');
            chipsEl.className = 'chip-count';
            if (p.busted) {
                chipsEl.textContent = 'Busted';
            } else {
                chipsEl.textContent = `$${p.chips}`;
                if (p.allIn) chipsEl.textContent += ' (All-in)';
            }
            box.appendChild(chipsEl);

            // Cards
            const cardsRow = document.createElement('div');
            cardsRow.className = 'cards';
            if (!p.busted) {
                p.hole.forEach(card => {
                    const show = (i === 0 || stage === 4) && !p.folded;
                    cardsRow.appendChild(createCardEl(card, !show));
                });
            }
            box.appendChild(cardsRow);

            // Current bet indicator
            if (handInProgress && p.currentBet > 0 && !p.folded) {
                const betEl = document.createElement('div');
                betEl.className = 'current-bet';
                betEl.textContent = `Bet: $${p.currentBet}`;
                box.appendChild(betEl);
            }

            // Rank label at showdown
            const rankEl = document.createElement('div');
            rankEl.className = 'rank-label';
            if (stage === 4 && p.rank && !p.folded) {
                rankEl.textContent = RANK_NAMES[p.rankVal];
            }
            if (p.folded && !p.busted) {
                rankEl.textContent = 'Folded';
            }
            box.appendChild(rankEl);

            playersEl.appendChild(box);
        });
    }

    function renderPot() {
        potEl.textContent = pot > 0 ? `Pot: $${pot}` : '';
    }

    function createCardEl(card, hidden) {
        const el = document.createElement('div');
        el.className = 'card';
        if (hidden || !card) {
            el.classList.add('hidden');
            return el;
        }
        el.classList.add(card.suit);
        const faceEl = document.createElement('span');
        faceEl.className = 'face';
        faceEl.textContent = FACE_NAMES[card.face];
        const suitEl = document.createElement('span');
        suitEl.className = 'suit';
        suitEl.textContent = SUIT_SYMBOLS[card.suit];
        el.appendChild(faceEl);
        el.appendChild(suitEl);
        return el;
    }

    // --- Monte Carlo hand strength simulator ---
    const MC_SIMS = 2000; // simulations for human's "My Hand" button

    function monteCarloWinPct(hole, community) {
        const opponents = players.filter((p, i) => i !== 0 && !p.busted && !p.folded).length;
        return monteCarloWinPctFor(hole, community, MC_SIMS, opponents);
    }

    function bestRankOf(cards) {
        let best = { rankVal: 10, high: -1, high2: -1, kicker: -1 };
        const combos = combinations(cards, 5);
        for (const hand of combos) {
            const r = rankHand(hand);
            if (compareRanks(r, best) > 0) best = r;
        }
        return best;
    }

    function compareRanks(a, b) {
        if (a.rankVal !== b.rankVal) return a.rankVal < b.rankVal ? 1 : -1;
        if (a.high !== b.high) return a.high > b.high ? 1 : -1;
        if (a.high2 !== b.high2) return a.high2 > b.high2 ? 1 : -1;
        if (a.kicker !== b.kicker) return a.kicker > b.kicker ? 1 : -1;
        return 0;
    }

    function getStrengthLabel(winPct) {
        if (winPct >= 0.70) return 'Very Strong';
        if (winPct >= 0.50) return 'Strong';
        if (winPct >= 0.35) return 'Medium';
        if (winPct >= 0.20) return 'Weak';
        return 'Very Weak';
    }

    function getAdvice(winPct, toCall) {
        const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
        if (toCall === 0) {
            if (winPct >= 0.80) return 'Raise $' + (BIG_BLIND * 4);
            if (winPct >= 0.65) return 'Raise $' + (BIG_BLIND * 2);
            return 'Check';
        } else {
            if (winPct < potOdds * 0.9) return 'Fold';
            if (winPct >= 0.80) return 'Raise $' + (BIG_BLIND * 4);
            if (winPct >= 0.65) return 'Raise $' + (BIG_BLIND * 2);
            return 'Call $' + toCall;
        }
    }

    // --- My Hand evaluation ---
    const myHandBtn = document.getElementById('my-hand-btn');
    const handTooltip = document.getElementById('hand-tooltip');
    let tooltipTimeout = null;

    function showMyHand() {
        const p = players[0];
        if (!p || !p.hole.length || p.folded || p.busted) {
            showTooltip('No active hand.');
            return;
        }

        if (p.hole.length < 2) {
            showTooltip('No cards dealt yet.');
            return;
        }

        const c1 = FACE_NAMES[p.hole[0].face] + SUIT_SYMBOLS[p.hole[0].suit];
        const c2 = FACE_NAMES[p.hole[1].face] + SUIT_SYMBOLS[p.hole[1].suit];
        let msg = `Your cards: ${c1}  ${c2}`;

        // Hole card description
        if (p.hole[0].face === p.hole[1].face) {
            msg += '  (Pocket ' + FACE_NAMES[p.hole[0].face] + 's)';
        } else if (p.hole[0].suit === p.hole[1].suit) {
            msg += '  (Suited)';
        }

        const allCards = [...p.hole, ...communityCards];

        // Current best hand if enough cards
        if (allCards.length >= 5) {
            const tempPlayer = { hole: p.hole, rank: null, rankVal: 10, best5: [] };
            evaluateHand(tempPlayer);
            const rankName = RANK_NAMES[tempPlayer.rankVal];
            const best5Str = tempPlayer.best5.map(c => FACE_NAMES[c.face] + SUIT_SYMBOLS[c.suit]).join(' ');
            msg += `\nBest hand: ${rankName}\n${best5Str}`;
        }

        // Draw outs
        if (communityCards.length > 0 && communityCards.length < 5) {
            const outs = countDrawOuts(p.hole, communityCards);
            if (outs) msg += '\n' + outs;
        }

        // Monte Carlo win % + strength + advice
        const winPct = monteCarloWinPct(p.hole, communityCards);
        const strength = getStrengthLabel(winPct);
        const toCall = currentBet - p.currentBet;
        const advice = getAdvice(winPct, toCall);

        msg += `\n\nWin chance: ${(winPct * 100).toFixed(0)}% — ${strength}`;
        msg += `\nSuggested: ${advice}`;

        // Reminder about community cards
        if (communityCards.length > 0) {
            msg += '\n\n(Community cards are shared by all players)';
        }

        showTooltip(msg);
    }

    function countDrawOuts(hole, community) {
        const allCards = [...hole, ...community];
        const hints = [];

        // Check flush draw (4 of same suit)
        const suitCounts = {};
        allCards.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
        for (const s in suitCounts) {
            if (suitCounts[s] === 4) hints.push('Flush draw (9 outs)');
        }

        // Check straight draw (open-ended)
        const faces = [...new Set(allCards.map(c => c.face))].sort((a, b) => a - b);
        for (let i = 0; i <= faces.length - 4; i++) {
            if (faces[i + 3] - faces[i] === 3 || faces[i + 3] - faces[i] === 4) {
                const gap = faces[i + 3] - faces[i];
                if (gap === 3) { hints.push('Open-ended straight draw (8 outs)'); break; }
                if (gap === 4) {
                    let missing = 0;
                    for (let j = faces[i]; j <= faces[i + 3]; j++) {
                        if (!faces.includes(j)) missing++;
                    }
                    if (missing === 1) { hints.push('Gutshot straight draw (4 outs)'); break; }
                }
            }
        }

        return hints.join(' | ');
    }

    function showTooltip(text) {
        handTooltip.textContent = text;
        handTooltip.style.display = 'block';
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => { handTooltip.style.display = 'none'; }, 5000);
    }

    function toggleRankings() {
        if (!rankingsOverlay) return;
        rankingsOverlay.style.display = rankingsOverlay.style.display === 'none' ? 'flex' : 'none';
    }

    if (rankingsOverlay) {
        rankingsOverlay.addEventListener('click', function (e) {
            if (e.target === rankingsOverlay) rankingsOverlay.style.display = 'none';
        });
    }

    Array.from(rankingsTabButtons).forEach(btn => {
        btn.addEventListener('click', () => activateRankingTab(btn.dataset.tab || 'hand'));
    });

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

    function sndDeal() { playTone(800, 0.06, 'triangle', 0.1); }
    function sndChip() {
        // short bright noise-like click for chip toss
        playTone(3000, 0.04, 'square', 0.04);
        setTimeout(() => playTone(4500, 0.03, 'square', 0.03), 30);
    }
    function sndFold() { playTone(250, 0.15, 'sine', 0.06); }
    function sndWin() {
        playTone(523, 0.12, 'sine', 0.1);
        setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100);
        setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 200);
    }
    function sndLose() {
        playTone(300, 0.2, 'sine', 0.08);
        setTimeout(() => playTone(220, 0.3, 'sine', 0.08), 150);
    }

    // --- Event listeners ---
    dealBtn.addEventListener('click', dealNewHand);
    foldBtn.addEventListener('click', onFold);
    checkBtn.addEventListener('click', onCheck);
    callBtn.addEventListener('click', onCall);
    raiseBtn.addEventListener('click', onRaise);
    myHandBtn.addEventListener('click', showMyHand);
    if (rankingsBtn) rankingsBtn.addEventListener('click', toggleRankings);
    if (rankingsClose) rankingsClose.addEventListener('click', toggleRankings);

    init();
})();
