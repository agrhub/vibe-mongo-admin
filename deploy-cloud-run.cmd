@echo off
REM Deploy VibeMongo to Google Cloud Run

REM --- Deployment Configuration ---
SET PROJECT_ID=your_google_cloud_project_id
SET REGION=us-central1
SET REPO_NAME=vibemongo-repo
SET IMAGE_NAME=vibemongo
SET BUCKET_NAME=vibemongo-data-bucket

REM --- Azize Phoenix OTEL Environment Variables ---
SET PHOENIX_PROJECT_NAME=your_phoenix_project_name
SET PHOENIX_API_KEY=your_phoenix_api_key
SET PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your_phoenix_name_id

REM --- Application Environment Variables ---
SET APP_PASSWORD=admin
SET APP_ENCRYPTION_KEY=your_encryption_key_32_characters_here!
SET APP_AGENT_MODEL=gemini-3.1-flash-lite
SET GOOGLE_API_KEY=your_google_cloud_agent_api_key

echo Creating Artifact Registry repository if not exists...
call gcloud artifacts repositories create %REPO_NAME% --repository-format=docker --location=%REGION% --project=%PROJECT_ID% 2>nul || echo Repository already exists, skipping.

echo Creating Cloud Storage bucket if not exists...
call gcloud storage buckets create gs://%BUCKET_NAME% --project=%PROJECT_ID% --location=%REGION% 2>nul || echo Bucket already exists, skipping.

echo Building and pushing container to Artifact Registry...
call gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%REPO_NAME%/%IMAGE_NAME%:latest

echo Deploying to Cloud Run...
call gcloud run deploy vibemongo-admin ^
  --image=%REGION%-docker.pkg.dev/%PROJECT_ID%/%REPO_NAME%/%IMAGE_NAME%:latest ^
  --region=%REGION% ^
  --allow-unauthenticated ^
  --port=8080 ^
  --execution-environment=gen2 ^
  --max-instances=1 ^
  --add-volume=name=data-vol,type=cloud-storage,bucket=%BUCKET_NAME% ^
  --add-volume-mount=volume=data-vol,mount-path=/app/server/data ^
  --set-env-vars="HOST=0.0.0.0,NODE_ENV=production,PASSWORD=%APP_PASSWORD%,ENCRYPTION_KEY=%APP_ENCRYPTION_KEY%,AGENT_MODEL=%APP_AGENT_MODEL%,GOOGLE_CLOUD_PROJECT=%PROJECT_ID%,GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_API_KEY=%GOOGLE_API_KEY%,PHOENIX_PROJECT_NAME=%PHOENIX_PROJECT_NAME%,PHOENIX_API_KEY=%PHOENIX_API_KEY%,PHOENIX_COLLECTOR_ENDPOINT=%PHOENIX_COLLECTOR_ENDPOINT%"

echo Deployment complete!

