"use client";

import { useEffect, useRef, useState } from "react";
import { on } from "@/lib/bus";
import { SITE } from "@/lib/site";
import type { Engine, Callout } from "@/lib/engine/Engine";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

const CALLOUTS: { key: Callout["key"]; side: Callout["side"]; title: string; note: string }[] = [
  { key: "chips", side: "l", title: "Турнирные фишки", note: "39 мм · без денежного номинала" },
  { key: "cards", side: "r", title: "Карманные короли", note: "K♠ K♥ · вторая по силе рука" },
  { key: "allin", side: "r", title: "Кнопка ALL-IN", note: "86 мм · эмаль и золото" },
];

/** Один фиксированный холст позади страницы + всё, что движок двигает в DOM. */
export default function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let engine: Engine | null = null;
    let dead = false;

    const captions = Array.from(document.querySelectorAll<HTMLElement>("[data-cap]")).map((el) => ({
      el,
      from: Number(el.dataset.from),
      to: Number(el.dataset.to),
    }));
    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const hint = document.querySelector<HTMLElement>("[data-hint]");
    let lastY = -1;

    // Появление текста считаем от позиции скролла, а не через IntersectionObserver:
    // на тяжёлых кадрах наблюдатели пропускают срабатывания.
    const reveal = (y: number) => {
      if (y === lastY) return;
      lastY = y;
      const limit = window.innerHeight * 0.88;
      for (const el of reveals) {
        if (!el.classList.contains("in") && el.getBoundingClientRect().top < limit) el.classList.add("in");
      }
      if (hint) hint.style.opacity = y > 40 ? "0" : "1";
    };

    (async () => {
      try {
        const { Engine } = await import("@/lib/engine/Engine");
        // Знак на фишках и логотип на столе рисуются шрифтом сайта — ждём, пока он загрузится
        await document.fonts.ready;
        if (dead || !canvasRef.current) return;
        engine = new Engine(canvasRef.current);

        const overlay = overlayRef.current!;
        engine.setCallouts(
          CALLOUTS.map((c) => ({
            key: c.key,
            side: c.side,
            el: overlay.querySelector<HTMLElement>(`[data-callout="${c.key}"]`)!,
            line: overlay.querySelector<SVGLineElement>(`[data-line="${c.key}"]`)!,
          })),
        );

        engine.onFrame = ({ seq, scrollY }) => {
          for (const c of captions) {
            const o = smooth(clamp01((seq - c.from) / 0.03)) * (1 - smooth(clamp01((seq - (c.to - 0.03)) / 0.03)));
            c.el.style.opacity = o.toFixed(3);
            c.el.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
          }
          reveal(scrollY);
        };

        await engine.ready();
        if (dead) return;
        engine.start();
        setReady(true);
      } catch (err) {
        console.error(err);
        setFailed(true);
        setReady(true);
        document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
      }
    })();

    const offs = [
      on("sound", (v) => engine?.setSound(v)),
      on("blueprint", (v) => engine?.setBlueprint(v)),
      on("burst", () => engine?.burst()),
      on("gesture", () => engine?.enableTilt()),
    ];

    return () => {
      dead = true;
      offs.forEach((off) => off());
      engine?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="scene-canvas" aria-hidden="true" />
      {failed && <div className="scene-fallback" aria-hidden="true" />}

      <div ref={overlayRef} className="callouts" aria-hidden="true">
        <svg className="callout-lines">
          {CALLOUTS.map((c) => (
            <line key={c.key} data-line={c.key} />
          ))}
        </svg>
        {CALLOUTS.map((c) => (
          <div key={c.key} data-callout={c.key} className={`callout callout-${c.side}`}>
            <b>{c.title}</b>
            <span>{c.note}</span>
          </div>
        ))}
      </div>

      <div className={`loader ${ready ? "loader-done" : ""}`} aria-hidden={ready}>
        <span className="loader-name">{SITE.name}</span>
        <span className="loader-bar" />
      </div>
    </>
  );
}
