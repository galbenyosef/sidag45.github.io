#!/usr/bin/env bash
# Deploys the Voice of the World backend to AWS.
#   First time:   ./deploy.sh                      (asks a few questions, saves answers to samconfig.toml)
#   Later:        ./deploy.sh
#   New origins:  ./deploy.sh "https://your-site.vercel.app,http://localhost:3000"
set -euo pipefail
cd "$(dirname "$0")"
command -v sam >/dev/null || { echo "Install the AWS SAM CLI first: brew install aws-sam-cli"; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "AWS isn't signed in. Run: aws configure   (or aws sso login)"; exit 1; }

sam build
if [ ! -f samconfig.toml ]; then
  sam deploy --guided --stack-name voice-of-the-world --region us-east-1 --capabilities CAPABILITY_IAM
elif [ -n "${1:-}" ]; then
  sam deploy --parameter-overrides "AllowedOrigins=$1"
else
  sam deploy
fi

STACK=$(grep -E '^stack_name' samconfig.toml | head -1 | cut -d'"' -f2)
REGION=$(grep -E '^region' samconfig.toml | head -1 | cut -d'"' -f2)
echo
aws cloudformation describe-stacks --stack-name "${STACK:-voice-of-the-world}" --region "${REGION:-us-east-1}" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
echo "Next: paste ApiUrl into <meta name=\"vow-api\" content=\"…\"> in ../index.html"
