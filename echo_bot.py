import asyncio
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)



async def handle_message():
    logger.info("Prêt !")
    reader, writer = await asyncio.open_unix_connection(path=socket_path)
    
    try:
        while True:
            # Receive message from Bun
            data = await reader.read(1024*10)
            try:
                message = data.decode()
                logger.info(f"Message reçu: {message}")
                
                # If we received a message, send it back prefixed with 'py:'
                if message:
                    response = f'py: {message.split(": ", 1)[1]}'
                    writer.write(response.encode())
                    await writer.drain()
                else:
                    break
            except UnicodeDecodeError:
                logger.error("Erreur lors du décodage du message reçu")
    except asyncio.CancelledError:
        logger.info("Arrêt du traitement des messages")
    finally:
        writer.close()
        await writer.wait_closed()
   
async def run():
    # Lancer le bot asyncio
    await handle_message()

# Boucle asyncio
if __name__ == "__main__":
    asyncio.run(run())