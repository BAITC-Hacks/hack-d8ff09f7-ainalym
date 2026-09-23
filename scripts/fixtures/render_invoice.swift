import AppKit
import Foundation

struct Invoice: Decodable { let title: String; let rows: [String] }
let input = try JSONDecoder().decode(Invoice.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let width = 1400, height = 1300
guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
  let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot render invoice") }
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor(calibratedWhite: 0.88, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()
NSColor(calibratedWhite: 0.65, alpha: 1).setFill()
NSRect(x: 90, y: 85, width: 1225, height: 1125).fill()
NSColor.white.setFill()
NSRect(x: 72, y: 102, width: 1225, height: 1125).fill()
let heading: [NSAttributedString.Key: Any] = [.font: NSFont.boldSystemFont(ofSize: 28), .foregroundColor: NSColor.black]
let body: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedSystemFont(ofSize: 17, weight: .regular), .foregroundColor: NSColor.black]
(input.title as NSString).draw(at: NSPoint(x: 120, y: 1135), withAttributes: heading)
("СИНТЕТИЧЕСКИЙ ПРИМЕР · НЕ ДЛЯ ОПЛАТЫ" as NSString).draw(at: NSPoint(x: 120, y: 1092), withAttributes: body)
for (index, row) in input.rows.enumerated() {
  (row as NSString).draw(at: NSPoint(x: 120, y: 1035 - index * 58), withAttributes: body)
}
NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("Cannot encode PNG") }
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
