import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@slashslack/shared";
import { api, ApiError } from "../lib/api";
import { useSettings } from "../lib/queries";

export function Login() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  // pick up an ?invite=token link and prefill the signup form
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
      })
      .catch(() => setError("This invitation link is invalid or has already been used."));
  }, []);

  // when registration is invite-only and there is no invite, only show sign-in
  const canSelfRegister = settings?.allowRegistration || invited;

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
    <div
      className="h-full flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, var(--sidebar) 0%, color-mix(in srgb, var(--accent) 55%, var(--sidebar)) 100%)",
      }}
    >
      <div className="w-full max-w-sm bg-bg border border-border rounded-theme shadow-2xl p-8">
        <div className="flex items-center gap-2 mb-6">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} className="w-9 h-9 rounded object-cover" />
          ) : (
            <div className="w-9 h-9 rounded bg-accent flex items-center justify-center text-accent-fg font-bold text-lg">
              {(settings?.appName || "S")[0]}
            </div>
          )}
          <h1 className="text-xl font-bold">{settings?.appName || "SlashSlack"}</h1>
        </div>

        <h2 className="text-lg font-semibold mb-4">
          {mode === "login" ? "Sign in" : invited ? "Accept your invitation" : "Create your account"}
        </h2>

        {invited && (
          <div className="mb-4 text-sm rounded-theme p-3" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
            You've been invited to join <strong>{settings?.appName}</strong>. Set a password to continue.
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
          <button
            disabled={busy}
            className="bg-accent text-accent-fg rounded-theme py-2 font-medium disabled:opacity-50"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="text-sm text-accent hover:underline mt-4"
        >
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
        {mode === "register" && (
          <p className="text-xs text-muted mt-2">
            The first account created becomes the workspace admin.
          </p>
        )}
      </div>
    </div>
  );
}
