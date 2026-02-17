import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)

        let gamesVC = GamesViewController()
        gamesVC.tabBarItem = UITabBarItem(title: "Games", image: UIImage(systemName: "gamecontroller.fill"), tag: 0)

        let aboutVC = AboutViewController()
        aboutVC.tabBarItem = UITabBarItem(title: "About", image: UIImage(systemName: "info.circle.fill"), tag: 1)

        let tabBar = UITabBarController()
        tabBar.viewControllers = [gamesVC, aboutVC]
        tabBar.tabBar.barTintColor = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)
        tabBar.tabBar.tintColor = UIColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1)
        tabBar.tabBar.unselectedItemTintColor = UIColor(white: 0.5, alpha: 1)
        tabBar.tabBar.isTranslucent = false

        if #available(iOS 15.0, *) {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)
            tabBar.tabBar.standardAppearance = appearance
            tabBar.tabBar.scrollEdgeAppearance = appearance
        }

        window?.rootViewController = tabBar
        window?.makeKeyAndVisible()
        return true
    }
}
