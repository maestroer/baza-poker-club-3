"use client";

import { useEffect, useRef, useState } from "react";
import { emit } from "@/lib/bus";
import { SITE } from "@/lib/site";

// «Кадр» поверх страницы: угловые метки, шапка, полоса прогресса со счётчиком сцен
// и два переключателя — чертёж и звук.
const BEATS: [cue: string, name: string][] = [
  ["hero", "Заставка"],
  ["stage", "Раздача"],
  ["nocash", "Правило"],
  ["format", "Формат"],
  ["menu", "Меню"],
  ["signup", "Запись"],
];

const pad = (n: number) => String(n).padStart(2, "0");

export default function Hud() {
  const root = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState(0);
  const [blueprint, setBlueprint] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const sections = BEATS.map(([cue]) => document.querySelector<HTMLElement>(`[data-cue="${cue}"]`));
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.current?.style.setProperty("--p", (max > 0 ? window.scrollY / max : 0).toFixed(4));
      const mid = window.innerHeight * 0.5;
      let current = 0;
      sections.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= mid) current = i;
      });
      setBeat(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toggleBlueprint = () => {
    setBlueprint((v) => {
      emit("blueprint", !v);
      return !v;
    });
  };

  const toggleSound = () => {
    setSound((v) => {
      emit("gesture"); // браузеры разрешают звук только после жеста
      emit("sound", !v);
      return !v;
    });
  };

  return (
    <div className="hud" ref={root}>
      <i className="corner corner-tl" aria-hidden="true" />
      <i className="corner corner-tr" aria-hidden="true" />
      <i className="corner corner-bl" aria-hidden="true" />
      <i className="corner corner-br" aria-hidden="true" />

      <header className="hud-top">
        <a href="#top" className="brand">
          <span className="brand-mark" aria-hidden="true">
            {SITE.mark}
          </span>
          {SITE.name}
        </a>

        <nav className="nav" aria-label="Разделы">
          <a href="#nocash">О клубе</a>
          <a href="#format">Формат</a>
          <a href="#menu">Меню</a>
        </nav>

        <a href="#signup" className="btn btn-primary">
          Записаться
        </a>
      </header>

      <div className="hud-bottom">
        <div className="hud-tools">
          <button type="button" className="chip-btn" aria-pressed={blueprint} onClick={toggleBlueprint}>
            Чертёж
          </button>
          <button type="button" className="chip-btn" aria-pressed={sound} onClick={toggleSound}>
            Звук
          </button>
        </div>
        <div className="hud-track" aria-hidden="true">
          <i />
        </div>
        <p className="hud-beat" aria-hidden="true">
          <span>{BEATS[beat][1]}</span>
          <b>
            {pad(beat + 1)} / {pad(BEATS.length)}
          </b>
        </p>
      </div>
    </div>
  );
}
