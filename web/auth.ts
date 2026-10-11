import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/** Server-side base URL of the Nightly API (can differ from the public one). */
export const API_INTERNAL = process.env.NS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Without a GitHub OAuth app the web app runs in local dev mode against a dev-mode API. */
export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

type GitHubProfile = { id: number | string; login: string; name?: string | null; avatar_url?: string; email?: string | null };

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: githubEnabled
    ? [GitHub({ authorization: { params: { scope: "read:user user:email repo" } } })]
    : [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/signin" },
  trustHost: true,
  callbacks: {
    // Register the user (and their GitHub token, encrypted server-side) with the API before letting them in.
    async signIn({ account, profile }) {
      if (account?.provider !== "github" || !profile) return false;
      const p = profile as unknown as GitHubProfile;
      const res = await fetch(`${API_INTERNAL}/api/internal/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Secret": process.env.NS_INTERNAL_SECRET ?? "" },
        body: JSON.stringify({
          id: `gh_${p.id}`,
          login: p.login,
          name: p.name ?? null,
          avatar_url: p.avatar_url ?? null,
          email: p.email ?? null,
          github_token: account.access_token ?? null,
        }),
        cache: "no-store",
      }).catch((e) => {
        console.error(`nightly API unreachable at ${API_INTERNAL}:`, e);
        return null;
      });
      if (res?.ok) return true;
      // Say why, instead of the generic AccessDenied page.
      const reason = !res ? "ApiUnreachable" : res.status === 401 ? "InternalSecretMismatch" : `ApiError${res.status}`;
      console.error(`nightly sign-in failed: ${reason} (${API_INTERNAL})`);
      return `/signin?error=${reason}`;
    },
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as unknown as GitHubProfile;
        token.uid = `gh_${p.id}`;
        token.login = p.login;
        token.avatar = p.avatar_url ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      return { ...session, uid: token.uid, login: token.login, avatar: token.avatar };
    },
    authorized({ auth: s }) {
      return !githubEnabled || Boolean(s);
    },
  },
});
