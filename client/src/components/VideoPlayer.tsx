import { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Minimal themed video player: play/pause, seek, time, mute, fullscreen. */
export function VideoPlayer({ src, poster }: { src: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setTime(v.currentTime);
  };

  return (
    <div
      ref={wrapRef}
      className="relative group/v rounded-theme overflow-hidden border border-border bg-black max-w-lg"
    >
      <video
        ref={ref}
        src={src}
        poster={poster || undefined}
        className="w-full max-h-80 block"
        onClick={toggle}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        playsInline
      />
      {!playing && (
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="bg-black/50 rounded-full p-4">
            <Play size={28} className="text-white" fill="white" />
          </span>
        </button>
      )}
      <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/v:opacity-100 transition-opacity">
        <button onClick={toggle} className="text-white">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-white text-xs tabular-nums">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          value={time}
          onChange={seek}
          className="flex-1 accent-white h-1"
        />
        <span className="text-white text-xs tabular-nums">{fmt(dur)}</span>
        <button
          onClick={() => {
            const v = ref.current;
            if (v) {
              v.muted = !v.muted;
              setMuted(v.muted);
            }
          }}
          className="text-white"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={() => wrapRef.current?.requestFullscreen?.()} className="text-white">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
