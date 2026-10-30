import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface ChatGPTStore {
  load: () => Promise<string | null>;
  save: (value: string) => Promise<void>;
  clear: () => Promise<void>;
  host: () => Promise<string>;
}
export function dpapi(value: string, decrypt = false): Promise<string> {
  if (process.platform !== 'win32')
    return Promise.reject(new Error('Windows secure storage is required.'));
  const method = decrypt ? 'Unprotect' : 'Protect';
  const script = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $o=[Security.Cryptography.ProtectedData]::${method}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($o))`;
  return new Promise((accept, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Secure storage timed out.'));
    }, 10000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.resume();
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('Secure storage is unavailable.'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) accept(output.trim());
      else reject(new Error('Secure storage is unavailable.'));
    });
    child.stdin.on('error', () => {
      /* reported by close */
    });
    child.stdin.end(value);
  });
}
export function createChatGPTStore(
  directory = resolve(process.env['TAVI_DATA_DIR'] ?? '.data'),
): ChatGPTStore {
  const file = resolve(directory, 'chatgpt.dpapi');
  return {
    async load() {
      try {
        return Buffer.from(await dpapi(await readFile(file, 'utf8'), true), 'base64').toString(
          'utf8',
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async save(value) {
      const encrypted = await dpapi(Buffer.from(value).toString('base64'));
      await mkdir(directory, { recursive: true });
      await writeFile(file + '.tmp', encrypted, { mode: 0o600 });
      await rename(file + '.tmp', file);
    },
    async clear() {
      await rm(file, { force: true });
    },
    async host() {
      const path = resolve(directory, 'chatgpt-host.json');
      try {
        const value: unknown = JSON.parse(await readFile(path, 'utf8'));
        if (typeof value === 'string' && /^urn:uuid:[\da-f-]{36}$/i.test(value)) return value;
        throw new Error('Invalid ChatGPT host registration.');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const { randomUUID } = await import('node:crypto');
        const value = 'urn:uuid:' + randomUUID();
        await mkdir(directory, { recursive: true });
        await writeFile(path, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
        return value;
      }
    },
  };
}
