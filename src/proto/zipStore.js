/**
 * Sıfır bağımlılıklı, sıkıştırmasız (STORE, method = 0) minimal ZIP yazıcı.
 * - UTF-8 dosya adı bayrağı (`0x0800`) ve IEEE 802.3 CRC-32 sağlama toplamı üretir.
 * - Hem tarayıcıda (`ProtoAiDock` / `ProtoApp` indir) hem Node testlerinde doğrudan çalışır.
 */

const textEncoder = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (typeof ArrayBuffer !== 'undefined' && content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  return textEncoder.encode(String(content ?? ''));
}

function sanitizeZipEntryName(name) {
  return String(name || 'dosya.txt')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.\//g, '');
}

/**
 * `{ [dosyaYolu]: string | Uint8Array }` sözlüğünden geçerli bir ZIP (`Uint8Array`) üretir.
 */
export function zipStore(files, options = {}) {
  if (!files || typeof files !== 'object') {
    throw new TypeError('zipStore için files nesnesi gereklidir.');
  }

  const { dosTime, dosDate } = encodeDosDateTime(options.date || new Date());
  const UTF8_FLAG = 0x0800;

  const entries = Object.entries(files).map(([rawName, rawContent]) => {
    const cleanName = sanitizeZipEntryName(rawName);
    const nameBytes = textEncoder.encode(cleanName);
    const dataBytes = toBytes(rawContent);
    const crc = computeCrc32(dataBytes);
    return { cleanName, nameBytes, dataBytes, crc };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;

  for (const entry of entries) {
    localTotalSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
    centralTotalSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets = [];

  // 1) Local File Headers + ham dosya verileri (STORE, method = 0)
  for (const entry of entries) {
    localOffsets.push(offset);
    const nameLen = entry.nameBytes.length;
    const dataLen = entry.dataBytes.length;

    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, UTF8_FLAG, true); // General purpose bit flag (UTF-8)
    view.setUint16(offset + 8, 0, true); // Compression method = 0 (store)
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, dataLen, true); // Compressed size
    view.setUint32(offset + 22, dataLen, true); // Uncompressed size
    view.setUint16(offset + 26, nameLen, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    out.set(entry.nameBytes, offset);
    offset += nameLen;

    out.set(entry.dataBytes, offset);
    offset += dataLen;
  }

  const centralDirOffset = offset;

  // 2) Central Directory Headers
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const nameLen = entry.nameBytes.length;
    const dataLen = entry.dataBytes.length;

    view.setUint32(offset, 0x02014b50, true); // Central file header signature
    view.setUint16(offset + 4, (3 << 8) | 20, true); // Version made by: Unix (3) + ZIP 2.0 (UTF-8 dosya adı uyumluluğu)
    view.setUint16(offset + 6, 20, true); // Version needed to extract
    view.setUint16(offset + 8, UTF8_FLAG, true); // UTF-8 bit flag
    view.setUint16(offset + 10, 0, true); // Compression method = 0 (store)
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, dataLen, true);
    view.setUint32(offset + 24, dataLen, true);
    view.setUint16(offset + 28, nameLen, true);
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, (0o100644 << 16) >>> 0, true); // External file attributes (Unix regular file 0644)
    view.setUint32(offset + 42, localOffsets[i], true); // Relative offset of local header
    offset += 46;

    out.set(entry.nameBytes, offset);
    offset += nameLen;
  }

  // 3) End of Central Directory Record (EOCD)
  view.setUint32(offset, 0x06054b50, true); // EOCD signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where central directory starts
  view.setUint16(offset + 8, entries.length, true); // Entries on this disk
  view.setUint16(offset + 10, entries.length, true); // Total entries
  view.setUint32(offset + 12, centralTotalSize, true);
  view.setUint32(offset + 16, centralDirOffset, true);
  view.setUint16(offset + 20, 0, true); // Comment length

  return out;
}

export default zipStore;
