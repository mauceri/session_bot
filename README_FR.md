# session_bot
**session_bot** est une application hybride TypeScript/Bun et Python qui fait office de passerelle entre la librairie Session.js (client) et un gestionnaire de plugins Python via WebSockets fragmentés.

## Fonctionnalités principales
- **TypeScript (Bun)**
  - Point d’entrée minimal (`session_bot.ts`) qui lance le broker WebSocket/Session.js
  - Module `sessionBroker.ts` gérant l’initialisation Session.js, la base de données SQLite, la websocket de communication, et le découpage/réassemblage JSON (`chunker.ts`)
  - `utils.ts` pour les utilitaires (Base64, gestion de fichiers, mnémotechnique)
  - Validation des fragments JSON via AJV (`validator.ts`)
  - Tests Bun (`chunker.test.ts`) pour non-régression du chunker
- **Python**
  - `plugin_manager.py` orchestre la réception des messages, la validation Pydantic, et la distribution aux plugins
  - Log structuré JSON pour une meilleure observabilité
  - Robustesse WebSocket : timeouts, reconnexions exponentielles et limites de fragmentation
  - Tests unitaires avec `test_chunker.py` (asyncio) et `test_plugin_manager.py` (unittest)

## Prérequis
- Docker & Docker Compose (optionnel, pour le déploiement)
- Bun (pour TS) ou Node.js/`npm` si vous préférez
- Python >=3.10

## Installation & démarrage
### En local (dev)
1. Cloner le dépôt  
   ```bash
   git clone https://github.com/votre-org/session_bot.git
   cd session_bot
   ```
2. Installer les dépendances TypeScript  
   ```bash
   bun install   # ou npm install
   ```
3. Installer les dépendances Python  
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Lancer le broker TypeScript  
   ```bash
   bun run session_bot.ts   # ou node/bun index.ts selon votre setup
   ```
5. Dans un autre terminal, lancer le gestionnaire Python  
   ```bash
   source venv/bin/activate
   python3 session_bot.py
   ```

### Avec Docker Compose (prod/dev)
1. Construire l’image  
   ```bash
   docker compose build session_bot
   ```
2. Démarrer les services  
   ```bash
   docker compose up -d
   ```
3. Consulter les logs  
   ```bash
   docker logs -f session_bot
   ```
4. Arrêter  
   ```bash
   docker compose down
   ```

## Tests
- **TypeScript**  
  ```bash
  bun test
  ```
- **Python**  
  ```bash
  pytest -q
  ```

## Structure du projet
```
├── chunker.ts          # Découpe et envoi JSON fragmenté (TS)
├── validator.ts        # Validation AJV des payloads (TS)
├── utils.ts            # Utilitaires communs TS (fichiers, Base64, config)
├── types.ts            # Interfaces JSON TS
├── sessionBroker.ts    # Broker principal TS (Session.js + WS)
├── session_bot.ts      # Point d’entrée TS minimal
├── plugin_manager.py   # Manager WebSocket + plugins (Python)
├── chunker.py          # Découpe et envoi JSON fragmenté (Python)
├── models.py           # Pydantic models de validation (Python)
├── test_chunker.py     # Tests chunker Python
├── test_plugin_manager.py # Tests PluginManager Python
├── chunker.test.ts     # Tests chunker TS
├── Dockerfile          # Image Docker multi-langages
├── docker-compose.yaml # Déploiement Docker Compose
└── data/               # Configuration et base SQLite
```

## Contribution
1. Fork du projet  
2. Nouvelle branche `(feat|fix)/votre-feature`  
3. Respectez le style existant  
4. Ajoutez des tests ou mettez à jour le README_FR.md si besoin  
5. Pull Request vers `main`

---
Ce README en français (`README_FR.md`) est un premier jet. Vous pouvez l’enrichir (exemples, capture d’écran, diagramme) selon vos besoins.  
Bonne continuation !