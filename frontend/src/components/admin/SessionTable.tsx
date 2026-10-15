import { Link } from "react-router-dom";
import type { AdminSession } from "../../types/admin";

const statusLabel: Record<string, string> = {
  running: "进行中",
  finished: "已完成",
  abandoned: "已超时"
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function SessionTable({ sessions }: { sessions: AdminSession[] }) {
  if (!sessions.length) {
    return (
      <div className="empty-state">
        <strong>没有符合条件的会话</strong>
        <span>调整筛选后再查看。</span>
      </div>
    );
  }

  return (
    <div className="tbl-wrap glass">
      <table>
        <thead>
          <tr>
            <th>会话</th>
            <th>场景</th>
            <th>状态</th>
            <th>轮次</th>
            <th>参考指数</th>
            <th>开始时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                <Link className="t-id" to={`/admin/sessions/${session.id}`}>
                  {session.id.slice(0, 8)}
                </Link>
              </td>
              <td>{session.scenario.title}</td>
              <td>
                <span className={`st-pill st-${session.status}`}>
                  {statusLabel[session.status] ?? session.status}
                </span>
              </td>
              <td>{session.round}</td>
              <td>{session.totalScore ?? "-"}</td>
              <td>{formatDate(session.startedAt)}</td>
              <td>
                <Link className="t-link" to={`/admin/sessions/${session.id}`}>
                  查看
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
