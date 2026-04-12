import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Home,
  Monitor,
  PlaneTakeoff,
  TerminalSquare,
  Tv,
  Cpu,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface DockItem {
  icon: LucideIcon
  label: string
  path: string
}

const navItems: DockItem[] = [
  { icon: Home, label: "Index", path: "/" },
  { icon: Monitor, label: "Control", path: "/1" },
  { icon: PlaneTakeoff, label: "Departures", path: "/2" },
  { icon: TerminalSquare, label: "Terminal", path: "/3" },
  { icon: Tv, label: "Broadcast", path: "/4" },
  { icon: Cpu, label: "Schematic", path: "/5" },
]

const floatingAnimation = {
  initial: { y: 0 },
  animate: {
    y: [-1.5, 1.5, -1.5],
    transition: {
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

const DockIconButton = React.forwardRef<
  HTMLButtonElement,
  {
    icon: LucideIcon
    label: string
    active: boolean
    onClick: () => void
  }
>(({ icon: Icon, label, active, onClick }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.15, y: -3 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "relative group w-10 h-10 flex items-center justify-center rounded-xl transition-colors",
        active
          ? "bg-[var(--accent-dim)]"
          : "hover:bg-[var(--surface-raised)]"
      )}
    >
      <Icon
        className="w-[18px] h-[18px]"
        style={{
          color: active ? "var(--accent)" : "var(--text-secondary)",
          strokeWidth: 1.5,
        }}
      />
      <span
        className={cn(
          "absolute -top-9 left-1/2 -translate-x-1/2",
          "px-2.5 py-1 rounded-lg text-[10px] tracking-wider uppercase",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity whitespace-nowrap pointer-events-none"
        )}
        style={{
          background: "var(--surface-raised)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-system)",
          border: "1px solid var(--border-default)",
        }}
      >
        {label}
      </span>
    </motion.button>
  )
})
DockIconButton.displayName = "DockIconButton"

export function DockNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.div
        initial="initial"
        animate="animate"
        variants={floatingAnimation}
        className="pointer-events-auto"
      >
        <div
          className="flex items-center gap-2 p-2 rounded-2xl backdrop-blur-xl shadow-2xl"
          style={{
            background: "rgba(17, 17, 17, 0.85)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          {navItems.map((item) => (
            <DockIconButton
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
