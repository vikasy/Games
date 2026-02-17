import UIKit

struct GameItem {
    let id: String
    let title: String
    let subtitle: String
    let symbolName: String
    let accentColor: UIColor
}

class GamePickerViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {

    private let games: [GameItem] = [
        GameItem(id: "tictactoe", title: "Tic Tac Toe", subtitle: "3×3 or 4×4 grid vs AI",
                 symbolName: "number.square", accentColor: UIColor(red: 0.31, green: 0.76, blue: 0.97, alpha: 1)),
        GameItem(id: "playpoker", title: "Texas Hold'em", subtitle: "Poker against 3 AI opponents",
                 symbolName: "suit.spade.fill", accentColor: UIColor(red: 0.94, green: 0.33, blue: 0.31, alpha: 1)),
        GameItem(id: "candyfactory", title: "Candy Factory", subtitle: "Probability & expected value",
                 symbolName: "gift.fill", accentColor: UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 1)),
        GameItem(id: "primequest", title: "PrimeQuest", subtitle: "23-level prime number training",
                 symbolName: "atom", accentColor: UIColor(red: 0.49, green: 1.0, blue: 0.70, alpha: 1)),
    ]

    private var collectionView: UICollectionView!

    private let bgColor = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)
    private let cardColor = UIColor(red: 22/255, green: 33/255, blue: 62/255, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bgColor
        title = "Games"
        navigationController?.navigationBar.prefersLargeTitles = false

        let layout = UICollectionViewFlowLayout()
        layout.minimumInteritemSpacing = 16
        layout.minimumLineSpacing = 16
        layout.sectionInset = UIEdgeInsets(top: 16, left: 20, bottom: 20, right: 20)

        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(GameCardCell.self, forCellWithReuseIdentifier: GameCardCell.reuseID)
        collectionView.register(PickerHeaderView.self,
                                forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
                                withReuseIdentifier: PickerHeaderView.reuseID)
        collectionView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // MARK: - UICollectionViewDataSource

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        games.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: GameCardCell.reuseID, for: indexPath) as! GameCardCell
        cell.configure(with: games[indexPath.item])
        return cell
    }

    func collectionView(_ collectionView: UICollectionView, viewForSupplementaryElementOfKind kind: String,
                         at indexPath: IndexPath) -> UICollectionReusableView {
        let header = collectionView.dequeueReusableSupplementaryView(ofKind: kind, withReuseIdentifier: PickerHeaderView.reuseID, for: indexPath) as! PickerHeaderView
        return header
    }

    // MARK: - UICollectionViewDelegateFlowLayout

    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout,
                         sizeForItemAt indexPath: IndexPath) -> CGSize {
        let layout = collectionViewLayout as! UICollectionViewFlowLayout
        let totalHorizontalInset = layout.sectionInset.left + layout.sectionInset.right + layout.minimumInteritemSpacing
        let availableWidth = collectionView.bounds.width - totalHorizontalInset
        let columns: CGFloat = availableWidth > 500 ? 2 : (availableWidth > 300 ? 2 : 1)
        let cardWidth = floor(availableWidth / columns)
        return CGSize(width: cardWidth, height: 140)
    }

    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout,
                         referenceSizeForHeaderInSection section: Int) -> CGSize {
        CGSize(width: collectionView.bounds.width, height: 100)
    }

    // MARK: - UICollectionViewDelegate

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let game = games[indexPath.item]
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let webVC = GameWebViewController()
        webVC.gamePath = game.id
        webVC.gameTitle = game.title
        navigationController?.pushViewController(webVC, animated: true)
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}

// MARK: - Header View

private class PickerHeaderView: UICollectionReusableView {
    static let reuseID = "PickerHeader"

    private let titleLabel: UILabel = {
        let l = UILabel()
        l.text = "LAB CITY FUN ACADEMY"
        l.font = UIFont.systemFont(ofSize: 22, weight: .heavy)
        l.textColor = .white
        l.textAlignment = .center
        return l
    }()

    private let subtitleLabel: UILabel = {
        let l = UILabel()
        l.text = "Pick a game to play"
        l.font = UIFont.systemFont(ofSize: 15, weight: .regular)
        l.textColor = UIColor(white: 0.6, alpha: 1)
        l.textAlignment = .center
        return l
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        stack.axis = .vertical
        stack.spacing = 4
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError() }
}

// MARK: - Game Card Cell

private class GameCardCell: UICollectionViewCell {
    static let reuseID = "GameCard"

    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)

        contentView.backgroundColor = UIColor(red: 22/255, green: 33/255, blue: 62/255, alpha: 1)
        contentView.layer.cornerRadius = 16
        contentView.layer.masksToBounds = true

        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .bold)
        titleLabel.textColor = .white

        subtitleLabel.font = UIFont.systemFont(ofSize: 13, weight: .regular)
        subtitleLabel.textColor = UIColor(white: 0.55, alpha: 1)
        subtitleLabel.numberOfLines = 2

        let textStack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        textStack.axis = .vertical
        textStack.spacing = 4

        let hStack = UIStackView(arrangedSubviews: [iconView, textStack])
        hStack.axis = .horizontal
        hStack.spacing = 16
        hStack.alignment = .center
        hStack.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(hStack)
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 48),
            iconView.heightAnchor.constraint(equalToConstant: 48),
            hStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            hStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            hStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError() }

    func configure(with game: GameItem) {
        let config = UIImage.SymbolConfiguration(pointSize: 28, weight: .medium)
        iconView.image = UIImage(systemName: game.symbolName, withConfiguration: config)
        iconView.tintColor = game.accentColor
        titleLabel.text = game.title
        subtitleLabel.text = game.subtitle
    }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: 0.15) {
                self.contentView.alpha = self.isHighlighted ? 0.7 : 1.0
                self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.97, y: 0.97) : .identity
            }
        }
    }
}
