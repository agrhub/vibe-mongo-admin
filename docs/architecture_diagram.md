# VibeMongo Tri-Partner Architecture Diagram

![VibeMongo Architecture Diagram](images/vibemongo_architecture_diagram.png)

---


## 📐 System Architecture Diagram

```mermaid
graph TB
    %% Styling and Palettes
    classDef client fill:#00f2fe,stroke:#03a9f4,stroke-width:2px,color:#000;
    classDef server fill:#4facfe,stroke:#0072ff,stroke-width:2px,color:#fff;
    classDef brain fill:#67c23a,stroke:#4caf50,stroke-width:2px,color:#fff;
    classDef mcp fill:#e6a23c,stroke:#ff9800,stroke-width:2px,color:#fff;
    classDef telemetry fill:#f56c6c,stroke:#f44336,stroke-width:2px,color:#fff;
    classDef db fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff;

    %% Client Layer (Vue 3)
    subgraph Vue3_Client ["Vue 3 Premium Client"]
        UI["Glassmorphic UI Views"]:::client
        Chat["AgentChatSidebar"]:::client
        ECharts["Interactive ECharts Console"]:::client
        TraceDrawer["TraceDetailDrawer UI"]:::client
    end

    %% Backend Layer (Express)
    subgraph Express_Backend ["VibeMongo Express Backend"]
        API["API Endpoints"]:::server
        Proxy["Proxy & Session Controller"]:::server
        OTel["OTel Instrumentation Agent"]:::server
    end

    %% AI & Core Reasoner
    subgraph Google_AI ["Google Agent & Vertex AI"]
        Gemini["Gemini 3.5 Pro/Flash"]:::brain
        ADK["Vertex Agent Dev Kit"]:::brain
    end

    %% Model Context Protocol Layer
    subgraph MCP_Layer ["Model Context Protocol"]
        MongoMCP["MongoDB MCP Server"]:::mcp
        PhoenixMCP["Arize Phoenix MCP"]:::mcp
    end

    %% Storage & APM Layer
    subgraph Storage_APM ["Data & Telemetry"]
        MongoDB[("MongoDB Database")]:::db
        Phoenix[("Arize Phoenix APM")]:::telemetry
    end

    %% Flow connections
    UI --> Chat
    Chat --> API
    API --> ADK
    ADK --> Gemini
    Gemini --> ADK
    ADK --> MongoMCP
    ADK --> PhoenixMCP
    Proxy --> MongoMCP
    MongoMCP --> MongoDB
    OTel --> Phoenix
    PhoenixMCP --> Phoenix
    MongoMCP --> ADK
    ADK --> API
    API --> Chat
    Chat --> ECharts
    TraceDrawer --> Phoenix
```

---

## 🔄 Sequence of Key Workflows

### 1. The Conversational DB Query Workflow
1. The **User** enters a prompt in the `AgentChatSidebar` (e.g., *"Show me user registration count by month"*).
2. The **VibeMongo Backend** forwards the prompt to the **Google ADK Agent**.
3. **Gemini** analyzes the schema via tool calls routed through the **MongoDB MCP Server**.
4. The **MongoDB MCP Server** translates and runs the query against the target **MongoDB**.
5. The result is returned to **Gemini**, which wraps the data into a structured JSON block (e.g., charts, collection navigation buttons).
6. The **Vue 3 Client** parses the structured tags and instantly renders interactive **ECharts** graphs in the chat conversation list.

### 2. Performance Diagnostics & DB-Guardian SRE Loop
1. The **OTel Instrumentation Agent** exports performance telemetry spans of all DB queries and LLM invocations to **Arize Phoenix**.
2. **Arize Phoenix** triggers alert badges on the **VibeMongo Client** if query speeds drop below threshold limits.
3. The user clicks *"Evaluate recent slow trace with AI Judge"*.
4. **Google Agent SDK** retrieves the slow span telemetry via **Phoenix MCP**.
5. **Gemini** performs automatic optimization analysis and details a step-by-step resolution roadmap (e.g. suggesting custom indexes) to the user.
