---
name: Replit web preview ports
description: Port alignment needed when configuring an Express app for the Replit web preview
---

Replit web preview workflows use port 5000, so an app whose local default is another port must receive `PORT=5000` in the workflow command.

**Why:** A workflow can be configured successfully but fail at runtime when the server listens on port 3000 while the webview waits for port 5000.

**How to apply:** For Node/Express apps, configure the webview workflow with `PORT=5000 npm start` and `waitForPort: 5000`.