/**
 * Development CGI proxy server
 * Handles CGI requests during development by executing the Python script
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function cgiProxy() {
  return {
    name: 'cgi-proxy',
    configureServer(server) {
      server.middlewares.use('/ncplot7py/scripts/cgiserver.cgi', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          const cgiPath = join(__dirname, 'ncplot7py', 'scripts', 'cgiserver.cgi');
          
          const env = {
            ...process.env,
            REQUEST_METHOD: 'POST',
            CONTENT_LENGTH: body.length.toString(),
            CONTENT_TYPE: 'application/json',
            REMOTE_ADDR: req.socket.remoteAddress || '127.0.0.1',
          };

          const python = spawn('python3', [cgiPath], {
            env,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          python.stdin.write(body);
          python.stdin.end();

          let output = '';
          let error = '';

          python.stdout.on('data', (data) => {
            output += data.toString();
          });

          python.stderr.on('data', (data) => {
            error += data.toString();
          });

          python.on('close', (code) => {
            if (code !== 0) {
              console.error('CGI Error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Internal server error', details: error }));
              return;
            }

            // Parse CGI output (headers + body)
            const headerEndIndex = output.indexOf('\n\n');
            if (headerEndIndex === -1) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid CGI output' }));
              return;
            }

            const headers = output.substring(0, headerEndIndex);
            const responseBody = output.substring(headerEndIndex + 2);

            // Parse headers
            const headerLines = headers.split('\n');
            const parsedHeaders = {};
            headerLines.forEach(line => {
              const colonIndex = line.indexOf(':');
              if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                parsedHeaders[key] = value;
              }
            });

            res.writeHead(200, parsedHeaders);
            res.end(responseBody);
          });
        });
      });
    }
  };
}
