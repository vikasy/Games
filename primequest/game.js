// PrimeQuest — Educational Prime Number Game
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.
// Ported from primequest.c by Vikas Yadav

(function () {
    'use strict';

    // ═══ CONSTANTS ═══════════════════════════════════════════════════════

    var RANKS = ['Cadet','Apprentice','Rule Finder','Scout','Factor Hunter',
        'Ranger','Inspector','Detective',
        'Codebreaker','Strategist',
        'Agent','Investigator','Clock Master','Totient Tracker',
        'Theorist','Observer','Scholar','Analyst',
        'Specialist','Grand Prime Master','Probability Pro','Cryptographer','Mersenne Master'];
    var LEVEL_NAMES = [
        'Odd or Even','Multiplication Tables','Divisibility Rules',
        'Divisibility Detective','Finding Factors','Sieve of Eratosthenes',
        'Perfect Power Spotter','Trial Division Challenge',
        "GCD: Euclid's Algorithm","LCM: Least Common Multiple",
        "Fermat's Little Theorem",'Carmichael Numbers',
        'Modular Arithmetic',
        "Euler's Totient Function",
        "Pascal's Triangle: The Pattern","Pascal's Triangle & Primes",
        'Polynomials: Building Blocks','Binomial Expansion',
        'Polynomial Fermat','The AKS Test',
        'Miller-Rabin Test','RSA Basics','Bonus: Mersenne Primes'
    ];
    var LEVEL_TIMERS = [10,8,15,30,45,90,40,60, 40,40, 50,50,60,40, 50,50, 60,60, 70,90,60,90,60]; // seconds per question
    var LEVEL_COUNTS = [15,15,10,10,10,1,10,10, 10,10, 8,8,8,8, 10,10, 10,8, 6,5,6,5,8];      // questions per round

    var PRIME_FACTS = [
        '2 is the only even prime number!',
        'Cicadas emerge every 13 or 17 years — both prime!',
        '1 is NOT a prime number.',
        'There are infinitely many prime numbers.',
        'The largest known prime has over 41 million digits!',
        'Primes are used to encrypt your internet traffic.',
        'Twin primes like (11,13) differ by exactly 2.',
        'Every even number > 2 is the sum of two primes (Goldbach conjecture).',
        'The number 73 is the 21st prime — and 7×3 = 21!',
        'A prime gap is the distance between consecutive primes.',
        'Mersenne primes have the form 2^p - 1 where p is also prime.',
        'The prime counting function π(x) ≈ x / ln(x).',
        'Wilson\'s theorem: p is prime iff (p-1)! ≡ -1 (mod p).',
        'Fermat primes have the form 2^(2^n) + 1. Only 5 are known!',
        'The RSA algorithm relies on the difficulty of factoring large composites.'
    ];

    var CARMICHAEL = [561,1105,1729,2465,2821];

    // ═══ STATE ═══════════════════════════════════════════════════════════

    var state = {
        score: 0, streak: 0, currentLevel: -1, currentRound: 0,
        questionIndex: 0, correct: 0, total: 0, timerExpired: 0,
        factIndex: 0, correctSinceLastFact: 0,
        timerID: null, timerStart: 0, timerDuration: 0,
        levelProgress: null, // array of {unlocked,stars,bestScore} per level
        tutorialStep: 0, tutorialDone: false,
        sieveState: null, questionActive: false
    };

    var TOTAL_LEVELS = 23;

    function loadProgress() {
        try {
            var s = gameGet('pq_progress');
            if (s) {
                state.levelProgress = JSON.parse(s);
                while (state.levelProgress.length < TOTAL_LEVELS)
                    state.levelProgress.push({unlocked: false, stars: 0, bestScore: 0});
                state.levelProgress[0].unlocked = true;
                return;
            }
        } catch(e) {}
        state.levelProgress = [];
        for (var i = 0; i < TOTAL_LEVELS; i++)
            state.levelProgress.push({unlocked: i === 0, stars: 0, bestScore: 0});
    }

    function saveProgress() {
        try { gameSet('pq_progress', JSON.stringify(state.levelProgress)); } catch(e) {}
    }

    // ═══ DOM ELEMENTS ════════════════════════════════════════════════════

    var $hud = document.getElementById('hud');
    var $hudBack = document.getElementById('hud-back');
    var $hudScore = document.getElementById('hud-score');
    var $hudStreak = document.getElementById('hud-streak');
    var $hudRank = document.getElementById('hud-rank');
    var $timerContainer = document.getElementById('timer-bar-container');
    var $timerBar = document.getElementById('timer-bar');
    var $timerText = document.getElementById('timer-text');
    var $levelSelect = document.getElementById('level-select');
    var $levelGrid = document.getElementById('level-grid');
    var $gameArea = document.getElementById('game-area');
    var $tutorialPanel = document.getElementById('tutorial-panel');
    var $tutorialContent = document.getElementById('tutorial-content');
    var $tutorialNext = document.getElementById('tutorial-next');
    var $tutorialStart = document.getElementById('tutorial-start');
    var $questionArea = document.getElementById('question-area');
    var $questionPrompt = document.getElementById('question-prompt');
    var $questionVisual = document.getElementById('question-visual');
    var $answerButtons = document.getElementById('answer-buttons');
    var $feedback = document.getElementById('question-feedback');
    var $progress = document.getElementById('question-progress');
    var $levelComplete = document.getElementById('level-complete');
    var $completeTitle = document.getElementById('complete-title');
    var $completeStars = document.getElementById('complete-stars');
    var $completeStats = document.getElementById('complete-stats');
    var $completeNext = document.getElementById('complete-next');
    var $factToast = document.getElementById('fact-toast');
    var $confetti = document.getElementById('confetti');

    // ═══ AUDIO ═══════════════════════════════════════════════════════════

    var audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }
    function playTone(freq, dur, type, vol) {
        ensureAudio();
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + dur);
    }
    function sndCorrect() { playTone(660, 0.12, 'triangle', 0.1); setTimeout(function(){ playTone(880, 0.15, 'triangle', 0.08); }, 80); }
    function sndWrong() { playTone(250, 0.2, 'sawtooth', 0.06); }
    function sndLevelUp() {
        playTone(523, 0.1, 'sine', 0.08);
        setTimeout(function(){ playTone(659, 0.1, 'sine', 0.08); }, 100);
        setTimeout(function(){ playTone(784, 0.15, 'sine', 0.08); }, 200);
        setTimeout(function(){ playTone(1047, 0.25, 'sine', 0.1); }, 300);
    }
    function sndTick() { playTone(400, 0.04, 'triangle', 0.05); }
    function sndStreakBreak() { playTone(300, 0.15, 'sine', 0.05); }

    // ═══ MATH FUNCTIONS (ported from C) ══════════════════════════════════

    function isEven(n) { return n % 2 === 0; }
    function isDivisible(n, d) { return d !== 0 && n % d === 0; }

    function sieve(limit) {
        var c = new Uint8Array(limit + 1), primes = [];
        for (var i = 2; i <= limit; i++) {
            if (!c[i]) { primes.push(i); for (var j = i * i; j <= limit; j += i) c[j] = 1; }
        }
        return primes;
    }

    function isPerfectPower(n) {
        if (n < 4) return null;
        var maxExp = Math.floor(Math.log2(n)) + 1;
        for (var b = 2; b <= maxExp; b++) {
            var root = Math.round(Math.pow(n, 1.0 / b));
            for (var a = Math.max(2, root - 1); a <= root + 1; a++) {
                var val = 1, ok = true;
                for (var i = 0; i < b; i++) { val *= a; if (val > n) { ok = false; break; } }
                if (ok && val === n) return {base: a, exp: b};
            }
        }
        return null;
    }

    function modPow(base, exp, mod) {
        if (mod === 1) return 0;
        var result = 1; base = ((base % mod) + mod) % mod;
        while (exp > 0) {
            if (exp % 2 === 1) result = Number(BigInt(result) * BigInt(base) % BigInt(mod));
            exp = Math.floor(exp / 2);
            base = Number(BigInt(base) * BigInt(base) % BigInt(mod));
        }
        return result;
    }

    function trialDivision(n) {
        if (n < 2) return false;
        if (n < 4) return true;
        if (n % 2 === 0 || n % 3 === 0) return false;
        for (var i = 5; i * i <= n; i += 6)
            if (n % i === 0 || n % (i + 2) === 0) return false;
        return true;
    }

    function fermatTest(n, a) {
        if (n < 3) return n === 2;
        return modPow(a, n - 1, n) === 1;
    }

    function binomialCoeffMod(n, k, m) {
        // Compute C(n,k) mod m exactly using BigInt
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1 % m;
        if (k > n - k) k = n - k;
        var num = BigInt(1), den = BigInt(1);
        for (var i = 0; i < k; i++) {
            num *= BigInt(n - i);
            den *= BigInt(i + 1);
        }
        var binom = num / den; // exact integer
        return Number(((binom % BigInt(m)) + BigInt(m)) % BigInt(m));
    }

    function polynomialFermatCheck(n) {
        // Check all C(n,k) mod n === 0 for 0 < k < n
        for (var k = 1; k < n; k++) {
            if (binomialCoeffMod(n, k, n) !== 0) return false;
        }
        return true;
    }

    function getPascalRowModN(n) {
        // Returns array of C(n,k) mod n for k = 0..n using exact BigInt
        var row = [];
        var N = BigInt(n);
        var val = BigInt(1);
        row.push(1); // C(n,0) mod n = 1
        for (var k = 1; k <= n; k++) {
            val = val * BigInt(n - k + 1) / BigInt(k);
            row.push(Number(((val % N) + N) % N));
        }
        return row;
    }

    function multOrder(a, n) {
        if (n <= 1) return 0;
        var val = a % n;
        if (val === 0) return 0;
        for (var k = 1; k <= n; k++) {
            if (val === 1) return k;
            val = Number(BigInt(val) * BigInt(a) % BigInt(n));
        }
        return 0;
    }

    function findAKS_R(n) {
        var log2n = Math.log2(n), bound = log2n * log2n;
        for (var r = 2; ; r++) {
            var g = r, b = n % r;
            while (b) { var t = b; b = g % b; g = t; }
            if (g > 1 && r < n) continue;
            var ord = multOrder(n % r, r);
            if (ord > bound) return r;
        }
    }

    function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }


    // Simplified AKS for game (step results)
    function aksSteps(n) {
        var steps = [];
        if (n < 2) { steps.push({step:0, result:'composite', msg: n + ' < 2'}); return steps; }
        if (n <= 3) { steps.push({step:0, result:'prime', msg: n + ' is prime (base case)'}); return steps; }

        var pp = isPerfectPower(n);
        if (pp) {
            steps.push({step:1, result:'composite', msg: n + ' = ' + pp.base + '^' + pp.exp + ' (perfect power)'});
            return steps;
        }
        steps.push({step:1, result:'pass', msg: 'Not a perfect power'});

        var r = findAKS_R(n);
        steps.push({step:2, result:'pass', msg: 'r = ' + r});

        var limit = Math.min(r, n - 1);
        for (var a = 2; a <= limit; a++) {
            if (gcd(a, n) > 1) {
                steps.push({step:3, result:'composite', msg: 'gcd(' + a + ', ' + n + ') = ' + gcd(a,n) + ' > 1'});
                return steps;
            }
        }
        steps.push({step:3, result:'pass', msg: 'No small factors up to ' + limit});

        if (n <= r) {
            steps.push({step:4, result:'prime', msg: n + ' ≤ r → prime'});
            return steps;
        }
        steps.push({step:4, result:'pass', msg: n + ' > r, check polynomials'});

        steps.push({step:5, result: trialDivision(n) ? 'prime' : 'composite',
                     msg: 'Polynomial checks → ' + (trialDivision(n) ? 'PRIME' : 'COMPOSITE')});
        return steps;
    }

    function eulerTotient(n) {
        var result = n, temp = n;
        for (var p = 2; p * p <= temp; p++) {
            if (temp % p === 0) {
                while (temp % p === 0) temp = Math.floor(temp / p);
                result -= Math.floor(result / p);
            }
        }
        if (temp > 1) result -= Math.floor(result / temp);
        return result;
    }

    function modInverse(a, m) {
        var g = m, x = 0, y = 1, g0 = a, x0 = 1, y0 = 0;
        while (g0 !== 0) {
            var q = Math.floor(g / g0);
            var tmp;
            tmp = g0; g0 = g - q * g0; g = tmp;
            tmp = x0; x0 = x - q * x0; x = tmp;
            tmp = y0; y0 = y - q * y0; y = tmp;
        }
        if (g !== 1) return -1;
        return ((x % m) + m) % m;
    }

    function millerRabinDecompose(n) {
        var d = n - 1, s = 0;
        while (d % 2 === 0) { d = Math.floor(d / 2); s++; }
        return { s: s, d: d };
    }

    function millerRabinTest(n, a) {
        var dec = millerRabinDecompose(n);
        var s = dec.s, d = dec.d;
        var x = modPow(a, d, n);
        var steps = [{ desc: a + '^' + d + ' mod ' + n + ' = ' + x, val: x }];
        if (x === 1 || x === n - 1) return { steps: steps, isProbablePrime: true };
        for (var r = 1; r < s; r++) {
            x = modPow(x, 2, n);
            steps.push({ desc: 'Square \u2192 ' + x + ' (mod ' + n + ')', val: x });
            if (x === n - 1) return { steps: steps, isProbablePrime: true };
            if (x === 1) return { steps: steps, isProbablePrime: false };
        }
        return { steps: steps, isProbablePrime: false };
    }

    function getDivisibilityRule(n, d) {
        var digits = String(n).split('').map(Number);
        var divisible = n % d === 0;
        var explanation = '';
        if (d === 2) {
            explanation = 'Last digit is ' + digits[digits.length - 1] + (digits[digits.length - 1] % 2 === 0 ? ' (even)' : ' (odd)');
        } else if (d === 3 || d === 9) {
            var sum = digits.reduce(function(a, b) { return a + b; }, 0);
            explanation = 'Digit sum: ' + digits.join(' + ') + ' = ' + sum + (sum % d === 0 ? ' (divisible by ' + d + ')' : ' (not divisible by ' + d + ')');
        } else if (d === 5) {
            explanation = 'Last digit is ' + digits[digits.length - 1] + (digits[digits.length - 1] === 0 || digits[digits.length - 1] === 5 ? ' (0 or 5)' : ' (not 0 or 5)');
        } else if (d === 10) {
            explanation = 'Last digit is ' + digits[digits.length - 1] + (digits[digits.length - 1] === 0 ? ' (is 0)' : ' (not 0)');
        } else if (d === 4) {
            var last2 = n % 100;
            explanation = 'Last 2 digits: ' + last2 + (last2 % 4 === 0 ? ' (divisible by 4)' : ' (not divisible by 4)');
        } else if (d === 6) {
            explanation = 'Divisible by 2? ' + (n % 2 === 0 ? 'Yes' : 'No') + '. Divisible by 3? ' + (n % 3 === 0 ? 'Yes' : 'No') + '. Need both.';
        } else if (d === 8) {
            var last3 = n % 1000;
            explanation = 'Last 3 digits: ' + last3 + (last3 % 8 === 0 ? ' (divisible by 8)' : ' (not divisible by 8)');
        } else if (d === 7) {
            var rest = Math.floor(n / 10);
            var last = digits[digits.length - 1];
            var result = rest - 2 * last;
            explanation = 'Double last digit (' + last + '\u00d72=' + (2*last) + '), subtract from rest (' + rest + '): ' + rest + ' \u2212 ' + (2*last) + ' = ' + result;
        } else if (d === 11) {
            var altSum = 0;
            var parts = [];
            for (var i = 0; i < digits.length; i++) {
                if (i % 2 === 0) { altSum += digits[i]; parts.push('' + digits[i]); }
                else { altSum -= digits[i]; parts.push('\u2212' + digits[i]); }
            }
            explanation = 'Alternating sum: ' + parts.join(' ') + ' = ' + altSum + (altSum % 11 === 0 ? ' (divisible by 11)' : ' (not divisible by 11)');
        }
        return { divisible: divisible, explanation: explanation };
    }

    function getAllFactorPairs(n) {
        var pairs = [];
        for (var i = 1; i * i <= n; i++) {
            if (n % i === 0) pairs.push([i, n / i]);
        }
        return pairs;
    }

    // ═══ UTILITY ═════════════════════════════════════════════════════════

    function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }

    function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ═══ HUD ═════════════════════════════════════════════════════════════

    function updateHUD() {
        $hudScore.textContent = state.score;
        $hudStreak.innerHTML = state.streak + (state.streak >= 3 ? '<span class="flame">&#128293;</span>' : '');
        $hudRank.textContent = RANKS[Math.min(state.currentLevel, RANKS.length - 1)];
    }

    // ═══ TIMER ═══════════════════════════════════════════════════════════

    function startTimer(seconds) {
        stopTimer();
        if (seconds <= 0) { $timerContainer.style.display = 'none'; return; }
        state.timerDuration = seconds * 1000;
        state.timerStart = Date.now();
        $timerContainer.style.display = 'block';
        $timerBar.style.width = '100%';
        $timerBar.className = 'timer-bar';
        state.timerID = setInterval(tickTimer, 50);
    }

    function tickTimer() {
        var elapsed = Date.now() - state.timerStart;
        var frac = Math.max(0, 1 - elapsed / state.timerDuration);
        $timerBar.style.width = (frac * 100) + '%';
        var secsLeft = Math.ceil((state.timerDuration - elapsed) / 1000);
        $timerText.textContent = secsLeft + 's';
        if (frac < 0.25) $timerBar.className = 'timer-bar danger';
        else if (frac < 0.5) $timerBar.className = 'timer-bar warning';
        else $timerBar.className = 'timer-bar';
        if (frac <= 0) { stopTimer(); onTimerExpired(); }
    }

    function stopTimer() {
        if (state.timerID) { clearInterval(state.timerID); state.timerID = null; }
    }

    function getTimerFraction() {
        if (!state.timerDuration) return 1;
        return Math.max(0, 1 - (Date.now() - state.timerStart) / state.timerDuration);
    }

    function onTimerExpired() {
        state.timerExpired++;
        state.streak = 0;
        showFeedback('Time\'s up!', 'wrong');
        sndWrong();
        state.questionActive = false;
        setTimeout(nextQuestion, 1200);
    }

    // ═══ SCORING ═════════════════════════════════════════════════════════

    function scoreAnswer(correct) {
        if (!correct) { state.streak = 0; sndStreakBreak(); return; }
        state.streak++;
        var mult = Math.min(state.streak, 4);
        var base = 100 * mult;
        var frac = getTimerFraction();
        var speed = frac > 0.75 ? 50 : frac > 0.5 ? 25 : 0;
        state.score += base + speed;
        sndCorrect();
    }

    // ═══ FEEDBACK & FACTS ════════════════════════════════════════════════

    function showFeedback(msg, type) {
        $feedback.textContent = msg;
        $feedback.className = 'question-feedback feedback-' + type;
    }

    function maybeShowFact() {
        state.correctSinceLastFact++;
        if (state.correctSinceLastFact >= 3) {
            state.correctSinceLastFact = 0;
            var fact = PRIME_FACTS[state.factIndex % PRIME_FACTS.length];
            state.factIndex++;
            $factToast.textContent = fact;
            $factToast.style.display = 'block';
            $factToast.classList.add('show');
            setTimeout(function(){ $factToast.classList.remove('show'); }, 3500);
            setTimeout(function(){ $factToast.style.display = 'none'; }, 4000);
        }
    }

    // ═══ CONFETTI ════════════════════════════════════════════════════════

    function launchConfetti() {
        $confetti.innerHTML = '';
        var colors = ['#00e676','#ffd740','#ff5252','#448aff','#e040fb','#fff'];
        for (var i = 0; i < 60; i++) {
            var p = document.createElement('div');
            p.className = 'confetti-piece';
            p.style.left = randInt(5, 95) + '%';
            p.style.background = colors[i % colors.length];
            p.style.animationDelay = (Math.random() * 0.8) + 's';
            p.style.animationDuration = (1.5 + Math.random()) + 's';
            p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            p.style.width = randInt(6, 10) + 'px';
            p.style.height = randInt(6, 10) + 'px';
            $confetti.appendChild(p);
        }
        setTimeout(function(){ $confetti.innerHTML = ''; }, 3000);
    }

    // ═══ LEVEL SELECT ════════════════════════════════════════════════════

    function showLevelSelect() {
        stopTimer();
        $hud.style.display = 'none';
        $timerContainer.style.display = 'none';
        $gameArea.style.display = 'none';
        $levelSelect.style.display = 'block';
        renderLevelGrid();
    }

    function renderLevelGrid() {
        $levelGrid.innerHTML = '';
        for (var i = 0; i < TOTAL_LEVELS; i++) {
            var lp = state.levelProgress[i];
            var card = document.createElement('div');
            card.className = 'level-card' + (lp.unlocked ? '' : ' locked') + (lp.stars > 0 ? ' completed' : '');
            var starsHTML = '';
            if (lp.unlocked) {
                for (var s = 1; s <= 3; s++)
                    starsHTML += '<span class="' + (s <= lp.stars ? 'star-filled' : 'star-empty') + '">&#9733;</span>';
            }
            card.innerHTML =
                '<div class="level-num">' + (lp.unlocked ? (i + 1) : '<span class="lock-icon">&#128274;</span>') + '</div>' +
                '<div class="level-title">' + LEVEL_NAMES[i] + '</div>' +
                '<div class="level-rank">' + RANKS[i] + '</div>' +
                (starsHTML ? '<div class="level-stars">' + starsHTML + '</div>' : '');
            if (lp.unlocked) {
                card.dataset.level = i;
                card.addEventListener('click', onLevelClick);
            }
            $levelGrid.appendChild(card);
        }
    }

    function onLevelClick(e) {
        var el = e.currentTarget;
        var lvl = parseInt(el.dataset.level);
        startLevel(lvl);
    }

    // ═══ START / END LEVEL ═══════════════════════════════════════════════

    function startLevel(lvl) {
        state.currentLevel = lvl;
        state.currentRound = 0;
        state.questionIndex = 0;
        state.correct = 0;
        state.total = 0;
        state.timerExpired = 0;
        state.score = 0;
        state.streak = 0;
        state.tutorialStep = 0;
        state.tutorialDone = false;
        state.sieveState = null;
        state.questionActive = false;

        $levelSelect.style.display = 'none';
        $gameArea.style.display = 'block';
        $hud.style.display = 'flex';
        updateHUD();

        if (TUTORIALS[lvl]) {
            showTutorial(lvl);
        } else {
            showRoundSelect();
        }
    }

    function showRoundSelect() {
        $tutorialPanel.style.display = 'none';
        $questionArea.style.display = 'block';
        $levelComplete.style.display = 'none';
        $feedback.textContent = '';

        var roundLabels = ['A','B','C'];
        var html = '<div class="round-select">';
        for (var i = 0; i < 3; i++)
            html += '<button class="round-btn' + (i === 0 ? ' active' : '') + '" data-round="' + i + '">Round ' + roundLabels[i] + '</button>';
        html += '</div>';
        $questionPrompt.innerHTML = '<strong>Level ' + (state.currentLevel + 1) + ': ' + LEVEL_NAMES[state.currentLevel] + '</strong>' + html;
        $questionVisual.innerHTML = '';
        $answerButtons.innerHTML = '<button class="btn btn-primary" id="start-round-btn">Start</button>';
        $progress.textContent = '';

        var roundBtns = $questionPrompt.querySelectorAll('.round-btn');
        roundBtns.forEach(function(b) {
            b.addEventListener('click', function() {
                roundBtns.forEach(function(x){ x.classList.remove('active'); });
                b.classList.add('active');
                state.currentRound = parseInt(b.dataset.round);
            });
        });

        document.getElementById('start-round-btn').addEventListener('click', function() {
            state.questionIndex = 0;
            state.correct = 0;
            state.total = 0;
            state.timerExpired = 0;
            nextQuestion();
        });
    }

    function endLevel() {
        stopTimer();
        $timerContainer.style.display = 'none';
        $questionArea.style.display = 'none';
        $levelComplete.style.display = 'block';
        state.questionActive = false;

        var accuracy = state.total > 0 ? state.correct / state.total : 0;
        var stars = 1;
        if (accuracy >= 0.8) stars = 2;
        if (accuracy >= 0.9 && state.timerExpired === 0) stars = 3;

        var lp = state.levelProgress[state.currentLevel];
        if (stars > lp.stars) lp.stars = stars;
        if (state.score > lp.bestScore) lp.bestScore = state.score;

        // Unlock next level
        if (state.currentLevel < TOTAL_LEVELS - 1) {
            state.levelProgress[state.currentLevel + 1].unlocked = true;
        }
        saveProgress();

        $completeTitle.textContent = 'Level ' + (state.currentLevel + 1) + ' Complete!';
        var starsHTML = '';
        for (var s = 1; s <= 3; s++)
            starsHTML += '<span class="' + (s <= stars ? 'star-filled' : 'star-empty') + '">&#9733;</span>';
        $completeStars.innerHTML = starsHTML;
        $completeStats.innerHTML =
            'Score: <span>' + state.score + '</span><br>' +
            'Accuracy: <span>' + Math.round(accuracy * 100) + '%</span><br>' +
            'Rank: <span>' + RANKS[Math.min(state.currentLevel, TOTAL_LEVELS - 1)] + '</span>';

        launchConfetti();
        sndLevelUp();
    }

    $completeNext.addEventListener('click', showLevelSelect);
    $hudBack.addEventListener('click', showLevelSelect);

    // ═══ QUESTION FLOW ═══════════════════════════════════════════════════

    function nextQuestion() {
        stopTimer();
        var count = LEVEL_COUNTS[state.currentLevel];
        // Sieve is 1 question (the whole grid)
        if (state.currentLevel === 5) count = 1;

        if (state.questionIndex >= count) { endLevel(); return; }

        $questionArea.style.display = 'block';
        $levelComplete.style.display = 'none';
        $tutorialPanel.style.display = 'none';
        $feedback.textContent = '';
        state.questionActive = true;
        updateHUD();

        var timer = LEVEL_TIMERS[state.currentLevel];
        $progress.textContent = 'Question ' + (state.questionIndex + 1) + ' / ' + count;

        switch (state.currentLevel) {
            case 0: renderLevel1(); break;
            case 1: renderLevelMultTables(); break;
            case 2: renderLevelDivRules(); break;
            case 3: renderLevel2(); break;
            case 4: renderLevelFactors(); break;
            case 5: renderLevel3(); break;
            case 6: renderLevel4(); break;
            case 7: renderLevel5(); break;
            case 8: renderLevelGCD(); break;
            case 9: renderLevelLCM(); break;
            case 10: renderLevelFermat(); break;
            case 11: renderLevelCarmichael(); break;
            case 12: renderLevelModArith(); break;
            case 13: renderLevelEulerTotient(); break;
            case 14: renderLevelPascalIntro(); break;
            case 15: renderLevelPascalPrimes(); break;
            case 16: renderLevelPolynomials(); break;
            case 17: renderLevelBinomial(); break;
            case 18: renderLevelPolyFermat(); break;
            case 19: renderLevelAKS(); break;
            case 20: renderLevelMillerRabin(); break;
            case 21: renderLevelRSA(); break;
            case 22: renderLevelMersenne(); break;
        }

        if (timer > 0) startTimer(timer);
    }

    function handleAnswer(correct, explanation) {
        if (!state.questionActive) return;
        state.questionActive = false;
        stopTimer();
        state.total++;
        if (correct) {
            state.correct++;
            scoreAnswer(true);
            showFeedback(explanation || 'Correct!', 'correct');
            maybeShowFact();
        } else {
            scoreAnswer(false);
            showFeedback(explanation || 'Wrong!', 'wrong');
        }
        updateHUD();
        // Disable answer buttons
        var btns = $answerButtons.querySelectorAll('button');
        btns.forEach(function(b){ b.disabled = true; });
        state.questionIndex++;
        setTimeout(nextQuestion, 1200);
    }

    // ═══ LEVEL 1: ODD OR EVEN ════════════════════════════════════════════

    function renderLevel1() {
        var ranges = [[1,20],[1,100],[100,999]];
        var r = ranges[state.currentRound] || ranges[0];
        var n = randInt(r[0], r[1]);

        $questionPrompt.innerHTML = 'Is this number <strong>ODD</strong> or <strong>EVEN</strong>?<span class="big-number">' + n + '</span>';
        $questionVisual.innerHTML = '';
        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="odd">ODD</button>' +
            '<button class="answer-btn" data-val="even">EVEN</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'even') === isEven(n);
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, n + ' is ' + (isEven(n) ? 'EVEN' : 'ODD') + (n > 2 && isEven(n) ? ' — so not prime!' : ''));
            });
        });
    }

    // ═══ LEVEL 1 (NEW): MULTIPLICATION TABLES ═════════════════════════════

    function renderLevelMultTables() {
        var ranges = [[2,5],[6,9],[10,15]];
        var r = ranges[state.currentRound] || ranges[0];
        var a = randInt(r[0], r[1]), b = randInt(r[0], r[1]);
        var correctVal = a * b;

        $questionPrompt.innerHTML = '<span class="big-number">' + a + ' &times; ' + b + ' = ?</span>';

        // Build a mini multiplication grid visual
        var gridSize = r[1];
        var html = '<div class="mult-grid" style="grid-template-columns:repeat(' + (gridSize - r[0] + 2) + ', 36px)">';
        // Header row
        html += '<div class="mult-cell header">&times;</div>';
        for (var c = r[0]; c <= r[1]; c++)
            html += '<div class="mult-cell header">' + c + '</div>';
        // Body rows
        for (var row = r[0]; row <= r[1]; row++) {
            html += '<div class="mult-cell header">' + row + '</div>';
            for (var col = r[0]; col <= r[1]; col++) {
                var isTarget = (row === a && col === b) || (row === b && col === a);
                html += '<div class="mult-cell' + (isTarget ? ' highlight' : '') + '">' + (isTarget ? '?' : row * col) + '</div>';
            }
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var wrong = correctVal + randInt(-10, 10);
            if (wrong > 0 && wrong !== correctVal && choices.indexOf(wrong) === -1) choices.push(wrong);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, a + ' \u00d7 ' + b + ' = ' + correctVal);
            });
        });
    }

    // ═══ LEVEL 2 (NEW): DIVISIBILITY RULES ═══════════════════════════════

    function renderLevelDivRules() {
        var divisorsPool = state.currentRound === 0 ? [2,3,5,10] :
                           state.currentRound === 1 ? [4,6,8,9] : [7,11];
        var d = pickRandom(divisorsPool);
        // Generate a number that may or may not be divisible
        var n;
        if (Math.random() < 0.5) {
            n = d * randInt(10, 99);
        } else {
            n = randInt(100, 999);
        }

        var ruleResult = getDivisibilityRule(n, d);

        $questionPrompt.innerHTML = 'Is <strong>' + n + '</strong> divisible by <strong>' + d + '</strong>?';

        // Show the rule being applied
        $questionVisual.innerHTML = '<div class="rule-display">' +
            '<div style="color:#3cf0ff;font-weight:700;margin-bottom:8px">Divisibility Rule for ' + d + ':</div>' +
            '<div style="color:#ddd;line-height:1.8">' + ruleResult.explanation + '</div>' +
            '</div>';

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="yes">YES — Divisible</button>' +
            '<button class="answer-btn" data-val="no">NO — Not Divisible</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'yes') === ruleResult.divisible;
                btn.classList.add(correct ? 'correct' : 'wrong');
                var msg = n + ' \u00f7 ' + d + ' = ' + (ruleResult.divisible ? (n / d) + ' (exact!)' : Math.floor(n / d) + ' remainder ' + (n % d));
                handleAnswer(correct, msg);
            });
        });
    }

    // ═══ LEVEL 4 (NEW): FINDING FACTORS ══════════════════════════════════

    function renderLevelFactors() {
        var ranges = [[10,30],[30,60],[60,99]];
        var r = ranges[state.currentRound] || ranges[0];
        var n = randInt(r[0], r[1]);
        var allPairs = getAllFactorPairs(n);

        $questionPrompt.innerHTML = 'Find <strong>ALL factor pairs</strong> of <span class="big-number">' + n + '</span>';

        var foundPairs = {};
        var totalPairs = allPairs.length;

        // Show the factor pair slots
        function renderFactorDisplay() {
            var html = '<div class="factor-pairs">';
            for (var i = 0; i < allPairs.length; i++) {
                var pair = allPairs[i];
                var key = pair[0] + 'x' + pair[1];
                if (foundPairs[key]) {
                    html += '<div class="factor-pair found">' + pair[0] + ' &times; ' + pair[1] + ' = ' + n + ' &#10003;</div>';
                } else {
                    html += '<div class="factor-pair">' + pair[0] + ' &times; ? = ' + n + '</div>';
                }
            }
            html += '</div>';
            $questionVisual.innerHTML = html;
        }

        renderFactorDisplay();

        // Generate buttons for possible small factors (1 to sqrt(n))
        var sqrtN = Math.floor(Math.sqrt(n));
        var html = '<div class="divisor-row">';
        for (var f = 1; f <= sqrtN; f++) {
            html += '<button class="divisor-btn factor-test" data-f="' + f + '">' + f + '</button>';
        }
        html += '</div><button class="btn btn-primary" id="factors-done" style="margin-top:14px">Done — Found All Pairs!</button>';
        $answerButtons.innerHTML = html;

        $answerButtons.querySelectorAll('.factor-test').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                var f = parseInt(btn.dataset.f);
                if (n % f === 0) {
                    var pair = f + 'x' + (n / f);
                    if (!foundPairs[pair]) {
                        foundPairs[pair] = true;
                        btn.classList.add('clear');
                        btn.textContent = f + ' \u00d7 ' + (n / f) + ' \u2713';
                        sndTick();
                        renderFactorDisplay();
                    }
                } else {
                    btn.classList.add('found');
                    btn.textContent = f + ' \u2717';
                    sndWrong();
                }
            });
        });

        document.getElementById('factors-done').addEventListener('click', function() {
            if (!state.questionActive) return;
            var foundCount = Object.keys(foundPairs).length;
            var correct = foundCount === totalPairs;
            if (correct) {
                handleAnswer(true, 'All ' + totalPairs + ' factor pairs of ' + n + ' found!');
            } else {
                handleAnswer(false, 'Found ' + foundCount + '/' + totalPairs + ' pairs. Missing some! ' + n + ' has factors: ' + allPairs.map(function(p) { return p[0] + '\u00d7' + p[1]; }).join(', '));
            }
        });
    }

    // ═══ LEVEL 3 (OLD 2): DIVISIBILITY DETECTIVE ═════════════════════════

    function renderLevel2() {
        var ranges = [[2,50],[2,150],[2,300]];
        var r = ranges[state.currentRound] || ranges[0];
        var divisors = state.currentRound === 0 ? [2,3,5] : [2,3,5,7,11,13];
        var n = randInt(r[0], r[1]);

        var actualPrime = trialDivision(n);
        var testedCount = 0;
        var totalDivisors = divisors.filter(function(d){ return d <= n; }).length;

        $questionPrompt.innerHTML =
            '<span class="big-number">' + n + '</span>' +
            '<strong>Step 1:</strong> Click each number below to divide ' + n + ' by it.<br>' +
            '<strong>Step 2:</strong> If a divisor goes in evenly (remainder 0), that means ' + n + ' is NOT prime.<br>' +
            '<strong>Step 3:</strong> If you\'ve tested all divisors and none work, click <strong>PRIME!</strong>';

        $questionVisual.innerHTML =
            '<div id="div-result" class="division-result" style="min-height:28px">Click a number below to try dividing ' + n + ' by it</div>' +
            '<div id="div-tracker" class="division-result" style="color:#888;font-size:0.85rem">Tested: 0 / ' + totalDivisors + '</div>';

        var html = '<div class="divisor-row">';
        for (var i = 0; i < divisors.length; i++) {
            if (divisors[i] <= n)
                html += '<button class="divisor-btn" data-d="' + divisors[i] + '">' + n + ' ÷ ' + divisors[i] + ' = ?</button>';
        }
        html += '</div><button class="answer-btn" data-val="prime" style="margin-top:14px">None divide evenly — it\'s PRIME!</button>';
        $answerButtons.innerHTML = html;

        var divResult = document.getElementById('div-result');
        var divTracker = document.getElementById('div-tracker');

        $answerButtons.querySelectorAll('.divisor-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                if (btn.classList.contains('found') || btn.classList.contains('clear')) return;
                var d = parseInt(btn.dataset.d);
                var q = Math.floor(n / d), rem = n % d;
                testedCount++;
                divTracker.textContent = 'Tested: ' + testedCount + ' / ' + totalDivisors;

                if (rem === 0) {
                    btn.classList.add('found');
                    btn.textContent = n + ' ÷ ' + d + ' = ' + q + ' ✓';
                    divResult.innerHTML = '<strong style="color:#ff5252">' + n + ' ÷ ' + d + ' = ' + q + ' exactly!</strong> So ' + n + ' = ' + d + ' × ' + q + ' — it\'s COMPOSITE!';
                    handleAnswer(true, n + ' = ' + d + ' × ' + q + ' — COMPOSITE! You found a divisor.');
                } else {
                    btn.classList.add('clear');
                    btn.textContent = n + ' ÷ ' + d + ' = ' + q + ' r' + rem;
                    divResult.innerHTML = n + ' ÷ ' + d + ' = ' + q + ' remainder <strong>' + rem + '</strong> — nope, ' + d + ' doesn\'t divide ' + n;
                }
                sndTick();
            });
        });

        $answerButtons.querySelector('[data-val="prime"]').addEventListener('click', function() {
            if (actualPrime) {
                handleAnswer(true, 'Correct! ' + n + ' is PRIME — no small prime divides it evenly.');
            } else {
                // Find a factor to show them what they missed
                var missed = '';
                for (var i = 0; i < divisors.length; i++) {
                    if (n % divisors[i] === 0) { missed = divisors[i]; break; }
                }
                handleAnswer(false, 'Not quite! ' + n + ' ÷ ' + missed + ' = ' + (n / missed) + ' — try clicking all divisors first.');
            }
        });
    }

    // ═══ LEVEL 3: SIEVE OF ERATOSTHENES ═════════════════════════════════

    function renderLevel3() {
        var limits = [30, 50, 100];
        var limit = limits[state.currentRound] || 30;
        var primeSet = {};
        sieve(limit).forEach(function(p){ primeSet[p] = true; });

        var cols = limit <= 30 ? 6 : 10;
        state.sieveState = {limit: limit, crossed: {}, primeSet: primeSet, cols: cols};
        $questionPrompt.innerHTML = '<strong>Sieve of Eratosthenes</strong><br>Click non-prime numbers to cross them out (e.g. 4, 6, 8... are multiples of 2). Leave primes standing, then click Done!';
        $progress.textContent = 'Grid: 2–' + limit;

        var html = '<div class="sieve-grid" style="grid-template-columns:repeat(' + cols + ',44px)">';
        for (var i = 1; i <= limit; i++) {
            var cls = i === 1 ? 'sieve-cell is-one' : 'sieve-cell';
            html += '<div class="' + cls + '" data-n="' + i + '">' + i + '</div>';
        }
        html += '</div><button class="btn btn-primary" id="sieve-done" style="margin-top:16px">Done!</button>';
        $questionVisual.innerHTML = html;
        $answerButtons.innerHTML = '';
        // Round-based timer: 90s for grid≤30, 120s for ≤50, 180s for 100
        var sieveTimers = [90, 120, 180];
        stopTimer();
        startTimer(sieveTimers[state.currentRound] || 45);

        $questionVisual.querySelectorAll('.sieve-cell:not(.is-one)').forEach(function(cell) {
            cell.addEventListener('click', function() {
                if (!state.questionActive) return;
                var n = parseInt(cell.dataset.n);
                if (state.sieveState.crossed[n]) return;
                if (primeSet[n]) {
                    // Wrongly clicked a prime — bounce
                    cell.classList.add('bounce');
                    sndWrong();
                    setTimeout(function(){ cell.classList.remove('bounce'); }, 400);
                } else {
                    state.sieveState.crossed[n] = true;
                    cell.classList.add('crossed');
                    sndTick();
                }
            });
        });

        document.getElementById('sieve-done').addEventListener('click', function() {
            if (!state.questionActive) return;
            // Check: all composites crossed, no primes crossed
            var allCrossed = true, primesOK = true;
            for (var i = 2; i <= limit; i++) {
                if (primeSet[i]) {
                    if (state.sieveState.crossed[i]) primesOK = false;
                } else {
                    if (!state.sieveState.crossed[i]) allCrossed = false;
                }
            }
            // Highlight primes green
            $questionVisual.querySelectorAll('.sieve-cell').forEach(function(cell) {
                var n = parseInt(cell.dataset.n);
                if (primeSet[n]) cell.classList.add('marked-prime');
            });

            var correct = allCrossed && primesOK;
            var msg = correct ? 'Perfect sieve!' : (!allCrossed ? 'Some composites were not crossed out.' : 'A prime was accidentally crossed!');
            handleAnswer(correct, msg);
        });
    }

    // ═══ LEVEL 4: PERFECT POWER SPOTTER ══════════════════════════════════

    function renderLevel4() {
        var ranges = [[4,144],[4,1000],[4,10000]];
        var r = ranges[state.currentRound] || ranges[0];
        // Mix of perfect powers and non-powers
        var n;
        if (Math.random() < 0.5) {
            // Generate a perfect power
            var bases = state.currentRound === 0 ? [2,3,4,5,6,7,8,9,10,11,12] : [2,3,4,5,6,7,8,9,10];
            var exps = state.currentRound <= 1 ? [2,3] : [2,3,4,5];
            var b = pickRandom(bases), e = pickRandom(exps);
            n = Math.pow(b, e);
            if (n > r[1]) n = randInt(r[0], r[1]);
        } else {
            n = randInt(r[0], r[1]);
        }

        var pp = isPerfectPower(n);
        $questionPrompt.innerHTML = 'Is this a <strong>perfect power</strong>? A perfect power is a number like 8 = 2<sup>3</sup> or 25 = 5<sup>2</sup>. Use the sliders to find a<sup>b</sup> = n, or declare it\'s not one.<span class="big-number">' + n + '</span>';

        var html = '<div class="power-controls">' +
            '<div class="slider-group"><label>Base (a)</label><input type="range" id="base-slider" min="2" max="100" value="2"><div class="slider-val" id="base-val">2</div></div>' +
            '<div class="slider-group"><label>Exponent (b)</label><input type="range" id="exp-slider" min="2" max="10" value="2"><div class="slider-val" id="exp-val">2</div></div>' +
            '</div><div class="power-result" id="power-result">2<sup>2</sup> = 4</div>' +
            '<div class="power-grid" id="power-grid"></div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="match">That\'s it!</button>' +
            '<button class="answer-btn" data-val="not">NOT a Perfect Power</button>';

        var baseSlider = document.getElementById('base-slider');
        var expSlider = document.getElementById('exp-slider');
        var baseVal = document.getElementById('base-val');
        var expVal = document.getElementById('exp-val');
        var powerResult = document.getElementById('power-result');
        var powerGrid = document.getElementById('power-grid');

        function updatePower() {
            var b = parseInt(baseSlider.value), e = parseInt(expSlider.value);
            baseVal.textContent = b; expVal.textContent = e;
            var val = Math.pow(b, e);
            var match = val === n;
            powerResult.innerHTML = b + '<sup>' + e + '</sup> = ' + val +
                (match ? ' <span class="match">= ' + n + '!</span>' : ' <span class="no-match">≠ ' + n + '</span>');
            // Visual blocks
            var count = Math.min(val, 200);
            powerGrid.innerHTML = '';
            for (var i = 0; i < count; i++) {
                var block = document.createElement('div');
                block.className = 'power-block';
                block.style.background = match ? '#00e676' : '#1a3a5c';
                powerGrid.appendChild(block);
            }
        }
        baseSlider.addEventListener('input', updatePower);
        expSlider.addEventListener('input', updatePower);
        updatePower();

        $answerButtons.querySelector('[data-val="match"]').addEventListener('click', function() {
            var b = parseInt(baseSlider.value), e = parseInt(expSlider.value);
            var val = Math.pow(b, e);
            var correct = val === n && pp !== null;
            handleAnswer(correct, correct ? n + ' = ' + b + '^' + e : (pp ? n + ' = ' + pp.base + '^' + pp.exp : n + ' is not a perfect power'));
        });
        $answerButtons.querySelector('[data-val="not"]').addEventListener('click', function() {
            handleAnswer(!pp, pp ? n + ' = ' + pp.base + '^' + pp.exp + ' — it IS a perfect power!' : 'Correct! ' + n + ' is NOT a perfect power.');
        });
    }

    // ═══ LEVEL 5: TRIAL DIVISION ═════════════════════════════════════════

    function renderLevel5() {
        var ranges = [[2,100],[2,500],[2,2000]];
        var r = ranges[state.currentRound] || ranges[0];
        var n = randInt(r[0], r[1]);
        var sqrtN = Math.floor(Math.sqrt(n));
        var primesUpTo = sieve(sqrtN);
        var actualPrime = trialDivision(n);

        // Find actual factors for educational display
        var smallFactor = 0, bigFactor = 0;
        if (!actualPrime) {
            for (var f = 2; f <= sqrtN; f++) {
                if (n % f === 0) { smallFactor = f; bigFactor = n / f; break; }
            }
        }

        // Count total factors for the insight
        var factorCount = 0;
        for (var f = 1; f * f <= n; f++) {
            if (n % f === 0) { factorCount += (f * f === n) ? 1 : 2; }
        }

        $questionPrompt.innerHTML =
            '<span class="big-number">' + n + '</span>';

        // Sqrt insight box
        var insightHTML = '<div class="sqrt-insight">' +
            '<div class="sqrt-indicator">&radic;' + n + ' = ' + Math.sqrt(n).toFixed(2) + '&ensp;&rarr;&ensp;floor = <strong>' + sqrtN + '</strong></div>' +
            '<div style="font-size:0.88rem;color:#ccc;margin:8px 0;line-height:1.7;text-align:left;max-width:500px;margin-left:auto;margin-right:auto">' +
            '<strong style="color:#3cf0ff">Why only check up to &radic;n?</strong> Factors come in pairs. ' +
            'If ' + n + ' = a &times; b, then one of them must be &le; &radic;' + n + ' (' + sqrtN + ') ' +
            'and the other must be &ge; &radic;' + n + '.' +
            (actualPrime ? '' : '<br>Example: ' + n + ' = <strong>' + smallFactor + '</strong> &times; <strong>' + bigFactor + '</strong> &mdash; ' +
                smallFactor + ' &le; ' + sqrtN + ' and ' + bigFactor + ' &ge; ' + sqrtN) +
            '<br>So you never need to check more than <strong>' + primesUpTo.length + ' primes</strong> (the primes up to ' + sqrtN + ')!' +
            '</div></div>';

        $questionVisual.innerHTML = insightHTML +
            '<div style="font-size:0.95rem;color:#ddd;margin:12px 0"><strong>Click each prime to test it as a divisor. If you find one that divides evenly, ' + n + ' is composite. If none work, it\'s prime!</strong></div>' +
            '<div id="div-result" class="division-result" style="min-height:28px"></div>';

        var html = '<div class="divisor-row">';
        for (var i = 0; i < primesUpTo.length && i < 20; i++)
            html += '<button class="divisor-btn" data-d="' + primesUpTo[i] + '">' + n + ' ÷ ' + primesUpTo[i] + ' = ?</button>';
        html += '</div><button class="answer-btn" data-val="prime" style="margin-top:14px">Tested all — it\'s PRIME!</button>';
        $answerButtons.innerHTML = html;

        var divResult = $questionVisual.querySelector('#div-result');

        $answerButtons.querySelectorAll('.divisor-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                if (btn.classList.contains('found') || btn.classList.contains('clear')) return;
                var d = parseInt(btn.dataset.d);
                var q = Math.floor(n / d), rem = n % d;
                if (rem === 0) {
                    btn.classList.add('found');
                    btn.textContent = n + ' ÷ ' + d + ' = ' + q + ' ✓';
                    divResult.innerHTML = '<strong style="color:#ff8a80">' + n + ' ÷ ' + d + ' = ' + q + ' exactly!</strong><br>' +
                        d + ' &le; &radic;' + n + ' and ' + q + ' &ge; &radic;' + n + ' — a factor pair!';
                    handleAnswer(true, n + ' = ' + d + ' × ' + q + ' — COMPOSITE! The small factor ' + d + ' ≤ √' + n + ', the big factor ' + q + ' ≥ √' + n + '.');
                } else {
                    btn.classList.add('clear');
                    btn.textContent = n + ' ÷ ' + d + ' = ' + q + ' r' + rem;
                    divResult.textContent = n + ' ÷ ' + d + ' = ' + q + ' remainder ' + rem + ' — not a factor';
                    sndTick();
                }
            });
        });

        $answerButtons.querySelector('[data-val="prime"]').addEventListener('click', function() {
            if (actualPrime) {
                handleAnswer(true, n + ' is PRIME! No prime ≤ ' + sqrtN + ' divides it, so no factor pair exists.');
            } else {
                handleAnswer(false, 'Not quite! Try ' + n + ' ÷ ' + smallFactor + ' = ' + bigFactor + '. The small factor ' + smallFactor + ' is ≤ √' + n + '.');
            }
        });
    }

    // ═══ TUTORIALS (Levels 6, 7, 8) ══════════════════════════════════════

    var TUTORIALS = {
        2: [ // Divisibility Rules
            '<h3>Divisibility Rules: Quick Tests</h3>Instead of doing long division, there are clever shortcuts to tell if a number divides evenly into another. Let\'s learn the easy ones first!<div class="example"><strong>Rule for 2:</strong> Last digit is even (0, 2, 4, 6, 8)<br>&nbsp;&nbsp;246 → last digit 6 → divisible by 2 ✓<br><br><strong>Rule for 5:</strong> Last digit is 0 or 5<br>&nbsp;&nbsp;735 → last digit 5 → divisible by 5 ✓<br><br><strong>Rule for 10:</strong> Last digit is 0<br>&nbsp;&nbsp;340 → last digit 0 → divisible by 10 ✓<br><br><strong>Rule for 3:</strong> Sum of digits is divisible by 3<br>&nbsp;&nbsp;123 → 1+2+3 = 6, and 6÷3 = 2 → divisible by 3 ✓</div>',

            '<h3>Medium Rules: 4, 6, 8, 9</h3><div class="example"><strong>Rule for 4:</strong> Last TWO digits form a number divisible by 4<br>&nbsp;&nbsp;1,324 → last two digits "24" → 24÷4 = 6 ✓<br><br><strong>Rule for 6:</strong> Divisible by BOTH 2 and 3<br>&nbsp;&nbsp;114 → even ✓ and 1+1+4 = 6, 6÷3 = 2 ✓ → divisible by 6 ✓<br><br><strong>Rule for 8:</strong> Last THREE digits form a number divisible by 8<br>&nbsp;&nbsp;1,160 → last three "160" → 160÷8 = 20 ✓<br><br><strong>Rule for 9:</strong> Sum of digits is divisible by 9<br>&nbsp;&nbsp;738 → 7+3+8 = 18 → 18÷9 = 2 ✓</div>',

            '<h3>Hard Rules: 7 and 11</h3><div class="example"><strong>Rule for 7:</strong> Double the last digit, subtract from the rest. If result is divisible by 7, so is the original.<br>&nbsp;&nbsp;203 → last digit 3, double it → 6. Remove last digit → 20. 20 − 6 = 14. 14÷7 = 2 ✓<br>&nbsp;&nbsp;So 203 is divisible by 7!<br><br><strong>Rule for 11:</strong> Alternating sum of digits (subtract, add, subtract...)<br>&nbsp;&nbsp;2728 → 2 − 7 + 2 − 8 = −11, and −11÷11 = −1 ✓<br>&nbsp;&nbsp;So 2728 is divisible by 11!<br><br>&nbsp;&nbsp;Try 123: 1 − 2 + 3 = 2. 2 is not divisible by 11 ✗</div>These tricks save time — especially useful when checking if a big number is prime!',
        ],
        4: [ // Finding Factors
            '<h3>Finding Factor Pairs</h3>A <strong>factor</strong> of a number divides it with no remainder. Factors always come in pairs!<div class="example"><strong>Factors of 12:</strong><br>1 × 12 = 12 → pair (1, 12)<br>2 × 6 = 12 → pair (2, 6)<br>3 × 4 = 12 → pair (3, 4)<br><br>All factors of 12: {1, 2, 3, 4, 6, 12}</div>To find ALL factor pairs, start at 1 and work up. Stop when the smaller factor would be bigger than &radic;n!',

            '<h3>The Systematic Approach</h3><div class="example"><strong>Find all factors of 24:</strong><br>1 × 24 ✓ &nbsp; (1 ≤ &radic;24 ≈ 4.9)<br>2 × 12 ✓ &nbsp; (2 ≤ 4.9)<br>3 × 8 &nbsp;✓ &nbsp; (3 ≤ 4.9)<br>4 × 6 &nbsp;✓ &nbsp; (4 ≤ 4.9)<br>5 × ? &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (24÷5 = 4.8, not whole ✗)<br><br>Stop! Next would be 5 > &radic;24. We\'ve found them all!<br>Factor pairs: (1,24), (2,12), (3,8), (4,6)</div><div class="formula">You only need to check up to &radic;n to find all factor pairs.</div>',
        ],
        8: [ // GCD: Euclid's Algorithm
            '<h3>GCD — Greatest Common Divisor</h3><div class="formula">GCD(a, b) = the biggest number that divides both a and b</div>Imagine you and your friend both have candy bars. Yours has <strong>12</strong> squares, theirs has <strong>8</strong>. You want to break both bars into equal-sized pieces with <strong>no leftovers</strong>. What\'s the biggest piece size that works?<div class="example">Try size 4: &nbsp; 12 ÷ 4 = 3 pieces ✓ &nbsp; 8 ÷ 4 = 2 pieces ✓<br>Try size 5: &nbsp; 12 ÷ 5 = 2 pieces + 2 left over ✗<br>Try size 6: &nbsp; 12 ÷ 6 = 2 pieces ✓ &nbsp; 8 ÷ 6 = 1 piece + 2 left over ✗<br><br>Biggest that works: <strong>4</strong> → GCD(12, 8) = 4</div>But checking every size is slow. There\'s a 2000-year-old shortcut...',

            '<h3>Euclid\'s Trick</h3><div class="formula">GCD(a, b) = GCD(b, a mod b)</div>Swap the pair for a smaller one — the GCD stays the same! Keep going until the remainder is 0. The last nonzero remainder is the GCD.<br><br>But <em>why</em> does this magic trick actually work? Let\'s find out with a chocolate bar...',

            '<h3>The Chocolate Bar Proof</h3>Imagine a chocolate bar <strong>48 squares long</strong>. You want to snap off pieces that are <strong>18 squares</strong> each. Let\'s learn the math words as we go!<div class="example">The bar you\'re dividing up: <strong>48</strong> — this is called the <strong>dividend</strong><br>The piece size you\'re snapping off: <strong>18</strong> — this is called the <strong>divisor</strong><br><br><strong>Step 1:</strong> Snap! You break off 18 squares. Bar left: 48 − 18 = 30<br><strong>Step 2:</strong> Snap! Another 18 squares. Bar left: 30 − 18 = 12<br><strong>Step 3:</strong> Can\'t snap off 18 — only 12 squares left!<br><br>Number of whole pieces you snapped off: <strong>2</strong> — this is the <strong>quotient</strong><br>The stubby bit left over: <strong>12</strong> — this is the <strong>remainder</strong></div><div class="formula">dividend = quotient × divisor + remainder<br>48 = 2 × 18 + 12</div>That leftover <strong>12</strong> is what we write as <em>48 mod 18 = 12</em>. Now here\'s the magic part...',

            '<h3>Why the Leftover Holds the Answer</h3>From the chocolate bar, we got:<div class="formula">48 = 2 × 18 + 12</div>Now let\'s play a game. Suppose there\'s a mystery number <strong>d</strong> that divides both 48 and 18 evenly. Let\'s pick <strong>d = 6</strong> as our example and see what happens:<div class="example"><strong>Does d = 6 divide the dividend 48?</strong><br>&nbsp;&nbsp;48 ÷ 6 = 8 &nbsp; (yes, exactly 8 groups of 6!) ✓<br><br><strong>Does d = 6 divide the divisor 18?</strong><br>&nbsp;&nbsp;18 ÷ 6 = 3 &nbsp; (yes, exactly 3 groups of 6!) ✓<br><br><strong>Does d = 6 divide quotient × divisor = 2 × 18 = 36?</strong><br>&nbsp;&nbsp;If 6 goes into 18 exactly, then 6 goes into 2 × 18 exactly too!<br>&nbsp;&nbsp;36 ÷ 6 = 6 ✓</div>Now here\'s the key step. Let\'s <strong>rearrange</strong> our equation to isolate the remainder. We start with:<div class="example"><strong>Before:</strong> &nbsp; 48 = 2 × 18 + 12<br><br>Move "2 × 18" to the other side by subtracting it from both sides:<br><br><strong>After:</strong> &nbsp;&nbsp; 48 − 2 × 18 = 12<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 48 − 36 &nbsp;&nbsp;&nbsp;&nbsp; = 12<br><br>So the remainder 12 = (dividend) minus (quotient × divisor)</div>Now the punchline: <strong>can d = 6 divide 12?</strong><div class="example">We know: &nbsp; 48 ÷ 6 = <strong>8</strong> (a whole number)<br>We know: &nbsp; 36 ÷ 6 = <strong>6</strong> (a whole number)<br><br>So: 12 ÷ 6 = (48 − 36) ÷ 6 = 48÷6 − 36÷6 = 8 − 6 = <strong>2</strong><br><br>2 is a whole number! So yes, d = 6 divides 12! ✓</div>This works for <em>any</em> d that divides both 48 and 18 — not just 6. A whole number minus a whole number is always a whole number. So the GCD didn\'t change — it\'s hiding in the smaller pair!<div class="formula">GCD(48, 18) = GCD(18, 12)</div>',

            '<h3>Keep Chopping the Chocolate!</h3>Now we repeat the trick — but here\'s the pattern: each round, the <strong>old divisor becomes the new dividend</strong>, and the <strong>old remainder becomes the new divisor</strong>. Watch carefully:<div class="example"><strong>══ Round 1 ══</strong><br>Chocolate bar (dividend): <strong>48</strong> &nbsp; Piece size (divisor): <strong>18</strong><br><br>How many 18s fit in 48? → 48 ÷ 18 = 2 remainder 12<br>&nbsp;&nbsp;Check: 2 × 18 = 36, and 48 − 36 = 12 ✓<br><br>&nbsp;&nbsp;📦 48 = [18][18][12 left over]<br><br>quotient = 2, remainder = <strong>12</strong><br>We proved: GCD(48, 18) = GCD(18, 12)</div><div class="example"><strong>══ Round 2 ══</strong><br>The old divisor 18 is now our new dividend.<br>The old remainder 12 is now our new divisor.<br><br>Chocolate bar (dividend): <strong>18</strong> &nbsp; Piece size (divisor): <strong>12</strong><br><br>How many 12s fit in 18? → 18 ÷ 12 = 1 remainder 6<br>&nbsp;&nbsp;Check: 1 × 12 = 12, and 18 − 12 = 6 ✓<br><br>&nbsp;&nbsp;📦 18 = [12][6 left over]<br><br>quotient = 1, remainder = <strong>6</strong><br>We proved: GCD(18, 12) = GCD(12, 6)</div><div class="example"><strong>══ Round 3 ══</strong><br>Again: old divisor 12 → new dividend. Old remainder 6 → new divisor.<br><br>Chocolate bar (dividend): <strong>12</strong> &nbsp; Piece size (divisor): <strong>6</strong><br><br>How many 6s fit in 12? → 12 ÷ 6 = 2 remainder 0<br>&nbsp;&nbsp;Check: 2 × 6 = 12, and 12 − 12 = 0 ✓<br><br>&nbsp;&nbsp;📦 12 = [6][6] &nbsp; ← fits perfectly, nothing left over!<br><br>quotient = 2, remainder = <strong>0</strong><br>STOP! When remainder = 0, the last divisor is the GCD!</div><div class="formula">GCD(48, 18) = GCD(18, 12) = GCD(12, 6) = <strong>6</strong></div>Think of it like this: we kept snapping off pieces and the leftover kept shrinking — 48, 18, 12, 6 — until one piece fit perfectly into the other with nothing left. That perfect piece size is the GCD!',

            '<h3>Vocab Recap</h3>Let\'s lock in those four words with one more example — 29 ÷ 7:<div class="example"><strong>Dividend:</strong> &nbsp; 29 &nbsp; — the number being divided (your chocolate bar)<br><strong>Divisor:</strong> &nbsp;&nbsp; 7 &nbsp;&nbsp; — the number you\'re dividing by (piece size)<br><strong>Quotient:</strong> &nbsp; 4 &nbsp;&nbsp; — how many whole pieces fit (29 ÷ 7 = 4.something)<br><strong>Remainder:</strong> 1 &nbsp;&nbsp; — what\'s left over (29 − 4 × 7 = 1)</div><div class="formula">dividend = quotient × divisor + remainder<br>29 = 4 × 7 + 1</div>You\'ll use these words everywhere in math. Division isn\'t just "what\'s 29 ÷ 7?" — it\'s really asking "how many 7s fit in 29, and what\'s left?"',

            '<h3>Coprime Numbers</h3>When GCD(a, b) = 1, we say a and b are <strong>coprime</strong> — they\'re like strangers who share nothing in common except 1!<div class="example"><strong>Coprime pairs:</strong><br>8 and 15 → factors of 8: {1,2,4,8} &nbsp; factors of 15: {1,3,5,15} → only <strong>1</strong> in common ✓<br>9 and 25 → factors of 9: {1,3,9} &nbsp;&nbsp;&nbsp; factors of 25: {1,5,25} &nbsp;→ only <strong>1</strong> in common ✓<br>7 and 20 → 7 is prime and doesn\'t divide 20 → coprime! ✓<br><br><strong>NOT coprime:</strong><br>12 and 18 → both divisible by <strong>6</strong> → GCD = 6, not coprime ✗<br>14 and 21 → both divisible by <strong>7</strong> → GCD = 7, not coprime ✗</div><strong>Quick rule:</strong> Any prime number p is coprime with every number that isn\'t a multiple of p!',

            '<h3>Coprime Riddles</h3>Can you figure these out? (Answers below — no peeking!)<div class="example"><strong>Riddle 1:</strong> I\'m coprime with every even number. I\'m the smallest odd number greater than 1. Who am I?<br><br><strong>Riddle 2:</strong> I have exactly 2 factors. I\'m coprime with 100. I\'m between 10 and 20. There are two of us — who are we?<br><br><strong>Riddle 3:</strong> Pick any two consecutive numbers (like 7 and 8, or 41 and 42). Are they coprime? Always? Why?</div><div class="example" style="border-left-color:#ffd740"><strong>Answers:</strong><br>1. <strong>3</strong> — it\'s odd, so it shares no factor of 2 with any even number.<br>2. <strong>11 and 13</strong> — they\'re prime and don\'t divide 100 (= 2² × 5²).<br>3. <strong>Always yes!</strong> If d divides both n and n+1, then d divides (n+1) − n = 1. So d = 1. Consecutive numbers are always coprime!</div>This "coprime" idea is the key to Fermat\'s theorem coming up — it only works when GCD(a, p) = 1!',
        ],
        9: [ // LCM: Least Common Multiple
            '<h3>LCM — The Meeting Point</h3>Imagine two runners on a circular track. Runner A completes a lap every <strong>4 minutes</strong>. Runner B completes a lap every <strong>6 minutes</strong>. They start together — when will they <em>both</em> be at the starting line again at the same time?<div class="example">Runner A is at start at: 4, 8, <strong>12</strong>, 16, 20, <strong>24</strong>, ...<br>Runner B is at start at: 6, <strong>12</strong>, 18, <strong>24</strong>, 30, ...<br><br>First time they meet: <strong>12 minutes!</strong></div><div class="formula">LCM(a, b) = the smallest number that both a and b divide into evenly</div>LCM(4, 6) = 12 — the first "meeting point" of their multiples.',

            '<h3>The Shortcut: GCD to the Rescue!</h3>You <em>could</em> list all multiples until you find a match... but there\'s a much faster way. Remember GCD from the last level?<div class="formula">LCM(a, b) = a × b ÷ GCD(a, b)</div>It\'s like the chocolate bar in reverse — GCD tells you what they share, and that helps you find where they meet!<div class="example"><strong>Step 1:</strong> Find GCD(4, 6)<br>&nbsp;&nbsp;4 = 0 × 6 + 4 → wait, 4 &lt; 6, swap: GCD(6, 4)<br>&nbsp;&nbsp;6 = 1 × 4 + 2 &nbsp; (quotient = 1, remainder = 2)<br>&nbsp;&nbsp;4 = 2 × 2 + 0 &nbsp; (remainder = 0 → done!)<br>&nbsp;&nbsp;GCD = <strong>2</strong><br><br><strong>Step 2:</strong> Apply the formula<br>&nbsp;&nbsp;LCM = 4 × 6 ÷ 2 = 24 ÷ 2 = <strong>12</strong> ✓</div>',

            '<h3>Why Does the Formula Work?</h3>Think of it like pizza slices. If you cut one pizza into 4 slices and another into 6, the smallest number of slices where both pizzas "line up" depends on what they already share.<div class="example">4 = <strong>2</strong> × 2<br>6 = <strong>2</strong> × 3<br>They share a factor of <strong>2</strong> (that\'s the GCD!)<br><br>LCM needs all the factors, but counts shared ones only once:<br>LCM = 2 × 2 × 3 = <strong>12</strong><br><br>The formula a × b ÷ GCD removes the "double-counted" shared part.</div>',

            '<h3>LCM Riddle</h3><div class="example"><strong>Riddle:</strong> Two lighthouses blink at different rates. Lighthouse A blinks every <strong>8 seconds</strong>. Lighthouse B blinks every <strong>12 seconds</strong>. They just blinked together. In how many seconds will they blink together again?<br><br>Hint: find GCD(8, 12) first, then use the formula!</div><div class="example" style="border-left-color:#ffd740"><strong>Answer:</strong><br>GCD(8, 12): &nbsp; 12 = 1 × 8 + 4 → 8 = 2 × 4 + 0 → GCD = <strong>4</strong><br>LCM = 8 × 12 ÷ 4 = 96 ÷ 4 = <strong>24 seconds!</strong><br><br>They\'ll blink together every 24 seconds.</div>',
        ],
        10: [ // Fermat's Little Theorem
            '<h3>Fermat\'s Little Theorem</h3>Imagine a clock with <strong>p</strong> hours (instead of 12). You pick a number <strong>a</strong> and keep multiplying by it, wrapping around the clock each time. Fermat discovered something amazing:<div class="formula">If p is prime and GCD(a, p) = 1:<br>a<sup>p−1</sup> ≡ 1 (mod p)</div>No matter what a you pick (as long as it\'s coprime with p), after exactly <strong>p − 1</strong> multiplications, you <em>always</em> land back on <strong>1</strong>!',

            '<h3>The Clock Experiment: p = 5, a = 2</h3>Our clock has 5 hours (0, 1, 2, 3, 4). Start at 1, keep multiplying by 2, and wrap around mod 5:<div class="example"><strong>Start:</strong> &nbsp;&nbsp; 1<br><strong>× 2:</strong> &nbsp;&nbsp;&nbsp; 1 × 2 = <strong>2</strong> &nbsp;&nbsp;&nbsp; (2 mod 5 = 2)<br><strong>× 2:</strong> &nbsp;&nbsp;&nbsp; 2 × 2 = <strong>4</strong> &nbsp;&nbsp;&nbsp; (4 mod 5 = 4)<br><strong>× 2:</strong> &nbsp;&nbsp;&nbsp; 4 × 2 = 8 → <strong>3</strong> &nbsp; (8 mod 5 = 3)<br><strong>× 2:</strong> &nbsp;&nbsp;&nbsp; 3 × 2 = 6 → <strong>1</strong> &nbsp; (6 mod 5 = 1) ← back to 1!</div>After p − 1 = <strong>4 multiplications</strong>, we\'re back to 1. It\'s like the clock "resets." Fermat says this <em>always</em> happens when p is prime!',

            '<h3>Why? The Shuffling Trick</h3>Imagine 5 lockers numbered 1, 2, 3, 4 (skipping 0). Now multiply every locker number by 2, mod 5:<div class="example">Locker 1 → 1 × 2 = 2 (mod 5) = <strong>2</strong><br>Locker 2 → 2 × 2 = 4 (mod 5) = <strong>4</strong><br>Locker 3 → 3 × 2 = 6 (mod 5) = <strong>1</strong><br>Locker 4 → 4 × 2 = 8 (mod 5) = <strong>3</strong><br><br>Result: {2, 4, 1, 3} — it\'s the SAME lockers, just shuffled!</div>Multiplying by a doesn\'t create or destroy any locker — it just rearranges them. Since the product of all lockers stays the same (1×2×3×4 = 24 both ways), this forces a<sup>p−1</sup> = 1. Like a card shuffle that always returns the deck to its original order!',

            '<h3>Using Fermat as a Prime Detective</h3>Here\'s the clever part — we can <strong>test</strong> if a number n is prime!<div class="example"><strong>Method:</strong> Pick a base a (like 2). Compute a<sup>n−1</sup> mod n.<br><br><strong>If result ≠ 1:</strong> n is <strong>DEFINITELY composite!</strong><br>&nbsp;&nbsp;The clock didn\'t reset → n can\'t be prime.<br><br><strong>If result = 1:</strong> n is <strong>PROBABLY prime.</strong><br>&nbsp;&nbsp;The clock reset → but is it really prime, or just lucky?</div><div class="example" style="border-left-color:#ff5252"><strong>Warning: Fermat Liars!</strong><br>Some sneaky composite numbers (called <strong>Carmichael numbers</strong>) pass this test for <em>every</em> base! The number 561 = 3 × 11 × 17 fools Fermat every time. You\'ll meet them next level...</div>',
        ],
        11: [ // Carmichael Numbers
            '<h3>Carmichael Numbers: The Imposters</h3>In the last level, Fermat\'s test said "if a<sup>n−1</sup> ≡ 1 (mod n), then n is probably prime." But imagine a student who cheats on <em>every</em> exam and always gets 100% — they look like a genius, but they\'re not!<br><br>Carmichael numbers are the math version: <strong>composite</strong> numbers that pass Fermat\'s test for <strong>every single base</strong>. They\'re perfect imposters!',

            '<h3>Meet 561: The First Imposter</h3>561 looks prime to Fermat\'s test — but it\'s actually 3 × 11 × 17.<div class="example"><strong>Test base 2:</strong> &nbsp; 2<sup>560</sup> mod 561 = <strong>1</strong> ✓ "probably prime"<br><strong>Test base 3:</strong> &nbsp; 3<sup>560</sup> mod 561 = <strong>1</strong> ✓ "probably prime"<br><strong>Test base 5:</strong> &nbsp; 5<sup>560</sup> mod 561 = <strong>1</strong> ✓ "probably prime"<br><strong>Test base 7:</strong> &nbsp; 7<sup>560</sup> mod 561 = <strong>1</strong> ✓ "probably prime"<br><br>Every coprime base says "prime!" — but 561 = 3 × 11 × 17!</div>The "clock" resets every time, even though 561 isn\'t prime. Fermat is completely fooled!',

            '<h3>How to Spot an Imposter: Korselt\'s Rule</h3>A number n is a Carmichael number if and only if:<div class="example"><strong>Rule 1:</strong> n is composite (obviously — primes aren\'t imposters!)<br><strong>Rule 2:</strong> n is <strong>square-free</strong> — no prime factor repeats<br>&nbsp;&nbsp;561 = 3 × 11 × 17 ✓ (each prime appears once)<br><strong>Rule 3:</strong> For every prime factor p: (p − 1) divides (n − 1)<br>&nbsp;&nbsp;p = 3: &nbsp; (3 − 1) = 2 &nbsp; divides 560? 560 ÷ 2 = 280 ✓<br>&nbsp;&nbsp;p = 11: (11 − 1) = 10 divides 560? 560 ÷ 10 = 56 ✓<br>&nbsp;&nbsp;p = 17: (17 − 1) = 16 divides 560? 560 ÷ 16 = 35 ✓</div>All three rules pass — that\'s why 561 fools everyone!',

            '<h3>Why They Matter</h3>Carmichael numbers prove that Fermat\'s test alone isn\'t enough. We need <strong>stronger detective tools</strong> — like the Polynomial Fermat test and AKS that you\'ll learn soon.<div class="example"><strong>The first few imposters:</strong><br>561 = 3 × 11 × 17<br>1105 = 5 × 13 × 17<br>1729 = 7 × 13 × 19 &nbsp; (also the famous "taxicab number"!)<br>2465 = 5 × 17 × 29<br>2821 = 7 × 13 × 31</div>There are infinitely many Carmichael numbers — the imposters never stop coming! That\'s why mathematicians needed the AKS test: a detective that <em>never</em> gets fooled.',
        ],
        12: [ // Modular Arithmetic
            '<h3>Modular Arithmetic: Clock Math</h3>Remember Fermat\'s clock from the last levels? Now it\'s time to master the skill behind it: <strong>modular exponentiation</strong> — computing a<sup>b</sup> mod m, even when a and b are enormous!<div class="formula">a<sup>b</sup> mod m = ?</div><div class="example"><strong>3<sup>4</sup> mod 5:</strong><br>3<sup>1</sup> = 3<br>3<sup>2</sup> = 9 mod 5 = 4<br>3<sup>3</sup> = 3 \u00d7 4 = 12 mod 5 = 2<br>3<sup>4</sup> = 3 \u00d7 2 = 6 mod 5 = <strong>1</strong></div>We reduce at every step so numbers stay small. This is the secret that makes RSA encryption possible!',

            '<h3>The Square-and-Multiply Trick</h3>To compute a<sup>b</sup> mod m for large b, we don\'t multiply b times. Instead, we <strong>square repeatedly</strong> and multiply when needed, using the binary form of b.<div class="example"><strong>2<sup>10</sup> mod 13:</strong><br>10 in binary = 1010<br><br>Start with 1, read bits left-to-right:<br>Bit 1: square(1)=1, \u00d72=<strong>2</strong><br>Bit 0: square(2)=4<br>Bit 1: square(4)=16 mod 13=3, \u00d72=<strong>6</strong><br>Bit 0: square(6)=36 mod 13=<strong>10</strong><br><br>2<sup>10</sup> mod 13 = <strong>10</strong></div>Only 4 steps instead of 10 multiplications!',

            '<h3>Fermat\'s Shortcut for Huge Exponents</h3>When the modulus is prime, Fermat\'s Little Theorem gives you a superpower: a<sup>p\u22121</sup> \u2261 1 (mod p). So you can reduce the exponent first!<div class="example"><strong>What is 273246787654<sup>65536</sup> mod 65537?</strong><br><br>65537 is prime, and 65536 = 65537 \u2212 1<br>By Fermat: a<sup>65536</sup> \u2261 1 (mod 65537)<br>for any a not divisible by 65537.<br><br>GCD(273246787654, 65537) = 1 \u2713<br><br>Answer: <strong>1</strong> — instantly!</div><div class="formula">When p is prime: a<sup>p\u22121</sup> mod p = 1<br>When exponent = k(p\u22121) + r: a<sup>exp</sup> mod p = a<sup>r</sup> mod p</div>',

            '<h3>Reducing the Exponent</h3>For exponents that aren\'t exactly p\u22121, divide the exponent by p\u22121 and use the remainder:<div class="example"><strong>7<sup>100</sup> mod 13:</strong><br><br>13 is prime, so 7<sup>12</sup> \u2261 1 (mod 13)<br>100 = 8 \u00d7 12 + 4<br>So 7<sup>100</sup> = (7<sup>12</sup>)<sup>8</sup> \u00d7 7<sup>4</sup> \u2261 1<sup>8</sup> \u00d7 7<sup>4</sup> = 7<sup>4</sup> (mod 13)<br><br>7<sup>2</sup> = 49 mod 13 = 10<br>7<sup>4</sup> = 10<sup>2</sup> = 100 mod 13 = <strong>9</strong><br><br>7<sup>100</sup> mod 13 = <strong>9</strong></div>',
        ],
        13: [ // Euler's Totient Function
            '<h3>What is \u03c6(n)?</h3>Euler\'s totient function \u03c6(n) counts how many numbers from 1 to n are <strong>coprime</strong> with n (meaning their GCD is 1).<div class="example"><strong>\u03c6(8):</strong> Check each number 1\u20138:<br>GCD(1,8) = 1 \u2713 &nbsp; GCD(2,8) = 2 \u2717 &nbsp; GCD(3,8) = 1 \u2713 &nbsp; GCD(4,8) = 4 \u2717<br>GCD(5,8) = 1 \u2713 &nbsp; GCD(6,8) = 2 \u2717 &nbsp; GCD(7,8) = 1 \u2713 &nbsp; GCD(8,8) = 8 \u2717<br><br>Coprime numbers: {1, 3, 5, 7} \u2192 <strong>\u03c6(8) = 4</strong></div>',

            '<h3>Primes are Easy!</h3>For any prime p, every number from 1 to p\u22121 is coprime with p (since p has no factors other than 1 and itself).<div class="formula">\u03c6(p) = p \u2212 1 &nbsp; (for prime p)</div><div class="example">\u03c6(7) = 6 &nbsp; {1, 2, 3, 4, 5, 6} are all coprime with 7<br>\u03c6(13) = 12 &nbsp; all of {1, 2, ..., 12} are coprime with 13</div>',

            '<h3>The Product Formula</h3>For two distinct primes p and q, there\'s a beautiful shortcut:<div class="formula">\u03c6(p \u00d7 q) = (p\u22121)(q\u22121)</div><div class="example"><strong>\u03c6(15) = \u03c6(3 \u00d7 5)</strong><br>= (3\u22121)(5\u22121) = 2 \u00d7 4 = <strong>8</strong><br><br>Check: numbers 1\u201315 coprime with 15:<br>{1, 2, 4, 7, 8, 11, 13, 14} \u2192 exactly 8! \u2713</div>This formula is the heart of RSA encryption!',

            '<h3>Prime Powers</h3>For a prime raised to a power:<div class="formula">\u03c6(p<sup>k</sup>) = p<sup>k</sup> \u2212 p<sup>k\u22121</sup></div><div class="example"><strong>\u03c6(9) = \u03c6(3\u00b2)</strong><br>= 3\u00b2 \u2212 3\u00b9 = 9 \u2212 3 = <strong>6</strong><br><br>The non-coprime numbers are multiples of 3: {3, 6, 9}<br>That\'s 9/3 = 3 multiples, so 9 \u2212 3 = 6 coprimes. \u2713</div>',
        ],
        14: [ // Pascal's Triangle: The Pattern
            '<h3>Pascal\'s Triangle: The Magic Pyramid</h3>Imagine stacking a pyramid of blocks. The top block is <strong>1</strong>. Each block below holds the <strong>sum of the two blocks sitting on top of it</strong>:<div class="example pascal-tutorial-tri">Row 0: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1<br>Row 1: &nbsp;&nbsp;&nbsp;&nbsp;1 &nbsp;1<br>Row 2: &nbsp;&nbsp;&nbsp;1 &nbsp;2 &nbsp;1<br>Row 3: &nbsp;&nbsp;1 &nbsp;3 &nbsp;3 &nbsp;1<br>Row 4: &nbsp;1 &nbsp;4 &nbsp;6 &nbsp;4 &nbsp;1<br>Row 5: 1 &nbsp;5 &nbsp;10 10 &nbsp;5 &nbsp;1</div>This is Pascal\'s Triangle — named after Blaise Pascal, who studied it in 1653 (though Chinese mathematicians knew it 400 years earlier!).',

            '<h3>Building It Block by Block</h3>Think of it like making a pyramid of chocolate blocks. Each edge block is always <strong>1</strong> (one block wide). Every other block? Add the two blocks sitting above it!<div class="example"><strong>Building Row 4 from Row 3 (1, 3, 3, 1):</strong><br><br>Edge: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; → <strong>1</strong><br>Block above-left (1) + above-right (3) → <strong>4</strong><br>Block above-left (3) + above-right (3) → <strong>6</strong><br>Block above-left (3) + above-right (1) → <strong>4</strong><br>Edge: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; → <strong>1</strong><br><br>Row 4 = [1, 4, 6, 4, 1] ✓</div>',

            '<h3>Counting with the Triangle</h3>Each entry answers a counting question: <strong>"How many ways can I choose k items from n?"</strong><div class="formula">Row n, position k = C(n, k) = n! / (k! × (n−k)!)</div><div class="example"><strong>Ice cream example:</strong> You have 4 toppings. How many ways to pick 2?<br><br>C(4, 2) = Row 4, position 2 = <strong>6</strong><br><br>Check: {A,B} {A,C} {A,D} {B,C} {B,D} {C,D} = 6 ways ✓</div>The <strong>!</strong> symbol means <strong>factorial</strong>: 4! = 4 × 3 × 2 × 1 = 24. So C(4,2) = 24 / (2 × 2) = 6.',

            '<h3>Pascal\'s Triangle Riddles</h3><div class="example"><strong>Riddle 1:</strong> Add up all the numbers in Row 4: 1 + 4 + 6 + 4 + 1 = ?<br>Now try Row 3: 1 + 3 + 3 + 1 = ?<br>See a pattern? (Hint: powers of 2!)<br><br><strong>Riddle 2:</strong> Look at the diagonals going down-right:<br>Diagonal 1: 1, 1, 1, 1, 1, ... (boring!)<br>Diagonal 2: 1, 2, 3, 4, 5, ... (counting!)<br>Diagonal 3: 1, 3, 6, 10, 15, ...<br>What are those numbers in diagonal 3 called?</div><div class="example" style="border-left-color:#ffd740"><strong>Answers:</strong><br>1. Row sums are <strong>powers of 2!</strong> Row 4 = 16 = 2<sup>4</sup>. Row 3 = 8 = 2<sup>3</sup>. Row n sums to 2<sup>n</sup>.<br>2. <strong>Triangle numbers!</strong> 1, 3, 6, 10, 15... — the number of dots in each triangular arrangement.</div>',
        ],
        15: [ // Pascal's Triangle & Primes
            '<h3>Pascal\'s Secret Prime Detector</h3>Here\'s something amazing — Pascal\'s triangle can <strong>detect prime numbers</strong>! Look at row 5 and row 7:<div class="example"><strong>Row 5:</strong> 1, <strong>5</strong>, <strong>10</strong>, <strong>10</strong>, <strong>5</strong>, 1<br>Divide middle entries by 5: &nbsp; 5÷5=1 ✓ &nbsp; 10÷5=2 ✓ &nbsp; 10÷5=2 ✓ &nbsp; 5÷5=1 ✓<br>ALL divisible by 5! (And 5 is prime!)<br><br><strong>Row 7:</strong> 1, <strong>7</strong>, <strong>21</strong>, <strong>35</strong>, <strong>35</strong>, <strong>21</strong>, <strong>7</strong>, 1<br>Divide middle entries by 7: &nbsp; 7÷7=1 ✓ &nbsp; 21÷7=3 ✓ &nbsp; 35÷7=5 ✓ ... all work!<br>ALL divisible by 7! (And 7 is prime!)</div>Coincidence? Not at all!',

            '<h3>Composite Rows Tell a Different Story</h3>Now try a composite number — row 6:<div class="example"><strong>Row 6:</strong> 1, 6, <strong>15</strong>, 20, <strong>15</strong>, 6, 1<br><br>Divide middle entries by 6:<br>&nbsp;&nbsp;6 ÷ 6 = 1 &nbsp;&nbsp;&nbsp; remainder 0 ✓<br>&nbsp;&nbsp;15 ÷ 6 = 2 &nbsp;&nbsp; remainder <strong>3</strong> ✗ ← doesn\'t divide evenly!<br>&nbsp;&nbsp;20 ÷ 6 = 3 &nbsp;&nbsp; remainder <strong>2</strong> ✗ ← doesn\'t divide evenly!<br>&nbsp;&nbsp;15 ÷ 6 = 2 &nbsp;&nbsp; remainder <strong>3</strong> ✗<br>&nbsp;&nbsp;6 ÷ 6 = 1 &nbsp;&nbsp;&nbsp; remainder 0 ✓</div>Some entries leave a <strong>nonzero remainder</strong> when divided by 6. That\'s how the triangle reveals that 6 is composite!',

            '<h3>The Rule</h3><div class="formula">n is prime ⟺ every middle entry in row n is divisible by n<br>(i.e., every middle entry mod n = 0)</div>Remember the chocolate bar division words?<br><br>For each middle entry, n is the <strong>divisor</strong>. If the <strong>remainder</strong> is always 0 for every middle entry, n is prime. If even one remainder is nonzero, n is composite!<div class="example"><strong>Quick check — is 11 prime?</strong><br>Row 11: 1, 11, 55, 165, 330, 462, 462, 330, 165, 55, 11, 1<br>11÷11=1r0 ✓ 55÷11=5r0 ✓ 165÷11=15r0 ✓ ... all zero!<br>→ <strong>11 is prime!</strong></div>This idea powers the Polynomial Fermat test you\'ll see later!',
        ],
        16: [ // Polynomials: Building Blocks
            '<h3>Polynomials: Math Recipes</h3>Think of a polynomial like a recipe with different-sized bowls. Each bowl holds some amount of an ingredient, and the bowl size is a power of x:<div class="example"><strong>3x² + 2x + 1</strong> is like:<br><br>Big bowl (x²): &nbsp; 3 scoops<br>Medium bowl (x): 2 scoops<br>Small bowl (1): &nbsp; 1 scoop</div>Each "scoop amount" is called a <strong>term</strong>. This recipe has 3 terms: 3x², 2x, and 1.',

            '<h3>The Vocabulary</h3><div class="example"><strong>3x² + 2x + 1</strong><br><br>The <strong>degree</strong> = highest power of x = <strong>2</strong> (the biggest bowl)<br>The <strong>leading coefficient</strong> = number in front of the highest power = <strong>3</strong><br>The <strong>constant term</strong> = the number with no x = <strong>1</strong> (the smallest bowl)<br>Each number (3, 2, 1) is a <strong>coefficient</strong> — it tells you how many scoops</div><div class="formula">Degree 1 = "linear" (a line) &nbsp;&nbsp; like 5x + 3<br>Degree 2 = "quadratic" &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; like 3x² + 2x + 1<br>Degree 3 = "cubic" &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; like x³ − x + 4</div>',

            '<h3>Adding: Combine Matching Bowls</h3>Adding polynomials is like combining two recipes — just add matching bowl sizes together!<div class="example"><strong>(2x² + 3x) + (x² + 5)</strong><br><br>Big bowls (x²): &nbsp; 2 + 1 = <strong>3</strong> scoops → 3x²<br>Medium bowls (x): 3 + 0 = <strong>3</strong> scoops → 3x<br>Small bowls (1): &nbsp;0 + 5 = <strong>5</strong> scoops → 5<br><br>Result: <strong>3x² + 3x + 5</strong></div>Just line up matching powers and add the coefficients!',

            '<h3>Multiplying: The Grid Method</h3>Multiplying is like filling a grid — each term in the first polynomial multiplies each term in the second:<div class="example"><strong>(x + 2)(x + 3)</strong><br><br>Draw a grid:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | &nbsp;x &nbsp;| &nbsp;3<br>&nbsp;&nbsp;───+────+────<br>&nbsp;&nbsp; x &nbsp;| x² &nbsp;| 3x<br>&nbsp;&nbsp; 2 &nbsp;| 2x &nbsp;| 6<br><br>Add everything: x² + 3x + 2x + 6<br>Combine matching bowls: <strong>x² + 5x + 6</strong></div>This "grid method" works for any multiplication — and it connects to the area of a rectangle with sides (x+2) and (x+3)!',
        ],
        17: [ // Binomial Expansion
            '<h3>What Happens When You Multiply (x+a) by Itself?</h3>A <strong>binomial</strong> is just a polynomial with 2 terms, like (x + a). Let\'s see what happens when we multiply it by itself:<div class="example"><strong>(x + a)¹</strong> = x + a &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; coefficients: <strong>1, 1</strong><br><br><strong>(x + a)²</strong> = (x+a)(x+a)<br>&nbsp;&nbsp;= x² + ax + ax + a²<br>&nbsp;&nbsp;= x² + 2ax + a² &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; coefficients: <strong>1, 2, 1</strong></div>Wait — 1, 1 and 1, 2, 1... those are rows of Pascal\'s triangle!',

            '<h3>The Pattern Gets Clearer</h3><div class="example"><strong>(x + a)³</strong> = x³ + 3ax² + 3a²x + a³<br>Coefficients: <strong>1, 3, 3, 1</strong> ← Row 3 of Pascal\'s triangle!<br><br><strong>(x + a)⁴</strong> = x⁴ + 4ax³ + 6a²x² + 4a³x + a⁴<br>Coefficients: <strong>1, 4, 6, 4, 1</strong> ← Row 4!</div>It\'s not a coincidence — <strong>Row n of Pascal\'s triangle always gives the coefficients of (x + a)<sup>n</sup></strong>!<br><br>Think of it like this: expanding (x+a)<sup>n</sup> means choosing "x or a" from each of n copies. The binomial coefficient C(n,k) counts how many ways to choose a exactly k times.',

            '<h3>The Binomial Theorem</h3>Here\'s the complete formula — the "master recipe" for expanding any (x + a)<sup>n</sup>:<div class="formula">(x + a)<sup>n</sup> = C(n,0)·x<sup>n</sup> + C(n,1)·a·x<sup>n−1</sup> + C(n,2)·a²·x<sup>n−2</sup> + ... + C(n,n)·a<sup>n</sup></div><div class="example"><strong>Example: (x + 2)³</strong><br>Pascal row 3: [1, 3, 3, 1]<br><br>= 1·x³ + 3·(2)·x² + 3·(2²)·x + 1·(2³)<br>= x³ + 6x² + 12x + 8</div>Each term uses a coefficient from Pascal\'s triangle (the C(n,k) part), times a power of a and a power of x that always add up to n!',

            '<h3>Why This Connects to Primes</h3>Remember the prime secret from Pascal\'s triangle? For <strong>prime p</strong>, all middle entries of row p are divisible by p.<br><br>So when you expand (x + a)<sup>p</sup> and reduce mod p:<div class="example"><strong>(x + 1)⁵ mod 5:</strong><br>= 1·x⁵ + <strong>5</strong>·x⁴ + <strong>10</strong>·x³ + <strong>10</strong>·x² + <strong>5</strong>·x + 1<br><br>mod 5: the bold terms all vanish (they\'re divisible by 5)!<br>= x⁵ + 0 + 0 + 0 + 0 + 1<br>= <strong>x⁵ + 1</strong></div>All the middle chocolate pieces vanish! Only the first and last survive. This is the <strong>Polynomial Fermat identity</strong> — your next big tool for detecting primes!',
        ],
        18: [ // Polynomial Fermat
            '<h3>From Number Fermat to Polynomial Fermat</h3>Remember Fermat\'s clock? For prime p: a<sup>p</sup> ≡ a (mod p).<br><br>Now imagine upgrading from a single number to a whole <strong>polynomial</strong> — like upgrading from a bicycle to a car!<div class="formula">If p is prime: (x + a)<sup>p</sup> ≡ x<sup>p</sup> + a (mod p)</div>This means: expand (x+a)<sup>p</sup>, and mod p, all the <strong>middle terms vanish</strong>. Only the first and last survive!',

            '<h3>The Chocolate Factory Analogy</h3>Think of expanding (x + a)<sup>p</sup> as a chocolate factory that produces p+1 chocolate bars (the terms). Each middle bar has a binomial coefficient C(p,k) stamped on it.<div class="example"><strong>For p = 5:</strong><br>The factory produces bars labeled: C(5,0), C(5,1), C(5,2), C(5,3), C(5,4), C(5,5)<br>= 1, <strong>5</strong>, <strong>10</strong>, <strong>10</strong>, <strong>5</strong>, 1<br><br>Quality control: divide each label by 5 (the "mod 5 test")<br>1 mod 5 = 1 (edge — keep it)<br><strong>5 mod 5 = 0</strong> (divisible — vanishes!)<br><strong>10 mod 5 = 0</strong> (divisible — vanishes!)<br><strong>10 mod 5 = 0</strong> (vanishes!)<br><strong>5 mod 5 = 0</strong> (vanishes!)<br>1 mod 5 = 1 (edge — keep it)<br><br>Only x⁵ and a⁵ survive → <strong>(x+a)⁵ ≡ x⁵ + a (mod 5)</strong></div>',

            '<h3>Composites Break the Factory</h3>Now try n = 6 (composite):<div class="example"><strong>Row 6:</strong> 1, 6, <strong>15</strong>, 20, <strong>15</strong>, 6, 1<br><br>Quality control: divide each by 6<br>6 mod 6 = 0 (vanishes) ✓<br><strong>15 mod 6 = 3</strong> (remainder 3 — doesn\'t vanish!) ✗<br>20 mod 6 = 2 (remainder 2) ✗<br><strong>15 mod 6 = 3</strong> ✗<br>6 mod 6 = 0 ✓<br><br>Middle bars survive! The identity <strong>breaks</strong>.</div>For composites, some chocolate bars survive the quality check. The factory is "leaky" — and that\'s how we catch them!',

            '<h3>Stronger Than Fermat!</h3>This test is more powerful than the number version because:<div class="example"><strong>Number Fermat:</strong> tests one equation (a<sup>n−1</sup> mod n = 1?)<br>→ Carmichael numbers can fool it<br><br><strong>Polynomial Fermat:</strong> tests n−1 equations (one for EACH middle coefficient)<br>→ A composite would need ALL of them to be zero mod n<br>→ Carmichael numbers <strong>can\'t</strong> fool this!</div><div class="formula">The polynomial test never gets tricked by imposters.</div>But checking all n−1 coefficients is slow for big n. That\'s why we need the AKS test — it finds a shortcut!',
        ],
        19: [ // The AKS Test
            '<h3>The AKS Test: The Ultimate Prime Detective</h3>The Polynomial Fermat test works perfectly — but it\'s <strong>too slow</strong> for big numbers (you\'d need to check millions of coefficients). In 2002, three mathematicians from India found a brilliant shortcut.<div class="example"><strong>The Big Idea:</strong><br>Instead of checking ALL coefficients of (x+a)<sup>n</sup>,<br>reduce the polynomial mod (x<sup>r</sup> − 1) for a small r.<br><br>This shrinks a million-term polynomial down to just r terms!<br>It\'s like checking a <strong>summary</strong> instead of reading the whole book.</div>',

            '<h3>The 5-Step Recipe</h3>AKS combines everything you\'ve learned into one algorithm — like a final exam that uses every tool in your toolbox!<div class="example"><strong>Step 1:</strong> Is n a perfect power? (your Level 4 skill!)<br>&nbsp;&nbsp;→ If yes: COMPOSITE. &nbsp; If no: continue.<br><br><strong>Step 2:</strong> Find a suitable small number r<br>&nbsp;&nbsp;→ Technical step — find r where n\'s "order" is big enough.<br><br><strong>Step 3:</strong> Check small factors up to r (your Level 5 skill!)<br>&nbsp;&nbsp;→ If any GCD(a, n) > 1: COMPOSITE. (Level 6 skill!)<br><br><strong>Step 4:</strong> If n ≤ r → PRIME (it\'s small enough to know directly).<br><br><strong>Step 5:</strong> Run the polynomial checks (Level 14 skill!)<br>&nbsp;&nbsp;→ But mod (x<sup>r</sup>−1) to keep it fast.</div>',

            '<h3>Why AKS Changed Mathematics</h3>Before AKS, nobody knew if you could test primality <strong>perfectly</strong> and <strong>fast</strong> at the same time.<div class="example"><strong>Trial division:</strong> Perfect but slow for big numbers<br><strong>Fermat\'s test:</strong> Fast but makes mistakes (Carmichael numbers!)<br><strong>AKS:</strong> Perfect AND fast — the best of both worlds!</div>AKS was the first <strong>polynomial-time deterministic</strong> primality test. Published by Agrawal, Kayal, and Saxena — Kayal and Saxena were undergraduate students at the time!<br><br>It proved a 100-year-old conjecture and made headlines around the world.',
        ],
        20: [ // Miller-Rabin Test
            '<h3>Miller-Rabin: A Fast Prime Test</h3>The AKS test is perfect, but it\'s slow for really big numbers. The Miller-Rabin test trades a tiny chance of error for blazing speed — and it\'s what computers actually use!<div class="formula">If n is prime, then for any base a:<br>Either a<sup>d</sup> ≡ 1 (mod n)<br>or a<sup>2<sup>r</sup>·d</sup> ≡ −1 (mod n) for some r</div>The key first step: write n − 1 as <strong>2<sup>s</sup> × d</strong> where d is odd.',

            '<h3>Setup: Factoring Out the 2s</h3>Before running the test, we need to decompose n − 1 into the form 2<sup>s</sup> × d:<div class="example"><strong>n = 221, so n − 1 = 220</strong><br><br>220 ÷ 2 = 110 &nbsp; (s = 1)<br>110 ÷ 2 = 55 &nbsp;&nbsp; (s = 2)<br>55 is odd → stop!<br><br>220 = 2² × 55, so <strong>s = 2, d = 55</strong></div>This decomposition splits the Fermat test into multiple checkpoints, making it much harder for composites to slip through!',

            '<h3>The Squaring Sequence</h3>Once we have n − 1 = 2<sup>s</sup> × d, we compute a<sup>d</sup> mod n, then square repeatedly:<div class="example"><strong>Test n = 221, a = 174, s = 2, d = 55</strong><br><br>Start: 174<sup>55</sup> mod 221 = <strong>47</strong><br>&nbsp;&nbsp;47 ≠ 1 and 47 ≠ 220 (which is n−1)<br><br>Square: 47² mod 221 = 2209 mod 221 = <strong>220</strong><br>&nbsp;&nbsp;220 = n−1 → that\'s −1 mod n!<br><br>We found n−1 → <strong>probably prime</strong> for this base.</div>If we never see 1 or n−1 in the sequence, n is definitely composite!',

            '<h3>Witnesses and Liars</h3><div class="example"><strong>Witness:</strong> A base a that proves n is composite<br>(the squaring sequence reveals the fraud)<br><br><strong>Liar:</strong> A base a that says "probably prime" even though n is composite<br>(it got lucky and the sequence looked OK)</div>Unlike Fermat\'s test (where Carmichael numbers fool EVERY base), Miller-Rabin liars are rare. Testing k random bases gives an error probability of at most <strong>4<sup>−k</sup></strong>.<div class="formula">1 base: 25% chance of error at worst<br>5 bases: &lt; 0.1% chance<br>20 bases: astronomically unlikely to be wrong</div>That\'s why it\'s used in practice — run it a few times and you\'re essentially certain!',
        ],
        21: [ // RSA Basics
            '<h3>RSA: The Spy Game</h3>Imagine you want to send a secret number to a friend, but a spy is watching. RSA is like having a <strong>magic mailbox</strong>: anyone can drop a message in (encrypt), but only you have the key to open it (decrypt)!<div class="example"><strong>The idea:</strong><br>Your friend creates a <strong>public key</strong> (the mailbox slot) and a <strong>private key</strong> (the mailbox key).<br><br>Public key: everyone can see it — used to encrypt<br>Private key: only your friend has it — used to decrypt</div>The security relies on one thing: <strong>it\'s hard to factor large numbers!</strong>',

            '<h3>Step 1: Pick Two Primes</h3>Choose two prime numbers p and q. Multiply them together to get n = p × q.<div class="example"><strong>Example:</strong> p = 3, q = 11<br>n = 3 × 11 = <strong>33</strong></div>The magic: everyone knows n (it\'s public), but finding p and q from just n is hard for big numbers! This is the <strong>trapdoor</strong> that makes RSA secure.',

            '<h3>Step 2: Euler\'s Totient and Choosing e</h3>Compute the totient: &phi;(n) = (p−1)(q−1). Then pick e coprime to &phi;(n).<div class="example"><strong>Example:</strong> &phi;(33) = (3−1)(11−1) = 2 × 10 = <strong>20</strong><br><br>Pick e coprime to 20: GCD(e, 20) = 1<br>Try e = 3: GCD(3, 20) = 1 ✓<br><br><strong>e = 3</strong> works!</div>The public key is the pair <strong>(e, n)</strong> = (3, 33).',

            '<h3>Step 3: Find the Private Key d</h3>Find d such that e × d ≡ 1 (mod &phi;(n)). This is the <strong>modular inverse</strong>.<div class="example"><strong>Example:</strong> Find d where 3 × d ≡ 1 (mod 20)<br><br>Try d = 7: &nbsp; 3 × 7 = 21 → 21 mod 20 = <strong>1</strong> ✓<br><br><strong>d = 7</strong> is the private key!</div>The private key is <strong>(d, n)</strong> = (7, 33). Keep d secret!',

            '<h3>Encrypt and Decrypt!</h3><div class="formula">Encrypt: c = m<sup>e</sup> mod n<br>Decrypt: m = c<sup>d</sup> mod n</div><div class="example"><strong>Encrypt message m = 4:</strong><br>c = 4<sup>3</sup> mod 33 = 64 mod 33 = <strong>31</strong><br>Send 31 to your friend!<br><br><strong>Decrypt ciphertext c = 31:</strong><br>m = 31<sup>7</sup> mod 33<br>31<sup>2</sup> = 961 mod 33 = 4<br>31<sup>4</sup> = 4² = 16 mod 33 = 16<br>31<sup>7</sup> = 31<sup>4</sup> × 31<sup>2</sup> × 31 = 16 × 4 × 31 = 1984 mod 33 = <strong>4</strong> ✓<br><br>The original message m = 4 is recovered!</div>It works because of Euler\'s theorem: m<sup>e×d</sup> ≡ m (mod n) when e×d ≡ 1 (mod &phi;(n)).',
        ],
        22: [ // Bonus: Mersenne Primes
            '<h3>Mersenne Primes: The Giant Hunters</h3>Take a prime number p. Compute 2<sup>p</sup> − 1. Is the result prime? If so, it\'s called a <strong>Mersenne prime</strong> — and they\'re some of the biggest primes ever found!<div class="formula">M<sub>p</sub> = 2<sup>p</sup> − 1</div><div class="example">p = 2: &nbsp; 2² − 1 = <strong>3</strong> ✓ prime!<br>p = 3: &nbsp; 2³ − 1 = <strong>7</strong> ✓ prime!<br>p = 5: &nbsp; 2⁵ − 1 = <strong>31</strong> ✓ prime!<br>p = 7: &nbsp; 2⁷ − 1 = <strong>127</strong> ✓ prime!</div>Looks like it always works... right?',

            '<h3>Not So Fast!</h3>Just because p is prime doesn\'t guarantee 2<sup>p</sup> − 1 is prime. Some "Mersenne candidates" are imposters!<div class="example">p = 11: &nbsp; 2<sup>11</sup> − 1 = 2047<br><br>Is 2047 prime? Let\'s check...<br>2047 ÷ 23 = 89 &nbsp; (remainder 0!)<br><br>2047 = 23 × 89 — <strong>NOT prime!</strong></div>So 11 is prime, but M<sub>11</sub> isn\'t. Figuring out which primes p make 2<sup>p</sup> − 1 prime is one of the deepest unsolved mysteries in all of mathematics!',

            '<h3>The Lucas–Lehmer Test: A Mersenne Detector</h3>There\'s a beautiful test <em>just</em> for Mersenne numbers. Think of it like a pinball machine — drop a ball labeled 4 and keep bouncing it:<div class="formula">Start: s = 4<br>Repeat p − 2 times: s = (s² − 2) mod M<sub>p</sub><br>If final s = 0 → M<sub>p</sub> is PRIME!</div><div class="example"><strong>Test M₅ = 31 (p = 5, so repeat 3 times):</strong><br><br>s₀ = 4<br>s₁ = (4² − 2) mod 31 = 14 mod 31 = <strong>14</strong><br>s₂ = (14² − 2) mod 31 = 194 mod 31 = <strong>8</strong><br>s₃ = (8² − 2) mod 31 = 62 mod 31 = <strong>0</strong> ← hit zero!<br><br>Final s = 0 → <strong>31 is a Mersenne prime!</strong></div>The pinball landed in the zero pocket — that means it\'s prime!',

            '<h3>The World Record Hunters</h3>Almost every record-breaking largest known prime is a Mersenne prime. Why? Because the Lucas–Lehmer test is incredibly fast — it only needs p − 2 steps, even for enormous numbers!<div class="example"><strong>The Great Internet Mersenne Prime Search (GIMPS)</strong><br>is a worldwide volunteer project where regular people<br>donate their computer\'s spare power to hunt for<br>the next Mersenne prime.<br><br>The largest known prime (as of 2024):<br><strong>2<sup>136,279,841</sup> − 1</strong><br>It has over <strong>41 million digits!</strong><br>If you printed it in size 12 font, it would stretch<br>for over 50 miles.</div>Maybe <em>your</em> computer will find the next one!',
        ]
    };

    function showTutorial(lvl) {
        var steps = TUTORIALS[lvl];
        if (!steps) { state.tutorialDone = true; showRoundSelect(); return; }

        $tutorialPanel.style.display = 'block';
        $questionArea.style.display = 'none';
        $levelComplete.style.display = 'none';
        state.tutorialStep = 0;
        renderTutorialStep(steps);
    }

    function renderTutorialStep(steps) {
        $tutorialContent.innerHTML = steps[state.tutorialStep];
        var isLast = state.tutorialStep >= steps.length - 1;
        $tutorialNext.style.display = isLast ? 'none' : 'inline-block';
        $tutorialStart.style.display = isLast ? 'inline-block' : 'none';
    }

    $tutorialNext.addEventListener('click', function() {
        var steps = TUTORIALS[state.currentLevel];
        if (!steps) return;
        state.tutorialStep++;
        if (state.tutorialStep >= steps.length) {
            state.tutorialDone = true;
            showRoundSelect();
        } else {
            renderTutorialStep(steps);
        }
    });

    $tutorialStart.addEventListener('click', function() {
        state.tutorialDone = true;
        showRoundSelect();
    });

    // ═══ LEVEL 6: GCD — EUCLID'S ALGORITHM ══════════════════════════════

    function lcm(a, b) { return a / gcd(a, b) * b; }

    function euclidSteps(a, b) {
        var steps = [];
        while (b > 0) {
            var q = Math.floor(a / b), r = a % b;
            steps.push({a: a, b: b, q: q, r: r});
            a = b; b = r;
        }
        return steps;
    }

    function renderLevelGCD() {
        var ranges = [[10,50],[10,200],[10,500]];
        var r = ranges[state.currentRound] || ranges[0];
        var a = randInt(r[0], r[1]), b = randInt(r[0], r[1]);
        if (a < b) { var tmp = a; a = b; b = tmp; }
        if (a === b) b = randInt(Math.max(2, r[0]), a - 1);

        // For round C, sometimes make coprime pairs
        if (state.currentRound === 2 && Math.random() < 0.3) {
            var primes = [7,11,13,17,19,23,29,31,37,41,43];
            a = pickRandom(primes) * randInt(2, 12);
            b = pickRandom(primes.filter(function(p){ return a % p !== 0; })) * randInt(2, 12);
            if (a < b) { var tmp2 = a; a = b; b = tmp2; }
        }

        var steps = euclidSteps(a, b);
        var correctGCD = gcd(a, b);
        var currentStep = 0;

        $questionPrompt.innerHTML = 'Walk through <strong>Euclid\'s Algorithm</strong> to find GCD(' + a + ', ' + b + ').<br>At each step, pick the correct remainder.';

        function renderGCDStep() {
            var s = steps[currentStep];
            var html = '<div class="euclid-steps">';
            // Show previous steps
            for (var i = 0; i < currentStep; i++) {
                html += '<div class="euclid-step done">' + steps[i].a + ' mod ' + steps[i].b + ' = ' + steps[i].r + '</div>';
            }
            // Current step
            html += '<div class="euclid-step active">' + s.a + ' mod ' + s.b + ' = ?</div>';
            // Bar visual
            var maxVal = Math.max(steps[0].a, steps[0].b);
            html += '<div class="euclid-bars">';
            html += '<div class="euclid-bar-row"><span class="euclid-bar-label">' + s.a + '</span><div class="euclid-bar" style="width:' + Math.round(s.a / maxVal * 100) + '%"></div></div>';
            html += '<div class="euclid-bar-row"><span class="euclid-bar-label">' + s.b + '</span><div class="euclid-bar bar-b" style="width:' + Math.round(s.b / maxVal * 100) + '%"></div></div>';
            html += '</div></div>';
            $questionVisual.innerHTML = html;

            // Generate choices
            var choices = [s.r];
            while (choices.length < 4) {
                var wrong = randInt(0, s.b - 1);
                if (choices.indexOf(wrong) === -1) choices.push(wrong);
            }
            shuffle(choices);

            var btns = '';
            for (var i = 0; i < choices.length; i++)
                btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
            $answerButtons.innerHTML = btns;

            $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (!state.questionActive) return;
                    var val = parseInt(btn.dataset.val);
                    if (val === s.r) {
                        btn.classList.add('correct');
                        sndTick();
                        currentStep++;
                        if (currentStep >= steps.length) {
                            // Final: pick the GCD
                            setTimeout(function() { renderGCDFinal(); }, 600);
                        } else {
                            setTimeout(function() { renderGCDStep(); }, 600);
                        }
                    } else {
                        btn.classList.add('wrong');
                        sndWrong();
                        handleAnswer(false, s.a + ' mod ' + s.b + ' = ' + s.r + ', not ' + val);
                    }
                });
            });
        }

        function renderGCDFinal() {
            var html = '<div class="euclid-steps">';
            for (var i = 0; i < steps.length; i++)
                html += '<div class="euclid-step done">' + steps[i].a + ' mod ' + steps[i].b + ' = ' + steps[i].r + '</div>';
            html += '<div class="euclid-step active">Remainder is 0 — what is the GCD?</div></div>';
            $questionVisual.innerHTML = html;

            var choices = [correctGCD];
            while (choices.length < 4) {
                var wrong = randInt(1, Math.max(correctGCD * 3, 20));
                if (choices.indexOf(wrong) === -1) choices.push(wrong);
            }
            shuffle(choices);
            var btns = '';
            for (var i = 0; i < choices.length; i++)
                btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
            $answerButtons.innerHTML = btns;

            $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var val = parseInt(btn.dataset.val);
                    var correct = val === correctGCD;
                    btn.classList.add(correct ? 'correct' : 'wrong');
                    var coprime = correctGCD === 1 ? ' They are coprime!' : '';
                    handleAnswer(correct, 'GCD(' + a + ', ' + b + ') = ' + correctGCD + '.' + coprime);
                });
            });
        }

        renderGCDStep();
    }

    // ═══ LEVEL 7: LCM — LEAST COMMON MULTIPLE ════════════════════════════

    function renderLevelLCM() {
        var ranges = [[2,20],[2,50],[2,100]];
        var r = ranges[state.currentRound] || ranges[0];
        var a = randInt(r[0], r[1]), b = randInt(r[0], r[1]);
        while (a === b) b = randInt(r[0], r[1]);

        var correctGCD = gcd(a, b);
        var correctLCM = lcm(a, b);

        $questionPrompt.innerHTML = 'Find the <strong>LCM</strong> of ' + a + ' and ' + b + '.<br>First find GCD, then use the formula: LCM = a × b ÷ GCD';

        // Number line visual
        var limit = Math.min(correctLCM + 10, correctLCM * 1.3);
        var html = '<div class="number-line-container">';
        html += '<div class="number-line">';
        for (var i = 1; i <= limit; i++) {
            var isA = i % a === 0, isB = i % b === 0;
            if (isA || isB) {
                var cls = 'number-line-dot';
                if (isA && isB) cls += ' overlap';
                else if (isA) cls += ' dot-a';
                else cls += ' dot-b';
                html += '<div class="' + cls + '" style="left:' + (i / limit * 100) + '%"><span>' + i + '</span></div>';
            }
        }
        html += '</div>';
        html += '<div class="number-line-legend"><span class="dot-a-label">Multiples of ' + a + '</span> <span class="dot-b-label">Multiples of ' + b + '</span> <span class="dot-overlap-label">Both</span></div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        // Step 1: pick GCD
        var gcdChoices = [correctGCD];
        while (gcdChoices.length < 4) {
            var wrong = randInt(1, Math.max(a, b));
            if (gcdChoices.indexOf(wrong) === -1) gcdChoices.push(wrong);
        }
        shuffle(gcdChoices);

        $answerButtons.innerHTML = '<div style="margin-bottom:8px;color:#aaa">Step 1: What is GCD(' + a + ', ' + b + ')?</div>';
        var btns = '';
        for (var i = 0; i < gcdChoices.length; i++)
            btns += '<button class="answer-btn gcd-choice" data-val="' + gcdChoices[i] + '">' + gcdChoices[i] + '</button>';
        $answerButtons.innerHTML += btns;

        $answerButtons.querySelectorAll('.gcd-choice').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                var val = parseInt(btn.dataset.val);
                if (val !== correctGCD) {
                    btn.classList.add('wrong');
                    sndWrong();
                    handleAnswer(false, 'GCD(' + a + ', ' + b + ') = ' + correctGCD + ', not ' + val + '. LCM = ' + a + ' × ' + b + ' ÷ ' + correctGCD + ' = ' + correctLCM);
                    return;
                }
                btn.classList.add('correct');
                sndTick();
                // Step 2: compute LCM
                setTimeout(function() {
                    var lcmChoices = [correctLCM];
                    while (lcmChoices.length < 4) {
                        var w = randInt(Math.max(a, b), correctLCM * 2);
                        if (lcmChoices.indexOf(w) === -1) lcmChoices.push(w);
                    }
                    shuffle(lcmChoices);
                    $answerButtons.innerHTML = '<div style="margin-bottom:8px;color:#aaa">Step 2: LCM = ' + a + ' × ' + b + ' ÷ ' + correctGCD + ' = ?</div>';
                    var btns2 = '';
                    for (var i = 0; i < lcmChoices.length; i++)
                        btns2 += '<button class="answer-btn lcm-choice" data-val="' + lcmChoices[i] + '">' + lcmChoices[i] + '</button>';
                    $answerButtons.innerHTML += btns2;

                    $answerButtons.querySelectorAll('.lcm-choice').forEach(function(btn2) {
                        btn2.addEventListener('click', function() {
                            var v = parseInt(btn2.dataset.val);
                            var correct = v === correctLCM;
                            btn2.classList.add(correct ? 'correct' : 'wrong');
                            handleAnswer(correct, 'LCM(' + a + ', ' + b + ') = ' + a + ' × ' + b + ' ÷ ' + correctGCD + ' = ' + correctLCM);
                        });
                    });
                }, 600);
            });
        });
    }

    // ═══ LEVEL 8: FERMAT'S LITTLE THEOREM ════════════════════════════════

    function renderLevelFermat() {
        var bases = [2, 3, 5, 7];
        var n;
        if (state.currentRound === 2 && Math.random() < 0.35) {
            n = pickRandom(CARMICHAEL);
        } else if (state.currentRound === 0) {
            n = randInt(3, 50);
        } else {
            n = randInt(3, 200);
        }
        if (n < 3) n = 3;

        var isPrime = trialDivision(n);
        var a = pickRandom(bases.filter(function(x){ return x < n; }));
        if (!a) a = 2;

        // Show modular exponentiation steps
        var steps = modExpSteps(a, n - 1, n);
        var result = steps[steps.length - 1].val;

        $questionPrompt.innerHTML = 'Fermat\'s Lab: We compute a<sup>n−1</sup> mod n. If the result is 1, Fermat says "probably prime." If not, it\'s definitely composite. Watch the steps, then decide.<br>Testing n = <strong>' + n + '</strong> with base a = <strong>' + a + '</strong>';

        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">Computing ' + a + '<sup>' + (n-1) + '</sup> mod ' + n + ':</div>';
        for (var i = 0; i < steps.length; i++) {
            html += '<div class="step' + (i === steps.length - 1 ? ' highlight' : '') + '">' + steps[i].desc + '</div>';
        }
        html += '<div class="result-line">Result: ' + a + '<sup>' + (n-1) + '</sup> mod ' + n + ' = ' + result + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        var fermatSays = result === 1 ? 'probably prime' : 'COMPOSITE';
        var isCarmichael = !isPrime && result === 1;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME</button>' +
            '<button class="answer-btn" data-val="composite">COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                var msg;
                if (isCarmichael) {
                    msg = 'Fermat LIAR! ' + n + ' is composite but Fermat says probably prime. ' + n + ' is a Carmichael number!';
                    // Give credit if they said composite despite Fermat result
                    correct = (ans === 'composite');
                } else {
                    msg = n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE') + '. Fermat said: ' + fermatSays + '.';
                }
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, msg);
            });
        });
    }

    function modExpSteps(base, exp, mod) {
        // Simplified: show a few key squaring steps
        var steps = [];
        var bits = [];
        var e = exp;
        while (e > 0) { bits.push(e % 2); e = Math.floor(e / 2); }
        bits.reverse();

        var result = 1;
        for (var i = 0; i < bits.length; i++) {
            result = Number(BigInt(result) * BigInt(result) % BigInt(mod));
            var desc = 'Square → ' + result;
            if (bits[i] === 1) {
                result = Number(BigInt(result) * BigInt(base) % BigInt(mod));
                desc += ', ×' + base + ' → ' + result;
            }
            desc += ' (mod ' + mod + ')';
            steps.push({desc: desc, val: result});
        }
        return steps;
    }

    // ═══ LEVEL 9: CARMICHAEL NUMBERS ═════════════════════════════════════

    function isCarmichael(n) {
        if (n < 3 || trialDivision(n)) return false;
        // Check Korselt: square-free and (p-1)|(n-1) for each prime factor p
        var temp = n, factors = [];
        for (var p = 2; p * p <= temp; p++) {
            if (temp % p === 0) {
                factors.push(p);
                temp /= p;
                if (temp % p === 0) return false; // not square-free
            }
        }
        if (temp > 1) factors.push(temp);
        if (factors.length < 2) return false;
        for (var i = 0; i < factors.length; i++) {
            if ((n - 1) % (factors[i] - 1) !== 0) return false;
        }
        return true;
    }

    function renderLevelCarmichael() {
        var bases = [2, 3, 5, 7, 11];
        var n;
        if (state.currentRound === 0) {
            // Mix of small composites, primes, and 561
            var pool = [15, 21, 35, 561, 7, 11, 13, 17, 25, 49];
            n = pickRandom(pool);
        } else if (state.currentRound === 1) {
            var pool2 = [561, 1105, 1729, 91, 341, 23, 29, 31, 37, 100, 121];
            n = pickRandom(pool2);
        } else {
            // Hard: more Carmichael numbers
            var pool3 = [561, 1105, 1729, 2465, 2821, 41, 43, 47, 53, 341, 645];
            n = pickRandom(pool3);
        }
        if (n < 3) n = 561;

        var isPrime = trialDivision(n);
        var isCarm = isCarmichael(n);

        // Test with multiple bases
        var testBases = bases.filter(function(b) { return b < n && gcd(b, n) === 1; }).slice(0, 4);
        var results = testBases.map(function(a) {
            var r = modPow(a, n - 1, n);
            return { base: a, result: r, passes: r === 1 };
        });
        var allPass = results.every(function(r) { return r.passes; });

        $questionPrompt.innerHTML = 'Test n = <strong>' + n + '</strong> with Fermat\'s test using multiple bases. Then classify it!';

        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">Fermat tests for n = ' + n + ':</div>';
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            html += '<div class="step' + (r.passes ? '' : ' highlight') + '">' +
                r.base + '<sup>' + (n - 1) + '</sup> mod ' + n + ' = ' + r.result +
                (r.passes ? ' ≡ 1 ✓' : ' ≢ 1 ✗') + '</div>';
        }
        html += '<div class="result-line">Fermat says: ' + (allPass ? 'probably prime' : 'COMPOSITE') + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">Truly PRIME</button>' +
            '<button class="answer-btn" data-val="carmichael">Carmichael Number (composite liar!)</button>' +
            '<button class="answer-btn" data-val="composite">Ordinary COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = false;
                if (isPrime && ans === 'prime') correct = true;
                else if (isCarm && ans === 'carmichael') correct = true;
                else if (!isPrime && !isCarm && ans === 'composite') correct = true;

                btn.classList.add(correct ? 'correct' : 'wrong');
                var msg = n + ' is ';
                if (isPrime) msg += 'truly PRIME.';
                else if (isCarm) msg += 'a CARMICHAEL NUMBER! It fools Fermat\'s test.';
                else msg += 'an ordinary COMPOSITE. Fermat ' + (allPass ? 'was fooled!' : 'caught it.');
                handleAnswer(correct, msg);
            });
        });
    }

    // ═══ LEVEL 10: PASCAL'S TRIANGLE — THE PATTERN ════════════════════════

    function pascalRow(n) {
        var row = [1];
        for (var k = 1; k <= n; k++)
            row.push(Math.round(row[k - 1] * (n - k + 1) / k));
        return row;
    }

    function renderPascalTriangle(rows, highlightRow) {
        var html = '<div class="pascal-triangle">';
        for (var r = 0; r < rows; r++) {
            var row = pascalRow(r);
            html += '<div class="pascal-row' + (r === highlightRow ? ' highlight-row' : '') + '">';
            for (var k = 0; k <= r; k++)
                html += '<div class="pascal-cell">' + row[k] + '</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function renderLevelPascalIntro() {
        if (state.currentRound === 0) renderPascalIntroA();
        else if (state.currentRound === 1) renderPascalIntroB();
        else renderPascalIntroC();
    }

    // Round A: Fill in missing entries
    function renderPascalIntroA() {
        var targetRow = randInt(3, 7);
        var row = pascalRow(targetRow);
        // Pick a random middle position to blank out
        var blankK = randInt(1, targetRow - 1);
        var correctVal = row[blankK];

        $questionPrompt.innerHTML = 'Fill in the missing entry in <strong>row ' + targetRow + '</strong> of Pascal\'s triangle.<br>Each entry = sum of the two entries above it.';

        // Render triangle with blank
        var html = '<div class="pascal-triangle">';
        for (var r = 0; r <= targetRow; r++) {
            var rowVals = pascalRow(r);
            html += '<div class="pascal-row' + (r === targetRow ? ' highlight-row' : '') + '">';
            for (var k = 0; k <= r; k++) {
                if (r === targetRow && k === blankK)
                    html += '<div class="pascal-cell blank">?</div>';
                else
                    html += '<div class="pascal-cell">' + rowVals[k] + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = correctVal + randInt(-5, 5);
            if (w > 0 && choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                var above = pascalRow(targetRow - 1);
                handleAnswer(correct, 'C(' + targetRow + ',' + blankK + ') = ' + above[blankK - 1] + ' + ' + above[blankK] + ' = ' + correctVal);
            });
        });
    }

    // Round B: What is C(n,k)?
    function renderPascalIntroB() {
        var n = randInt(4, 8);
        var k = randInt(1, n - 1);
        var row = pascalRow(n);
        var correctVal = row[k];

        $questionPrompt.innerHTML = 'What is <strong>C(' + n + ', ' + k + ')</strong>? (Row ' + n + ', position ' + k + ' in Pascal\'s triangle)';
        $questionVisual.innerHTML = renderPascalTriangle(n + 1, n);

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = randInt(1, correctVal * 2 + 5);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'C(' + n + ', ' + k + ') = ' + correctVal);
            });
        });
    }

    // Round C: Build a row from scratch
    function renderPascalIntroC() {
        var targetRow = randInt(5, 8);
        var row = pascalRow(targetRow);
        // Blank out 2-3 entries
        var blanks = [];
        var used = {};
        var numBlanks = Math.min(3, targetRow - 1);
        while (blanks.length < numBlanks) {
            var k = randInt(1, targetRow - 1);
            if (!used[k]) { blanks.push(k); used[k] = true; }
        }
        blanks.sort(function(a, b) { return a - b; });

        // Show the current blank to fill
        var currentBlankIdx = 0;

        $questionPrompt.innerHTML = 'Fill in the <strong>missing entries</strong> in row ' + targetRow + '. Click the correct value for each "?" in order.';

        function renderPartialTriangle() {
            var html = '<div class="pascal-triangle">';
            for (var r = 0; r <= targetRow; r++) {
                var rowVals = pascalRow(r);
                html += '<div class="pascal-row' + (r === targetRow ? ' highlight-row' : '') + '">';
                for (var k = 0; k <= r; k++) {
                    if (r === targetRow && blanks.indexOf(k) !== -1) {
                        var blankIdx = blanks.indexOf(k);
                        if (blankIdx < currentBlankIdx)
                            html += '<div class="pascal-cell filled">' + rowVals[k] + '</div>';
                        else if (blankIdx === currentBlankIdx)
                            html += '<div class="pascal-cell blank active-blank">?</div>';
                        else
                            html += '<div class="pascal-cell blank">?</div>';
                    } else {
                        html += '<div class="pascal-cell">' + rowVals[k] + '</div>';
                    }
                }
                html += '</div>';
            }
            html += '</div>';
            $questionVisual.innerHTML = html;

            if (currentBlankIdx >= blanks.length) return;

            var k = blanks[currentBlankIdx];
            var correctVal = row[k];
            var choices = [correctVal];
            while (choices.length < 4) {
                var w = correctVal + randInt(-5, 8);
                if (w > 0 && choices.indexOf(w) === -1) choices.push(w);
            }
            shuffle(choices);
            var btns = '';
            for (var i = 0; i < choices.length; i++)
                btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
            $answerButtons.innerHTML = btns;

            $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (!state.questionActive) return;
                    var val = parseInt(btn.dataset.val);
                    if (val === correctVal) {
                        btn.classList.add('correct');
                        sndTick();
                        currentBlankIdx++;
                        if (currentBlankIdx >= blanks.length) {
                            handleAnswer(true, 'Row ' + targetRow + ' complete!');
                        } else {
                            setTimeout(renderPartialTriangle, 500);
                        }
                    } else {
                        btn.classList.add('wrong');
                        handleAnswer(false, 'C(' + targetRow + ', ' + k + ') = ' + correctVal);
                    }
                });
            });
        }
        renderPartialTriangle();
    }

    // ═══ LEVEL 11: PASCAL'S TRIANGLE & PRIMES ═════════════════════════════

    function renderLevelPascalPrimes() {
        if (state.currentRound === 0) renderPascalPrimesA();
        else if (state.currentRound === 1) renderPascalPrimesB();
        else renderPascalPrimesC();
    }

    // Round A: Is this row divisible by n?
    function renderPascalPrimesA() {
        var candidates = [3, 4, 5, 6, 7, 8, 9, 10, 11];
        var n = pickRandom(candidates);
        var row = pascalRow(n);
        var isPrime = trialDivision(n);

        $questionPrompt.innerHTML = 'Look at <strong>row ' + n + '</strong> of Pascal\'s triangle. Are ALL middle entries divisible by ' + n + '?';

        // Show the row with mod results
        var html = '<div class="pascal-row-display">';
        for (var k = 0; k <= n; k++) {
            var isEnd = k === 0 || k === n;
            var cls = isEnd ? 'pascal-cell endpoint' : 'pascal-cell';
            if (!isEnd) cls += (row[k] % n === 0) ? ' divisible' : ' not-divisible';
            html += '<div class="' + cls + '">' + row[k] + '<div class="mod-label">' + (isEnd ? '' : 'mod ' + n + ' = ' + (row[k] % n)) + '</div></div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="yes">YES — all divisible (prime row!)</button>' +
            '<button class="answer-btn" data-val="no">NO — some aren\'t (composite row)</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'yes') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'Row ' + n + ': ' + (isPrime ? 'All middle entries divisible by ' + n + ' — it\'s PRIME!' : 'Some entries aren\'t divisible by ' + n + ' — it\'s COMPOSITE.'));
            });
        });
    }

    // Round B: Which rows are prime?
    function renderPascalPrimesB() {
        var rowNum = randInt(3, 11);
        var row = pascalRow(rowNum);
        var isPrime = trialDivision(rowNum);

        $questionPrompt.innerHTML = 'Here is row <strong>' + rowNum + '</strong>. Check each middle entry mod ' + rowNum + '. Is ' + rowNum + ' prime?';

        // Show row, let them click to reveal mod values
        var html = '<div class="pascal-row-display" id="pascal-check-row">';
        for (var k = 0; k <= rowNum; k++) {
            var isEnd = k === 0 || k === rowNum;
            html += '<div class="pascal-cell' + (isEnd ? ' endpoint' : ' clickable') + '" data-k="' + k + '">' + row[k] + '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var checked = 0;
        var middleCount = rowNum - 1;
        $questionVisual.querySelectorAll('.pascal-cell.clickable').forEach(function(cell) {
            cell.addEventListener('click', function() {
                if (cell.classList.contains('checked')) return;
                cell.classList.add('checked');
                var k = parseInt(cell.dataset.k);
                var modVal = row[k] % rowNum;
                cell.innerHTML = row[k] + '<div class="mod-label">mod ' + rowNum + ' = ' + modVal + '</div>';
                cell.classList.add(modVal === 0 ? 'divisible' : 'not-divisible');
                checked++;
                sndTick();
            });
        });

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME (all zero)</button>' +
            '<button class="answer-btn" data-val="composite">COMPOSITE (some nonzero)</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, rowNum + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE'));
            });
        });
    }

    // Round C: Given several row numbers, pick which are prime
    function renderPascalPrimesC() {
        var nums = shuffle([4, 5, 6, 7, 9, 10, 11, 13, 14, 15]).slice(0, 4);
        var primeNums = nums.filter(function(n) { return trialDivision(n); });
        var picked = [];

        $questionPrompt.innerHTML = 'For which of these row numbers are <strong>all middle entries</strong> divisible by the row number? (Select all that apply — those are the primes!)';

        var html = '';
        for (var i = 0; i < nums.length; i++) {
            var n = nums[i];
            var row = pascalRow(n);
            html += '<div class="pascal-mini-row" data-n="' + n + '"><strong>Row ' + n + ':</strong> ';
            html += row.join(', ');
            html += '</div>';
        }
        $questionVisual.innerHTML = html;

        var btns = '';
        for (var i = 0; i < nums.length; i++)
            btns += '<button class="answer-btn toggle-btn" data-val="' + nums[i] + '">' + nums[i] + '</button>';
        btns += '<button class="btn btn-primary" id="pascal-submit" style="margin-left:12px">Submit</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.toggle-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                btn.classList.toggle('selected');
                var val = parseInt(btn.dataset.val);
                var idx = picked.indexOf(val);
                if (idx === -1) picked.push(val);
                else picked.splice(idx, 1);
            });
        });

        document.getElementById('pascal-submit').addEventListener('click', function() {
            if (!state.questionActive) return;
            picked.sort();
            primeNums.sort();
            var correct = picked.length === primeNums.length && picked.every(function(v, i) { return v === primeNums[i]; });
            handleAnswer(correct, 'Prime rows: ' + primeNums.join(', '));
        });
    }

    // ═══ LEVEL 12: POLYNOMIALS — BUILDING BLOCKS ══════════════════════════

    function polyToString(coeffs) {
        // coeffs[i] is coefficient of x^i, from highest degree down
        var parts = [];
        for (var i = coeffs.length - 1; i >= 0; i--) {
            var c = coeffs[i];
            if (c === 0) continue;
            var term = '';
            if (i === 0) term = '' + Math.abs(c);
            else if (i === 1) term = (Math.abs(c) === 1 ? '' : Math.abs(c)) + 'x';
            else term = (Math.abs(c) === 1 ? '' : Math.abs(c)) + 'x<sup>' + i + '</sup>';
            if (parts.length === 0) term = (c < 0 ? '−' : '') + term;
            else term = (c < 0 ? ' − ' : ' + ') + term;
            parts.push(term);
        }
        return parts.join('') || '0';
    }

    function renderLevelPolynomials() {
        if (state.currentRound === 0) renderPolyA();
        else if (state.currentRound === 1) renderPolyB();
        else renderPolyC();
    }

    // Round A: Identify parts
    function renderPolyA() {
        var degree = randInt(2, 4);
        var coeffs = [];
        for (var i = 0; i <= degree; i++) coeffs.push(randInt(-5, 5));
        while (coeffs[degree] === 0) coeffs[degree] = randInt(1, 5);

        var questions = ['degree', 'leading', 'constant'];
        var qType = pickRandom(questions);

        var polyStr = polyToString(coeffs);
        $questionPrompt.innerHTML = '<span style="font-size:1.3rem">' + polyStr + '</span>';

        var correctVal, qText;
        if (qType === 'degree') {
            correctVal = degree;
            qText = 'What is the <strong>degree</strong> of this polynomial?';
        } else if (qType === 'leading') {
            correctVal = coeffs[degree];
            qText = 'What is the <strong>leading coefficient</strong> (coefficient of x<sup>' + degree + '</sup>)?';
        } else {
            correctVal = coeffs[0];
            qText = 'What is the <strong>constant term</strong>?';
        }

        $questionVisual.innerHTML = '<div style="color:#aaa;margin:8px 0">' + qText + '</div>';

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = correctVal + randInt(-4, 4);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'Answer: ' + correctVal);
            });
        });
    }

    // Round B: Add polynomials
    function renderPolyB() {
        var deg = randInt(2, 3);
        var a = [], b = [], sum = [];
        for (var i = 0; i <= deg; i++) {
            a.push(randInt(-4, 4));
            b.push(randInt(-4, 4));
            sum.push(a[i] + b[i]);
        }
        while (a[deg] === 0) a[deg] = randInt(1, 4);
        while (b[deg] === 0) b[deg] = randInt(1, 4);
        sum[deg] = a[deg] + b[deg];

        var correctStr = polyToString(sum);

        $questionPrompt.innerHTML = 'Add these polynomials:';
        $questionVisual.innerHTML = '<div class="poly-term">(' + polyToString(a) + ') + (' + polyToString(b) + ')</div>';

        // Generate wrong answers
        var choiceStrs = [correctStr];
        var choiceArrays = [sum];
        while (choiceStrs.length < 4) {
            var wrong = sum.slice();
            var idx = randInt(0, deg);
            wrong[idx] += randInt(-3, 3);
            if (wrong[idx] === sum[idx]) wrong[idx] += 1;
            var ws = polyToString(wrong);
            if (choiceStrs.indexOf(ws) === -1) { choiceStrs.push(ws); choiceArrays.push(wrong); }
        }
        var indices = [0, 1, 2, 3];
        shuffle(indices);
        var btns = '';
        for (var i = 0; i < indices.length; i++)
            btns += '<button class="answer-btn" data-val="' + indices[i] + '">' + choiceStrs[indices[i]] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === 0;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'Sum = ' + correctStr);
            });
        });
    }

    // Round C: Multiply binomials
    function renderPolyC() {
        var a = randInt(1, 5), b = randInt(1, 5);
        // (x + a)(x + b) = x² + (a+b)x + ab
        var correctCoeffs = [a * b, a + b, 1]; // constant, x, x²
        var correctStr = polyToString(correctCoeffs);

        $questionPrompt.innerHTML = 'Multiply these binomials:';

        // Area model visual
        var html = '<div class="poly-term">(x + ' + a + ')(x + ' + b + ')</div>';
        html += '<div class="area-model">';
        html += '<div class="area-header"><div></div><div>x</div><div>' + b + '</div></div>';
        html += '<div class="area-row"><div class="area-label">x</div><div class="area-cell">x²</div><div class="area-cell">' + b + 'x</div></div>';
        html += '<div class="area-row"><div class="area-label">' + a + '</div><div class="area-cell">' + a + 'x</div><div class="area-cell">' + (a * b) + '</div></div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choiceStrs = [correctStr];
        while (choiceStrs.length < 4) {
            var wc = [a * b + randInt(-3, 3), a + b + randInt(-2, 2), 1];
            if (wc[0] === correctCoeffs[0] && wc[1] === correctCoeffs[1]) wc[1] += 1;
            var ws = polyToString(wc);
            if (choiceStrs.indexOf(ws) === -1) choiceStrs.push(ws);
        }
        var indices = [0, 1, 2, 3];
        shuffle(indices);
        var btns = '';
        for (var i = 0; i < indices.length; i++)
            btns += '<button class="answer-btn" data-val="' + indices[i] + '">' + choiceStrs[indices[i]] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === 0;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, '(x + ' + a + ')(x + ' + b + ') = ' + correctStr);
            });
        });
    }

    // ═══ LEVEL 13: BINOMIAL EXPANSION ══════════════════════════════════════

    function renderLevelBinomial() {
        if (state.currentRound === 0) renderBinomialA();
        else if (state.currentRound === 1) renderBinomialB();
        else renderBinomialC();
    }

    // Round A: Pascal's triangle — fill in entries
    function renderBinomialA() {
        var targetRow = randInt(4, 7);
        var row = pascalRow(targetRow);
        var blankK = randInt(1, targetRow - 1);
        var correctVal = row[blankK];

        $questionPrompt.innerHTML = 'The binomial coefficients come from Pascal\'s triangle. Fill in the missing entry in <strong>row ' + targetRow + '</strong>.';
        var html = '<div class="pascal-triangle">';
        for (var r = 0; r <= targetRow; r++) {
            var rowVals = pascalRow(r);
            html += '<div class="pascal-row' + (r === targetRow ? ' highlight-row' : '') + '">';
            for (var k = 0; k <= r; k++) {
                if (r === targetRow && k === blankK)
                    html += '<div class="pascal-cell blank">?</div>';
                else
                    html += '<div class="pascal-cell">' + rowVals[k] + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = correctVal + randInt(-5, 8);
            if (w > 0 && choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'C(' + targetRow + ', ' + blankK + ') = ' + correctVal);
            });
        });
    }

    // Round B: Expand (x+a)^n — pick correct coefficients
    function renderBinomialB() {
        var n = pickRandom([2, 3, 4]);
        var a = randInt(1, 3);
        var row = pascalRow(n);

        // Build the expansion string: sum of C(n,k) * a^k * x^(n-k)
        var terms = [];
        for (var k = 0; k <= n; k++) {
            var coeff = row[k] * Math.pow(a, k);
            var xPow = n - k;
            terms.push(coeff);
        }
        // terms[k] = coefficient of x^(n-k), rearrange to standard form
        var coeffsStd = []; // coeffsStd[i] = coeff of x^i
        for (var i = 0; i <= n; i++) coeffsStd[i] = terms[n - i];
        var correctStr = polyToString(coeffsStd);

        $questionPrompt.innerHTML = 'Expand <strong>(x + ' + a + ')<sup>' + n + '</sup></strong> using the Binomial Theorem.';

        // Show Pascal's row
        $questionVisual.innerHTML = renderPascalTriangle(n + 1, n) +
            '<div style="color:#aaa;margin-top:8px">Row ' + n + ' coefficients: ' + row.join(', ') + '</div>';

        var choiceStrs = [correctStr];
        while (choiceStrs.length < 4) {
            var wCoeffs = coeffsStd.slice();
            var idx = randInt(0, n);
            wCoeffs[idx] += randInt(-3, 3) || 1;
            var ws = polyToString(wCoeffs);
            if (choiceStrs.indexOf(ws) === -1) choiceStrs.push(ws);
        }
        var indices = [0, 1, 2, 3];
        shuffle(indices);
        var btns = '';
        for (var i = 0; i < indices.length; i++)
            btns += '<button class="answer-btn" data-val="' + indices[i] + '">' + choiceStrs[indices[i]] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === 0;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, '(x + ' + a + ')^' + n + ' = ' + correctStr);
            });
        });
    }

    // Round C: Coefficients mod n — bridge to Polynomial Fermat
    function renderBinomialC() {
        var n = pickRandom([5, 6, 7, 8, 9, 10, 11]);
        var row = pascalRow(n);
        var isPrime = trialDivision(n);

        $questionPrompt.innerHTML = 'Compute each middle coefficient of <strong>(x+1)<sup>' + n + '</sup></strong> mod ' + n + '. What do you notice?';

        var html = '<div class="pascal-row-display" id="binom-row">';
        for (var k = 0; k <= n; k++) {
            var isEnd = k === 0 || k === n;
            html += '<div class="pascal-cell' + (isEnd ? ' endpoint' : ' clickable') + '" data-k="' + k + '">' + row[k] + '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var checked = 0, middleCount = n - 1;
        $questionVisual.querySelectorAll('.pascal-cell.clickable').forEach(function(cell) {
            cell.addEventListener('click', function() {
                if (cell.classList.contains('checked')) return;
                cell.classList.add('checked');
                var k = parseInt(cell.dataset.k);
                var modVal = row[k] % n;
                cell.innerHTML = row[k] + '<div class="mod-label">mod ' + n + ' = ' + modVal + '</div>';
                cell.classList.add(modVal === 0 ? 'divisible' : 'not-divisible');
                checked++;
                sndTick();
                if (checked >= middleCount) {
                    setTimeout(function() {
                        $answerButtons.innerHTML =
                            '<button class="answer-btn" data-val="prime">All zero — ' + n + ' is PRIME!</button>' +
                            '<button class="answer-btn" data-val="composite">Some nonzero — ' + n + ' is COMPOSITE</button>';
                        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
                            btn.addEventListener('click', function() {
                                var ans = btn.dataset.val;
                                var correct = (ans === 'prime') === isPrime;
                                btn.classList.add(correct ? 'correct' : 'wrong');
                                handleAnswer(correct, n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE'));
                            });
                        });
                    }, 500);
                }
            });
        });

        $answerButtons.innerHTML = '<div style="color:#888">Click each middle coefficient to compute its mod ' + n + ' value</div>';
    }

    // ═══ LEVEL 14: POLYNOMIAL FERMAT ══════════════════════════════════════

    function renderLevelPolyFermat() {
        var n;
        if (state.currentRound === 0) {
            n = pickRandom([3, 5, 7]);
        } else {
            n = pickRandom([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        }

        var isPrime = trialDivision(n);
        var row = getPascalRowModN(n);

        $questionPrompt.innerHTML = 'Coefficient Canvas: Expand (x+a)<sup>' + n + '</sup> — each middle block is a binomial coefficient C(' + n + ',k). Click each block to reduce it mod ' + n + '. For primes, every middle coefficient vanishes (becomes 0). For composites, at least one survives. Stamp them all, then decide!';

        // Show coefficient blocks
        var maxCoeff = 1;
        for (var i = 0; i < row.length; i++) if (row[i] > maxCoeff) maxCoeff = row[i];

        var html = '<div class="coeff-row" id="coeff-row">';
        for (var i = 0; i <= n; i++) {
            var isEndpoint = (i === 0 || i === n);
            var h = isEndpoint ? 30 : Math.max(20, Math.round(60 * (row[i] + 1) / (maxCoeff + 1)));
            var cls = isEndpoint ? 'coeff-block endpoint' : 'coeff-block';
            html += '<div class="' + cls + '" data-k="' + i + '" style="height:' + h + 'px">' +
                (isEndpoint ? '1' : 'C(' + n + ',' + i + ')') + '</div>';
        }
        html += '</div>';
        html += '<div style="display:flex;gap:4px;justify-content:center;margin-top:4px">';
        for (var i = 0; i <= n; i++)
            html += '<div class="coeff-label">k=' + i + '</div>';
        html += '</div>';

        $questionVisual.innerHTML = html;

        var stamped = 0;
        var middleCount = n - 1; // k = 1..n-1
        var allZero = true;

        $questionVisual.querySelectorAll('.coeff-block:not(.endpoint)').forEach(function(block) {
            block.addEventListener('click', function() {
                if (!state.questionActive) return;
                if (block.classList.contains('stamped-zero') || block.classList.contains('stamped-nonzero')) return;

                var k = parseInt(block.dataset.k);
                var modVal = row[k];
                stamped++;

                if (modVal === 0) {
                    block.classList.add('stamped-zero');
                    block.textContent = '0';
                    block.style.height = '20px';
                    sndTick();
                } else {
                    block.classList.add('stamped-nonzero');
                    block.textContent = modVal;
                    allZero = false;
                    sndWrong();
                }

                if (stamped >= middleCount) {
                    // All stamped — now ask for verdict
                    setTimeout(function() {
                        showCoeffVerdict(n, isPrime, allZero);
                    }, 500);
                }
            });
        });

        $answerButtons.innerHTML = '<div style="font-size:0.85rem;color:#888">Click each middle coefficient to stamp it with mod ' + n + '</div>';
    }

    function showCoeffVerdict(n, isPrime, allZero) {
        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME (all vanished)</button>' +
            '<button class="answer-btn" data-val="composite">COMPOSITE (some remained)</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, n + ' is ' + (isPrime ? 'PRIME — all middle coefficients vanish mod ' + n : 'COMPOSITE — some C(' + n + ',k) ≢ 0 (mod ' + n + ')'));
            });
        });
    }

    // ═══ LEVEL 15: THE AKS TEST ═══════════════════════════════════════════

    function renderLevelAKS() {
        if (state.currentRound === 0) renderLevel8A();
        else if (state.currentRound === 1) renderLevel8B();
        else renderLevel8C();
    }

    // 8A: AKS Flowchart walkthrough
    function renderLevel8A() {
        var candidates = [7, 13, 17, 25, 49, 91, 121, 127, 64, 343, 561];
        var n = pickRandom(candidates);
        var steps = aksSteps(n);
        var currentStepIdx = 0;

        $questionPrompt.innerHTML = 'AKS Flowchart: Walk through each step of the AKS algorithm. At each step, choose the correct action. Example: for 125, Step 1 finds 5<sup>3</sup> = 125 → composite!<br>Testing n = <strong>' + n + '</strong>';

        function renderAKSStep() {
            var s = steps[currentStepIdx];
            var html = '<div class="aks-flowchart">';
            var stepNames = ['','Perfect Power?','Find r','Small Factor Check','n ≤ r?','Polynomial Check'];

            for (var i = 0; i <= currentStepIdx; i++) {
                var st = steps[i];
                var cls = i < currentStepIdx ? (st.result === 'pass' ? 'passed' : (st.result === 'prime' ? 'passed' : 'failed')) :
                    'active';
                html += '<div class="aks-step ' + cls + '">' +
                    '<div class="aks-step-label">Step ' + st.step + ': ' + (stepNames[st.step] || '') + '</div>' +
                    '<div class="aks-step-desc">' + st.msg + '</div>' +
                    '</div>';
            }
            html += '</div>';
            $questionVisual.innerHTML = html;

            if (s.result === 'pass') {
                // Continue to next step
                $answerButtons.innerHTML = '<button class="btn btn-primary" id="aks-next">Next Step</button>';
                document.getElementById('aks-next').addEventListener('click', function() {
                    currentStepIdx++;
                    if (currentStepIdx >= steps.length) {
                        var final = steps[steps.length - 1];
                        handleAnswer(true, n + ' is ' + (final.result === 'prime' ? 'PRIME' : 'COMPOSITE'));
                    } else {
                        renderAKSStep();
                    }
                });
            } else {
                // Final step — ask for verdict
                $answerButtons.innerHTML =
                    '<button class="answer-btn" data-val="prime">PRIME</button>' +
                    '<button class="answer-btn" data-val="composite">COMPOSITE</button>';
                var isPrime = s.result === 'prime';
                $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var correct = (btn.dataset.val === 'prime') === isPrime;
                        btn.classList.add(correct ? 'correct' : 'wrong');
                        handleAnswer(correct, n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE') + ' — ' + s.msg);
                    });
                });
            }
        }
        renderAKSStep();
    }

    // 8B: Polynomial comparison
    function renderLevel8B() {
        var primes = [5, 7, 11, 13];
        var composites = [6, 9, 10, 15, 21];
        var n = Math.random() < 0.5 ? pickRandom(primes) : pickRandom(composites);
        var a = randInt(1, 3);
        var r = Math.min(n, 5);
        var isPrime = trialDivision(n);

        $questionPrompt.innerHTML = 'Polynomial Ring: AKS checks if (x+a)<sup>n</sup> equals x<sup>n</sup>+a after reducing mod (x<sup>r</sup>−1) and mod n. Compare the two bar charts below — if they match, the number is prime.<br>Does (x+' + a + ')<sup>' + n + '</sup> ≡ x<sup>' + n + '</sup>+' + a + ' mod (x<sup>' + r + '</sup>−1, ' + n + ')?';

        // Compute both sides (simplified visual)
        // Left side: coefficients of (x+a)^n mod (x^r - 1, n)
        // Right side: coefficients of x^(n mod r) + a mod n
        var left = new Array(r).fill(0);
        var right = new Array(r).fill(0);

        // Simplified: for the visual, compute via BigInt polynomial multiplication
        left[0] = 1;
        var base = new Array(r).fill(0);
        base[0] = a % n;
        base[1 % r] = (base[1 % r] + 1) % n;

        var exp = n;
        while (exp > 0) {
            if (exp % 2 === 1) left = polyMul(left, base, r, n);
            base = polyMul(base, base, r, n);
            exp = Math.floor(exp / 2);
        }

        right[0] = a % n;
        right[n % r] = (right[n % r] + 1) % n;

        var match = true;
        for (var i = 0; i < r; i++) if (left[i] !== right[i]) { match = false; break; }

        // Show bar charts
        var maxVal = 1;
        for (var i = 0; i < r; i++) { if (left[i] > maxVal) maxVal = left[i]; if (right[i] > maxVal) maxVal = right[i]; }

        var html = '<div class="poly-compare"><div class="poly-side"><h4>(x+' + a + ')<sup>' + n + '</sup> mod</h4><div class="poly-bars">';
        for (var i = 0; i < r; i++) {
            var h = Math.max(4, Math.round(80 * left[i] / maxVal));
            html += '<div class="poly-bar left" style="height:' + h + 'px" title="coeff[' + i + ']=' + left[i] + '"></div>';
        }
        html += '</div></div><div class="poly-side"><h4>x<sup>' + n + '</sup>+' + a + ' mod</h4><div class="poly-bars">';
        for (var i = 0; i < r; i++) {
            var h = Math.max(4, Math.round(80 * right[i] / maxVal));
            html += '<div class="poly-bar right" style="height:' + h + 'px" title="coeff[' + i + ']=' + right[i] + '"></div>';
        }
        html += '</div></div></div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="match">Match — PRIME</button>' +
            '<button class="answer-btn" data-val="mismatch">Mismatch — COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'match') === match;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'Polynomials ' + (match ? 'MATCH' : 'DON\'T MATCH') + '. ' + n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE'));
            });
        });
    }

    function polyMul(a, b, r, n) {
        var result = new Array(r).fill(0);
        for (var i = 0; i < r; i++) {
            if (a[i] === 0) continue;
            for (var j = 0; j < r; j++) {
                if (b[j] === 0) continue;
                var idx = (i + j) % r;
                result[idx] = (result[idx] + a[i] * b[j]) % n;
            }
        }
        return result;
    }

    // 8C: Final Exam — choose the right tool
    function renderLevel8C() {
        var pool = shuffle([
            {n: 49, type: 'power', hint: 'perfect power'},
            {n: 91, type: 'trial', hint: 'trial division finds 7×13'},
            {n: 127, type: 'prime', hint: 'prime'},
            {n: 561, type: 'carmichael', hint: 'Carmichael number'},
            {n: 17, type: 'prime', hint: 'prime'},
            {n: 1000, type: 'power', hint: '10^3'},
            {n: 221, type: 'trial', hint: '13×17'},
            {n: 29, type: 'prime', hint: 'prime'},
            {n: 64, type: 'power', hint: '2^6'},
            {n: 1105, type: 'carmichael', hint: 'Carmichael number'}
        ]);
        var item = pool[state.questionIndex % pool.length];
        var n = item.n;
        var isPrime = trialDivision(n);

        $questionPrompt.innerHTML = 'Final Exam: Use everything you\'ve learned. Is this number prime, a perfect power (like 64 = 2<sup>6</sup>), a Carmichael number (fools Fermat\'s test, like 561), or just composite?<span class="big-number">' + n + '</span>';
        $questionVisual.innerHTML = '<div style="font-size:0.85rem;color:#888">Choose the best tool and verdict</div>';

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME</button>' +
            '<button class="answer-btn" data-val="power">Perfect Power</button>' +
            '<button class="answer-btn" data-val="composite">Composite</button>' +
            '<button class="answer-btn" data-val="carmichael">Carmichael Number</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = false;
                if (item.type === 'prime' && ans === 'prime') correct = true;
                else if (item.type === 'power' && (ans === 'power' || ans === 'composite')) correct = true;
                else if (item.type === 'trial' && ans === 'composite') correct = true;
                else if (item.type === 'carmichael' && (ans === 'carmichael' || ans === 'composite')) correct = true;

                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, n + ': ' + item.hint);
            });
        });
    }

    // ═══ LEVEL 12 (NEW): MODULAR ARITHMETIC ════════════════════════════════

    function renderLevelModArith() {
        if (state.currentRound === 0) renderModArithA();
        else if (state.currentRound === 1) renderModArithB();
        else renderModArithC();
    }

    // Round A: Small modular exponentiation — compute a^b mod m step by step
    function renderModArithA() {
        var bases = [2,3,4,5,7];
        var mods = [5,7,11,13];
        var a = pickRandom(bases);
        var m = pickRandom(mods.filter(function(x) { return x > a; }));
        var b = randInt(3, 8);
        var correctVal = modPow(a, b, m);

        $questionPrompt.innerHTML = 'Compute <strong>' + a + '<sup>' + b + '</sup> mod ' + m + '</strong>';

        // Show step-by-step
        var html = '<div class="mod-exp-steps">';
        var val = 1;
        for (var i = 1; i <= b; i++) {
            val = (val * a) % m;
            html += '<div class="step' + (i === b ? ' highlight' : '') + '">' + a + '<sup>' + i + '</sup> mod ' + m + ' = ' + val + '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = randInt(0, m - 1);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, a + '^' + b + ' mod ' + m + ' = ' + correctVal);
            });
        });
    }

    // Round B: Use Fermat's shortcut — a^(p-1) ≡ 1 (mod p)
    function renderModArithB() {
        var primes = [7, 11, 13, 17, 19, 23, 29, 31];
        var p = pickRandom(primes);
        var a = randInt(2, p - 1);

        // Generate exponent that may or may not equal p-1
        var expTypes = [
            { exp: p - 1, hint: 'exp = p\u22121' },
            { exp: 2 * (p - 1), hint: 'exp = 2(p\u22121)' },
            { exp: (p - 1) + randInt(1, p - 2), hint: 'exp has a remainder' }
        ];
        var chosen = pickRandom(expTypes);
        var exp = chosen.exp;
        var remainder = exp % (p - 1);
        var correctVal = remainder === 0 ? 1 : modPow(a, remainder, p);

        $questionPrompt.innerHTML = 'Use Fermat\'s shortcut! <strong>' + a + '<sup>' + exp + '</sup> mod ' + p + '</strong><br><span style="color:#aaa;font-size:0.9rem">' + p + ' is prime, so ' + a + '<sup>' + (p-1) + '</sup> \u2261 1 (mod ' + p + ')</span>';

        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">Fermat: ' + a + '<sup>' + (p-1) + '</sup> \u2261 1 (mod ' + p + ')</div>';
        html += '<div class="step">' + exp + ' = ' + Math.floor(exp / (p - 1)) + ' \u00d7 ' + (p-1) + ' + ' + remainder + '</div>';
        if (remainder === 0) {
            html += '<div class="step highlight">' + a + '<sup>' + exp + '</sup> = (1)<sup>' + Math.floor(exp / (p - 1)) + '</sup> = <strong>1</strong></div>';
        } else {
            html += '<div class="step">So ' + a + '<sup>' + exp + '</sup> \u2261 ' + a + '<sup>' + remainder + '</sup> (mod ' + p + ')</div>';
            html += '<div class="step highlight">' + a + '<sup>' + remainder + '</sup> mod ' + p + ' = <strong>' + correctVal + '</strong></div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = randInt(0, p - 1);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, a + '^' + exp + ' mod ' + p + ' = ' + correctVal + (remainder === 0 ? ' (Fermat: exp is a multiple of p\u22121!)' : ''));
            });
        });
    }

    // Round C: Giant numbers — recognize Fermat shortcut instantly
    function renderModArithC() {
        // Pool of problems with huge bases/exponents but prime moduli
        var problems = [
            { a: '273246787654', aNum: 273246787654, exp: 65536, mod: 65537, hint: '65537 is prime, 65536 = 65537\u22121' },
            { a: '999999999999', aNum: 999999999999, exp: 65536, mod: 65537, hint: '65537 is prime, 65536 = 65537\u22121' },
            { a: '123456789', aNum: 123456789, exp: 30, mod: 31, hint: '31 is prime, 30 = 31\u22121' },
            { a: '7777777', aNum: 7777777, exp: 36, mod: 37, hint: '37 is prime, 36 = 37\u22121' },
            { a: '42424242', aNum: 42424242, exp: 100, mod: 101, hint: '101 is prime, 100 = 101\u22121' },
            { a: '314159265', aNum: 314159265, exp: 112, mod: 113, hint: '113 is prime, 112 = 113\u22121' },
            { a: '271828182', aNum: 271828182, exp: 1000, mod: 1009, hint: '1009 is prime; 1000 mod 1008 = 1000' }
        ];
        var prob = problems[state.questionIndex % problems.length];

        // Compute the actual answer
        var reducedExp = prob.exp % (prob.mod - 1);
        var aReduced = ((prob.aNum % prob.mod) + prob.mod) % prob.mod;
        var correctVal;
        if (reducedExp === 0) {
            correctVal = aReduced === 0 ? 0 : 1;
        } else {
            correctVal = modPow(aReduced, reducedExp, prob.mod);
        }

        $questionPrompt.innerHTML = 'What is <strong>' + prob.a + '<sup>' + prob.exp + '</sup> mod ' + prob.mod + '</strong>?<br><span style="color:#aaa;font-size:0.9rem">Hint: ' + prob.hint + '</span>';

        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">' + prob.mod + ' is prime \u2192 Fermat applies!</div>';
        html += '<div class="step">a<sup>' + (prob.mod - 1) + '</sup> \u2261 1 (mod ' + prob.mod + ')</div>';
        html += '<div class="step">' + prob.exp + ' mod ' + (prob.mod - 1) + ' = ' + reducedExp + '</div>';
        if (reducedExp === 0) {
            html += '<div class="step highlight">Exponent is a multiple of p\u22121 \u2192 answer = <strong>1</strong></div>';
        } else {
            html += '<div class="step">' + prob.a + ' mod ' + prob.mod + ' = ' + aReduced + '</div>';
            html += '<div class="step highlight">' + aReduced + '<sup>' + reducedExp + '</sup> mod ' + prob.mod + ' = <strong>' + correctVal + '</strong></div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctVal];
        while (choices.length < 4) {
            var w = randInt(0, prob.mod - 1);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctVal;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, prob.a + '^' + prob.exp + ' mod ' + prob.mod + ' = ' + correctVal);
            });
        });
    }

    // ═══ LEVEL 13 (NEW): EULER'S TOTIENT FUNCTION ═════════════════════════

    function renderLevelEulerTotient() {
        if (state.currentRound === 0) renderTotientA();
        else if (state.currentRound === 1) renderTotientB();
        else renderTotientC();
    }

    // Round A: Compute φ(n) for small n by counting coprimes
    function renderTotientA() {
        var n = randInt(4, 12);
        var correctPhi = eulerTotient(n);

        $questionPrompt.innerHTML = 'What is <strong>&phi;(' + n + ')</strong>?<br>Count the numbers from 1 to ' + n + ' that are <strong>coprime</strong> with ' + n + ' (GCD = 1).';

        // Show a grid of 1..n, highlighting coprime numbers
        var cols = Math.min(n, 6);
        var html = '<div class="totient-grid" style="grid-template-columns:repeat(' + cols + ', 40px)">';
        for (var i = 1; i <= n; i++) {
            var isCoprime = gcd(i, n) === 1;
            html += '<div class="totient-cell' + (isCoprime ? ' coprime' : ' not-coprime') + '">' + i + '</div>';
        }
        html += '</div>';
        html += '<div style="color:#aaa;margin-top:8px;font-size:0.85rem">Green = coprime with ' + n + ', crossed = shares a factor</div>';
        $questionVisual.innerHTML = html;

        var choices = [correctPhi];
        while (choices.length < 4) {
            var w = correctPhi + randInt(-3, 3);
            if (w > 0 && w <= n && choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctPhi;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, '\u03c6(' + n + ') = ' + correctPhi);
            });
        });
    }

    // Round B: φ(p) for primes and φ(p²) for prime powers
    function renderTotientB() {
        var primes = [2,3,5,7,11,13];
        var p = pickRandom(primes);
        var usePower = Math.random() < 0.4;
        var n, correctPhi, explanation;

        if (usePower) {
            n = p * p;
            correctPhi = n - p; // φ(p²) = p² - p
            explanation = '\u03c6(' + p + '\u00b2) = ' + p + '\u00b2 \u2212 ' + p + ' = ' + n + ' \u2212 ' + p + ' = ' + correctPhi;
        } else {
            n = p;
            correctPhi = p - 1;
            explanation = '\u03c6(' + p + ') = ' + p + ' \u2212 1 = ' + correctPhi + ' (all numbers < a prime are coprime with it!)';
        }

        $questionPrompt.innerHTML = 'What is <strong>&phi;(' + n + ')</strong>?' +
            (usePower ? '<br>' + n + ' = ' + p + '<sup>2</sup> (a prime power)' : '<br>' + n + ' is prime!');
        $questionVisual.innerHTML = usePower ?
            '<div class="rule-display"><div style="color:#3cf0ff;font-weight:700">\u03c6(p<sup>k</sup>) = p<sup>k</sup> \u2212 p<sup>k\u22121</sup></div><div style="color:#ddd;margin-top:8px">For p = ' + p + ', k = 2: \u03c6(' + n + ') = ' + n + ' \u2212 ' + p + ' = ?</div></div>' :
            '<div class="rule-display"><div style="color:#3cf0ff;font-weight:700">\u03c6(p) = p \u2212 1 for any prime p</div><div style="color:#ddd;margin-top:8px">Every number from 1 to p\u22121 is coprime with a prime!</div></div>';

        var choices = [correctPhi];
        while (choices.length < 4) {
            var w = correctPhi + randInt(-4, 4);
            if (w > 0 && choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctPhi;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, explanation);
            });
        });
    }

    // Round C: φ(p×q) for semiprimes — bridge to RSA
    function renderTotientC() {
        var primes = [3,5,7,11,13];
        var p = pickRandom(primes);
        var q = pickRandom(primes.filter(function(x) { return x !== p; }));
        if (p > q) { var tmp = p; p = q; q = tmp; }
        var n = p * q;
        var correctPhi = (p - 1) * (q - 1);

        $questionPrompt.innerHTML = 'What is <strong>&phi;(' + n + ')</strong>?<br>' + n + ' = ' + p + ' &times; ' + q + ' (both prime)';

        $questionVisual.innerHTML = '<div class="rule-display">' +
            '<div style="color:#3cf0ff;font-weight:700">\u03c6(p \u00d7 q) = (p\u22121)(q\u22121) for distinct primes</div>' +
            '<div style="color:#ddd;margin-top:8px">\u03c6(' + n + ') = (' + p + '\u22121)(' + q + '\u22121) = ' + (p-1) + ' \u00d7 ' + (q-1) + ' = ?</div>' +
            '<div style="color:#ffd740;margin-top:12px;font-size:0.85rem">This formula is the key to RSA encryption!</div>' +
            '</div>';

        var choices = [correctPhi];
        while (choices.length < 4) {
            var w = correctPhi + randInt(-6, 6);
            if (w > 0 && choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === correctPhi;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, '\u03c6(' + n + ') = (' + p + '\u22121)(' + q + '\u22121) = ' + (p-1) + ' \u00d7 ' + (q-1) + ' = ' + correctPhi);
            });
        });
    }

    // ═══ LEVEL 19 (NEW): MILLER-RABIN TEST ══════════════════════════════

    function renderLevelMillerRabin() {
        if (state.currentRound === 0) renderMillerRabinA();
        else if (state.currentRound === 1) renderMillerRabinB();
        else renderMillerRabinC();
    }

    // Round A: Factor n-1 as 2^s × d
    function renderMillerRabinA() {
        var pool = [13, 17, 25, 29, 37, 41, 49, 51, 65, 85, 91, 97, 221];
        var n = pickRandom(pool);
        var dec = millerRabinDecompose(n);
        var correctS = dec.s, correctD = dec.d;

        $questionPrompt.innerHTML = 'Decompose <strong>n \u2212 1 = ' + (n-1) + '</strong> as 2<sup>s</sup> \u00d7 d where d is odd.<br>What are <strong>s</strong> and <strong>d</strong>?';

        // Show the factoring process
        var temp = n - 1, steps = [];
        while (temp % 2 === 0) {
            steps.push(temp + ' \u00f7 2 = ' + (temp / 2));
            temp = Math.floor(temp / 2);
        }

        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">n \u2212 1 = ' + (n-1) + '</div>';
        for (var i = 0; i < steps.length; i++)
            html += '<div class="step">' + steps[i] + '</div>';
        html += '<div class="result-line">' + (n-1) + ' = 2<sup>' + correctS + '</sup> \u00d7 ' + correctD + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        // Ask for s
        var sChoices = [correctS];
        while (sChoices.length < 4) {
            var w = randInt(0, 6);
            if (sChoices.indexOf(w) === -1) sChoices.push(w);
        }
        shuffle(sChoices);

        $answerButtons.innerHTML = '<div style="margin-bottom:8px;color:#aaa">What is s (power of 2)?</div>';
        var btns = '';
        for (var i = 0; i < sChoices.length; i++)
            btns += '<button class="answer-btn mr-step1" data-val="' + sChoices[i] + '">s = ' + sChoices[i] + '</button>';
        $answerButtons.innerHTML += btns;

        $answerButtons.querySelectorAll('.mr-step1').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                var val = parseInt(btn.dataset.val);
                if (val !== correctS) {
                    btn.classList.add('wrong');
                    handleAnswer(false, (n-1) + ' = 2^' + correctS + ' \u00d7 ' + correctD + ', so s = ' + correctS);
                    return;
                }
                btn.classList.add('correct');
                sndTick();
                // Now ask for d
                setTimeout(function() {
                    var dChoices = [correctD];
                    while (dChoices.length < 4) {
                        var w2 = randInt(1, correctD * 2) | 1; // odd only
                        if (dChoices.indexOf(w2) === -1) dChoices.push(w2);
                    }
                    shuffle(dChoices);
                    $answerButtons.innerHTML = '<div style="margin-bottom:8px;color:#aaa">What is d (odd part)?</div>';
                    var btns2 = '';
                    for (var i = 0; i < dChoices.length; i++)
                        btns2 += '<button class="answer-btn mr-step2" data-val="' + dChoices[i] + '">d = ' + dChoices[i] + '</button>';
                    $answerButtons.innerHTML += btns2;

                    $answerButtons.querySelectorAll('.mr-step2').forEach(function(btn2) {
                        btn2.addEventListener('click', function() {
                            var v = parseInt(btn2.dataset.val);
                            var correct = v === correctD;
                            btn2.classList.add(correct ? 'correct' : 'wrong');
                            handleAnswer(correct, (n-1) + ' = 2^' + correctS + ' \u00d7 ' + correctD);
                        });
                    });
                }, 600);
            });
        });
    }

    // Round B: Walk through the squaring sequence
    function renderMillerRabinB() {
        var primePool = [13, 17, 29, 37, 41, 53, 61, 97];
        var compositePool = [25, 49, 51, 65, 91, 221, 341];
        var n = Math.random() < 0.5 ? pickRandom(primePool) : pickRandom(compositePool);
        var bases = [2, 3, 5, 7];
        var a = pickRandom(bases.filter(function(x) { return x < n; }));
        var result = millerRabinTest(n, a);
        var isPrime = trialDivision(n);

        $questionPrompt.innerHTML = 'Miller-Rabin test: n = <strong>' + n + '</strong>, base a = <strong>' + a + '</strong>.<br>Watch the squaring sequence and decide: prime or composite?';

        var dec = millerRabinDecompose(n);
        var html = '<div class="mod-exp-steps">';
        html += '<div class="step">n\u22121 = ' + (n-1) + ' = 2<sup>' + dec.s + '</sup> \u00d7 ' + dec.d + '</div>';
        for (var i = 0; i < result.steps.length; i++) {
            var s = result.steps[i];
            var isLast = i === result.steps.length - 1;
            html += '<div class="step' + (isLast ? ' highlight' : '') + '">' + s.desc + '</div>';
        }
        var lastVal = result.steps[result.steps.length - 1].val;
        html += '<div class="result-line">Miller-Rabin says: ' + (result.isProbablePrime ? 'probably prime' : 'COMPOSITE') + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME</button>' +
            '<button class="answer-btn" data-val="composite">COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                var msg = n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE') + '. Miller-Rabin (base ' + a + '): ' + (result.isProbablePrime ? 'probably prime' : 'composite');
                if (!isPrime && result.isProbablePrime) msg += ' \u2014 base ' + a + ' is a LIAR!';
                handleAnswer(correct, msg);
            });
        });
    }

    // Round C: Full test with given n and base a
    function renderMillerRabinC() {
        var pool = [221, 341, 561, 25, 49, 169, 289, 127, 131, 137, 149, 157];
        var n = pickRandom(pool);
        var a = pickRandom([2, 3, 5, 7].filter(function(x) { return x < n && gcd(x, n) === 1; }));
        var isPrime = trialDivision(n);
        var dec = millerRabinDecompose(n);
        var result = millerRabinTest(n, a);

        $questionPrompt.innerHTML = 'Full Miller-Rabin: Is <strong>' + n + '</strong> prime?<br>Test with base a = ' + a + '. n\u22121 = ' + (n-1) + ' = 2<sup>' + dec.s + '</sup> \u00d7 ' + dec.d;

        var html = '<div class="mod-exp-steps">';
        for (var i = 0; i < result.steps.length; i++) {
            html += '<div class="step' + (i === result.steps.length - 1 ? ' highlight' : '') + '">' + result.steps[i].desc + '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">PRIME</button>' +
            '<button class="answer-btn" data-val="composite">COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, n + ' is ' + (isPrime ? 'PRIME' : 'COMPOSITE'));
            });
        });
    }

    // ═══ LEVEL 20 (NEW): RSA BASICS ═════════════════════════════════════

    function renderLevelRSA() {
        if (state.currentRound === 0) renderRSA_A();
        else if (state.currentRound === 1) renderRSA_B();
        else renderRSA_C();
    }

    // Round A: Given p,q → compute n and φ(n), pick valid e
    function renderRSA_A() {
        var primePairs = [[3,11],[3,7],[5,7],[5,11],[7,11],[3,13],[5,13]];
        var pair = pickRandom(primePairs);
        var p = pair[0], q = pair[1];
        var n = p * q;
        var phi = (p - 1) * (q - 1);

        // Find valid e values (coprime to phi)
        var validEs = [];
        for (var e = 2; e < phi; e++) {
            if (gcd(e, phi) === 1) validEs.push(e);
            if (validEs.length >= 6) break;
        }
        var correctE = pickRandom(validEs.slice(0, 4));

        $questionPrompt.innerHTML = 'RSA Setup: p = <strong>' + p + '</strong>, q = <strong>' + q + '</strong>';

        var html = '<div class="rsa-steps">';
        html += '<div class="rsa-step done">Step 1: n = p \u00d7 q = ' + p + ' \u00d7 ' + q + ' = <strong>' + n + '</strong></div>';
        html += '<div class="rsa-step done">Step 2: \u03c6(n) = (p\u22121)(q\u22121) = ' + (p-1) + ' \u00d7 ' + (q-1) + ' = <strong>' + phi + '</strong></div>';
        html += '<div class="rsa-step active">Step 3: Pick e coprime to \u03c6(n) = ' + phi + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        // Offer 4 choices, some coprime some not
        var eChoices = [correctE];
        var nonCoprimes = [];
        for (var i = 2; i < phi; i++) {
            if (gcd(i, phi) > 1) nonCoprimes.push(i);
            if (nonCoprimes.length >= 6) break;
        }
        while (eChoices.length < 4) {
            var candidate = Math.random() < 0.5 ? pickRandom(nonCoprimes) : pickRandom(validEs);
            if (eChoices.indexOf(candidate) === -1) eChoices.push(candidate);
        }
        shuffle(eChoices);

        var btns = '<div style="margin-bottom:8px;color:#aaa">Which e is coprime to ' + phi + '?</div>';
        for (var i = 0; i < eChoices.length; i++) {
            var eVal = eChoices[i];
            var g = gcd(eVal, phi);
            btns += '<button class="answer-btn rsa-e-btn" data-val="' + eVal + '">e = ' + eVal + ' (GCD=' + g + ')</button>';
        }
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.rsa-e-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var isValid = gcd(val, phi) === 1;
                btn.classList.add(isValid ? 'correct' : 'wrong');
                handleAnswer(isValid, isValid ? 'e = ' + val + ' works! GCD(' + val + ', ' + phi + ') = 1' : 'GCD(' + val + ', ' + phi + ') = ' + gcd(val, phi) + ' \u2260 1. Try e = ' + correctE);
            });
        });
    }

    // Round B: Given e and φ(n) → find d, encrypt a message
    function renderRSA_B() {
        var primePairs = [[3,11],[5,7],[3,7],[5,11]];
        var pair = pickRandom(primePairs);
        var p = pair[0], q = pair[1];
        var n = p * q;
        var phi = (p - 1) * (q - 1);

        // Pick a valid e
        var e = 3;
        while (gcd(e, phi) !== 1) e += 2;
        var d = modInverse(e, phi);
        var m = randInt(2, n - 2); // message
        var c = modPow(m, e, n);

        $questionPrompt.innerHTML = 'RSA: n = ' + n + ', \u03c6(n) = ' + phi + ', e = ' + e + '<br>Find the private key d where e \u00d7 d \u2261 1 (mod \u03c6(n))';

        var html = '<div class="rsa-steps">';
        html += '<div class="rsa-step done">n = ' + n + ' = ' + p + ' \u00d7 ' + q + '</div>';
        html += '<div class="rsa-step done">\u03c6(n) = ' + phi + '</div>';
        html += '<div class="rsa-step done">e = ' + e + '</div>';
        html += '<div class="rsa-step active">Find d: ' + e + ' \u00d7 d \u2261 1 (mod ' + phi + ')</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        var dChoices = [d];
        while (dChoices.length < 4) {
            var w = randInt(2, phi - 1);
            if (dChoices.indexOf(w) === -1) dChoices.push(w);
        }
        shuffle(dChoices);
        var btns = '';
        for (var i = 0; i < dChoices.length; i++) {
            var dv = dChoices[i];
            var product = (e * dv) % phi;
            btns += '<button class="answer-btn rsa-d-btn" data-val="' + dv + '">d = ' + dv + ' (' + e + '\u00d7' + dv + ' mod ' + phi + ' = ' + product + ')</button>';
        }
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.rsa-d-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!state.questionActive) return;
                var val = parseInt(btn.dataset.val);
                var correct = val === d;
                btn.classList.add(correct ? 'correct' : 'wrong');
                if (!correct) {
                    handleAnswer(false, e + ' \u00d7 ' + d + ' = ' + (e * d) + ' \u2261 ' + ((e * d) % phi) + ' (mod ' + phi + '). d = ' + d);
                    return;
                }
                sndTick();
                // Step 2: encrypt
                setTimeout(function() {
                    $questionPrompt.innerHTML = 'Now encrypt message m = <strong>' + m + '</strong> using public key (e=' + e + ', n=' + n + ')';
                    $questionVisual.innerHTML = '<div class="rsa-key-display">c = m<sup>e</sup> mod n = ' + m + '<sup>' + e + '</sup> mod ' + n + ' = ?</div>';
                    var cChoices = [c];
                    while (cChoices.length < 4) {
                        var w2 = randInt(0, n - 1);
                        if (cChoices.indexOf(w2) === -1) cChoices.push(w2);
                    }
                    shuffle(cChoices);
                    var btns2 = '';
                    for (var i = 0; i < cChoices.length; i++)
                        btns2 += '<button class="answer-btn rsa-c-btn" data-val="' + cChoices[i] + '">' + cChoices[i] + '</button>';
                    $answerButtons.innerHTML = btns2;

                    $answerButtons.querySelectorAll('.rsa-c-btn').forEach(function(btn2) {
                        btn2.addEventListener('click', function() {
                            var v = parseInt(btn2.dataset.val);
                            var ok = v === c;
                            btn2.classList.add(ok ? 'correct' : 'wrong');
                            handleAnswer(ok, m + '^' + e + ' mod ' + n + ' = ' + c);
                        });
                    });
                }, 600);
            });
        });
    }

    // Round C: Full RSA workflow
    function renderRSA_C() {
        var primePairs = [[3,11],[5,7],[3,7],[5,11],[3,13],[7,11]];
        var pair = pickRandom(primePairs);
        var p = pair[0], q = pair[1];
        var n = p * q;
        var phi = (p - 1) * (q - 1);
        var e = 3;
        while (gcd(e, phi) !== 1) e += 2;
        var d = modInverse(e, phi);
        var m = randInt(2, Math.min(n - 2, 20));
        var c = modPow(m, e, n);
        var decrypted = modPow(c, d, n);

        $questionPrompt.innerHTML = 'Full RSA: p = ' + p + ', q = ' + q + '. Encrypt m = ' + m + ' and decrypt it back.';

        var html = '<div class="rsa-steps">';
        html += '<div class="rsa-step done">n = ' + p + ' \u00d7 ' + q + ' = ' + n + '</div>';
        html += '<div class="rsa-step done">\u03c6(n) = ' + (p-1) + ' \u00d7 ' + (q-1) + ' = ' + phi + '</div>';
        html += '<div class="rsa-step done">e = ' + e + ', d = ' + d + '</div>';
        html += '<div class="rsa-step done">Encrypt: ' + m + '<sup>' + e + '</sup> mod ' + n + ' = ' + c + '</div>';
        html += '<div class="rsa-step active">Decrypt: ' + c + '<sup>' + d + '</sup> mod ' + n + ' = ?</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        var choices = [decrypted];
        while (choices.length < 4) {
            var w = randInt(0, n - 1);
            if (choices.indexOf(w) === -1) choices.push(w);
        }
        shuffle(choices);
        var btns = '';
        for (var i = 0; i < choices.length; i++)
            btns += '<button class="answer-btn" data-val="' + choices[i] + '">' + choices[i] + '</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var val = parseInt(btn.dataset.val);
                var correct = val === decrypted;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, c + '^' + d + ' mod ' + n + ' = ' + decrypted + (decrypted === m ? ' = m \u2714 Decryption works!' : ''));
            });
        });
    }

    // ═══ LEVEL 21: BONUS — MERSENNE PRIMES ═══════════════════════════════

    var MERSENNE_PRIMES = [2,3,5,7,13,17,19,31]; // exponents that give Mersenne primes

    function lucasLehmerSteps(p) {
        var mp = Math.pow(2, p) - 1;
        var s = 4;
        var steps = [{step: 0, s: s}];
        for (var i = 1; i <= p - 2; i++) {
            s = (s * s - 2) % mp;
            steps.push({step: i, s: s});
        }
        return steps;
    }

    function renderLevelMersenne() {
        if (state.currentRound === 0) renderMersenneA();
        else if (state.currentRound === 1) renderMersenneB();
        else renderMersenneC();
    }

    // Round A: Is 2^p - 1 prime? (small p)
    function renderMersenneA() {
        var p = pickRandom([2,3,4,5,6,7,11]);
        var mp = Math.pow(2, p) - 1;
        var isPrime = trialDivision(mp);
        var isPExp = trialDivision(p);

        $questionPrompt.innerHTML = 'Is <strong>M<sub>' + p + '</sub> = 2<sup>' + p + '</sup> − 1 = ' + mp + '</strong> a Mersenne prime?';
        $questionVisual.innerHTML = '<div class="mersenne-calc">2<sup>' + p + '</sup> = ' + Math.pow(2, p) + '<br>2<sup>' + p + '</sup> − 1 = <strong>' + mp + '</strong></div>' +
            '<div style="color:#aaa;margin-top:8px">Note: p = ' + p + ' is ' + (isPExp ? 'prime' : 'NOT prime (so M<sub>p</sub> can\'t be prime!)') + '</div>';

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">YES — Mersenne Prime!</button>' +
            '<button class="answer-btn" data-val="composite">NO — Composite</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                if (isPrime) handleAnswer(correct, mp + ' is a Mersenne prime! (M<sub>' + p + '</sub>)');
                else {
                    // Find a factor
                    var factor = 0;
                    for (var f = 2; f * f <= mp; f++) { if (mp % f === 0) { factor = f; break; } }
                    handleAnswer(correct, mp + ' = ' + factor + ' × ' + (mp / factor) + ' — NOT a Mersenne prime.');
                }
            });
        });
    }

    // Round B: Lucas-Lehmer test walkthrough
    function renderMersenneB() {
        var p = pickRandom([5, 7, 11, 13]);
        var mp = Math.pow(2, p) - 1;
        var steps = lucasLehmerSteps(p);
        var finalS = steps[steps.length - 1].s;
        var isPrime = finalS === 0;

        $questionPrompt.innerHTML = 'Lucas–Lehmer test for <strong>M<sub>' + p + '</sub> = ' + mp + '</strong>.<br>Start with s = 4. Repeat s = s² − 2 (mod ' + mp + ') exactly ' + (p - 2) + ' times. If result = 0, it\'s prime!';

        var html = '<div class="mod-exp-steps">';
        for (var i = 0; i < steps.length; i++) {
            var s = steps[i];
            var cls = i === steps.length - 1 ? ' highlight' : '';
            if (i === 0) html += '<div class="step">s₀ = ' + s.s + '</div>';
            else html += '<div class="step' + cls + '">s' + i + ' = ' + steps[i-1].s + '² − 2 = ' + (steps[i-1].s * steps[i-1].s - 2) + ' mod ' + mp + ' = <strong>' + s.s + '</strong></div>';
        }
        html += '<div class="result-line">Final value: s = ' + finalS + (finalS === 0 ? ' = 0 → PRIME!' : ' ≠ 0 → COMPOSITE') + '</div>';
        html += '</div>';
        $questionVisual.innerHTML = html;

        $answerButtons.innerHTML =
            '<button class="answer-btn" data-val="prime">Result is 0 — PRIME!</button>' +
            '<button class="answer-btn" data-val="composite">Result ≠ 0 — COMPOSITE</button>';

        $answerButtons.querySelectorAll('.answer-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var ans = btn.dataset.val;
                var correct = (ans === 'prime') === isPrime;
                btn.classList.add(correct ? 'correct' : 'wrong');
                handleAnswer(correct, 'M<sub>' + p + '</sub> = ' + mp + ' is ' + (isPrime ? 'a Mersenne PRIME!' : 'COMPOSITE.'));
            });
        });
    }

    // Round C: Which exponents give Mersenne primes?
    function renderMersenneC() {
        var pool = shuffle([2,3,4,5,6,7,9,11,13,17].slice());
        var candidates = pool.slice(0, 5);
        var correct = candidates.filter(function(p) { return MERSENNE_PRIMES.indexOf(p) !== -1; });

        $questionPrompt.innerHTML = 'Which of these exponents p give <strong>Mersenne primes</strong> M<sub>p</sub> = 2<sup>p</sup> − 1?<br>(Select all that apply)';

        var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin:12px 0">';
        for (var i = 0; i < candidates.length; i++) {
            var p = candidates[i];
            html += '<div class="mersenne-candidate">p = ' + p + ' → 2<sup>' + p + '</sup> − 1 = ' + (Math.pow(2, p) - 1) + '</div>';
        }
        html += '</div>';
        $questionVisual.innerHTML = html;

        var picked = [];
        var btns = '';
        for (var i = 0; i < candidates.length; i++)
            btns += '<button class="answer-btn toggle-btn" data-val="' + candidates[i] + '">p = ' + candidates[i] + '</button>';
        btns += '<button class="btn btn-primary" id="mersenne-submit" style="margin-left:12px">Submit</button>';
        $answerButtons.innerHTML = btns;

        $answerButtons.querySelectorAll('.toggle-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                btn.classList.toggle('selected');
                var val = parseInt(btn.dataset.val);
                var idx = picked.indexOf(val);
                if (idx === -1) picked.push(val);
                else picked.splice(idx, 1);
            });
        });

        document.getElementById('mersenne-submit').addEventListener('click', function() {
            if (!state.questionActive) return;
            picked.sort(function(a,b){return a-b;});
            correct.sort(function(a,b){return a-b;});
            var isCorrect = picked.length === correct.length && picked.every(function(v, i) { return v === correct[i]; });
            handleAnswer(isCorrect, 'Mersenne prime exponents in this set: ' + (correct.length > 0 ? correct.map(function(p){return 'p=' + p;}).join(', ') : 'none'));
        });
    }

    // ═══ INIT ════════════════════════════════════════════════════════════

    // Dev shortcut: press U on level select to unlock all levels
    document.addEventListener('keydown', function(e) {
        if (e.key === 'u' || e.key === 'U') {
            if ($levelSelect.style.display !== 'none') {
                for (var i = 0; i < TOTAL_LEVELS; i++) state.levelProgress[i].unlocked = true;
                saveProgress();
                renderLevelGrid();
            }
        }
    });

    function init() {
        loadProgress();
        showLevelSelect();
    }

    init();
})();
