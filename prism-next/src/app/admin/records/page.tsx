import type { Metadata } from "next";
import { AdminHeading } from "@/components/admin/admin-shell";
import { AdminRecords } from "@/components/admin/admin-records";
export const metadata: Metadata = { title: "测评记录", description: "浏览真实测评会话，回看对话与行为观察报告。", robots: { index: false, follow: false }, alternates: { canonical: "/admin/records" } };
export default function Page() { return <><AdminHeading kicker="STUDIO / RECORDS" title="把表现，留在可回看的记录中。" description="按情境与状态浏览全部会话，进入详情回看逐轮对话、报告与运维操作。" /><AdminRecords /></>; }
