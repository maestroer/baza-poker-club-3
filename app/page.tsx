import Hud from "@/components/Hud";
import Scene from "@/components/Scene";
import SignupForm from "@/components/SignupForm";
import { MENU } from "@/lib/menu";
import { SITE } from "@/lib/site";

// Тексты шагов ниже — заглушки для макета. Меню и цены — в lib/menu.ts.
const STEPS = [
  { n: "01", title: "Записываетесь", text: "Выбираете вечер и оставляете контакт. Мест за столами ограниченное число." },
  { n: "02", title: "Получаете стек", text: "У всех игроков одинаковый стартовый набор турнирных фишек." },
  { n: "03", title: "Играете турнир", text: "Техасский холдем с дилером и блайндами по таймеру. Выбыли — можно остаться в зале." },
  { n: "04", title: "Растёте в рейтинге", text: "За каждое место начисляются очки. Таблица сезона обновляется после каждой игры." },
];

/** Номер и название раздела — как шаг в раскадровке. */
function Head({ n, label }: { n: string; label: string }) {
  return (
    <div className="sec-head">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

export default function Home() {
  const [featured, ...groups] = MENU;

  return (
    <main className="page" id="top">
      <Scene />
      <Hud />

      <div className="story">
        {/* Заставка */}
        <section className="hero" data-cue="hero">
          <div className="hero-copy">
            <p className="eyebrow">{SITE.tagline}</p>
            <h1 className="hero-title">
              {SITE.title.map((part) => (
                <span key={part.text} className={part.style}>
                  {part.text}
                </span>
              ))}
            </h1>
            <p className="hero-lead">
              Турнирный холдем как спорт: стратегия, рейтинг и живая игра за одним столом. Играем{" "}
              <em className="ink">не на деньги.</em>
            </p>
            <ul className="tags">
              {SITE.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <a href="#signup" className="btn btn-primary btn-big">
              Записаться на игру <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        {/* 3D-сцена: фишки, короли, ALL-IN. Высота секции — длина «фильма». */}
        <section className="stage" data-cue="stage" aria-label="Раздача">
          <div className="stage-pin">
            <div className="cap" data-cap data-from="0.56" data-to="0.75">
              <h2>
                Два <em className="ink">короля.</em>
              </h2>
              <p>Вторая по силе стартовая рука в холдеме. Сыграть её правильно — уже мастерство.</p>
            </div>
            <div className="cap" data-cap data-from="0.8" data-to="0.915">
              <h2>
                <em className="ink">All-in.</em>
              </h2>
              <p>Самое громкое слово за столом. На кону — только рейтинг.</p>
            </div>
          </div>
        </section>

        {/* Не на деньги */}
        <section className="panel panel-left" data-cue="nocash" id="nocash">
          <div className="panel-body plate" data-reveal>
            <Head n="01" label="Главное правило" />
            <h2>
              Игра идёт <em className="ink">не на деньги.</em>
            </h2>
            <p className="lead">
              Спортивный покер — это турнир, а не казино. Фишки не имеют денежной стоимости: их нельзя купить, продать
              или обменять. Мы не принимаем ставки и не разыгрываем денежные призы.
            </p>
            <ul className="facts">
              <li>
                <b>0 ₽</b>
                <span>ставок за столом</span>
              </li>
              <li>
                <b>Рейтинг</b>
                <span>вместо банка</span>
              </li>
              <li>
                <b>18+</b>
                <span>вход для взрослых</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Формат */}
        <section className="panel panel-right" data-cue="format" id="format">
          <div className="panel-body plate" data-reveal>
            <Head n="02" label="Как проходит вечер" />
            <h2>
              Четыре шага до <em className="ink">финального стола.</em>
            </h2>
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Меню */}
        <section className="panel panel-left" data-cue="menu" id="menu">
          <div className="panel-body panel-body-wide plate" data-reveal>
            <Head n="03" label="Бар и кальян" />
            <h2>
              Кальян, чай и всё <em className="ink">к столу.</em>
            </h2>
            <div className="menu">
              <div className="menu-group menu-featured">
                <h3>{featured.title}</h3>
                <p className="menu-price">{featured.items[0][2]}</p>
                <p className="menu-note">Подаём прямо к столу, чтобы не отвлекаться от раздачи.</p>
              </div>
              {groups.map((group) => (
                <div key={group.title} className="menu-group">
                  <h3>{group.title}</h3>
                  <ul>
                    {group.items.map(([name, note, price]) => (
                      <li key={name + note}>
                        <span>
                          {name}
                          {note && <small>{note}</small>}
                        </span>
                        <b>{price}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Запись */}
        <section className="panel panel-right" data-cue="signup" id="signup">
          <div className="panel-body plate" data-reveal>
            <Head n="04" label="Запись на игру" />
            <h2>
              Займите место <em className="ink">за столом.</em>
            </h2>
            <p className="lead">
              Выберите формат, укажите имя и ник — кнопка откроет чат с менеджером с готовым сообщением. Опыт не
              обязателен: правила объясним.
            </p>
            <SignupForm />
          </div>
        </section>

        <footer className="footer" data-cue="footer">
          <div className="footer-top">
            <div>
              <p className="footer-name">{SITE.name}</p>
              <p className="eyebrow">{SITE.tagline}</p>
            </div>
            <dl className="footer-info">
              <div>
                <dt>Адрес</dt>
                <dd>
                  {SITE.city}, {SITE.address}
                </dd>
              </div>
              <div>
                <dt>Часы</dt>
                <dd>{SITE.hours}</dd>
              </div>
              <div>
                <dt>Связь</dt>
                <dd>
                  {SITE.phone} · {SITE.telegram}
                </dd>
              </div>
            </dl>
          </div>
          <p className="legal">
            Клуб не организует и не проводит азартные игры. Игра ведётся на турнирные фишки без денежного эквивалента,
            денежные ставки и выигрыши отсутствуют. 18+
          </p>
        </footer>
      </div>
    </main>
  );
}
