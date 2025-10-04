# SpiritMate Home Assistant Add-ons

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FHowy1972%2Fspiritmate-homeassistant-addon)

This repository contains Home Assistant add-ons for [SpiritMate](https://github.com/Howy1972/spiritmate) - a spirit production toolkit for distillation, bottling, and inventory management.

## Add-ons

### SpiritMate MYOB Sync

Automatically processes MYOB invoices from your email account and updates your SpiritMate inventory system via Firestore.

**Features:**
- IMAP support for any email provider (Gmail, Office 365, generic IMAP)
- PDF parsing of MYOB invoices and credit notes
- Firestore integration with product stock tracking
- Scheduled sync with cron expressions
- Web UI for service account upload and manual sync triggers
- Status API and ingress support

See [`spiritmate-myob-sync/DOCS.md`](./spiritmate-myob-sync/DOCS.md) for full documentation.

## Installation

### Method 1: One-Click Install (Recommended)
[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FHowy1972%2Fspiritmate-homeassistant-addon)

### Method 2: Manual Installation
1. Go to: Supervisor > Add-on Store > ⋮ > Repositories
2. Add: `https://github.com/Howy1972/spiritmate-homeassistant-addon`
3. Install "SpiritMate MYOB Sync" from the add-on store
4. Configure IMAP settings and Firebase credentials
5. Start the add-on

## Support

- **Issues**: Report issues in the [main SpiritMate repository](https://github.com/Howy1972/spiritmate/issues)
- **Documentation**: See individual add-on DOCS.md files
- **SpiritMate**: Visit the [main project](https://github.com/Howy1972/spiritmate)

## License

Apache License 2.0
