// picpop Dev-Server
// Dient statische Dateien + Git-API für das DevPanel GitHub-Tab
// Start: node server.js

const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.jsx':  'application/javascript; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
};

// ── Shell helper ──────────────────────────────────────────────────────────────
function sh(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// ── JSON response helper ──────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ── Parse request body ────────────────────────────────────────────────────────
function body(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

// ── Detect GitHub repo from remote ───────────────────────────────────────────
async function ghRepo() {
  try {
    const remote = await sh('git remote get-url origin');
    const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url      = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── API: git log ────────────────────────────────────────────────────────────
  if (pathname === '/api/git/log' && req.method === 'GET') {
    try {
      const SEP = '\x01';
      const log = await sh(`git log -25 --pretty=format:"%H${SEP}%s${SEP}%b${SEP}%ai"`);
      const dirty = (await sh('git status --porcelain').catch(() => '')).length > 0;
      const commits = log.split('\n').filter(Boolean).map(line => {
        const parts = line.split(SEP);
        return {
          hash:    (parts[0] || '').trim(),
          subject: (parts[1] || '').trim(),
          body:    (parts[2] || '').trim(),
          date:    (parts[3] || '').trim(),
        };
      }).filter(c => c.hash);
      json(res, { ok: true, commits, dirty });
    } catch (e) {
      json(res, { ok: false, error: e.message });
    }
    return;
  }

  // ── API: git push ───────────────────────────────────────────────────────────
  if (pathname === '/api/git/push' && req.method === 'POST') {
    const { message = '', notes = '' } = await body(req);
    try {
      const msg = (message.trim() || `Stand ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`).replace(/"/g, '\\"');
      const status = await sh('git status --porcelain').catch(() => '');
      let pushed = true;
      if (status.trim()) {
        await sh('git add -A');
        await sh(`git commit -m "${msg}"`);
        await sh('git push');
      } else {
        // Nichts zu committen — trotzdem push falls unpushed commits
        try { await sh('git push'); } catch { pushed = false; }
      }
      json(res, { ok: true, pushed });
    } catch (e) {
      json(res, { ok: false, error: e.message });
    }
    return;
  }

  // ── API: git restore ────────────────────────────────────────────────────────
  if (pathname === '/api/git/restore' && req.method === 'POST') {
    const { hash } = await body(req);
    if (!hash || !/^[a-f0-9]{4,40}$/.test(hash)) {
      json(res, { ok: false, error: 'Ungültiger Commit-Hash' }); return;
    }
    try {
      await sh(`git checkout ${hash} -- .`);
      await sh('git add -A');
      await sh(`git commit -m "Wiederhergestellt von ${hash.slice(0,7)}"`);
      await sh('git push --force');
      json(res, { ok: true });
    } catch (e) {
      json(res, { ok: false, error: e.message });
    }
    return;
  }

  // ── API: Firebase Hosting deploy ────────────────────────────────────────────
  if (pathname === '/api/deploy' && req.method === 'POST') {
    try {
      const output = await new Promise((resolve, reject) => {
        exec('firebase deploy --only hosting', { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
          const out = (stdout + '\n' + stderr).trim();
          if (err) reject(new Error(out || err.message));
          else resolve(out);
        });
      });
      json(res, { ok: true, output });
    } catch (e) {
      json(res, { ok: false, error: e.message });
    }
    return;
  }

  // ── API: GitHub Actions Status ──────────────────────────────────────────────
  if (pathname === '/api/git/actions-status' && req.method === 'GET') {
    try {
      const repo = await ghRepo();
      if (!repo) { json(res, { ok: false, error: 'gh nicht gefunden' }); return; }
      const out = await sh(`gh run list --repo ${repo} --limit 1 --json status,conclusion,url,createdAt`);
      const runs = JSON.parse(out || '[]');
      if (!runs.length) { json(res, { ok: true, run: null }); return; }
      const r = runs[0];
      json(res, { ok: true, run: { status: r.status, conclusion: r.conclusion, url: r.url, createdAt: r.createdAt } });
    } catch (e) {
      json(res, { ok: false, error: e.message });
    }
    return;
  }

  // ── Static files ────────────────────────────────────────────────────────────
  let filePath = path.normalize(path.join(ROOT, pathname === '/' ? 'index.html' : pathname));

  // Sicherheit: kein Directory Traversal
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext         = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.jsx' ? 'no-cache' : 'public, max-age=0',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch {
    // SPA-Fallback: immer index.html
    try {
      const index = fs.readFileSync(path.join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(index);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log('\n🚀  picpop Dev-Server\n');
  console.log(`    Lokal:   http://localhost:${PORT}`);
  console.log('    Git-API: aktiv — DevPanel → GitHub-Tab nutzen\n');
});
