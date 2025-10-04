# SpiritMate MYOB Sync Add-on (v1.0.0)

Home Assistant add-on that syncs MYOB invoice emails into SpiritMate inventory via Firestore.

Features:
- IMAP support (Gmail, Office365, generic IMAP)
- PDF parsing of MYOB invoices
- Firestore writes to `productStocks`, movement records, idempotent processed invoices
- Optional schedule with cron
- Ingress upload for Firebase `service-account.json`, status endpoint, run-now trigger

See `DOCS.md` for configuration and setup details.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
