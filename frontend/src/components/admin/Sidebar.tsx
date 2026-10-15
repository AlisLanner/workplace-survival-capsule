import { NavLink } from "react-router-dom";

const links = [
  ["/admin", "仪表盘"],
  ["/admin/scenarios", "场景"],
  ["/admin/prompts", "提示词"],
  ["/admin/sessions", "会话"]
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
    </aside>
  );
}
