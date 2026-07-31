import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AntiDebug } from "@/components/AntiDebug";

export const metadata: Metadata = {
  title: "AI 今天吃什么 - 今天吃什么，不再纠结",
  description:
    "AI 智能菜谱推荐，随机推荐、AI 条件推荐、冰箱食材推荐，让每天吃饭不再纠结。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="renderer" content="webkit" />
      </head>
      <body className="min-h-full flex flex-col bg-[#FFF8F2]">
        <AntiDebug />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
