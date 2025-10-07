<!-- https://developers.home-assistant.io/docs/add-ons/presentation#keeping-a-changelog -->

## 2.6.3

- **FIXED**: Cron daemon not executing scheduled jobs (timezone not being set in crontab, multiple crond instances)
- Added TZ variable directly to crontab for BusyBox cron compatibility
- Test cron script execution on startup to verify it works
- Use exec for crond to prevent duplicate processes
- Enhanced startup logging to show crontab contents

## 2.6.2

- Added "Every 1 minute" and "Every 5 minutes" options for testing schedules
- Enhanced cron logging with detailed execution timestamps and exit codes
- Added separate cron daemon log to track if cron is attempting to execute
- Increased crond verbosity to debug level for troubleshooting

## 2.6.1

- **FIXED**: Timezone not being saved when changing schedule settings (was reverting to old timezone)

## 2.6.0

- Added Adelaide (ACST), Brisbane, and Darwin to timezone dropdown

## 2.5.9

- Ready for future updates

## 2.5.8

- **FIXED**: Added timezone configuration support (fixes cron not running due to timezone mismatch)
- Added timezone diagnostics to show container's current time and timezone settings

## 2.5.7

- **FIXED**: Cron schedule generation excluding the end hour (e.g., 10 PM sync was missing from schedule)
- Added cron execution logging to /tmp/cron.log to track if scheduled jobs are actually running
- Enhanced diagnostics to show cron execution history and crond process status
- Reduced auto-refresh polling from 15s to 60s, then removed entirely (manual refresh only)
- Reduced reconnection polling from 2s to 5s during addon restart
- Added diagnostics endpoint and "Check Cron Status" button to troubleshoot scheduled sync issues

## 2.5.6

- Fixed JSON parsing error when saving schedule configuration by sending response before triggering restart

## 2.5.2

- Fixed scheduler settings reverting after 10 seconds due to auto-refresh overwriting unsaved changes
- Fixed add-on not restarting after saving schedule configuration
- Fixed automatic sync not triggering at scheduled intervals
- Added form dirty tracking to prevent auto-refresh from overwriting unsaved scheduler settings
- Added visual indicator (golden border) on save button when scheduler settings have been modified

## 1.0.0

- First SpiritMate MYOB Sync release
- IMAP worker, PDF parsing, Firestore integration
- Ingress upload UI, status API, run-now endpoint
