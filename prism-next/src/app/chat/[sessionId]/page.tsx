import type { Metadata } from "next";
import { RealAssessmentRoom } from "@/components/real-assessment-room";
type Props = { params: Promise<{ sessionId: string }> };
export const metadata: Metadata = { title: "情境测验", robots: { index: false, follow: false } };
export default async function ChatPage({ params }: Props) {
  const { sessionId } = await params;
  return <RealAssessmentRoom sessionId={sessionId} />;
}
