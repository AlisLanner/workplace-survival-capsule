import { useEffect, useMemo, useState } from "react";
import { listSessions } from "../../api/admin.api";
import { SessionTable } from "../../components/admin/SessionTable";
import type { AdminSession } from "../../types/admin";

const statusLabel: Record<string, string> = {
  running: "进行中",
  finished: "已完成",
  abandoned: "已超时"
};

export function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scenarioOptions = useMemo(() => {
    const unique = new Map<string, string>();
    sessions.forEach((session) => {
      unique.set(session.scenario.id, session.scenario.title);
    });
    return Array.from(unique, ([id, title]) => ({ id, title }));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesStatus = statusFilter === "all" || session.status === statusFilter;
      const matchesScenario = scenarioFilter === "all" || session.scenario.id === scenarioFilter;
      const matchesKeyword = Boolean(
        !keyword ||
          session.id.toLowerCase().includes(keyword) ||
          session.scenario.title.toLowerCase().includes(keyword) ||
          session.user?.nickname?.toLowerCase().includes(keyword)
      );

      return matchesStatus && matchesScenario && matchesKeyword;
    });
  }, [query, scenarioFilter, sessions, statusFilter]);

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Admin · Sessions</span>
        <h2 className="h2">会话</h2>
      </div>
      {error ? <p className="error-box">{error}</p> : null}

      <section className="session-console glass" aria-label="会话筛选">
        <div className="admin-form">
          <label className="f-label">
            搜索
            <input
              className="f-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="会话 ID、场景或昵称"
            />
          </label>
          <label className="f-label">
            状态
            <select className="f-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="f-label">
            场景
            <select className="f-select" value={scenarioFilter} onChange={(event) => setScenarioFilter(event.target.value)}>
              <option value="all">全部场景</option>
              {scenarioOptions.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? <p className="loading">正在读取会话...</p> : null}
      <SessionTable sessions={filteredSessions} />
    </>
  );
}
