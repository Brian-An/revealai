import { deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

export function png(metadata = ""): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(80, 0);
  header.writeUInt32BE(80, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Buffer.alloc(80 * (80 * 3 + 1), 190);
  for (let row = 0; row < 80; row++) rows[row * 241] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    ...(metadata ? [chunk("tEXt", Buffer.from(`Comment\0${metadata}`))] : []),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
