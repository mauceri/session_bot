#!/bin/bash

# Définition du fichier de la socket IPC
SOCKET_PATH="/tmp/session_bot.sock"
export PIP_BREAK_SYSTEM_PACKAGES=1

# Nettoyage du socket précédent s'il existe
if [ -e "$SOCKET_PATH" ]; then
    echo "Suppression du socket IPC existant..."
    rm -f "$SOCKET_PATH"
fi

# Lancer session_bot.ts avec Bun
echo "Démarrage de session_bot.ts..."
bun run /home/mauceric/session_bot/session_bot.ts &
BUN_PID=$!

# Fonction pour vérifier si la socket Unix est créée
function check_unix_socket {
    local max_attempts=10
    local attempt=1
    local wait_time=1  # Temps d'attente entre chaque tentative (secondes)

    while [ $attempt -le $max_attempts ]; do
        if [ -e "$SOCKET_PATH" ]; then
            echo "La socket Unix ($SOCKET_PATH) est active."
            return 0
        else
            echo "Tentative $attempt/$max_attempts : La socket Unix n'est pas encore disponible, attente de $wait_time secondes..."
            attempt=$(( $attempt + 1 ))
            sleep $wait_time
        fi
    done

    echo "La socket Unix IPC n'est pas disponible après plusieurs tentatives. Arrêt du script."
    kill $BUN_PID
    exit 1
}

# Attendre que la socket Unix soit prête
check_unix_socket

# Une fois la socket active, lancer session_bot.py avec Python
echo "Démarrage de session_bot.py..."
python3 /home/mauceric/session_bot/session_bot.py &
PYTHON_PID=$!

# Gérer l'arrêt des processus proprement
trap "echo 'Arrêt du service...'; kill $BUN_PID $PYTHON_PID; exit 0" SIGTERM SIGINT

# Attendre que les deux processus se terminent
wait $BUN_PID
wait $PYTHON_PID
