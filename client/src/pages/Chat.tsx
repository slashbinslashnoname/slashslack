import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message, PublicUser } from "@slashslack/shared";
import { Lock, Users, Pin, Bookmark, Menu } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { MessageList } from "../components/MessageList";
import { Composer } from "../components/Composer";
import { TypingIndicator } from "../components/TypingIndicator";
import { ThreadPanel } from "../components/ThreadPanel";
import { NewChannelModal } from "../components/NewChannelModal";
import { NewDmModal } from "../components/NewDmModal";
import { SearchModal } from "../components/SearchModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import { MessageListModal } from "../components/MessageListModal";
import { ProfileModal } from "../components/ProfileModal";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { useBookmarks, useChannels, useDms, usePins, useSettings } from "../lib/queries";
import { api } from "../lib/api";

export function Chat({ me }: { me: PublicUser }) {
  const { data: channels = [] } = useChannels();
  const { data: dms = [] } = useDms();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [scope, setScope] = useState<string | null>(null);
  const [thread, setThread] = useState<Message | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newChannelCategory, setNewChannelCategory] = useState<number | null>(null);
  const [modal, setModal] = useState<
    null | "channel" | "dm" | "search" | "notifs" | "pins" | "saved" | "profile"
  >(null);

  const [kindForPins, idForPins] = scope ? scope.split(":") : ["", ""];
  const { data: pins = [] } = usePins(kindForPins === "channel" ? Number(idForPins) : null);
  const { data: bookmarks } = useBookmarks();

  useEffect(() => {
    if (!scope && channels.length) setScope(`channel:${channels[0].id}`);
  }, [channels, scope]);

  // tab title: current channel/DM + workspace name
  useEffect(() => {
    const appName = settings?.appName || "SlashSlack";
    let where = "";
    if (scope) {
      const [kind, idStr] = scope.split(":");
      const id = Number(idStr);
      if (kind === "channel") {
        const c = channels.find((x) => x.id === id);
        if (c) where = `#${c.name}`;
      } else {
        const dm = dms.find((x) => x.id === id);
        if (dm) {
          const others = dm.members.filter((m) => m.id !== me.id);
          where = others.map((m) => m.displayName).join(", ") || "You";
        }
      }
    }
    document.title = where ? `${where} · ${appName}` : appName;
  }, [scope, channels, dms, settings?.appName, me.id]);

  useEffect(() => {
    if (!scope) return;
    const [kind, id] = scope.split(":");
    const url = kind === "channel" ? `/api/channels/${id}/read` : `/api/dms/${id}/read`;
    api.post(url).then(() => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["dms"] });
    });
    setThread(null);
  }, [scope]);

  const header = useMemo(() => {
    if (!scope) return null;
    const [kind, idStr] = scope.split(":");
    const id = Number(idStr);
    if (kind === "channel") {
      const c = channels.find((x) => x.id === id);
      if (!c) return null;
      return (
        <div className="flex items-center gap-2 min-w-0">
          {c.isPrivate ? <Lock size={18} /> : <Icon name={c.icon} size={18} />}
          <span className="font-bold truncate">{c.name}</span>
          {c.topic && (
            <>
              <span className="text-border hidden sm:inline">|</span>
              <span className="text-muted text-sm truncate hidden sm:inline">{c.topic}</span>
            </>
          )}
        </div>
      );
    }
    const dm = dms.find((x) => x.id === id);
    if (!dm) return null;
    const others = dm.members.filter((m) => m.id !== me.id);
    return (
      <div className="flex items-center gap-2 min-w-0">
        {others[0] ? <Avatar user={others[0]} size={24} /> : <Users size={18} />}
        <span className="font-bold truncate">
          {others.map((m) => m.displayName).join(", ") || "You"}
        </span>
      </div>
    );
  }, [scope, channels, dms, me.id]);

  const [kind, idStr] = scope ? scope.split(":") : ["", ""];
  const numId = Number(idStr);
  const placeholderName =
    kind === "channel" ? `#${channels.find((c) => c.id === numId)?.name ?? ""}` : "this conversation";

  const openNewChannel = (categoryId: number | null = null) => {
    setNewChannelCategory(categoryId);
    setModal("channel");
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* sidebar: static on md+, slide-in drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          me={me}
          scope={scope}
          setScope={setScope}
          onNewChannel={openNewChannel}
          onNewDm={() => setModal("dm")}
          onOpenSearch={() => setModal("search")}
          onOpenNotifications={() => setModal("notifs")}
          onOpenProfile={() => setModal("profile")}
          onCloseMobile={() => setSidebarOpen(false)}
        />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex min-w-0">
        <div className="flex-1 flex flex-col min-w-0 bg-bg">
          <div className="h-14 border-b border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
            <button className="md:hidden text-muted hover:text-fg" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">{header}</div>
            {kind === "channel" && (
              <button
                onClick={() => setModal("pins")}
                title="Pinned messages"
                className="relative text-muted hover:text-fg"
              >
                <Pin size={18} />
                {pins.length > 0 && (
                  <span className="absolute -top-1 -right-2 text-[10px] bg-accent text-accent-fg rounded-full px-1">
                    {pins.length}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => setModal("saved")} title="Saved items" className="text-muted hover:text-fg">
              <Bookmark size={18} />
            </button>
          </div>

          {scope ? (
            <>
              <MessageList scope={scope} me={me} onOpenThread={setThread} />
              <TypingIndicator scope={scope} me={me} />
              <Composer
                channelId={kind === "channel" ? numId : undefined}
                dmId={kind === "dm" ? numId : undefined}
                placeholder={`Message ${placeholderName}`}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">Select a channel to start.</div>
          )}
        </div>

        {thread && (
          <div className="fixed inset-0 z-30 bg-bg md:static md:inset-auto md:z-auto">
            <ThreadPanel parent={thread} me={me} onClose={() => setThread(null)} />
          </div>
        )}
      </div>

      {modal === "channel" && (
        <NewChannelModal
          presetCategoryId={newChannelCategory}
          onClose={() => setModal(null)}
          onCreated={setScope}
        />
      )}
      {modal === "dm" && <NewDmModal me={me} onClose={() => setModal(null)} onCreated={setScope} />}
      {modal === "search" && <SearchModal onClose={() => setModal(null)} onJump={setScope} />}
      {modal === "notifs" && <NotificationsPanel onClose={() => setModal(null)} onJump={setScope} />}
      {modal === "profile" && <ProfileModal me={me} onClose={() => setModal(null)} />}
      {modal === "pins" && (
        <MessageListModal
          title="Pinned messages"
          messages={pins}
          emptyText="No pinned messages yet. Hover a message and click the pin icon."
          onClose={() => setModal(null)}
          onJump={setScope}
        />
      )}
      {modal === "saved" && (
        <MessageListModal
          title="Saved items"
          messages={bookmarks?.messages ?? []}
          emptyText="Nothing saved yet. Hover a message and click the bookmark icon."
          onClose={() => setModal(null)}
          onJump={setScope}
        />
      )}
    </div>
  );
}
