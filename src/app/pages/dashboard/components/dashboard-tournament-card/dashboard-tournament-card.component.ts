import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'gb-dashboard-tournament-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-tournament-card.component.html',
  styleUrl: './dashboard-tournament-card.component.scss'
})
export class DashboardTournamentCardComponent {
  @Input() leagueName = '';
  @Input() playerPlace = 0;
  @Input() participantsCount = 0;
}
