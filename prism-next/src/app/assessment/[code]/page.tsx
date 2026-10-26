import { redirect } from "next/navigation";
import { resolveScenarioKey } from "@/lib/scene-profiles";
import { BUILTIN_IDS } from "@/lib/builtin-map";
type Props = { params: Promise<{ code: string }> };
/** 预览编号入口：转为真实情境介绍页（由用户显式开始，不在此创建会话）。 */
export default async function AssessmentEntry({ params }: Props) {
  const { code } = await params;
  const target = resolveScenarioKey(code);
  const id = target.id ?? BUILTIN_IDS[code];
  if (!id) redirect("/scenarios");
  redirect(`/scenarios/${target.code ?? id}`);
}
