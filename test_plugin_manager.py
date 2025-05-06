#!/usr/bin/env python3
"""
Tests unitaires pour PluginManager (chargement et déchargement de plugins).
"""
import os
import sys
import shutil
import tempfile
import asyncio
import unittest

from plugin_manager import PluginManager


def create_dummy_plugin(root_plugins_dir, name="dummy"):
    # Crée un plugin minimal dans plugins/<name>/<name>/__init__.py
    base = os.path.join(root_plugins_dir, name)
    pkg = os.path.join(base, name)
    os.makedirs(pkg, exist_ok=True)
    init_py = os.path.join(pkg, "__init__.py")
    with open(init_py, 'w') as f:
        f.write("""
class Plugin:
    def __init__(self, manager):
        self.manager = manager
        self.started = False
        self.stopped = False
    def start(self):
        self.started = True
    async def stop(self):
        self.stopped = True
""")
    return name


class TestPluginManager(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Répertoire temporaire simulant le projet
        self.tmp = tempfile.mkdtemp()
        # Dossiers plugins/ et data/
        plugins_dir = os.path.join(self.tmp, 'plugins')
        data_dir = os.path.join(self.tmp, 'data')
        os.makedirs(plugins_dir, exist_ok=True)
        os.makedirs(data_dir, exist_ok=True)
        # Créer un plugin dummy
        name = create_dummy_plugin(plugins_dir, name='dummy')
        # Fichier plugins.yaml
        import yaml
        cfg = {'plugins': [
            {'name': name,
             'package': name,
             'url': plugins_dir,
             'enabled': True}
        ]}
        path_yaml = os.path.join(data_dir, 'plugins.yaml')
        with open(path_yaml, 'w') as f:
            yaml.safe_dump(cfg, f)
        # Initialiser manager
        sys.path.insert(0, self.tmp)
        self.manager = PluginManager(root_dir=self.tmp)

    async def asyncTearDown(self):
        shutil.rmtree(self.tmp)

    async def test_load_unload_plugin(self):
        # Le plugin dummy doit être chargé
        self.assertIn('dummy', self.manager.plugins)
        plugin = self.manager.plugins['dummy']
        self.assertTrue(hasattr(plugin, 'start') and plugin.started)
        # Décharger
        await self.manager.unload_plugin('dummy')
        self.assertNotIn('dummy', self.manager.plugins)


if __name__ == '__main__':
    unittest.main()