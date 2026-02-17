import UIKit
import WebKit

class GameWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    var gamePath: String = ""
    var gameTitle: String = ""

    private var webView: WKWebView!
    private var spinner: UIActivityIndicatorView!

    override func viewDidLoad() {
        super.viewDidLoad()
        title = gameTitle
        view.backgroundColor = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "haptic")
        config.userContentController.add(self, name: "nativeShare")
        config.userContentController.add(self, name: "jsLog")
        config.userContentController.add(self, name: "goBack")

        // --- 1. Viewport zoom lock (runs before page renders) ---
        let viewportJS = """
        (function() {
            var meta = document.querySelector('meta[name="viewport"]');
            if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        })();
        """
        let viewportScript = WKUserScript(source: viewportJS, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        config.userContentController.addUserScript(viewportScript)

        // --- Native bridge + error forwarding (atDocumentEnd) ---
        let bridgeJS = """
        window.nativeBridge = {
            haptic: function(style) {
                window.webkit.messageHandlers.haptic.postMessage(style || 'light');
            },
            share: function(text) {
                window.webkit.messageHandlers.nativeShare.postMessage(text || document.title);
            }
        };
        window.onerror = function(msg, source, line, col, error) {
            var info = msg + ' at ' + (source || '?') + ':' + line + ':' + col;
            if (error && error.stack) { info += '\\n' + error.stack; }
            window.webkit.messageHandlers.jsLog.postMessage('ERROR: ' + info);
            return false;
        };
        window.addEventListener('unhandledrejection', function(e) {
            var reason = e.reason ? (e.reason.stack || String(e.reason)) : 'unknown';
            window.webkit.messageHandlers.jsLog.postMessage('PROMISE REJECT: ' + reason);
        });
        var origError = console.error;
        var origWarn = console.warn;
        console.error = function() {
            var args = Array.prototype.slice.call(arguments).join(' ');
            window.webkit.messageHandlers.jsLog.postMessage('console.error: ' + args);
            origError.apply(console, arguments);
        };
        console.warn = function() {
            var args = Array.prototype.slice.call(arguments).join(' ');
            window.webkit.messageHandlers.jsLog.postMessage('console.warn: ' + args);
            origWarn.apply(console, arguments);
        };
        document.addEventListener('click', function(e) {
            var card = e.target.closest('.game-card');
            if (card) { window.nativeBridge.haptic('medium'); }
            var btn = e.target.closest('button, .btn, [role="button"]');
            if (btn && !card) { window.nativeBridge.haptic('light'); }
        });
        """
        let bridgeScript = WKUserScript(source: bridgeJS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        config.userContentController.addUserScript(bridgeScript)

        // --- 2-5. Injected CSS: hide artifacts, kill hover, system font, safe area ---
        let polishCSS = """
        (function() {
            var style = document.createElement('style');
            style.textContent = '\\
                a.back { display: none !important; } \\
                * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; } \\
                input, textarea, select { -webkit-user-select: auto; user-select: auto; } \\
                footer.copyright { display: none !important; } \\
                ::-webkit-scrollbar { display: none !important; } \\
                @media (hover: none) and (pointer: coarse) { \\
                    *:hover { transform: none !important; } \\
                } \\
                body, button, input, select, textarea { \\
                    font-family: -apple-system, "SF Pro Display", system-ui, sans-serif !important; \\
                } \\
                body { padding-bottom: env(safe-area-inset-bottom, 0px) !important; } \\
            ';
            document.head.appendChild(style);

            document.addEventListener('click', function(e) {
                var link = e.target.closest('a.back');
                if (link) {
                    e.preventDefault();
                    window.webkit.messageHandlers.goBack.postMessage('');
                }
            });
        })();
        """
        let polishScript = WKUserScript(source: polishCSS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        config.userContentController.addUserScript(polishScript)

        // --- 9. Keyboard dismiss on tap outside ---
        let keyboardJS = """
        document.addEventListener('touchstart', function(e) {
            if (!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
                document.activeElement && document.activeElement.blur();
            }
        });
        """
        let keyboardScript = WKUserScript(source: keyboardJS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        config.userContentController.addUserScript(keyboardScript)

        // --- Audio unlock: iOS requires AudioContext.resume() during a direct user gesture ---
        // Creates a blessed AudioContext on first gesture, saves it as window._audioBlessed.
        // Games reuse this context so audio works immediately.
        // Keeps listening to resume any suspended contexts on subsequent gestures.
        let audioUnlockJS = """
        (function() {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            function unlock() {
                // Create and bless a shared context on first gesture
                if (!window._audioBlessed) {
                    var a = new Ctx();
                    var b = a.createBuffer(1, 1, 22050);
                    var s = a.createBufferSource();
                    s.buffer = b;
                    s.connect(a.destination);
                    s.start(0);
                    a.resume();
                    window._audioBlessed = a;
                    window._audioUnlocked = true;
                } else if (window._audioBlessed.state === 'suspended') {
                    window._audioBlessed.resume();
                }
                // Resume any game-created context
                if (window.audioCtx && window.audioCtx !== window._audioBlessed && window.audioCtx.state === 'suspended') {
                    window.audioCtx.resume();
                }
            }
            document.addEventListener('touchstart', unlock, {capture: true});
            document.addEventListener('touchend', unlock, {capture: true});
            document.addEventListener('click', unlock, {capture: true});
        })();
        """
        let audioUnlockScript = WKUserScript(source: audioUnlockJS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        config.userContentController.addUserScript(audioUnlockScript)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self // 7. Context menu suppression
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.bounces = false
        webView.translatesAutoresizingMaskIntoConstraints = false

        // --- 6. Scroll view refinements ---
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false

        // --- 8. Fade-in: start invisible ---
        webView.alpha = 0

        // --- 11. Debug Web Inspector ---
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif

        view.addSubview(webView)
        // --- 5. Safe area bottom: extend to view edge ---
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        spinner = UIActivityIndicatorView(style: .large)
        spinner.color = .white
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])

        loadGame()
    }

    private func loadGame() {
        guard !gamePath.isEmpty,
              let webRoot = Bundle.main.url(forResource: "Web", withExtension: nil),
              let gameURL = Bundle.main.url(forResource: "index", withExtension: "html",
                                            subdirectory: "Web/\(gamePath)") else {
            return
        }
        spinner.startAnimating()
        webView.loadFileURL(gameURL, allowingReadAccessTo: webRoot)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        switch message.name {
        case "haptic":
            let style = message.body as? String ?? "light"
            triggerHaptic(style: style)
        case "nativeShare":
            let text = message.body as? String ?? "Lab City Fun Academy"
            showShareSheet(text: text)
        case "jsLog":
            let msg = message.body as? String ?? ""
            print("[WebView JS] \(msg)")
        case "goBack":
            navigationController?.popViewController(animated: true)
        default:
            break
        }
    }

    private func triggerHaptic(style: String) {
        switch style {
        case "heavy":
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "medium":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "success":
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "error":
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        case "selection":
            UISelectionFeedbackGenerator().selectionChanged()
        default:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func showShareSheet(text: String) {
        let items: [Any] = [text]
        let ac = UIActivityViewController(activityItems: items, applicationActivities: nil)
        ac.popoverPresentationController?.sourceView = view
        ac.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
        present(ac, animated: true)
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        spinner.stopAnimating()
        // --- 8. Smooth fade-in ---
        UIView.animate(withDuration: 0.25) {
            self.webView.alpha = 1
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        spinner.stopAnimating()
        webView.alpha = 1
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url {
            if url.scheme == "file" {
                decisionHandler(.allow)
                return
            }
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // MARK: - WKUIDelegate (Context Menu Suppression)

    func webView(_ webView: WKWebView,
                 contextMenuConfigurationFor elementInfo: WKContextMenuElementInfo) async -> UIContextMenuConfiguration? {
        return nil
    }

    // MARK: - Orientation

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
