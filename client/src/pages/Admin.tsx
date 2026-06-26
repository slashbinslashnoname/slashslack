import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AppSettings, Category, Channel, Invite, PublicUser } from "@slashslack/shared";
import { ArrowLeft, Star, Trash2, Plus, Upload, Copy, Mail, Link2, Ban, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { applyThemeTokens } from "../lib/theme";
import { IconPicker } from "../components/IconPicker";
import { SortableList } from "../components/Sortable";
import { useCategories, useChannels, useSettings } from "../lib/queries";

const TABS = ["Branding", "Theme", "Channels", "Email", "Access", "Members"] as const;

export function Admin({ me }: { me: PublicUser }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Branding");
  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="h-14 border-b border-border flex items-center px-4 gap-4">
        <Link to="/" className="flex items-center gap-1 text-muted hover:text-fg">
          <ArrowLeft size={18} /> Back
        </Link>
        <h1 className="font-bold text-lg">Admin settings</h1>
        <div className="flex gap-1 ml-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-theme text-sm whitespace-nowrap"
              style={{
                background: tab === t ? "var(--accent)" : "transparent",
                color: tab === t ? "var(--accent-fg)" : "var(--fg)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin p-6 max-w-3xl w-full mx-auto">
        {tab === "Branding" && <Branding />}
        {tab === "Theme" && <Theme />}
        {tab === "Channels" && <Channels />}
        {tab === "Email" && <SmtpSettings />}
        {tab === "Access" && <Access />}
        {tab === "Members" && <Members me={me} />}
      </div>
    </div>
  );
}

function patchSettings(qc: ReturnType<typeof useQueryClient>, patch: Partial<AppSettings>) {
  return api
    .patch<{ settings: AppSettings }>("/api/settings", patch)
    .then((r) => qc.setQueryData(["settings"], r.settings));
}

interface SmtpForm {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  hasPassword: boolean;
}

function SmtpSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SmtpForm | null>(null);
  const [pass, setPass] = useState("");
  const [saved, setSaved] = useState(false);
  useQuery({
    queryKey: ["smtp"],
    queryFn: async () => {
      const r = await api.get<{ smtp: SmtpForm }>("/api/settings/smtp");
      setForm(r.smtp);
      return r;
    },
  });
  if (!form) return null;
  const set = (p: Partial<SmtpForm>) => setForm({ ...form, ...p });

  const save = async () => {
    await api.patch("/api/settings/smtp", {
      enabled: form.enabled,
      host: form.host,
      port: Number(form.port),
      user: form.user,
      from: form.from,
      secure: form.secure,
      ...(pass ? { pass } : {}),
    });
    setPass("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    qc.invalidateQueries({ queryKey: ["invites"] });
    qc.invalidateQueries({ queryKey: ["smtp"] });
  };

  const useResend = () =>
    setForm({ ...form, enabled: true, host: "smtp.resend.com", port: 465, user: "resend", secure: true });

  const input = "border border-border rounded-theme px-3 py-2 bg-elev";
  return (
    <Field label="Email (SMTP)">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted">Quick setup:</span>
        <button onClick={useResend} className="text-xs border border-border rounded-theme px-2 py-1 hover:bg-elev">
          Use Resend
        </button>
        <span className="text-xs text-muted">
          (then paste your Resend <strong>API key</strong> as the password, and set a verified “From”)
        </span>
      </div>
      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span className="text-sm">Send invitation emails via SMTP</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="Host (smtp.example.com)" value={form.host} onChange={(e) => set({ host: e.target.value })} />
        <input className={input} type="number" placeholder="Port" value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
        <input className={input} placeholder="Username" value={form.user} onChange={(e) => set({ user: e.target.value })} />
        <input className={input} type="password" placeholder={form.hasPassword ? "•••••• (unchanged)" : "Password"} value={pass} onChange={(e) => setPass(e.target.value)} />
        <input className={`${input} col-span-2`} placeholder='From ("SlashSlack <no-reply@example.com>")' value={form.from} onChange={(e) => set({ from: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 mt-3">
        <input type="checkbox" checked={form.secure} onChange={(e) => set({ secure: e.target.checked })} />
        <span className="text-sm">Use TLS (secure, usually port 465)</span>
      </label>
      <button onClick={save} className="bg-accent text-accent-fg px-4 py-2 rounded-theme mt-3">
        {saved ? "Saved!" : "Save SMTP settings"}
      </button>
    </Field>
  );
}

interface AdminUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
  banned: boolean;
  lastIp: string | null;
}

function Members({ me }: { me: PublicUser }) {
  const qc = useQueryClient();
  const { data: usersList = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ users: AdminUser[] }>("/api/admin/users").then((r) => r.users),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  };
  const ban = async (u: AdminUser) => {
    const reason = prompt(`Ban ${u.displayName}? This blocks their email, IP, and device.\n\nOptional reason:`);
    if (reason === null) return;
    await api.post(`/api/admin/users/${u.id}/ban`, { reason });
    refresh();
  };
  const unban = async (u: AdminUser) => {
    await api.post(`/api/admin/users/${u.id}/unban`);
    refresh();
  };

  return (
    <Field label="Members">
      <p className="text-xs text-muted mb-3">
        Banning a user blocks their <strong>email</strong>, <strong>IP address</strong>, and{" "}
        <strong>device cookie</strong> from logging in or registering, and ends their sessions.
      </p>
      <div className="flex flex-col">
        {usersList.map((u) => (
          <div key={u.id} className="flex items-center gap-3 py-2 border-b border-border/50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{u.displayName}</span>
                {u.role === "admin" && <span className="text-[10px] uppercase bg-accent text-accent-fg rounded px-1">admin</span>}
                {u.banned && <span className="text-[10px] uppercase bg-danger text-white rounded px-1">banned</span>}
              </div>
              <div className="text-xs text-muted truncate">
                {u.email}
                {u.lastIp && <span className="ml-2">· {u.lastIp}</span>}
              </div>
            </div>
            {u.id !== me.id && u.role !== "admin" && (
              u.banned ? (
                <button onClick={() => unban(u)} className="flex items-center gap-1 text-sm text-success hover:underline">
                  <ShieldCheck size={15} /> Unban
                </button>
              ) : (
                <button onClick={() => ban(u)} className="flex items-center gap-1 text-sm text-danger hover:underline">
                  <Ban size={15} /> Ban
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{label}</h3>
      {children}
    </div>
  );
}

function Branding() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [name, setName] = useState(settings?.appName ?? "");
  const [maxMb, setMaxMb] = useState(settings?.maxUploadMb ?? 100);
  if (!settings) return null;

  const uploadLogo = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/settings/logo", { method: "POST", credentials: "include", body: form });
    const json = await res.json();
    if (json.logoUrl) qc.setQueryData<AppSettings>(["settings"], (s) => (s ? { ...s, logoUrl: json.logoUrl } : s));
  };

  return (
    <div className="flex flex-col gap-6">
      <Field label="Workspace name">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-border rounded-theme px-3 py-2 bg-elev flex-1" />
          <button onClick={() => patchSettings(qc, { appName: name })} className="bg-accent text-accent-fg px-4 rounded-theme">Save</button>
        </div>
      </Field>

      <Field label="Workspace icon / logo">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} className="w-14 h-14 rounded-theme object-cover border border-border" />
          ) : (
            <div className="w-14 h-14 rounded-theme bg-accent text-accent-fg flex items-center justify-center text-2xl font-bold">
              {settings.appName[0]}
            </div>
          )}
          <label className="flex items-center gap-2 border border-border rounded-theme px-3 py-2 cursor-pointer hover:bg-elev">
            <Upload size={16} /> Upload image
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </label>
        </div>
      </Field>

      <Field label="Maximum upload size (MB)">
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={1}
            max={500}
            value={maxMb}
            onChange={(e) => setMaxMb(Number(e.target.value))}
            className="border border-border rounded-theme px-3 py-2 bg-elev w-28"
          />
          <button onClick={() => patchSettings(qc, { maxUploadMb: maxMb })} className="bg-accent text-accent-fg px-4 rounded-theme py-2">Save</button>
          <span className="text-xs text-muted">Videos and files up to this size (hard cap 500 MB).</span>
        </div>
      </Field>
    </div>
  );
}

function Theme() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  if (!settings) return null;

  const applyPreset = async (name: string) => {
    const r = await api.post<{ settings: AppSettings }>(`/api/settings/preset/${name}`);
    qc.setQueryData(["settings"], r.settings);
    applyThemeTokens(r.settings.theme);
  };

  const setToken = (key: string, value: string) => {
    applyThemeTokens({ [key]: value });
    const next = { ...settings.theme, [key]: value };
    qc.setQueryData<AppSettings>(["settings"], (s) => (s ? { ...s, theme: next } : s));
    patchSettings(qc, { theme: { [key]: value } });
  };

  const colorTokens = Object.entries(settings.theme).filter(([, v]) => v.startsWith("#"));
  const otherTokens = Object.entries(settings.theme).filter(([, v]) => !v.startsWith("#"));

  return (
    <div className="flex flex-col gap-6">
      <Field label="Presets">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(settings.presets).map(([p, tokens]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 border border-border rounded-theme hover:bg-elev"
            >
              <span className="flex">
                {["--sidebar", "--accent", "--bg", "--mention"].map((k) => (
                  <span
                    key={k}
                    className="w-4 h-4 rounded-sm border border-border/60 -ml-1 first:ml-0"
                    style={{ background: (tokens as Record<string, string>)[k] }}
                  />
                ))}
              </span>
              <span className="capitalize text-sm">{p}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colors">
        <div className="grid grid-cols-2 gap-3">
          {colorTokens.map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="color" value={val} onChange={(e) => setToken(key, e.target.value)} className="w-8 h-8 rounded border border-border bg-transparent" />
              <span className="text-muted">{key.replace("--", "")}</span>
            </label>
          ))}
        </div>
      </Field>
      {otherTokens.length > 0 && (
        <Field label="Other tokens">
          <div className="grid grid-cols-2 gap-3">
            {otherTokens.map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input value={val} onChange={(e) => setToken(key, e.target.value)} className="border border-border rounded px-2 py-1 bg-elev w-24" />
                <span className="text-muted">{key.replace("--", "")}</span>
              </label>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}

function Channels() {
  const { data: categories = [] } = useCategories();
  const { data: channels = [] } = useChannels();
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["channels"] });
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await api.post("/api/categories", { name: newCat, icon: "folder" });
    setNewCat("");
    refresh();
  };
  const reorderCategories = async (ids: number[]) => {
    qc.setQueryData<Category[]>(["categories"], (old) =>
      old ? ids.map((id, i) => ({ ...old.find((c) => c.id === id)!, position: i })) : old,
    );
    await api.post("/api/categories/reorder", { ids });
  };
  const reorderChannels = async (categoryId: number | null, ids: number[]) => {
    await api.post("/api/channels/reorder", { ids, categoryId });
    refresh();
  };
  const moveChannel = async (c: Channel, categoryId: number | null) => {
    await api.patch(`/api/channels/${c.id}`, { categoryId });
    refresh();
  };
  const setChannelIcon = async (c: Channel, icon: string) => {
    await api.patch(`/api/channels/${c.id}`, { icon });
    refresh();
  };

  const renderChannel = (c: Channel) => (
    <div className="flex items-center gap-2 py-1 border-b border-border/50">
      <IconPicker value={c.icon} onChange={(icon) => setChannelIcon(c, icon)} size={16} />
      <span className="flex-1 truncate">{c.name}</span>
      <select
        value={c.categoryId ?? ""}
        onChange={(e) => moveChannel(c, e.target.value ? Number(e.target.value) : null)}
        className="text-xs bg-elev border border-border rounded px-1 py-0.5"
      >
        <option value="">Uncategorized</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
    </div>
  );

  const groups: { cat: Category | null; list: Channel[] }[] = [
    ...categories.map((cat) => ({
      cat,
      list: channels.filter((c) => c.categoryId === cat.id).sort((a, b) => a.position - b.position),
    })),
    { cat: null, list: channels.filter((c) => c.categoryId === null) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Field label="Add category">
        <div className="flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" className="border border-border rounded-theme px-3 py-2 bg-elev flex-1" />
          <button onClick={addCategory} className="bg-accent text-accent-fg px-4 rounded-theme flex items-center gap-1"><Plus size={16} /> Add</button>
        </div>
      </Field>

      <Field label="Reorder categories (drag handle)">
        <SortableList
          items={categories}
          onReorder={reorderCategories}
          render={(cat) => (
            <div className="flex items-center gap-2 py-1.5 border-b border-border/50">
              <IconPicker value={cat.icon} onChange={(icon) => api.patch(`/api/categories/${cat.id}`, { icon }).then(refresh)} size={16} />
              <input
                defaultValue={cat.name}
                onBlur={(e) => api.patch(`/api/categories/${cat.id}`, { name: e.target.value }).then(refresh)}
                className="bg-transparent flex-1 outline-none"
              />
              <button onClick={() => { if (confirm(`Delete category "${cat.name}"?`)) api.del(`/api/categories/${cat.id}`).then(refresh); }} className="text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      </Field>

      {groups.map(({ cat, list }) =>
        list.length ? (
          <Field key={cat?.id ?? "none"} label={cat ? `Channels in ${cat.name}` : "Uncategorized channels"}>
            <SortableList items={list} onReorder={(ids) => reorderChannels(cat?.id ?? null, ids)} render={renderChannel} />
          </Field>
        ) : null,
      )}
    </div>
  );
}

function Access() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["invites"],
    queryFn: () => api.get<{ invites: Invite[]; mailerConfigured: boolean }>("/api/invites"),
  });
  if (!settings) return null;

  const setMode = (open: boolean) => patchSettings(qc, { allowRegistration: open });

  const sendInvite = async () => {
    setNotice(null);
    try {
      const r = await api.post<{ invite: Invite; emailed: boolean; emailError: string | null }>("/api/invites", { email });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invites"] });
      setNotice(
        r.emailed
          ? `Invitation emailed to ${r.invite.email}.`
          : `Invite created. Email not sent${r.emailError ? ` (${r.emailError})` : " (SMTP not configured)"} — copy the link below.`,
      );
    } catch (e: any) {
      setNotice(e?.message || "Failed to create invite");
    }
  };

  const generateLink = async () => {
    setNotice(null);
    try {
      const r = await api.post<{ invite: Invite }>("/api/invites", {}); // no email = generic link
      await navigator.clipboard.writeText(r.invite.inviteUrl).catch(() => {});
      qc.invalidateQueries({ queryKey: ["invites"] });
      setNotice("Invite link generated and copied — the recipient sets their own email & password.");
    } catch (e: any) {
      setNotice(e?.message || "Failed to generate link");
    }
  };

  const revoke = async (id: number) => {
    await api.del(`/api/invites/${id}`);
    qc.invalidateQueries({ queryKey: ["invites"] });
  };

  return (
    <div className="flex flex-col gap-6">
      <Field label="Registration mode">
        <div className="flex flex-col gap-2">
          {[
            { open: true, title: "Open registration", desc: "Anyone can create an account from the login screen." },
            { open: false, title: "Invite only", desc: "New accounts require an invitation link." },
          ].map((opt) => (
            <button
              key={String(opt.open)}
              onClick={() => setMode(opt.open)}
              className="flex items-start gap-3 p-3 border rounded-theme text-left"
              style={{ borderColor: settings.allowRegistration === opt.open ? "var(--accent)" : "var(--border)" }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 mt-0.5"
                style={{
                  borderColor: settings.allowRegistration === opt.open ? "var(--accent)" : "var(--fg-muted)",
                  background: settings.allowRegistration === opt.open ? "var(--accent)" : "transparent",
                }}
              />
              <div>
                <div className="font-medium">{opt.title}</div>
                <div className="text-sm text-muted">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Invite people by email">
        {!data?.mailerConfigured && (
          <div className="text-xs text-muted mb-2">
            SMTP is not configured — invites still work, just copy the generated link. Configure it in the <strong>Email</strong> tab to send real emails.
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="border border-border rounded-theme px-3 py-2 bg-elev flex-1"
          />
          <button onClick={sendInvite} disabled={!email} className="bg-accent text-accent-fg px-4 rounded-theme flex items-center gap-1 disabled:opacity-50">
            <Mail size={16} /> Invite
          </button>
        </div>
        <button onClick={generateLink} className="mt-2 text-sm text-accent hover:underline flex items-center gap-1">
          <Link2 size={14} /> Or generate a shareable invite link (recipient picks their own email)
        </button>
        {notice && <div className="text-sm mt-2 text-success">{notice}</div>}
      </Field>

      <Field label="Pending invites">
        <div className="flex flex-col gap-1">
          {(!data || data.invites.length === 0) && <div className="text-muted text-sm">No invites yet.</div>}
          {data?.invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 py-1.5 border-b border-border/50">
              <span className="flex-1 truncate">
                {inv.email || <span className="text-muted italic">Anyone with the link</span>}
              </span>
              <span className="text-xs text-muted">{inv.acceptedAt ? "joined" : "pending"}</span>
              {!inv.acceptedAt && (
                <button onClick={() => navigator.clipboard.writeText(inv.inviteUrl)} title="Copy invite link" className="text-muted hover:text-accent">
                  <Copy size={15} />
                </button>
              )}
              <button onClick={() => revoke(inv.id)} title="Revoke" className="text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Field>
    </div>
  );
}
