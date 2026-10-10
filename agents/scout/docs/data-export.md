# Exporting data

## CSV export

Any chart can be exported as CSV from the chart menu. CSV exports are capped at 50,000 rows.

## Warehouse sync

Growth and Enterprise workspaces can sync raw events to Snowflake, BigQuery or Redshift. Syncs run every 6 hours on Growth and every hour on Enterprise.

## Raw export API

The Export API returns raw events as gzipped NDJSON for a date range. Requests are limited to 31 days per call and 60 calls per hour.
