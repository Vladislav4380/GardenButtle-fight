import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { battleTitle, gardenTitle, loadProfile, seasonDaysLeft, summary } from '../../data/player';

export interface Row {
  name: string;
  points: number;
  me?: boolean;
}

// The glory tables: «Бой» (battle glory) and «Огород» (the gardener's glory). No server yet: the other players are
// made up (fixed names and points), the player stands among them by his real points, marked. Season of 4 weeks.
// Opened from the main screen, from the gardener's glory in the garden, from the battle glory in the battle.
export const BATTLE: Row[] = [
  ['Полководец Тыква', 6240], ['Морковкин', 5120], ['Лук_Стрелок', 4380], ['Ольга', 3910], ['Северный Ветер', 3340],
  ['Тимур', 2870], ['Баклажан Грозный', 2410], ['Варя', 2050], ['Капитан Кабачок', 1720], ['Димон', 1490],
  ['Хрустящий', 1260], ['Анастасия', 1030], ['Редиска', 880], ['Огородный Рыцарь', 720], ['Мария', 590],
  ['Сашка', 470], ['Бобовый', 360], ['Илья', 280], ['Помидорка', 210], ['Кирилл', 150],
  ['Тихий Укроп', 100], ['Лена', 70], ['Новичок_77', 40], ['Петрушка', 20],
].map(([name, points]) => ({ name: name as string, points: points as number }));
export const GARDEN: Row[] = [
  ['Бабушка Груша', 7420], ['Агроном Петрович', 6610], ['Мастер Тыкв', 5830], ['Светлана', 5080], ['Зелёный Палец', 4460],
  ['Огуречник', 3870], ['Нина', 3320], ['Садовод Саня', 2890], ['Капустный Король', 2440], ['Алёна', 2010],
  ['Грядкин', 1690], ['Виктор', 1380], ['Росинка', 1120], ['Тёма', 900], ['Ромашка', 720],
  ['Женя', 560], ['Подсолнух', 430], ['Глеб', 320], ['Вишенка', 230], ['Олег', 160],
  ['Семечко', 100], ['Даша', 60], ['Новичок_77', 30], ['Колосок', 10],
].map(([name, points]) => ({ name: name as string, points: points as number }));

@Component({
  standalone: true,
  template: `<div class="gb-screen glory">
    <div class="gb-body">
      <h1 class="gb-title">Слава</h1>
      <p class="gb-sub">Сезон 4 недели · до конца {{ days }} {{ dayWord(days) }}</p>
      <div class="tabs">
        <button [class.on]="tab === 'battle'" (click)="show('battle')">⚔ Бой</button>
        <button [class.on]="tab === 'garden'" (click)="show('garden')">🌾 Огород</button>
      </div>
      <p class="mine gb-panel">
        <span class="gb-chip">{{ tab === 'battle' ? '⚔' : '🌾' }} {{ myPoints }} · {{ myTitle }}</span>
        <span>{{ place === 1 ? 'Ты на 1-м месте!' : 'Ты на ' + place + '-м месте, до ' + (place - 1) + '-го ' + gap + ' ' + pointWord(gap) }}</span>
      </p>
      <ol class="table gb-panel">
        @for (r of rows; track $index) {
          <li [class.me]="r.me" [attr.id]="r.me ? 'me' : null">
            <b>{{ $index + 1 }}</b><span class="nm">{{ r.name }}</span><small>{{ title(r.points) }}</small><em>{{ r.points }}</em>
          </li>
        }
      </ol>
      <p class="note">Пока это пример: настоящие таблицы (друзья, твой чат) появятся с сервером.</p>
      <button class="gb-btn wood" (click)="back()">← Назад</button>
    </div>
  </div>`,
  styles: [`.glory{background:radial-gradient(circle at 50% 0,#3a2a14,var(--wood-900) 70%)}
    .tabs{display:flex;gap:8px;margin:12px 0 8px}.tabs button{flex:1;height:42px;border-radius:12px;border:2px solid var(--bronze);background:var(--wood-700);color:var(--parch);font:800 15px system-ui}
    .tabs button.on{background:linear-gradient(#ffe794,#f0a531);color:var(--ink);border-color:var(--gold-shadow)}
    .mine{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 8px;padding:8px 10px;font:700 14px system-ui;text-align:center}
    .table{flex:1;min-height:0;overflow-y:auto;margin:0 0 8px;padding:6px;list-style:none;overscroll-behavior:contain}
    .table li{display:grid;grid-template-columns:28px 1fr auto 56px;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;font:600 14px system-ui}
    .table li:nth-child(odd){background:#0000002e}.table b{color:var(--muted);text-align:right}.table small{color:var(--muted);font-size:12px}
    .table em{font-style:normal;font-weight:900;color:var(--gold);text-align:right}.nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .table li.me{background:linear-gradient(#ffe794,#f0a531);color:var(--ink)}.table li.me b,.table li.me small,.table li.me em{color:var(--ink)}
    .note{margin:0 0 8px;text-align:center;font:600 12px system-ui;color:var(--muted)}
    /* Sideways: the title, the tabs, the player's place and the back button on the left, the table on the right. */
    @media (orientation:landscape) and (max-height:760px){.gb-body{display:grid;grid-template-columns:minmax(240px,40%) 1fr;grid-template-rows:auto auto auto auto 1fr auto;column-gap:14px;padding-top:calc(var(--safe-top,0px) + 10px)}
      .gb-title,.gb-sub,.tabs,.mine,.note,.gb-btn{grid-column:1}.gb-title{font-size:24px;margin:0}.tabs{margin:8px 0 6px}
      .table{grid-column:2;grid-row:1/7;margin:0}.note{align-self:end}}`],
})
export class GloryPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly days = seasonDaysLeft();
  tab: 'battle' | 'garden' = this.route.snapshot.queryParamMap.get('tab') === 'garden' ? 'garden' : 'battle';
  rows: Row[] = [];
  place = 1;
  gap = 0;
  myPoints = 0;
  myTitle = '';

  constructor() {
    this.build();
  }
  show(tab: 'battle' | 'garden'): void {
    this.tab = tab;
    this.build();
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }
  title(n: number): string {
    return this.tab === 'battle' ? battleTitle(n) : gardenTitle(n);
  }
  // The table with the player put in by his points (ahead of those with as many).
  private build(): void {
    const s = summary(),
      g = this.tab === 'battle' ? s.battle : s.garden,
      me: Row = { name: loadProfile()?.name || 'Ты', points: g.points, me: true };
    this.rows = [...(this.tab === 'battle' ? BATTLE : GARDEN), me].sort((a, b) => b.points - a.points || (a.me ? -1 : b.me ? 1 : 0));
    this.place = this.rows.indexOf(me) + 1;
    this.gap = this.place > 1 ? this.rows[this.place - 2].points - me.points + 1 : 0;
    this.myPoints = g.points;
    this.myTitle = g.title;
    // The player's own row in sight.
    setTimeout(() => document.getElementById('me')?.scrollIntoView({ block: 'center' }), 0);
  }
  dayWord(n: number): string {
    const d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? 'день' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'дня' : 'дней';
  }
  pointWord(n: number): string {
    const d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? 'очко' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'очка' : 'очков';
  }
  back(): void {
    if (history.length > 1) history.back();
    else void this.router.navigateByUrl('/main');
  }
}
