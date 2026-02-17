import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)

        let pickerVC = GamePickerViewController()
        let gamesNav = UINavigationController(rootViewController: pickerVC)
        gamesNav.tabBarItem = UITabBarItem(title: "Games", image: UIImage(systemName: "gamecontroller.fill"), tag: 0)

        // Style the navigation bar
        let navBarBG = UIColor(red: 15/255, green: 15/255, blue: 35/255, alpha: 1)
        gamesNav.navigationBar.barTintColor = navBarBG
        gamesNav.navigationBar.tintColor = UIColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1)
        gamesNav.navigationBar.titleTextAttributes = [.foregroundColor: UIColor.white]
        gamesNav.navigationBar.isTranslucent = false

        if #available(iOS 15.0, *) {
            let navAppearance = UINavigationBarAppearance()
            navAppearance.configureWithOpaqueBackground()
            navAppearance.backgroundColor = navBarBG
            navAppearance.titleTextAttributes = [.foregroundColor: UIColor.white]
            navAppearance.shadowColor = .clear
            gamesNav.navigationBar.standardAppearance = navAppearance
            gamesNav.navigationBar.scrollEdgeAppearance = navAppearance
        }

        let aboutVC = AboutViewController()
        aboutVC.tabBarItem = UITabBarItem(title: "About", image: UIImage(systemName: "info.circle.fill"), tag: 1)

        let tabBar = UITabBarController()
        tabBar.viewControllers = [gamesNav, aboutVC]
        tabBar.tabBar.barTintColor = navBarBG
        tabBar.tabBar.tintColor = UIColor(red: 0.3, green: 0.7, blue: 1.0, alpha: 1)
        tabBar.tabBar.unselectedItemTintColor = UIColor(white: 0.5, alpha: 1)
        tabBar.tabBar.isTranslucent = false

        if #available(iOS 15.0, *) {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = navBarBG
            tabBar.tabBar.standardAppearance = appearance
            tabBar.tabBar.scrollEdgeAppearance = appearance
        }

        window?.rootViewController = tabBar
        window?.makeKeyAndVisible()
        return true
    }
}
