import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Run a shell command and return its trimmed output, or a fallback. */
function fromShell(command: string, fallback: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim() || fallback;
  } catch {
    // git not installed, not a repository, or no commit yet
    return fallback;
  }
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string };

// Build metadata shown in the footer: commit the bundle was built from + build date.
const gitSha = fromShell('git rev-parse --short HEAD', 'dev');
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  plugins: [react()],
  base: '/hetdedutchapp/',
  server: { port: 5173, open: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
});
