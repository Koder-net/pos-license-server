import { randomBytes } from 'crypto'

// No ambiguous characters: 0/O, 1/I/L
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function segment(): string {
  const bytes = randomBytes(4)
  return Array.from(bytes)
    .map((b) => CHARS[b % CHARS.length])
    .join('')
}

export function generateLicenseKey(): string {
  return `BAKE-${segment()}-${segment()}-${segment()}-${segment()}`
}
