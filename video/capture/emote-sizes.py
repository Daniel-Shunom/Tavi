# Downsamples the 448 px emote renders to Twitch's emote sizes (112, 56, 28).
# Usage, from the repo root: python video/capture/emote-sizes.py
from pathlib import Path

from PIL import Image

for src in sorted(Path('brand/emotes').glob('tavi-*-448.png')):
    image = Image.open(src).convert('RGBA')
    for size in (112, 56, 28):
        image.resize((size, size), Image.LANCZOS).save(src.with_name(src.name.replace('-448', f'-{size}')))
    print('sized', src.name)
