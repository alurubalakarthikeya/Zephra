// API Configuration for different environments
export const config = {
  apiBaseUrl: 'https://zephra.onrender.com', // Hardcoded to ensure correct API URL
  appTitle: import.meta.env?.VITE_APP_TITLE || 'Zephra - Air Quality Monitoring',
  appVersion: import.meta.env?.VITE_APP_VERSION || '2.0.0',
  isDevelopment: import.meta.env?.DEV || false,
  isProduction: import.meta.env?.PROD || true,
} as const;

// API endpoints
export const endpoints = {
  dashboard: `${config.apiBaseUrl}/api/dashboard`,
  locations: `${config.apiBaseUrl}/api/locations`,
  health: `${config.apiBaseUrl}/health`,
  nasaStatus: `${config.apiBaseUrl}/api/nasa-status`,
  mlModelInfo: `${config.apiBaseUrl}/api/ml-model-info`,
  predict: `${config.apiBaseUrl}/api/predict`,
} as const;

export default config;