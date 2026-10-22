import {
  ArrowUp,
  Check,
  Download,
  Settings2,
  Terminal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CometSpinner } from "@/components/comet-spinner";
import { Mark } from "@/components/mark";
import { Results } from "@/components/results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  clearHistory,
  forgetScan,
  type HistoryEntry,
  loadHistory,
  logoCandidates,
  rememberScan,
} from "@/lib/history";
import { loadSettings, saveSettings } from "@/lib/settings";
import type { ScanOk, ScanResult, Settings, Source } from "@/lib/types";
import { DEFAULT_CHART_HOST, DEFAULT_SETTINGS } from "@/lib/types";
import { CHIME_NAMES, type ChimeName, playChime, primeChime } from "@/lib/chime";
import { applyChartHit, cancelScan } from "@/lib/scan-impl";
import { cn } from "@/lib/utils";

export function XCapApp() {
  const [source, setSource] = useState<Source>("cmc");
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<"settings" | "install" | "console" | null>(null);
  // Chart bars requests the DexScreener frame saw, newest first.
  const [netLog, setNetLog] = useState<LogEntry[]>([]);
  // Bars URLs already logged, so a result updated by a chart hit adds nothing.
  const loggedBars = useRef(new Set<string>());
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  // What the DexScreener frame reports about the capture extension, if any.
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setSettings(loadSettings());
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string;
        type?: string;
        version?: string;
        dexId?: string;
        chain?: string;
        pool?: string;
        quote?: string;
        cs?: string;
        url?: string;
      } | null;
      if (!data || data.source !== "xcap") return;
      if (data.type !== "chart" && data.type !== "hello" && data.type !== "net") return;
      let host = "";
      try {
        host = new URL(ev.origin).hostname;
      } catch {
        return;
      }
      if (host !== "dexscreener.com" && !host.endsWith(".dexscreener.com")) return;
      // Either message proves a content script is running in the frame.
      setExtensionVersion((prev) => data.version || prev || "unknown");
      if (data.type === "net") {
        const url = data.url;
        if (!url) return;
        console.log("[xcap] bars", url);
        // The chart's own request is the only authority on where bars live:
        // if DexScreener moves them again, the host follows on its own.
        let barsHost = "";
        try {
          barsHost = new URL(url).host;
        } catch {
          /* not a URL; log it anyway */
        }
        if (barsHost) {
          setSettings((prev) => {
            if (prev.chartHost === barsHost) return prev;
            const next = { ...prev, chartHost: barsHost };
            saveSettings(next);
            return next;
          });
        }
        return;
      }
      if (data.type !== "chart") return;
      setResult((prev) => (prev ? applyChartHit(prev, data) : prev));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The page builds the bars URL from the scan itself, so the console works
  // with no extension installed; the frame's own requests still add to it.
  useEffect(() => {
    if (!result || !result.ok) return;
    const urls = result.rows.flatMap((row) =>
      row.kind === "dex" && row.dexId && row.chain && row.poolAddress
        ? [barsUrl(settings.chartHost, row.dexId, row.chain, row.poolAddress, row.quote)]
        : [],
    );
    if (!urls.length) return;
    for (const url of urls) {
      if (loggedBars.current.has(url)) continue;
      loggedBars.current.add(url);
      console.log("[xcap] bars", url);
    }
  }, [result, settings.chartHost]);

  // Everything the page logs, mirrored into the Console panel. Entries are
  // queued and flushed a tick later: React logs from inside render, and a
  // state update there would loop.
  useEffect(() => {
    const levels = ["log", "info", "warn", "error", "debug"] as const;
    const originals = levels.map((level) => console[level]);
    let queue: LogEntry[] = [];
    let timer = 0;
    function push(level: LogLevel, args: unknown[]) {
      queue.push({ at: Date.now(), level, text: args.map(formatLogArg).join(" ") });
      if (timer) return;
      timer = window.setTimeout(() => {
        const batch = queue.reverse();
        queue = [];
        timer = 0;
        setNetLog((prev) => [...batch, ...prev].slice(0, 500));
      }, 0);
    }
    levels.forEach((level, i) => {
      console[level] = (...args: unknown[]) => {
        originals[i].apply(console, args);
        try {
          push(level, args);
        } catch {
          /* never let the mirror break logging */
        }
      };
    });
    const onError = (ev: ErrorEvent) => push("error", [ev.error ?? ev.message]);
    const onRejection = (ev: PromiseRejectionEvent) =>
      push("error", ["Unhandled rejection:", ev.reason]);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      levels.forEach((level, i) => {
        console[level] = originals[i];
      });
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(timer);
    };
  }, []);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  async function executeScan(q: string, src: Source): Promise<ScanResult> {
    if (import.meta.env.VITE_PAGES === "true") {
      const { performScan } = await import("@/lib/scan-impl");
      return performScan({ query: q, source: src });
    }
    try {
      const { runScan } = await import("@/lib/scan.functions");
      return await runScan({ data: { query: q, source: src } });
    } catch {
      const { performScan } = await import("@/lib/scan-impl");
      return performScan({ query: q, source: src });
    }
  }

  // Cancelling has to survive the in-flight promise resolving anyway: the
  // requests are aborted, but a scan far enough along can still return a
  // result, and it is no longer wanted.
  const scanRun = useRef(0);

  function cancelCurrentScan() {
    scanRun.current += 1;
    cancelScan();
    setScanning(false);
  }

  // The settings are read at the moment the sound plays, so changing them
  // mid-scan takes effect on that scan's own chime.
  function chime(ok: boolean) {
    if (!settings.sound) return;
    playChime(ok, { name: settings.chime, volume: settings.volume });
  }

  async function scan() {
    const q = query.trim();
    if (!q) {
      setError("Paste a URL, slug, or symbol first.");
      return;
    }
    const run = scanRun.current + 1;
    scanRun.current = run;
    setScanning(true);
    setError(null);
    // Built here, on the click, because a context created later has no
    // gesture behind it and starts muted.
    if (settings.sound) primeChime();
    try {
      const out = await executeScan(q, source);
      if (scanRun.current !== run) return;
      setHasScanned(true);
      if (!out.ok) {
        setResult(null);
        setError(out.error);
        chime(false);
        return;
      }
      setResult(out);
      if (!out.rows.length) {
        setError("Nothing found for that query.");
        chime(false);
        return;
      }
      chime(true);
      // Recorded only for a scan that found something: a typo is not history.
      setHistory(rememberScan(q, source, out));
      // Only once rows came back: a failed or empty scan leaves the query in
      // place to be corrected rather than retyped.
      setQuery("");
    } catch (err) {
      if (scanRun.current !== run) return;
      setResult(null);
      setError(err instanceof Error ? err.message : "Scan failed");
      chime(false);
    } finally {
      if (scanRun.current === run) setScanning(false);
    }
  }

  // A scan with nothing to show yet keeps the idle screen: the dialog covers
  // it, and "Nothing found" would be wrong for a scan still running.
  const idle = (!hasScanned || scanning) && !result;
  const canScan = query.trim().length > 0 && !scanning;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="shrink-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {/* Mark and name are one target, and it is the way back: a reload
              is what "start over" means in an app that keeps nothing but its
              settings and history. */}
          <button
            type="button"
            title="Reload XCap"
            className="-m-1 flex min-w-0 items-center gap-3 rounded-full p-1 transition-opacity duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => window.location.reload()}
          >
            <Mark size={32} />
            <h1 className="truncate text-sm font-medium text-fg">XCap</h1>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Download extension"
              onClick={() => setPanel(panel === "install" ? null : "install")}
            >
              <Download size={18} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Console"
              onClick={() => setPanel(panel === "console" ? null : "console")}
            >
              <Terminal size={18} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Settings"
              onClick={() => setPanel(panel === "settings" ? null : "settings")}
            >
              <Settings2 size={18} />
            </Button>
          </div>
        </div>
      </header>

      {panel === "settings" ? (
        <Overlay onClose={() => setPanel(null)}>
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            onClose={() => setPanel(null)}
          />
        </Overlay>
      ) : null}
      {panel === "console" ? (
        <Overlay onClose={() => setPanel(null)}>
          <ConsolePanel
            entries={netLog}
            onClear={() => setNetLog([])}
            onClose={() => setPanel(null)}
          />
        </Overlay>
      ) : null}
      {scanning ? (
        <ScanningDialog query={query} source={source} onCancel={cancelCurrentScan} />
      ) : null}
      {panel === "install" ? (
        <Overlay onClose={() => setPanel(null)}>
          <InstallPanel onClose={() => setPanel(null)} />
        </Overlay>
      ) : null}

      {/* The composer floats over this, so the last row has to clear it. */}
      <main className="mx-auto flex w-full min-h-0 flex-1 flex-col pb-40">
        {result && result.rows.length ? (
          <Results
            result={result}
            settings={settings}
            extensionVersion={extensionVersion}
            onClear={() => {
              setResult(null);
              setError(null);
              setHasScanned(false);
            }}
          />
        ) : error ? (
          <IdleFrame>
            <p className="max-w-md text-center text-base text-fg">{error}</p>
            <p className="text-sm text-muted">Edit the prompt and send again.</p>
          </IdleFrame>
        ) : idle ? (
          <IdleFrame>
            <Mark size={56} className="enter" />
            <div className="enter enter-2 max-w-md space-y-2 text-center">
              <h2 className="text-3xl font-medium tracking-tight text-fg sm:text-4xl">
                Ready when you are.
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Paste a CoinMarketCap coin or a DexScreener pool. Nothing runs until you
                send it.
              </p>
              <p className="text-sm text-faint">กด Scan เมื่อพร้อม — ไม่สแกนอัตโนมัติ</p>
            </div>
            {history.length ? (
              <History
                entries={history}
                onPick={(e) => {
                  setQuery(e.query);
                  setSource(e.source);
                }}
                onForget={(e) => setHistory(forgetScan(e.query))}
                onClear={() => setHistory(clearHistory())}
              />
            ) : null}
          </IdleFrame>
        ) : (
          <IdleFrame>
            <p className="text-base text-muted">Nothing found for that query.</p>
          </IdleFrame>
        )}
      </main>

      {/* Floating: fixed to the viewport rather than sitting at the end of the
          column, so it stays reachable while the results scroll under it. The
          gradient keeps text from colliding with it on the way past. */}
      <div
        // inert, not just a lower z-index: a panel on top stops the clicks,
        // but Tab would still walk into the field behind it.
        inert={panel !== null || scanning}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-bg via-bg/90 to-transparent"
      >
        <form
          className="pointer-events-auto mx-auto w-full max-w-3xl px-4"
          onSubmit={(e) => {
            e.preventDefault();
            void scan();
          }}
        >
          <div className="rounded-3xl bg-surface p-2 shadow-composer">
            <div className="flex gap-1 px-2 pt-1">
              <SourceTab
                active={source === "cmc"}
                onClick={() => setSource("cmc")}
                label="CoinMarketCap"
              />
              <SourceTab
                active={source === "dex"}
                onClick={() => setSource("dex")}
                label="DexScreener"
              />
            </div>
            <div className="flex items-end gap-2 p-1 pt-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Enter is handled here rather than left to the form's
                // implicit submission, which a browser swallows while its own
                // autofill list is open. isComposing guards an IME: mid-word
                // Enter is the keystroke that accepts the candidate, not one
                // that means send.
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (canScan) void scan();
                }}
                // No autofill list to swallow that Enter in the first place.
                autoComplete="off"
                placeholder={
                  source === "cmc"
                    ? "Ask for a coin — bitcoin, tether, or a CMC URL"
                    : "Ask for a pool — WIF, or a DexScreener URL"
                }
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="URL or symbol to scan"
                className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 font-sans text-base text-fg outline-none placeholder:text-faint"
              />
              <Button
                type="submit"
                variant="primary"
                size="send"
                disabled={!canScan}
                aria-label="Scan"
                className="mb-1"
              >
                <ArrowUp size={18} />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SourceTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function IdleFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
      {children}
    </div>
  );
}

// Modal rather than a line in the results: a scan crosses several hosts and
// can take seconds, and the page underneath is the previous scan's, which is
// no longer what the answer will be.
// Sources go stale and entries predate the field, so each failure falls
// through to the next candidate and finally to the first letter, which keeps
// the row of chips aligned either way.
function ChipLogo({ entry }: { entry: HistoryEntry }) {
  const sources = logoCandidates(entry);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];

  if (!src) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-muted">
        {(entry.label || "?").slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      // Keyed by the URL so a retry actually reloads: React reuses the node
      // otherwise and the browser keeps the failed image.
      key={src}
      src={src}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      className="size-5 shrink-0 rounded-full bg-surface-2 object-cover"
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}

// What was scanned before, most recent first. Picking one only fills the
// composer: a scan still has to be asked for, which is the whole posture of
// this app.
function History({
  entries,
  onPick,
  onForget,
  onClear,
}: {
  entries: HistoryEntry[];
  onPick: (entry: HistoryEntry) => void;
  onForget: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div className="enter enter-3 w-full max-w-xl pt-2">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <span className="text-xs text-faint">Recent</span>
        <button
          type="button"
          className="ml-auto rounded-full text-xs text-faint transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {entries.map((e) => (
          <span
            key={e.query}
            className="group relative flex h-9 items-center gap-2 rounded-full bg-surface pl-2 pr-3 shadow-ring transition-colors duration-150 hover:bg-surface-2"
          >
            <button
              type="button"
              title={e.query}
              // The chip is 36px tall; the pseudo-element reaches 4px past it on
              // both sides so the hit area is 44px without growing the chip.
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-full text-left",
                "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
              onClick={() => onPick(e)}
            >
              <ChipLogo entry={e} />
              <span className="max-w-40 truncate text-sm text-fg">{e.label}</span>
            </button>
            <button
              type="button"
              aria-label={`Forget ${e.label}`}
              // Out of the flow entirely, floating over the chip's own right
              // edge. Growing it inside the row re-wrapped the line and
              // re-centred every chip - including this one, which then slid
              // out from under the cursor, dropped the hover, shrank back,
              // and started over.
              className={cn(
                "absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center",
                "rounded-full bg-surface-2 text-faint shadow-ring transition-opacity duration-150",
                "z-10 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
              onClick={() => onForget(e)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ScanningDialog({
  query,
  source,
  onCancel,
}: {
  query: string;
  source: Source;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Scanning"
      // Anywhere, not just the backdrop: there is nothing here to click on
      // for its own sake, so a click on the spinner means the same thing.
      onClick={onCancel}
      // Frosted rather than dimmed: a heavy blur with the colour left in, so
      // the results behind stay recognisable as shapes without competing with
      // the card. The tint is light because blur, not darkness, is what
      // separates the two layers.
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-bg/50 backdrop-blur-2xl backdrop-saturate-150"
    >
      {/* No card: the frosted backdrop is the surface, so a second one behind
          the text only boxes it in. */}
      <div className="enter flex w-full max-w-sm flex-col items-center gap-4 px-6 py-8 text-center">
        <CometSpinner size={30} thickness={3} className="text-fg" />
        <div className="w-full space-y-1">
          <p className="text-base font-medium text-fg">
            Scanning {source === "cmc" ? "CoinMarketCap" : "DexScreener"}…
          </p>
          {/* Short queries sit still; only a value too wide to fit runs. */}
          {query.length > 34 ? (
            <div
              className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%-2rem),transparent)]"
              title={query}
            >
              <div className="marquee pulse-soft whitespace-nowrap text-sm text-muted">
                <span>{query}</span>
                <span aria-hidden="true">{query}</span>
              </div>
            </div>
          ) : (
            <p className="pulse-soft truncate text-sm text-muted" title={query}>
              {query}
            </p>
          )}
        </div>
        <button
          type="button"
          className="rounded-full text-xs text-faint transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={onCancel}
        >
          Click anywhere or press Esc to cancel
        </button>
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-bg/70"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg px-4 pb-4 sm:pb-0">{children}</div>
    </div>
  );
}

// Every control here previews what it changes: a sound described in words is
// a sound nobody can choose between.
function SoundSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  function preview(patch: Partial<Settings>) {
    onChange(patch);
    const next = { ...settings, ...patch };
    if (!next.sound) return;
    primeChime();
    playChime(true, { name: next.chime, volume: next.volume });
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          aria-label={settings.sound ? "Mute the chime" : "Unmute the chime"}
          title={settings.sound ? "Mute" : "Unmute"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            settings.sound
              ? "bg-surface-2 text-fg hover:bg-border"
              : "bg-surface-2 text-faint hover:text-muted",
          )}
          onClick={() => {
            const on = !settings.sound;
            onChange({ sound: on });
            if (on) {
              primeChime();
              playChime(true, { name: settings.chime, volume: settings.volume });
            }
          }}
        >
          {settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-fg">Chime when a scan finishes</div>
          <div className="text-xs text-faint">For a scan left running in another tab</div>
        </div>
        <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">
          {settings.sound ? `${Math.round(settings.volume * 100)}%` : "off"}
        </span>
      </div>

      <Slider
        aria-label="Chime volume"
        value={settings.volume}
        disabled={!settings.sound}
        onChange={(v) => onChange({ volume: v })}
        // Dragging fires on every pixel; the sound waits for the release so
        // the notes do not stack on top of each other.
        onCommit={() => preview({})}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIME_NAMES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!settings.sound}
            className={cn(
              "h-11 rounded-full px-4 text-xs font-medium transition-colors duration-150 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              settings.chime === c.id
                ? "bg-fg text-bg"
                : "bg-surface-2 text-muted hover:text-fg",
            )}
            onClick={() => preview({ chime: c.id as ChimeName })}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-fg">Settings</h2>
        <button
          type="button"
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <label className="mb-2 block text-sm text-muted">Chart host</label>
      <Input
        value={settings.chartHost ?? ""}
        onChange={(e) => onChange({ chartHost: e.target.value })}
        placeholder={DEFAULT_CHART_HOST}
        spellCheck={false}
      />
      <div className="mt-2">
        <Toggle
          checked={settings.deriveAvatar}
          onChange={(v) => onChange({ deriveAvatar: v })}
          name="Build avatar URLs from the CMC id"
          why="Only when the page carries none of its own"
        />
        <Toggle
          checked={settings.nativeAsUcid}
          onChange={(v) => onChange({ nativeAsUcid: v })}
          name="Native coins get UCID=<id>"
          why="BTC and the like have no contract for that column"
        />
      </div>
      <SoundSettings settings={settings} onChange={onChange} />

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            saveSettings(settings);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1400);
          }}
        >
          {saved ? <Check size={16} /> : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

type LogLevel = "log" | "info" | "warn" | "error" | "debug";
type LogEntry = { at: number; level: LogLevel; text: string };

function formatLogArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function barsUrl(
  host: string | undefined,
  dexId: string,
  chain: string,
  pool: string,
  quote: string,
): string {
  const path = `${encodeURIComponent(dexId)}/bars/${encodeURIComponent(chain)}/${encodeURIComponent(pool)}`;
  const q = quote ? `&q=${encodeURIComponent(quote)}` : "";
  // Pasted with or without the scheme and trailing slash.
  const h = (host ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") || DEFAULT_CHART_HOST;
  return `https://${h}/dex/chart/amm/v3/${path}?res=15&cb=2${q}`;
}

function ConsolePanel({
  entries,
  onClear,
  onClose,
}: {
  entries: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-fg">Console</h2>
        <div className="flex items-center gap-1">
          {entries.length ? (
            <Button variant="ghost" onClick={onClear}>
              Clear
            </Button>
          ) : null}
          <button
            type="button"
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>
      {entries.length ? (
        <ul className="max-h-[60dvh] space-y-2 overflow-y-auto font-mono text-xs">
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-2">
              <span className="shrink-0 text-muted">
                {new Date(e.at).toLocaleTimeString()}
              </span>
              <button
                type="button"
                title="Copy"
                className={cn(
                  "min-w-0 whitespace-pre-wrap break-all rounded-xl text-left hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  e.level === "error"
                    ? "text-danger"
                    : e.level === "warn"
                      ? "text-warn"
                      : "text-fg",
                )}
                onClick={() => {
                  navigator.clipboard.writeText(e.text).then(
                    () => toast.success("Copied"),
                    () => toast.error("Copy failed"),
                  );
                }}
              >
                {e.text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Nothing logged yet. Logs, errors and chart bars URLs show up here.
        </p>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  name,
  why,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  name: string;
  why: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          // Half step kept: it sets the 24px track against the 20px first line.
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-fg" : "bg-surface-2 shadow-ring",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full transition-transform duration-150",
            checked ? "translate-x-4 bg-bg" : "translate-x-0.5 bg-muted",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{name}</span>
        <span className="block text-xs leading-relaxed text-faint">{why}</span>
      </span>
    </label>
  );
}

function InstallPanel({ onClose }: { onClose: () => void }) {
  const steps = [
    "Download the zip and unzip it somewhere permanent.",
    "Chrome or Edge 111+ → extensions page → Developer mode.",
    "Load unpacked, pick the unzipped folder (the one with manifest.json).",
    "Pin it. Open a DexScreener pool or CMC coin. Press Scan in the popup — the page stays clean until then.",
  ];
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-fg">Chrome extension</h2>
        <button
          type="button"
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Same capture as this app, on the live page. Nothing runs until you press Scan.
      </p>
      <ol className="mb-5 space-y-3 text-sm leading-relaxed text-muted">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="w-4 shrink-0 tabular-nums text-faint">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <a
        href={`${import.meta.env.BASE_URL}xcap-extension.zip`}
        download="xcap-extension.zip"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-4 font-sans text-sm font-medium text-bg hover:bg-fg-hover"
      >
        <Download size={16} />
        Download extension
      </a>
    </div>
  );
}
