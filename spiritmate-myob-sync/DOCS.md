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
The add-on copies it to `/app/service-account.json` and sets `GOOGLE_APPLICATION_CREDENTIALS` automatically.

### Upload via Ingress

You can upload the file from the add-on panel:

- POST `/api/upload-service-account` with form field `file` (multipart)
- The add-on stores it at `/share/spiritmate/service-account.json`

Example using curl (from within your network):

```bash
curl -F "file=@service-account.json" http://homeassistant.local:8123/api/hassio_ingress/<addon_token>/api/upload-service-account
```

Or simply use the web UI at the add-on panel.

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

## Ingress and Status API

- Ingress UI is enabled. The server listens on port 8099.
- GET `/api/status` returns a simple status payload.
- POST `/api/run` triggers a one-off sync with current configuration and returns a summary.

Example curl (access via the add-on's ingress URL):

```bash
# Check status
curl http://homeassistant.local:8123/api/hassio_ingress/<addon_token>/api/status

# Trigger manual sync
curl -X POST http://homeassistant.local:8123/api/hassio_ingress/<addon_token>/api/run
```

Note: The ingress token is managed by Home Assistant. Use the web UI panel for easiest access.
