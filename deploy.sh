#!/bin/bash

# PMF Tool AWS Deployment Script
set -e

STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo "🚀 Deploying PMF Tool to AWS Lambda (Stage: $STAGE, Region: $REGION)"

# Check if required tools are installed
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v serverless >/dev/null 2>&1 || { echo "❌ Serverless Framework is required. Install with: npm install -g serverless" >&2; exit 1; }

# Check if .env file exists
if [ ! -f ".env.$STAGE" ]; then
    echo "❌ Environment file .env.$STAGE not found!"
    echo "📝 Please create .env.$STAGE with your configuration"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.$STAGE | xargs)

# Validate required environment variables
if [ -z "$DATABASE_URL" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$RESEND_API_KEY" ]; then
    echo "❌ Missing required environment variables in .env.$STAGE"
    echo "Required: DATABASE_URL, OPENAI_API_KEY, RESEND_API_KEY"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🔨 Building application..."
npm run build

echo "🗃️ Generating Prisma client..."
npx prisma generate

echo "☁️ Deploying to AWS..."
serverless deploy --stage $STAGE --region $REGION --verbose

echo "📊 Getting deployment info..."
serverless info --stage $STAGE --region $REGION

# Get the API URL from the deployment
API_URL=$(serverless info --stage $STAGE --region $REGION | grep "endpoint:" | awk '{print $2}')

if [ ! -z "$API_URL" ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo "🌐 API URL: $API_URL"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update your frontend NEXT_PUBLIC_API_URL to: $API_URL"
    echo "2. Run database migrations: npm run db:migrate:deploy"
    echo "3. Test the API: curl $API_URL/health"
    echo ""
    echo "🔧 Useful commands:"
    echo "  View logs: serverless logs -f api --stage $STAGE"
    echo "  Remove stack: serverless remove --stage $STAGE"
else
    echo "⚠️ Deployment completed but couldn't retrieve API URL"
fi