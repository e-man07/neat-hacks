"use client";

import { useEffect, useState } from "react";
import { Hash, Send, Smartphone, Webhook, type LucideIcon } from "lucide-react";
import { Field, Notice, PageHead, Tone } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, useApi } from "@/lib/app";

type Integrations = {
  connected: Record<string, { connected?: boolean; channel?: string; team_name?: string; url_host?: string; topic?: string } | undefined>;
  slack_available: boolean;
};

function Head({ icon: Icon, title, on, children }: { icon: LucideIcon; title: string; on: boolean; children: React.ReactNode }) {
  return (
    <CardHeader className="gap-3">
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-lg border bg-background text-foreground">
          <Icon className="size-5" />
        </span>
        {on ? <Tone color="ok">connected</Tone> : <Tone color="grey">off</Tone>}
      </div>
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-1 leading-relaxed">{children}</CardDescription>
      </div>
    </CardHeader>
  );
}

export default function IntegrationsPage() {
  const { data, reload } = useApi<Integrations>("/integrations");
  const [hook, setHook] = useState("");
  const [topic, setTopic] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [justConnected, setJustConnected] = useState(false);
  useEffect(() => {
    setJustConnected(new URLSearchParams(window.location.search).get("slack") === "connected");
  }, []);
  const c = data?.connected ?? {};
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <>
      <PageHead
        title="Paging"
        sub="Where Nightly reaches you. It pages only when something needs a human; everything else lands in the morning report."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              act(async () => {
                const r = await api<{ delivered: string[]; errors: string[] }>("/integrations/test", { method: "POST" });
                if (r.errors.length) throw new Error(r.errors.join("; "));
                setMsg({ ok: true, text: `Test page sent via ${r.delivered.join(", ")}` });
              }, "Test page sent")
            }
          >
            <Send /> Send a test page
          </Button>
        }
      />
      <div className="mb-4 space-y-2">
        {justConnected && <Notice ok>Slack connected.</Notice>}
        {msg && <Notice ok={msg.ok}>{msg.text}</Notice>}
      </div>
      {!data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-4">
            <Head icon={Hash} title="Slack" on={!!c.slack}>
              One message per incident, updated as Nightly works, with <b className="text-foreground">Approve fix</b> and{" "}
              <b className="text-foreground">Undo</b> buttons right in the channel.
            </Head>
            <CardContent className="flex-1 text-sm">
              {c.slack ? (
                <p className="text-foreground/80">
                  Posting to <b className="text-foreground">{c.slack.channel ?? "your channel"}</b>
                  {c.slack.team_name ? ` in ${c.slack.team_name}` : ""}.
                </p>
              ) : !data.slack_available ? (
                <p className="text-xs text-muted-foreground">The Slack app isn&apos;t configured on this server (SLACK_CLIENT_ID/SECRET).</p>
              ) : null}
            </CardContent>
            <CardFooter>
              {c.slack ? (
                <Button
                  variant="outline"
                  className="border-alert/30 text-alert hover:bg-alert/10 hover:text-alert"
                  onClick={() => act(() => api("/integrations/slack", { method: "DELETE" }), "Slack disconnected")}
                >
                  Disconnect
                </Button>
              ) : data.slack_available ? (
                <Button onClick={() => act(async () => (window.location.href = (await api<{ url: string }>("/integrations/slack/install")).url), "")}>
                  <Hash /> Add to Slack
                </Button>
              ) : null}
            </CardFooter>
          </Card>

          <Card className="gap-4">
            <Head icon={Smartphone} title="Phone push (ntfy)" on={!!c.ntfy}>
              Push notifications through the free ntfy app. Pick a long, unguessable topic and subscribe to it on your phone.
            </Head>
            <CardContent className="flex-1 space-y-3">
              {c.ntfy && <p className="font-mono text-xs text-foreground/80">topic: {c.ntfy.topic}</p>}
              <Field label="Topic">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="nightshift-7f3a9c21" className="font-mono" />
              </Field>
            </CardContent>
            <CardFooter className="gap-2">
              <Button disabled={!topic} onClick={() => act(() => api("/integrations/ntfy", { method: "PUT", json: { config: { topic } } }), "ntfy saved")}>
                Save
              </Button>
              {c.ntfy && (
                <Button variant="outline" onClick={() => act(() => api("/integrations/ntfy", { method: "DELETE" }), "ntfy removed")}>
                  Remove
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card className="gap-4">
            <Head icon={Webhook} title="Webhook" on={!!c.webhook}>
              A JSON POST for PagerDuty, Opsgenie or your own tooling: title, body, priority, incident and agent ids, link.
            </Head>
            <CardContent className="flex-1 space-y-3">
              {c.webhook && <p className="font-mono text-xs text-foreground/80">→ {c.webhook.url_host}</p>}
              <Field label="HTTPS URL">
                <Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://events.pagerduty.com/…" />
              </Field>
            </CardContent>
            <CardFooter className="gap-2">
              <Button disabled={!hook} onClick={() => act(() => api("/integrations/webhook", { method: "PUT", json: { config: { url: hook } } }), "Webhook saved")}>
                Save
              </Button>
              {c.webhook && (
                <Button variant="outline" onClick={() => act(() => api("/integrations/webhook", { method: "DELETE" }), "Webhook removed")}>
                  Remove
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
