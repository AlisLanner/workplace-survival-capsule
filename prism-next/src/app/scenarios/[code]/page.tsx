import type { Metadata } from "next";
import { ScenarioIntro } from "@/components/scenario-intro";
type Props = { params: Promise<{ code: string }> };
export const dynamicParams = true;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: "情境任务", description: "了解情境的角色、任务与协作挑战，确认后进入正式测验。", robots: { index: false, follow: false }, alternates: { canonical: `/scenarios/${code}` } };
}
export default async function ScenarioPage({ params }: Props) {
  const { code } = await params;
  return <ScenarioIntro scenarioKey={code} />;
}
