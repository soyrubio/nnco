import AppKit
import Vision
import CoreImage

let source = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
let image = CIImage(contentsOf: source)!
let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.usesCPUOnly = true
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
try VNImageRequestHandler(url: source).perform([request])
guard let buffer = request.results?.first?.pixelBuffer else { fatalError("No person mask returned") }
let mask = CIImage(cvPixelBuffer: buffer)
let scaled = mask.transformed(by: CGAffineTransform(scaleX: image.extent.width / mask.extent.width, y: image.extent.height / mask.extent.height))
let context = CIContext()
try context.writePNGRepresentation(of: scaled, to: destination, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
