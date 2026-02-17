import UIKit
import WebKit

class GameWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
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
        config.userContentController.add(self, name: "haptic")
        config.userContentController.add(self, name: "nativeShare")
        config.userContentController.add(self, name: "jsLog")
        config.userContentController.add(self, name: "goBack")

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

        let polishCSS = """
        (function() {
            var style = document.createElement('style');
            style.textContent = '\\
                a.back { display: none !important; } \\
                * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; } \\
                input, textarea, select { -webkit-user-select: auto; user-select: auto; }\\
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

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.bounces = false
        webView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
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
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        spinner.stopAnimating()
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

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
