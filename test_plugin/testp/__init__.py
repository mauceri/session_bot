import sys
from .testp import Plugin 

# Check that we're not running on an unsupported Python version.
if sys.version_info < (3, 5):
    print("amicus_bot's plugins require Python 3.5 or above.")
    sys.exit(1)

__version__ = "0.0.1"