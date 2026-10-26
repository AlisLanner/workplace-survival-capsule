import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ProcessView } from "@/components/process-view";
export const metadata:Metadata={title:"评估流程",description:"了解MACST从多角色互动到原话证据与八维反馈的评估流程。",alternates:{canonical:"/process"}};
export default function ProcessPage(){return <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-10 md:px-10 lg:px-14 lg:pt-10"><PageHeading chapter="03 / FROM BEHAVIOR TO EVIDENCE" title="让复杂表现，成为可读的证据。" description="从进入情境，到独立评判，再到原话可追溯的反馈。"/><ProcessView/></div>;}
