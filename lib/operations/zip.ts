import "server-only";
// Stored ZIP (no compression). Bounded before building; portable UTF-8 names.
const table = Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function storedZip(files: { name: string; bytes: Uint8Array }[]) {
  if (
    files.length > 202 ||
    files.reduce((n, f) => n + f.bytes.length, 0) > 55 * 1024 * 1024
  )
    throw new Error("Archive exceeds limit");
  const parts: Buffer[] = [],
    directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(file.name) ||
      file.name.includes("..") ||
      file.name.startsWith("/")
    )
      throw new Error("Unsafe archive path");
    const name = Buffer.from(file.name),
      bytes = Buffer.from(file.bytes),
      crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    parts.push(local, name, bytes);
    directory.push(central, name);
    offset += local.length + name.length + bytes.length;
  }
  const index = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, index, end]);
}
