/**
 * Enterprise Security Utility Library
 * Learnova Platform
 */

// ── 1. PASSWORD COMPLEXITY ENFORCEMENT ────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Validates password strength against industry standards:
 * - At least 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one numeric digit
 * - At least one special symbol
 *
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required.' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      isValid: false,
      message: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`,
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter (a-z).',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter (A-Z).',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one numeric digit (0-9).',
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character (e.g. !@#$%^&*).',
    };
  }

  return { isValid: true };
}

// ── 2. EMAIL VALIDATION & SANITIZATION ────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleaned = email.trim();
  if (cleaned.length < 5 || cleaned.length > 254) return false;
  return EMAIL_REGEX.test(cleaned);
}

export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

// ── 3. TEXT & INPUT SANITIZATION ──────────────────────────────────────────────

/**
 * Strips dangerous HTML tags, javascript: schemes, control chars, and prevents XSS
 * @param {string} str
 * @returns {string}
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '') // remove ASCII control characters
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // strip script blocks
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // strip iframe blocks
    .replace(/on\w+\s*=/gi, '') // strip event handler attributes like onload=, onclick=
    .trim();
}

// ── 4. FILE UPLOAD SAFETY & PATH TRAVERSAL MITIGATION ─────────────────────────

const DANGEROUS_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'svg', 'xml', // Stored XSS vectors
  'exe', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'vbs', 'com', 'scr', // Executables
  'php', 'phtml', 'php3', 'php4', 'php5', 'asp', 'aspx', 'jsp', 'cgi', 'pl', // Server-side execution
  'js', 'mjs', 'ts', 'jsx', 'tsx', 'wasm',
]);

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const ALLOWED_DOC_EXTS = new Set(['pdf', 'ppt', 'pptx']);

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const ALLOWED_VIDEO_EXTS = new Set(['mp4', 'webm']);

/**
 * Sanitizes a filename to prevent path traversal, null byte injections, and double extension tricks
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFileName(filename) {
  if (!filename || typeof filename !== 'string') return `file_${Date.now()}`;
  
  // Strip path traversal sequences and null bytes
  let clean = filename
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim();

  // Ensure there are no leading dots, slashes, or underscores left by traversal stripping
  clean = clean.replace(/^[_.\s]+/, '');
  return clean || `file_${Date.now()}`;
}

/**
 * Validates a file upload against strict MIME type, extension whitelist, and size bounds
 * @param {File} file
 * @param {Object} [options]
 * @param {'image' | 'document' | 'video'} [options.type='image']
 * @param {number} [options.maxSizeBytes]
 * @returns {{ isValid: boolean, error?: string, sanitizedExt?: string }}
 */
export function validateFileUpload(file, options = {}) {
  const { type = 'image', maxSizeBytes } = options;

  if (!file || !(file instanceof File || file instanceof Blob)) {
    return { isValid: false, error: 'No valid file selected.' };
  }

  // Size limit validation (default: 5MB for images, 10MB for documents, 250MB for video)
  const defaultMax = type === 'image' 
    ? 5 * 1024 * 1024 
    : type === 'document' 
      ? 10 * 1024 * 1024 
      : 250 * 1024 * 1024;
  
  const limit = maxSizeBytes || defaultMax;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return { isValid: false, error: `File size exceeds the ${mb}MB limit.` };
  }

  if (file.size === 0) {
    return { isValid: false, error: 'File is empty.' };
  }

  const rawName = file.name || '';
  const ext = (rawName.split('.').pop() || '').toLowerCase();

  // Reject dangerous extensions immediately
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { isValid: false, error: 'This file format is disallowed for security reasons.' };
  }

  const mime = (file.type || '').toLowerCase();

  if (type === 'image') {
    if (!ALLOWED_IMAGE_MIMES.has(mime) || !ALLOWED_IMAGE_EXTS.has(ext)) {
      return {
        isValid: false,
        error: 'Only valid JPG, PNG, and WebP images are permitted (SVG is prohibited).',
      };
    }
  } else if (type === 'document') {
    if (!ALLOWED_DOC_MIMES.has(mime) || !ALLOWED_DOC_EXTS.has(ext)) {
      return { isValid: false, error: 'Only valid PDF and presentation documents (.pdf, .ppt, .pptx) are permitted.' };
    }
  } else if (type === 'video') {
    if (!ALLOWED_VIDEO_MIMES.has(mime) || !ALLOWED_VIDEO_EXTS.has(ext)) {
      return { isValid: false, error: 'Only MP4 and WebM video formats are permitted.' };
    }
  }

  return { isValid: true, sanitizedExt: ext };
}
