#!/bin/bash
# Deploy VibeMongo to Google Cloud Run

# --- Deployment Configuration ---
PROJECT_ID="your_google_cloud_project_id"
REGION="us-central1"
REPO_NAME="vibemongo-repo"
IMAGE_NAME="vibemongo"
BUCKET_NAME="vibemongo-data-bucket"

# --- Application Environment Variables ---
APP_PASSWORD="admin"
APP_ENCRYPTION_KEY="your_encryption_key_32_characters_here!"
APP_AGENT_MODEL="gemini-3.1-flash-lite"

echo "Creating Artifact Registry repository if not exists..."
gcloud artifacts repositories create ${REPO_NAME} --repository-format=docker --location=${REGION} --project=${PROJECT_ID} 2>/dev/null || echo "Repository already exists, skipping."

echo "Creating Cloud Storage bucket if not exists..."
gcloud storage buckets create gs://${BUCKET_NAME} --project=${PROJECT_ID} --location=${REGION} 2>/dev/null || echo "Bucket already exists, skipping."

echo "Building and pushing container to Artifact Registry..."
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest

echo "Deploying to Cloud Run..."
gcloud run deploy vibemongo-admin \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest \
  --region=${REGION} \
  --allow-unauthenticated \
  --port=8080 \
  --execution-environment=gen2 \
  --max-instances=1 \
  --add-volume=name=data-vol,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount=volume=data-vol,mount-path=/app/server/data \
  --set-env-vars="HOST=0.0.0.0,NODE_ENV=production,PASSWORD=${APP_PASSWORD},ENCRYPTION_KEY=${APP_ENCRYPTION_KEY},AGENT_MODEL=${APP_AGENT_MODEL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=1"


echo "Deployment complete!"
