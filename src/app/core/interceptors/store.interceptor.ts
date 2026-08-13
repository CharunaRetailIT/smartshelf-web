import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { SettingsService } from '../services/settings.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl || 'https://localhost:44321/api';

export const storeInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const settingsService = inject(SettingsService);
  const store = settingsService.getCurrentDefaultStore();

  if (!store || !req.url.startsWith(API_URL) || req.params.has('storeId')) {
    return next(req);
  }

  return next(req.clone({ params: req.params.set('storeId', store.id) }));
};
