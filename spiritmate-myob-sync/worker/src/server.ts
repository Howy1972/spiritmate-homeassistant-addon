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
  <style>
    :root { --bg:#0a0e14; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --brand:#10b981; --accent:#3b82f6; --danger:#ef4444; --warn:#f59e0b; }
    *{ box-sizing:border-box; margin:0; padding:0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }
    .container { max-width: 960px; margin: 0 auto; padding: 24px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #1f2937; }
    h1 { font-size: 24px; font-weight:700; }
    .badge { padding:6px 12px; border-radius:999px; font-size:13px; font-weight:600; }
    .badge.ready { background:#10b98120; color:var(--brand); border:1px solid var(--brand); }
    .badge.error { background:#ef444420; color:var(--danger); border:1px solid var(--danger); }
    .badge.pending { background:#f59e0b20; color:var(--warn); border:1px solid var(--warn); }
    .grid { display:grid; gap:16px; }
    .card { background:var(--card); border:1px solid #1f2937; border-radius:12px; padding:20px; }
    .card h2 { font-size:18px; margin-bottom:16px; font-weight:600; }
    .form-group { margin-bottom:16px; }
    .form-group label { display:block; margin-bottom:6px; font-size:14px; font-weight:500; color:var(--muted); }
    input[type=file], input[type=text], select { width:100%; background:#0f1419; color:var(--text); border:1px solid #374151; padding:10px 12px; border-radius:8px; font-size:14px; }
    input[type=file]:focus, input[type=text]:focus, select:focus { outline:none; border-color:var(--accent); }
    .btn-group { display:flex; gap:8px; flex-wrap:wrap; }
    button { background:var(--accent); color:#fff; border:none; border-radius:8px; padding:10px 16px; font-weight:600; cursor:pointer; font-size:14px; transition:opacity 0.2s; }
    button:hover:not(:disabled) { opacity:0.9; }
    button:disabled { opacity:0.5; cursor:not-allowed; }
    button.secondary { background:#374151; }
    button.danger { background:var(--danger); }
    button.success { background:var(--brand); }
    .alert { padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:14px; }
    .alert.success { background:#10b98120; color:var(--brand); border:1px solid var(--brand); }
    .alert.error { background:#ef444420; color:var(--danger); border:1px solid var(--danger); }
    .alert.info { background:#3b82f620; color:var(--accent); border:1px solid var(--accent); }
    pre { background:#0f1419; padding:12px; border-radius:8px; border:1px solid #1f2937; overflow:auto; max-height:300px; font-size:13px; }
    .info-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1f2937; }
    .info-row:last-child { border:none; }
    .info-label { color:var(--muted); font-size:14px; }
    .info-value { font-weight:600; font-size:14px; }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid #ffffff40; border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SpiritMate MYOB Sync</h1>
      <span id="statusBadge" class="badge pending">Checking…</span>
    </div>

    <div id="alertBox"></div>

    <div class="grid">
      <div class="card">
        <h2>System Status</h2>
        <div class="info-row">
          <span class="info-label">Credentials</span>
          <span class="info-value" id="credStatus">—</span>
        </div>
        <div class="info-row">
          <span class="info-label">Last Check</span>
          <span class="info-value" id="lastCheck">—</span>
        </div>
        <div class="btn-group" style="margin-top:16px;">
          <button id="refreshBtn" class="secondary">Refresh Status</button>
        </div>
      </div>

      <div class="card">
        <h2>Upload Credentials</h2>
        <form id="uploadForm">
          <div class="form-group">
            <label>Firebase service-account.json</label>
            <input type="file" id="fileInput" accept=".json" />
          </div>
          <button type="submit" id="uploadBtn">Upload</button>
        </form>
      </div>

      <div class="card">
        <h2>Manual Sync</h2>
        <p style="color:var(--muted); font-size:14px; margin-bottom:16px;">Trigger a one-time sync now (ignores schedule).</p>
        <button id="runBtn" class="success">Run Sync Now</button>
      </div>

      <div class="card">
        <h2>Logs</h2>
        <pre id="logOutput">No logs yet. Click buttons above to see output.</pre>
      </div>
    </div>
  </div>

  <script>
    const statusBadge = document.getElementById('statusBadge');
    const credStatus = document.getElementById('credStatus');
    const lastCheck = document.getElementById('lastCheck');
    const alertBox = document.getElementById('alertBox');
    const logOutput = document.getElementById('logOutput');
    const uploadForm = document.getElementById('uploadForm');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const runBtn = document.getElementById('runBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    function showAlert(type, message) {
      alertBox.innerHTML = '<div class="alert ' + type + '">' + message + '</div>';
      setTimeout(() => { alertBox.innerHTML = ''; }, 5000);
    }

    function log(text) {
      logOutput.textContent = text;
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        if (data.hasCredentials) {
          statusBadge.className = 'badge ready';
          statusBadge.textContent = 'Ready';
          credStatus.textContent = 'Configured ✓';
        } else {
          statusBadge.className = 'badge error';
          statusBadge.textContent = 'Not Ready';
          credStatus.textContent = 'Missing';
        }
        
        lastCheck.textContent = new Date(data.time).toLocaleTimeString();
        log(JSON.stringify(data, null, 2));
      } catch (e) {
        statusBadge.className = 'badge error';
        statusBadge.textContent = 'Error';
        credStatus.textContent = 'Unknown';
        log('Error: ' + e.message);
      }
    }

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!fileInput.files || !fileInput.files[0]) {
        showAlert('error', 'Please select a file');
        return;
      }

      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="spinner"></span> Uploading…';
      
      try {
        const fd = new FormData(uploadForm);
        
        const res = await fetch('/api/upload-service-account', { method: 'POST', body: fd });
        const data = await res.json();
        
        if (data.ok) {
          showAlert('success', 'Credentials uploaded successfully');
          log('Upload success: ' + data.path);
          await checkStatus();
          fileInput.value = '';
        } else {
          showAlert('error', 'Upload failed: ' + (data.error || 'Unknown error'));
          log('Upload error: ' + JSON.stringify(data, null, 2));
        }
      } catch (e) {
        showAlert('error', 'Upload failed: ' + e.message);
        log('Upload exception: ' + e.message);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
      }
    });

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> Running…';
      log('Starting sync…');
      
      try {
        const res = await fetch('/api/run', { method: 'POST' });
        const data = await res.json();
        
        if (data.ok) {
          showAlert('success', 'Sync completed: ' + data.result.invoices + ' invoices, ' + data.result.products + ' products updated');
          log(JSON.stringify(data, null, 2));
        } else {
          showAlert('error', 'Sync failed: ' + (data.error || 'Unknown error'));
          log(JSON.stringify(data, null, 2));
        }
      } catch (e) {
        showAlert('error', 'Sync failed: ' + e.message);
        log('Sync exception: ' + e.message);
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Sync Now';
      }
    });

    refreshBtn.addEventListener('click', checkStatus);

    // Auto-refresh status every 10s
    checkStatus();
    setInterval(checkStatus, 10000);
  </script>
</body>
</html>`);
});

app.get('/api/status', (_req, res) => {
  const ready = fs.existsSync('/share/spiritmate/service-account.json');
  res.json({ ok: ready, time: new Date().toISOString(), hasCredentials: ready });
});

app.post('/api/upload-service-account', upload.single('file'), async (req: any, res) => {
  try {
    console.log('[upload] Request received');
    console.log('[upload] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[upload] File present:', !!req.file);
    
    if (!req.file) {
      console.error('[upload] No file in request');
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }
    
    console.log('[upload] File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer.length
    });
    
    const shareDir = '/share/spiritmate';
    if (!fs.existsSync(shareDir)) {
      console.log('[upload] Creating directory:', shareDir);
      fs.mkdirSync(shareDir, { recursive: true });
    }
    
    const dest = path.join(shareDir, 'service-account.json');
    console.log('[upload] Writing to:', dest);
    
    // Write raw buffer directly - no validation (Firebase SDK will validate)
    fs.writeFileSync(dest, req.file.buffer);
    
    console.log('[upload] File written successfully');
    console.log('[upload] File exists:', fs.existsSync(dest));
    console.log('[upload] File size on disk:', fs.statSync(dest).size);
    
    return res.json({ ok: true, path: dest });
  } catch (e) {
    console.error('[upload] Error:', e);
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