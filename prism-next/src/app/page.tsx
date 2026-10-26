import type { Metadata } from "next";
import { PrismHero } from "@/components/prism-hero";
export const metadata:Metadata={title:{absolute:"MACST · 看见能力的不同侧面"},alternates:{canonical:"/"}};
export default function HomePage(){return <PrismHero/>;}
