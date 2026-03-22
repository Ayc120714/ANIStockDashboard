/**
 * Smoke test: barrel re-exports resolve (run: npm test -- --watchAll=false src/router/verifyRouterExports.test.js)
 */
import {
  BrowserRouter,
  Link,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
  useSearchParams,
} from './reactRouterExports';

describe('reactRouterExports', () => {
  it('exports router APIs', () => {
    expect(BrowserRouter).toBeDefined();
    expect(Link).toBeDefined();
    expect(Routes).toBeDefined();
    expect(Route).toBeDefined();
    expect(Outlet).toBeDefined();
    expect(useNavigate).toBeDefined();
    expect(useLocation).toBeDefined();
    expect(Navigate).toBeDefined();
    expect(useSearchParams).toBeDefined();
  });
});
