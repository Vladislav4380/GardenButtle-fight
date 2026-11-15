import { Routes } from '@angular/router';
export const routes: Routes = [
 // The game opens on the splash: then the welcome and the keeper on the first entry, the main screen after. The
 // list of all test scenes (for development) lives at /catalog.
 { path: '', pathMatch: 'full', redirectTo: 'splash' },
 { path: 'splash', loadComponent: () => import('./pages/start/splash.page').then(m => m.SplashPage) },
 { path: 'welcome', loadComponent: () => import('./pages/start/welcome.page').then(m => m.WelcomePage) },
 { path: 'keeper', loadComponent: () => import('./pages/start/keeper.page').then(m => m.KeeperPage) },
 // The main screen: the first version's dashboard filled with this game's things.
 { path: 'main', loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage) },
 { path: 'glory', loadComponent: () => import('./pages/start/glory.page').then(m => m.GloryPage) },
 { path: 'catalog', loadComponent: () => import('./pages/home.page').then(m => m.HomePage) },
 { path: 'garden', data: { scene: 'garden' }, loadComponent: () => import('./pages/canvas-scene.page').then(m => m.CanvasScenePage) },
 { path: 'duels/:id', loadComponent: () => import('./pages/canvas-scene.page').then(m => m.CanvasScenePage) },
 { path: 'figures', loadComponent: () => import('./pages/figures/app').then(m => m.App) },
 { path: 'fight', loadComponent: () => import('./pages/fight/fight.page').then(m => m.FightPage) },
 { path: 'attack-preview', loadComponent: () => import('./pages/attack-preview/attack-preview.page').then(m => m.AttackPreviewPage) },
 { path: 'movement-preview', loadComponent: () => import('./pages/movement-preview/movement-preview.page').then(m => m.MovementPreviewPage) },
 { path: 'movement-route-preview', loadComponent: () => import('./pages/movement-route-preview/movement-route-preview.page').then(m => m.MovementRoutePreviewPage) },
 { path: 'movement-circle-preview', loadComponent: () => import('./pages/movement-circle-preview/movement-circle-preview.page').then(m => m.MovementCirclePreviewPage) },
 { path: 'movement-octagon-3d-preview', loadComponent: () => import('./pages/movement-octagon-3d-preview/movement-octagon-3d-preview.page').then(m => m.MovementOctagon3dPreviewPage) },
 { path: 'carrot-action-preview', loadComponent: () => import('./pages/carrot-action-preview/carrot-action-preview.page').then(m => m.CarrotActionPreviewPage) },
 { path: 'rigged-model-preview', loadComponent: () => import('./pages/rigged-model-preview/rigged-model-preview.page').then(m => m.RiggedModelPreviewPage) },
 { path: 'character-equipment-assembler', loadComponent: () => import('./pages/character-equipment-assembler/character-equipment-assembler.page').then(m => m.CharacterEquipmentAssemblerPage) },
 { path: 'battle-3d-lab', loadComponent: () => import('./pages/battle-3d-lab/battle-3d-lab.page').then(m => m.Battle3dLabPage) },
 { path: 'carrot-animation-normalizer', loadComponent: () => import('./pages/carrot-animation-normalizer/carrot-animation-normalizer.page').then(m => m.CarrotAnimationNormalizerPage) },
 { path: 'battle-3d-3x3', data: { teamSize: 3 }, loadComponent: () => import('./pages/battle-3d-lab/battle-3d-lab.page').then(m => m.Battle3dLabPage) },
 { path: '**', redirectTo: '' }
];
