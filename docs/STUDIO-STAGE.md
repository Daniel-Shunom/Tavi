# Companion stage UI experiment

The studio keeps a large centered portrait visible above a separately scrolling tool deck. Use the lighting controls for Moonlight, Daydream, and Afterhours; click the character to wave. **More tools** reallocates space without covering the avatar. Appearance, personality, Twitch, playground, and stream setup remain mounted and accessible in the tool deck. Studio lighting and portrait positioning do not change the OBS canvas.

With the dev server running, `node tools/stage-browser-check.mjs` checks that scrolling and expanding the tools never covers the avatar at desktop, laptop, mobile, and short-screen sizes, including keyboard tab navigation. Screenshots are saved in ignored `test-results/`.
