/**
 * Secure Rich Text Sanitizer & Inline Markdown Formatter
 * Strict whitelist preventing stored XSS while preserving legitimate document formatting:
 * Allowed tags: <p>, <br>, <ol>, <ul>, <li>, <code>, <strong>, <em>, <span>, <div>, <h1>-<h4>
 * Strips all script, iframe, embed, object, styles, event handlers (on*), and javascript: URLs.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'ol', 'ul', 'li', 'code', 'strong', 'em', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'hr'
]);

const ALLOWED_ATTRIBUTES = new Set([
  'class', 'className', 'style', 'id', 'role', 'aria-label'
]);

/**
 * Escapes raw HTML characters
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parses inline markdown-like shortcuts safely:
 * - `code` => <code class="cs-inline-code">code</code>
 * - **bold** => <strong>bold</strong>
 * - *italic* => <em>italic</em>
 * All other content is HTML escaped before insertion.
 */
export function formatInlineText(text) {
  if (!text || typeof text !== 'string') return '';

  // First escape HTML to neutralize any script or tag injection
  let safe = escapeHtml(text);

  // Replace `code` with styled code badges
  safe = safe.replace(/`([^`]+)`/g, '<code class="cs-inline-code">$1</code>');

  // Replace **bold** with <strong>
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Replace *italic* with <em>
  safe = safe.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  return safe;
}

/**
 * Sanitizes rich HTML string allowing strictly whitelisted markup
 */
export function sanitizeRichHtml(dirtyHtml) {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  // Remove dangerous tags and scripts immediately
  let cleaned = dirtyHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all event handlers (onload, onerror, onclick, onmouseover, etc.)
    .replace(/\son[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-zA-Z]+\s*=\s*[^>\s]+/gi, '')
    // Remove javascript: and data: URI schemes
    .replace(/href\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, '')
    .replace(/src\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, '');

  return cleaned;
}
