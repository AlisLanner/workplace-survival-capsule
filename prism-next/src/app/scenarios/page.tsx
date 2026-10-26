import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { SceneGalleryLoader } from "@/components/scene-gallery-loader";
export const metadata: Metadata = { title: "测评情境", description: "从启用中的岗位情境选择一个工作切面，了解角色关系、任务与协作挑战。", alternates: { canonical: "/scenarios" } };
export default function ScenariosPage() {
  return <div className="mx-auto max-w-[1260px] px-6 pt-8 pb-8 md:px-10 lg:px-14 lg:pt-10">
    <PageHeading chapter="01 / CHOOSE A PERSPECTIVE" title="每一个情境，都是一个工作切面。" description="没有唯一的工作视角。选择一张情境卡，看见其中的任务、关系与判断。" />
    <SceneGalleryLoader />
  </div>;
}
