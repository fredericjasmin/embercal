"""Runs fetch_recent.py and prep_recent.py with the project's virtualenv Python (any OS)."""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VENV = os.path.join(HERE, '..', '.venv')
py = os.path.join(VENV, 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(VENV, 'bin', 'python')
if not os.path.exists(py):
    py = sys.executable
for step in ('fetch_recent.py', 'prep_recent.py'):
    subprocess.run([py, os.path.join(HERE, step)], check=True)
