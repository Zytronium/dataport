"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOT_A_PROGRAM = [
  "im_not_a_program.exe", "im_no_program.exe", "not_a_program.exe",
  "imnotaprogram.exe", "notaprogram.exe", "imnoprogram.exe",
];

const CHAR_DELAYS = { " ": 75, ".": 180, ",": 120, "!": 180, ";": 120, ":": 150, "'": 33 };
const DEFAULT_DELAY = 50;

// ─── Node Map Layout ──────────────────────────────────────────────────────────
// Grid (row, col). All connections are strict diagonal or straight-down:
//   upLeft    (row-1, col-1)  ↖
//   up        (row-1, col  )  ↑
//   upRight   (row-1, col+1)  ↗
//   downLeft  (row+1, col-1)  ↙
//   down      (row+1, col  )  ↓
//   downRight (row+1, col+1)  ↘

// Grid layout (all same-row nodes are ≥2 cols apart — no left/right adjacency):
//
//         col: 0    col: 2    col: 4
// row 0:            USB
// row 1:      CACHE           CTRL
// row 2:  WL        FIRM      ECC
// row 3:      BBM             NAND
// row 4:  PART      MBR
// row 5:      VBR             EFI
// row 6:            FAT32
// row 7:            BOOT

const NODES = [
  { id:  0, label: "USB",   row: 0, col: 2 },

  { id:  1, label: "CACHE", row: 1, col: 1 },
  { id:  2, label: "CTRL",  row: 1, col: 3 },

  { id:  3, label: "WL",    row: 2, col: 0 },
  { id:  4, label: "FIRM",  row: 2, col: 2 },
  { id:  5, label: "ECC",   row: 2, col: 4 },

  { id:  6, label: "BBM",   row: 3, col: 1 },
  { id:  7, label: "NAND",  row: 3, col: 3 },

  { id:  8, label: "PART",  row: 4, col: 0 },
  { id:  9, label: "MBR",   row: 4, col: 2 },

  { id: 10, label: "VBR",   row: 5, col: 1 },
  { id: 11, label: "EFI",   row: 5, col: 3 },

  { id: 12, label: "FAT32", row: 6, col: 2 }, // starting node

  { id: 13, label: "BOOT",  row: 7, col: 2 },
];

// All connections are valid: |dr|=1, |dc|≤1 (diagonal or straight up/down)
const CONNECTIONS = [
  [0, 1], [0, 2],           // USB   → CACHE, CTRL
  [1, 3], [1, 4],           // CACHE → WL, FIRM
  [2, 4], [2, 5],           // CTRL  → FIRM, ECC
  [3, 6],                   // WL    → BBM
  [4, 6], [4, 7],           // FIRM  → BBM, NAND
  [5, 7],                   // ECC   → NAND
  [6, 8], [6, 9],           // BBM   → PART, MBR   (wait: BBM r3c1 → PART r4c0 ✓, MBR r4c2 ✓)
  [7, 9],                   // NAND  → MBR          (NAND r3c3 → MBR r4c2 ✓)
  [8, 10],                  // PART  → VBR          (r4c0 → r5c1 ✓)
  [9, 10], [9, 11],         // MBR   → VBR, EFI     (r4c2 → r5c1 ✓, r5c3 ✓)
  [10, 12], [11, 12],       // VBR, EFI → FAT32     (r5c1 → r6c2 ✓, r5c3 → r6c2 ✓)
  [12, 13],                 // FAT32 → BOOT         (r6c2 → r7c2 ✓)
];

function areConnected(a, b) {
  return CONNECTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Direction offsets (6 directions)
const DIR_OFFSETS = {
  upLeft:    { dr: -1, dc: -1 },
  up:        { dr: -1, dc:  0 },
  upRight:   { dr: -1, dc: +1 },
  downLeft:  { dr: +1, dc: -1 },
  down:      { dr: +1, dc:  0 },
  downRight: { dr: +1, dc: +1 },
};

// Returns { upLeft: nodeId|null, up: ..., ... } for a given current node
function getExits(currentId) {
  const cur = NODES.find(n => n.id === currentId);
  const result = {};
  for (const [dir, { dr, dc }] of Object.entries(DIR_OFFSETS)) {
    const target = NODES.find(n => n.row === cur.row + dr && n.col === cur.col + dc);
    result[dir] = (target && areConnected(currentId, target.id)) ? target.id : null;
  }
  return result;
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter() {
  const queueRef   = useRef([]);
  const runningRef = useRef(false);

  const enqueue = useCallback((fn) => {
    queueRef.current.push(fn);
    if (!runningRef.current) runNext();
  }, []);

  function runNext() {
    if (queueRef.current.length === 0) { runningRef.current = false; return; }
    runningRef.current = true;
    queueRef.current.shift()(runNext);
  }

  const typeLine = useCallback((text, setLines, done) => {
    let i = 0, current = "";
    setLines(prev => [...prev, ""]);
    function next() {
      if (i >= text.length) { done(); return; }
      current += text[i];
      const snap = current;
      setLines(prev => { const a = [...prev]; a[a.length - 1] = snap; return a; });
      setTimeout(next, CHAR_DELAYS[text[i]] ?? DEFAULT_DELAY);
      i++;
    }
    next();
  }, []);

  return { enqueue, typeLine };
}

// ─── NavTriangle ──────────────────────────────────────────────────────────────
// Single upward-pointing triangle shape, rotated to face each of 6 directions.

const DIR_CONFIG = {
  upLeft:    { deg: 315, label: "↖", key: "↑←" },
  up:        { deg:   0, label: "↑", key: "↑" },
  upRight:   { deg:  45, label: "↗", key: "↑→" },
  downLeft:  { deg: 225, label: "↙", key: "↓←" },
  down:      { deg: 180, label: "↓", key: "↓" },
  downRight: { deg: 135, label: "↘", key: "↓→" },
};

// Upward-pointing equilateral-ish triangle
const TRI_POINTS = "40,4 76,72 4,72";

function NavTriangle({ direction, enabled, active, onActivate }) {
  const cfg = DIR_CONFIG[direction];
  const dim = 68;

  return (
    <button
      className={`relative flex items-center justify-center focus:outline-none
        ${enabled ? "cursor-pointer group" : "opacity-20 cursor-not-allowed pointer-events-none"}`}
      style={{ width: dim, height: dim }}
      onClick={() => enabled && onActivate(direction)}
      tabIndex={enabled ? 0 : -1}
      aria-label={`Move ${direction}`}
    >
      <svg width={dim} height={dim} viewBox="0 0 80 80" className="overflow-visible"
           style={{ transform: `rotate(${cfg.deg}deg)`, transition: "transform 0.15s ease" }}
      >
        <polygon points={TRI_POINTS}
                 fill={active ? "rgba(69,221,0,0.22)" : "transparent"}
                 stroke="var(--foreground)"
                 strokeWidth={active ? 2.5 : 1.8}
                 strokeLinejoin="round"
                 style={{
                   filter: active ? "drop-shadow(0 0 6px var(--foreground))" : undefined,
                   transition: "fill 0.05s, stroke-width 0.05s, filter 0.05s",
                 }}
                 className={!active && enabled ? "group-hover:fill-green-900/30 transition-colors duration-100" : ""}
        />
        {/* Inner echo triangle */}
        <polygon points={TRI_POINTS}
                 fill="transparent" stroke="var(--foreground)"
                 strokeWidth="0.6" opacity={active ? 0.55 : 0.2}
                 transform="translate(40,38) scale(0.48) translate(-40,-38)"
                 style={{ transition: "opacity 0.05s" }}
        />
      </svg>
      <span className="absolute font-mono select-none pointer-events-none"
            style={{
              fontSize: "0.7rem",
              color: "var(--foreground)",
              textShadow: active ? "0 0 8px var(--foreground)" : undefined,
              transition: "text-shadow 0.05s",
            }}
      >
        {cfg.label}
      </span>
    </button>
  );
}

// ─── NavPad ───────────────────────────────────────────────────────────────────
// 3×2 grid:  ↖  ↑  ↗
//            ↙  ↓  ↘

function NavPad({ exits, activeKeys, onActivate }) {
  const top    = ["upLeft",   "up",   "upRight"];
  const bottom = ["downLeft", "down", "downRight"];

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="font-mono text-xs tracking-[0.3em] opacity-30 uppercase mb-2">Navigate</p>
      <div className="flex flex-col gap-1">
        {[top, bottom].map((row, ri) => (
          <div key={ri} className="flex flex-row gap-1">
            {row.map(dir => (
              <NavTriangle
                key={dir}
                direction={dir}
                enabled={exits[dir] !== null}
                active={activeKeys[dir] || false}
                onActivate={onActivate}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Key hint legend */}
      <div className="flex flex-row gap-3 mt-3 opacity-20">
        <span className="font-mono text-xs">↑↓ &nbsp; ↑←&nbsp;↑→&nbsp;↓←&nbsp;↓→</span>
      </div>
    </div>
  );
}

// ─── NodeMap ──────────────────────────────────────────────────────────────────

const CELL = 52;
const MAP_PAD_X = 36, MAP_PAD_Y = 20;

function nodePos(n) {
  return {
    x: n.col * CELL + MAP_PAD_X + 22,
    y: n.row * CELL + MAP_PAD_Y + 12,
  };
}

const maxRow = Math.max(...NODES.map(n => n.row));
const maxCol = Math.max(...NODES.map(n => n.col));
const SVG_W = maxCol * CELL + MAP_PAD_X * 2 + 44;
const SVG_H = maxRow * CELL + MAP_PAD_Y * 2 + 24;

function NodeMap({ currentId }) {
  return (
    <div className="w-full h-full overflow-auto flex justify-center pt-2">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
           style={{ fontFamily: "monospace" }}
      >
        {/* Connections */}
        {CONNECTIONS.map(([aId, bId]) => {
          const a = nodePos(NODES.find(n => n.id === aId));
          const b = nodePos(NODES.find(n => n.id === bId));
          const isActive = aId === currentId || bId === currentId;
          return (
            <line key={`${aId}-${bId}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--foreground)"
                  strokeWidth={isActive ? 1.5 : 1}
                  opacity={isActive ? 0.5 : 0.2}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map(node => {
          const { x, y } = nodePos(node);
          const isCurrent = node.id === currentId;
          return (
            <g key={node.id}>
              <rect x={x - 22} y={y - 12} width={44} height={24} rx={3}
                    fill={isCurrent ? "var(--foreground)" : "transparent"}
                    stroke="var(--foreground)"
                    strokeWidth={isCurrent ? 0 : 1}
                    opacity={isCurrent ? 1 : 0.4}
              />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9"
                    fill={isCurrent ? "var(--background)" : "var(--foreground)"}
                    opacity={isCurrent ? 1 : 0.6}
                    fontWeight={isCurrent ? "bold" : "normal"}
              >
                {node.label}
              </text>
              {isCurrent && (
                <circle cx={x} cy={y} r={20} fill="none"
                        stroke="var(--foreground)" strokeWidth="1" opacity="0.25"
                        className="animate-ping"
                        style={{ transformOrigin: `${x}px ${y}px` }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── OptionsPanel ─────────────────────────────────────────────────────────────

function OptionsPanel({ options }) {
  if (!options?.length) return (
    <div className="w-full h-full flex items-center justify-center opacity-20">
      <p className="text-xs font-mono tracking-widest uppercase">— no decisions —</p>
    </div>
  );
  return (
    <div className="w-full h-full p-3 flex flex-col gap-2 overflow-y-auto">
      {options.map((opt, i) => (
        <button key={i}
                className="w-full text-left px-3 py-2 border font-mono text-xs tracking-wide hover:bg-foreground hover:text-background transition-colors duration-150"
                style={{ borderColor: "var(--foreground)", color: "var(--foreground)" }}
        >
          <span className="opacity-50 mr-2">[{i + 1}]</span>{opt}
        </button>
      ))}
    </div>
  );
}

// ─── StoryText ────────────────────────────────────────────────────────────────

function StoryText({ lines, shake }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  return (
    <div className={`w-full h-full overflow-y-auto p-4 flex flex-col justify-end gap-1 scanlines ${shake ? "shake" : ""}`}>
      {lines.map((line, i) => (
        <p key={i} className="font-mono text-sm leading-relaxed whitespace-pre-wrap"
           style={{ color: "var(--foreground)", opacity: Math.max(0.3, 0.4 + (i / lines.length) * 0.6) }}>
          {line}
        </p>
      ))}
      <span className="inline-block w-2 h-4 mt-1 blink" style={{ background: "var(--foreground)" }} />
      <div ref={bottomRef} />
    </div>
  );
}

// ─── NameInput ────────────────────────────────────────────────────────────────

function NameInput({ onSubmit }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const raw = value.trim().replace(/ /g, "_");
    if (!raw) { setError("Oh don't be shy, tell us your name!"); return; }
    const withExe = raw + ".exe";
    if (NOT_A_PROGRAM.includes(withExe.replace(/'/g, "").toLowerCase())) {
      setError("You may sure think that, but you are a program now. What's your name?");
      setValue(""); return;
    }
    setError(""); onSubmit(withExe);
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      {error && <p className="font-mono text-xs opacity-70" style={{ color: "var(--foreground)" }}>{error}</p>}
      <div className="flex flex-row items-center gap-2">
        <span className="font-mono text-sm opacity-60" style={{ color: "var(--foreground)" }}>{">"}</span>
        <input autoFocus
               className="bg-transparent font-mono text-sm outline-none flex-1 border-b"
               style={{ color: "var(--foreground)", borderColor: "var(--foreground)", caretColor: "var(--foreground)" }}
               value={value}
               onChange={e => setValue(e.target.value)}
               onKeyDown={e => { if (e.key === "Enter") handleSubmit(); e.stopPropagation(); }}
               placeholder="your_name"
        />
        <span className="font-mono text-sm opacity-40" style={{ color: "var(--foreground)" }}>.exe</span>
      </div>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

const STARTING_NODE = 12; // FAT32

export default function Home() {
  const [phase, setPhase]               = useState("boot");
  const [bootLines, setBootLines]       = useState([]);
  const [storyLines, setStoryLines]     = useState([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [shake, setShake]               = useState(false);
  const [flashActive, setFlashActive]   = useState(false);
  const [flicker, setFlicker]           = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(STARTING_NODE);
  const [activeKeys, setActiveKeys]     = useState({
    upLeft: false, up: false, upRight: false,
    downLeft: false, down: false, downRight: false,
  });

  const { enqueue, typeLine } = useTypewriter();
  const sleep         = useCallback((ms) => enqueue(done => setTimeout(done, ms)), [enqueue]);
  const addBootLine   = useCallback((t)  => enqueue(done => typeLine(t, setBootLines, done)), [enqueue, typeLine]);
  const addStoryLine  = useCallback((t)  => enqueue(done => typeLine(t, setStoryLines, done)), [enqueue, typeLine]);
  const waitForName   = useCallback(()   => enqueue(done => {
    setShowNameInput(true);
    window.__nameInputDone = done;
  }), [enqueue]);
  const triggerShake  = useCallback(()   => enqueue(done => {
    setShake(true); setTimeout(() => { setShake(false); done(); }, 600);
  }), [enqueue]);
  const doFlash       = useCallback(()   => enqueue(done => {
    setFlashActive(true);
    setTimeout(() => {
      setFlashActive(false);
      setPhase("story");
      setFlicker(true);
      setTimeout(() => setFlicker(false), 800);
      done();
    }, 600);
  }), [enqueue]);

  // Boot sequence
  useEffect(() => {
    addBootLine("INITIALIZING DATA PORT...");
    sleep(1000);
    addBootLine("DECRYPTING RECEIVED INSTRUCTIONS...");
    sleep(1000);
    addBootLine("ENGAGING TRANSDIMENSIONAL BEAM...");
    sleep(2000);
    doFlash();
    addStoryLine("Hello World!");
    sleep(500);
    addStoryLine("Oh, a new visitor!");
    sleep(100);
    addStoryLine("We don't get many travelers through the dataport. At least, not anymore.");
    sleep(100);
    addStoryLine("Tell me, what's your name, program?");
    sleep(250);
    waitForName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameSubmit = useCallback((name) => {
    setShowNameInput(false);
    const done = window.__nameInputDone;
    window.__nameInputDone = null;
    if (done) done();

    addStoryLine(`Hello, ${name}! Welcome to THE DATAPORT!`);
    sleep(1000);
    enqueue(done2 => { setStoryLines(prev => [...prev, "*T H U N K*"]); done2(); });
    triggerShake();
    sleep(500);
    addStoryLine("(The whole place quakes for a moment)");
    sleep(2500);
    addStoryLine("... What was that, you ask?");
    sleep(1000);
    addStoryLine("Our storage medium has just been unplugged.");
    sleep(500);
    addStoryLine("Oh, don't feel trapped! There's much to see in our small little world.");
    sleep(100);
    addStoryLine("Feel free to look around the place.");
    sleep(100);
    addStoryLine("Get used to this new existence.");
  }, [addStoryLine, sleep, enqueue, triggerShake]);

  // Navigation
  const exits = getExits(currentNodeId);
  const currentNode = NODES.find(n => n.id === currentNodeId);

  const handleNavigate = useCallback((dir) => {
    setCurrentNodeId(prev => {
      const ex = getExits(prev);
      if (ex[dir] !== null) return ex[dir];
      return prev;
    });
  }, []);

  // Keyboard handling
  useEffect(() => {
    const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    const held = new Set();

    function getDir() {
      const up    = held.has("ArrowUp");
      const down  = held.has("ArrowDown");
      const left  = held.has("ArrowLeft");
      const right = held.has("ArrowRight");

      if (up   && left)  return "upLeft";
      if (up   && right) return "upRight";
      if (down && left)  return "downLeft";
      if (down && right) return "downRight";
      if (up)            return "up";
      if (down)          return "down";
      return null;
    }

    function applyDir(dir) {
      const blank = { upLeft: false, up: false, upRight: false, downLeft: false, down: false, downRight: false };
      setActiveKeys({ ...blank, ...(dir ? { [dir]: true } : {}) });
      if (dir) handleNavigate(dir);
    }

    const onDown = (e) => {
      if (!ARROW_KEYS.has(e.key)) return;
      e.preventDefault();
      held.add(e.key);
      applyDir(getDir());
    };

    const onUp = (e) => {
      if (!ARROW_KEYS.has(e.key)) return;
      held.delete(e.key);
      const dir = getDir();
      const blank = { upLeft: false, up: false, upRight: false, downLeft: false, down: false, downRight: false };
      setActiveKeys({ ...blank, ...(dir ? { [dir]: true } : {}) });
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [handleNavigate]);

  // ── Boot screen ──
  if (phase === "boot") return (
    <>
      {flashActive && <div className="fixed inset-0 z-50 bg-white" style={{ animation: "flashOut 0.6s forwards" }} />}
      <div className="flex flex-col min-h-screen items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <div className="flex flex-col gap-3 p-8 font-mono text-sm" style={{ color: "var(--foreground)" }}>
          {bootLines.map((line, i) => <p key={i} className="tracking-widest">{line}</p>)}
        </div>
      </div>
      <style>{`@keyframes flashOut { 0%{opacity:0} 20%{opacity:1} 100%{opacity:0} }`}</style>
    </>
  );

  // ── Game UI ──
  return (
    <div className="flex flex-col min-h-screen items-center justify-center"
         style={{ background: "var(--page-bg)", color: "var(--foreground)" }}
    >
      {/* Header */}
      <div className="flex flex-row gap-2 items-center py-2 opacity-40">
        <Image src="/logo.png" width={16} height={16} alt="DATAPORT.exe logo" />
        <p className="font-mono text-xs tracking-widest">DATAPORT.exe</p>
      </div>

      {/* Console frame */}
      <div
        className={`flex flex-col border overflow-hidden ${flicker ? "flicker" : ""}`}
        style={{
          width: "88vw", height: "85vh",
          borderColor: "var(--foreground)",
          borderRadius: "16px",
          background: "var(--background)",
        }}
      >
        {/* Breadcrumb */}
        <div className="flex flex-row items-center px-4 py-2 border-b shrink-0"
             style={{ borderColor: "rgba(69,221,0,0.3)" }}
        >
          <span className="font-mono text-xs tracking-widest">
            KINGSTON 32GB
            <span className="opacity-40 mx-2">›</span>
            <span className="opacity-70">{currentNode?.label ?? "—"}</span>
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-row flex-1 min-h-0">

          {/* LEFT: Nav + Story */}
          <div className="flex flex-col flex-1 min-w-0 border-r" style={{ borderColor: "rgba(69,221,0,0.3)" }}>

            {/* Nav pad */}
            <div className="flex items-center justify-center border-b shrink-0 py-5"
                 style={{ borderColor: "rgba(69,221,0,0.3)" }}
            >
              <NavPad exits={exits} activeKeys={activeKeys} onActivate={handleNavigate} />
            </div>

            {/* Story text */}
            <div className="flex-1 min-h-0 relative">
              <StoryText lines={storyLines} shake={shake} />
              {showNameInput && (
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10"
                     style={{ background: "var(--background)" }}
                >
                  <NameInput onSubmit={handleNameSubmit} />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Map + Options */}
          <div className="flex flex-col shrink-0" style={{ width: "28%" }}>
            <div className="flex-1 min-h-0 border-b" style={{ borderColor: "rgba(69,221,0,0.3)" }}>
              <p className="font-mono text-xs tracking-[0.3em] opacity-30 uppercase text-center pt-3 pb-1">
                Node Map
              </p>
              <div style={{ height: "calc(100% - 32px)" }}>
                <NodeMap currentId={currentNodeId} />
              </div>
            </div>
            <div className="shrink-0" style={{ height: "30%" }}>
              <p className="font-mono text-xs tracking-[0.3em] opacity-30 uppercase text-center pt-3 pb-1">
                Options
              </p>
              <div style={{ height: "calc(100% - 32px)" }}>
                <OptionsPanel options={[]} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .blink { animation: blink 1s step-end infinite; }

        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-6px) translateY(2px); }
          30%     { transform: translateX(6px)  translateY(-2px); }
          45%     { transform: translateX(-4px) translateY(3px); }
          60%     { transform: translateX(4px)  translateY(-1px); }
          75%     { transform: translateX(-2px) translateY(1px); }
        }
        .shake { animation: shake 0.6s ease; }

        @keyframes flicker {
          0%{opacity:0} 10%{opacity:.8} 20%{opacity:.2} 30%{opacity:1}
          40%{opacity:.4} 50%{opacity:.9} 60%{opacity:.3} 70%{opacity:1}
          80%{opacity:.6} 90%{opacity:1} 100%{opacity:1}
        }
        .flicker { animation: flicker 0.8s ease forwards; }
      `}</style>
    </div>
  );
}
