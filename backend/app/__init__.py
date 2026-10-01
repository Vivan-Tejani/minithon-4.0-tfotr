"""Chokepoint Backend Application."""
import sys
from pathlib import Path

_backend_dir = str(Path(__file__).resolve().parent.parent)
_repo_dir = str(Path(__file__).resolve().parent.parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
if _repo_dir not in sys.path:
    sys.path.insert(0, _repo_dir)
