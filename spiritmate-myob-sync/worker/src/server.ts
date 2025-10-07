import express from 'express';
import fs from 'fs';
import { runWorker } from './index';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);
const app = express();

// Trust proxy headers from Home Assistant ingress
app.set('trust proxy', true);

// Log all requests for debugging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpiritMate MYOB Sync</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0e14 0%, #1a1f2e 100%); color: #e5e7eb; line-height: 1.6; min-height: 100vh; padding: 20px; }
    .container { max-width: 1100px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #c9a96e 0%, #b8956a 100%); padding: 22px 24px; border-radius: 14px; margin-bottom: 18px; box-shadow: 0 10px 40px rgba(201,169,110,.28); color: #1a1f2e; }
    .header h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
    .header p { color: #2d3748; opacity: .9; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 16px 0 18px; }
    .card { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 16px; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #9ca3af; margin-bottom: 6px; }
    .value { font-size: 18px; font-weight: 700; color: #c9a96e; }
    .row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #374151; background: #111827; color: #e5e7eb; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
    .btn-primary { background: #c9a96e; color: #1a1f2e; border-color: #b8956a; font-weight: 700; }
    pre { background: #0b1220; border: 1px solid #223; border-radius: 12px; padding: 14px; overflow: auto; max-height: 420px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SpiritMate MYOB Sync</h1>
      <p>Headless worker running on a fixed interval. View status and logs below.</p>
    </div>

    <div class="cards">
      <div class="card"><div class="label">Loop interval</div><div id="interval" class="value">...</div></div>
      <div class="card"><div class="label">Last run start</div><div id="lastStart" class="value">...</div></div>
      <div class="card"><div class="label">Last run end</div><div id="lastEnd" class="value">...</div></div>
      <div class="card"><div class="label">Last exit code</div><div id="lastCode" class="value">...</div></div>
      <div class="card"><div class="label">Credentials</div><div id="creds" class="value">...</div></div>
    </div>

    <div class="row">
      <button id="runBtn" class="btn btn-primary">Run Sync Now</button>
      <button id="refreshBtn" class="btn">Refresh</button>
    </div>

    <h3 style="margin:16px 0 8px">Recent log</h3>
    <pre id="log"></pre>
  </div>

  <script>
    async function loadStatus() {
      const s = await fetch('api/status').then(r => r.json());
      if (!s.ok) return;
      document.getElementById('interval').textContent = (s.loopInterval || 60) + 's';
      document.getElementById('lastStart').textContent = s.lastRun?.startedAt || '—';
      document.getElementById('lastEnd').textContent = s.lastRun?.completedAt || '—';
      document.getElementById('lastCode').textContent = (s.lastRun?.exitCode ?? '—');
      document.getElementById('creds').textContent = s.hasCredentials ? '✓ Present' : 'Missing';
    }
    async function loadLogs() {
      const t = await fetch('api/logs').then(r => r.text());
      document.getElementById('log').textContent = t;
    }
    async function runNow() {
      document.getElementById('runBtn').disabled = true;
      try { await fetch('api/run', { method: 'POST' }); } finally { document.getElementById('runBtn').disabled = false; }
      setTimeout(() => { loadStatus(); loadLogs(); }, 1000);
    }
    document.getElementById('runBtn').addEventListener('click', runNow);
    document.getElementById('refreshBtn').addEventListener('click', () => { loadStatus(); loadLogs(); });
    loadStatus();
    loadLogs();
  </script>
</body>
</html>`);
});

// API: Check system status
app.get('/api/status', (_req, res) => {
  try {
    let hasCredentials = false;
    try { const stats = fs.statSync('/share/spiritmate/service-account.json'); hasCredentials = stats.isFile() && stats.size > 0; } catch { hasCredentials = false; }

    // Extract last run info from /tmp/cron.log
    let lastRun: { startedAt?: string; completedAt?: string; exitCode?: number } = {};
    try {
      const log = fs.readFileSync('/tmp/cron.log', 'utf-8');
      const lines = log.trim().split(/\r?\n/).slice(-200);
      const startLine = [...lines].reverse().find(l => l.includes('Loop STARTED'));
      const endLine = [...lines].reverse().find(l => l.includes('Loop COMPLETED'));
      if (startLine) lastRun.startedAt = startLine.replace(/.*?(\d{4}-\d{2}-\d{2}[^-]+) - .*/, '$1');
      if (endLine) {
        lastRun.completedAt = endLine.replace(/.*?(\d{4}-\d{2}-\d{2}[^-]+) - .*/, '$1');
        const m = endLine.match(/exit code (\d+)/); if (m) lastRun.exitCode = parseInt(m[1], 10);
      }
    } catch {}

    const response = {
      ok: true,
      hasCredentials,
      loopInterval: process.env.LOOP_INTERVAL ? parseInt(process.env.LOOP_INTERVAL, 10) : 60,
      lastRun,
      time: new Date().toISOString()
    } as any;

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(response));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// API: Run manual sync
app.post('/api/run', async (_req, res) => {
  try {
    console.log('[API] Manual sync triggered');
    const result = await runWorker();
    console.log('[API] Sync completed:', JSON.stringify(result));
    res.json({ ok: true, result });
  } catch (error) {
    console.error('[API] Sync failed:', error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// API: Save schedule configuration
app.post('/api/schedule', async (req, res) => {
  try {
    console.log('[API] Schedule config update:', req.body);
    const { enabled, startTime, endTime, interval, timezone: tz } = req.body;
    
    // Parse start/end times
    const startHour = parseInt(startTime.split(':')[0], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    
    // Generate cron expression based on interval and time window
    let cronExpression = '0 2 * * *'; // Default: 2 AM daily
    
    if (enabled && interval) {
      // Generate cron that respects time window
      if (interval < 60) {
        // Sub-hourly: use minute-based cron with hour restriction
        const minuteInterval = interval;
        const hourRange = startHour + '-' + (endHour - 1);
        cronExpression = '*/' + minuteInterval + ' ' + hourRange + ' * * *';
      } else {
        // Hourly or more: generate hour-based cron
        const hourInterval = Math.floor(interval / 60);
        const hours = [];
        for (let h = startHour; h <= endHour; h += hourInterval) {
          hours.push(h);
        }
        if (hours.length > 0) {
          cronExpression = '0 ' + hours.join(',') + ' * * *';
        } else {
          // Fallback if interval is too large
          cronExpression = '0 ' + startHour + ' * * *';
        }
      }
    }
    
    // Get current add-on options from environment
    const currentOptions = {
      imap_host: process.env.IMAP_HOST || '',
      imap_port: parseInt(process.env.IMAP_PORT || '993', 10),
      imap_user: process.env.IMAP_USER || '',
      imap_pass: process.env.IMAP_PASS || '',
      imap_mailbox: process.env.IMAP_MAILBOX || 'INBOX',
      from_exact: process.env.FROM_EXACT || '',
      subject_prefix: process.env.SUBJECT_PREFIX || '',
      label_processed: process.env.LABEL_PROCESSED || '',
      firestore_project_id: process.env.FIRESTORE_PROJECT_ID || '',
      schedule_enabled: enabled,
      schedule_cron: cronExpression,
      schedule_start_time: startTime,
      schedule_end_time: endTime,
      schedule_interval: interval,
      timezone: tz || process.env.TZ || 'UTC',
      log_level: process.env.LOG_LEVEL || 'info'
    };
    
    // Call Home Assistant Supervisor API to update add-on options
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    if (!supervisorToken) {
      throw new Error('SUPERVISOR_TOKEN not available');
    }
    
    const supervisorUrl = 'http://supervisor/addons/self/options';
    console.log('[API] Updating add-on config via Supervisor API...');
    console.log('[API] New schedule:', { enabled, cron: cronExpression });
    
    const response = await fetch(supervisorUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + supervisorToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ options: currentOptions })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Supervisor API error: ' + response.status + ' - ' + errorText);
    }
    
    const result = await response.json();
    console.log('[API] Supervisor API response:', result);
    
    // Send response first to ensure client receives it before restart
    res.json({ 
      ok: true, 
      message: 'Schedule saved! Add-on will restart to apply changes.',
      config: { enabled, startTime, endTime, interval, cron: cronExpression },
      needsRestart: true
    });
    
    // Trigger restart after a delay to ensure response is sent
    setTimeout(async () => {
      try {
        console.log('[API] Triggering add-on restart...');
        const restartUrl = 'http://supervisor/addons/self/restart';
        
        const restartResponse = await fetch(restartUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + supervisorToken,
            'Content-Type': 'application/json'
          }
        });
        
        if (!restartResponse.ok) {
          console.warn('[API] Restart request returned status:', restartResponse.status);
        } else {
          console.log('[API] Restart triggered successfully');
        }
      } catch (restartError) {
        console.warn('[API] Could not trigger restart:', restartError);
      }
    }, 500); // 500ms delay to ensure response is sent
  } catch (error) {
    console.error('[API] Schedule save failed:', error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// API: Diagnostic endpoint to check cron status
app.get('/api/diagnostics', async (_req, res) => {
  try {
    const { execSync } = require('child_process');
    
    const diagnostics: any = {
      environment: {
        SCHEDULE_ENABLED: process.env.SCHEDULE_ENABLED,
        SCHEDULE_CRON: process.env.SCHEDULE_CRON,
        SCHEDULE_START_TIME: process.env.SCHEDULE_START_TIME,
        SCHEDULE_END_TIME: process.env.SCHEDULE_END_TIME,
        SCHEDULE_INTERVAL: process.env.SCHEDULE_INTERVAL,
        TZ: process.env.TZ || 'Not set'
      },
      system: {
        currentTime: new Date().toISOString(),
        localTime: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      cron: {
        crondRunning: false,
        cronTab: null,
        cronScript: null,
        error: null
      }
    };
    
    // Check if crond is running
    try {
      const crondCheck = execSync('pgrep crond', { encoding: 'utf-8' });
      diagnostics.cron.crondRunning = !!crondCheck.trim();
    } catch (e) {
      diagnostics.cron.crondRunning = false;
    }
    
    // Read crontab
    try {
      const cronTab = execSync('cat /etc/crontabs/root', { encoding: 'utf-8' });
      diagnostics.cron.cronTab = cronTab;
    } catch (e) {
      diagnostics.cron.error = 'Cannot read /etc/crontabs/root: ' + String(e);
    }
    
    // Read cron script
    try {
      const cronScript = execSync('cat /tmp/sync-cron.sh', { encoding: 'utf-8' });
      diagnostics.cron.cronScript = cronScript;
    } catch (e) {
      diagnostics.cron.cronScriptError = 'Cannot read /tmp/sync-cron.sh: ' + String(e);
    }
    
    // Read cron log (to see if cron has actually tried to run)
    try {
      const cronLog = execSync('tail -100 /tmp/cron.log 2>/dev/null || echo "No cron log yet"', { encoding: 'utf-8' });
      diagnostics.cron.cronLog = cronLog;
    } catch (e) {
      diagnostics.cron.cronLogError = 'Cannot read cron log: ' + String(e);
    }
    
    // Read cron execution log (stderr/stdout from cron daemon)
    try {
      const cronExecLog = execSync('tail -100 /tmp/cron-execution.log 2>/dev/null || echo "No cron execution log yet"', { encoding: 'utf-8' });
      diagnostics.cron.cronExecutionLog = cronExecLog;
    } catch (e) {
      diagnostics.cron.cronExecutionLogError = String(e);
    }
    
    // Check crond log level
    try {
      const crondPs = execSync('ps aux | grep crond | grep -v grep', { encoding: 'utf-8' });
      diagnostics.cron.crondProcess = crondPs.trim();
    } catch (e) {
      diagnostics.cron.crondProcess = 'No crond process found';
    }
    
    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// API: Tail recent log
app.get('/api/logs', (_req, res) => {
  try {
    let out = '';
    try { out = fs.readFileSync('/tmp/cron.log', 'utf-8').split(/\r?\n/).slice(-120).join('\n'); } catch { out = 'No log yet'; }
    res.setHeader('Content-Type', 'text/plain');
    res.send(out);
  } catch (error) {
    res.status(500).send(String(error));
  }
});

// Start server
const port = parseInt(process.env.PORT || '8099', 10);
app.listen(port, () => {
  console.log(`[Server] Ingress UI running on port ${port}`);
  console.log('[Server] Schedule controls available in UI');
});
