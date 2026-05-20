# Deploying the AI Agent with Google Cloud Agent Engine

VibeMongo uses the `@google/adk` (Agent Development Kit). While it runs perfectly embedded inside the Express backend, you can also deploy the agent definition as a standalone **Google Cloud Agent Engine** service for enterprise scaling, independent monitoring, and specialized tool orchestration.

## 🧠 Why Standalone Agent Engine?
- **Decoupling:** Offload LLM inference and session management from the Node.js API server.
- **Observability:** Native integration with Vertex AI Agent monitoring dashboards.
- **Scalability:** Scale database execution and LLM execution independently.

## 📦 Step 1: Extract the Agent Definition

If deploying to Agent Engine, you need to package the `agent.ts`, `prompts.ts`, and `tools/` into a dedicated deployment unit.

Create a new `agent.yaml` configuration in the `server/src/agent` folder:

```yaml
agent:
  name: "MongoAgent"
  model: "gemini-3.1-flash-lite"
  instruction_file: "prompts.ts"
  entrypoint: "agent.ts"
  tools:
    - type: "function_tool"
      source: "tools/mongo.tools.ts"
```

## ☁️ Step 2: Push Agent to Vertex AI

Alternatively to the manual steps below, you can run the provided automated deploy scripts from the project root:
- **Linux/macOS:** `./deploy-cloud-agent.sh`
- **Windows:** `deploy-cloud-agent.cmd`

*(Be sure to update the `REGION` inside the scripts if necessary!)*

### Manual Steps:

Ensure your `gcloud` is authenticated and configured to your target project.

```bash
# Navigate to the agent directory
cd server/src/agent

# Deploy the agent configuration to Vertex AI
gcloud beta ai agents deploy \
  --agent-name="MongoAgent" \
  --region="us-central1" \
  --config="agent.yaml"
```

## 🔄 Step 3: Configure VibeMongo to use Remote Agent

Once the agent is deployed as a managed service on Vertex AI, you need to configure the VibeMongo Express backend to talk to the Cloud Agent API instead of the `InMemoryRunner`.

1. **Update `.env`:**
   Add the Agent ID provided by the deployment step.
   ```env
   REMOTE_AGENT_ID=projects/YOUR_PROJECT/locations/us-central1/agents/YOUR_AGENT_ID
   ```

2. **Modify `agent.ts` to use `CloudRunner` (Concept):**
   *(Note: This requires swapping the `InMemoryRunner` to a remote runner supported by the ADK or Vertex SDK)*

   ```typescript
   import { RemoteAgentRunner } from '@google/adk';

   const runner = process.env.REMOTE_AGENT_ID 
     ? new RemoteAgentRunner({ agentId: process.env.REMOTE_AGENT_ID }) 
     : new InMemoryRunner({ agent: rootAgent, appName: 'MongoAgent' });
   ```

## 🔐 Security Considerations

When the Agent is running remotely in Vertex AI, it needs permission to talk back to your MongoDB databases. 
If your MongoDB is hosted in a private VPC, ensure your Vertex AI Agent is configured to use **VPC Peering** or **Private Service Connect** to reach the MongoDB instances securely without traversing the public internet.
