import { readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'docs/api.md', 'docs/releasing.md', '.github/pull_request_template.md'];
const errors = []; let links = 0;
for (const file of files) {
  const source = (await readFile(resolve(root, file), 'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const match of source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1]; if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) continue;
    const target = resolve(root, dirname(file), decodeURIComponent(href.split(/[?#]/, 1)[0]));
    const rel = relative(root, target);
    if (rel === '..' || rel.startsWith(`..${sep}`)) { errors.push(`${file}: link escapes repository: ${href}`); continue; }
    try { await access(target); links++; } catch { errors.push(`${file}: missing local link: ${href}`); }
  }
}
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (pkg.license !== 'MIT') errors.push('Preserve the existing MIT license.');
if (Object.keys(pkg.dependencies ?? {}).length) errors.push('Runtime dependency additions need an explicit design review.');
for (const file of ['LICENSE', '.nvmrc', '.github/CODEOWNERS', '.github/ISSUE_TEMPLATE/config.yml', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml']) await access(resolve(root, file));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Contributor docs: ${files.length} guides and ${links} local links checked.`);
