import { Component, Input } from '@angular/core';
import { DashboardRewardsCardData, DashboardTournamentCardData } from '../../models/dashboard.models';
import { DashboardRewardsCardComponent } from '../dashboard-rewards-card/dashboard-rewards-card.component';
import { DashboardTournamentCardComponent } from '../dashboard-tournament-card/dashboard-tournament-card.component';

@Component({
  selector: 'gb-dashboard-cards',
  standalone: true,
  imports: [DashboardTournamentCardComponent, DashboardRewardsCardComponent],
  templateUrl: './dashboard-cards.component.html',
  styleUrl: './dashboard-cards.component.scss'
})
export class DashboardCardsComponent {
  @Input() tournamentCard!: DashboardTournamentCardData;
  @Input() rewardsCard!: DashboardRewardsCardData;
  @Input() orderGold: number[] = [];
}
