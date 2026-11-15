import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardTeamMemberData } from '../../models/dashboard.models';
import { DashboardGardenPlotComponent } from '../dashboard-garden-plot/dashboard-garden-plot.component';

@Component({
  selector: 'gb-dashboard-team-card',
  standalone: true,
  imports: [DashboardGardenPlotComponent],
  templateUrl: './dashboard-team-card.component.html',
  styleUrl: './dashboard-team-card.component.scss'
})
export class DashboardTeamCardComponent {
  private readonly router = inject(Router);

  @Input() title = '';
  @Input() iconSrc = '';
  @Input() summaryText = '';
  @Input() members: DashboardTeamMemberData[] = [];

  openTeam(): void {
    void this.router.navigateByUrl('/garden');
  }

  startBattle(): void {
    if (this.members.length === 3) {
      void this.router.navigateByUrl('/duels/tft-6x6?from=garden');
    }
  }
}
