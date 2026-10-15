import { useEffect, useState } from "react";
import { listAdminScenarios, updateAdminScenario } from "../../api/admin.api";
import { ScenarioEditor } from "../../components/admin/ScenarioEditor";
import type { Scenario } from "../../types/assessment";

export function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setScenarios(await listAdminScenarios());
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(id: string, data: Partial<Scenario>) {
    await updateAdminScenario(id, data);
    await load();
  }

  return (
    <>
      <div className="admin-heading">
        <span className="kicker">Scenario Ops</span>
        <h2 className="h2">场景管理</h2>
      </div>
      {error ? <p className="error-box">{error}</p> : null}
      <div className="admin-stack">
        {scenarios.map((scenario) => (
          <ScenarioEditor key={scenario.id} scenario={scenario} onSave={(data) => save(scenario.id, data)} />
        ))}
      </div>
    </>
  );
}
