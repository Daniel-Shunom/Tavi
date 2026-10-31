# OBS webcam awareness

## Current local setup

The streamer has enabled the OBS WebSocket server and configured a password. The default port is **4455**. Enter the password directly in Studio's OBS connection panel when connecting; do not put it in this guide, source control, or saved project settings. The password is intentionally not recorded here.

### OBS setup

1. In OBS, open **Tools → WebSocket Server Settings**.
2. Enable **WebSocket server**. Keep the default server port **4455**, unless another port is needed; if changed, use the same port in Tavi.
3. Set or retain the server password and save the settings. The password is required for Tavi to authenticate, but it is only entered into the connection form and is not stored by Tavi.
4. In Tavi Studio, open **Placement → Find webcam in OBS**. Enter the host (`127.0.0.1` when OBS and Tavi run on the same computer), port, and OBS password, then start discovery.
5. Confirm the panel reports **Connected** and an OBS-verified camera source and region. If OBS has multiple possible camera sources, select the webcam explicitly.

If the OBS WebSocket settings item is missing, use OBS 28 or newer, where WebSocket support is built in. OBS and Tavi must run on the same computer for this first integration.

In Studio, open **Setup › Match your stream layout** and use **Find webcam in OBS**. In OBS, enable **Tools → WebSocket Server Settings → Enable WebSocket server**. Use that port (normally 4455) and password in Studio. OBS and Tavi must run on the same computer for this first integration. The Tavi browser source must fill the base OBS canvas so normalized coordinates line up. The layout editor always shows whether the webcam is OBS-verified, a manually declared rectangle, or not detected. Searching reads source metadata; it does not animate the character wandering around to infer a camera.

The observer only reads scene information. It follows the active program scene, visible source transforms, crops, and changes to source visibility. It can follow axis-aligned sources inside groups or nested scenes, including parent scaling and cropping. It does not modify OBS scenes, capture camera images, or send screenshots to an AI provider. Passwords are used for the current connection and are not saved or returned by the status API. Reconnect after restarting the service.

One visible source named Webcam, Facecam, Camera, or Cam is detected automatically. A generic capture-device source can also be a game capture card, so its type alone is never treated as proof of a webcam. Select the intended source once when names are ambiguous or generic. Selections are held per active scene for the current service session. Removing or hiding that selected source does not silently substitute another camera.

OBS-derived webcam geometry is disabled when the selected source is missing, hidden, off canvas, ambiguous, unreadable, or the connection drops. Previously imported geometry and old saved rectangles without an explicit manual declaration are also disabled on service restart until OBS is read again. Manually placed webcam regions remain the streamer's explicit declaration: select **Manual region — not verified by OBS** after disconnecting, then enable and edit the region. A manual rectangle is never labeled as OBS detection.

Perching requires an enabled webcam region with sufficient width, screen headroom and reachable height, using the same fit rules as the body-state system. A game frame is never substituted for a missing webcam. An explicit failed perch request performs the planted `perch-hesitate` gesture and creates neither movement nor an imaginary body-state surface. Autonomous behavior skips unavailable perches.

This first geometry importer deliberately declines rotated sources and OBS bounding-box fitting modes. Disconnect and place their visible region manually instead. It does not infer transparent or circular masks, pixel-level occlusion, or content inside a combined browser overlay. The fit status measures the known rectangle and Tavi's current standard reach model; it is not a claim of image understanding or complete OBS layer occlusion.

Protocol references: [OBS WebSocket v5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md), [OBS source transforms](https://github.com/obsproject/obs-studio/blob/master/libobs/obs-scene.c).
