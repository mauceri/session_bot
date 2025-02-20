import asyncio
from plugin_manager import PluginManager

#boucle asyncio
if __name__ == "__main__":
    pluginManager = PluginManager()
    asyncio.run(pluginManager.run())
