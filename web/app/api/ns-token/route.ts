import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { auth, githubEnabled } from "@/auth";

export const dynamic = "force-dynamic";

/** A short-lived bearer token for the Nightly API, minted for the signed-in user. */
export async function GET() {
  if (!githubEnabled) {
    return NextResponse.json({ dev: true, token: null, user: { login: "dev", name: "Local developer", avatar: null } });
  }
  const session = (await auth()) as { uid?: string; login?: string; avatar?: string | null; user?: { name?: string | null } } | null;
  if (!session?.uid) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const secret = new TextEncoder().encode(process.env.NS_AUTH_SECRET ?? "");
  const ttl = 3600;
  const token = await new SignJWT({ login: session.login, name: session.user?.name ?? null, avatar: session.avatar ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.uid)
    .setAudience("nightshift-api")
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
  return NextResponse.json(
    { dev: false, token, expires_in: ttl, user: { login: session.login, name: session.user?.name ?? null, avatar: session.avatar ?? null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
