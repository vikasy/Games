var CACHE_NAME = 'games-v1';
var ASSETS = [
    './',
    './index.html',
    './storage.js',
    './feedback.js',
    './tictactoe/index.html',
    './tictactoe/style.css',
    './tictactoe/game.js',
    './playpoker/index.html',
    './playpoker/style.css',
    './playpoker/game.js',
    './candyfactory/index.html',
    './candyfactory/style.css',
    './candyfactory/game.js',
    './primequest/index.html',
    './primequest/style.css',
    './primequest/game.js',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function (e) {
    e.respondWith(
        caches.match(e.request).then(function (cached) {
            if (cached) return cached;
            return fetch(e.request).then(function (response) {
                if (response && response.status === 200 && response.type === 'basic') {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
