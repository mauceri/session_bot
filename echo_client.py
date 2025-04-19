import asyncio
import websockets

async def echo_client(uri):
    async with websockets.connect(uri) as websocket:
        print(f"Connecté à {uri}")
        while True:
            msg = await websocket.recv()
            print(f"Reçu: {msg}")
            await websocket.send(msg)
            print(f"Renvoyé: {msg}")

if __name__ == "__main__":
    asyncio.run(echo_client("ws://localhost:8089"))
