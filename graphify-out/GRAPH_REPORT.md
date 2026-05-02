# Graphify Report (AST-only)

Summary:
- Nodes: 1273
- Edges: 1872
- Communities: 151

**God Nodes**:

The top hub nodes (high degree) identified by analysis:

- `String()` — degree 73
- `authenticateUser()` — degree 23
- `checkRoleExpiration()` — degree 21
- `getUserInfo()` — degree 20
- `buildAnalyticsSnapshot()` — degree 15
- `getFreshToken()` — degree 14
- `queryOne()` — degree 14
- `buildHodAnalyticsSnapshot()` — degree 14
- `insert()` — degree 13
- `update()` — degree 13

**Surprising Connections**:

- `statusLabel()` → `String()` — files: `app\bookvenue\page.tsx`, `app\statuscheck\page.tsx` — relation: calls — confidence: INFERRED
  - Why: inferred connection; bridges separate communities; peripheral node `statusLabel()` unexpectedly reaches hub `String()`

- `handleRegistration()` → `String()` — files: `app\event\[id]\page.tsx`, `app\statuscheck\page.tsx` — relation: calls — confidence: INFERRED
  - Why: inferred connection; bridges separate communities; peripheral node `handleRegistration()` unexpectedly reaches hub `String()`

- `safeLower()` → `String()` — files: `app\masteradmin\page.tsx`, `app\statuscheck\page.tsx` — relation: calls — confidence: INFERRED
  - Why: inferred connection; bridges separate communities; peripheral node `safeLower()` unexpectedly reaches hub `String()`

- `safeText()` → `String()` — files: `app\masteradmin\page.tsx`, `app\statuscheck\page.tsx` — relation: calls — confidence: INFERRED
  - Why: inferred connection; bridges separate communities; peripheral node `safeText()` unexpectedly reaches hub `String()`

- `safeText()` → `String()` — files: `app\accounts\page.tsx`, `app\statuscheck\page.tsx` — relation: calls — confidence: INFERRED
  - Why: inferred connection; bridges separate communities; peripheral node `safeText()` unexpectedly reaches hub `String()`

