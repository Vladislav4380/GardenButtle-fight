import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'gb-dashboard-nav-panel',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './dashboard-nav-panel.component.html',
  styleUrl: './dashboard-nav-panel.component.scss'
})
export class DashboardNavPanelComponent {}
