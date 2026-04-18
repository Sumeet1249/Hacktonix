import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";

interface TopNavBarProps {
  projectId?: string;
}

export default function TopNavBar({ projectId }: TopNavBarProps) {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { label: "Dashboard", href: "/projects", active: path === "/projects" },
    { label: "Probing", href: projectId ? `/projects/${projectId}` : null, active: projectId ? path === `/projects/${projectId}` : false },
    { label: "Simulation", href: projectId ? `/projects/${projectId}/simulation` : null, active: projectId ? path === `/projects/${projectId}/simulation` : false },
    { label: "Datasets", href: projectId ? `/projects/${projectId}/datasets` : null, active: projectId ? path === `/projects/${projectId}/datasets` : false },
    { label: "Analytics", href: projectId ? `/projects/${projectId}/analytics` : null, active: projectId ? path === `/projects/${projectId}/analytics` : false },
  ];

  return (
    <header className="fixed top-0 left-64 right-0 z-40 flex justify-center items-center h-20 bg-white/50 backdrop-blur-md border-b border-slate-200/50">
      <nav className="rounded-full bg-white/60 border border-slate-200/10 px-8 py-2.5 shadow-sm flex items-center gap-10 font-body font-medium text-[13px]">
        {navItems.map((item) => (
          item.href ? (
            <Link
              key={item.label}
              to={item.href}
              className={`pb-0.5 transition-all uppercase tracking-widest font-bold ${
                item.active
                  ? "text-primary border-b-2 border-primary"
                  : "text-slate-400 hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className="text-slate-300 pb-0.5 cursor-not-allowed opacity-50 uppercase tracking-widest font-bold"
              title="Select a project first"
            >
              {item.label}
            </span>
          )
        ))}
      </nav>
      <div className="absolute right-8 flex items-center gap-6 text-slate-400">
        <Bell size={18} className="cursor-pointer hover:text-primary transition-colors" />
        <Settings size={18} className="cursor-pointer hover:text-primary transition-colors" />
      </div>
    </header>

  );
}
