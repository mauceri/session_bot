import logging
from interfaces import IObserver, IObservable, IPlugin
import json

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
        logger.info(f"********************** Observateur créé {self.echo.prefix()}")
        
    def start(self):
        logger.info(f"********************** Inscripton de {self.echo.prefix()}")
        print(f"********************** Inscripton de {self.echo.prefix()}")
        self.__observable.subscribe(self.echo)

    async def stop(self):
        pass