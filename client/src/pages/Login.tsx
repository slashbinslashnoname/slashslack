import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@slashslack/shared";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useSettings } from "../lib/queries";

const HERO_IMAGE = "/iss.jpg";
const hasInvite = () => new URLSearchParams(location.search).has("invite");

export function Login() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">(hasInvite() ? "register" : "login");
  // invite links open straight to the acceptance box (skip the hero)
  const [showForm, setShowForm] = useState(hasInvite());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get("invite");
    if (!token) return;
    api
      .get<{ email: string }>(`/api/invites/by-token/${token}`)
      .then((r) => {
        setInviteToken(token);
        setInvited(true);
        setEmail(r.email);
        setMode("register");
        setShowForm(true);
      })
      .catch(() => {
        setError("This invitation link is invalid or has already been used.");
        setShowForm(true);
      });
  }, []);

  const canSelfRegister = settings?.allowRegistration || invited;
  const appName = settings?.appName || "SlashSlack";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, displayName, inviteToken: inviteToken ?? undefined };
      const { user } = await api.post<{ user: PublicUser }>(url, body);
      qc.setQueryData(["me"], user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full relative overflow-hidden flex items-center justify-center">
      {/* NASA Image of the Day backdrop */}
      <div
        className="absolute inset-0 bg-center bg-cover transition-transform duration-700"
        style={{
          backgroundImage: `url(${HERO_IMAGE})`,
          transform: showForm ? "scale(1.05)" : "scale(1)",
        }}
      />
      {/* neutral darkening for text legibility — only on the hero, no color tint */}
      {!showForm && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.5))" }}
        />
      )}

      {/* Hero / CTA — same card style as the login box */}
      {!showForm ? (
        <div className="relative z-10 w-full max-w-sm mx-4 bg-bg border border-border rounded-2xl shadow-2xl p-8 text-center animate-[fadeIn_.3s_ease]">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-accent-fg font-bold text-xl">
                {appName[0]}
              </div>
            )}
            <span className="text-xl font-bold">{appName}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">
            Where your team comes together.
          </h1>
          <p className="text-muted mb-6">
            Realtime channels, threads, and DMs — self-hosted and yours. Sleek, fast, built for focus.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-accent text-accent-fg px-6 py-3 rounded-full font-semibold hover:opacity-90 transition"
          >
            Get started <ArrowRight size={20} />
          </button>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-sm mx-4 bg-bg border border-border rounded-2xl shadow-2xl p-8 animate-[fadeIn_.3s_ease]">
          {!invited && (
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 left-4 text-muted hover:text-fg flex items-center gap-1 text-sm"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2 mb-6 mt-2">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-accent-fg font-bold text-lg">
                {appName[0]}
              </div>
            )}
            <h1 className="text-xl font-bold">{appName}</h1>
          </div>

          <h2 className="text-lg font-semibold mb-4">
            {mode === "login" ? "Sign in" : invited ? "Accept your invitation" : "Create your account"}
          </h2>

          {invited && (
            <div className="mb-4 text-sm rounded-theme p-3" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
              You've been invited to join <strong>{appName}</strong>. Set a password to continue.
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "register" && (
              <input
                required
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="border border-border rounded-theme px-3 py-2 bg-elev"
              />
            )}
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              readOnly={invited}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border rounded-theme px-3 py-2 bg-elev read-only:opacity-70"
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-border rounded-theme px-3 py-2 bg-elev"
            />
            {error && <div className="text-danger text-sm">{error}</div>}
            <button disabled={busy} className="bg-accent text-accent-fg rounded-theme py-2 font-medium disabled:opacity-50">
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          {canSelfRegister && (
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="text-sm text-accent hover:underline mt-4"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
          {!canSelfRegister && mode === "login" && (
            <p className="text-xs text-muted mt-3">Registration is invite-only. Ask an admin for an invitation.</p>
          )}
          {mode === "register" && !invited && (
            <p className="text-xs text-muted mt-2">The first account created becomes the workspace admin.</p>
          )}
        </div>
      )}

      <div className="absolute bottom-3 inset-x-0 text-center text-[11px] text-white/40 z-10 px-4">
        📡 The International Space Station, from the SpaceX Crew Dragon
      </div>
    </div>
  );
}
