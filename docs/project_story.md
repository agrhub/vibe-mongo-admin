## Inspiration
Managing MongoDB databases using traditional GUI clients (like Compass or Robo3T) often involves writing complex, syntax-heavy queries (e.g., aggregation pipelines) just to get simple answers like "What's the average age of users in this collection?". For developers who are not MongoDB experts, writing these pipelines can be a huge time sink.

We were inspired to build a modern, web-based admin interface that combines the robust features of traditional database clients with the power of generative AI. Our goal was to create a "Vibe" where managing databases feels effortless, intuitive, and conversational—allowing developers to talk to their databases directly.

## What it does
**VibeMongo Admin** is a modern, responsive web-based MongoDB administration dashboard powered by Vue 3, Express, and Google ADK (Agent Development Kit).

It provides a fully-featured interface for database management (connecting, viewing databases, collections, managing documents, building indexes, and running backups/restores). 

The killer feature is the **AI Database Administrator Assistant**, integrated directly into a persistent chat sidebar. Users can simply ask natural language questions (e.g., "Show me the top 5 users by age", or "Analyze the schema of this collection"). The AI Agent securely interacts with the active MongoDB instance, parses the results, and dynamically renders the output as interactive UI components (like ECharts graphs, clickable navigation buttons, and actionable suggestion chips) right within the chat!

## How we built it
* **Frontend:** Vue 3 (Composition API) with Vite, styled with modern, glassmorphic UI patterns. We built a dynamic parsing engine that reads specific JSON blocks (e.g., `[CHART]`, `[DATABASES]`, `[NAVIGATION]`) outputted by the AI agent to render interactive components on the fly instead of plain text.
* **Backend:** Node.js with Express.
* **AI Core:** We utilized the **Google Agent Development Kit (ADK)** to build our `MongoAgent`. We powered the agent using Google's highly capable **Gemini 3.1 Flash-Lite** model.
* **Tooling Layer (Model Context Protocol):** To bridge the AI agent with MongoDB securely, we integrated the official **MongoDB MCP Server** (`mongodb-mcp-server`). When the agent decides to execute a database action, the backend dynamically spawns the MCP server via standard I/O (stdio). The agent leverages this standardized protocol to introspect schemas and execute aggregation pipelines dynamically based on the current active connection.
* **Session Management:** We used ADK's `InMemoryRunner` to maintain persistent, context-aware conversations for the AI agent as the user navigates through different databases in the dashboard.

## Challenges we ran into
Integrating an LLM with live database queries presents security and architectural challenges:
1. **Dynamic Tool Provisioning:** Passing the correct database connection string to the MCP server dynamically as the user switched between different servers in the UI was tricky. We solved this by decrypting the active connection string on the fly and injecting it into the environment variables when spawning the `mongodb-mcp-server` subprocess.
2. **Structured Rendering:** The LLM would often format responses unpredictably, breaking UI rendering. We solved this by implementing strict `SYSTEM_INSTRUCTION` prompts that forced the ADK Agent to output structured tags (like `[COLLECTIONS]...[/COLLECTIONS]`), combined with Regex parsers on the backend to cleanly extract the data for the Vue client.

## Accomplishments that we're proud of
* We successfully built a stable bridge between **Google ADK** and the **MongoDB MCP Server**, demonstrating how standardized protocols (MCP) can dramatically accelerate AI agent development.
* The dynamic rendering engine: seeing the AI agent return raw aggregation data and having the Vue frontend instantly transform it into a beautiful, interactive ECharts visualization is incredibly satisfying!
* We achieved 100% functional parity with traditional MongoDB web admins, while vastly improving the user experience through conversational UI.

## What we learned
* We gained deep hands-on experience with the **Google Agent Development Kit (ADK)** and learned how to orchestrate multi-turn, tool-using agents effectively.
* We learned about the **Model Context Protocol (MCP)** and how it standardizes the way AI models interact with external data sources securely.
* Prompt engineering is critical when you need an LLM to interface with strict client-side rendering engines.

## What's next for VibeMongo Admin
* **Automated Index Optimization:** We want the AI agent to proactively monitor slow queries and suggest index creations in real-time.
* **Data Generation:** Adding an agentic feature to generate massive amounts of realistic mock data for testing environments based on the collection's inferred schema.
* **Role-Based Access Control (RBAC):** Implementing multi-user support so teams can collaborate and restrict certain destructive AI operations (like `dropDatabase`).
