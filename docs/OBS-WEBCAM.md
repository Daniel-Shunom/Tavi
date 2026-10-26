# OBS webcam awareness

In Studio's scene layout, open **Locate webcam in OBS**. In OBS, enable **Tools → WebSocket Server Settings → Enable WebSocket server**. Use that port (normally 4455) and password in Studio. OBS and Tavi must run on the same computer for this first integration. The Tavi browser source must fill the base OBS canvas so normalized coordinates line up.

The observer only reads scene information. It follows the active program scene, visible source transforms, crops, and changes to source visibility. It can follow axis-aligned sources inside groups or nested scenes, including parent scaling and cropping. It does not modify OBS scenes, capture camera images, or send screenshots to an AI provider. Passwords are used for the current connection and are not saved or returned by the status API. Reconnect after restarting the service.

One visible source named Webcam, Facecam, Camera, or Cam is detected automatically. A generic capture-device source can also be a game capture card, so its type alone is never treated as proof of a webcam. Select the intended source once when names are ambiguous or generic. Selections are held per active scene for the current service session. Removing or hiding that selected source does not silently substitute another camera.

OBS-derived webcam geometry is disabled when the selected source is missing, hidden, off canvas, ambiguous, unreadable, or the connection drops. Previously imported geometry is also disabled on service restart until OBS is read again. Manually placed webcam regions remain the streamer's explicit declaration and can be edited after disconnecting OBS.

Perching requires an enabled webcam region with sufficient width, screen headroom and reachable height, using the same fit rules as the body-state system. A game frame is never substituted for a missing webcam. An explicit failed perch request performs the planted `perch-hesitate` gesture and creates neither movement nor an imaginary body-state surface. Autonomous behavior skips unavailable perches.

This first geometry importer deliberately declines rotated sources and OBS bounding-box fitting modes. Disconnect and place their visible region manually instead. It does not infer transparent or circular masks, pixel-level occlusion, or content inside a combined browser overlay. The fit status measures the known rectangle and Tavi's current standard reach model; it is not a claim of image understanding or complete OBS layer occlusion.

Protocol references: [OBS WebSocket v5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md), [OBS source transforms](https://github.com/obsproject/obs-studio/blob/master/libobs/obs-scene.c).
