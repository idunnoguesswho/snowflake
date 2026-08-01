import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", amount: 0.02, glyph: "₿", tint: "#E8A33D" },
  { symbol: "ETH", name: "Ethereum", id: "ethereum", amount: 0.02, glyph: "Ξ", tint: "#9DB2FF" },
  { symbol: "DGB", name: "DigiByte", id: "digibyte", amount: 4300, glyph: "Đ", tint: "#4C8FD9" },
  { symbol: "RSR", name: "Reserve Rights", id: "reserve-rights-token", amount: 1100, glyph: "#", tint: "#D8D3C4" },
  { symbol: "LUNC", name: "Luna Classic", id: "terra-luna-classic", amount: 10000, glyph: "☾", tint: "#E8C468" },
];

const IDS = ASSETS.map((a) => a.id).join(",");
const API = `https://api.coingecko.com/api/v3/simple/price?ids=${IDS}&vs_currencies=usd&include_24hr_change=true`;

function fmtUsd(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const decimals = opts.decimals ?? (abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtAmount(n) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export default function PortfolioMonitor() {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cash, setCash] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setSpinning(true);
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      setPrices(data);
      setStatus("ok");
      setLastUpdated(new Date());
    } catch (e) {
      setStatus("error");
    } finally {
      setTimeout(() => setSpinning(false), 500);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 60000);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const rows = ASSETS.map((a) => {
    const p = prices[a.id];
    const price = p ? p.usd : null;
    const change = p ? p.usd_24h_change : null;
    const value = price !== null ? price * a.amount : null;
    return { ...a, price, change, value };
  });

  const total =
    rows.reduce((sum, r) => sum + (r.value || 0), 0) + (Number(cash) || 0);

  const tapeItems = rows.filter((r) => r.price !== null);

  return (
    <div className="min-h-screen w-full bg-[#0F0D0A] text-[#EDE6D6] font-mono flex flex-col">
      {/* ticker tape */}
      <div className="w-full overflow-hidden border-b border-[#3A3226] bg-[#161209] whitespace-nowrap">
        <div className="inline-block py-2 animate-[tape_28s_linear_infinite] tracking-widest text-xs">
          {tapeItems.length === 0 && status === "loading" && (
            <span className="px-6 text-[#8C7F63]">FETCHING LIVE PRICES…</span>
          )}
          {[...tapeItems, ...tapeItems].map((r, i) => (
            <span key={i} className="px-6 inline-flex items-center gap-2">
              <span style={{ color: r.tint }}>{r.symbol}</span>
              <span className="text-[#EDE6D6]">{fmtUsd(r.price)}</span>
              <span
                className={
                  r.change >= 0 ? "text-[#4FB68B]" : "text-[#D9614F]"
                }
              >
                {r.change >= 0 ? "▲" : "▼"} {Math.abs(r.change || 0).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto px-5 py-10 flex-1">
        {/* header */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-[13px] tracking-[0.3em] text-[#8C7F63] uppercase">
            Holdings Ledger
          </h1>
          <button
            onClick={load}
            className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-[#8C7F63] hover:text-[#EDE6D6] transition-colors"
          >
            <RefreshCw
              size={13}
              className={spinning ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="flex items-end justify-between border-b border-[#3A3226] pb-6 mb-8">
          <div>
            <div className="text-5xl tabular-nums tracking-tight text-[#F6EFDD]">
              {fmtUsd(total)}
            </div>
            <div className="text-[11px] text-[#6E6350] mt-2 tracking-wide">
              {status === "error"
                ? "Live prices unavailable — showing last known values"
                : lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes every 60s`
                : "Loading current prices…"}
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-[#6E6350] tracking-widest uppercase">
              Assets tracked
            </div>
            <div className="text-2xl text-[#EDE6D6]">{ASSETS.length + 1}</div>
          </div>
        </div>

        {/* ledger rows */}
        <div className="border-t border-[#2A2418]">
          {rows.map((r) => (
            <div
              key={r.symbol}
              className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 py-4 border-b border-[#2A2418]"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-base border"
                style={{ borderColor: r.tint, color: r.tint }}
              >
                {r.glyph}
              </div>
              <div>
                <div className="text-[15px] text-[#F6EFDD]">{r.name}</div>
                <div className="text-[11px] text-[#6E6350] tracking-wide">
                  {fmtAmount(r.amount)} {r.symbol}
                </div>
              </div>
              <div className="hidden sm:block text-right text-[13px] text-[#8C7F63] tabular-nums">
                {fmtUsd(r.price)}
              </div>
              <div
                className={`text-right text-[12px] tabular-nums flex items-center gap-1 justify-end ${
                  r.change >= 0 ? "text-[#4FB68B]" : "text-[#D9614F]"
                }`}
              >
                {r.change !== null &&
                  (r.change >= 0 ? (
                    <ArrowUpRight size={12} />
                  ) : (
                    <ArrowDownRight size={12} />
                  ))}
                {r.change !== null ? `${Math.abs(r.change).toFixed(2)}%` : "—"}
              </div>
              <div className="text-right text-[15px] text-[#F6EFDD] tabular-nums">
                {fmtUsd(r.value)}
              </div>
            </div>
          ))}

          {/* USD cash row, editable */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 py-4 border-b border-[#2A2418]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center border border-[#EDE6D6] text-[#EDE6D6]">
              <Wallet size={14} />
            </div>
            <div>
              <div className="text-[15px] text-[#F6EFDD]">US Dollar</div>
              <div className="text-[11px] text-[#6E6350] tracking-wide">
                Cash balance
              </div>
            </div>
            <div className="hidden sm:block text-right text-[13px] text-[#8C7F63] tabular-nums">
              $1.00
            </div>
            <div className="text-right text-[12px] text-[#6E6350]">flat</div>
            <div className="text-right tabular-nums">
              <input
                type="number"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="w-28 bg-transparent text-right text-[15px] text-[#F6EFDD] border-b border-[#3A3226] focus:border-[#8C7F63] outline-none tabular-nums"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 text-[10px] text-[#5A5040] tracking-wide leading-relaxed">
          Prices from CoinGecko's public market data, refreshed automatically.
          Edit your USD balance above to include it in the total. This is a
          personal monitoring view, not a trading account.
        </div>
      </div>

      <style>{`
        @keyframes tape {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
