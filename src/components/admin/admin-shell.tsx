"use client";

import * as React from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {LogOut, SearchIcon, UserRound} from "lucide-react";
import {toast} from "sonner";

import {AdminBreadcrumbs} from "@/components/admin/admin-breadcrumbs";
import {AdminSidebar} from "@/components/admin/admin-sidebar";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import {authClient} from "@/lib/auth-client";
import {cn} from "@/lib/utils";
import type {AdminSearchResults} from "@/lib/domain";

const emptyResults: AdminSearchResults = {albums: [], messages: []};
type AdminSearchState = {status: "idle" | "loading" | "ready" | "unauthorized" | "error"; results: AdminSearchResults};

function AdminSearch(): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [searchState, setSearchState] = React.useState<AdminSearchState>({status: "idle", results: emptyResults});
  const normalizedQuery = query.trim();

  React.useEffect(() => {
    if (normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`, {cache: "no-store", signal: controller.signal})
        .then(async (response) => {
          if (response.status === 401) {
            if (!controller.signal.aborted) setSearchState({status: "unauthorized", results: emptyResults});
            return;
          }
          if (!response.ok) throw new Error("Admin search failed");
          const results = await response.json() as AdminSearchResults;
          if (!controller.signal.aborted) setSearchState({status: "ready", results});
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState({status: "error", results: emptyResults});
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, retryCount]);

  const changeQuery = (value: string): void => {
    setQuery(value);
    setSearchState({status: value.trim().length < 2 ? "idle" : "loading", results: emptyResults});
  };

  const closeAfterNavigation = (): void => {
    setOpen(false);
    changeQuery("");
  };

  return (
    <div className="relative min-w-0 [--focus:var(--charcoal)]">
      <label className="sr-only" htmlFor="admin-global-search">Search albums and messages</label>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="admin-global-search"
        type="search"
        aria-controls="admin-search-results"
        autoComplete="off"
        maxLength={100}
        placeholder="Album, client, or message"
        className="h-9 bg-background pl-10 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        value={query}
        onChange={(event) => {
          setOpen(true);
          changeQuery(event.currentTarget.value);
        }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      <div
        id="admin-search-results"
        role="region"
        aria-label="Search results"
        aria-live="polite"
        hidden={!open}
        className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-md border border-border bg-popover p-2.5 text-popover-foreground shadow-md"
      >
        {normalizedQuery.length < 2 ? <p className="p-2 text-sm text-muted-foreground">Type at least 2 characters.</p> : null}
        {searchState.status === "loading" ? <p className="p-2 text-sm" role="status" aria-live="polite">Searching albums and messages...</p> : null}
        {searchState.status === "unauthorized" ? (
          <p className="p-2 text-sm" role="status">Sign in to search admin records. <Link className="underline underline-offset-4" href="/admin/login">Admin sign in</Link></p>
        ) : null}
        {searchState.status === "error" ? (
          <p className="flex min-h-11 items-center justify-between gap-3 p-2 text-sm" role="alert">
            <span>Could not search albums and messages.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 underline underline-offset-4"
              onClick={() => {
                setSearchState({status: "loading", results: emptyResults});
                setRetryCount((count) => count + 1);
              }}
            >Retry search</Button>
          </p>
        ) : null}
        {searchState.status === "ready" && normalizedQuery.length >= 2 && searchState.results.albums.length + searchState.results.messages.length === 0 ? (
          <p className="p-2 text-sm" role="status" aria-live="polite">No albums or messages match “{normalizedQuery}”.</p>
        ) : null}
        {searchState.status === "ready" && searchState.results.albums.length > 0 ? (
          <section aria-labelledby="admin-search-albums-label">
            <h2 id="admin-search-albums-label" className="px-2 pb-1 pt-2 font-medium">Albums</h2>
            <ul>
              {searchState.results.albums.map((album) => (
                <li key={album.id}>
                  <Link
                    href={`/admin/albums/${album.id}`}
                    onClick={closeAfterNavigation}
                    className="flex min-h-11 flex-col justify-center rounded-sm px-2 py-1 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                  >
                    <span className="truncate">{album.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{album.slug}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {searchState.status === "ready" && searchState.results.messages.length > 0 ? (
          <section aria-labelledby="admin-search-messages-label">
            <h2 id="admin-search-messages-label" className="px-2 pb-1 pt-2 font-medium">Messages</h2>
            <ul>
              {searchState.results.messages.map((message) => (
                <li key={message.id}>
                  <Link
                    href={`/admin/messages/${message.id}`}
                    onClick={closeAfterNavigation}
                    className="flex min-h-11 flex-col justify-center rounded-sm px-2 py-1 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                  >
                    <span className="truncate">{message.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{message.email ?? message.eventType}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function AdminProfile({name, email}: {name: string | null; email: string | null}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const displayName = name ?? email ?? "Admin";
  const initial = Array.from(name?.trim() || email?.trim() || "")[0]?.toLocaleUpperCase();

  const signOut = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error("Could not sign out. Try again.");
        return;
      }
      setOpen(false);
      router.push("/admin/login");
    } catch {
      toast.error("Could not sign out. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${displayName} profile`}
          className="rounded-full font-semibold md:pointer-fine:size-8"
        >
          {initial ? <span aria-hidden="true">{initial}</span> : <UserRound aria-hidden="true" className="size-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Admin profile options" className="w-56 gap-2 rounded-md border border-border p-2 shadow-md">
        <div className="min-w-0 px-2 py-1 text-left">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {name && email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => void signOut()}
          className="w-full justify-start gap-2 px-2 text-left font-normal"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span>{pending ? "Signing out" : "Sign out"}</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AdminShell({name, email, children}: {name: string | null; email: string | null; children: React.ReactNode}): React.ReactElement {
  const [scrolled, setScrolled] = React.useState(false);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateScroll = (): void => setScrolled(el.scrollTop > 0);
    updateScroll();
    el.addEventListener("scroll", updateScroll, {passive: true});
    return () => el.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <SidebarProvider style={{"--sidebar-width": "240px"} as React.CSSProperties} className="bg-sidebar pt-[var(--admin-header-height)] [--admin-header-height:104px] md:[--admin-header-height:48px] md:h-svh md:overflow-hidden">
      <AdminSidebar collapsible="icon" />
        <header className="admin-topbar fixed inset-x-0 top-0 z-30 h-[var(--admin-header-height)] bg-sidebar px-3 py-1 text-sidebar-foreground md:py-2">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 md:grid-cols-[minmax(0,1fr)_minmax(0,330px)_minmax(0,1fr)]">
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
              <SidebarTrigger className="min-h-11 min-w-11 md:hidden" aria-label="Toggle admin navigation" aria-controls="admin-navigation" />
              <span className="text-sm md:hidden">Menu</span>
              <Link href="/admin" className="hidden min-h-11 items-center text-sm font-semibold md:flex">Elhaq Photography</Link>
            </div>
            <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
              <AdminSearch />
            </div>
            <div className="col-start-2 row-start-1 justify-self-end md:col-start-3">
              <AdminProfile name={name} email={email} />
            </div>
          </div>
        </header>
      <SidebarInset
        className="mx-2 mb-2 min-w-0 rounded-xl md:ml-0 md:mr-2 flex-1 flex flex-col min-h-0 md:h-[calc(100svh-var(--admin-header-height)-0.5rem)] overflow-hidden"
      >
        <header
          data-scrolled={scrolled}
          className="sticky top-0 z-20 shrink-0 bg-background rounded-t-xl"
        >
          <div
            className={cn(
              "rounded-t-xl px-4 py-1.5 sm:py-2 sm:px-5 bg-background transition-colors duration-150",
              scrolled ? "border-b border-border" : "border-b border-transparent"
            )}
          >
            <AdminBreadcrumbs />
          </div>
        </header>
        {/* Native scroll container: the browser scrollbar is always accurate, unlike an overlay one
            that keeps a stale thumb after the content shrinks (for example a tab switch). */}
        <div ref={viewportRef} className="admin-scroll min-h-0 w-full flex-1">
          <div className="w-full px-4 pt-5 sm:px-5 flex flex-col min-h-full">
            {children}
          </div>
        </div>
        {/* Fixed thin base, mirroring the breadcrumb: the card floor never moves, only the content scrolls. */}
        <div aria-hidden="true" className="h-1.5 sm:h-2 shrink-0 rounded-b-xl bg-background" />
      </SidebarInset>
    </SidebarProvider>
  );
}
