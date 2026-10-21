#!/usr/bin/env bash
# GClifts: AWS CLI + Agent Toolkit setup (new AWS experience, project Region us-east-2)
# Usage: bash setup-aws.sh [profile-name]   (default profile: gclifts)
set -euo pipefail
PROFILE="${1:-gclifts}"
REGION="us-east-2"

command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh

# Install the AWS CLI v2 with AWS's official installers if it's missing.
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
if ! command -v aws >/dev/null; then
  TMP="$(mktemp -d)"
  case "$(uname -s)" in
    Darwin)
      curl -fsSL "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "$TMP/AWSCLIV2.pkg"
      sudo installer -pkg "$TMP/AWSCLIV2.pkg" -target / ;;
    Linux)
      ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] && ARCH="aarch64"
      curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${ARCH}.zip" -o "$TMP/awscliv2.zip"
      unzip -q "$TMP/awscliv2.zip" -d "$TMP"
      sudo "$TMP/aws/install" ;;
    *) echo "Unsupported OS. On Windows, run: msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi"; exit 1 ;;
  esac
  rm -rf "$TMP"
fi
aws --version

echo "== Sign in (a browser window opens) =="
aws configure set region "$REGION" --profile "$PROFILE"
aws login --region "$REGION" --profile "$PROFILE"

echo "== Check the sign-in worked =="
aws sts get-caller-identity --profile "$PROFILE"

echo "== Agent Toolkit (only available in us-east-1; answer the prompts) =="
aws configure agent-toolkit --yes --region us-east-1 --profile "$PROFILE"

echo "== Check the toolkit =="
aws agent-toolkit list-available-skills --region us-east-1 --profile "$PROFILE" | head -40

cat <<MSG

LAST STEP: in each MCP config the wizard updated, find "aws-mcp" under
"mcpServers" and add (change nothing else):
  "env": { "AWS_MCP_PROXY_PROFILES": "$PROFILE" }
Then restart your AI tool.
MSG
