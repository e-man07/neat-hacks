# Deploying Nightly

The API runs on a small GCP VM behind Caddy, with automatic HTTPS on an sslip.io name. The web app
runs on Vercel.

## 1. Secrets
Generate these once and use the same values on both sides:
```bash
openssl rand -hex 32   # NS_AUTH_SECRET     (API + web): signs the API tokens the web app mints
openssl rand -hex 32   # NS_INTERNAL_SECRET (API + web): web → API user registration
openssl rand -hex 32   # AUTH_SECRET        (web): Auth.js session cookie
python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"  # NS_ENCRYPTION_KEY (API)
```

## 2. API on GCP
```bash
cp deploy/api.env.example deploy/api.env   # fill it in (gitignored)
./deploy/gcp_create.sh <project-id> asia-south1-a
```
The script prints `https://api.<ip>.sslip.io`. To redeploy after a merge, re-run it. It pulls `main`
and restarts the service.

## 3. GitHub OAuth app
GitHub → Settings → Developer settings → OAuth Apps → New:
- Homepage URL: `https://<app>.vercel.app`
- Callback URL: `https://<app>.vercel.app/api/auth/callback/github`

## 4. Web on Vercel
Import the repo, set the root directory to `web`, and add the variables from `deploy/web.env.example`.

## 5. Slack app
api.slack.com/apps → Create New App → From a manifest. Paste `deploy/slack-manifest.yml` with
`API_HOST` replaced. Put the Client ID, Client Secret and Signing Secret into `deploy/api.env` and
re-run step 2. In the app, go to **Paging → Add to Slack**.

## 6. Connect an agent
In the app, go to **Connect an agent**, or run Scout against the deployment:
```bash
export NIGHTLY_API_URL=https://api.<ip>.sslip.io NIGHTLY_AGENT_TOKEN=nsa_...
uv run --project backend python agents/scout/scout.py deploy s2
uv run --project backend python agents/scout/scout.py serve --rate 6
```
