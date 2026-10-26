import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/admin-shell";
import { AdminPrompts } from "@/components/admin/admin-prompts";
export const metadata: Metadata = { title: "提示词管理", description: "管理角色互动与证据评判的提示词模板与版本。", robots: { index: false, follow: false }, alternates: { canonical: "/admin/prompts" } };
export default function Page() { return <><AdminHeading kicker="STUDIO / PROMPTS" title="让角色与判断，各有依据。" description="读取真实模板与版本；版本模板保存会生成新修订，运行中的会话沿用开始时的冻结快照。" /><AdminPrompts /></>; }
