"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAppState } from "@/store/AppContext";
import { getUserPicks } from "@/sim/engine";

const OUTCOME_LABEL = { HOME: "Home win", DRAW: "Draw", AWAY: "Away win" } as const;

export default function PredictionCard() {
  const state = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const picks = getUserPicks(state);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 720;
    const H = 960;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b3d2b");
    bg.addColorStop(1, "#04140d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e0b53f";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("MatchPick", 40, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 24px sans-serif";
    ctx.fillText(`Season ${state.season} · Matchday ${state.currentMatchdayIndex + 1}`, 40, 120);

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(40, 145);
    ctx.lineTo(W - 40, 145);
    ctx.stroke();

    const rows = state.matchday.fixtures.map((fixture) => ({
      fixture,
      pick: picks.find((p) => p.fixtureId === fixture.id),
    }));

    let y = 200;
    for (const { fixture, pick } of rows) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(40, y - 34, W - 80, 64);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 22px sans-serif";
      ctx.fillText(`${fixture.home} vs ${fixture.away}`, 60, y);

      ctx.fillStyle = pick ? "#e0b53f" : "rgba(255,255,255,0.4)";
      ctx.font = "bold 20px sans-serif";
      const label = pick
        ? `${OUTCOME_LABEL[pick.outcome]}${pick.exactScore ? ` (${pick.exactScore.home}-${pick.exactScore.away})` : ""}`
        : "No pick";
      const metrics = ctx.measureText(label);
      ctx.fillText(label, W - 60 - metrics.width, y);

      y += 84;
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "18px sans-serif";
    ctx.fillText(state.user.address, 40, H - 50);
    ctx.textAlign = "right";
    ctx.fillText("minipay.app/matchpick", W - 40, H - 50);
    ctx.textAlign = "left";

    setImageUrl(canvas.toDataURL("image/png"));
  }

  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Prediction card</h3>
        <span className="text-[11px] text-ink-soft">{picks.length}/8 picks</span>
      </div>
      <p className="mb-3 text-xs text-ink-soft">Turn this matchday&apos;s picks into a shareable image.</p>

      {imageUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Your MatchPick prediction card" className="w-full rounded-xl border border-ink/10" />
          <a
            href={imageUrl}
            download="matchpick-prediction-card.png"
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-pitch-800 py-2.5 text-center text-xs font-bold text-white active:scale-[0.98]"
          >
            <Download size={14} /> Download card
          </a>
        </div>
      ) : (
        <button
          type="button"
          disabled={picks.length === 0}
          onClick={draw}
          className="w-full rounded-full border border-pitch-700 py-2.5 text-xs font-bold text-pitch-800 disabled:opacity-40"
        >
          {picks.length === 0 ? "Make picks to generate a card" : "Generate card"}
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
