# Backend Guide

The VibeMongo Admin backend is a robust API built with Node.js, Express, and TypeScript. It handles direct MongoDB interactions, connection string encryption, and acts as the orchestrator for the Google ADK AI Agent.

## 📂 Project Structure

```text
server/
├── backups/                # Local directory for generated DB backups
├── data/                   # SQLite and NeDB datastores
├── src/
│   ├── agent/              # Google ADK integration
│   │   ├── tools/          # MCP and DB tool wrappers
│   │   ├── agent.ts        # Agent orchestration
│   │   └── prompts.ts      # LLM System Prompts
│   ├── routes/             # Express API routes
│   │   ├── api/            # API endpoints (agent, db, etc)
│   │   ├── api.js          # Route aggregator
│   │   └── common.js       # Shared route utilities
│   ├── services/           # Core business logic
│   │   ├── AgentChatService.ts
│   │   ├── ConnectionStore.ts
│   │   └── MongoService.ts
│   ├── types/              # TypeScript declarations
│   ├── utils/              # Helpers (encryption, monitoring)
│   └── index.ts            # Server entry point
├── package.json            # Server dependencies
└── tsconfig.json           # TypeScript configuration
```

## 🚀 Key Technologies

- **Express 4:** Fast, unopinionated web framework.
- **TypeScript:** Typed JavaScript for robust development.
- **MongoDB Node.js Driver:** Official driver for direct database interactions.
- **SQLite (sqlite3):** Persistent, encrypted storage for user connection profiles.
- **NeDB:** Lightweight document store for server monitoring statistics.
- **Google ADK & MCP:** Integration for the AI Agent (see [Agent Guide](./AGENT.md)).

## ⚙️ Configuration & Environment

The backend requires several environment variables, defined in the root `.env` file:

```env
# Server Binding
PORT=4000
HOST=localhost
CONTEXT=""

# Security
PASSWORD=admin
ENCRYPTION_KEY=your_encryption_key_32_characters_here!

# AI Agent Configuration
AGENT_MODEL=gemini-3.1-flash-lite
GOOGLE_CLOUD_PROJECT=your_google_cloud_project_id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=1
```

> **Security Note:** The `ENCRYPTION_KEY` is crucial. It encrypts the MongoDB connection strings before saving them to the SQLite `ConnectionStore`. If this key changes, existing saved connections will be unreadable.

## 🛠️ Development

To run the server in development mode using `tsx` (which automatically transpiles TS and watches for changes):

```bash
cd server
pnpm install
pnpm run dev
```

The server will be available at `http://localhost:4000`.

## 📦 Building for Production

Compile the TypeScript source to pure JavaScript:

```bash
cd server
pnpm run build
```

This generates a `dist/` folder containing the compiled code. Start the production server using:

```bash
pnpm run start
```
