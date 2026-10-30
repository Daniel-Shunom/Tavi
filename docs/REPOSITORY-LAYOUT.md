# Repository layout

- `src/`: React studio and PixiJS/Tween.js renderer.
- `shared/`: validated configuration, commands, and demo behavior boundary.
- `server/`: Fastify/WebSocket service and local configuration persistence.
- `tests/`: behavior and real WebSocket integration tests.
- `desktop/`: Tauri shell maintained by the other agent; see its README.
- `.agents/skills/`: vendored project-local agent skills.
- `.agents/skills.lock.json`: pinned sources and SHA-256 hashes.
- `tools/skills.py`: dependency-free skill verification and restoration.
