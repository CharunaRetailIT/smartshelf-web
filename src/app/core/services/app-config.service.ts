import { HttpClient } from "@angular/common/http";
import { AppConfig } from "../interfaces/app-config.interface";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config!: AppConfig;

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      this.config = await firstValueFrom(
        this.http.get<AppConfig>('assets/config.json') // relative path
      );
    } catch (err) {
      console.error('Failed to load config.json', err);
      throw err;
    }
  }

  getConfig(): AppConfig {
    if (!this.config) throw new Error('Config not loaded yet!');
    return this.config;
  }
}
