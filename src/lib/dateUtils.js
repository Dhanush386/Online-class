/**
 * Convert a UTC ISO string from the database into the value format required by <input type="datetime-local">
 * (e.g. 2023-11-01T14:30:00Z -> 2023-11-01T14:30)
 */
export function toLocalInput(utcString) {
    if (!utcString) return ''
    const d = new Date(utcString)
    // Pad a number to 2 digits
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Convert a datetime-local string (no timezone) to a proper ISO string with local timezone offset
 * (e.g. 2023-11-01T14:30 -> 2023-11-01T09:00:00.000Z in IST)
 */
export function toISOWithOffset(localStr) {
    if (!localStr) return null
    const d = new Date(localStr) // browser treats this string as local time
    if (isNaN(d.getTime())) return null
    return d.toISOString()       // store as UTC ISO
}
