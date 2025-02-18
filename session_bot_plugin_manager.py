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
import websockets

from collections import defaultdict
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

class PluginManager:
    def __init__(self,root_dir=None,uri = "ws://localhost:8089"):
        """
        Args:
           config (Config): Paramètres de configuration pour le bot
        """
        self.partial_messages = defaultdict(lambda: {"chunks": {}, "received": 0, "total": 0})

        self.websocket = None
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

        # Charger les plugins à partir du fichier YAML
        self.update_plugins()

    async def handle_message_in_chunks(self):
        """
        Reçoit les fragments sur 'websocket', les réassemble et renvoie l'objet JSON complet.
        """
        try:
            sorted_chunks = []
            while True:
                raw_data = await self.websocket.recv()
                chunk_obj = json.loads(raw_data)
                logger.info(f"chunk obj {chunk_obj['index']}/{chunk_obj['total']}")
                msg_id = chunk_obj["messageId"]
                index = chunk_obj["index"]
                total = chunk_obj["total"]
                data_part = chunk_obj["data"]

                self.partial_messages[msg_id]["chunks"][index] = data_part
                self.partial_messages[msg_id]["received"] += 1
                self.partial_messages[msg_id]["total"] = total

                if self.partial_messages[msg_id]["received"] == total:
                    # Reconstitution
                    sorted_chunks = [
                        self.partial_messages[msg_id]["chunks"][i]
                            for i in range(total)
                    ]
                    full_str = "".join(sorted_chunks)
                    final_message = json.loads(full_str)
                    #logger.info("************************************** final_message {final_message}")
                    # Nettoyage des données partielles
                    del self.partial_messages[msg_id]

                    # Traiter l'objet final reçu (final_message)
                    # Exemple : print(final_message) ou autre traitement
                    return final_message
        except Exception as e:
            logger.error(f"Erreur WebSocket: {e}")
            return None

    
    async def send_json_in_chunks(self, message, chunk_size=1000000):
        """
            Découpe le JSON 'message' en fragments et les envoie par WebSocket.
        """
        message_str = json.dumps(message)
        total_length = len(message_str)
        message_id = str(id(message))  # ou tout autre identifiant

        index = 0
        while index < total_length:
            chunk = message_str[index : index + chunk_size]
            payload = {
                "messageId": message_id,
                "index": index // chunk_size,
                "total": (total_length - 1) // chunk_size + 1,
                "data": chunk,
            }
            await self.websocket.send(json.dumps(payload))
            index += chunk_size


    def update_plugins(self):
         with open(self.path_yaml_plugin, 'r') as fichier:
            contenu = yaml.safe_load(fichier)
            plugind = json.loads(json.dumps(contenu))

            for plugin in plugind['plugins']:
                name = plugin['name']
                url = plugin['url']
                package = plugin['package']
                keep = False
                if 'env' in plugin :
                    for env in  plugin['env']:
                        key, val = next(iter(env.items())) 
                        os.environ[key]=val
                if plugin['enabled']:
                    plugin_path = os.path.join(self.plugin_dir, name)
                    logger.info(f"£££££££££££££££££££££££££££££££££££££££££ {plugin}")
                    if('keep' in plugin and plugin['keep']):
                        logger.info(f"£££££££££££££££££££££££££££££££££££££££££ {plugin['keep']}")
                        self.load_plugin(name,package,url,plugin_path=os.path.join(self.plugin_dir, name),keep=True)
                    else:
                        self.load_plugin(name,package,url,plugin_path=os.path.join(self.plugin_dir, name),keep=False)           
                else:
                    self.unload_plugin(name)


    def load_plugin(self, plugin_name, package, plugin_url, plugin_path, keep):
        try:
            if not keep:
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
                logger.info(f"ààààààààààààààààààààààààààààààà {sys.path}")

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

    async def initialize_websocket(self):
        if self.websocket is None or self.websocket.closed:
            self.websocket = await websockets.connect(self.config["websocket_uri"])
            logger.info("Connexion WebSocket initialisée.")

    async def notify(self,message:str,to:str,attachments):
        #logger.info(f"***************************Notification du message {message} {attachments}")
        logger.info(f"***************************Notification du message {message}")
                 
        message = {"from":to, "text":message,"frombobot":True,"attachments":attachments}     
        try:
            message_json = json.dumps(message)
#            await self.websocket.send(message_json)
            await self.send_json_in_chunks(message_json)
            logger.info("Message renvoyé avec succès depuis bobot à session_bot")
        except websockets.exceptions.ConnectionClosed as e:
            logger.error(f"Connexion WebSocket fermée. Code: {e.code}, raison: {e.reason}")
            self.websocket = None  # Réinitialisez la connexion pour la rouvrir si nécessaire
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi du message depuis bobot: {e}")

        #await send_text_to_room(self.client,room.room_id,message)

    async def message(self, message):
        msg = message['text']
        to = message['to']
        attachments = message['attachments']
        #logger.info(f"message reçu {msg} {attachments}")
        logger.info(f"message reçu {msg}")

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
        if o == None:
            try:
                o = self.observers["!c"]
                msg = cmd1 + ' ' + msg 
            except:
                logger.warning(f"****************************** collect n'est pas chargé")  
        if o != None:             
            message['text'] = msg
            await o.notify(msg,to, attachments)
        

    
    async def handle_message(self):
    
        await self.initialize_websocket()
        logger.info(f"Prêt !")
        try:
            while True:
                # Écouter les messages de session_bot
                message = await self.handle_message_in_chunks()
                logging.info(f"************************************ {message}")
                #message = json.loads(data)
                await self.message(message)
        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connexion WebSocket fermée. Code: {e.code}, Raison: {e.reason}")
        finally:
            print("Client WebSocket fermé proprement.")

    async def run(self):
        # Lancer le bot asyncio
        await self.handle_message()
