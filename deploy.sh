#!/bin/bash

# PMF Tool — Deploy API to AWS Lambda
set -e

REGION=${1:-ap-south-1}

echo "Deploying PMF Tool API to AWS Lambda (Region: $REGION)"

command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }
command -v serverless >/dev/null 2>&1 || { echo "Serverless Framework is required. Install with: npm install -g serverless" >&2; exit 1; }

if [ ! -f ".env" ]; then
    echo "Environment file .env not found!"
    echo "Create .env with DATABASE_URL, OPENAI_API_KEY, RESEND_API_KEY, etc."
    exit 1
fi

# Save and unset NODE_ENV so npm installs devDependencies (esbuild, prisma, tsc)
SAVED_NODE_ENV="$NODE_ENV"
unset NODE_ENV

export $(grep -v '^#' .env | grep -v '^NODE_ENV' | xargs)

if [ -z "$DATABASE_URL" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$RESEND_API_KEY" ]; then
    echo "Missing required environment variables in .env"
    echo "Required: DATABASE_URL, OPENAI_API_KEY, RESEND_API_KEY"
    exit 1
fi

echo "Installing dependencies..."
npm ci

# Restore NODE_ENV for the Lambda environment vars
export NODE_ENV="${SAVED_NODE_ENV:-production}"

echo "Building Lambda bundle..."
npm run build:lambda

echo "Deploying to AWS..."
serverless deploy --region $REGION --verbose

echo "Getting deployment info..."
serverless info --region $REGION

API_URL=$(serverless info --region $REGION 2>/dev/null | grep -o 'https://[^ ]*' | head -1)

if [ ! -z "$API_URL" ]; then
    echo ""
    echo "Deployment successful!"
    echo "API URL: $API_URL"
    echo ""
    echo "Next steps:"
    echo "1. Set NEXT_PUBLIC_API_URL=$API_URL in your Vercel project env vars"
    echo "2. Run migrations: npx prisma migrate deploy"
    echo "3. Test: curl $API_URL/health"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    serverless logs -f api"
    echo "  Remove stack: serverless remove"
else
    echo "Deployment completed but couldn't retrieve API URL. Check serverless info."
fi
