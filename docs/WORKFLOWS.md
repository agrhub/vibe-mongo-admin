# Workflow Diagrams

This document details the sequence of operations between the VibeMongo Vue Client, Express Backend, Google ADK Agent, MongoDB MCP Server, and the target MongoDB database.

## 1. Database Connection Initialization

```mermaid
sequenceDiagram
    participant User
    participant VueClient
    participant ExpressAPI
    participant ConnectionStore
    participant MongoService

    User->>VueClient: Select "Connect" on connection profile
    VueClient->>ExpressAPI: POST /api/connection/connect { id }
    ExpressAPI->>ConnectionStore: Fetch encrypted connection
    ConnectionStore-->>ExpressAPI: Decrypted connection string
    ExpressAPI->>MongoService: connect(connectionString)
    MongoService-->>ExpressAPI: Success (Connection Cached)
    ExpressAPI-->>VueClient: 200 OK
    VueClient->>User: Renders Dashboard (Database list)
```

## 2. Standard Document Query

```mermaid
sequenceDiagram
    participant VueClient
    participant ExpressAPI
    participant MongoService
    participant MongoDB

    VueClient->>ExpressAPI: POST /api/document/find { db, collection, filter }
    ExpressAPI->>MongoService: getDb(db).collection.find(filter)
    MongoService->>MongoDB: execute find()
    MongoDB-->>MongoService: BSON Documents
    MongoService-->>ExpressAPI: JSON array
    ExpressAPI-->>VueClient: 200 OK + Data
    VueClient->>VueClient: Render Data Grid / Document Editor
```

## 3. AI Agent Tool Execution Workflow

This is the core workflow demonstrating how a natural language prompt is translated into a MongoDB execution via the Model Context Protocol (MCP).

```mermaid
sequenceDiagram
    participant User
    participant VueClient
    participant ExpressAPI
    participant GoogleADK
    participant VertexAI
    participant MCP_Server
    participant MongoDB

    User->>VueClient: "Show me a chart of users by status"
    
    %% UI Context injection
    VueClient->>VueClient: Append [UI Context | DB: test, Coll: users]
    
    VueClient->>ExpressAPI: POST /api/agent/chat { message, context }
    ExpressAPI->>GoogleADK: InMemoryRunner.runAsync(message)
    
    %% LLM Reasoning Phase
    GoogleADK->>VertexAI: Generate Content (Prompt + Tools)
    VertexAI-->>GoogleADK: ToolCallRequest: aggregatePipeline(db="test", collection="users", pipeline="[...]")
    
    %% Tool Execution Phase (MCP)
    GoogleADK->>MCP_Server: callMcpTool('aggregate', { db, col, pipeline }) via JSON-RPC stdio
    MCP_Server->>MongoDB: execute aggregation
    MongoDB-->>MCP_Server: Aggr results
    MCP_Server-->>GoogleADK: JSON Results
    
    %% Synthesis Phase
    GoogleADK->>VertexAI: Return Tool Results
    VertexAI-->>GoogleADK: Natural Language Response + JSON Chart Block
    
    %% Output Parsing
    GoogleADK->>ExpressAPI: Parsed { message, chartVisual, suggestions }
    ExpressAPI-->>VueClient: 200 OK + AI Result payload
    
    VueClient->>VueClient: Render Markdown Response
    VueClient->>VueClient: Render ECharts visually
    VueClient->>User: Display Chat & Interactive Chart
```

## 4. MCP Server Subprocess Lifecycle

The backend manages the lifecycle of the `mongodb-mcp-server` to ensure the correct connection context is used by the Agent.

```mermaid
sequenceDiagram
    participant ExpressAPI
    participant MongoTools
    participant npx
    participant MCP_Server

    ExpressAPI->>MongoTools: User swapped active connection (URI updated)
    MongoTools->>MongoTools: Detect URI change
    
    alt Existing MCP Client runs
        MongoTools->>MCP_Server: Close StdioClientTransport
        MCP_Server-->>MongoTools: Terminated
    end
    
    MongoTools->>npx: Spawn "npx -y mongodb-mcp-server" (Env: MDB_MCP_CONNECTION_STRING)
    npx->>MCP_Server: Start Subprocess
    MCP_Server-->>MongoTools: Ready (Standard I/O stream open)
    MongoTools->>ExpressAPI: Tools Ready for Execution
```
