import express from 'express';
import fs from 'fs';
import { runWorker } from './index';

const app = express();
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
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #1f2937; }
    h1 { font-size: 28px; font-weight:700; }
    .badge { padding:8px 16px; border-radius:999px; font-size:14px; font-weight:600; }
    .badge.ready { background:#10b98120; color:var(--brand); border:1px solid var(--brand); }
    .badge.error { background:#ef444420; color:var(--danger); border:1px solid var(--danger); }
    .badge.pending { background:#f59e0b20; color:var(--warn); border:1px solid var(--warn); }
    .grid { display:grid; gap:20px; }
    .card { background:var(--card); border:1px solid #1f2937; border-radius:12px; padding:24px; }
    .card h2 { font-size:20px; margin-bottom:12px; font-weight:600; }
    .card p { color:var(--muted); font-size:14px; margin-bottom:16px; line-height:1.5; }
    .info-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #1f2937; }
    .info-row:last-child { border:none; }
    .info-label { color:var(--muted); font-size:14px; }
    .info-value { font-weight:600; font-size:14px; }
    button { background:var(--accent); color:#fff; border:none; border-radius:8px; padding:12px 20px; font-weight:600; cursor:pointer; font-size:15px; transition:all 0.2s; width:100%; }
    button:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
    button:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
    button.secondary { background:#374151; }
    button.success { background:var(--brand); }
    button.danger { background:var(--danger); }
    .alert { padding:14px 18px; border-radius:8px; margin-bottom:20px; font-size:14px; font-weight:500; }
    .alert.success { background:#10b98120; color:var(--brand); border:1px solid var(--brand); }
    .alert.error { background:#ef444420; color:var(--danger); border:1px solid var(--danger); }
    .alert.info { background:#3b82f620; color:var(--accent); border:1px solid var(--accent); }
    pre { background:#0f1419; padding:16px; border-radius:8px; border:1px solid #1f2937; overflow:auto; max-height:400px; font-size:13px; line-height:1.5; }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:8px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
    .stat { background:#0f1419; padding:16px; border-radius:8px; border:1px solid #1f2937; text-align:center; }
    .stat-value { font-size:24px; font-weight:700; color:var(--brand); }
    .stat-label { font-size:12px; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:0.5px; }
    code { background:#0f1419; padding:2px 6px; border-radius:4px; font-size:13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍸 SpiritMate MYOB Sync</h1>
      <span id="statusBadge" class="badge pending">Checking…</span>
    </div>

    <div id="alertBox"></div>

    <div class="grid">
      <div class="card">
        <h2>📊 System Status</h2>
        <div class="info-row">
          <span class="info-label">Firebase Credentials</span>
          <span id="credStatus" class="info-value">Checking…</span>
        </div>
        <div class="info-row">
          <span class="info-label">Last Status Check</span>
          <span id="lastCheck" class="info-value">—</span>
        </div>
        <div class="info-row">
          <span class="info-label">Credential File Path</span>
          <span class="info-value" style="font-size:12px; color:var(--muted);">/share/spiritmate/service-account.json</span>
        </div>
        <button id="refreshBtn" class="secondary" style="margin-top:20px;">🔄 Refresh Status</button>
      </div>

      <div class="card">
        <h2>▶️ Manual Sync</h2>
        <p>Trigger a one-time sync operation now. This will fetch emails, parse invoices, and update Firestore (ignores schedule).</p>
        <button id="runBtn" class="success">▶️ Run Sync Now</button>
        <div id="syncStats" class="stat-grid" style="display:none;">
          <div class="stat">
            <div id="emailsProcessed" class="stat-value">0</div>
            <div class="stat-label">Emails Processed</div>
          </div>
          <div class="stat">
            <div id="lastSyncTime" class="stat-value">—</div>
            <div class="stat-label">Last Sync</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>📋 Activity Log</h2>
        <pre id="logOutput">Ready. Click "Run Sync Now" to start processing emails.</pre>
      </div>

      <div class="card">
        <h2>ℹ️ Quick Help</h2>
        <p style="margin-bottom:8px;"><strong>Credentials Setup:</strong> Upload your Firebase service-account.json via Samba to <code>/share/spiritmate/</code></p>
        <p style="margin-bottom:8px;"><strong>Schedule:</strong> Configure sync schedule in the add-on Configuration tab (cron format: <code>0 2 * * *</code> = daily at 2am)</p>
        <p><strong>Manual Sync:</strong> Use the button above to run immediately, regardless of schedule settings</p>
      </div>
    </div>
  </div>

  <script>
    const statusBadge = document.getElementById('statusBadge');
    const credStatus = document.getElementById('credStatus');
    const lastCheck = document.getElementById('lastCheck');
    const alertBox = document.getElementById('alertBox');
    const logOutput = document.getElementById('logOutput');
    const runBtn = document.getElementById('runBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const syncStats = document.getElementById('syncStats');
    const emailsProcessed = document.getElementById('emailsProcessed');
    const lastSyncTime = document.getElementById('lastSyncTime');

    function showAlert(type, message) {
      alertBox.innerHTML = '<div class="alert ' + type + '">' + message + '</div>';
      setTimeout(() => { alertBox.innerHTML = ''; }, 8000);
    }

    function log(text) {
      const timestamp = new Date().toLocaleTimeString();
      logOutput.textContent = '[' + timestamp + '] ' + text;
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        lastCheck.textContent = new Date().toLocaleTimeString();
        
        if (data.hasCredentials) {
          statusBadge.className = 'badge ready';
          statusBadge.textContent = '✓ Ready';
          credStatus.textContent = '✓ Configured';
          credStatus.style.color = 'var(--brand)';
        } else {
          statusBadge.className = 'badge error';
          statusBadge.textContent = '✗ Not Ready';
          credStatus.textContent = '✗ Missing';
          credStatus.style.color = 'var(--danger)';
        }
      } catch (e) {
        statusBadge.className = 'badge error';
        statusBadge.textContent = '✗ Error';
        credStatus.textContent = 'Error checking';
        log('Status check failed: ' + e.message);
      }
    }

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span>Running sync…';
      log('Starting MYOB sync operation…');
      
      try {
        const res = await fetch('/api/run', { method: 'POST' });
        const data = await res.json();
        
        if (data.ok && data.result) {
          showAlert('success', '✓ Sync completed successfully!');
          log('Sync completed: ' + JSON.stringify(data.result, null, 2));
          
          // Show stats if available
          if (data.result.emailsProcessed !== undefined) {
            syncStats.style.display = 'grid';
            emailsProcessed.textContent = data.result.emailsProcessed || 0;
            lastSyncTime.textContent = new Date().toLocaleTimeString();
          }
        } else {
          showAlert('error', '✗ Sync failed: ' + (data.error || 'Unknown error'));
          log('Sync error: ' + JSON.stringify(data, null, 2));
        }
      } catch (e) {
        showAlert('error', '✗ Sync failed: ' + e.message);
        log('Sync exception: ' + e.message);
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = '▶️ Run Sync Now';
      }
    });

    refreshBtn.addEventListener('click', () => {
      log('Refreshing status…');
      checkStatus();
    });

    // Auto-refresh status every 15s
    checkStatus();
    setInterval(checkStatus, 15000);
  </script>
</body>
</html>`);
});

app.get('/api/status', (_req, res) => {
  const ready = fs.existsSync('/share/spiritmate/service-account.json');
  res.json({ ok: ready, time: new Date().toISOString(), hasCredentials: ready });
});

app.post('/api/run', async (_req, res) => {
  try {
    console.log('[api/run] Starting manual sync...');
    const result = await runWorker();
    console.log('[api/run] Sync completed:', result);
    res.json({ ok: true, result });
  } catch (e) {
    console.error('[api/run] Sync failed:', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const port = parseInt(process.env.PORT || '8099', 10);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Ingress UI listening on port ${port}`);
});