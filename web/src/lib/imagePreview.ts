/**
 * Image preview utilities for file browser.
 *
 * Uses file extension to determine whether browser-renderable image preview
 * is possible and to build the corresponding MIME type for data-URL rendering.
 */

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
    // Raster
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    // Vector
    svg: 'image/svg+xml',
}

/**
 * Return the image MIME type for a given file path based on its extension,
 * or `null` when the extension is not a known browser-renderable image type.
 */
export function getImageMimeTypeFromPath(filePath: string): string | null {
    const dotIndex = filePath.lastIndexOf('.')
    if (dotIndex < 0) return null
    const ext = filePath.slice(dotIndex + 1).toLowerCase()
    return IMAGE_EXTENSION_TO_MIME[ext] ?? null
}

/**
 * Build a base64 data-URL for inline image rendering.
 *
 * @param base64Content - raw base64 string (from FileReadResponse.content)
 * @param mimeType - e.g. "image/png"
 */
export function buildImageDataUrl(base64Content: string, mimeType: string): string {
    return `data:${mimeType};base64,${base64Content}`
}
