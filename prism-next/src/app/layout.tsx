import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { siteDescription } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://127.0.0.1:17926"),
  title: { default:"MAAT · 看见能力的不同侧面", template:"%s · MAAT" },
  description:siteDescription,
  applicationName:"MAAT",
  openGraph:{title:"MAAT · 看见能力的不同侧面",description:siteDescription,locale:"zh_CN",type:"website"},
  robots:{index:true,follow:true},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-CN" className="dark h-full bg-background antialiased [color-scheme:dark]"><body className="h-full overflow-hidden font-sans text-foreground selection:bg-sky-100 selection:text-slate-950"><AppShell>{children}</AppShell></body></html>;
}
