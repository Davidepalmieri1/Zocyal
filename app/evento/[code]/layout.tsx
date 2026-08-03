import { ReactNode } from "react"
import ExperienceSidebar from "@/app/components/ExperienceSidebar"
import NetworkStatus from "@/app/components/NetworkStatus"
import NotificationCenter from "@/app/components/NotificationCenter"

type EventoLayoutProps = {
  children: ReactNode
}

export default function EventoLayout({
  children,
}: EventoLayoutProps) {
  return (
    <div className="event-experience-shell contents">
      <NetworkStatus />
      <NotificationCenter />
      {children}
      <ExperienceSidebar />
    </div>
  )
}
