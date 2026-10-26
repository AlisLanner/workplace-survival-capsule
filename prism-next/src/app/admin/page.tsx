import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/admin-overview";
export const metadata: Metadata = { title: "管理工作台", description: "MAAT 管理工作台前端预览。", robots: { index: false, follow: false }, alternates: { canonical: "/admin" } };
export default function AdminPage() { return <><AdminHeading kicker="STUDIO / OVERVIEW" title="让每一次观察，有序展开。" description="从岗位情境到测评记录，在一个工作空间中组织配置与反馈。" /><AdminOverview /></>; }
