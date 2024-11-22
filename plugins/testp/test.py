import logging
from interfaces import IObserver, IObservable, IPlugin
import json
import os

logger = logging.getLogger(__name__)

class Echo(IObserver):
    def __init__(self,observable:IObservable=None):
        self.__observable =observable

    async def notify(self,msg:str,to:str,attachments):
        
        logger.info(f"***************************** L'utilisateur  a écrit {msg}")
        # Coco répète ce qu'on lui dit
        await self.__observable.notify(f"L'utilisateur {to} a écrit {msg}",to,attachments)

    def prefix(self):
        return "!echo"
    
class Plugin(IPlugin):
    def __init__(self,observable:IObservable):
        self.__observable = observable
        self.echo = Echo(self.__observable)
        
        # Déterminer le répertoire du plugin
        plugin_dir = os.path.dirname(os.path.abspath(__file__))

        # Chemin du nouveau répertoire 'data'
        self.data_dir = os.path.join(plugin_dir, 'data')

        # Créer le répertoire de données s'il n'existe pas
        os.makedirs(self.data_dir, exist_ok=True)

        # Autres initialisations
        print(f"Répertoire de données du plugin : {self.data_dir}")
        logger.info(f"********************** Observateur créé {self.echo.prefix()}")
        
    def start(self):
        logger.info(f"********************** Inscripton de {self.echo.prefix()}")
        print(f"********************** Inscripton de {self.echo.prefix()}")
        self.__observable.subscribe(self.echo)

    async def stop(self):
        pass