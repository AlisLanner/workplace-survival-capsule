import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/admin-shell";
import { AdminScenarios } from "@/components/admin/admin-scenarios";
export const metadata: Metadata = { title: "场景与岗位配置", description: "管理评估情境、岗位信息与统一八维权重。", robots: { index: false, follow: false }, alternates: { canonical: "/admin/scenarios" } };
export default function Page() { return <><AdminHeading kicker="STUDIO / SCENARIOS" title="为岗位，选择合适的切面。" description="管理内置情境与自定义情境，按岗位关注点配置八维权重；新建情境由四步向导生成并安装。" /><AdminScenarios /></>; }
