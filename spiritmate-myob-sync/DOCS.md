# SpiritMate MYOB Sync Add-on

Automates processing of MYOB invoice emails via IMAP and updates SpiritMate inventory in Firestore.

## Configuration

Set all fields in the add-on Configuration tab:

- imap_host: Mail server host (e.g. `imap.gmail.com`, `outlook.office365.com`)
- imap_port: IMAP port (usually `993`)
- imap_user: Email account username/login
- imap_pass: Email account password/app password
- imap_mailbox: Mailbox/folder to read from (default `INBOX`)
- from_exact: Exact sender email to match (e.g. `invoices@myob.com`)
- subject_prefix: Subject must start with this prefix (e.g. `Invoice`, `Tax Invoice`)
- label_processed: Optional folder/label to copy processed messages to
- firestore_project_id: Your Firebase/Firestore project id
- schedule_enabled: If true, runs on a cron schedule
- schedule_cron: Cron expression (e.g. `0 2 * * *`)
- log_level: `debug`, `info`, `warning`, or `error`

## Firestore Credentials

Place your Firebase service account JSON at: `/share/spiritmate/service-account.json`.
The add-on copies it to `/app/service-account.json` automatically.

**How to upload:**
- Use Samba share to access `/share/spiritmate/` directory
- Or use SSH/terminal to copy the file directly
- The web UI will show credential status once the file is in place

## Scheduling

- With `schedule_enabled: true`, the add-on starts `crond` and triggers the worker by `schedule_cron`.
- With `schedule_enabled: false`, the worker runs once and exits.

## Notes

- This add-on is provider-agnostic: any IMAP server can be used. Provide the correct host/port and credentials for your mail provider.
- Ensure MYOB invoices meet your `from_exact` and `subject_prefix` filters.

### Provider defaults (examples)

- Gmail:
  - imap_host: `imap.gmail.com`
  - imap_port: `993`
  - Notes: Use an App Password (2FA required)

- Office 365 / Outlook:
  - imap_host: `outlook.office365.com`
  - imap_port: `993`

- Generic IMAP:
  - imap_host: as provided by your mail host
  - imap_port: typically `993`

## Optional processed-folder behavior

If you set `label_processed`, the add-on will copy matched emails to that folder/label after successful processing, while leaving the original in `INBOX`. If your server does not support label creation, pre-create the folder.

## Web Interface

The add-on provides a modern web interface accessible from the Home Assistant UI:

### Features:
- **System Status Dashboard**: Real-time status of credentials, schedule, and last sync
- **Quick Actions**: Run manual sync or refresh status with one click
- **Schedule Configuration**: 
  - Toggle automatic sync on/off
  - Set start and end times for active sync hours
  - Configure sync interval (15 min to 6 hours)
- **Activity Log**: Real-time log of sync operations and system events
- **Configuration Guide**: Step-by-step instructions for setup

### API Endpoints:
- `GET /api/status` - Returns system status and configuration
- `POST /api/run` - Triggers manual sync operation
- `POST /api/schedule` - Updates schedule configuration (note: for persistent changes, update via HA config)

### Schedule Configuration:
The web UI provides convenient controls for scheduling, but for persistent configuration changes, update the add-on's Configuration tab in Home Assistant. The UI schedule controls are helpful for testing and quick adjustments.
