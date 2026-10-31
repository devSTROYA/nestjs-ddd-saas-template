#!/usr/bin/env bash
# Cloud Run + external HTTPS load balancer + Cloud Armor, with gcloud only.
# Usage: PROJECT_ID=... REGION=... DOMAIN=api.example.com IMAGE=... NETWORK=... SUBNET=... \
#          deploy/cloud-run.sh <step>
# Steps run in this order, each one can be re-run: setup, secrets, jobs, deploy, edge, armor
# (jobs run the migrations before the new code is deployed).
# Run `deploy/cloud-run.sh all` for every step. Read every step before running it.
set -euo pipefail

: "${PROJECT_ID:?}" "${REGION:?}" "${DOMAIN:?}"
SERVICE="${SERVICE:-boilerplate-api}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-${SERVICE}-sa}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"
DATABASE_POOL_MAX="${DATABASE_POOL_MAX:-5}"
# Hops between the client and the app: Google load balancer + Cloud Run. Verify against a real
# X-Forwarded-For header after the first deploy.
TRUST_PROXY_HOPS="${TRUST_PROXY_HOPS:-2}"
# Cloud Armor: requests per IP per minute on the unauthenticated auth endpoints.
ARMOR_AUTH_LIMIT="${ARMOR_AUTH_LIMIT:-20}"
# Start Cloud Armor rules in preview (log only); set ARMOR_PREVIEW= (empty) to enforce them.
ARMOR_PREVIEW="${ARMOR_PREVIEW-1}"
SECRETS=(DATABASE_URL OTP_SECRET JWT_SECRET RESEND_API_KEY)
POLICY="${SERVICE}-policy"

gc() { gcloud --project "$PROJECT_ID" "$@"; }

setup() {
  gc services enable run.googleapis.com secretmanager.googleapis.com compute.googleapis.com \
    cloudbuild.googleapis.com artifactregistry.googleapis.com
  gc iam service-accounts describe "$SERVICE_ACCOUNT" >/dev/null 2>&1 ||
    gc iam service-accounts create "$SERVICE_ACCOUNT_NAME" --display-name "$SERVICE"
  for role in roles/cloudsql.client roles/secretmanager.secretAccessor; do
    gc projects add-iam-policy-binding "$PROJECT_ID" --condition=None \
      --member "serviceAccount:${SERVICE_ACCOUNT}" --role "$role" >/dev/null
  done
}

# Reads each secret value from the environment variable of the same name (never from a file).
secrets() {
  for name in "${SECRETS[@]}"; do
    gc secrets describe "$name" >/dev/null 2>&1 ||
      gc secrets create "$name" --replication-policy automatic
    if [[ -n "${!name:-}" ]]; then
      printf '%s' "${!name}" | gc secrets versions add "$name" --data-file=-
    elif [[ -z "$(gc secrets versions list "$name" --limit 1 --format 'value(name)')" ]]; then
      echo "Secret $name has no version: set the $name environment variable" >&2
      exit 1
    fi
  done
}

secret_flags() {
  local flags=""
  for name in "${SECRETS[@]}"; do flags+="${name}=${name}:latest,"; done
  printf '%s' "${flags%,}"
}

deploy() {
  : "${IMAGE:?}" "${NETWORK:?}" "${SUBNET:?}" "${MAIL_FROM:?}"
  # The outbox relay polls inside the web process, so an instance must always exist and always have CPU.
  if (( MIN_INSTANCES < 1 )); then
    echo "MIN_INSTANCES must be at least 1: the outbox relay runs in the web process" >&2
    exit 1
  fi
  gc run deploy "$SERVICE" --region "$REGION" --image "$IMAGE" \
    --service-account "$SERVICE_ACCOUNT" \
    --cpu 1 --memory 512Mi --concurrency 50 --timeout 60 --cpu-boost --no-cpu-throttling \
    --min-instances "$MIN_INSTANCES" --max-instances "$MAX_INSTANCES" \
    --port 8080 \
    --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only \
    --ingress internal-and-cloud-load-balancing --allow-unauthenticated \
    --set-env-vars "^##^NODE_OPTIONS=--max-old-space-size=384##DATABASE_POOL_MAX=${DATABASE_POOL_MAX}##TRUST_PROXY_HOPS=${TRUST_PROXY_HOPS}##MAIL_FROM=${MAIL_FROM}##OUTBOX_RELAY_ENABLED=true" \
    --set-secrets "$(secret_flags)" \
    --startup-probe "httpGet.path=/v1/health/ready,httpGet.port=8080,periodSeconds=5,failureThreshold=12" \
    --liveness-probe "httpGet.path=/v1/health/live,httpGet.port=8080,periodSeconds=30"
}

# One-off jobs (migrations, admin seed). They run the same image, never at app startup.
jobs() {
  : "${IMAGE:?}" "${NETWORK:?}" "${SUBNET:?}" "${ADMIN_SEED_EMAIL:?}" "${MAIL_FROM:?}"
  local common=(--region "$REGION" --image "$IMAGE" --service-account "$SERVICE_ACCOUNT"
    --network "$NETWORK" --subnet "$SUBNET" --vpc-egress private-ranges-only
    --set-secrets "$(secret_flags)" --max-retries 0)
  gc run jobs deploy "${SERVICE}-migrate" "${common[@]}" --command node --args dist/migrate.js
  gc run jobs deploy "${SERVICE}-seed" "${common[@]}" --command node --args dist/seed.js \
    --set-env-vars "^##^ADMIN_SEED_EMAIL=${ADMIN_SEED_EMAIL}##MAIL_FROM=${MAIL_FROM}"
  gc run jobs execute "${SERVICE}-migrate" --region "$REGION" --wait
  echo "Run the seed once with: gcloud run jobs execute ${SERVICE}-seed --region ${REGION} --wait"
}

# Global external Application Load Balancer in front of the service.
edge() {
  gc compute addresses describe "${SERVICE}-ip" --global >/dev/null 2>&1 ||
    gc compute addresses create "${SERVICE}-ip" --global
  gc compute network-endpoint-groups describe "${SERVICE}-neg" --region "$REGION" >/dev/null 2>&1 ||
    gc compute network-endpoint-groups create "${SERVICE}-neg" --region "$REGION" \
      --network-endpoint-type serverless --cloud-run-service "$SERVICE"
  gc compute backend-services describe "${SERVICE}-backend" --global >/dev/null 2>&1 ||
    gc compute backend-services create "${SERVICE}-backend" --global \
      --load-balancing-scheme EXTERNAL_MANAGED --protocol HTTPS
  [[ "$(gc compute backend-services describe "${SERVICE}-backend" --global \
    --format 'value(backends[].group)')" == *"${SERVICE}-neg"* ]] ||
    gc compute backend-services add-backend "${SERVICE}-backend" --global \
      --network-endpoint-group "${SERVICE}-neg" --network-endpoint-group-region "$REGION"
  gc compute url-maps describe "${SERVICE}-lb" >/dev/null 2>&1 ||
    gc compute url-maps create "${SERVICE}-lb" --default-service "${SERVICE}-backend"
  gc compute ssl-certificates describe "${SERVICE}-cert" --global >/dev/null 2>&1 ||
    gc compute ssl-certificates create "${SERVICE}-cert" --global --domains "$DOMAIN"
  gc compute target-https-proxies describe "${SERVICE}-https" >/dev/null 2>&1 ||
    gc compute target-https-proxies create "${SERVICE}-https" \
      --url-map "${SERVICE}-lb" --ssl-certificates "${SERVICE}-cert"
  gc compute forwarding-rules describe "${SERVICE}-https-rule" --global >/dev/null 2>&1 ||
    gc compute forwarding-rules create "${SERVICE}-https-rule" --global \
      --load-balancing-scheme EXTERNAL_MANAGED --network-tier PREMIUM \
      --address "${SERVICE}-ip" --target-https-proxy "${SERVICE}-https" --ports 443
  echo "Point the DNS A record of ${DOMAIN} to:"
  gc compute addresses describe "${SERVICE}-ip" --global --format 'value(address)'
}

# Cloud Armor policy: OWASP rules plus a per-IP throttle on the unauthenticated auth endpoints.
# `rules create` only has --preview; `rules update` needs --no-preview to leave preview.
armor() {
  gc compute security-policies describe "$POLICY" >/dev/null 2>&1 ||
    gc compute security-policies create "$POLICY" --description "${SERVICE} edge policy"

  local create_preview=() update_preview=(--no-preview)
  if [[ -n "$ARMOR_PREVIEW" ]]; then
    create_preview=(--preview)
    update_preview=(--preview)
  fi

  upsert_rule() {
    local priority="$1"; shift
    if gc compute security-policies rules describe "$priority" --security-policy "$POLICY" >/dev/null 2>&1; then
      gc compute security-policies rules update "$priority" --security-policy "$POLICY" \
        "${update_preview[@]}" "$@"
    else
      gc compute security-policies rules create "$priority" --security-policy "$POLICY" \
        ${create_preview[@]+"${create_preview[@]}"} "$@"
    fi
  }

  upsert_rule 1000 --action throttle \
    --expression "request.path.matches('/v1/auth/.*') || request.path.matches('/v1/invitations/.*/accept')" \
    --rate-limit-threshold-count "$ARMOR_AUTH_LIMIT" --rate-limit-threshold-interval-sec 60 \
    --conform-action allow --exceed-action deny-429 --enforce-on-key ip
  local priority=2000
  for rule in sqli-v33-stable xss-v33-stable lfi-v33-stable rce-v33-stable protocolattack-v33-stable; do
    upsert_rule "$priority" --action deny-403 \
      --expression "evaluatePreconfiguredWaf('${rule}', {'sensitivity': 1})"
    priority=$((priority + 100))
  done

  gc compute backend-services update "${SERVICE}-backend" --global --security-policy "$POLICY"
}

run_step() {
  case "$1" in
    setup) setup ;;
    secrets) secrets ;;
    deploy) deploy ;;
    jobs) jobs ;;
    edge) edge ;;
    armor) armor ;;
    all) setup; secrets; jobs; deploy; edge; armor ;;
    *) echo "Unknown step: $1 (setup|secrets|deploy|jobs|edge|armor|all)" >&2; exit 1 ;;
  esac
}

run_step "${1:?step required}"
