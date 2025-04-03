#!/bin/bash

# Définir la racine du projet
ROOT_DIR="${ROOT_DIR:-/app}"


# Lancer cleanup.ts avec Bun
bun run "$ROOT_DIR/cleanup.ts" &
CLEANUP_PID=$!

if [ -z "$CLIENT_NAME" ]; then
  echo "Erreur: la variable CLIENT_NAME n'est pas définie." >&2
  exit 1
fi
# Lancer session_bot.ts avec Bun
bun run "$ROOT_DIR/session_bot.ts" &
SESSION_BOT_PID=$!

# Fonction pour vérifier si le WebSocket (8089) est actif
function check_websocket {
    local max_attempts=10
    local attempt=1
    local wait_time=5
    local ws_url="127.0.0.1"
    local ws_port=8089

    while [ $attempt -le $max_attempts ]; do
        # Vérifier si le port est ouvert avec netcat (nc) ou curl
        if nc -z $ws_url $ws_port ; then
            echo "✅ Le serveur WebSocket de session_bot.ts est actif."
            return 0
        else
            echo "🔄 Tentative $attempt/$max_attempts : WebSocket non actif, attente de $wait_time secondes..."
            attempt=$(( attempt + 1 ))
            sleep $wait_time
        fi
    done

    echo "❌ Le serveur WebSocket de session_bot.ts n'est pas disponible après plusieurs tentatives. Arrêt du script."
    kill $SESSION_BOT_PID $CLEANUP_PID
    exit 1
}

# Attendre que le WebSocket de session_bot.ts soit actif
check_websocket

# Une fois le WebSocket prêt, démarrer session_bot.py avec Python
python3 "$ROOT_DIR/session_bot.py" &
PYTHON_PID=$!

# Fonction de nettoyage en cas d'arrêt du script
function cleanup {
    echo "🛑 Arrêt des processus..."
    kill $SESSION_BOT_PID $CLEANUP_PID $PYTHON_PID 2>/dev/null
    exit 0
}

# Intercepter les signaux (Ctrl+C, kill, etc.)
trap cleanup SIGINT SIGTERM

# Attendre que les processus se terminent
wait $SESSION_BOT_PID
wait $CLEANUP_PID
wait $PYTHON_PID
