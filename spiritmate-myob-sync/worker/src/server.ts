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
      background: linear-gradient(135deg, #c9a96e 0%, #b8956a 100%);
      padding: 30px;
      border-radius: 16px;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(201, 169, 110, 0.3);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a1f2e;
    }
    
    .header p {
      opacity: 0.85;
      font-size: 16px;
      color: #2d3748;
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
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .status-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
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
      color: #c9a96e;
    }
    
    .status-value.error {
      color: #ef4444;
    }
    
    .status-value.pending {
      color: #d4b896;
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
      color: #c9a96e;
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
      background: linear-gradient(135deg, #c9a96e 0%, #b8956a 100%);
      color: #1a1f2e;
      font-weight: 700;
    }
    
    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #d4b896 0%, #c9a96e 100%);
    }
    
    .btn-secondary {
      background: #374151;
      color: #e5e7eb;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: #4b5563;
    }
    
    .btn-logs {
      background: #2d3748;
      color: #d4b896;
      border: 1px solid #4b5563;
    }
    
    .btn-logs:hover:not(:disabled) {
      background: #374151;
      border-color: #c9a96e;
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
      background: rgba(201, 169, 110, 0.15);
      border: 1px solid #c9a96e;
      color: #d4b896;
    }
    
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #ef4444;
    }
    
    .alert-info {
      background: rgba(212, 184, 150, 0.15);
      border: 1px solid #d4b896;
      color: #d4b896;
    }
    
    .log-section {
      margin-top: 30px;
      overflow: hidden;
      transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
    }
    
    .log-section.collapsed {
      max-height: 0;
      opacity: 0;
    }
    
    .log-section.expanded {
      max-height: 500px;
      opacity: 1;
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
      color: #c9a96e;
      font-weight: 600;
    }
    
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(26, 31, 46, 0.3);
      border-top-color: #1a1f2e;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
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
      border-color: #c9a96e;
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
      background-color: #c9a96e;
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
      background: rgba(212, 184, 150, 0.1);
      border: 1px solid #c9a96e;
      border-radius: 8px;
      padding: 12px;
      font-size: 13px;
      color: #d4b896;
      margin-top: 15px;
    }
    
    .chevron {
      transition: transform 0.3s ease;
      display: inline-block;
    }
    
    .chevron.rotated {
      transform: rotate(180deg);
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
        <button id="toggleLogsBtn" class="btn-logs" style="margin-top: 10px;">
          <span>📋</span>
          <span>View Logs</span>
          <span class="chevron">▼</span>
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

        <div class="config-note">
          <strong>Note:</strong> Changes are saved to Home Assistant configuration and persist across restarts. 
          The add-on will restart automatically when you save schedule changes.
        </div>
      </div>
        </div>

    <div id="logSection" class="log-section collapsed">
      <div class="card full-width" style="margin-top: 0;">
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
    const logSection = document.getElementById('logSection');
    const runSyncBtn = document.getElementById('runSyncBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const toggleLogsBtn = document.getElementById('toggleLogsBtn');
    const emailCount = document.getElementById('emailCount');
    const lastSync = document.getElementById('lastSync');
    const nextSync = document.getElementById('nextSync');
    
    const scheduleEnabled = document.getElementById('scheduleEnabled');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const syncInterval = document.getElementById('syncInterval');

    let logsExpanded = false;

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

    toggleLogsBtn.addEventListener('click', () => {
      logsExpanded = !logsExpanded;
      if (logsExpanded) {
        logSection.classList.remove('collapsed');
        logSection.classList.add('expanded');
        toggleLogsBtn.querySelector('.chevron').classList.add('rotated');
      } else {
        logSection.classList.remove('expanded');
        logSection.classList.add('collapsed');
        toggleLogsBtn.querySelector('.chevron').classList.remove('rotated');
      }
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
      
      // Auto-expand logs when sync starts
      if (!logsExpanded) {
        toggleLogsBtn.click();
      }
      
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
      
      // Auto-expand logs
      if (!logsExpanded) {
        toggleLogsBtn.click();
      }
      
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
          if (data.needsRestart) {
            showAlert('info', '⚠️ Schedule saved! Add-on will restart in a few seconds...');
            addLog('Schedule saved. Add-on restarting to apply changes...');
            addLog('Cron expression: ' + data.config.cron);
            
            // Disable all buttons during restart
            runSyncBtn.disabled = true;
            refreshBtn.disabled = true;
            saveScheduleBtn.disabled = true;
            
            // Show reconnecting message after a delay
            setTimeout(() => {
              addLog('Waiting for add-on to restart...');
              showAlert('info', '🔄 Reconnecting after restart...');
            }, 3000);
            
            // Try to reconnect after restart (poll every 2 seconds)
            let reconnectAttempts = 0;
            const reconnectInterval = setInterval(async () => {
              reconnectAttempts++;
              try {
                const testResponse = await fetch('api/status');
                if (testResponse.ok) {
                  clearInterval(reconnectInterval);
                  addLog('✓ Reconnected successfully!');
                  showAlert('success', '✓ Add-on restarted. Schedule is now active!');
                  
                  // Re-enable buttons
                  runSyncBtn.disabled = false;
                  refreshBtn.disabled = false;
                  saveScheduleBtn.disabled = false;
                  saveScheduleBtn.innerHTML = '<span>💾</span><span>Save Schedule</span>';
                  
                  // Refresh status
                  checkStatus();
                }
      } catch (e) {
                if (reconnectAttempts > 30) {
                  clearInterval(reconnectInterval);
                  addLog('✗ Reconnection timeout. Please refresh the page.');
                  showAlert('error', '✗ Could not reconnect. Please refresh the page.');
                }
              }
            }, 2000);
          } else {
            showAlert('success', '✓ Schedule saved successfully!');
            addLog('Schedule configuration saved');
            saveScheduleBtn.disabled = false;
            saveScheduleBtn.innerHTML = '<span>💾</span><span>Save Schedule</span>';
            checkStatus();
          }
        } else {
          showAlert('error', '✗ Failed to save: ' + (data.error || 'Unknown error'));
          addLog('Save failed: ' + (data.error || 'Unknown error'));
          saveScheduleBtn.disabled = false;
          saveScheduleBtn.innerHTML = '<span>💾</span><span>Save Schedule</span>';
        }
      } catch (error) {
        showAlert('error', '✗ Save failed: ' + error.message);
        addLog('Save exception: ' + error.message);
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
    
    // Convert start/end time + interval to cron expression
    // For simplicity: if enabled, use interval-based cron during active hours
    // We'll generate a simple cron based on interval (ignoring time windows for now)
    let cronExpression = '0 2 * * *'; // Default: 2 AM daily
    
    if (enabled && interval) {
      // Convert interval (minutes) to cron
      if (interval === 15) {
        cronExpression = '*/15 * * * *'; // Every 15 minutes
      } else if (interval === 30) {
        cronExpression = '*/30 * * * *'; // Every 30 minutes
      } else if (interval === 60) {
        cronExpression = '0 * * * *'; // Every hour
      } else if (interval === 120) {
        cronExpression = '0 */2 * * *'; // Every 2 hours
      } else if (interval === 180) {
        cronExpression = '0 */3 * * *'; // Every 3 hours
      } else if (interval === 360) {
        cronExpression = '0 */6 * * *'; // Every 6 hours
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
    
    res.json({ 
      ok: true, 
      message: 'Schedule saved! Add-on will restart to apply changes.',
      config: { enabled, startTime, endTime, interval, cron: cronExpression },
      needsRestart: true
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
