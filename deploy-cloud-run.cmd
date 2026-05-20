@echo off
REM Deploy VibeMongo to Google Cloud Run

REM --- Deployment Configuration ---
SET PROJECT_ID=your_google_cloud_project_id
SET REGION=us-central1
SET REPO_NAME=vibemongo-repo
SET IMAGE_NAME=vibemongo
SET BUCKET_NAME=vibemongo-data-bucket

REM --- Application Environment Variables ---
SET APP_PORT=4000
SET APP_PASSWORD=admin
SET APP_ENCRYPTION_KEY=your_encryption_key_32_characters_here!
SET APP_AGENT_MODEL=gemini-3.1-flash-lite
SET APP_USE_VERTEXAI=1

echo Building and pushing container to Artifact Registry...
call gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%REPO_NAME%/%IMAGE_NAME%:latest

echo Deploying to Cloud Run...
call gcloud run deploy vibemongo-admin ^
  --image=%REGION%-docker.pkg.dev/%PROJECT_ID%/%REPO_NAME%/%IMAGE_NAME%:latest ^
  --region=%REGION% ^
  --allow-unauthenticated ^
  --port=%APP_PORT% ^
  --execution-environment=gen2 ^
  --add-volume=name=data-vol,type=cloud-storage,bucket=%BUCKET_NAME% ^
  --add-volume-mount=volume=data-vol,mount-path=/app/server/data ^
  --set-env-vars="PORT=%APP_PORT%,HOST=0.0.0.0,NODE_ENV=production,PASSWORD=%APP_PASSWORD%,ENCRYPTION_KEY=%APP_ENCRYPTION_KEY%,AGENT_MODEL=%APP_AGENT_MODEL%,GOOGLE_CLOUD_PROJECT=%PROJECT_ID%,GOOGLE_CLOUD_LOCATION=%REGION%,GOOGLE_GENAI_USE_VERTEXAI=%APP_USE_VERTEXAI%"

echo Deployment complete!

