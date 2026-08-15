import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { storeInterceptor } from './core/interceptors/store.interceptor';
import {
  provideAnimations,
  provideNoopAnimations,
} from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { SmartEslPreset } from './theme/smart-esl-preset';
import { ConfirmationService, MessageService } from 'primeng/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, storeInterceptor]),
    ),
    provideNoopAnimations(), // Add this line for no animations
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: SmartEslPreset,
        options: {
          darkModeSelector: '.my-app-dark',
        },
      },
    }),
    MessageService,
    // Confirmations are rendered by the single <p-confirmDialog> in
    // MainLayout, so any page can call confirm() without providing its own
    // service or remembering to add the element to its template.
    ConfirmationService,
  ],
};
