"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LogIn, Medal, ShieldCheck, Swords } from "lucide-react";
import type { AppUserRole } from "@/types/bolao";

const navigationItems = [
  {
    href: "/",
    label: "Dashboard",
    description: "Proximos jogos",
    icon: LayoutGrid,
  },
  {
    href: "/acesso",
    label: "Acesso",
    description: "Participantes",
    icon: LogIn,
  },
  {
    href: "/palpites",
    label: "Palpites",
    description: "Jogos e picks",
    icon: Swords,
  },
  {
    href: "/ranking",
    label: "Ranking",
    description: "Tabela geral",
    icon: Medal,
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Resultados",
    icon: ShieldCheck,
  },
] as const;

export function BolaoNav({
  isLoggedIn,
  currentUserRole,
}: {
  isLoggedIn: boolean;
  currentUserRole: AppUserRole | null;
}) {
  const pathname = usePathname();
  const visibleNavigationItems = navigationItems.filter((item) => {
    if (item.href === "/acesso") {
      return true;
    }

    if (!isLoggedIn) {
      return item.href === "/";
    }

    if (item.href === "/admin") {
      return currentUserRole === "admin" || currentUserRole === "moderator";
    }

    return true;
  });

  return (
    <nav className="glass-surface rounded-2xl p-2 md:rounded-3xl md:p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-5">
        {visibleNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-2xl border px-3 py-2.5 text-left transition active:scale-95 md:px-4 md:py-3 ${
                isActive
                  ? "border-emerald-300/40 bg-emerald-400/12 text-white shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                  : "border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-400">
                {item.description}
              </p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
