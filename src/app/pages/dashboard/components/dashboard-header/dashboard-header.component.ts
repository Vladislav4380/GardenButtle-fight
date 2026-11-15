import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'gb-dashboard-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.scss'
})
export class DashboardHeaderComponent {
  @Input() playerName = '';
  @Input() avatarCode = 'young_gardener';
  @Input() coins = 0;
  @Input() gems = 0;
  @Input() xpCurrent = 0;
  @Input() xpTarget = 0;
  // Here: gems = the battle glory, xp = the gardener's glory (points / the next title's points) and its title.
  @Input() xpTitle = '';

  private readonly avatarPreviewByCode: Record<string, string> = {
    young_gardener: 'assets/ui/avatars/young-gardener-preview.webp',
    forest_druid: 'assets/ui/avatars/forest-druid-preview.webp',
    harvest_guardian: 'assets/ui/avatars/harvest-guardian-preview.webp',
    season_traveler: 'assets/ui/avatars/season-traveler-preview.webp',
    garden_apprentice: 'assets/ui/avatars/young-gardener-preview.webp',
    elder_grove: 'assets/ui/avatars/forest-druid-preview.webp'
  };

  get avatarPreviewSrc(): string {
    return this.avatarPreviewByCode[this.avatarCode]
      ?? this.avatarPreviewByCode['young_gardener'];
  }

  get xpText(): string {
    return `${this.xpCurrent}/${this.xpTarget}`;
  }

  get xpProgressPercent(): number {
    if (this.xpTarget <= 0) {
      return 0;
    }

    return Math.max(0, Math.min((this.xpCurrent / this.xpTarget) * 100, 100));
  }
}
