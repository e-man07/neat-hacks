#!/usr/bin/env bash
# Create the Night Shift API VM on GCP and install everything on it.
#   ./deploy/gcp_create.sh <gcp-project-id> [zone]
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
    --image-family debian-12 --image-project debian-cloud --boot-disk-size 20GB --tags nightshift

IP=$(gcloud compute instances describe "$NAME" --zone "$ZONE" --format 'get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "VM IP: $IP  →  API will be https://api.${IP//./-}.sslip.io"
gcloud compute scp deploy/api.env deploy/vm_setup.sh "$NAME":/tmp/ --zone "$ZONE"
gcloud compute ssh "$NAME" --zone "$ZONE" --command "sudo bash /tmp/vm_setup.sh $IP"
