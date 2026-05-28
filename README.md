# VibeMongo Admin — Documentation
![VibeMongo Admin](docs/images/agent_welcome.png)

> A modern, AI-first MongoDB administration dashboard powered by a triad of cutting-edge technologies: **Google Cloud Agent (ADK & Gemini)**, the **MongoDB MCP Server**, and **Arize Phoenix Cloud & MCP** for autonomous monitoring and LLM evaluation.

---

## 📚 Table of Contents

| Document | Description |
|----------|-------------|
| [Premium AI SRE Upgrades](./docs/PREMIUM_AI_SRE_UPGRADES.md) | **[NEW]** Deep-dive into Schema Migrator, ERD, Webhooks, Index Sanitizer, and Mock Gen |
| [Architecture Overview](./docs/ARCHITECTURE.md) | System design, component diagram, and data flow |
| [Client Guide](./docs/CLIENT.md) | Vue 3 frontend — setup, structure, and configuration |
| [Backend Guide](./docs/BACKEND.md) | Express API + Google ADK Agent — setup, structure, and configuration |
| [AI Agent Guide](./docs/AGENT.md) | Google ADK + MongoDB MCP Server integration deep-dive |
| [Deploy — Cloud Run](./docs/DEPLOY_CLOUD_RUN.md) | Step-by-step deploy to Google Cloud Run |
| [Deploy — Cloud Agent](./docs/DEPLOY_CLOUD_AGENT.md) | Deploy the AI Agent as a Google Cloud Agent Engine service |
| [Workflow Diagrams](./docs/WORKFLOWS.md) | Detailed sequence diagrams: VibeMongo ↔ ADK ↔ MCP ↔ MongoDB |


---
## Inspiration
Managing MongoDB databases using traditional GUI clients often involves writing complex, syntax-heavy aggregation pipelines just to get simple answers. For developers who are not MongoDB experts, writing these pipelines can be a huge time sink. Furthermore, monitoring database performance and identifying slow queries usually requires jumping into completely separate APM (Application Performance Monitoring) tools.

We were inspired to build a modern, web-based admin interface that combines the robust features of traditional database clients with the power of generative AI and real-time observability. Our goal was to create a "Vibe" where managing databases feels effortless, intuitive, and conversational, while also introducing **Autonomous Database SRE** capabilities.

## 🚀 Why VibeMongo? (The Autonomous DB SRE)

While traditional tools like MongoDB Compass offer solid administration, **VibeMongo** rethinks the database management experience by integrating generative AI and real-time observability deeply into the workflow:

1. **DB-Guardian Copilot (AI-Driven SRE)**
   - VibeMongo actively monitors query performance in real-time.
   - Using the **Arize Phoenix MCP**, it captures trace data and flags slow queries. The built-in AI agent (Google ADK) can then analyze the trace waterfall and suggest optimizations to turn slow `COLLSCAN` operations into efficient `IXSCAN` operations.
2. **AI Judge Evaluate (LLM-as-a-judge)**
   - Click "AI Judge Evaluate" on any trace span to instantly open the Chatbot. The Gemini Agent analyzes the raw input and output, scores its safety and optimality, and provides a human-readable explanation of what the database command actually did.
3. **Context-Aware AI Chat Sidebar**
   - Forget writing complex aggregation pipelines manually. Just ask the agent: *"Show me the top 5 products by revenue grouped by category in a pie chart."* 
   - The agent securely translates natural language to MongoDB aggregations via the **MongoDB MCP** and instantly visualizes the result using ECharts—right in your browser.
4. **One-Click Index Optimization**
   - Every collection view features an "**Optimize Index**" magic button that instantly triggers the AI to evaluate your current schema, query usage, and indexes to suggest performance enhancements.
4. **"Vibe" Aesthetics (Minimalist & Modern)**
   - Built on Vue 3 and Vite, it drops the clunky Java-like interfaces of legacy tools in favor of a sleek, glassmorphic, responsive, dark-mode native dashboard. 
5. **Full-Stack Feature Parity**
   - Supports Document CRUD, dynamic BSON parsing, complex schema analysis, mass deletion, multi-database connection management, and comprehensive zip-based Backup & Restore workflows.

## How we built it: The Tri-Partner Architecture

![VibeMongo Architecture Diagram](docs/images/vibemongo_architecture_diagram.png)

* **Frontend (UI/UX):** Vue 3 (Composition API) with Vite, styled with modern Element Plus and ECharts. We built a dynamic parsing engine that reads specific JSON blocks outputted by the AI agent to render interactive components on the fly.
* **Brain (Google Cloud Agent & Gemini):** We utilized the **Google Agent Development Kit (ADK)** and Google's highly capable **Gemini 3.1 Flash-Lite** model on Vertex AI to act as the central reasoning engine.
* **Execution (MongoDB MCP):** To bridge the AI agent with MongoDB securely, we integrated the official **MongoDB MCP Server** (`mongodb-mcp-server`). The Agent leverages this standardized Model Context Protocol to introspect schemas and execute aggregation pipelines dynamically based on the current active connection.
* **Observability & Evaluation (Arize Phoenix Cloud & MCP):** We integrated the **Arize Phoenix MCP** and `@arizeai/phoenix-otel` to capture OpenTelemetry traces of both MongoDB operations and LLM reasoning. When the user requests an "AI Judge Evaluation" or "Ask AI to Optimize", the UI fetches the trace data and sends it back to the Gemini Agent to provide human-readable, step-by-step diagnostic feedback directly in the chat interface.

---

## 📸 Screenshots

<details>
<summary>Click to view Screenshots</summary>

### Authentication & Connections
![Login](docs/images/login.png)
![Connections](docs/images/connections.png)
![Add Connection](docs/images/add_connection.png)
![Edit Connection](docs/images/edit_connection.png)
![Delete Connection](docs/images/delete_connection.png)

### Dashboard & Databases
![Connection Dashboard](docs/images/dashboard.png)
![Database Explorer](docs/images/db_explorer.png)
![Create Database](docs/images/create_database.png)
![Rename Database](docs/images/rename_database.png)
![Drop Database](docs/images/drop_database.png)
![Add Database User](docs/images/add_user.png)
![Database AI Analysis Loading](docs/images/db_analysis_loading.png)
![Database AI Analysis Dashboard](docs/images/db_analysis.png)
![Database AI Analysis Charts](docs/images/db_analysis_charts.png)
![MongoDB Atlas Cluster Metrics](docs/images/mongodb_atlas_clusters.png)

### Collections
![Collections View](docs/images/collections.png)
![Create Collection](docs/images/create_collection.png)
![Rename Collection](docs/images/rename_collection.png)
![Drop Collection](docs/images/drop_collection.png)
![Collection Schema Analyzer](docs/images/schema.png)

### Documents
![Query Console](docs/images/query_console.png)
![Quick Filter Builder](docs/images/filter_builder.png)
![Documents Table View](docs/images/documents.png)
![Documents List View](docs/images/documents_list.png)
![Document Editor](docs/images/document_editor.png)
![Insert New Document](docs/images/insert_document.png)

### Indexes
![Collection Indexes](docs/images/indexes.png)
![Create Index](docs/images/create_index.png)
![Edit Index](docs/images/edit_index.png)

### Backup & Restore
![Backup Database](docs/images/backup_database.png)
![Restore Database](docs/images/restore_database.png)

### AI Agent (MongoDB MCP)
![Agent Welcome](docs/images/agent_welcome.png)
![Agent Thinking State](docs/images/agent_thinking.png)
![Agent Databases Response](docs/images/agent_databases.png)
![Agent Autocomplete Support](docs/images/agent_autocomplete.png)
![Agent Schema Analysis](docs/images/agent_schema.png)
![Agent Data Query](docs/images/agent_table.png)
![Agent Data Visualization (Sidebar)](docs/images/agent_chart.png)
![Agent Data Visualization (Full Page)](docs/images/agent_chart_full.png)
![Agent Index Analysis](docs/images/agent_indexes.png)
![Agent Index Recommendations](docs/images/agent_indexes_recommendations.png)
![Agent Index Comparison](docs/images/agent_indexes_comparison.png)

### DB-Guardian (AI-Driven SRE)
![DB-Guardian Diagnostic Report](docs/images/guardian_diagnostic.png)
![DB-Guardian Resolution & Performance Chart](docs/images/guardian_resolution.png)

### AI Judge (Observability & Telemetry)
![AI Judge Trace Evaluation](docs/images/judge_trace_eval.png)
![AI Judge Diagnostic Summary](docs/images/judge_diagnostic_summary.png)
![AI Judge SRE Recommendations](docs/images/judge_recommendations.png)
![AI Judge Optimization Suggestion](docs/images/judge_optimize_frequency.png)
![AI Judge Caching Strategy Implementation](docs/images/judge_caching_strategy.png)
![AI Judge Trace Evaluation Trigger](docs/images/monitoring_trace_ai_evaluate.png)
![AI Judge Bottleneck Analysis Response](docs/images/monitoring_trace_ai_response.png)
![AI Judge Predictive Scaling Model](docs/images/monitoring_trace_ai_predictive.png)
![AI Judge Detailed Evaluation Prompt](docs/images/judge_trace_prompt.png)
![AI Judge SRE Breakdown Operation](docs/images/judge_breakdown_operation.png)
![AI Judge SRE Output & Score Assessment](docs/images/judge_breakdown_output_scoring.png)
![AI Judge Security & Privacy Audit](docs/images/judge_breakdown_scoring_security.png)
![AI Judge Data Leakage Assessment](docs/images/judge_breakdown_security_leakage.png)

### Observability Dashboard & Telemetry
![SRE Health Assessment & Real-Time Metrics](docs/images/monitoring_metrics.png)
![Resident Memory vs Database Connections](docs/images/monitoring_memory_connections.png)
![Arize Phoenix Observability Telemetry](docs/images/phoenix_observability_traces.png)
![Trace Latency Percentiles & Average Annotation Score](docs/images/phoenix_observability_latency.png)
![Model Token Usage Analysis](docs/images/phoenix_observability_token_usage.png)
![All Trace Spans Table Logs](docs/images/monitoring_traces_list.png)
![DB-Guardian Active Spans Alert Banner](docs/images/monitoring_alerts_list.png)
![Traces filtered list view](docs/images/monitoring_traces_filtered.png)
![Trace Detail Explorer Parent Span](docs/images/monitoring_trace_detail_parent.png)
![Trace Detail Explorer Sub-span Data](docs/images/monitoring_trace_detail_subspan.png)
![Trace Attributes Table Drawer](docs/images/monitoring_trace_attributes.png)
![Trace Gantt-Waterfall Bottleneck Visualizer](docs/images/monitoring_trace_waterfall.png)
![Arize Phoenix Portal Tracing Dashboard](docs/images/phoenix_dashboard_tracing.png)
![Arize Phoenix Portal Metrics Graphs](docs/images/phoenix_dashboard_metrics.png)
![Arize Phoenix Portal Trace Detail View](docs/images/phoenix_dashboard_trace_detail.png)
![Arize Phoenix Portal Tool Output Detail](docs/images/phoenix_dashboard_tool_output.png)

### Personalization (i18n & Theming)
![Internationalization](docs/images/i18n_menu.png)
![Light Mode](docs/images/theme_light.png)
![Dark Mode](docs/images/theme_dark.png)

### GCP Cloud Run Production Deployment
![GCP Cloud Run Observability Metrics](docs/images/gcp_cloud_run_metrics.png)
![GCP Cloud Run Live Logs](docs/images/gcp_cloud_run_logs.png)
![GCP Cloud Run Revisions List](docs/images/gcp_cloud_run_revisions.png)
![GCP Cloud Run Deploy Container Configuration](docs/images/gcp_cloud_run_deploy.png)

</details>

---

## 🏗️ Quick Start (Local Development)

### Prerequisites
- **Node.js** >= 20
- **pnpm** >= 9
- **MongoDB** (Atlas or local instance)
- **Google Cloud Project** with Vertex AI API enabled

### 1. Clone and install

```bash
git clone https://github.com/camtruong512/vibe-mongo-admin.git
cd vibe-mongo-admin
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials (see Backend Guide for details)
```

### 3. Run development servers

```bash
pnpm run dev
# Client → http://localhost:3000
# Backend → http://localhost:4000
```

---

## 🔑 Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Backend server port (default: `4000`) |
| `HOST` | Yes | Backend host (default: `0.0.0.0`) |
| `PASSWORD` | Yes | Admin dashboard password |
| `VITE_API_URL` | Yes | Frontend → Backend URL |
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP Project ID for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | Yes | Vertex AI region (e.g. `global`, `us-central1`) |
| `GOOGLE_GENAI_USE_VERTEXAI` | Yes | Set to `1` to use Vertex AI |
| `GOOGLE_API_KEY` | Conditional | Google API Key (if not using Vertex AI) |
| `AGENT_MODEL` | Yes | Gemini model name (e.g. `gemini-3.1-flash-lite`) |
| `ENCRYPTION_KEY` | Yes | 32-char key for encrypting MongoDB connection strings |
| `NODE_ENV` | Yes | `development` or `production` |
| `PHOENIX_PROJECT_NAME` | Yes | Arize Phoenix project name for tracing (Get from https://app.phoenix.arize.com) |
| `PHOENIX_COLLECTOR_ENDPOINT` | Yes | Arize Phoenix collector endpoint (E.g. https://app.phoenix.arize.com/s/your_workspace) |
| `PHOENIX_API_KEY` | Yes | Arize API Key for tracing (Get from https://app.phoenix.arize.com/settings?tab=api-keys) |

---

## 👤 Project Owner

- **Name:** Minh Truong
- **Email:** camtruong512@gmail.com
- **GitHub:** [camtruong512](https://github.com/camtruong512)

## 👤 Supporter

- **Name:** Tan Do
- **Email:** dmtan90@gmail.com
- **GitHub:** [dmtan90](https://github.com/dmtan90)

---

## 📝 License

This project is licensed under the **MIT License**.

See the [LICENSE](./LICENSE) file for more information.
