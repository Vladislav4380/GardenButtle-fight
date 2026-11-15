import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardGardenPlotData } from '../../models/dashboard.models';
import { DashboardGardenPlotComponent } from '../dashboard-garden-plot/dashboard-garden-plot.component';

@Component({
  selector: 'gb-dashboard-garden-card',
  standalone: true,
  imports: [DashboardGardenPlotComponent],
  templateUrl: './dashboard-garden-card.component.html',
  styleUrl: './dashboard-garden-card.component.scss'
})
export class DashboardGardenCardComponent {
  constructor(private readonly router: Router) {}

  @Input() title = '';
  @Input() iconSrc = '';
  @Input() summaryText = '';
  @Input() plots: DashboardGardenPlotData[] = [];

  openGarden(): void {
    void this.router.navigateByUrl('/garden');
  }
}
