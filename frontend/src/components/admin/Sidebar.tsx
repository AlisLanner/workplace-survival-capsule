import { NavLink } from "react-router-dom";

const links = [
  ["/admin", "概览"],
  ["/admin/scenarios", "场景与岗位配置"],
  ["/admin/sessions", "测评记录"],
  ["/admin/prompts", "提示词 · 高级"]
] as const;

export function Sidebar() {
  return (
    <aside className="aside">
      <span className="ab">ASSESSMENT OPS</span>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/admin"}>
            {label}
          </NavLink>
        ))}
      </nav>
      <p className="small muted" style={{ padding: "0 18px", marginTop: "auto" }}>
        面向使用方的配置端：公司、HR 与用人部门在这里创建场景、设置八维权重并查看测评记录。
      </p>
    </aside>
  );
}
