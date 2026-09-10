import { describe, it, expect } from 'vitest'
import {
  validatePassword,
  validateEmail,
  sanitizeEmail,
  sanitizeInput,
  sanitizeFileName,
  validateFileUpload,
} from '../utils/security'
import { getLiveKitToken } from '../lib/livekitToken'

describe('Security Utilities: Password Complexity', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const res = validatePassword('Ab1!')
    expect(res.isValid).toBe(false)
    expect(res.message).toContain('Password must be at least 8 characters long.')
  })

  it('requires lowercase, uppercase, number, and special character', () => {
    expect(validatePassword('alllowercase1!').isValid).toBe(false)
    expect(validatePassword('ALLUPPERCASE1!').isValid).toBe(false)
    expect(validatePassword('NoSpecialChar123').isValid).toBe(false)
    expect(validatePassword('NoNumberSpecial!').isValid).toBe(false)
  })

  it('accepts strong, compliant passwords', () => {
    const res = validatePassword('SuperSecret#2026')
    expect(res.isValid).toBe(true)
    expect(res.message).toBeUndefined()
  })
})

describe('Security Utilities: Email Sanitization and Validation', () => {
  it('validates standard email formats correctly', () => {
    expect(validateEmail('student@learnova.edu')).toBe(true)
    expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
    expect(validateEmail('invalid-email')).toBe(false)
    expect(validateEmail('admin@')).toBe(false)
    expect(validateEmail('')).toBe(false)
  })

  it('sanitizes email strings properly', () => {
    expect(sanitizeEmail('  User@DOMAIN.com  ')).toBe('user@domain.com')
    expect(sanitizeEmail(null)).toBe('')
  })
})

describe('Security Utilities: Input Sanitization & XSS Mitigation', () => {
  it('strips script tags and executable attributes', () => {
    const malicious = '<script>alert("xss")</script>Hello <img src="x" onerror="steal()" /> World'
    const cleaned = sanitizeInput(malicious)
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).not.toContain('alert("xss")')
    expect(cleaned).not.toContain('onerror=')
  })

  it('strips null bytes and control characters', () => {
    const raw = 'admin\u0000user\u0007'
    const cleaned = sanitizeInput(raw)
    expect(cleaned).toBe('adminuser')
  })
})

describe('Security Utilities: Path Traversal & Filename Sanitization', () => {
  it('strips path traversal sequences (../, ..\\)', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc_passwd')
    expect(sanitizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('windows_system32_cmd.exe')
  })

  it('strips null bytes from filenames', () => {
    expect(sanitizeFileName('exploit.php\0.jpg')).toBe('exploit.php.jpg')
  })
})

describe('Security Utilities: File Upload Whitelisting & Size Caps', () => {
  it('permits valid JPG, PNG, WebP images within size bounds', () => {
    const safeImage = new File(['fake content'], 'avatar.jpg', { type: 'image/jpeg' })
    const res = validateFileUpload(safeImage, { type: 'image' })
    expect(res.isValid).toBe(true)
    expect(res.sanitizedExt).toBe('jpg')
  })

  it('strictly rejects SVG images to prevent Stored XSS vectors', () => {
    const svgFile = new File(['<svg onload="alert(1)"></svg>'], 'vector.svg', { type: 'image/svg+xml' })
    const res = validateFileUpload(svgFile, { type: 'image' })
    expect(res.isValid).toBe(false)
    expect(res.error).toMatch(/disallowed|SVG is prohibited/i)
  })

  it('strictly blocks executable files and scripts regardless of category', () => {
    const exe = new File(['binary'], 'virus.exe', { type: 'application/x-msdownload' })
    expect(validateFileUpload(exe).isValid).toBe(false)

    const php = new File(['<?php echo "hi"; ?>'], 'shell.php', { type: 'application/x-php' })
    expect(validateFileUpload(php).isValid).toBe(false)

    const sh = new File(['rm -rf /'], 'script.sh', { type: 'application/x-sh' })
    expect(validateFileUpload(sh).isValid).toBe(false)
  })

  it('enforces file size caps', () => {
    const hugeBuffer = new Uint8Array(6 * 1024 * 1024) // 6MB
    const bigFile = new File([hugeBuffer], 'photo.png', { type: 'image/png' })
    const res = validateFileUpload(bigFile, { type: 'image', maxSizeBytes: 5 * 1024 * 1024 })
    expect(res.isValid).toBe(false)
    expect(res.error).toContain('limit')
  })

  it('supports PDF, PPT, and PPTX documents while rejecting invalid formats', () => {
    const pdf = new File(['content'], 'notes.pdf', { type: 'application/pdf' })
    expect(validateFileUpload(pdf, { type: 'document' }).isValid).toBe(true)

    const pptx = new File(['content'], 'lecture.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    expect(validateFileUpload(pptx, { type: 'document' }).isValid).toBe(true)

    const htmlDoc = new File(['<h1>fake</h1>'], 'fake.html', { type: 'text/html' })
    expect(validateFileUpload(htmlDoc, { type: 'document' }).isValid).toBe(false)
  })
})

describe('LiveKit Token Minting: Client Secret Eradication', () => {
  it('does NOT expose VITE_LIVEKIT_API_SECRET in import.meta.env', () => {
    expect(import.meta.env.VITE_LIVEKIT_API_SECRET).toBeUndefined()
  })

  it('rejects token creation attempts when roomName is missing', async () => {
    await expect(getLiveKitToken({ roomName: '' })).rejects.toThrow(/roomName is required/i)
  })
})
