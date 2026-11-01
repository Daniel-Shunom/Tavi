# Measures Tavi's bounding box (alpha > 40) in every captured frame for the ad.
# Usage, from video/: python capture/measure-ad.py public/footage/tavi src/ad/shots.json reveal hero chatread alive-a alive-b romp drop outro
import sys, json, os
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
root=sys.argv[1]; out=sys.argv[2]; names=sys.argv[3:]
def box(p):
    im=Image.open(p); a=im.getchannel('A').reduce(8)
    b=a.point(lambda v:255 if v>40 else 0).getbbox()
    if not b: return None
    w,h=a.size; return [round(b[0]/w,4),round(b[1]/h,4),round(b[2]/w,4),round(b[3]/h,4)]
def shot(n):
    m=json.load(open(f"{root}/{n}/meta.json")); step=2
    bx=[box(f"{root}/{n}/{i:05d}.png") for i in range(0,m['frames'],step)]
    full=[bx[min(i//step,len(bx)-1)] for i in range(m['frames'])]
    return n,{'frames':m['frames'],'width':m['width'],'height':m['height'],'presentation':m['presentation'],'box':full}
if __name__=='__main__':
    res={}
    with ProcessPoolExecutor(8) as ex:
        for n,r in ex.map(shot,names): res[n]=r; print('done',n,flush=True)
    json.dump(res,open(out,'w'),separators=(',',':'))
