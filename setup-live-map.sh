#!/usr/bin/env bash
# GClifts live map and sign-in: creates (or reuses) the browser's AWS resources and writes config.js.
#   - Amazon Location Service API key: map tiles, routes and place search, read-only, localhost only
#   - AWS AppSync Events API with a "rides" namespace: carries the driver's live position to the rider
#   - Amazon Cognito user pool (auth.yaml, stack "gclifts-auth"): emails a code to verify each school email
# Safe to run again; existing resources are reused.
# Usage: bash setup-live-map.sh [profile-name]   (default: the default profile)
set -euo pipefail
REGION="us-east-2"
PROFILE_ARGS=()
[ -n "${1:-}" ] && PROFILE_ARGS=(--profile "$1")
# The +-expansion keeps macOS's bash 3.2 from treating an empty array as unset under set -u.
aws_(){ aws ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} --region "$REGION" "$@"; }

HERE="$(cd "$(dirname "$0")" && pwd)"
LOCATION_KEY_NAME="gclifts-web"
EVENTS_API_NAME="gclifts-live"

echo "== Location Service API key =="
if ! aws_ location describe-key --key-name "$LOCATION_KEY_NAME" >/dev/null 2>&1; then
  # Restricted to read-only map, route and place actions, called from the local dev server.
  # The production CloudFront site is allowed too; add any new hosted URL here and with update-key.
  aws_ location create-key --key-name "$LOCATION_KEY_NAME" --no-expiry \
    --description "GClifts browser key: map tiles, routes, place search (read-only, localhost referers)" \
    --restrictions '{"AllowActions":["geo-maps:GetTile","geo-maps:GetStaticMap","geo-routes:CalculateRoutes","geo-places:Geocode","geo-places:Autocomplete","geo-places:SearchText","geo-places:GetPlace"],"AllowResources":["arn:aws:geo-maps:'"$REGION"'::provider/default","arn:aws:geo-routes:'"$REGION"'::provider/default","arn:aws:geo-places:'"$REGION"'::provider/default"],"AllowReferers":["https://d3exvjki5n2jnm.cloudfront.net/*","http://127.0.0.1:8000/*","http://127.0.0.1:8001/*","http://localhost:8000/*","http://localhost:8001/*"]}' >/dev/null
fi
LOCATION_KEY="$(aws_ location describe-key --key-name "$LOCATION_KEY_NAME" --query Key --output text)"

echo "== AppSync Events API =="
API_ID="$(aws_ appsync list-apis --query "apis[?name=='$EVENTS_API_NAME'].apiId | [0]" --output text)"
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  # API key auth until Cognito sign-in exists; each ride's channel name is a random UUID.
  API_ID="$(aws_ appsync create-api --name "$EVENTS_API_NAME" \
    --event-config '{"authProviders":[{"authType":"API_KEY"}],"connectionAuthModes":[{"authType":"API_KEY"}],"defaultPublishAuthModes":[{"authType":"API_KEY"}],"defaultSubscribeAuthModes":[{"authType":"API_KEY"}]}' \
    --query api.apiId --output text)"
fi
if ! aws_ appsync get-channel-namespace --api-id "$API_ID" --name rides >/dev/null 2>&1; then
  aws_ appsync create-channel-namespace --api-id "$API_ID" --name rides >/dev/null
fi
EVENTS_HTTP="$(aws_ appsync get-api --api-id "$API_ID" --query 'api.dns.HTTP' --output text)"
EVENTS_REALTIME="$(aws_ appsync get-api --api-id "$API_ID" --query 'api.dns.REALTIME' --output text)"

# Reuse a key with more than 30 days left; otherwise make a new one that lasts 365 days (the maximum).
SOON=$(( $(date +%s) + 30*86400 ))
EVENTS_KEY="$(aws_ appsync list-api-keys --api-id "$API_ID" --query "apiKeys[?expires>\`$SOON\`].id | [0]" --output text)"
if [ "$EVENTS_KEY" = "None" ] || [ -z "$EVENTS_KEY" ]; then
  EVENTS_KEY="$(aws_ appsync create-api-key --api-id "$API_ID" --description "GClifts browser" \
    --expires $(( $(date +%s) + 365*86400 )) --query apiKey.id --output text)"
fi

echo "== Cognito sign-in =="
# Creates the stack the first time and updates it if auth.yaml changed; no changes is fine.
aws_ cloudformation deploy --template-file "$HERE/auth.yaml" --stack-name gclifts-auth \
  --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset >/dev/null
auth_out(){ aws_ cloudformation describe-stacks --stack-name gclifts-auth --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
USER_POOL_ID="$(auth_out UserPoolId)"
CLIENT_ID="$(auth_out ClientId)"

cat > config.js <<EOF
// Written by setup-live-map.sh. Browser keys are visible to anyone who opens the page, so they're
// restricted on the AWS side. Not committed; run the script to recreate it.
window.GCLIFTS_CONFIG={
  region:"$REGION",
  locationKey:"$LOCATION_KEY",
  eventsHttp:"$EVENTS_HTTP",
  eventsRealtime:"$EVENTS_REALTIME",
  eventsKey:"$EVENTS_KEY",
  userPoolId:"$USER_POOL_ID",
  clientId:"$CLIENT_ID"
};
EOF
echo "Wrote config.js (AppSync API $API_ID, Cognito user pool $USER_POOL_ID)"
