// Server-side image validation for admin uploads (spec §9, AGENTS.md §8). We do
// NOT trust the client-supplied Content-Type: this reads the magic bytes and the
// intrinsic dimensions straight from the file header, so format + longest-edge
// caps are enforced authoritatively. Header-only parsing — no decode, no deps,
// Workers-safe (nodejs_compat stays OFF).

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_EDGE = 4000; // longest edge in px
export const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type ImageFormat = (typeof ACCEPTED_FORMATS)[number];

export const ACCEPTED_EXT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};
export const ACCEPTED_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface SniffedImage {
  format: ImageFormat;
  ext: string;
  mime: string;
  width: number;
  height: number;
}

// Inspect header bytes; return format + dimensions, or null if not a supported
// image (or the header is too truncated/corrupt to read dimensions).
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  let dims: { width: number; height: number } | null = null;
  let format: ImageFormat | null = null;

  if (isPng(bytes)) {
    format = 'png';
    dims = pngDimensions(bytes);
  } else if (isJpeg(bytes)) {
    format = 'jpeg';
    dims = jpegDimensions(bytes);
  } else if (isWebp(bytes)) {
    format = 'webp';
    dims = webpDimensions(bytes);
  }

  if (!format || !dims) return null;
  return {
    format,
    ext: ACCEPTED_EXT[format],
    mime: ACCEPTED_MIME[format],
    width: dims.width,
    height: dims.height,
  };
}

// Read + server-validate a single uploaded image File: enforces the size cap,
// sniffs the real format from header bytes (NOT the client Content-Type), and
// caps the longest edge. Returns the bytes + resolved mime/ext ready for an R2
// put, or a human-readable error. Shared by the listing image endpoints and the
// single-image admin flows (spare parts, announcement covers).
export interface PreparedUpload {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}
export async function prepareImageUpload(
  file: File,
): Promise<{ ok: true; data: PreparedUpload } | { ok: false; error: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `Image exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return { ok: false, error: 'Not a supported image (JPEG, PNG or WebP)' };
  }
  if (Math.max(sniffed.width, sniffed.height) > MAX_EDGE) {
    return {
      ok: false,
      error: `Image is ${sniffed.width}×${sniffed.height}px; longest edge must be ≤ ${MAX_EDGE}px`,
    };
  }
  return { ok: true, data: { bytes, mime: sniffed.mime, ext: sniffed.ext } };
}

const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

// ── PNG ─────────────────────────────────────────────────────────────────────
// Signature 89 50 4E 47 0D 0A 1A 0A; IHDR width/height are big-endian at 16/20.
function isPng(b: Uint8Array): boolean {
  return (
    b.length >= 24 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  );
}
function pngDimensions(b: Uint8Array): { width: number; height: number } | null {
  const view = dv(b);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// ── JPEG ────────────────────────────────────────────────────────────────────
// Starts FF D8; scan segments for a Start-Of-Frame marker (SOFn, excluding
// non-frame markers) and read height/width from it.
function isJpeg(b: Uint8Array): boolean {
  return b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
}
function jpegDimensions(b: Uint8Array): { width: number; height: number } | null {
  const view = dv(b);
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = b[offset + 1];
    // SOF0..SOF15 carry dimensions, except DHT(C4)/DAC(C8)/DRI etc.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // segment: FF marker, 2-byte length, 1-byte precision, 2-byte height, 2-byte width
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      return { width, height };
    }
    // Standalone markers (RSTn, SOI, EOI, TEM) have no length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segLen = view.getUint16(offset + 2);
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }
  return null;
}

// ── WebP ────────────────────────────────────────────────────────────────────
// RIFF container: "RIFF" .... "WEBP" then a VP8 / VP8L / VP8X chunk.
function isWebp(b: Uint8Array): boolean {
  return (
    b.length >= 16 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  );
}
function webpDimensions(b: Uint8Array): { width: number; height: number } | null {
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  const view = dv(b);

  if (fourcc === 'VP8 ') {
    // Lossy: dimensions in the VP8 bitstream after a 3-byte frame tag + start code.
    // Width/height are 14-bit little-endian at offset 26 / 28.
    if (b.length < 30) return null;
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height };
  }
  if (fourcc === 'VP8L') {
    // Lossless: 1-byte signature (0x2f) at 20, then 14+14 bits packed LE at 21.
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (fourcc === 'VP8X') {
    // Extended: canvas size is 24-bit LE (value+1) at offset 24 (w) / 27 (h).
    if (b.length < 30) return null;
    const width = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const height = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}
