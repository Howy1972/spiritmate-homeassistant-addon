import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { runWorker } from './index';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SpiritMate MYOB Sync</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; line-height: 1.4; }
    .card { max-width: 680px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    section { margin: 16px 0; }
    button { cursor: pointer; }
    pre { background: #f7f7f7; padding: 8px; border-radius: 4px; overflow-x: auto; }
    .row { display: flex; gap: 8px; align-items: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>SpiritMate MYOB Sync</h1>

    <section>
      <h2 style="font-size:16px; margin:0 0 8px;">Upload Firebase service-account.json</h2>
      <form id="uploadForm">
        <div class="row">
          <input type="file" id="file" name="file" accept=".json" />
          <button type="submit">Upload</button>
        </div>
      </form>
      <div id="uploadResult" style="margin-top:8px;"></div>
    </section>

    <section>
      <h2 style="font-size:16px; margin:0 0 8px;">Status</h2>
      <div class="row">
        <button id="checkStatus">Check Status</button>
        <button id="runNow">Run Sync Now</button>
      </div>
      <pre id="statusOut" style="margin-top:8px; white-space:pre-wrap;"></pre>
    </section>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const uploadResult = document.getElementById('uploadResult');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      uploadResult.textContent = 'Uploading...';
      const fd = new FormData();
      const file = document.getElementById('file').files[0];
      if (!file) { uploadResult.textContent = 'Please choose a file.'; return; }
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload-service-account', { method: 'POST', body: fd });
        const json = await res.json();
        uploadResult.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        uploadResult.textContent = String(e);
      }
    });

    const statusBtn = document.getElementById('checkStatus');
    const runBtn = document.getElementById('runNow');
    const statusOut = document.getElementById('statusOut');

    statusBtn.addEventListener('click', async () => {
      statusOut.textContent = 'Checking...';
      try {
        const res = await fetch('/api/status');
        const json = await res.json();
        statusOut.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        statusOut.textContent = String(e);
      }
    });

    runBtn.addEventListener('click', async () => {
      statusOut.textContent = 'Running...';
      try {
        const res = await fetch('/api/run', { method: 'POST' });
        const json = await res.json();
        statusOut.textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        statusOut.textContent = String(e);
      }
    });
  </script>
</body>
</html>`);
});

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/upload-service-account', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const shareDir = '/share/spiritmate';
    if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir, { recursive: true });
    const dest = path.join(shareDir, 'service-account.json');
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


