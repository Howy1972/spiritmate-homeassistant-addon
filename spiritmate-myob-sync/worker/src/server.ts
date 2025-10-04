import express from 'express';
// multer types are optional in our build environment
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer');
import fs from 'fs';
import path from 'path';
import { runWorker } from './index';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
app.use(express.json());

app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SpiritMate MYOB Sync</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#0b0f14; --card:#121820; --text:#e6eef8; --muted:#9fb3c8; --brand:#16a34a; --accent:#0ea5e9; --danger:#ef4444; }
    *{ box-sizing:border-box; }
    body { margin:0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:var(--bg); color:var(--text); }
    .wrap { max-width: 880px; margin: 32px auto; padding: 0 16px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    h1 { font-size: 22px; margin:0; font-weight:600; }
    .grid { display:grid; grid-template-columns: 1fr; gap: 16px; }
    .card { background:var(--card); border:1px solid #1f2937; border-radius:12px; padding:16px; }
    .card h2 { margin:0 0 12px; font-size:16px; font-weight:600; }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    input[type=file]{ background:#0f141b; color:var(--muted); border:1px dashed #334155; padding:10px; border-radius:8px; }
    button{ background:var(--accent); color:#fff; border:none; border-radius:8px; padding:10px 14px; font-weight:600; cursor:pointer; }
    button.secondary{ background:#1f2937; }
    .pill{ display:inline-block; padding:4px 8px; border-radius:999px; font-size:12px; border:1px solid #334155; color:var(--muted); }
    .ok{ color:var(--brand); }
    .err{ color:var(--danger); }
    pre { background:#0f141b; padding:12px; border-radius:8px; border:1px solid #1f2937; overflow:auto; max-height:260px; }
    .spacer{ height:2px; background:#1f2937; margin:8px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>SpiritMate MYOB Sync</h1>
      <div>
        <span id="statusBadge" class="pill">Checking…</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Upload Firebase service-account.json</h2>
        <form id="uploadForm" class="row">
          <input type="file" id="file" name="file" accept="application/json,.json" />
          <button type="submit">Upload</button>
          <button id="verifyBtn" type="button" class="secondary">Verify</button>
        </form>
        <div id="uploadResult" style="margin-top:8px; min-height:20px;"></div>
        <div class="spacer"></div>
        <div class="row">
          <button id="runNow">Run Sync Now</button>
          <button id="checkStatus" class="secondary">Check Status</button>
        </div>
      </div>

      <div class="card">
        <h2>Logs</h2>
        <pre id="logOut"></pre>
      </div>
    </div>
  </div>

  <script>
    const uploadForm = document.getElementById('uploadForm');
    const statusBadge = document.getElementById('statusBadge');
    const uploadResult = document.getElementById('uploadResult');
    const logOut = document.getElementById('logOut');
    const checkStatus = document.getElementById('checkStatus');
    const runNow = document.getElementById('runNow');
    const verifyBtn = document.getElementById('verifyBtn');

    function setBadge(ok, text){
      statusBadge.className = 'pill ' + (ok ? 'ok' : 'err');
      statusBadge.textContent = text;
    }

    async function fetchStatus(){
      try {
        const res = await fetch('/api/status');
        const json = await res.json();
        setBadge(json.ok, json.ok ? 'Ready' : 'Not ready');
        logOut.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        setBadge(false, 'Unavailable');
      }
    }

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      uploadResult.textContent = 'Uploading…';
      const fd = new FormData();
      const file = document.getElementById('file').files[0];
      if (!file) { uploadResult.textContent = 'Please choose a JSON file.'; return; }
      try {
        const res = await fetch('/api/upload-service-account', { method: 'POST', body: fd.append('file', file) || fd });
        const json = await res.json();
        if(json.ok){ uploadResult.textContent = 'Uploaded: ' + json.path; setBadge(true, 'Ready'); }
        else { uploadResult.textContent = 'Upload failed: ' + (json.error || 'Unknown error'); setBadge(false, 'Error'); }
      } catch (e) {
        uploadResult.textContent = String(e);
        setBadge(false, 'Error');
      }
    });

    verifyBtn.addEventListener('click', async () => {
      const file = document.getElementById('file').files[0];
      if (!file) { uploadResult.textContent = 'Choose a JSON file first.'; return; }
      try {
        const text = await file.text();
        JSON.parse(text);
        uploadResult.textContent = 'JSON looks valid.';
      } catch (e) {
        uploadResult.textContent = 'Invalid JSON: ' + e.message;
      }
    });

    checkStatus.addEventListener('click', fetchStatus);

    runNow.addEventListener('click', async () => {
      logOut.textContent = 'Running…';
      try {
        const res = await fetch('/api/run', { method: 'POST' });
        const json = await res.json();
        logOut.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        logOut.textContent = String(e);
      }
    });

    fetchStatus();
  </script>
</body>
</html>`);
});

app.get('/api/status', (_req, res) => {
  const ready = fs.existsSync('/share/spiritmate/service-account.json');
  res.json({ ok: ready, time: new Date().toISOString(), hasCredentials: ready });
});

// Use any for req to avoid requiring @types/multer augmentation
app.post('/api/upload-service-account', upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const shareDir = '/share/spiritmate';
    if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir, { recursive: true });
    const dest = path.join(shareDir, 'service-account.json');
    // validate JSON
    try { JSON.parse(req.file.buffer.toString('utf-8')); } catch (e) { return res.status(400).json({ ok:false, error:'Invalid JSON: ' + e.message }); }
    fs.writeFileSync(dest, req.file.buffer);
    return res.json({ ok: true, path: dest });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/run', async (_req, res) => {
  try {
    const result = await runWorker();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const port = parseInt(process.env.PORT || '8099', 10);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Ingress server listening on ${port}`);
});


