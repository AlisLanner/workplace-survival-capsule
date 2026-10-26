import type { Metadata } from "next";
import { ReportView } from "@/components/report-view";
type Props = { params: Promise<{ sessionId: string }> };
export const metadata: Metadata = { title: "行为观察报告", robots: { index: false, follow: false } };
export default async function ReportPage({ params }: Props) {
  const { sessionId } = await params;
  return <ReportView sessionId={sessionId} />;
}
