"""Sprint and step-hop skipping plans with explicit support and flight phases."""
import math
from locomotion import smooth, distance_progress

PROFILES={'sprint':dict(beat=20,beats=6,distance=312,body=20,tail_lift=32,tail_pitch=0.55,tail_dx=0),
          'skip':dict(beat=48,beats=4,distance=320,body=21,tail_lift=18,tail_pitch=0.18,tail_dx=46)}
BASE={'L':288.5,'R':322.5}

def quintic(u):return u*u*u*(10-15*u+6*u*u)

def gait_sample(mode,frame,direction):
    cfg=PROFILES[mode];beat=cfg['beat']
    count=cfg['beats']
    frame=max(0,min(count*beat,frame));step=min(count-1,int(frame//beat));u=(frame-step*beat)/beat
    first='L' if direction>0 else 'R'
    swing=first if step%2==0 else ('R' if first=='L' else 'L')
    other='R' if swing=='L' else 'L'
    contacts={'L':0.0,'R':0.0}
    for completed in range(step):
        side=first if completed%2==0 else ('R' if first=='L' else 'L')
        partner='R' if side=='L' else 'L'
        if mode=='sprint':contacts[side]+=direction*104
        else:contacts[side]=contacts[partner]+BASE[partner]-BASE[side]+direction*80
    start_lift=0 if step==0 else cfg['tail_lift']
    start_pitch=0 if step==0 else direction*cfg['tail_pitch']
    feet={side:(x,0,0) for side,x in contacts.items()}
    if mode=='sprint':
        feet[swing]=(contacts[swing]+direction*104*quintic(u),
                     -start_lift*(1-smooth(u))-42*math.sin(math.pi*u),
                     start_pitch*(1-smooth(u))+direction*0.12*math.sin(2*math.pi*u))
        support=(other,) if u<=0.4 else ()
        if u<=0.15:body=12+2*smooth(u/0.15)
        elif u<=0.4:body=14-10*smooth((u-0.15)/0.25)
        else:
            v=(u-0.4)/0.6
            body=4+8*v-18*4*v*(1-v)
            feet[other]=(contacts[other],-32*math.sin(math.pi*v/2),direction*0.55*smooth(v))
        arm=direction*0.44*math.cos(math.pi*(step+u))
        fore=1.85+0.12*math.sin(math.pi*(step+u))
        body+=8
    else:
        target=contacts[other]+BASE[other]-BASE[swing]+direction*52
        step_contact=16/beat;hop_takeoff=24/beat
        if u<=step_contact:
            p=u/step_contact
            feet[swing]=(contacts[swing]+(target-contacts[swing])*quintic(p),
                         -start_lift*(1-smooth(p))-14*math.sin(math.pi*p)**2,
                         start_pitch*(1-smooth(p))+direction*0.1*math.sin(2*math.pi*p))
            body=10+4*smooth(p);support=(other,)
        elif u<=hop_takeoff:
            p=(u-step_contact)/(hop_takeoff-step_contact)
            feet[swing]=(target,0,0)
            feet[other]=(contacts[other],-18*smooth(p),direction*0.18*smooth(p))
            body=14-4*smooth(p);support=(swing,)
        else:
            p=(u-hop_takeoff)/(1-hop_takeoff);arc=4*p*(1-p)
            feet[swing]=(target+direction*28*smooth(p),-42*arc,direction*0.10*math.sin(math.pi*p))
            feet[other]=(contacts[other],-18-42*arc,direction*0.18)
            body=10-42*arc;support=()
        arm=0.20+0.04*math.sin(2*math.pi*(step+u))
        fore=-0.44+0.04*math.sin(2*math.pi*(step+u))
        body+=11
    return dict(root=direction*cfg['distance']*distance_progress(frame/(count*beat)),feet=feet,
                body=body,arm=arm,fore=fore,support=support,swing=swing)
