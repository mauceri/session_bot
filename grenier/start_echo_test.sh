#!/bin/bash

# Chemin vers le proje
ROOT_DIR="$(dirname "$0")"
echo "1***************************** $ROOT_DIR"

# Lancer le serveur TypeScript (adapter selon Bun ou Node.js)
bun run "$ROOT_DIR/session_bot_refactored.ts" &
SERVER_PID=$!

# Fonction pour vérifier si le WebSocket (8089) est actif
function check_websocket {
    local max_attempts=10
    local attempt=1
    local wait_time=2
    local ws_url="127.0.0.1"
    local ws_port=8089

    while [ $attempt -le $max_attempts ]; do
        if nc -z $ws_url $ws_port ; then
            echo "✅ Le serveur WebSocket est actif."
            return 0
        else
            echo "🔄 Tentative $attempt/$max_attempts : WebSocket non actif, attente de $wait_time secondes..."
            attempt=$(( attempt + 1 ))
            sleep $wait_time
        fi
    done

    echo "❌ Le serveur WebSocket n'est pas disponible après plusieurs tentatives. Arrêt du script."
    kill $SERVER_PID
    exit 1
}

# Attendre que le WebSocket soit prêt
check_websocket

echo "***************************** $ROOT_DIR"
# Lancer le client Python d'écho
python3 "$ROOT_DIR/echo_client.py" &
CLIENT_PID=$!

# Fonction de nettoyage
function cleanup {
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
}
trap cleanup SIGINT SIGTERM

# Attendre la fin des processus
wait $SERVER_PID
wait $CLIENT_PID