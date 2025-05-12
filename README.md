# session_bot

session_bot is a hybrid TypeScript (Bun) and Python application that serves as a gateway between the Session.js client library and a Python-based plugin manager over fragmented WebSockets.

## Why session_bot?

Artificial intelligence can become a daily tool as indispensable as the Internet—but only if it remains free. `session_bot` addresses four major challenges:

- **Dependence on cloud providers**  
  Using AI often means relying on services hosted by OpenAI, Google, or Amazon. `session_bot` offers an alternative by running language models or semantic search engines locally on your machine, without remote infrastructure or opaque dependencies.

- **Loss of privacy**  
  Every request sent to a cloud-based chatbot exposes your data to third parties. `session_bot` uses Lokinet—a decentralized, end-to-end encrypted messaging protocol (Session)—to keep your conversations private.

- **Functional lock-in**  
  Unlike many closed-source tools, `session_bot` features a modular plugin architecture. Adding a plugin is straightforward, whether for meditation guidance, knowledge bases, I Ching interpretation, or tarot readings assisted by an LLM.

- **Technical lock-in**  
  `session_bot` is fully open source and does not rely on proprietary solutions. Anyone can modify, share, and adapt it to their needs for true technical autonomy.

## Features

### TypeScript (Bun)

- `session_bot.ts`: Minimal entry point to launch the WebSocket/Session.js broker  
- `sessionBroker.ts`: Initializes Session.js, manages the SQLite database, communication WebSocket, and JSON chunking (`chunker.ts`)  
- `utils.ts`: Utilities for Base64 encoding, file I/O, and mnemonic handling  
- `validator.ts`: JSON-fragment validation with AJV  
- `chunker.test.ts`: Non-regression tests for the chunker (Bun)

### Python

- `plugin_manager.py`: Manages WebSocket messages, validates payloads with Pydantic, and dispatches to plugins  
- Structured JSON logging for observability  
- Robust WebSocket handling: timeouts, exponential back-offs, and fragment size limits  
- `test_chunker.py` (asyncio) and `test_plugin_manager.py` (unittest) for unit testing

## Prerequisites

- **Docker & Docker Compose** (optional, for deployment)  
- **Bun** (or Node.js & npm) for the TypeScript side  
- **Python ≥ 3.10** for the plugin manager

## Local Development

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-org/session_bot.git
   cd session_bot
   ```
2. **Install TypeScript dependencies**  
   ```bash
   bun install   # or npm install
   ```
3. **Install Python dependencies**  
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. **(Optional) Set the Session client name**  
   ```bash
   export CLIENT_NAME='my_bot'
   ```
5. **Launch the TypeScript broker**  
   ```bash
   bun run session_bot.ts  # or node session_bot.ts
   ```
6. **Start the Python plugin manager**  
   ```bash
   source venv/bin/activate
   python3 session_bot.py
   ```

## Using Docker Compose

1. **Build the Docker image**  
   ```bash
   docker compose build session_bot
   ```
2. **Start the services**  
   ```bash
   docker compose up -d
   ```
3. **View logs**  
   ```bash
   docker logs -f session_bot
   ```
4. **Stop the services**  
   ```bash
   docker compose down
   ```

## Running Tests

- **TypeScript**  
  ```bash
  bun test
  ```
- **Python**  
  ```bash
  pytest -q
  ```

## Project Structure

```
├── chunker.ts                 # JSON fragmenter & sender (TS)
├── validator.ts               # AJV validation for payloads (TS)
├── utils.ts                   # Common utilities (TS)
├── types.ts                   # TS interfaces for JSON payloads
├── sessionBroker.ts           # Main TS broker (Session.js + WS)
├── session_bot.ts             # Minimal TS entry point
├── plugin_manager.py          # Python WebSocket manager & plugin dispatcher
├── chunker.py                 # JSON fragmenter & sender (Python)
├── models.py                  # Pydantic models for validation (Python)
├── test_chunker.py            # Python tests for chunker
├── test_plugin_manager.py     # Python tests for plugin manager
├── chunker.test.ts            # TS tests for chunker
├── Dockerfile                 # Multi-language Docker image
├── docker-compose.yaml        # Docker Compose configuration
└── data/                      # Configuration and SQLite database
```

## Contributing

1. Fork the repository  
2. Create a branch (`feat/your-feature` or `fix/your-bug`)  
3. Follow the existing code style  
4. Add tests or update documentation as needed  
5. Submit a pull request to the `main` branch

---

*This README is an English translation and adaptation of the original French documentation.*
