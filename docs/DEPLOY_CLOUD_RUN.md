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
     --port=4000 \
     --execution-environment=gen2 \
     --add-volume=name=data-vol,type=cloud-storage,bucket=vibemongo-data-bucket \
     --add-volume-mount=volume=data-vol,mount-path=/app/server/data \
     --set-env-vars="PORT=4000,HOST=0.0.0.0,NODE_ENV=production,PASSWORD=your_secure_password,ENCRYPTION_KEY=32_character_secure_key_here!!!!,AGENT_MODEL=gemini-3.1-flash-lite,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,GOOGLE_GENAI_USE_VERTEXAI=1"
   ```

> **Note:** Because VibeMongo uses Google Vertex AI under the hood (`GOOGLE_GENAI_USE_VERTEXAI=1`), deploying to Cloud Run inside the same Google Cloud Project automatically inherits the Default Compute Service Account credentials, so no raw API keys are required!

## ✅ Step 4: Verification
Upon successful deployment, the CLI will output a Service URL (e.g., `https://vibemongo-admin-xxxxx.a.run.app`).
Visit this URL, log in with your configured `PASSWORD`, and begin managing your databases.
