import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      <div className="flex items-center gap-2">
        {right}
        <AccountMenu />
      </div>
    </header>
  );
}

function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="ml-1 flex size-7 items-center justify-center rounded-full border border-border text-[11px] font-medium uppercase transition-colors hover:bg-accent"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email ?? "Signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
