import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2, Plus, Terminal, Sparkles, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "./Modal";

interface Webhook {
  id: number;
  name: string;
  url: string;
  createdAt: string;
}

function curlSnippet(url: string) {
  return `curl -X POST ${url} \\\n  -H 'Content-Type: application/json' \\\n  -d '{"text":"Hello from a script"}'`;
}
function llmSnippet(url: string, channel: string) {
  return [
    `You can interact with the "${channel}" channel through this secret webhook URL:`,
    url,
    ``,
    `SEND a message — POST with JSON body {"text": "your message"} (optional {"username": "Bot"}).`,
    `Markdown is supported. Example:`,
    `  curl -X POST ${url} -H "Content-Type: application/json" -d '{"text":"Hello!"}'`,
    ``,
    `READ recent messages for context — GET ${url}/messages?limit=20`,
    `  Returns { channel, messages: [{ id, author, body, createdAt }], nextBefore }.`,
    `  Paginate to older messages with ?before=<nextBefore> (limit max 50).`,
    ``,
    `PRECAUTIONS:`,
    `- Only READ when you genuinely need recent channel context to respond. Do not poll,`,
    `  and do not fetch history on every turn — fetch only when there is a contextual need.`,
    `- Keep limit small (start at 20); request more pages only if truly necessary.`,
    `- This URL is a secret: anyone with it can read and post to the channel.`,
  ].join("\n");
}

export function WebhookModal({
  channelId,
  channelName,
  onClose,
}: {
  channelId: number;
  channelName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["webhooks", channelId],
    queryFn: () => api.get<{ webhooks: Webhook[] }>(`/api/channels/${channelId}/webhooks`).then((r) => r.webhooks),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const create = async () => {
    await api.post(`/api/channels/${channelId}/webhooks`, { name: name.trim() || "Webhook" });
    setName("");
    qc.invalidateQueries({ queryKey: ["webhooks", channelId] });
  };
  const revoke = async (id: number) => {
    await api.del(`/api/webhooks/${id}`);
    qc.invalidateQueries({ queryKey: ["webhooks", channelId] });
  };

  return (
    <Modal title={`Webhooks · #${channelName}`} onClose={onClose} wide>
      <div className="flex items-start gap-2 text-sm text-muted mb-4">
        <ShieldCheck size={18} className="text-success shrink-0 mt-0.5" />
        <span>
          Webhooks let scripts, bots, or an LLM post messages here. Each has a secret token in its
          URL — treat it like a password. Revoke any time.
        </span>
      </div>

      <div className="flex gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Webhook name (e.g. Deploy bot)"
          className="border border-border rounded-theme px-3 py-2 bg-elev flex-1"
        />
        <button onClick={create} className="bg-accent text-accent-fg px-4 rounded-theme flex items-center gap-1">
          <Plus size={16} /> Create
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {(!data || data.length === 0) && <div className="text-muted text-sm">No webhooks yet.</div>}
        {data?.map((w) => (
          <div key={w.id} className="border border-border rounded-theme p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold flex-1">{w.name}</span>
              <button onClick={() => revoke(w.id)} className="text-danger" title="Revoke">
                <Trash2 size={15} />
              </button>
            </div>
            <code className="block text-xs bg-elev border border-border rounded px-2 py-1 break-all mb-2">{w.url}</code>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy(w.url, `url-${w.id}`)} className="flex items-center gap-1 text-xs border border-border rounded-theme px-2 py-1 hover:bg-elev">
                <Copy size={13} /> {copied === `url-${w.id}` ? "Copied!" : "Copy URL"}
              </button>
              <button onClick={() => copy(curlSnippet(w.url), `curl-${w.id}`)} className="flex items-center gap-1 text-xs border border-border rounded-theme px-2 py-1 hover:bg-elev">
                <Terminal size={13} /> {copied === `curl-${w.id}` ? "Copied!" : "Copy curl"}
              </button>
              <button onClick={() => copy(llmSnippet(w.url, channelName), `llm-${w.id}`)} className="flex items-center gap-1 text-xs border border-border rounded-theme px-2 py-1 hover:bg-elev">
                <Sparkles size={13} /> {copied === `llm-${w.id}` ? "Copied!" : "Copy LLM instructions"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
