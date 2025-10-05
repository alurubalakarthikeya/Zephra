// Backend Mode Manager - Handles switching between API and Mock data
import DataProvider from './DataProvider';
import { config } from '../config/api';

export type BackendMode = 'api' | 'mock';

export interface BackendState {
  mode: BackendMode;
  switchedAt: string;
  switchCount: number;
}

class BackendModeManager {
  private static instance: BackendModeManager;
  private currentMode: BackendMode = 'api';
  private mockService: DataProvider;
  private readonly STORAGE_KEY = 'zephra_backend_mode_global';

  private constructor() {
    this.mockService = DataProvider.getInstance();
    this.loadStoredMode();
  }

  public static getInstance(): BackendModeManager {
    if (!BackendModeManager.instance) {
      BackendModeManager.instance = new BackendModeManager();
    }
    return BackendModeManager.instance;
  }

  private loadStoredMode(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state: BackendState = JSON.parse(stored);
        this.currentMode = state.mode;
      }
    } catch (error) {
      console.warn('Failed to load stored backend mode:', error);
    }
  }

  private saveMode(): void {
    try {
      const state: BackendState = {
        mode: this.currentMode,
        switchedAt: new Date().toISOString(),
        switchCount: this.getSwitchCount() + 1
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save backend mode:', error);
    }
  }

  public getCurrentMode(): BackendMode {
    return this.currentMode;
  }

  public toggleMode(): BackendMode {
    const previousMode = this.currentMode;
    this.currentMode = this.currentMode === 'api' ? 'mock' : 'api';
    this.saveMode();
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('backendModeChanged', { 
      detail: { mode: this.currentMode, previousMode } 
    }));
    
    return this.currentMode;
  }

  private getSwitchCount(): number {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state: BackendState = JSON.parse(stored);
        return state.switchCount || 0;
      }
    } catch (error) {
      console.warn('Failed to get switch count:', error);
    }
    return 0;
  }

  public async fetchDashboardData(location?: string, userLocation?: any): Promise<any> {
    if (this.currentMode === 'mock') {
      return this.mockService.getDashboardData(location);
    }

    try {
      // Determine the location parameter (matching original logic)
      let locationParam = '';
      if (userLocation) {
        locationParam = `?lat=${userLocation.latitude}&lon=${userLocation.longitude}&name=${encodeURIComponent(userLocation.city)}`;
      } else {
        locationParam = `?location=${encodeURIComponent(location || 'New York')}`;
      }
      
      // Build API URL - Use the config API base URL
      const apiUrl = `${config.apiBaseUrl}/api/dashboard${locationParam}`;
      
      console.log('📡 API Request:', apiUrl);
      
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000); // Increased timeout for Render
      
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      window.clearTimeout(timeoutId);
      
      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('📊 Response URL:', response.url);
      console.log('📊 Response redirected:', response.redirected);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText.substring(0, 500));
        throw new Error(`API failed: ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 200)}`);
      }
      
      const text = await response.text();
      console.log('📊 Raw response length:', text.length);
      console.log('📊 Response content-type:', response.headers.get('content-type'));
      console.log('📊 Response preview:', text.substring(0, 300) + '...');
      
      if (!text.trim()) {
        throw new Error('Empty response from API');
      }
      
      // Check if response looks like HTML (error page)
      if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().startsWith('<html')) {
        console.error('❌ Received HTML instead of JSON. This might be a CORS error or redirect.');
        console.error('❌ Full HTML response:', text);
        throw new Error('API returned HTML error page instead of JSON data. Check CORS configuration on server.');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('❌ Response Text (first 1000 chars):', text.substring(0, 1000));
        console.error('❌ Response Content-Type:', response.headers.get('content-type'));
        throw new Error(`Invalid JSON response from API. Content-Type: ${response.headers.get('content-type')}. Parse Error: ${parseError}`);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Live API failed:', error);
      throw error;
    }
  }

  public getModeInfo(): { mode: BackendMode; switchCount: number; lastSwitched?: string } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state: BackendState = JSON.parse(stored);
        return {
          mode: this.currentMode,
          switchCount: state.switchCount || 0,
          lastSwitched: state.switchedAt
        };
      }
    } catch (error) {
      console.warn('Failed to get mode info:', error);
    }
    return { mode: this.currentMode, switchCount: 0 };
  }
}

export default BackendModeManager;