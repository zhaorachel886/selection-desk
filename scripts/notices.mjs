import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run with npm run notices');
const directories = execFileSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' }).trim().split(/\r?\n/).slice(1);
const entries = new Map();
for (const directory of directories) {
  const file = join(directory, 'package.json');
  if (!existsSync(file)) continue;
  const item = JSON.parse(readFileSync(file, 'utf8'));
  entries.set(`${item.name}@${item.version}`, { name: item.name, version: item.version, license: typeof item.license === 'string' ? item.license : JSON.stringify(item.license) || 'UNKNOWN', url: typeof item.repository === 'string' ? item.repository : item.repository?.url || item.homepage || '' });
}
const rows = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
const text = '# Third-party runtime dependencies\n\nGenerated from the installed lockfile dependency tree. Licenses and copyright notices shipped in dependencies remain applicable. Electron includes its own LICENSE and LICENSES.chromium.html in the application distribution. This inventory is not a legal opinion.\n\n| Package | Version | Declared license | Source |\n| --- | --- | --- | --- |\n' + rows.map(item => `| ${item.name} | ${item.version} | ${item.license} | ${item.url.replace(/\|/g, '%7C')} |`).join('\n') + '\n';
writeFileSync('THIRD_PARTY_NOTICES.md', text);
console.log(JSON.stringify({ runtimePackages: rows.length, unknownLicenses: rows.filter(x => x.license === 'UNKNOWN').map(x => x.name), declaredLicenses: [...new Set(rows.map(x => x.license))] }, null, 2));
