import { describe, expect, it } from 'vitest';
import { sniffImageType, stripMetadata } from '../../server/images/metadata';
import { jpegWithMetadata, pngWithMetadata } from './fixtures';

describe('stripMetadata', () => {
  it('removes EXIF, XMP, IPTC and comments from JPEG, keeping JFIF, ICC and the scan', () => {
    const input = jpegWithMetadata();
    const result = stripMetadata(input)!;
    expect(result.type).toBe('image/jpeg');
    const text = result.bytes.toString('latin1');
    expect(text).not.toContain('Panthera');
    expect(text).not.toContain('Exif');
    expect(text).not.toContain('Photoshop');
    expect(text).toContain('JFIF');
    expect(text).toContain('ICC_PROFILE');
    expect(result.bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(result.bytes.subarray(-7)).toEqual(
      Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]),
    );
    expect(result.bytes.length).toBeLessThan(input.length);
  });

  it('removes text, EXIF and time chunks from PNG', () => {
    const result = stripMetadata(pngWithMetadata())!;
    expect(result.type).toBe('image/png');
    const text = result.bytes.toString('latin1');
    for (const gone of ['Panthera', 'tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']) {
      expect(text).not.toContain(gone);
    }
    for (const kept of ['IHDR', 'IDAT', 'IEND']) expect(text).toContain(kept);
  });

  it('refuses anything that is not a well-formed JPEG or PNG', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(stripMetadata(Buffer.from('GIF89a........'))).toBeNull();
    expect(stripMetadata(Buffer.from('<html>'))).toBeNull();
    const jpeg = jpegWithMetadata();
    expect(stripMetadata(jpeg.subarray(0, 30))).toBeNull();
    const broken = Buffer.from(jpeg);
    broken[2 + 18] = 0x00; // the byte after JFIF should be a marker
    expect(stripMetadata(broken)).toBeNull();
    const badLength = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01]),
      Buffer.alloc(8),
    ]);
    expect(stripMetadata(badLength)).toBeNull();
    expect(stripMetadata(pngWithMetadata().subarray(0, 40))).toBeNull();
  });
});
