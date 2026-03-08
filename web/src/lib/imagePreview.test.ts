import { describe, it, expect } from 'vitest'
import { getImageMimeTypeFromPath, buildImageDataUrl } from './imagePreview'

describe('getImageMimeTypeFromPath', () => {
    it('returns correct MIME type for common image extensions', () => {
        expect(getImageMimeTypeFromPath('photo.png')).toBe('image/png')
        expect(getImageMimeTypeFromPath('photo.jpg')).toBe('image/jpeg')
        expect(getImageMimeTypeFromPath('photo.jpeg')).toBe('image/jpeg')
        expect(getImageMimeTypeFromPath('animation.gif')).toBe('image/gif')
        expect(getImageMimeTypeFromPath('modern.webp')).toBe('image/webp')
        expect(getImageMimeTypeFromPath('icon.ico')).toBe('image/x-icon')
        expect(getImageMimeTypeFromPath('next-gen.avif')).toBe('image/avif')
        expect(getImageMimeTypeFromPath('logo.svg')).toBe('image/svg+xml')
        expect(getImageMimeTypeFromPath('bitmap.bmp')).toBe('image/bmp')
    })

    it('is case-insensitive for extensions', () => {
        expect(getImageMimeTypeFromPath('PHOTO.PNG')).toBe('image/png')
        expect(getImageMimeTypeFromPath('Photo.JPG')).toBe('image/jpeg')
        expect(getImageMimeTypeFromPath('logo.SVG')).toBe('image/svg+xml')
    })

    it('returns null for non-image extensions', () => {
        expect(getImageMimeTypeFromPath('readme.md')).toBeNull()
        expect(getImageMimeTypeFromPath('app.tsx')).toBeNull()
        expect(getImageMimeTypeFromPath('style.css')).toBeNull()
        expect(getImageMimeTypeFromPath('data.json')).toBeNull()
        expect(getImageMimeTypeFromPath('archive.zip')).toBeNull()
        expect(getImageMimeTypeFromPath('binary.exe')).toBeNull()
    })

    it('returns null for files without extension', () => {
        expect(getImageMimeTypeFromPath('Makefile')).toBeNull()
        expect(getImageMimeTypeFromPath('LICENSE')).toBeNull()
    })

    it('handles paths with directories', () => {
        expect(getImageMimeTypeFromPath('src/assets/logo.png')).toBe('image/png')
        expect(getImageMimeTypeFromPath('/home/user/photos/vacation.jpg')).toBe('image/jpeg')
    })

    it('handles filenames with multiple dots', () => {
        expect(getImageMimeTypeFromPath('my.photo.png')).toBe('image/png')
        expect(getImageMimeTypeFromPath('backup.2024.01.jpg')).toBe('image/jpeg')
    })

    it('returns null for empty string', () => {
        expect(getImageMimeTypeFromPath('')).toBeNull()
    })
})

describe('buildImageDataUrl', () => {
    it('builds correct data URL for PNG', () => {
        const result = buildImageDataUrl('aGVsbG8=', 'image/png')
        expect(result).toBe('data:image/png;base64,aGVsbG8=')
    })

    it('builds correct data URL for JPEG', () => {
        const result = buildImageDataUrl('abc123', 'image/jpeg')
        expect(result).toBe('data:image/jpeg;base64,abc123')
    })

    it('builds correct data URL for SVG', () => {
        const result = buildImageDataUrl('PHN2Zz4=', 'image/svg+xml')
        expect(result).toBe('data:image/svg+xml;base64,PHN2Zz4=')
    })
})
