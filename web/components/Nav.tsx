import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { Moon } from "./ui";

const LINKS = [
  { href: "/sandbox", label: "Sandbox" },
  { href: "/docs", label: "Docs" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/business", label: "Business" },
];

export default function Nav() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
        <Moon /> night shift
      </Link>
      <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="transition hover:text-white">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <a
          href="https://github.com/e-man07/neat-hacks"
          className="hidden text-sm text-white/60 transition hover:text-white sm:block"
        >
          GitHub
        </a>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
        >
          Sign in →
        </Link>
      </div>
    </header>
  );
}
