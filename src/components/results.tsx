import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isCmc, presentRow, tsvOf } from "@/lib/present";
import type { DexRow, Overview, ScanOk, ScanRow, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-2000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// DexScreener's own image paths: every chain it lists has an icon here, and
// a token's icon is here too when it has one (a 404 otherwise, and the
// letter takes over). Read from the source, not mapped (CLAUDE.md).
const chainIcon = (chain: string) =>
  `https://dd.dexscreener.com/ds-data/chains/${encodeURIComponent(chain.toLowerCase())}.png`;
const tokenIcon = (chain: string, address: string) =>
  `https://dd.dexscreener.com/ds-data/tokens/${encodeURIComponent(chain.toLowerCase())}/${encodeURIComponent(address.toLowerCase())}.png`;

// Token and chain icons are the one place allowed off the design system
// (the user's call): real artwork, so they get depth instead of flat tokens.

/** A stable hue per symbol, so a coin without artwork still looks like itself. */
function hueOf(symbol: string): number {
  let h = 0;
  for (const ch of symbol.toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function Avatar({
  src,
  symbol,
  chain,
}: {
  src?: string;
  symbol: string;
  /** Adds the chain's icon as a badge on the bottom-right of the token. */
  chain?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [badgeFailed, setBadgeFailed] = useState(false);
  const hue = hueOf(symbol || "?");
  return (
    <span className="relative inline-flex size-11 shrink-0">
      <span
        className="relative flex size-11 items-center justify-center overflow-hidden rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
        style={{
          // Seen behind an icon while it loads, and as the whole face when
          // there is no icon: a soft two-tone of the symbol's own hue.
          background: `radial-gradient(120% 120% at 30% 20%, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 18%))`,
        }}
      >
        {!src || failed ? (
          <span className="text-sm font-medium text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            {(symbol || "?").slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <img
            src={src}
            alt=""
            width={44}
            height={44}
            className={cn(
              "size-11 object-cover transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {/* A hairline inside the edge: dark artwork does not dissolve into
            the dark page, light artwork gets a finished rim. */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15" />
      </span>
      {chain && !badgeFailed ? (
        // Ringed in the page colour so it reads as sitting on top of the
        // token rather than bitten out of it.
        <img
          src={chainIcon(chain)}
          alt={chain}
          title={chain}
          width={18}
          height={18}
          className="absolute -bottom-1 -right-1 size-[18px] rounded-full bg-surface-2 object-cover shadow-[0_1px_4px_rgba(0,0,0,0.5)] ring-[2.5px] ring-bg"
          onError={() => setBadgeFailed(true)}
        />
      ) : null}
    </span>
  );
}

function formatQty(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n >= 1 ? 0 : 6 }).format(n);
}

function Field({
  label,
  value,
  copyValue,
  hint,
  kind = "address",
}: {
  label: string;
  value: string;
  copyValue?: string;
  hint?: string;
  // How the value is set: an address breaks anywhere in mono, a figure keeps
  // its digits on one line, a name reads as ordinary text.
  kind?: FieldKind;
}) {
  if (!value && !hint) return null;
  return (
    <div className="flex min-h-11 items-start gap-3 py-2.5">
      {/* Half step kept: it lines the 12px label up with the 14px value. */}
      <span className="w-20 shrink-0 pt-0.5 text-xs text-muted">{label}</span>
      {value ? (
        // The value is the button: an address is what the eye goes to and
        // what the hand wants to click, so a separate icon beside it was one
        // more target for the same job.
        <button
          type="button"
          title={`Copy ${label}: ${copyValue ?? value}`}
          // The negative margin grows the hit area to 44px without moving the
          // text the row lines up on.
          className={cn(
            "-my-2.5 min-h-11 min-w-0 flex-1 cursor-pointer py-2.5 text-left text-sm leading-relaxed text-fg transition-colors duration-150 hover:text-muted",
            FIELD_KIND[kind],
          )}
          onClick={() => copyValue_(label, copyValue ?? value)}
        >
          {value}
        </button>
      ) : (
        <span className="min-w-0 flex-1 text-xs text-faint">{hint}</span>
      )}
    </div>
  );
}

type FieldKind = "address" | "number" | "text";

const FIELD_KIND: Record<FieldKind, string> = {
  address: "break-all font-mono",
  number: "truncate font-sans tabular-nums",
  text: "font-sans",
};

// One place decides what a copy looks like from the outside: the text lands
// on the clipboard and the toast says so.
async function copyValue_(label: string, text: string) {
  try {
    await writeClipboard(text);
    toast.success("Copied");
  } catch {
    toast.error(`Could not copy ${label}`);
  }
}

function formatUsd(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)} K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// A price can be 68,000 or 0.000000004, so the number of decimals follows the
// magnitude rather than being fixed.
function formatPrice(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.000001 ? 6 : 10;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

/**
 * One card for the coin: what it is doing at the top, then everything worth
 * copying underneath. Two cards said the same thing twice - the same logo,
 * the same symbol - and put the contracts a scroll away from the name they
 * belong to.
 */
function CoinCard({ overview, rows }: { overview: Overview; rows: ScanRow[] }) {
  const contracts = rows.filter(isCmc);
  return (
    // No fill and no ring: the page is the card's ground, and the rules
    // between the figures carry the structure the box was drawing.
    <div className="mb-3">
      {/* The head copies every contract as TSV, the way a row header does
          elsewhere: the card replaced those rows, and their copy with them. */}
      <button
        type="button"
        title="Copy every contract as TSV"
        className="block w-full text-left"
        onClick={() => copyValue_("rows", contracts.map(tsvOf).join("\n"))}
      >
        <Preview overview={overview} />
      </button>
      <div className="divide-y divide-border border-t border-border">
        {contracts.map((row, i) => (
          <Field
            key={`${row.platformId}-${row.tokenAddress}-${i}`}
            // The chain is the label when there is one: a coin on four chains
            // is four lines that would otherwise all read "Contract".
            label={row.platformName || "Contract"}
            value={row.tokenAddress}
          />
        ))}
        <Field
          label="Circulating"
          kind="number"
          value={overview.circulating ? formatQty(overview.circulating) : ""}
          copyValue={overview.circulating}
        />
        <Field
          label="Total"
          kind="number"
          value={overview.totalSupply ? formatQty(overview.totalSupply) : ""}
          copyValue={overview.totalSupply}
        />
      </div>
    </div>
  );
}

/** The head of the card: logo, name, price, and the three figures. */
function Preview({ overview }: { overview: Overview }) {
  const change = overview.change24h;
  return (
    <>
      <div className="mb-3 flex items-center">
        <AvatarBox>
          <Avatar src={overview.image} symbol={overview.symbol} />
        </AvatarBox>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-base font-medium text-fg"
            title={`${overview.name || overview.symbol}${overview.symbol ? ` (${overview.symbol})` : ""}`}
          >
            {overview.name || overview.symbol}
            {overview.symbol ? ` (${overview.symbol})` : ""}
          </h2>
          <div className="flex items-baseline gap-2">
            <p className="truncate text-xl font-medium tracking-tight tabular-nums text-fg">
              {formatPrice(overview.priceUsd)}
            </p>
            {change != null ? (
              <span className={cn("text-sm tabular-nums", change >= 0 ? "text-ok" : "text-warn")}>
                {/* The sign carries the direction too, not the colour alone. */}
                {change >= 0 ? "▲ +" : "▼ −"}
                {Math.abs(change).toFixed(2)}%
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {/* Divided rather than spaced: three figures of different lengths line
          up on their own columns instead of drifting. */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <Stat
          label="Rank"
          value={overview.rank != null ? `#${overview.rank}` : "—"}
          hint={overview.rank != null ? "Position by market cap on CoinMarketCap" : undefined}
        />
        <Stat
          label="Market cap"
          value={formatUsd(overview.marketCap)}
          hint={
            exactUsd(overview.marketCap)
              ? `${exactUsd(overview.marketCap)} — price × circulating supply`
              : undefined
          }
        />
        <Stat
          label="Volume 24h"
          value={formatUsd(overview.volume24h)}
          hint={
            exactUsd(overview.volume24h)
              ? `${exactUsd(overview.volume24h)} — traded across every pair in the last 24 hours`
              : undefined
          }
        />
      </div>
    </>
  );
}

/** Every digit, for a figure the cell had to abbreviate to fit. */
function exactUsd(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    // The browser's own tooltip: nothing to position, nothing to clip, and it
    // behaves the way every other tooltip on the machine does.
    <div className="px-2 py-3 text-center" title={hint}>
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 truncate text-sm tabular-nums text-fg">{value}</div>
    </div>
  );
}

function DexEmbed({ chain, pool }: { chain: string; pool: string }) {
  const src =
    `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(pool)}` +
    "?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15";
  return (
    // A gentler radius than the cards around it: DexScreener draws its own
    // header flush to the top corners of the frame, so anything rounder eats
    // the token name out of it.
    <div className="relative mb-3 w-full overflow-hidden aspect-[25/12] rounded-xl bg-bg shadow-ring">
      <iframe
        title="DexScreener"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
}

export function Results({
  result,
  settings,
  extensionVersion,
  onClear,
}: {
  result: ScanOk;
  settings: Settings;
  // Version reported by the capture extension in the chart frame, or null
  // when nothing has spoken up: the difference between "still loading" and
  // "no extension is listening".
  extensionVersion?: string | null;
  onClear: () => void;
}) {
  const rows = useMemo(
    () => result.rows.map((row) => presentRow(row, settings)),
    [result.rows, settings],
  );
  const embed = result.rows.find((r): r is Extract<ScanRow, { kind: "dex" }> => r.kind === "dex");
  const dexRows = rows.filter((r): r is DexRow => !isCmc(r));

  if (embed && !result.overview && dexRows.length > 0) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col px-4">
        <DexResult embed={embed} rows={dexRows} extensionVersion={extensionVersion} />
        <ClearBar onClear={onClear} />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col px-4">
      <div className="pt-4">
        {result.overview ? (
          <CoinCard overview={result.overview} rows={rows} />
        ) : rows.length === 0 ? (
          <p className="px-2 py-16 text-center text-sm text-muted">Nothing to show.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, i) => (
              <li key={rowKey(row, i)} className="rounded-2xl bg-surface p-4">
                {/* Only CoinMarketCap rows reach here: a DexScreener scan never
                    carries an overview, so it always renders through DexResult. */}
                {isCmc(row) ? (
                  <>
                    <button
                      type="button"
                      title="Copy this row as TSV"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => copyValue_("row", tsvOf(row))}
                    >
                      <Avatar src={row.avatar} symbol={row.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">
                          {row.symbol || "—"}
                        </div>
                        <div
                          className="truncate text-xs text-muted"
                          title={`${row.platformName || "Native"}${row.slug ? ` · ${row.slug}` : ""}${row.id != null ? ` · #${row.id}` : ""}`}
                        >
                          {row.platformName || "Native"}
                          {row.slug ? ` · ${row.slug}` : ""}
                          {row.id != null ? ` · #${row.id}` : ""}
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 border-t border-border pt-1">
                      <Field label="Contract" value={row.tokenAddress} />
                    </div>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClearBar onClear={onClear} />
    </section>
  );
}

// Sized to its content, not stretched to the viewport: stretched, the clear
// button sat at the bottom of the screen with half a page of nothing above it.
function ClearBar({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
      <Button
        size="icon"
        variant="ghost"
        className="ml-auto"
        title="Clear captured rows"
        onClick={onClear}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

function dexIdHint(extensionVersion?: string | null) {
  return extensionVersion
    ? `Waiting for the chart worker (XCap ${extensionVersion})`
    : "Install the XCap extension to capture this";
}

// Label width plus the row gap, so a title starts where the values below it do.
function AvatarBox({ children }: { children: React.ReactNode }) {
  return <div className="flex w-23 shrink-0 items-center">{children}</div>;
}

function pairName(row: DexRow) {
  return row.quoteSymbol ? `${row.symbol}/${row.quoteSymbol}` : row.symbol || "—";
}

/**
 * A DexScreener pool: every value on its own line, data first, and the chart
 * behind a button so the page opens on what gets copied. No card around it:
 * the page is the ground, the rules between lines carry the structure. A
 * value is copied by clicking it, as everywhere else.
 */
function DexResult({
  embed,
  rows,
  extensionVersion,
}: {
  embed: DexRow;
  rows: DexRow[];
  extensionVersion?: string | null;
}) {
  const [chart, setChart] = useState(false);
  return (
    <div className="pt-4">
      {rows.map((row, i) => (
        <section
          key={rowKey(row, i)}
          aria-labelledby={`pool-${i}`}
          className={cn(i > 0 && "mt-4 border-t border-border pt-4")}
        >
          <div className="mb-3 flex items-center gap-2">
            {/* The head copies the whole row as TSV: pasted into a sheet it
                lands across the columns (Symbol, ChainID, DexID, Quote,
                Contract, Pool Address). The button sits inside the h2, so
                the heading stays a heading. */}
            <h2 id={`pool-${i}`} className="min-w-0 flex-1">
              <button
                type="button"
                title="Copy this row as TSV — paste into a sheet as columns"
                className="-my-1 flex min-h-11 w-full items-center rounded-2xl text-left transition-colors duration-150 hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => copyValue_("row", tsvOf(row))}
              >
                <AvatarBox>
                  <Avatar
                    src={row.imageUrl || (row.contract ? tokenIcon(row.chain, row.contract) : "")}
                    symbol={row.symbol}
                    chain={row.chain}
                  />
                </AvatarBox>
                <span className="min-w-0 flex-1 truncate text-base font-medium">
                  {pairName(row)}
                </span>
              </button>
            </h2>
            {i === 0 ? (
              <Button onClick={() => setChart((v) => !v)}>
                {chart ? "Hide chart" : "Show chart"}
              </Button>
            ) : null}
          </div>
          {i === 0 && chart ? <DexEmbed chain={embed.chain} pool={embed.poolAddress} /> : null}
          <div className="divide-y divide-border border-t border-border">
            <Field label="Chain" kind="text" value={row.chain} />
            <Field label="DexID" kind="text" value={row.dexId} hint={dexIdHint(extensionVersion)} />
            <Field label="Contract" value={row.contract} />
            <Field label="Pool" value={row.poolAddress} />
            <Field label="Quote" value={row.quote} />
            <Field
              label="Supply"
              kind="number"
              value={row.supply ? formatQty(row.supply) : ""}
              copyValue={row.supply}
            />
            <Field
              label="Total"
              kind="number"
              value={row.totalSupply ? formatQty(row.totalSupply) : ""}
              copyValue={row.totalSupply}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function rowKey(row: ScanRow, i: number) {
  if (isCmc(row)) {
    return `cmc-${row.id}-${row.platformId}-${row.tokenAddress}-${i}`;
  }
  return `dex-${row.chain}-${row.poolAddress}-${row.quote}-${i}`;
}
