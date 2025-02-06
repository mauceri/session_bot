import importlib
import json
import logging
import os
import shutil
import sys
import time
import git
import subprocess
import sys

import yaml
import base64

import asyncio
import socket

from Interface.interfaces import IObservable, IObserver


logger = logging.getLogger(__name__)


import os
import logging
# Configuration de base du logger
logging.basicConfig(
    level=logging.INFO,  # Niveau minimal des messages à afficher (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",  # Format du message
    handlers=[
        logging.StreamHandler()  # Gère l'affichage des messages sur la sortie standard
    ]
)

logger = logging.getLogger(__name__)


SOCKET_PATH = "/tmp/session_bot.sock"  # Chemin du socket IPC


class PluginManager:
    def __init__(self,root_dir=None,uri = "ws://localhost:8089"):
        """
        Args:
           config (Config): Paramètres de configuration pour le bot
        """
        self.socket = None
        self.observers = {}
        self.plugins = {}
        self.root_dir = root_dir or os.getcwd()
        self.data_dir = os.path.join(self.root_dir, "data")
        self.plugin_dir = os.path.join(self.root_dir, "plugins")    
        sys.path.append(self.plugin_dir)
        # Construire les chemins en fonction du répertoire racine
        self.path_yaml_config = os.path.join(self.data_dir, "config.yaml")
        self.path_yaml_plugin = os.path.join(self.data_dir, "plugins.yaml")
 
        self.config = {}
        if os.path.exists(self.path_yaml_config):
            with open(self.path_yaml_config, "r") as file:
                self.config = yaml.safe_load(file) or {}
                logger.info(f"config = {self.config}")
    
        self.tmp_dir = os.path.join(self.root_dir, "tmp")
        #logger.info("****************** Chargement des plugins")

        # Créer le répertoire temporaire s'il n'existe pas
        os.makedirs(self.tmp_dir, exist_ok=True)

        # Initialiser d'autres attributs si nécessaire
        self.observers = {}
        self.plugins = {}

        # Charger les plugins à partir du fichier YAML
        self.update_plugins()
        #self.run()

    def update_plugins(self):
         with open(self.path_yaml_plugin, 'r') as fichier:
            contenu = yaml.safe_load(fichier)
            plugind = json.loads(json.dumps(contenu))

            for plugin in plugind['plugins']:
                name = plugin['name']
                url = plugin['url']
                package = plugin['package']
                
                if 'env' in plugin :
                    for env in  plugin['env']:
                        key, val = next(iter(env.items())) 
                        os.environ[key]=val
                if plugin['enabled']:
                    self.load_plugin(name,package,url,os.path.join(self.plugin_dir, name))
                else:
                    self.unload_plugin(name)


    def load_plugin(self, plugin_name, package, plugin_url, plugin_path):
        try:
            logger.info(f"********************************* Chargement de {plugin_name} sur {plugin_path}")
            if plugin_name in self.plugins:
                logger.info(f"Unoad {plugin_name}")
                self.unload_plugin(plugin_name)
            if os.path.isdir(plugin_path):
                shutil.rmtree(plugin_path)
            
            if not os.path.isdir(self.data_dir):
                os.mkdir(self.data_dir)
            self.unload_plugin(plugin_name)
            sys.path.append(plugin_path)
            sys.path.append(os.path.join(plugin_path, plugin_name))
            logger.info(f"àààààààààààààààààààààà {sys.path}")

            # Vérifier si plugin_url est un chemin local ou une URL GitHub
            if os.path.isdir(plugin_url):
                # Cas d'un répertoire local
                shutil.copytree(plugin_url, plugin_path)
            else:
                # Cas d'un dépôt GitHub
                git.Repo.clone_from(plugin_url, plugin_path)

            # Intallation du plugin qui doit toujours être un dépôt git contenant un package du nom du plugin
            subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])
            subprocess.run([sys.executable, "-m", "pip", "install", "-v", "-e", plugin_path])
            module = importlib.import_module(plugin_name)
            self.plugins[plugin_name] = module.Plugin(self)  # Assumer une classe Plugin standard
            self.plugins[plugin_name].start()
        except Exception as err:
            logger.error(f"Load plugin {err}")
            raise
        
    async def unload_plugin(self, plugin_name):
        if plugin_name in self.plugins:

            await self.plugins[plugin_name].stop()  # Méthode pour nettoyer le plugin
            del sys.modules[self.plugins[plugin_name].__module__]
            del self.plugins[plugin_name]

    def reload_plugin(self, plugin_name, plugin_path):
        self.load_plugin(plugin_name, plugin_path)

     
    def subscribe(self, observer: IObserver):
        logger.info(f"***************************Subscribe {observer.prefix()}")
        self.observers[observer.prefix()] = observer

    def unsubscribe(self, observer: IObserver):
        del self.observers[observer.prefix()]

    
    async def wait_for_socket(self,socket_path: str, retries: int = 10, delay: float = 1.0):
 
        for _ in range(retries):
            if os.path.exists(socket_path):
                return True
            print(f"🕐 Attente de la socket IPC... ({socket_path})")
            time.sleep(delay)
        print(f"❌ La socket IPC {socket_path} n'a pas été trouvée après plusieurs tentatives.")
        return False


        """     async def initialize_socket(self):
        if not await self.wait_for_socket(socket_path=SOCKET_PATH, retries=10, delay=1):
            raise RuntimeError("Socket IPC non trouvée, impossible de se connecter.")

        self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.socket.connect(SOCKET_PATH)
        logger.info("✅ Connexion IPC Unix Socket initialisée.")
        """

    async def initialize_socket(self):
        """Tente de se connecter à la socket IPC en boucle avant d'échouer."""
        retries = 10
        delay = 1  # secondes

        for attempt in range(retries):
            try:
                if not os.path.exists(SOCKET_PATH):
                    print(f"🕐 Tentative {attempt + 1}/{retries}: socket non trouvée, attente...")
                    time.sleep(delay)
                    continue

                self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.socket.connect(SOCKET_PATH)
                logger.info("✅ Connexion IPC Unix Socket initialisée.")
                return  # Sortie réussie

            except ConnectionRefusedError:
                print(f"⚠️ Tentative {attempt + 1}/{retries}: connexion refusée, attente...")
                time.sleep(delay)

        raise RuntimeError("❌ Impossible de se connecter à la socket IPC après plusieurs essais.")

    async def notify(self, message: str, to: str, attachments):
        logger.info(f"Envoi du message {message}")

        data = {
            "from": to,
            "text": message,
            "frombobot": True,
            "attachments": attachments
        }
        try:
            await self.send_to_session_bot(data)
        except Exception as e:
            logger.error(f"Erreur d'envoi du message à `session_bot.ts` : {e}")
            self.socket = None

    async def send_message_to_session_bot(message):
        """Envoie un message JSON à session_bot.ts via une socket UNIX."""
        try:
            reader, writer = await asyncio.open_unix_connection(SOCKET_PATH)
            writer.write(json.dumps(message).encode() + b"\n")  # 📤 Envoi
            await writer.drain()

            response = await reader.read(4096)  # 📩 Lire la réponse
            print(f"✅ Réponse reçue : {response.decode()}")

            writer.close()
            await writer.wait_closed()

        except Exception as e:
            print(f"❌ Erreur d'envoi du message : {e}")

    async def handle_message(self):
        """Gère la connexion IPC et traite les messages en continu."""
        logger.info("✅ En attente des messages IPC...")

        while True:
            try:
                logger.info("🔄 Tentative de connexion IPC...")
                reader, writer = await asyncio.open_unix_connection(SOCKET_PATH)

                while True:
                    logger.info("Je vous écoute")
                    data = await reader.read(4096)  # 📩 Lire un message du socket
                    if not data:
                        logger.warning("⚠️ Connexion fermée par le serveur, tentative de reconnexion...")
                        break  # 🛑 Sortir de la boucle interne et relancer la connexion

                    message = json.loads(data.decode())
                    logger.info(f"📩 Message reçu de session_bot.ts: {message}")

                    await self.message(message)  # Traiter le message

            except FileNotFoundError:
                logger.error("❌ Socket UNIX non trouvé, attente avant nouvelle tentative...")
                await asyncio.sleep(2)

            except ConnectionRefusedError:
                logger.error("❌ Impossible de se connecter au socket UNIX, réessai dans 2s...")
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"❌ Erreur inattendue dans handle_message: {e}")
                await asyncio.sleep(2)

            finally:
                logger.warning("🚪 Connexion IPC fermée, réessai en cours...")

    async def message(self, message):
        msg = message['text']
        to = message['to']
        attachments = message['attachments']
        logger.info(f"message reçu {msg} {attachments}")

        # Extract the message text
        l = msg.split(' ')
        #le préfixe de la commande est le premier mot
        cmd1 = l[0]
        #le nouveau message est le reste
        msg = ' '.join(l[1:])
        
        #si un objet est indexé par le préfixe de la commande on l'utilise
        #print(f"****************************commande = {cmd1} et observers = {self.observers}")
        o = None;
        try:
            o = self.observers[cmd1]
        except:
            logger.warning(f"****************************** {cmd1} introuvable")
        if o != None:
            message['text'] = msg
            await o.notify(msg,to, attachments)
        # else:
        #     logger.warning(f"****************************** perroquet n'est pas chargé")

  
    async def run(self):
        # Lancer le bot asyncio
        await self.handle_message()


