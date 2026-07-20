import { ReactNode } from "react"
import ExperienceSidebar from "@/app/components/ExperienceSidebar"
import NetworkStatus from "@/app/components/NetworkStatus"

type EventoLayoutProps = {
  children: ReactNode
}

export default function EventoLayout({
  children,
}: EventoLayoutProps) {
  return (
    <div className="event-experience-shell contents">
      <NetworkStatus />
      {children}
      <ExperienceSidebar />
    </div>
  )
}
