import AppKit

let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                           isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!

NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let g = ctx.cgContext

// Background: richer navy-to-indigo — enough contrast against bright graphics
let bgGradient = NSGradient(colorsAndLocations:
    (NSColor(calibratedRed: 10/255, green: 14/255, blue: 58/255, alpha: 1), 0),
    (NSColor(calibratedRed: 22/255, green: 36/255, blue: 110/255, alpha: 1), 0.5),
    (NSColor(calibratedRed: 14/255, green: 20/255, blue: 72/255, alpha: 1), 1)
)!
bgGradient.draw(in: NSRect(x: 0, y: 0, width: size, height: size), angle: 90)

// Radial glow behind main circle — separates circle from background
g.saveGState()
let glowCenter = CGPoint(x: CGFloat(size)/2, y: 514)
let glowColors = [
    NSColor(calibratedRed: 100/255, green: 140/255, blue: 255/255, alpha: 0.35).cgColor,
    NSColor(calibratedRed: 80/255, green: 60/255, blue: 200/255, alpha: 0.12).cgColor,
    NSColor(calibratedRed: 20/255, green: 20/255, blue: 80/255, alpha: 0).cgColor
] as CFArray
let glowGrad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: glowColors, locations: [0, 0.5, 1])!
g.drawRadialGradient(glowGrad, startCenter: glowCenter, startRadius: 0, endCenter: glowCenter, endRadius: 480, options: [])
g.restoreGState()

let innerCircleRect = NSRect(x: (CGFloat(size) - 920)/2, y: 54, width: 920, height: 920)
let ringPath = NSBezierPath(ovalIn: innerCircleRect)

// Outer ring: brighter gradient
let ringGradient = NSGradient(colorsAndLocations:
    (NSColor(calibratedRed: 140/255, green: 100/255, blue: 255/255, alpha: 1), 0),
    (NSColor(calibratedRed: 70/255, green: 210/255, blue: 255/255, alpha: 1), 1)
)!
ringGradient.draw(in: ringPath, relativeCenterPosition: NSPoint(x: -0.05, y: 0.1))

// Stronger ring stroke
NSColor(calibratedWhite: 1, alpha: 0.3).setStroke()
ringPath.lineWidth = 18
ringPath.stroke()

let orbRect = innerCircleRect.insetBy(dx: 60, dy: 60)
let orbPath = NSBezierPath(ovalIn: orbRect)
let orbGradient = NSGradient(colorsAndLocations:
    (NSColor(calibratedRed: 45/255, green: 80/255, blue: 220/255, alpha: 1), 0),
    (NSColor(calibratedRed: 140/255, green: 55/255, blue: 230/255, alpha: 1), 0.6),
    (NSColor(calibratedRed: 230/255, green: 150/255, blue: 80/255, alpha: 1), 1)
)!
orbGradient.draw(in: orbPath, relativeCenterPosition: NSPoint(x: 0.08, y: 0.25))

// Inner ring highlight
NSColor(calibratedWhite: 1, alpha: 0.15).setStroke()
orbPath.lineWidth = 6
orbPath.stroke()

// Sparkles
let stars = [NSPoint(x: orbRect.midX + 150, y: orbRect.midY + 170),
             NSPoint(x: orbRect.midX - 200, y: orbRect.midY + 60),
             NSPoint(x: orbRect.midX + 210, y: orbRect.midY - 130),
             NSPoint(x: orbRect.midX - 130, y: orbRect.midY - 160)]
for (idx, pt) in stars.enumerated() {
    let color = idx % 2 == 0
        ? NSColor(calibratedRed: 255/255, green: 235/255, blue: 140/255, alpha: 1)
        : NSColor(calibratedRed: 110/255, green: 255/255, blue: 245/255, alpha: 1)
    color.setStroke()
    let star = NSBezierPath()
    let radius: CGFloat = 16
    star.move(to: NSPoint(x: pt.x - radius, y: pt.y))
    star.line(to: NSPoint(x: pt.x + radius, y: pt.y))
    star.move(to: NSPoint(x: pt.x, y: pt.y - radius))
    star.line(to: NSPoint(x: pt.x, y: pt.y + radius))
    star.lineWidth = 5
    star.stroke()
}

// Tiny tiny sparkle dots
let tinyStars = [
    NSPoint(x: orbRect.midX + 40, y: orbRect.midY + 200),
    NSPoint(x: orbRect.midX - 160, y: orbRect.midY + 180),
    NSPoint(x: orbRect.midX + 230, y: orbRect.midY + 50),
    NSPoint(x: orbRect.midX - 250, y: orbRect.midY - 60),
    NSPoint(x: orbRect.midX + 170, y: orbRect.midY - 200),
    NSPoint(x: orbRect.midX - 50, y: orbRect.midY - 230),
    NSPoint(x: orbRect.midX + 260, y: orbRect.midY + 180),
    NSPoint(x: orbRect.midX - 220, y: orbRect.midY + 150),
    NSPoint(x: orbRect.midX + 120, y: orbRect.midY + 250),
    NSPoint(x: orbRect.midX - 270, y: orbRect.midY - 130),
    NSPoint(x: orbRect.midX + 50, y: orbRect.midY - 270),
    NSPoint(x: orbRect.midX - 180, y: orbRect.midY - 200),
    NSPoint(x: orbRect.midX + 280, y: orbRect.midY - 50),
    NSPoint(x: orbRect.midX - 30, y: orbRect.midY + 280),
]
for (j, tp) in tinyStars.enumerated() {
    let tc = j % 3 == 0 ? NSColor(calibratedRed: 255/255, green: 240/255, blue: 180/255, alpha: 0.9)
           : j % 3 == 1 ? NSColor(calibratedRed: 180/255, green: 255/255, blue: 250/255, alpha: 0.85)
                         : NSColor(calibratedRed: 255/255, green: 200/255, blue: 255/255, alpha: 0.8)
    tc.setStroke()
    let ts = NSBezierPath()
    let tr: CGFloat = 6
    ts.move(to: NSPoint(x: tp.x - tr, y: tp.y))
    ts.line(to: NSPoint(x: tp.x + tr, y: tp.y))
    ts.move(to: NSPoint(x: tp.x, y: tp.y - tr))
    ts.line(to: NSPoint(x: tp.x, y: tp.y + tr))
    ts.lineWidth = 2.5
    ts.stroke()
}

// f(A) with glow for high contrast on orb
g.saveGState()
let textGlowCenter = CGPoint(x: orbRect.midX, y: orbRect.midY + 30)
let textGlowColors = [
    NSColor(calibratedRed: 255/255, green: 220/255, blue: 80/255, alpha: 0.3).cgColor,
    NSColor(calibratedRed: 255/255, green: 200/255, blue: 60/255, alpha: 0).cgColor
] as CFArray
let textGlow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: textGlowColors, locations: [0, 1])!
g.drawRadialGradient(textGlow, startCenter: textGlowCenter, startRadius: 0, endCenter: textGlowCenter, endRadius: 200, options: [])
g.restoreGState()

let fShadow = NSShadow()
fShadow.shadowBlurRadius = 35
fShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.9)
fShadow.shadowOffset = NSSize(width: 0, height: -10)
let formulaAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 360, weight: .heavy),
    .foregroundColor: NSColor(calibratedRed: 255/255, green: 228/255, blue: 120/255, alpha: 1),
    .shadow: fShadow
]
let formula = "f(A)" as NSString
let formulaSize = formula.size(withAttributes: formulaAttrs)
formula.draw(at: NSPoint(x: orbRect.midX - formulaSize.width/2, y: orbRect.midY - formulaSize.height/2 + 30),
             withAttributes: formulaAttrs)

// Glow behind controller
g.saveGState()
let ctrlGlowCenter = CGPoint(x: CGFloat(size)/2, y: 80)
let ctrlGlowColors = [
    NSColor(calibratedRed: 255/255, green: 180/255, blue: 80/255, alpha: 0.3).cgColor,
    NSColor(calibratedRed: 255/255, green: 160/255, blue: 60/255, alpha: 0).cgColor
] as CFArray
let ctrlGlow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: ctrlGlowColors, locations: [0, 1])!
g.drawRadialGradient(ctrlGlow, startCenter: ctrlGlowCenter, startRadius: 0, endCenter: ctrlGlowCenter, endRadius: 200, options: [])
g.restoreGState()

let consoleRect = NSRect(x: (CGFloat(size) - 560)/2, y: 39, width: 560, height: 150)
let consolePath = NSBezierPath(roundedRect: consoleRect, xRadius: 75, yRadius: 75)
let consoleGradient = NSGradient(colorsAndLocations:
    (NSColor(calibratedRed: 255/255, green: 190/255, blue: 90/255, alpha: 1), 0),
    (NSColor(calibratedRed: 255/255, green: 215/255, blue: 145/255, alpha: 1), 1)
)!
consoleGradient.draw(in: consolePath, angle: 0)

// Stronger console outline
NSColor(calibratedRed: 170/255, green: 90/255, blue: 25/255, alpha: 1).setStroke()
consolePath.lineWidth = 8
consolePath.stroke()
NSColor(calibratedWhite: 1, alpha: 0.2).setStroke()
consolePath.lineWidth = 3
consolePath.stroke()

let stickBase = NSBezierPath(ovalIn: NSRect(x: consoleRect.midX - 60, y: consoleRect.midY - 20, width: 120, height: 90))
NSColor(calibratedRed: 250/255, green: 190/255, blue: 90/255, alpha: 1).setFill()
stickBase.fill()
NSColor(calibratedRed: 130/255, green: 65/255, blue: 18/255, alpha: 1).setStroke()
stickBase.lineWidth = 4
stickBase.stroke()

let stick = NSBezierPath()
stick.move(to: NSPoint(x: consoleRect.midX, y: consoleRect.midY + 10))
stick.line(to: NSPoint(x: consoleRect.midX, y: consoleRect.midY + 115))
stick.lineWidth = 16
NSColor(calibratedRed: 90/255, green: 50/255, blue: 150/255, alpha: 1).setStroke()
stick.stroke()

let knob = NSBezierPath(ovalIn: NSRect(x: consoleRect.midX - 40, y: consoleRect.midY + 95, width: 80, height: 80))
NSGradient(colorsAndLocations:
    (NSColor(calibratedRed: 255/255, green: 135/255, blue: 170/255, alpha: 1), 0),
    (NSColor(calibratedRed: 255/255, green: 70/255, blue: 105/255, alpha: 1), 1)
)!.draw(in: knob, angle: 90)
NSColor(calibratedWhite: 1, alpha: 0.3).setStroke()
knob.lineWidth = 6
knob.stroke()

func drawButton(center: NSPoint, color: NSColor, label: String) {
    let rect = NSRect(x: center.x - 70, y: center.y - 34, width: 140, height: 68)
    let path = NSBezierPath(roundedRect: rect, xRadius: 30, yRadius: 30)
    color.setFill()
    path.fill()
    NSColor(calibratedWhite: 1, alpha: 0.4).setStroke()
    path.lineWidth = 4
    path.stroke()
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 38, weight: .heavy),
        .foregroundColor: NSColor(calibratedRed: 26/255, green: 12/255, blue: 4/255, alpha: 1)
    ]
    let text = label as NSString
    let size = text.size(withAttributes: attrs)
    text.draw(at: NSPoint(x: center.x - size.width/2, y: center.y - size.height/2), withAttributes: attrs)
}

drawButton(center: NSPoint(x: consoleRect.minX + 140, y: consoleRect.midY - 5), color: NSColor(calibratedRed: 255/255, green: 235/255, blue: 150/255, alpha: 1), label: "Lab")
drawButton(center: NSPoint(x: consoleRect.maxX - 140, y: consoleRect.midY - 5), color: NSColor(calibratedRed: 145/255, green: 240/255, blue: 255/255, alpha: 1), label: "City")

NSGraphicsContext.restoreGraphicsState()

let data = rep.representation(using: .png, properties: [:])!
let outputPath = "/Users/vikasyadav/Library/CloudStorage/OneDrive-Personal/Documents/GitHub/Games/fa_arcade_icon_simple.png"
try data.write(to: URL(fileURLWithPath: outputPath))
print("Saved \(outputPath)")
