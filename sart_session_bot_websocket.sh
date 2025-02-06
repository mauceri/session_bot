#!/bin/bash

# Lancer session_bot.ts avec Bun
bun run /home/mauceric/session_bot/session_bot.ts &
# Sauvegarder le PID de Bun
BUN_PID=$!

# Fonction pour vérifier si le port WebSocket de session_bot.ts est actif
function check_websocket {
    local max_attempts=10  # Nombre maximum de tentatives
    local attempt=1
    local wait_time=5  # Temps d'attente entre chaque tentative en secondes
    local ws_url="ws://localhost:8089"  # URL WebSocket à tester

    while [ $attempt -le $max_attempts ]; do
        # Utiliser netcat (nc) pour tester la disponibilité du port WebSocket (8089)
        nc -z localhost 8089
        if [ $? -eq 0 ]; then
            echo "Le serveur WebSocket de session_bot.ts est actif."
            return 0
        else
            echo "Tentative $attempt/$max_attempts : Le serveur WebSocket n'est pas encore actif, attente de $wait_time secondes..."
            attempt=$(( $attempt + 1 ))
            sleep $wait_time
        fi
    done

    echo "Le serveur WebSocket de session_bot.ts n'est pas disponible après plusieurs tentatives. Arrêt du script."
    exit 1
}

# Attendre que le WebSocket de session_bot.ts soit actif
check_websocket

# Une fois le WebSocket prêt, lancer session_bot.py avec Python
python3 /home/mauceric/session_bot/session_bot.py &
# Sauvegarder le PID de Python
PYTHON_PID=$!

# Attendre que les deux processus se terminent
wait $BUN_PID
wait $PYTHON_PID
