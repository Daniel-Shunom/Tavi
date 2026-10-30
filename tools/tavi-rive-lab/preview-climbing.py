"""Open native climbing reviews; optional arguments select individual views."""
from pathlib import Path
import os
import subprocess
import sys

root=Path(__file__).resolve().parents[2]
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
views=sys.argv[1:] or ('front','left','right','rear')
assert set(views)<=set(('front','left','right','rear','turnaround','locomotion','walking')),'Unknown motion view'
for view in views:
    folder=root/'art/tavi-rive-lab'/(view if view in ('turnaround','locomotion','walking') else 'climbing-'+view)
    process=subprocess.Popen([str(rive),str(folder)],cwd=root,stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    print(view,process.pid)
