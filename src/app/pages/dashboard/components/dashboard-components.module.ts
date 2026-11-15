import { NgModule } from '@angular/core';
import { DashboardCardsComponent } from './dashboard-cards/dashboard-cards.component';
import { DashboardGardenCardComponent } from './dashboard-garden-card/dashboard-garden-card.component';
import { DashboardHeaderComponent } from './dashboard-header/dashboard-header.component';
import { DashboardNavPanelComponent } from './dashboard-nav-panel/dashboard-nav-panel.component';
import { DashboardTeamCardComponent } from './dashboard-team-card/dashboard-team-card.component';

@NgModule({
  imports: [
    DashboardHeaderComponent,
    DashboardGardenCardComponent,
    DashboardTeamCardComponent,
    DashboardCardsComponent,
    DashboardNavPanelComponent
  ],
  exports: [
    DashboardHeaderComponent,
    DashboardGardenCardComponent,
    DashboardTeamCardComponent,
    DashboardCardsComponent,
    DashboardNavPanelComponent
  ]
})
export class DashboardComponentsModule {}
