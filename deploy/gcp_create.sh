#!/usr/bin/env bash
# Create the Nightly API VM on GCP and install everything on it.
#   ./deploy/gcp_create.sh <gcp-project-id> [zone]
# To update an existing VM: gcloud compute ssh nightshift-api -- sudo google_metadata_script_runner startup
# Needs: gcloud (logged in), and deploy/api.env (copy deploy/api.env.example and fill it in).
set -euo pipefail
PROJECT=${1:?gcp project id}
ZONE=${2:-asia-south1-a}
NAME=nightshift-api
cd "$(dirname "$0")/.."
[ -f deploy/api.env ] || { echo "fill in deploy/api.env first (see api.env.example)"; exit 1; }

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable compute.googleapis.com
gcloud compute firewall-rules describe nightshift-web >/dev/null 2>&1 || \
  gcloud compute firewall-rules create nightshift-web --allow tcp:80,tcp:443 --target-tags nightshift
gcloud compute instances describe "$NAME" --zone "$ZONE" >/dev/null 2>&1 || \
  gcloud compute instances create "$NAME" --zone "$ZONE" --machine-type e2-small \
    --image-family debian-12 --image-project debian-cloud --boot-disk-size 20GB --tags nightshift \
    --metadata-from-file startup-script=deploy/vm_setup.sh,ns-env=deploy/api.env

IP=$(gcloud compute instances describe "$NAME" --zone "$ZONE" --format 'get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "VM IP: $IP  →  API will be https://api.${IP//./-}.sslip.io"
echo "Setting up via startup script; waiting for it to finish (serial console)…"
for i in $(seq 1 50); do
  if gcloud compute instances get-serial-port-output "$NAME" --zone "$ZONE" 2>/dev/null | grep -q NIGHTSHIFT_READY; then break; fi
  sleep 10
done
gcloud compute instances get-serial-port-output "$NAME" --zone "$ZONE" 2>/dev/null | grep -E "NIGHTSHIFT_READY|startup-script.*(error|Error)" | tail -3
# secrets now live on the VM's disk only; drop them from instance metadata
gcloud compute instances remove-metadata "$NAME" --zone "$ZONE" --keys ns-env,scout-env
