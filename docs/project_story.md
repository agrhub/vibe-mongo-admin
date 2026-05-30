## Inspiration
Managing MongoDB databases using traditional GUI clients often involves writing complex, syntax-heavy aggregation pipelines just to get simple answers. For developers who are not MongoDB experts, writing these pipelines can be a huge time sink. Furthermore, monitoring database performance and identifying slow queries usually requires jumping into completely separate APM (Application Performance Monitoring) tools.

We were inspired to build a modern, web-based admin interface that combines the robust features of traditional database clients with the power of generative AI and real-time observability. Our goal was to create a "Vibe" where managing databases feels effortless, intuitive, and conversational, while also introducing **Autonomous Database SRE** capabilities.

## What it does
**VibeMongo Admin** is a next-generation, responsive web-based MongoDB administration dashboard powered by Vue 3, Express, and a powerful triad of technologies: **Google Cloud Agent (ADK)**, **Arize Phoenix**, and **MongoDB MCP**.

It provides a fully-featured interface for database management (connecting, viewing collections, managing documents, building indexes, and running backups/restores). 

The standout features are driven by our AI architecture:
1. **AI Database Administrator Assistant**: A persistent chat sidebar where users can ask natural language questions (e.g., "Show me the top 5 users by age"). The Google Agent securely interacts with MongoDB, parses the results, and dynamically renders the output as interactive UI components (ECharts graphs, clickable navigation buttons).
2. **DB-Guardian Copilot (AI-Driven SRE)**: Powered by Arize Phoenix telemetry, VibeMongo actively monitors query performance. It surfaces slow queries in the UI via the Phoenix Alert Banner.
3. **Ask AI to Optimize & AI Judge Evaluate**: Users can click to have the Google Cloud Agent analyze a slow trace waterfall, explain the bottleneck step-by-step in natural language, and suggest optimizations (like adding indexes) or evaluate the safety of the query.

## How we built it: The Tri-Partner Architecture

![VibeMongo Architecture Diagram](images/vibemongo_architecture_diagram.png)

* **Frontend (UI/UX):** Vue 3 (Composition API) with Vite, styled with modern, glassmorphic UI patterns. We built a dynamic parsing engine that reads specific JSON blocks outputted by the AI agent to render interactive components on the fly.
* **Brain (Google Cloud Agent & Gemini):** We utilized the **Google Agent Development Kit (ADK)** and Google's highly capable **Gemini 3.1 Flash-Lite** model on Vertex AI to act as the central reasoning engine.
* **Execution (MongoDB MCP):** To bridge the AI agent with MongoDB securely, we integrated the official **MongoDB MCP Server** (`mongodb-mcp-server`). The Agent leverages this standardized Model Context Protocol to introspect schemas and execute aggregation pipelines dynamically based on the current active connection.
* **Observability & Evaluation (Arize Phoenix Cloud & MCP):** We integrated the **Arize Phoenix MCP** and `@arizeai/phoenix-otel` to capture OpenTelemetry traces of both MongoDB operations and LLM reasoning. When the user requests an "AI Judge Evaluation" or "Ask AI to Optimize", the UI fetches the trace data and sends it back to the Gemini Agent to provide human-readable, step-by-step diagnostic feedback directly in the chat interface.

## Challenges we ran into
Integrating an LLM with live database queries and observability tools presents security and architectural challenges:
1. **Dynamic Tool Provisioning:** Passing the correct database connection string to the MCP server dynamically as the user switched between servers was tricky. We solved this by decrypting the active connection string on the fly and injecting it into the environment variables when spawning the `mongodb-mcp-server` subprocess.
2. **Structured Rendering:** The LLM would often format responses unpredictably, breaking UI rendering. We solved this by implementing strict `SYSTEM_INSTRUCTION` prompts that forced the ADK Agent to output structured tags (like `[COLLECTIONS]...[/COLLECTIONS]`).
3. **Closing the Evaluation Loop:** To provide real "LLM-as-a-judge" capabilities, we had to elegantly map Arize Phoenix's trace telemetry back into Gemini's context window. We built a bridge that allows the UI to fetch a trace span, construct an evaluation prompt, and trigger the Agent Chat seamlessly.

## Accomplishments that we're proud of
* We successfully built a stable bridge between **Google ADK**, **MongoDB MCP Server**, and **Arize Phoenix**, demonstrating how standardized protocols (MCP) can dramatically accelerate autonomous agent development.
* The dynamic rendering engine: seeing the AI agent return raw aggregation data and having the Vue frontend instantly transform it into a beautiful, interactive ECharts visualization is incredibly satisfying!
* We achieved 100% functional parity with traditional MongoDB web admins while introducing groundbreaking AI and SRE features.

## What we learned
* We gained deep hands-on experience with the **Google Agent Development Kit (ADK)** and orchestrating multi-turn, tool-using agents.
* We learned how the **Model Context Protocol (MCP)** standardizes the way AI models interact with external data sources securely.
* We discovered the immense value of **Arize Phoenix** for tracing complex LLM-to-Database toolchains, making debugging and optimization significantly easier.

## What's next for VibeMongo Admin
* **Automated Index Optimization (Auto-Pilot):** Moving beyond suggestions to allow the DB-Guardian to automatically apply index optimizations during low-traffic periods.
* **Data Generation:** Adding an agentic feature to generate massive amounts of realistic mock data for testing environments based on the collection's inferred schema.
* **Role-Based Access Control (RBAC):** Implementing multi-user support so teams can collaborate and restrict certain destructive AI operations.


## Problem to solve
Managing MongoDB databases using traditional GUI clients often involves writing complex, syntax-heavy aggregation pipelines just to get simple answers. For developers who are not MongoDB experts, writing these pipelines can be a huge time sink. Furthermore, monitoring database performance and identifying slow queries usually requires jumping into completely separate APM (Application Performance Monitoring) tools.

We were inspired to build a modern, web-based admin interface that combines the robust features of traditional database clients with the power of generative AI and real-time observability. Our goal was to create a "Vibe" where managing databases feels effortless, intuitive, and conversational, while also introducing **Autonomous Database SRE** capabilities.

## Our solution
**VibeMongo Admin** is a next-generation, responsive web-based MongoDB administration dashboard powered by Vue 3, Express, and a powerful triad of technologies: **Google Cloud Agent (ADK)**, **Arize Phoenix**, and **MongoDB MCP**.

It provides a fully-featured interface for database management (connecting, viewing collections, managing documents, building indexes, and running backups/restores). 

The standout features are driven by our AI architecture:
1. **AI Database Administrator Assistant**: A persistent chat sidebar where users can ask natural language questions (e.g., *"Show me the top 5 users by age"*). The Google Agent securely interacts with MongoDB, parses the results, and dynamically renders the output as interactive UI components (ECharts graphs, clickable navigation buttons).
2. **DB-Guardian Copilot (AI-Driven SRE)**: Powered by Arize Phoenix telemetry, VibeMongo actively monitors query performance, surfaces slow queries via the Phoenix Alert Banner, and emails consolidated markdown reports via SMTP relays.
3. **Ask AI to Optimize & AI Judge Evaluate**: Users can click to have the Google Cloud Agent analyze a slow trace waterfall, explain the bottleneck step-by-step in natural language, suggest optimizations (like adding indexes), or evaluate the safety of the query.

## Technologies used
* **Brain (Google Cloud Agent & Gemini):** We utilized the **Google Agent Development Kit (ADK)** and Google's highly capable **Gemini 3.1 Flash-Lite** model on Vertex AI to act as the central reasoning engine.
* **Execution (MongoDB MCP):** To bridge the AI agent with MongoDB securely, we integrated the official **MongoDB MCP Server** (`mongodb-mcp-server`) as a managed subprocess.
* **Observability & Evaluation (Arize Phoenix Cloud & MCP):** We integrated the **Arize Phoenix MCP** and `@arizeai/phoenix-otel` to capture OpenTelemetry traces of both MongoDB operations and LLM reasoning.
* **Frontend (UI/UX):** Vue 3 (Composition API) with Vite, styled with modern, glassmorphic UI patterns. We built a dynamic parsing engine that reads specific JSON blocks outputted by the AI agent to render interactive components on the fly.
* **Hosting:** Deployed to **Google Cloud Run** for fully managed, containerized scalability.

## Data sources
- **MongoDB Cluster Telemetry:** Connects directly to active MongoDB Atlas clusters or local MongoDB server instances to introspect collections, read schemas, and execute operations.
- **Arize Phoenix Tracing Endpoint:** Retrieves real-time JSON traces of database operations and LLM evaluation benchmarks from the Arize Phoenix OpenTelemetry collector API.

## Findings and learnings
During this intensive building process, we discovered key surprises, challenges, and insights:
1. **Model Context Protocol (MCP) Power:** Standardized protocols like MCP can dramatically accelerate agent development by giving models immediate capability expansion (like SQL/NoSQL querying) without writing custom wrappers.
2. **Dynamic Tool Provisioning Challenge:** Passing the correct database connection string to the MCP server dynamically as the user switched databases in real-time was a major architectural puzzle. We solved this by decrypting the active connection string on the fly and injecting it into the environment variables when spawning the subprocess.
3. **Structured UI Parsing:** LLMs would often format responses unpredictably, breaking UI rendering. We solved this by implementing strict system prompts that forced the ADK Agent to output structured components (like custom ECharts tags).
4. **Closing the SRE Evaluation Loop:** Mapping Arize Phoenix's trace telemetry back into Gemini's context window showed us the true potential of using "LLM-as-a-judge" to optimize query workloads dynamically.

## Third-party integrations (if applicable)
- **Arize Phoenix SDK / `@arizeai/phoenix-otel`**: Captured and exported telemetry traces.
- **Element Plus & ECharts**: Rendered sleek, modern component states and responsive database visualization panels.
- **Nodemailer**: Dispatched styled HTML/Markdown alert digests from the SRE engine.
*We confirm we have all rights and authorizations to use these packages and APIs.*

---

## 📝 Devpost Submission Questions & Answers

### 1. On a scale from 1-5, how familiar are you with Google Cloud products? (1=none, 5=expert) *
**Answer:** `4`
We are highly comfortable deploying production workloads to Google Cloud (using Cloud Run, Vertex AI models, IAM authentication, and container registries), but we are always eager to learn more about advanced networking and specialized telemetry integrations.

### 2. On a scale from 1-5, how familiar are you with Google AI Studio? (1=none, 5=expert) *
**Answer:** `4`
We have used Google AI Studio heavily for rapid prototyping, system prompt engineering, testing different Gemini 3.1 capabilities, and modeling structured JSON outputs before moving our production configuration to Vertex AI for enterprise-grade scalability.

### 3. Describe the readiness of your project for launch. *
**Answer:**
VibeMongo Admin is **fully functional, production-ready, and successfully deployed to Google Cloud Run**. Key SRE capabilities are fully operational:
- The persistent Chat Sidebar interacts directly with databases through the **MongoDB MCP Server**.
- Real-time performance telemetry traces are captured and exported directly to **Arize Phoenix Cloud**.
- The SRE Auto-Pilot **DB-Guardian** successfully monitors memory usage, alerts on outage handshakes, and emails consolidated markdown reports via **SMTP mail relays**.
- **Spam Prevention (Alert Grouping)** is persistent per connection, allowing users to customize aggregation time windows.
- The UI is robust, responsive, localized in **8 languages**, and offers full backup/restore, dynamic ECharts visualization, schema indexing, and Document CRUD parity.

### 4. Which specific feature of Agent Platform was most critical to your project's impact, and what is one thing it's currently missing? *
**Answer:**
- **Most Critical Feature:** The **seamless integration with the Model Context Protocol (MCP)** via the Google Agent Development Kit (ADK). This allowed our Gemini 3.1 reasoning engine to instantly acquire secure schema introspection and execution capabilities without us writing custom wrappers for every MongoDB operation.
- **One Thing Currently Missing:** Built-in support for **persistent state session isolation per active connection inside the agent engine**. Because users frequently switch databases and clusters in real-time, having the Agent Platform natively isolate tool-schemas or connection environments without restarting subprocesses would have greatly simplified database multi-tenancy logic.

### 5. If you could add one specific API capability or integration that would have saved you 2+ hours of work, what would it be? *
**Answer:**
A **native, out-of-the-box UI builder tool or standard JSON component library** within the ADK. Since our AI Agent often needs to render complex, interactive ECharts, lists, or custom collection tables, we spent significant time designing custom markdown parser directives and manual JSON parsers to map Gemini's tool calls into Element Plus Vue UI modules. Having a native structured UX specification would have saved us hours of design and boilerplate logic!
