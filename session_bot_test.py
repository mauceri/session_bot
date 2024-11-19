import asyncio
from session_bot_plugin_manager import PluginManager



if __name__ == "__main__":
    pluginManager = PluginManager()
    asyncio.run(pluginManager.run())
