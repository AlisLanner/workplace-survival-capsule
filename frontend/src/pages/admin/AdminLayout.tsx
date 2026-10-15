import { Outlet } from "react-router-dom";
import { Sidebar } from "../../components/admin/Sidebar";

export function AdminLayout() {
  return (
    <div className="admin">
      <Sidebar />
      <main className="amain">
        <Outlet />
      </main>
    </div>
  );
}
