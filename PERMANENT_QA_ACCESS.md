# Permanent Owner QA Access

The permanent QA entry route is `/qa-access`. On production domains it requires `QA_ACCESS_SECRET` and receives only an HttpOnly, signed cookie. The secret is never included in a URL, local storage, database record, or browser bundle.

The resulting synthetic principal is labeled **OWNER QA · READ ONLY**. It may execute `publicProcedure`, `protectedProcedure`, `coreProcedure`, and `premiumProcedure` **queries** solely to render intelligence surfaces. It is explicitly rejected from all mutations and all admin procedures. It does not create or update a user row, subscription, Stripe record, access-tier record, schedule, or application setting.

Managed local and Manus preview hosts are designated internal QA environments and receive the same read-only principal without a production secret. Public domains do not receive that convenience path.

## Validation record

The managed preview at `https://3000-ipnf4bqutsccuw2s5ekp8-5ab5291b.us4.manus.computer` returned the synthetic `faultline_owner_qa` principal through `auth.me`, rendered the visible **OWNER QA · READ ONLY** indicator, and reached the protected Day Trade visual-detail route without an OAuth login. The Day Trade report provider itself remained unavailable during this observation; the route now bounds the report at 12 seconds and completed daily bars at 8 seconds so that condition must resolve to an explicit source-status response rather than indefinite loading.
