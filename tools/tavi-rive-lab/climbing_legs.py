"""Climbing-only projection of fixed-length legs bending into surface depth."""
import math
import xml.etree.ElementTree as ET

A=71.474152
B=67.434799
DEPTH_SCALE=.30


def lift_projected_knee(hip,foot,kx):
    """Keep a high, stylized knee within both projected segment reach limits."""
    upper=math.sqrt(max(0,A*A-(kx-hip[0])**2))
    lower=math.sqrt(max(0,B*B-(foot[0]-kx)**2))
    low=max(hip[1]-upper,foot[1]-lower)
    high=min(hip[1]+upper,foot[1]+lower)
    assert low<=high+.001,'Knee control outside leg reach'
    return kx,low+.18*(high-low)


def install_surface_legs(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    pants=objects['0:635']
    for index,(upper,shape,ankle) in enumerate((('0:2519','0:2544','41:102'),('0:2494','0:679','41:122'))):
        base=100+index*100
        for joint in range(2):
            ET.SubElement(pants,'RootBone',name='climb-only/projected-leg-'+str(joint),
                          length='0',id=f'67:{base+joint}')
        for tendon in objects[shape].iter('Tendon'):
            tendon.set('boneId',f'67:{base if tendon.get("boneId")==upper else base+1}')
        objects[ankle].set('targetId',f'67:{base+1}')


def surface_knee(hip,foot,depth,direction):
    """Solve a constant-length Y/Z chain; project depth only for side views."""
    dy=foot[1]-hip[1]
    reach=math.hypot(dy,depth)
    assert reach<=A+B+.001,f'Climbing leg overreach: {reach}'
    along=(A*A-B*B+reach*reach)/(2*reach)
    bend=math.sqrt(max(0,A*A-along*along))
    ky=hip[1]+along*dy/reach-bend*depth/reach
    kz=along*depth/reach+bend*dy/reach
    # Any tiny rest-pose transverse offset converges smoothly onto the hip
    # column. During climbing the whole visible offset is depth projection.
    fraction=(ky-hip[1])/max(.001,dy)
    kx=hip[0]+fraction*(foot[0]-hip[0])+direction*DEPTH_SCALE*(kz-fraction*depth)
    # Art-direct the lift in projected depth: the knee can rise high without
    # sweeping forward, while the calf still reaches the same contact point.
    return lift_projected_knee(hip,foot,kx)
