import type { Metadata } from "next";
import { ScenarioDetail } from "@/components/admin/scenario-detail";
type Props = { params: Promise<{ id: string }> };
export const metadata: Metadata = { title: "场景详情", robots: { index: false, follow: false } };
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ScenarioDetail scenarioId={id} />;
}
