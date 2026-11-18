/** Minimal well-formed JPEG/PNG files carrying the kind of metadata the proxy must remove. */
function segment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

export function jpegWithMetadata(secret = 'Panthera_leo_secret.jpg'): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x02\0\0\x01\0\x01\0\0', 'latin1')),
    segment(0xe1, Buffer.from(`Exif\0\0${secret}`, 'latin1')),
    segment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x:title>${secret}</x:title>`)),
    segment(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01colour', 'latin1')),
    segment(0xed, Buffer.from(`Photoshop 3.0\0${secret}`, 'latin1')),
    segment(0xfe, Buffer.from(`comment ${secret}`)),
    segment(0xdb, Buffer.alloc(65, 1)),
    Buffer.from([0xff, 0xff]),
    segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}

export function pngWithMetadata(secret = 'Panthera_leo_secret.png'): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.alloc(13, 1)),
    chunk('tEXt', Buffer.from(`Title\0${secret}`, 'latin1')),
    chunk('iTXt', Buffer.from(`Description\0\0\0\0\0${secret}`, 'latin1')),
    chunk('zTXt', Buffer.from(`Comment\0\0${secret}`, 'latin1')),
    chunk('eXIf', Buffer.from(secret)),
    chunk('tIME', Buffer.alloc(7)),
    chunk('IDAT', Buffer.from([1, 2, 3, 4])),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const THUMB_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/960px-Lion_waiting_in_Namibia.jpg';
export const ORIGINAL_URL =
  'https://upload.wikimedia.org/wikipedia/commons/a/ab/Small_ammonite.png';
