import Link from "next/link";
import { Wordmark } from "./mark";

/** Thin midnight bar used on public and onboarding pages. */
export function PublicHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="on-dark bg-midnight text-night">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="Sirrom home"><Wordmark tone="light" size="sm" /></Link>
        {children && <div className="ml-auto flex min-w-0 items-center gap-3">{children}</div>}
      </div>
    </header>
  );
}
