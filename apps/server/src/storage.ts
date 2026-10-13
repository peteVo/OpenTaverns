import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// ponytail: synchronous snapshots suit one friend-game server; use a database if write latency becomes material.
export class TableStore<T extends { code: string }> {
  readonly adminKey: string;
  private readonly lock: string;
  constructor(readonly directory: string, adminKey?: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.lock = join(directory, 'server.lock');
    if (existsSync(this.lock)) {
      const pid = Number(readFileSync(this.lock, 'utf8'));
      if (!Number.isInteger(pid) || pid <= 0) throw Error('Invalid data-directory lock. Inspect server.lock before removing it.');
      try { process.kill(pid, 0); throw Error('Another server is using this data directory.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      unlinkSync(this.lock);
    }
    writeFileSync(this.lock, String(process.pid), { flag: 'wx', mode: 0o600 });
    const keyPath = join(directory, 'admin-key');
    this.adminKey = adminKey || (existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : randomBytes(32).toString('base64url'));
    if (this.adminKey.length < 32 || this.adminKey.length > 200) { this.close(); throw Error('OPENTAVERNS_ADMIN_KEY must have 32–200 characters.'); }
    if (!adminKey && !existsSync(keyPath)) this.atomicWrite(keyPath, this.adminKey);
  }
  private path(code: string) { if (!/^[A-Z0-9]{6}$/.test(code)) throw Error('Invalid table storage code.'); return join(this.directory, `${code}.json`); }
  private atomicWrite(path: string, data: string) {
    const temp = `${path}.tmp`;
    const fd = openSync(temp, 'w', 0o600);
    try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, path);
  }
  load(): T[] {
    return readdirSync(this.directory).filter(name => /^[A-Z0-9]{6}\.json$/.test(name)).map(name => {
      const file = JSON.parse(readFileSync(join(this.directory, name), 'utf8')) as { version: number; table: T };
      if (file.version !== 1 || file.table?.code !== name.slice(0, 6)) throw Error(`Unsupported or damaged table snapshot: ${name}`);
      return file.table;
    });
  }
  save(table: T) { this.atomicWrite(this.path(table.code), JSON.stringify({ version: 1, table })); }
  delete(code: string) { unlinkSync(this.path(code)); }
  close() { if (existsSync(this.lock) && readFileSync(this.lock, 'utf8') === String(process.pid)) unlinkSync(this.lock); }
}
