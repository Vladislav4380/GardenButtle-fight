import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'gb-dashboard-rewards-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-rewards-card.component.html',
  styleUrl: './dashboard-rewards-card.component.scss'
})
export class DashboardRewardsCardComponent {
  @Input() coins = 0;
  @Input() gems = 0;
  @Input() cards = 0;
  // Here: the gold of each order on the board (up to three).
  @Input() orderGold: number[] = [];
  @Input() chestProgressCurrent = 0;
  @Input() chestProgressTarget = 0;

  get chestProgressPercent(): number {
    if (this.chestProgressTarget <= 0) {
      return 0;
    }

    const percent = (this.chestProgressCurrent / this.chestProgressTarget) * 100;
    return Math.max(0, Math.min(percent, 100));
  }
}
