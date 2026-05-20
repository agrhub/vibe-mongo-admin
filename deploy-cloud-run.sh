#!/bin/bash
# Deploy VibeMongo to Google Cloud Run

# --- Deployment Configuration ---
PROJECT_ID="your_google_cloud_project_id"
REGION="us-central1"
REPO_NAME="vibemongo-repo"
IMAGE_NAME="vibemongo"
BUCKET_NAME="vibemongo-data-bucket"

# --- Application Environment Variables ---
APP_PORT="4000"
APP_PASSWORD="admin"
APP_ENCRYPTION_KEY="your_encryption_key_32_characters_here!"
APP_AGENT_MODEL="gemini-3.1-flash-lite"
APP_USE_VERTEXAI="1"

echo "Building and pushing container to Artifact Registry..."
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest

echo "Deploying to Cloud Run..."
gcloud run deploy vibemongo-admin \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest \
  --region=${REGION} \
  --allow-unauthenticated \
  --port=${APP_PORT} \
  --execution-environment=gen2 \
  --add-volume=name=data-vol,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount=volume=data-vol,mount-path=/app/server/data \
  --set-env-vars="PORT=${APP_PORT},HOST=0.0.0.0,NODE_ENV=production,PASSWORD=${APP_PASSWORD},ENCRYPTION_KEY=${APP_ENCRYPTION_KEY},AGENT_MODEL=${APP_AGENT_MODEL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GOOGLE_GENAI_USE_VERTEXAI=${APP_USE_VERTEXAI}"


echo "Deployment complete!"
