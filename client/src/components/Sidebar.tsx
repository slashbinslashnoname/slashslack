import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@slashslack/shared";
import {
  Bell,
  Lock,
  Plus,
  Search,
  Settings,
  LogOut,
  Star,
  SunMoon,
  FolderPlus,
  Github,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { ChannelDnd } from "./ChannelDnd";
import {
  useChannels,
  useCategories,
  useDms,
  useNotifications,
  useSettings,
} from "../lib/queries";
import { api } from "../lib/api";
import { applyFromSettings, getStoredThemeChoice, storeThemeChoice } from "../lib/theme";

const THEME_CYCLE = ["custom", "light", "dark", "ocean"];

/** Shared label style for section headers (consistent vertical rhythm). */
const sectionLabel =
  "flex items-center h-7 px-2 text-[11px] font-semibold uppercase tracking-wider opacity-60";

export function Sidebar({
  me,
  scope,
  setScope,
  onNewChannel,
  onNewDm,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
  onCloseMobile,
}: {
  me: PublicUser;
  scope: string | null;
  setScope: (s: string) => void;
  onNewChannel: (categoryId?: number | null) => void;
  onNewDm: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onCloseMobile?: () => void;
}) {
  const { data: channels = [] } = useChannels();
  const { data: categories = [] } = useCategories();
  const { data: dms = [] } = useDms();
  const { data: settings } = useSettings();
  const { data: notifications = [] } = useNotifications();
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const qc = useQueryClient();
  const isAdmin = me.role === "admin";

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const promoted = channels.filter((c) => c.isPromoted).sort((a, b) => a.position - b.position);

  const select = (s: string) => {
    setScope(s);
    onCloseMobile?.();
  };

  const addCategory = async () => {
    const name = prompt("New category name:");
    if (!name?.trim()) return;
    await api.post("/api/categories", { name: name.trim(), icon: "folder" });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const cycleTheme = () => {
    if (!settings) return;
    const cur = getStoredThemeChoice() || "custom";
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % THEME_CYCLE.length];
    storeThemeChoice(next);
    applyFromSettings(settings);
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    location.reload();
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-fg flex flex-col h-full">
      {/* header */}
      <div className="h-14 px-3 flex items-center gap-2.5 border-b border-white/10">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} className="w-8 h-8 rounded-md object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-accent-fg font-bold">
            {(settings?.appName || "S")[0]}
          </div>
        )}
        <span className="font-bold text-white truncate flex-1">{settings?.appName || "SlashSlack"}</span>
        <a
          href="https://github.com/slashbinslashnoname/slashslack/issues"
          target="_blank"
          rel="noreferrer"
          title="Report an issue or suggest an idea"
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white shrink-0"
        >
          <Github size={16} />
        </a>
      </div>

      {/* quick actions */}
      <div className="px-2 py-3 flex gap-2">
        <button
          onClick={onOpenSearch}
          className="flex-1 flex items-center gap-2 h-9 px-3 rounded-md bg-white/5 hover:bg-white/10 text-sm"
        >
          <Search size={15} /> Search
        </button>
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10"
        >
          <Bell size={16} />
          {unreadNotifs > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full px-1 leading-tight">
              {unreadNotifs}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-3">
        {/* promoted */}
        {promoted.length > 0 && (
          <div className="mb-5">
            <div className={sectionLabel}>
              <Star size={12} className="mr-1.5" /> Promoted
            </div>
            <div className="space-y-0.5">
              {promoted.map((c) => {
                const key = `channel:${c.id}`;
                const active = scope === key;
                return (
                  <button
                    key={c.id}
                    onClick={() => select(key)}
                    className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm"
                    style={{
                      background: active ? "var(--sidebar-active)" : undefined,
                      color: active || c.unread ? "#fff" : "var(--sidebar-fg)",
                      fontWeight: c.unread ? 600 : 400,
                    }}
                  >
                    {c.isPrivate ? <Lock size={15} /> : <Icon name={c.icon} size={15} />}
                    <span className="truncate flex-1 text-left">{c.name}</span>
                    {c.hasMention && <span className="w-2 h-2 rounded-full bg-danger" />}
                    {!!c.unread && !active && (
                      <span className="bg-danger text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                        {c.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* draggable channels grouped by category (personal layout) */}
        <ChannelDnd
          channels={channels}
          categories={categories}
          scope={scope}
          collapsed={collapsed}
          toggleCollapse={(id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }))}
          onSelect={select}
          onNewChannel={onNewChannel}
        />

        {/* add controls */}
        <div className="mt-1 space-y-0.5">
          <button
            onClick={() => onNewChannel()}
            className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm opacity-70 hover:opacity-100 hover:bg-white/5"
          >
            <Plus size={15} /> Add channel
          </button>
          {isAdmin && (
            <button
              onClick={addCategory}
              className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm opacity-70 hover:opacity-100 hover:bg-white/5"
            >
              <FolderPlus size={15} /> New category
            </button>
          )}
        </div>

        {/* DMs */}
        <div className="mt-5">
          <div className={`${sectionLabel} justify-between`}>
            <span>Direct messages</span>
            <button onClick={onNewDm} className="opacity-70 hover:opacity-100">
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-0.5">
            {dms.map((dm) => {
              const others = dm.members.filter((m) => m.id !== me.id);
              const label = others.map((m) => m.displayName).join(", ") || "You";
              const key = `dm:${dm.id}`;
              const active = scope === key;
              const head = others[0] || me;
              return (
                <button
                  key={dm.id}
                  onClick={() => select(key)}
                  className="flex items-center gap-2 w-full h-8 px-2 rounded-md text-sm"
                  style={{
                    background: active ? "var(--sidebar-active)" : undefined,
                    color: active || dm.unread ? "#fff" : "var(--sidebar-fg)",
                    fontWeight: dm.unread ? 600 : 400,
                  }}
                >
                  <Avatar user={head} size={20} />
                  <span className="truncate flex-1 text-left">{label}</span>
                  {!!dm.unread && !active && (
                    <span className="bg-danger text-white text-[10px] rounded-full px-1.5 leading-tight">
                      {dm.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="border-t border-white/10 p-2 flex items-center gap-1">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-white/5 rounded-md px-2 h-10"
          title="Edit your profile"
        >
          <Avatar user={me} size={28} />
          <span className="text-sm text-white truncate">{me.displayName}</span>
        </button>
        <button onClick={cycleTheme} title="Switch theme" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
          <SunMoon size={16} />
        </button>
        {isAdmin && (
          <Link to="/admin" title="Admin" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
            <Settings size={16} />
          </Link>
        )}
        <button onClick={logout} title="Log out" className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-white">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
