---
name: Commuter client architecture
description: Shared Troski web/mobile API boundary and the staged persistence decision.
---

The Troski web and Expo commuter clients intentionally use the same generated commuter API contracts and API server. The first native slice keeps client-visible booking and report history in local device storage while the server data layer remains in-memory.

**Why:** This lets the cross-platform commuter experience be usable immediately without prematurely coupling the first mobile build to authentication, database migrations, or payment providers.

**How to apply:** Preserve the shared API boundary when adding durable storage, authentication, and Ghanaian payment methods. Replace local/in-memory persistence as a coordinated product step rather than creating separate web and mobile data models.