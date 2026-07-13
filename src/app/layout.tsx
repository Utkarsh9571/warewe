import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"SignalBrief - Newsletter Agent",description:"Observable LangGraph newsletter agent"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
