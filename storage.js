// Player profile management + namespaced game storage
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.

(function () {
    'use strict';

    var PROFILES_KEY = 'game_profiles';
    var ACTIVE_KEY = 'activePlayer';
    var DEFAULT_PLAYER = 'Player 1';

    // --- Profile management ---

    function getProfiles() {
        try {
            var raw = localStorage.getItem(PROFILES_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return [];
    }

    function saveProfiles(list) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
    }

    function addProfile(name) {
        var list = getProfiles();
        name = name.trim();
        if (!name || list.indexOf(name) !== -1) return false;
        list.push(name);
        saveProfiles(list);
        return true;
    }

    function removeProfile(name) {
        var list = getProfiles();
        var idx = list.indexOf(name);
        if (idx === -1) return;
        list.splice(idx, 1);
        saveProfiles(list);
        // Remove all namespaced keys for this profile
        var prefix = name + ':';
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.indexOf(prefix) === 0) toRemove.push(key);
        }
        toRemove.forEach(function (k) { localStorage.removeItem(k); });
        // If active player was removed, switch to first available or default
        if (getActivePlayer() === name) {
            var remaining = getProfiles();
            setActivePlayer(remaining.length ? remaining[0] : DEFAULT_PLAYER);
        }
    }

    function getActivePlayer() {
        return sessionStorage.getItem(ACTIVE_KEY) || DEFAULT_PLAYER;
    }

    function setActivePlayer(name) {
        sessionStorage.setItem(ACTIVE_KEY, name);
    }

    // Ensure at least one profile exists
    function ensureDefaults() {
        var list = getProfiles();
        if (list.length === 0) {
            addProfile(DEFAULT_PLAYER);
        }
        // Ensure active player is set and exists in profiles
        var active = getActivePlayer();
        var profiles = getProfiles();
        if (profiles.indexOf(active) === -1) {
            setActivePlayer(profiles[0]);
        }
    }

    // --- Namespaced game storage ---

    function gameGet(key) {
        try {
            return localStorage.getItem(getActivePlayer() + ':' + key);
        } catch (e) { return null; }
    }

    function gameSet(key, val) {
        try {
            localStorage.setItem(getActivePlayer() + ':' + key, val);
        } catch (e) {}
    }

    function gameRemove(key) {
        try {
            localStorage.removeItem(getActivePlayer() + ':' + key);
        } catch (e) {}
    }

    // --- Data migration ---
    // Move old unnamespaced primequest_progress to Player 1's namespace
    function migrateOldData() {
        var oldKey = 'primequest_progress';
        var oldVal = localStorage.getItem(oldKey);
        if (oldVal !== null) {
            // Ensure Player 1 exists
            var list = getProfiles();
            if (list.indexOf(DEFAULT_PLAYER) === -1) {
                addProfile(DEFAULT_PLAYER);
            }
            // Copy to Player 1 namespace
            localStorage.setItem(DEFAULT_PLAYER + ':pq_progress', oldVal);
            localStorage.removeItem(oldKey);
        }
    }

    // --- Leaderboard helpers ---

    function getLeaderboardData() {
        var profiles = getProfiles();
        var data = [];
        profiles.forEach(function (name) {
            var prefix = name + ':';
            // PrimeQuest stats
            var pqStars = 0, pqCompleted = 0;
            try {
                var pqRaw = localStorage.getItem(prefix + 'pq_progress');
                if (pqRaw) {
                    var levels = JSON.parse(pqRaw);
                    levels.forEach(function (lv) {
                        pqStars += (lv.stars || 0);
                        if (lv.stars > 0) pqCompleted++;
                    });
                }
            } catch (e) {}
            // Candy Factory stats
            var cfGames = 0, cfCandies = 0;
            try {
                var cfRaw = localStorage.getItem(prefix + 'candy_history');
                if (cfRaw) {
                    var history = JSON.parse(cfRaw);
                    cfGames = history.length;
                    history.forEach(function (entry) {
                        cfCandies += (entry.candiesWon || 0);
                    });
                }
            } catch (e) {}
            // Tic Tac Toe stats
            var tttW = 0, tttD = 0, tttL = 0;
            try {
                var tttRaw = localStorage.getItem(prefix + 'ttt_scores');
                if (tttRaw) {
                    var ts = JSON.parse(tttRaw);
                    tttW = ts.X || 0;
                    tttL = ts.O || 0;
                    tttD = ts.D || 0;
                }
            } catch (e) {}
            // Poker stats
            var pkHands = 0, pkWins = 0;
            try {
                var pkRaw = localStorage.getItem(prefix + 'poker_stats');
                if (pkRaw) {
                    var pk = JSON.parse(pkRaw);
                    pkHands = pk.hands || 0;
                    pkWins = pk.wins || 0;
                }
            } catch (e) {}
            data.push({
                name: name,
                pqStars: pqStars,
                pqCompleted: pqCompleted,
                cfGames: cfGames,
                cfCandies: cfCandies,
                tttW: tttW, tttD: tttD, tttL: tttL,
                pkHands: pkHands, pkWins: pkWins
            });
        });
        return data;
    }

    // --- Initialize ---
    ensureDefaults();
    migrateOldData();

    // --- Export to global scope ---
    window.getProfiles = getProfiles;
    window.addProfile = addProfile;
    window.removeProfile = removeProfile;
    window.getActivePlayer = getActivePlayer;
    window.setActivePlayer = setActivePlayer;
    window.gameGet = gameGet;
    window.gameSet = gameSet;
    window.gameRemove = gameRemove;
    window.getLeaderboardData = getLeaderboardData;
})();
