# VibeMongo Admin — Documentation
![Connection Dashboard](docs/images/dashboard.png)

> A modern, AI-first MongoDB administration dashboard powered by a triad of cutting-edge technologies: **Google Cloud Agent (ADK & Gemini)**, the **MongoDB MCP Server**, and **Arize Phoenix Cloud & MCP** for autonomous monitoring and LLM evaluation.

---

## 📚 Table of Contents

| Document | Description |
|----------|-------------|
| [Architecture Overview](./docs/ARCHITECTURE.md) | System design, component diagram, and data flow |
| [Client Guide](./docs/CLIENT.md) | Vue 3 frontend — setup, structure, and configuration |
| [Backend Guide](./docs/BACKEND.md) | Express API + Google ADK Agent — setup, structure, and configuration |
| [AI Agent Guide](./docs/AGENT.md) | Google ADK + MongoDB MCP Server integration deep-dive |
| [Deploy — Cloud Run](./docs/DEPLOY_CLOUD_RUN.md) | Step-by-step deploy to Google Cloud Run |
| [Deploy — Cloud Agent](./docs/DEPLOY_CLOUD_AGENT.md) | Deploy the AI Agent as a Google Cloud Agent Engine service |
| [Workflow Diagrams](./docs/WORKFLOWS.md) | Detailed sequence diagrams: VibeMongo ↔ ADK ↔ MCP ↔ MongoDB |

---

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

---

## 📸 Screenshots

<details>
<summary>Click to view Screenshots</summary>

### Authentication & Connections
![Login](docs/images/login.png)
![Connections](docs/images/connections.png)
![Add Connection](docs/images/add_connection.png)
![Edit Connection](docs/images/edit_connection.png)

### Dashboard & Databases
![Connection Dashboard](docs/images/dashboard.png)
![Create Database](docs/images/create_database.png)
![Rename Database](docs/images/rename_database.png)

### Collections
![Collections View](docs/images/collections.png)
![Create Collection](docs/images/create_collection.png)
![Rename Collection](docs/images/rename_collection.png)

### Documents
![Documents View](docs/images/documents.png)
![Document Editor](docs/images/document_editor.png)
![Insert New Document](docs/images/insert_document.png)
![Quick Filter Builder](docs/images/filter_builder.png)

### Indexes
![Collection Indexes](docs/images/indexes.png)
![Create Index](docs/images/create_index.png)
![Edit Index](docs/images/edit_index.png)

### Backup & Restore
![Backup Database](docs/images/backup_database.png)
![Restore Database](docs/images/restore_database.png)

### AI Agent (MongoDB MCP)
![Agent Welcome](docs/images/agent_welcome.png)
![Agent Schema Analysis](docs/images/agent_schema.png)
![Agent Data Query](docs/images/agent_table.png)
![Agent Data Visualization](docs/images/agent_chart.png)

### Personalization (i18n & Theming)
![Internationalization](docs/images/i18n_menu.png)
![Light Mode](docs/images/theme_light.png)
![Dark Mode](docs/images/theme_dark.png)

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
| `HOST` | Yes | Backend host (default: `localhost`) |
| `PASSWORD` | Yes | Admin dashboard password |
| `VITE_API_URL` | Yes | Frontend → Backend URL |
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP Project ID for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | Yes | Vertex AI region (e.g. `global`, `us-central1`) |
| `GOOGLE_GENAI_USE_VERTEXAI` | Yes | Set to `1` to use Vertex AI |
| `GOOGLE_API_KEY` | Conditional | Google API Key (if not using Vertex AI) |
| `AGENT_MODEL` | Yes | Gemini model name (e.g. `gemini-3.1-flash-lite`) |
| `ENCRYPTION_KEY` | Yes | 32-char key for encrypting MongoDB connection strings |
| `NODE_ENV` | Yes | `development` or `production` |

---

## 📝 License

This project is licensed under the **MIT License**.

See the [LICENSE](./LICENSE) file for more information.
