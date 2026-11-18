/* global console, process, Buffer */
// Production-like local runs: a minimal TLS terminator (like Caddy in front of the app) so the
// server can run with NODE_ENV=production and an https PUBLIC_ORIGIN. Adds X-Forwarded-For /
// X-Forwarded-Proto (run the app with TRUST_PROXY=true). Local testing only.
//   node scripts/e2e/tls-proxy.mjs <listenPort> <targetPort> <cert.pem> <key.pem>
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:https';
import { connect } from 'node:net';

const [listenPort, targetPort, certPath, keyPath] = process.argv.slice(2);
if (!listenPort || !targetPort || !certPath || !keyPath) {
  console.error('usage: tls-proxy.mjs <listenPort> <targetPort> <cert.pem> <key.pem>');
  process.exit(2);
}
const forwarded = (req) => ({
  ...req.headers,
  'x-forwarded-for': req.socket.remoteAddress ?? '127.0.0.1',
  'x-forwarded-proto': 'https',
});

const server = createServer(
  { cert: readFileSync(certPath), key: readFileSync(keyPath) },
  (req, res) => {
    const upstream = request(
      {
        host: '127.0.0.1',
        port: Number(targetPort),
        method: req.method,
        path: req.url,
        headers: forwarded(req),
      },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502).end();
    });
    req.pipe(upstream);
  },
);

// WebSocket upgrades (Socket.io): replay the request head, then splice the two sockets.
server.on('upgrade', (req, socket, head) => {
  const upstream = connect(Number(targetPort), '127.0.0.1', () => {
    const headers = forwarded(req);
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) {
      for (const item of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${item}`);
    }
    upstream.write(Buffer.from(`${lines.join('\r\n')}\r\n\r\n`));
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(Number(listenPort), '127.0.0.1', () => {
  console.info(`tls-proxy https://127.0.0.1:${listenPort} -> http://127.0.0.1:${targetPort}`);
});
