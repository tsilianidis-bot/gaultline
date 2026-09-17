## File Storage

Manus Forge object storage (`/manus-storage/` plus Forge presign) is disabled.

`server/storage.ts` helpers fail closed. They do not call Manus, do not return `/manus-storage/{key}` URLs, and do not require `BUILT_IN_FORGE_API_*`.

Leftover browser requests to `/manus-storage/*` are answered by a compatibility route that returns **404** without contacting any storage host. Product pages must boot without those assets.

```ts
import { storagePut } from "./server/storage";

// Throws until an independent storage backend is configured.
await storagePut("example.png", fileBuffer, "image/png");
```

Do not restore Manus storage hosts or hardcoded `/manus-storage/` asset URLs.
