export type ImageType = 'image/jpeg' | 'image/png';

export function sniffImageType(bytes: Buffer): ImageType | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Textual / dated PNG chunks that may carry a title, description or file name. */
const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

/**
 * JPEG: keeps the image data plus JFIF (APP0), ICC colour profiles (APP2) and Adobe (APP14);
 * drops EXIF/XMP (APP1), IPTC (APP13), every other APPn and comments, which can hold a title,
 * a description, keywords or the original file name.
 */
function stripJpeg(bytes: Buffer): Buffer | null {
  const parts: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] as number;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: the entropy-coded data and everything after it are image data.
      parts.push(bytes.subarray(offset));
      return Buffer.concat(parts);
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const iccProfile =
      marker === 0xe2 &&
      bytes.subarray(offset + 4, offset + 16).toString('latin1') === 'ICC_PROFILE\0';
    const keep = !(marker === 0xfe || (isApp && marker !== 0xe0 && marker !== 0xee && !iccProfile));
    if (keep) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return null;
}

function stripPng(bytes: Buffer): Buffer | null {
  const parts: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    if (!PNG_DROPPED.has(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return null;
}

/** Image bytes without textual metadata, or `null` when the file is not a well-formed JPEG/PNG. */
export function stripMetadata(bytes: Buffer): { bytes: Buffer; type: ImageType } | null {
  const type = sniffImageType(bytes);
  if (type === null) return null;
  const stripped = type === 'image/jpeg' ? stripJpeg(bytes) : stripPng(bytes);
  return stripped ? { bytes: stripped, type } : null;
}
