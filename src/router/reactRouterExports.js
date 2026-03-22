/**
 * Central re-exports for React Router (CRA-safe with react-router@6.30.x).
 * Optional: import from 'router/reactRouterExports' instead of splitting two packages.
 *
 * See: docs/development/REACT_ROUTER_IMPORTS.md
 */
export { BrowserRouter, HashRouter, Link, NavLink, useSearchParams } from 'react-router-dom';
export {
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
  Navigate,
  useParams,
  useMatch,
  useOutletContext,
  useResolvedPath,
} from 'react-router';
