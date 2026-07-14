import { ReactNode } from "react"
import ExperienceSidebar from "@/app/components/ExperienceSidebar"

type EventoLayoutProps = {
  children: ReactNode
}

export default function EventoLayout({
  children,
}: EventoLayoutProps) {
  return (
    <>
      {children}
      <ExperienceSidebar />
    </>
  )
}