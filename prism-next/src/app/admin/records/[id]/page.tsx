import type { Metadata } from "next";
import { RecordDetail } from "@/components/admin/record-detail";
type Props = { params: Promise<{ id: string }> };
export const metadata: Metadata = { title: "记录详情", robots: { index: false, follow: false } };
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <RecordDetail sessionId={id} />;
}
