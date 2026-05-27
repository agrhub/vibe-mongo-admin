# Deploying to Google Cloud Run

Google Cloud Run is the recommended platform for deploying VibeMongo Admin. It is fully managed, highly scalable, and securely handles the containerized backend and compiled frontend.

## 📦 Architecture Overview for Cloud Run

When deployed to Cloud Run, VibeMongo operates as a single unified container:
- The **Vue 3 Client** is built into static files (`client/dist`).
- The **Express Backend** serves both the REST API and the static client files.
- Persistent state (Connection configurations) requires a **Cloud Storage FUSE** mount or **Cloud SQL** (if adapting the connection store). By default, the SQLite store `server/data` requires a persistent volume.

## 🚀 Prerequisites

1. Install the [Google Cloud CLI (gcloud)](https://cloud.google.com/sdk/docs/install).
2. Authenticate: `gcloud auth login`.
3. Enable required APIs:
   ```bash
   gcloud services enable run.googleapis.com \
                          artifactregistry.googleapis.com \
                          cloudbuild.googleapis.com
   ```

## 🐳 Step 1: Containerization

VibeMongo Admin runs efficiently inside a Docker container. Create a `Dockerfile` in the root directory:

```dockerfile
# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json client/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY client/ ./
RUN pnpm run build

# Stage 2: Build Server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json server/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY server/ ./
RUN pnpm run build

# Stage 3: Production Release
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm

# Copy Server
COPY --from=server-builder /app/server/package*.json /app/server/pnpm-lock.yaml ./server/
WORKDIR /app/server
RUN pnpm install --prod

COPY --from=server-builder /app/server/dist ./dist

# Copy compiled Client to expected location
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose Port
EXPOSE 4000

# Start
CMD ["node", "dist/index.js"]
```

## 🛠️ Step 2: Build and Push to Artifact Registry

Alternatively to manual steps below, you can run the provided automated deploy scripts:
- **Linux/macOS:** `./deploy-cloud-run.sh`
- **Windows:** `deploy-cloud-run.cmd`

*(Be sure to update the `PROJECT_ID` inside the scripts before running!)*

### Manual Steps:

0. **Enable required Google Cloud APIs:**
   Make sure all necessary services are enabled on your project:
   ```bash
   gcloud services enable cloudscheduler.googleapis.com \
     run.googleapis.com \
     iam.googleapis.com \
     storage.googleapis.com \
     artifactregistry.googleapis.com \
     --project=YOUR_PROJECT_ID
   ```

1. **Create an Artifact Registry repository:**
   ```bash
   gcloud artifacts repositories create vibemongo-repo \
       --repository-format=docker \
       --location=us-central1
   ```

2. **Submit the build to Cloud Build:**
   ```bash
   gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vibemongo-repo/vibemongo:latest
   ```

## 🌐 Step 3: Deploy to Cloud Run

Deploy the container using the CLI. Since VibeMongo requires a persistent `data/` directory for SQLite connections, we map a Cloud Storage bucket using volume mounts.

1. **Create a Cloud Storage bucket for persistence:**
   ```bash
   gcloud storage buckets create gs://vibemongo-data-bucket --location=us-central1
   ```

2. **Deploy the service:**
   ```bash
   gcloud run deploy vibemongo-admin \
     --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vibemongo-repo/vibemongo:latest \
     --region=us-central1 \
     --allow-unauthenticated \
     --port=8080 \
     --execution-environment=gen2 \
     --max-instances=1 \
     --add-volume=name=data-vol,type=cloud-storage,bucket=vibemongo-data-bucket \
     --add-volume-mount=volume=data-vol,mount-path=/app/server/data \
     --set-env-vars="HOST=0.0.0.0,NODE_ENV=production,PASSWORD=your_secure_password,ENCRYPTION_KEY=32_character_secure_key_here!!!!,AGENT_MODEL=gemini-3.1-flash-lite,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_API_KEY=your_google_cloud_agent_api_key,PHOENIX_PROJECT_NAME=your_phoenix_project_name,PHOENIX_API_KEY=your_phoenix_api_key,PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your_phoenix_name_id"
   ```

> **Note:** Because VibeMongo uses Google Vertex AI under the hood (`GOOGLE_GENAI_USE_VERTEXAI=1`), deploying to Cloud Run inside the same Google Cloud Project automatically inherits the Default Compute Service Account credentials, so no raw API keys are required!

## ✅ Step 4: Verification
Upon successful deployment, the CLI will output a Service URL (e.g., `https://vibemongo-admin-xxxxx.a.run.app`).
Visit this URL, log in with your configured `PASSWORD`, and begin managing your databases.

---

## ⏱️ Continuous Backend Monitoring on Cloud Run

Because Google Cloud Run scales instances down to zero when idle, standard Node.js background tickers (`setInterval`) will pause. VibeMongo offers three powerful built-in solutions to ensure continuous SRE database monitoring and Arize Phoenix trace telemetry aggregation:

### Solution A: Proactive Telemetry Trigger (Zero Config)
No action is required! When any user opens the **Observability** or **Monitoring** tabs in the Vue client, the server dynamically checks the freshness of stored NeDB records. If they are older than 35 seconds, a live metrics aggregation sweep is triggered synchronously on-demand. This guarantees that **active users always see fresh, accurate telemetry** without any cloud configuration.

---

### Solution B: Google Cloud Scheduler Cron Trigger (Recommended for Services)
To keep historical metrics flowing continuously in NeDB even when the dashboard is closed, you can set up a **Google Cloud Scheduler** job to ping the unauthenticated POST trigger endpoint `/api/monitoring/trigger` on a schedule.

To configure this via the `gcloud` CLI:
```bash
gcloud scheduler jobs create http vibemongo-monitoring-cron \
  --schedule="*/5 * * * *" \
  --uri="https://vibemongo-admin-xxxxx.a.run.app/api/monitoring/trigger" \
  --http-method=POST \
  --location=us-central1 \
  --description="Trigger VibeMongo server and Phoenix telemetry metrics synchronization"
```
*(Replace `https://vibemongo-admin-xxxxx.a.run.app` with your actual Cloud Run service URL.)*

---

### Solution C: Standalone Cloud Run Jobs (Decoupled Batch execution)
If you prefer to run database telemetry updates inside isolated, dedicated task containers rather than long-running services, you can deploy a **Cloud Run Job** using our pre-packaged CLI command.

1. **Create and deploy the Cloud Run Job:**
   ```bash
   gcloud run jobs deploy vibemongo-monitor-job \
     --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/vibemongo-repo/vibemongo:latest \
     --command="npm" \
     --args="run,monitor:prod" \
     --region=us-central1 \
     --project=YOUR_PROJECT_ID \
     --add-volume=name=data-vol,type=cloud-storage,bucket=vibemongo-data-bucket \
     --add-volume-mount=volume=data-vol,mount-path=/app/server/data \
     --set-env-vars="HOST=0.0.0.0,NODE_ENV=production,PASSWORD=your_secure_password,ENCRYPTION_KEY=32_character_secure_key_here!!!!,AGENT_MODEL=gemini-3.1-flash-lite,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_API_KEY=your_google_cloud_agent_api_key,PHOENIX_PROJECT_NAME=your_phoenix_project_name,PHOENIX_API_KEY=your_phoenix_api_key,PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your_phoenix_name_id"
   ```

2. **Schedule the Job via Cloud Scheduler (Idempotent Create/Update):**
   To avoid scripting errors if the schedule already exists, use an idempotent creation pattern:

   **For Linux/macOS (Bash shell):**
   ```bash
   if ! gcloud scheduler jobs create http vibemongo-job-scheduler \
     --schedule="*/5 * * * *" \
     --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/vibemongo-monitor-job:run" \
     --http-method=POST \
     --oauth-service-account-email="YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --location=us-central1 \
     --project=YOUR_PROJECT_ID 2>/dev/null; then
     gcloud scheduler jobs update http vibemongo-job-scheduler \
       --schedule="*/5 * * * *" \
       --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/vibemongo-monitor-job:run" \
       --http-method=POST \
       --oauth-service-account-email="YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
       --location=us-central1 \
       --project=YOUR_PROJECT_ID
   fi
   ```

   **For Windows (CMD Prompt):**
   ```cmd
   call gcloud scheduler jobs create http vibemongo-job-scheduler --schedule="*/5 * * * *" --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/vibemongo-monitor-job:run" --http-method=POST --oauth-service-account-email="YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" --location=us-central1 --project=YOUR_PROJECT_ID 2>nul
   if %ERRORLEVEL% neq 0 (
     call gcloud scheduler jobs update http vibemongo-job-scheduler --schedule="*/5 * * * *" --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/vibemongo-monitor-job:run" --http-method=POST --oauth-service-account-email="YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" --location=us-central1 --project=YOUR_PROJECT_ID
   )
   ```

---

## 💾 Persistent Database Backups on Cloud Run

VibeMongo features an advanced **O(1) Memory Complexity Streaming Backup & Restore** system designed specifically for highly constrained cloud environments:

1. **Persistent Location:**
   Backups are written to `/app/server/data/backups/`. Since `/app/server/data` is mounted to your **Google Cloud Storage Bucket** via FUSE, all database backups are permanently persisted and will survive any Cloud Run instance restarts or scale-to-zero events.

2. **Streamed Architecture:**
   - **Backups:** MongoDB documents are streamed cursor-by-cursor directly to the disk, keeping RAM consumption flat regardless of collection size.
   - **Restores:** ZIP archives are decompressed to disk and parsed line-by-line in batches of 500 documents, completely eliminating Out-Of-Memory (OOM) risks.

