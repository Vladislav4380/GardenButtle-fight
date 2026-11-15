import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { DashboardComponentsModule } from './components/dashboard-components.module';
import {
  DashboardGardenCardData,
  DashboardGardenPlotData,
  DashboardHeaderData,
  DashboardRewardsCardData,
  DashboardTeamCardData,
  DashboardTournamentCardData,
} from './models/dashboard.models';
import { Summary, loadProfile, summary } from '../../data/player';
import { BATTLE } from '../start/glory.page';

// The main screen: the first version's dashboard (its components, styles and pictures as they were) filled with
// this game's things — the keeper and his name, gold, both glories (the battle's in the gem slot, the gardener's in
// the level bar), the first beds of the garden, the army in the barn with «В бой!», the battle table's place and the
// order board — read from the scenes' saves in this browser.
const NAMES: Record<string, string> = {
  tomato: 'Помидор', carrot: 'Морковь', potato: 'Картофель', peach: 'Персик', onion: 'Лук', corn: 'Кукуруза',
  pepper: 'Перец', beet: 'Свёкла', zucchini: 'Кабачок', walnut: 'Орех', eggplant: 'Баклажан', cucumber: 'Огурец',
  cabbage: 'Капуста', grape: 'Виноград', pineapple: 'Ананас', banana: 'Банан', cherry: 'Вишня', parsley: 'Петрушка', dill: 'Укроп',
};
// The garden's pictures of a crop's warrior (growing stage 1–3); the six starting crops have them.
const ART = new Set(['tomato', 'carrot', 'potato', 'peach', 'onion', 'corn']);
const warrior = (crop: string, stage: number) => (ART.has(crop) ? `assets/garden/obj/w-${crop}-${stage}.png` : '');

@Component({
  selector: 'gb-dashboard',
  standalone: true,
  imports: [IonContent, DashboardComponentsModule],
  host: { class: 'ion-page' },
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  dashboardScale = 1;
  private readonly designWidth = 390;
  private readonly designHeight = 844;
  private timer?: number;

  header!: DashboardHeaderData & { xpTitle: string };
  gardenCard!: DashboardGardenCardData;
  teamCard!: DashboardTeamCardData;
  tournamentCard!: DashboardTournamentCardData;
  rewardsCard!: DashboardRewardsCardData;
  orderGold: number[] = [];

  constructor() {
    this.fill();
  }

  ngOnInit(): void {
    if (!loadProfile()) void this.router.navigateByUrl('/welcome', { replaceUrl: true });
    this.updateDashboardScale();
    // Beds ripen while the screen is open.
    this.timer = window.setInterval(() => this.fill(), 5000);
  }
  ngOnDestroy(): void {
    window.clearInterval(this.timer);
  }

  private fill(): void {
    const s: Summary = summary(),
      profile = loadProfile();
    this.header = {
      playerName: profile?.name || 'Хранитель',
      avatarCode: profile?.keeper || 'young_gardener',
      coins: s.gold,
      gems: s.battle.points,
      xpCurrent: s.garden.points,
      xpTarget: s.garden.nextAt,
      xpTitle: s.garden.title,
    };
    // The first four sown beds as the garden's plots: ripe — «Готово!», growing — the time left.
    const plots: DashboardGardenPlotData[] = s.beds.slice(0, 4).map((b, i) => ({
      id: i,
      slot: i + 1,
      state: b.leftMin ? 'growing' : 'ready',
      imageUrl: warrior(b.crop, b.leftMin ? 2 : 3),
      statusText: b.leftMin ? (b.leftMin >= 60 ? `${Math.floor(b.leftMin / 60)}ч ${b.leftMin % 60}м` : `${b.leftMin} мин`) : 'Готово!',
    }));
    while (plots.length < 4) plots.push({ id: 'free' + plots.length, slot: plots.length + 1, state: 'empty', statusText: 'Пусто' });
    this.gardenCard = {
      title: 'ОГОРОД',
      iconSrc: 'assets/ui/hud/hud-nav-garden.png',
      summaryText: s.beds.length ? `Созрело ${s.ripe} из ${s.beds.length}` : 'Посадите семена',
      plots,
    };
    // The army: the three crops most of in the barn (with six or more fighters in it).
    const top = Object.entries(s.barn)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    this.teamCard = {
      title: 'АРМИЯ',
      iconSrc: 'assets/ui/hud/hud-battle-swords.png',
      summaryText: `В амбаре ${s.army}`,
      members:
        s.army >= 6 && top.length === 3
          ? top.map(([crop, n], i) => ({ id: crop, slot: i + 1, state: 'empty', imageUrl: warrior(crop, 3), statusText: `${NAMES[crop] || crop} ×${n}` }))
          : [],
    };
    // The battle table (made up until the server): the player's place by his battle glory.
    const place = BATTLE.filter((r) => r.points > s.battle.points).length + 1;
    this.tournamentCard = { leagueName: `${s.battle.title} · ${s.battle.points}`, playerPlace: place, participantsCount: BATTLE.length + 1 };
    this.orderGold = s.orderGold.slice(0, 3);
    this.rewardsCard = { coins: 0, gems: 0, cards: 0, chestProgressCurrent: s.ordersReady, chestProgressTarget: s.orders };
  }

  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  updateDashboardScale(): void {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const scale = Math.min(width / this.designWidth, height / this.designHeight);
    this.dashboardScale = Number(Math.max(0.75, Math.min(scale, 1.15)).toFixed(4));
  }
}
