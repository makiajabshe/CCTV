import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const { Provider: TooltipProvider, Root: Tooltip, Trigger: TooltipTrigger } = TooltipPrimitive;
const TooltipContent = ({ children }: { children: string }) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content side="right" sideOffset={8}
      className="z-50 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-md fade-in">
      {children}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
);

const BrandMark = ({ className = "" }: { className?: string }) => (
  <span aria-hidden="true" className={`grid h-9 w-9 place-items-center rounded-xl bg-white/10 ${className}`}>
    <span className="grid grid-cols-2 gap-0.5">
      <span className="h-2 w-2 rounded-sm bg-white" />
      <span className="h-2 w-2 rounded-sm bg-white/45" />
      <span className="h-2 w-2 rounded-sm bg-white/45" />
      <span className="h-2 w-2 rounded-sm bg-emerald-400" />
    </span>
  </span>
);

const NAV = [{ href: "/", label: "Ringkasan pengunjung", icon: LayoutDashboard, testId: "nav-dashboard-link" }];

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen md:flex">
    <nav aria-label="Navigasi utama" data-testid="nav-rail"
      className="hidden md:flex w-[72px] shrink-0 sticky top-0 h-screen flex-col items-center gap-8 py-5 bg-ink text-white">
      <BrandMark />
      <TooltipProvider delayDuration={150}>
        <ul className="flex flex-col items-center gap-2">
          {NAV.map((n) => (
            <li key={n.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href={n.href} aria-label={n.label} aria-current="page" data-testid={n.testId} className="rail-item">
                    <n.icon className="h-5 w-5" aria-hidden="true" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>{n.label}</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </nav>

    <header data-testid="mobile-topbar"
      className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-ink px-4 text-white">
      <BrandMark className="h-8 w-8" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">People Counter</p>
        <p className="text-[11px] text-white/70">Ringkasan pengunjung</p>
      </div>
    </header>

    <div className="min-w-0 flex-1">{children}</div>
  </div>
);
