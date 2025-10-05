# SpiritMate MYOB Sync Add-on (v2.0.3)

Home Assistant add-on that syncs MYOB invoice emails into SpiritMate inventory via Firestore.

## Features:
- **IMAP Support**: Gmail, Office365, or any generic IMAP provider
- **Intelligent PDF Parsing**: Handles complex MYOB invoice formats with multi-product lines
- **Firestore Integration**: Updates `productStocks`, movement records, and idempotent processed invoices
- **Modern Web UI**: 
  - Real-time system status dashboard
  - Schedule configuration (toggle, start/end times, intervals)
  - Activity log with live updates
  - One-click manual sync
- **Flexible Scheduling**: Configure active hours and sync intervals
- **Credential Management**: Simple file placement via Samba/SSH

See `DOCS.md` for detailed configuration and setup instructions.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
