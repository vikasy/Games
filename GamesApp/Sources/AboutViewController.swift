import UIKit

class AboutViewController: UIViewController {
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()

    private let darkBg = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)
    private let cardBg = UIColor(red: 22/255, green: 33/255, blue: 62/255, alpha: 1)
    private let accent = UIColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = darkBg
        setupScrollView()
        buildContent()
    }

    private func setupScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        contentStack.axis = .vertical
        contentStack.spacing = 20
        contentStack.alignment = .fill
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.layoutMargins = UIEdgeInsets(top: 32, left: 20, bottom: 40, right: 20)
        contentStack.isLayoutMarginsRelativeArrangement = true

        scrollView.addSubview(contentStack)
        NSLayoutConstraint.activate([
            contentStack.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
    }

    private func buildContent() {
        // App title
        let titleLabel = UILabel()
        titleLabel.text = "Lab City Fun Academy"
        titleLabel.font = UIFont.systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        contentStack.addArrangedSubview(titleLabel)

        // Version
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        let versionLabel = UILabel()
        versionLabel.text = "Version \(version) (\(build))"
        versionLabel.font = UIFont.systemFont(ofSize: 14)
        versionLabel.textColor = UIColor(white: 0.5, alpha: 1)
        versionLabel.textAlignment = .center
        contentStack.addArrangedSubview(versionLabel)

        contentStack.addArrangedSubview(makeSpacer(12))

        // About card
        contentStack.addArrangedSubview(makeCard(title: "About", body:
            "Lab City Fun Academy is a collection of four brain-training games:\n\n" +
            "  \u{2022}  Tic Tac Toe \u{2014} Classic grid game vs computer AI\n" +
            "  \u{2022}  Texas Hold\u{2019}em \u{2014} Poker against 3 AI opponents\n" +
            "  \u{2022}  Candy Factory \u{2014} Deal or No Deal with probability\n" +
            "  \u{2022}  PrimeQuest \u{2014} 23 levels from parity to RSA\n\n" +
            "All games run entirely on your device. No internet connection required."
        ))

        // Privacy Policy card
        contentStack.addArrangedSubview(makeCard(title: "Privacy Policy", body:
            "Lab City Fun Academy does not collect, store, or transmit any personal data. " +
            "All game progress and player profiles are stored locally on your device using standard browser storage. " +
            "No analytics, advertising, or tracking services are used.\n\n" +
            "No data is shared with third parties. " +
            "If you delete the app, all locally stored data is removed.\n\n" +
            "This app does not require an internet connection and makes no network requests."
        ))

        // Copyright
        let copyrightLabel = UILabel()
        let year = Calendar.current.component(.year, from: Date())
        copyrightLabel.text = "\u{00A9} 2017\u{2013}\(year) Vikas Yadav. All rights reserved."
        copyrightLabel.font = UIFont.systemFont(ofSize: 12)
        copyrightLabel.textColor = UIColor(white: 0.4, alpha: 1)
        copyrightLabel.textAlignment = .center
        copyrightLabel.numberOfLines = 0
        contentStack.addArrangedSubview(copyrightLabel)
    }

    private func makeCard(title: String, body: String) -> UIView {
        let card = UIView()
        card.backgroundColor = cardBg
        card.layer.cornerRadius = 12

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        titleLabel.textColor = accent

        let bodyLabel = UILabel()
        bodyLabel.text = body
        bodyLabel.font = UIFont.systemFont(ofSize: 14)
        bodyLabel.textColor = UIColor(white: 0.78, alpha: 1)
        bodyLabel.numberOfLines = 0

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(bodyLabel)

        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16)
        ])

        return card
    }

    private func makeSpacer(_ height: CGFloat) -> UIView {
        let v = UIView()
        v.heightAnchor.constraint(equalToConstant: height).isActive = true
        return v
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
