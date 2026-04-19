import { createClient } from "@base44/sdk";

const appId = "69e3be468fa94eb66b56c686";

// In dev, use an empty serverUrl so the SDK emits same-origin /api/... calls,
// which Vite proxies to http://localhost:4400 (base44 dev).
// In prod, omit serverUrl and let the SDK default to https://base44.app.
const config = { appId };
if (import.meta.env.DEV) config.serverUrl = "";

export const base44 = createClient(config);
