import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { SessionProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { RequireAdmin, RequireAuth, RequireGuest } from './components/RouteGuards';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { EventDetail } from './pages/EventDetail';
import { Guides } from './pages/Guides';
import { GuideDetail } from './pages/GuideDetail';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { LevelSelect } from './pages/LevelSelect';
import { Play } from './pages/Play';
import { GameApi } from './pages/GameApi';
import { NotFound } from './pages/NotFound';
import { Loading } from './components/Status';

// Admin pages are only for a handful of users: keep them out of the main bundle.
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminLevels = lazy(() => import('./pages/admin/AdminLevels').then((m) => ({ default: m.AdminLevels })));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents').then((m) => ({ default: m.AdminEvents })));
const AdminGuides = lazy(() => import('./pages/admin/AdminGuides').then((m) => ({ default: m.AdminGuides })));

function AdminOutlet() {
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
}

// Route guards are module-level layout routes (RequireAuth/RequireAdmin/RequireGuest), so pages are never remounted by re-renders.
export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="guides" element={<Guides />} />
            <Route path="guides/:slug" element={<GuideDetail />} />
            <Route path="about" element={<About />} />

            <Route element={<RequireGuest />}>
              <Route path="login" element={<Login />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="profile" element={<Profile />} />
              <Route path="level-select" element={<LevelSelect />} />
              <Route path="play" element={<Play />} />
              <Route path="game-api" element={<GameApi />} />
            </Route>

            <Route path="admin" element={<RequireAdmin />}>
              <Route element={<AdminOutlet />}>
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="levels" element={<AdminLevels />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="guides" element={<AdminGuides />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
