#!/bin/bash
# Deploy MongoAgent to Google Cloud Agent Engine (Vertex AI)

AGENT_NAME="MongoAgent"
REGION="us-central1"
CONFIG_FILE="agent.yaml"
AGENT_DIR="server/src/agent"

echo "Deploying Agent to Vertex AI..."
cd $AGENT_DIR

gcloud beta ai agents deploy \
  --agent-name="${AGENT_NAME}" \
  --region="${REGION}" \
  --config="${CONFIG_FILE}"

echo "Deployment complete!"
