# API rate limits

## Ingestion

The ingestion endpoint accepts up to 1,000 events per request and 20,000 requests per minute per project. Requests above the limit get HTTP 429 with a `Retry-After` header.

## Query API

The Query API allows 120 queries per minute per workspace. Long-running queries time out after 60 seconds.

## Keys

Write keys can only send events. Read access needs a service account secret, created under **Settings → Service accounts**.
