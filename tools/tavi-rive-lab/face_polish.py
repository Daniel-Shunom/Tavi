"""Face polish that keeps the head reading as one surface."""

# Clear glass: a faint white sheen instead of a coloured tint. The tinted
# lenses overhang the face, so over the hair they turned into magenta patches.
LENS_FILLS=('0:435','0:426')
CLEAR='18FFFFFF'


def clear_lenses(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    for id in LENS_FILLS:objects[id].set('colorValue',CLEAR)
    # Every glasses palette keeps its frame colour; only the lens fill clears.
    for clip in board.findall('LinearAnimation'):
        if not clip.get('name','').startswith('glasses '):continue
        for obj in clip.findall('KeyedObject'):
            if obj.get('objectId') in LENS_FILLS:
                for key in obj.iter('KeyFrameColor'):key.set('value',CLEAR)
