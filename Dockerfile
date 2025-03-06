# Image de base avec Debian
FROM debian:latest

# Mettre à jour et installer les paquets de base
RUN apt-get update && apt-get install -y \
    curl git python3 python3-pip python3-venv python3-dev \
    nodejs npm unzip build-essential libsqlite3-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Installer Bun correctement dans /root/.bun/
RUN curl -fsSL https://bun.sh/install | bash && chmod +x /root/.bun/bin/bun

    # Définir l’environnement Bun
ENV PATH="/root/.bun/bin:$PATH"

RUN bun -h

# Définir le dossier de travail
WORKDIR /app

# Créer les répertoires pour les plugins et les données (même si le volume n'est pas monté)
RUN mkdir -p /app/data /app/plugins && chown -R 1000:1000 /app/data /app/plugins

# Copier l’application
COPY . /app

# Vérifier les fichiers présents
RUN ls -l /app && cat /app/requirements.txt

# Créer un environnement virtuel pour Python
RUN python3 -m venv /app/venv

# Activer l'environnement virtuel et mettre à jour pip
RUN /app/venv/bin/python -m pip install --upgrade pip setuptools wheel

# Installer les dépendances Python dans l'environnement virtuel
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Définir l’environnement pour utiliser le venv
ENV PATH="/app/venv/bin:$PATH"

# Installer les dépendances du projet TypeScript
RUN bun install
#RUN bun remove sqlite3 && bun add sqlite3
RUN npm rebuild sqlite3
# Commande de démarrage
CMD ["/app/start_session_bot.sh"]
