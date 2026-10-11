"use client";

import { useEffect, useState } from "react";
import { Field, PageHead, inputCls } from "@/components/app/bits";
import { Button, Card, Label, Pill } from "@/components/ui";
import { api, useApi } from "@/lib/app";

type Integrations = {
  connected: Record<string, { connected?: boolean; channel?: string; team_name?: string; url_host?: string; topic?: string } | undefined>;
  slack_available: boolean;
};

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
            onClick={() =>
              act(async () => {
                const r = await api<{ delivered: string[]; errors: string[] }>("/integrations/test", { method: "POST" });
                if (r.errors.length) throw new Error(r.errors.join("; "));
                setMsg({ ok: true, text: `Test page sent via ${r.delivered.join(", ")}` });
              }, "Test page sent")
            }
          >
            Send a test page
          </Button>
        }
      />
      {justConnected && <p className="mb-4 rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">Slack connected.</p>}
      {msg && <p className={`mb-4 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-ok/10 text-ok" : "bg-alert/10 text-alert"}`}>{msg.text}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Label>slack</Label>
            {c.slack ? <Pill color="var(--ok)">connected</Pill> : <Pill>off</Pill>}
          </div>
          <p className="text-sm text-muted">
            One message per incident, updated as Nightly works, with <b>Approve fix</b> and <b>Undo</b> buttons right in the channel.
          </p>
          {c.slack ? (
            <>
              <p className="text-sm text-fg-2">
                Posting to <b>{c.slack.channel ?? "your channel"}</b>
                {c.slack.team_name ? ` in ${c.slack.team_name}` : ""}.
              </p>
              <Button tone="danger" onClick={() => act(() => api("/integrations/slack", { method: "DELETE" }), "Slack disconnected")}>
                Disconnect
              </Button>
            </>
          ) : data?.slack_available ? (
            <button
              onClick={() => act(async () => (window.location.href = (await api<{ url: string }>("/integrations/slack/install")).url), "")}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-black"
            >
              Add to Slack
            </button>
          ) : (
            <p className="text-xs text-faint">The Slack app isn&apos;t configured on this server (SLACK_CLIENT_ID/SECRET).</p>
          )}
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Label>phone push (ntfy)</Label>
            {c.ntfy ? <Pill color="var(--ok)">connected</Pill> : <Pill>off</Pill>}
          </div>
          <p className="text-sm text-muted">Push notifications through the free ntfy app. Pick a long, unguessable topic and subscribe to it on your phone.</p>
          {c.ntfy && <p className="font-mono text-xs text-fg-2">topic: {c.ntfy.topic}</p>}
          <Field label="Topic">
            <input className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="nightshift-7f3a9c21" />
          </Field>
          <div className="flex gap-2">
            <Button tone="primary" disabled={!topic} onClick={() => act(() => api("/integrations/ntfy", { method: "PUT", json: { config: { topic } } }), "ntfy saved")}>
              Save
            </Button>
            {c.ntfy && <Button onClick={() => act(() => api("/integrations/ntfy", { method: "DELETE" }), "ntfy removed")}>Remove</Button>}
          </div>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Label>webhook</Label>
            {c.webhook ? <Pill color="var(--ok)">connected</Pill> : <Pill>off</Pill>}
          </div>
          <p className="text-sm text-muted">A JSON POST for PagerDuty, Opsgenie or your own tooling: title, body, priority, incident and agent ids, link.</p>
          {c.webhook && <p className="font-mono text-xs text-fg-2">→ {c.webhook.url_host}</p>}
          <Field label="HTTPS URL">
            <input className={inputCls} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://events.pagerduty.com/…" />
          </Field>
          <div className="flex gap-2">
            <Button tone="primary" disabled={!hook} onClick={() => act(() => api("/integrations/webhook", { method: "PUT", json: { config: { url: hook } } }), "Webhook saved")}>
              Save
            </Button>
            {c.webhook && <Button onClick={() => act(() => api("/integrations/webhook", { method: "DELETE" }), "Webhook removed")}>Remove</Button>}
          </div>
        </Card>
      </div>
    </>
  );
}
