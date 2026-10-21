#!/usr/bin/env bash
# GClifts: AWS CLI + Agent Toolkit setup (new AWS experience, project Region us-east-2)
set -e
PROFILE="${1:-gclifts}"
REGION="us-east-2"

command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
if ! command -v aws >/dev/null; then
  curl -fsSL 'https://awscli.amazonaws.com/v2/install.sh' | bash
  export PATH="$HOME/.local/bin:$PATH"
  grep -q '.local/bin' "$HOME/.zshrc" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
fi
aws --version

echo "== Sign in (browser opens) =="
aws configure set region "$REGION" --profile "$PROFILE"
aws login --region "$REGION" --profile "$PROFILE"

echo "== Verify =="
aws sts get-caller-identity --profile "$PROFILE"

echo "== Agent Toolkit (only available in us-east-1; answer the prompts) =="
aws configure agent-toolkit --yes --region us-east-1 --profile "$PROFILE"

echo "== Verify toolkit =="
aws agent-toolkit list-available-skills --region us-east-1 --profile "$PROFILE" | head -40

cat <<MSG

LAST STEP: in each MCP config the wizard updated, find "aws-mcp" under
"mcpServers" and add (change nothing else):
  "env": { "AWS_MCP_PROXY_PROFILES": "$PROFILE" }
Then restart your AI tool.
MSG
