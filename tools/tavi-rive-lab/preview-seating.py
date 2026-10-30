"""Open the three isolated seated-pose previews on the user's desktop."""
from pathlib import Path
import os
import subprocess

root=Path(__file__).resolve().parents[2]
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
for folder in ('seating','seating-left','seating-right'):
    process=subprocess.Popen([str(rive),str(root/'art/tavi-rive-lab'/folder)],
        cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW)
    print(folder,process.pid)
