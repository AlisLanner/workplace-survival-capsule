import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { AdminGate } from "./components/AdminGate";
import { ErrorBoundary } from "./components/ErrorBoundary";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ScenarioPage = lazy(() => import("./pages/ScenarioPage").then((m) => ({ default: m.ScenarioPage })));
const ChatPage = lazy(() => import("./pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const ReportPage = lazy(() => import("./pages/ReportPage").then((m) => ({ default: m.ReportPage })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ScenariosPage = lazy(() => import("./pages/admin/ScenariosPage").then((m) => ({ default: m.ScenariosPage })));
const ScenarioWizardPage = lazy(() => import("./pages/admin/ScenarioWizardPage").then((m) => ({ default: m.ScenarioWizardPage })));
const ScenarioDetailPage = lazy(() => import("./pages/admin/ScenarioDetailPage").then((m) => ({ default: m.ScenarioDetailPage })));
const PromptsPage = lazy(() => import("./pages/admin/PromptsPage").then((m) => ({ default: m.PromptsPage })));
const SessionsPage = lazy(() => import("./pages/admin/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const SessionDetailPage = lazy(() =>
  import("./pages/admin/SessionDetailPage").then((m) => ({ default: m.SessionDetailPage }))
);

export function App() {
  return (
    <ErrorBoundary>
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="grain" aria-hidden="true" />
      <nav className="nav">
        <div className="wrap nav-inner">
          <NavLink to="/" className="brand">
            <span className="seal">MA</span>
            <span>MACST · 情境行为评估系统</span>
          </NavLink>
          <div className="nav-links">
            <NavLink to="/" end>
              首页
            </NavLink>
            <NavLink to="/scenarios">评估情境</NavLink>
            <NavLink to="/admin">管理端</NavLink>
          </div>
        </div>
      </nav>
      <Suspense
        fallback={
          <main className="wrap page">
            <div className="loading">正在加载页面…</div>
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/scenarios" element={<ScenarioPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="/report/:sessionId" element={<ReportPage />} />
          <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
            <Route index element={<DashboardPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="scenarios/new" element={<ScenarioWizardPage />} />
            <Route path="scenarios/:id" element={<ScenarioDetailPage />} />
            <Route path="prompts" element={<PromptsPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
