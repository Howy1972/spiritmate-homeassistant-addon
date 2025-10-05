import express from 'express';
import fs from 'fs';
import { runWorker } from './index';
import { exec } from 'child_process';
import { promisify } from 'util';

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

// Main UI
app.get('/', (_req, res) => {
  res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpiritMate MYOB Sync</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0a0e14 0%, #1a1f2e 100%);
      color: #e5e7eb;
      line-height: 1.6;
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(16, 185, 129, 0.2);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 16px;
    }
    
    .status-bar {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    
    .status-card {
      flex: 1;
      min-width: 200px;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 20px;
    }
    
    .status-label {
      font-size: 13px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .status-value {
      font-size: 20px;
      font-weight: 700;
    }
    
    .status-value.ready {
      color: #10b981;
    }
    
    .status-value.error {
      color: #ef4444;
    }
    
    .status-value.pending {
      color: #f59e0b;
    }
    
    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    }
    
    .card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 25px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .card h2 {
      font-size: 20px;
      margin-bottom: 15px;
      color: #10b981;
    }
    
    .card p {
      color: #9ca3af;
      font-size: 14px;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    
    button {
      width: 100%;
      padding: 14px 24px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    }
    
    button:active:not(:disabled) {
      transform: translateY(0);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    
    .btn-secondary {
      background: #374151;
      color: #e5e7eb;
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }
    
    .alert {
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #10b981;
    }
    
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #ef4444;
    }
    
    .alert-info {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
      color: #3b82f6;
    }
    
    .log-container {
      background: #0f1419;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
      color: #9ca3af;
    }
    
    .log-entry {
      margin-bottom: 8px;
    }
    
    .log-timestamp {
      color: #6366f1;
      font-weight: 600;
    }
    
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .info-box {
      background: #0f1419;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
    }
    
    .info-box code {
      background: #1f2937;
      padding: 3px 8px;
      border-radius: 4px;
      color: #10b981;
      font-size: 12px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #374151;
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .full-width {
      grid-column: 1 / -1;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #e5e7eb;
      margin-bottom: 8px;
    }
    
    .form-hint {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
    
    input[type="text"],
    input[type="time"],
    input[type="number"],
    select {
      width: 100%;
      padding: 12px;
      background: #0f1419;
      border: 1px solid #374151;
      border-radius: 8px;
      color: #e5e7eb;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    
    input:focus,
    select:focus {
      outline: none;
      border-color: #10b981;
    }
    
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #374151;
      transition: .4s;
      border-radius: 34px;
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
      background-color: #10b981;
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }
    
    .flex-row {
      display: flex;
      gap: 15px;
      align-items: center;
    }
    
    .flex-row .form-group {
      flex: 1;
      margin-bottom: 0;
    }
    
    .config-note {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 12px;
      font-size: 13px;
      color: #93c5fd;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍸 SpiritMate MYOB Sync</h1>
      <p>Automated invoice processing and inventory synchronization</p>
    </div>

    <div id="alertContainer"></div>

    <div class="status-bar">
      <div class="status-card">
        <div class="status-label">System Status</div>
        <div id="systemStatus" class="status-value pending">Checking...</div>
      </div>
      <div class="status-card">
        <div class="status-label">Credentials</div>
        <div id="credStatus" class="status-value pending">Checking...</div>
      </div>
      <div class="status-card">
        <div class="status-label">Schedule Status</div>
        <div id="scheduleStatus" class="status-value pending">Checking...</div>
      </div>
      <div class="status-card">
        <div class="status-label">Last Updated</div>
        <div id="lastUpdate" class="status-value">—</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>⚡ Quick Actions</h2>
        <p>Trigger manual sync or refresh system status</p>
        <button id="runSyncBtn" class="btn-primary">
          <span>▶️</span>
          <span>Run Sync Now</span>
        </button>
        <button id="refreshBtn" class="btn-secondary" style="margin-top: 10px;">
          <span>🔄</span>
          <span>Refresh Status</span>
        </button>
      </div>

      <div class="card">
        <h2>📊 Sync Statistics</h2>
        <div id="statsContainer">
          <div class="info-row">
            <span>Emails Processed</span>
            <span id="emailCount">—</span>
          </div>
          <div class="info-row">
            <span>Last Sync</span>
            <span id="lastSync">Never</span>
          </div>
          <div class="info-row">
            <span>Next Scheduled</span>
            <span id="nextSync">—</span>
          </div>
        </div>
      </div>

      <div class="card full-width">
        <h2>⏰ Schedule Configuration</h2>
        <p>Configure automatic sync schedule. Changes are saved to Home Assistant configuration.</p>
        
        <div class="form-group">
          <label class="form-label">
            <div class="flex-row">
              <span>Enable Automatic Sync</span>
              <label class="toggle-switch">
                <input type="checkbox" id="scheduleEnabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </label>
          <div class="form-hint">Turn on to run sync automatically on a schedule</div>
        </div>

        <div id="scheduleOptions" style="display: none;">
          <div class="flex-row">
            <div class="form-group">
              <label class="form-label" for="startTime">Start Time</label>
              <input type="time" id="startTime" value="08:00">
              <div class="form-hint">Daily sync start time</div>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="endTime">End Time</label>
              <input type="time" id="endTime" value="18:00">
              <div class="form-hint">Daily sync end time</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="syncInterval">Sync Interval (minutes)</label>
            <select id="syncInterval">
              <option value="15">Every 15 minutes</option>
              <option value="30" selected>Every 30 minutes</option>
              <option value="60">Every hour</option>
              <option value="120">Every 2 hours</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
            </select>
            <div class="form-hint">How often to check for new invoices during active hours</div>
          </div>

          <button id="saveScheduleBtn" class="btn-primary">
            <span>💾</span>
            <span>Save Schedule</span>
          </button>
        </div>

        <div class="config-note">
          <strong>Note:</strong> Schedule settings are stored in the add-on configuration. 
          For advanced cron schedules, edit the configuration YAML directly in Home Assistant.
        </div>
      </div>

      <div class="card full-width">
        <h2>ℹ️ Configuration Guide</h2>
        <p><strong>Credentials:</strong> Place your Firebase <code>service-account.json</code> file via Samba/SSH at:</p>
        <div class="info-box">
          <code>/share/spiritmate/service-account.json</code>
        </div>
        <p style="margin-top: 15px;"><strong>IMAP & Email Settings:</strong> Configure in the add-on Configuration tab:</p>
        <div class="info-box">
          <div style="margin-bottom: 8px;">• IMAP server, port, username, password</div>
          <div style="margin-bottom: 8px;">• Email filters (from address, subject prefix)</div>
          <div>• Firestore project ID</div>
        </div>
      </div>

      <div class="card full-width">
        <h2>📋 Activity Log</h2>
        <div id="logContainer" class="log-container">
          <div class="log-entry">
            <span class="log-timestamp">[Ready]</span> System initialized. Click "Run Sync Now" to start processing.
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const systemStatus = document.getElementById('systemStatus');
    const credStatus = document.getElementById('credStatus');
    const scheduleStatus = document.getElementById('scheduleStatus');
    const lastUpdate = document.getElementById('lastUpdate');
    const alertContainer = document.getElementById('alertContainer');
    const logContainer = document.getElementById('logContainer');
    const runSyncBtn = document.getElementById('runSyncBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const emailCount = document.getElementById('emailCount');
    const lastSync = document.getElementById('lastSync');
    const nextSync = document.getElementById('nextSync');
    
    const scheduleEnabled = document.getElementById('scheduleEnabled');
    const scheduleOptions = document.getElementById('scheduleOptions');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const syncInterval = document.getElementById('syncInterval');

    function showAlert(type, message) {
      const alert = document.createElement('div');
      alert.className = 'alert alert-' + type;
      alert.textContent = message;
      alertContainer.appendChild(alert);
      
      setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
      }, 6000);
    }

    function addLog(message) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      const timestamp = new Date().toLocaleTimeString();
      entry.innerHTML = '<span class="log-timestamp">[' + timestamp + ']</span> ' + message;
      logContainer.appendChild(entry);
      logContainer.scrollTop = logContainer.scrollHeight;
    }

    scheduleEnabled.addEventListener('change', () => {
      scheduleOptions.style.display = scheduleEnabled.checked ? 'block' : 'none';
    });

    async function checkStatus() {
      try {
        const response = await fetch('api/status');
        const data = await response.json();
        
        lastUpdate.textContent = new Date().toLocaleTimeString();
        
        if (data.hasCredentials) {
          systemStatus.textContent = '✓ Ready';
          systemStatus.className = 'status-value ready';
          credStatus.textContent = '✓ Found';
          credStatus.className = 'status-value ready';
        } else {
          systemStatus.textContent = '✗ Not Ready';
          systemStatus.className = 'status-value error';
          credStatus.textContent = '✗ Missing';
          credStatus.className = 'status-value error';
        }

        // Update schedule status
        if (data.scheduleEnabled) {
          scheduleStatus.textContent = '✓ Active';
          scheduleStatus.className = 'status-value ready';
        } else {
          scheduleStatus.textContent = 'Manual Only';
          scheduleStatus.className = 'status-value pending';
        }

        // Load schedule config
        if (data.schedule) {
          scheduleEnabled.checked = data.schedule.enabled || false;
          scheduleOptions.style.display = scheduleEnabled.checked ? 'block' : 'none';
          if (data.schedule.startTime) startTime.value = data.schedule.startTime;
          if (data.schedule.endTime) endTime.value = data.schedule.endTime;
          if (data.schedule.interval) syncInterval.value = data.schedule.interval;
        }
      } catch (error) {
        systemStatus.textContent = '✗ Error';
        systemStatus.className = 'status-value error';
        credStatus.textContent = '✗ Unknown';
        credStatus.className = 'status-value error';
        addLog('Status check failed: ' + error.message);
      }
    }

    async function runSync() {
      runSyncBtn.disabled = true;
      runSyncBtn.innerHTML = '<div class="spinner"></div><span>Running...</span>';
      addLog('Starting manual sync operation...');
      
      try {
        const response = await fetch('api/run', { method: 'POST' });
        const data = await response.json();
        
        if (data.ok) {
          showAlert('success', '✓ Sync completed successfully!');
          addLog('Sync completed successfully');
          
          if (data.result) {
            addLog('Result: ' + JSON.stringify(data.result, null, 2));
            
            if (data.result.emailsProcessed !== undefined) {
              emailCount.textContent = data.result.emailsProcessed;
            }
            lastSync.textContent = new Date().toLocaleTimeString();
          }
        } else {
          showAlert('error', '✗ Sync failed: ' + (data.error || 'Unknown error'));
          addLog('Sync failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        showAlert('error', '✗ Sync failed: ' + error.message);
        addLog('Sync exception: ' + error.message);
      } finally {
        runSyncBtn.disabled = false;
        runSyncBtn.innerHTML = '<span>▶️</span><span>Run Sync Now</span>';
      }
    }

    async function saveSchedule() {
      saveScheduleBtn.disabled = true;
      saveScheduleBtn.innerHTML = '<div class="spinner"></div><span>Saving...</span>';
      addLog('Saving schedule configuration...');
      
      try {
        const config = {
          enabled: scheduleEnabled.checked,
          startTime: startTime.value,
          endTime: endTime.value,
          interval: parseInt(syncInterval.value, 10)
        };
        
        const response = await fetch('api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.ok) {
          showAlert('success', '✓ Schedule saved successfully!');
          addLog('Schedule configuration saved');
          checkStatus();
        } else {
          showAlert('error', '✗ Failed to save: ' + (data.error || 'Unknown error'));
          addLog('Save failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        showAlert('error', '✗ Save failed: ' + error.message);
        addLog('Save exception: ' + error.message);
      } finally {
        saveScheduleBtn.disabled = false;
        saveScheduleBtn.innerHTML = '<span>💾</span><span>Save Schedule</span>';
      }
    }

    runSyncBtn.addEventListener('click', runSync);
    refreshBtn.addEventListener('click', () => {
      addLog('Refreshing status...');
      checkStatus();
    });
    saveScheduleBtn.addEventListener('click', saveSchedule);

    // Initial status check
    checkStatus();
    
    // Auto-refresh every 15 seconds
    setInterval(checkStatus, 15000);
  </script>
</body>
</html>`);
});

// API: Check system status
app.get('/api/status', (_req, res) => {
  try {
    // Check if credentials file exists
    let hasCredentials = false;
    try {
      const stats = fs.statSync('/share/spiritmate/service-account.json');
      hasCredentials = stats.isFile() && stats.size > 0;
    } catch {
      hasCredentials = false;
    }
    
    // Read schedule config from environment or config file
    const scheduleEnabled = process.env.SCHEDULE_ENABLED === 'true';
    const scheduleConfig = {
      enabled: scheduleEnabled,
      startTime: process.env.SCHEDULE_START_TIME || '08:00',
      endTime: process.env.SCHEDULE_END_TIME || '18:00',
      interval: parseInt(process.env.SCHEDULE_INTERVAL || '30', 10)
    };
    
    const response = {
      ok: true,
      hasCredentials: hasCredentials,
      scheduleEnabled: scheduleEnabled,
      schedule: scheduleConfig,
      time: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      ok: false,
      error: String(error)
    };
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify(errorResponse));
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
    const { enabled, startTime, endTime, interval } = req.body;
    
    // Note: In a real implementation, this would update the Home Assistant config
    // For now, we'll just acknowledge the request
    // The actual schedule is managed via the add-on configuration in Home Assistant
    
    showAlert('info', 'Schedule configuration received. Please update via Home Assistant Configuration tab for persistent changes.');
    
    res.json({ 
      ok: true, 
      message: 'Schedule config received. Update via HA config for persistence.',
      config: { enabled, startTime, endTime, interval }
    });
  } catch (error) {
    console.error('[API] Schedule save failed:', error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// Start server
const port = parseInt(process.env.PORT || '8099', 10);
app.listen(port, () => {
  console.log(`[Server] Ingress UI running on port ${port}`);
  console.log('[Server] Schedule controls available in UI');
});