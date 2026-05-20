@echo off
REM Deploy MongoAgent to Google Cloud Agent Engine (Vertex AI)

SET AGENT_NAME=MongoAgent
SET REGION=us-central1
SET CONFIG_FILE=agent.yaml
SET AGENT_DIR=server\src\agent

echo Deploying Agent to Vertex AI...
cd %AGENT_DIR%

call gcloud beta ai agents deploy ^
  --agent-name="%AGENT_NAME%" ^
  --region="%REGION%" ^
  --config="%CONFIG_FILE%"

echo Deployment complete!
