import type { Metadata } from "next";
import { ScenarioWizard } from "@/components/admin/scenario-wizard";
export const metadata: Metadata = { title: "新建评估情境", robots: { index: false, follow: false } };
export default function Page() { return <ScenarioWizard />; }
