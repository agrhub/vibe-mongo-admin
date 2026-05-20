# AI Agent & MCP Integration Guide

VibeMongo features an advanced AI Database Administrator Assistant built on the **Google Agent Development Kit (ADK)** and the **Model Context Protocol (MCP)**.

## 🧠 Architecture Concept

The AI agent bridges the gap between natural language and complex MongoDB operations. 

1. **User asks:** *"Show me the top 5 users by age"*
2. **Google ADK Agent (Gemini)** interprets the request.
3. The Agent decides to use the `aggregatePipeline` tool.
4. The Tool invocation is sent over **Standard I/O (stdio)** using the **MCP SDK** to a running `mongodb-mcp-server` subprocess.
5. The MCP server executes the query securely against the active MongoDB instance.
6. The Agent receives the data, formats it into a JSON block for charting, and replies to the user.

## 🛠️ The Tool Layer (`server/src/agent/tools/mongo.tools.ts`)

Instead of writing custom MongoDB execution code for every AI tool, VibeMongo leverages the official `mongodb-mcp-server`.

### 1. Dynamic MCP Connection
When a user switches active databases in the UI, the backend stores that connection. When the Agent needs to act, `mongo.tools.ts` dynamically spawns the MCP server using `npx`:

```typescript
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "mongodb-mcp-server"],
  env: {
    ...process.env,
    MDB_MCP_CONNECTION_STRING: uri // The decrypted active connection string
  }
});
```

### 2. Fallback Mechanism
If the MCP server fails to spawn, the tools automatically fall back to using the direct `MongoService` (MongoDB Node Driver) implementation ensuring high availability.

## 💬 Structured UI Rendering (`prompts.ts`)

The Agent is instructed via `SYSTEM_INSTRUCTION` to output specific Markdown/JSON blocks. The Vue 3 client parses these blocks to render interactive components instead of plain text.

**Supported Blocks:**
- `[SUGGESTIONS]...[/SUGGESTIONS]`: Renders clickable quick-reply chips.
- `[DATABASES]...[/DATABASES]`: Renders a grid of databases.
- `[COLLECTIONS]...[/COLLECTIONS]`: Renders a list of collections.
- `[CHART]...[/CHART]`: Renders an ECharts component dynamically (bar, line).
- `[NAVIGATION]...[/NAVIGATION]`: Automatically redirects the user's dashboard route.

## 📝 Session Persistence

Agent conversation history is maintained in-memory on the backend via the ADK's `InMemoryRunner`.
```typescript
const runner = new InMemoryRunner({
  agent: rootAgent,
  appName: 'MongoAgent'
});
```
Sessions are keyed by a unique `userId` (defaulting to the admin session). Conversations can be cleared via the UI, which hits the `DELETE /api/agent/session` endpoint.
