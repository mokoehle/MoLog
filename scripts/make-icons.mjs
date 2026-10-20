// Erzeugt die App-Icons (Hantel auf dunklem Grund) ohne externe Abhängigkeiten.
// Aufruf: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x0e, 0x0f, 0x11]
const FG = [0xc6, 0xf4, 0x32]

// Rechtecke in einem 100×100-Raster: [x, y, w, h]
const SHAPES = [
  [14, 47, 72, 6], // Stange
  [22, 30, 8, 40], // Scheiben links
  [31, 36, 6, 28],
  [70, 30, 8, 40], // Scheiben rechts
  [63, 36, 6, 28],
]

function pixel(x, y, size) {
  const u = (x / size) * 100
  const v = (y / size) * 100
  return SHAPES.some(([sx, sy, w, h]) => u >= sx && u < sx + w && v >= sy && v < sy + h) ? FG : BG
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size)
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // Bit-Tiefe
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (c) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${hex(BG)}"/>${SHAPES.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${hex(FG)}"/>`).join('')}</svg>\n`

writeFileSync('public/apple-touch-icon.png', png(180))
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/icon.svg', svg)
console.log('Icons erzeugt in public/')
