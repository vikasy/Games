// Feedback widget — injects floating button + popup form
// Sends via FormSubmit.co to vikasy@gmail.com
// Copyright (c) 2017-2026 Vikas Yadav. All rights reserved.

(function () {
    'use strict';

    var EMAIL = 'vikasy@gmail.com';
    var ACTION = 'https://formsubmit.co/' + EMAIL;
    var page = document.title || 'Unknown Page';

    // --- Inject styles ---
    var css = document.createElement('style');
    css.textContent = [
        '.fb-btn{position:fixed;bottom:18px;right:18px;z-index:9999;width:44px;height:44px;',
        'border-radius:50%;border:none;background:#2a2a4a;color:#ffd700;font-size:1.3rem;',
        'cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4);transition:transform .2s,background .2s;',
        'display:flex;align-items:center;justify-content:center;line-height:1}',
        '.fb-btn:hover{transform:scale(1.1);background:#333366}',

        '.fb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);',
        'z-index:10000;align-items:center;justify-content:center}',
        '.fb-overlay.open{display:flex}',

        '.fb-modal{background:#16213e;border:2px solid #444;border-radius:14px;',
        'padding:24px 28px;width:90%;max-width:380px;color:#e0e0e0;font-family:system-ui,sans-serif}',
        '.fb-modal h3{color:#ffd700;font-size:1.1rem;margin:0 0 14px;text-align:center}',

        '.fb-modal label{display:block;font-size:.8rem;color:#aaa;margin:10px 0 4px}',
        '.fb-modal select,.fb-modal input,.fb-modal textarea{width:100%;background:#0f0f23;',
        'color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:7px 10px;',
        'font-size:.85rem;font-family:inherit}',
        '.fb-modal textarea{resize:vertical;min-height:80px}',
        '.fb-modal select:focus,.fb-modal input:focus,.fb-modal textarea:focus{',
        'outline:none;border-color:#ffd700}',

        '.fb-actions{display:flex;gap:10px;margin-top:16px}',
        '.fb-actions button{flex:1;padding:8px 0;border-radius:6px;border:none;',
        'font-size:.85rem;cursor:pointer;font-weight:600;transition:background .2s}',
        '.fb-send{background:#ffd700;color:#0f0f23}',
        '.fb-send:hover{background:#ffe44d}',
        '.fb-send:disabled{opacity:.5;cursor:not-allowed}',
        '.fb-cancel{background:none;border:1px solid #555 !important;color:#aaa}',
        '.fb-cancel:hover{color:#fff;border-color:#888 !important}',

        '.fb-thanks{text-align:center;color:#7dffb3;font-size:.95rem;padding:20px 0}'
    ].join('\n');
    document.head.appendChild(css);

    // --- Inject button ---
    var btn = document.createElement('button');
    btn.className = 'fb-btn';
    btn.title = 'Send feedback';
    btn.setAttribute('aria-label', 'Send feedback');
    btn.innerHTML = '&#x1F4AC;';
    document.body.appendChild(btn);

    // --- Inject overlay + form ---
    var overlay = document.createElement('div');
    overlay.className = 'fb-overlay';
    overlay.innerHTML =
        '<div class="fb-modal">' +
            '<h3>Send Feedback</h3>' +
            '<form id="fb-form" action="' + ACTION + '" method="POST">' +
                '<input type="hidden" name="_subject" value="Game Feedback: ' + page + '">' +
                '<input type="hidden" name="_captcha" value="false">' +
                '<input type="hidden" name="_template" value="table">' +
                '<input type="hidden" name="page" value="' + page + '">' +
                '<label for="fb-type">Type</label>' +
                '<select id="fb-type" name="type" required>' +
                    '<option value="bug">Bug</option>' +
                    '<option value="suggestion" selected>Suggestion</option>' +
                    '<option value="comment">Comment</option>' +
                '</select>' +
                '<label for="fb-name">Name (optional)</label>' +
                '<input id="fb-name" name="name" type="text" placeholder="Your name" autocomplete="off">' +
                '<label for="fb-msg">Message</label>' +
                '<textarea id="fb-msg" name="message" required placeholder="What\'s on your mind?"></textarea>' +
                '<div class="fb-actions">' +
                    '<button type="button" class="fb-cancel">Cancel</button>' +
                    '<button type="submit" class="fb-send">Send</button>' +
                '</div>' +
            '</form>' +
            '<div class="fb-thanks" style="display:none">Thanks for your feedback!</div>' +
        '</div>';
    document.body.appendChild(overlay);

    var form = document.getElementById('fb-form');
    var thanks = overlay.querySelector('.fb-thanks');
    var cancelBtn = overlay.querySelector('.fb-cancel');
    var sendBtn = overlay.querySelector('.fb-send');

    function open() { overlay.classList.add('open'); }
    function close() {
        overlay.classList.remove('open');
        // Reset after close animation
        setTimeout(function () {
            form.style.display = '';
            thanks.style.display = 'none';
            form.reset();
            sendBtn.disabled = false;
        }, 200);
    }

    btn.addEventListener('click', open);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
    });

    // Submit via fetch so user stays on page
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        sendBtn.disabled = true;
        var data = new FormData(form);

        fetch(ACTION, {
            method: 'POST',
            body: data,
            headers: { 'Accept': 'application/json' }
        }).then(function (res) {
            if (res.ok) {
                form.style.display = 'none';
                thanks.style.display = '';
                setTimeout(close, 1500);
            } else {
                alert('Could not send feedback. Please try again.');
                sendBtn.disabled = false;
            }
        }).catch(function () {
            alert('Could not send feedback. Please try again.');
            sendBtn.disabled = false;
        });
    });
})();
