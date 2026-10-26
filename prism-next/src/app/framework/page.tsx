import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { FrameworkView } from "@/components/framework-view";
export const metadata:Metadata={title:"能力框架",description:"从Great Eight统一八个能力领域理解岗位行为，结合具体情境解释表现与证据。",alternates:{canonical:"/framework"}};
export default function FrameworkPage(){return <div className="mx-auto max-w-[1210px] px-6 pt-8 pb-8 md:px-10 lg:px-14 lg:pt-10"><PageHeading chapter="02 / A SPECTRUM OF CAPABILITIES" title="一束光，八个能力侧面。" description="共同的能力框架，具体的岗位行为。让每一项观察回到情境。"/><FrameworkView/></div>;}
