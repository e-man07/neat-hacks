import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, githubEnabled, signIn } from "@/auth";
import NightSky from "@/components/NightSky";
import { Moon } from "@/components/ui";

const ERRORS: Record<string, string> = {
  ApiUnreachable: "GitHub sign-in worked, but this site can't reach the Night Shift API. Check NS_API_URL and redeploy.",
  InternalSecretMismatch: "GitHub sign-in worked, but the API rejected this site. NS_INTERNAL_SECRET must match the API's.",
  AccessDenied: "Sign-in was refused.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const next = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/app";
  if (!githubEnabled || (await auth())) redirect(next);
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-bg px-4">
      <NightSky />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-line bg-card p-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
          <Moon /> Night Shift
        </Link>
        <h1 className="mt-6 text-xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          GitHub sign-in also lets Night Shift open fix PRs on your repos, and only after you approve them.
        </p>
        {error && (
          <p className="mt-4 rounded-md bg-alert/10 px-3 py-2 text-xs text-alert">
            {ERRORS[error] ?? `Sign-in failed (${error}). Try again.`}
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: next });
          }}
        >
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continue with GitHub
          </button>
        </form>
        <p className="mt-6 text-xs text-faint">
          Just looking? <Link href="/sandbox" className="underline">Try the sandbox</Link> without an account.
        </p>
      </div>
    </div>
  );
}
