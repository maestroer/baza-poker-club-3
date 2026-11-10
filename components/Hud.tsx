import { SITE } from "@/lib/site";

// Шапка поверх страницы: знак, разделы и кнопка записи.
export default function Hud() {
  return (
    <div className="hud">
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
    </div>
  );
}
