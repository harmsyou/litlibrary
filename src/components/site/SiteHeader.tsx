import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function SiteHeader({ crumb, right }: { crumb?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <Link to="/" className="font-semibold tracking-tight hover:opacity-70">
          Reading Room
        </Link>
        {crumb && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-muted-foreground">{crumb}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
