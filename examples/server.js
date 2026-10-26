import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 5175);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const asset = pathname === '/' ? '/examples/basic/index.html' : pathname;
    if (!/^\/(?:src\/[a-z-]+\.js|examples\/basic\/[a-z.-]+\.(?:js|html|css))$/.test(asset)) { response.writeHead(404).end(); return; }
    const file = resolve(root, `.${asset}`);
    if (!file.startsWith(resolve(root) + sep)) { response.writeHead(404).end(); return; }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[file.slice(file.lastIndexOf('.'))], 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch { response.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Transition demo: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.closeAllConnections(); server.close(); });
