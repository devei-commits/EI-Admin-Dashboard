# BD Management — wiring snippets (existing-file edits)

Phase 1 is built entirely in NEW files. To make `/bd` reachable, these 4 existing
files need small **additive** lines (nothing removed/changed). Per the "don't
modify existing files" instruction these are listed for approval — I can apply
them on your go-ahead.

## 1. Backend — `ei-website-backend/app.js`  (2 lines)
Near the other router requires (~line 43, by `clientHubRouters`):
```js
const bdRouters = require('./src/bd/routers');
```
Near the other mounts (~line 183, after the `/client-hub` line):
```js
app.use(`${apiPrefix}/bd`, isAuthenticated, bdRouters);
```

## 2. Frontend — `EI-Admin-Dashboard/src/App.tsx`  (3 spots)
Lazy import (~line 55, with the other `lazy(() => import(...))`):
```ts
const BD = lazy(() => import('./pages/bd/index'));
```
Standalone-route flag (~line 150, by `isProcurementRoute`):
```ts
const isBdRoute = location.pathname === '/bd' || location.pathname.startsWith('/bd/');
```
Route branch (~line 192, beside the `if (isProcurementRoute)` block):
```tsx
if (isBdRoute) {
  return (
    <StandaloneModuleLayout>
      <main id="main-content" className="min-h-screen">
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/bd" element={
                <ProtectedModuleRoute moduleId="order-management">
                  <BD />
                </ProtectedModuleRoute>
              } />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </main>
    </StandaloneModuleLayout>
  );
}
```

## 3. Frontend — `EI-Admin-Dashboard/src/components/Sidebar.tsx`  (1 `<li>`)
Inside the Order Management submenu `<ul>` (beside the Procurement item, ~line 457):
```tsx
<li>
  <PreloadNavLink to="/bd" className={submenuLinkClass} onClick={(e) => handleNavClick(e)}>
    <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
    </svg>
    <span>BD Management</span>
  </PreloadNavLink>
</li>
```

## 4. Frontend — `EI-Admin-Dashboard/src/constants/routes.ts` (optional, 1 line)
For consistency in `ROUTE_MODULE_MAP` (access already works via the explicit
`moduleId="order-management"` above, so this is cosmetic):
```ts
'/bd': 'order-management',
```

### Access note
`moduleId="order-management"` is reused intentionally: admins bypass all gates;
non-admins who can see Procurement/Orders also get BD. No new permission module
needs to be registered. (To gate BD separately later, register a `bd` module in
the permissions system and switch the `moduleId`.)
