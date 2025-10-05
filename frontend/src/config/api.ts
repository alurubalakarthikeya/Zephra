// API Configuration for different environments
// Completely hardcoded to prevent ANY environment variable overrides
const getApiBaseUrl = (): string => {
  // Force the Render API URL regardless of any environment variables
  return 'https://zephra.onrender.com';
};

export const config = {
  apiBaseUrl: getApiBaseUrl(), // Function call to prevent build-time substitution
  appTitle: import.meta.env?.VITE_APP_TITLE || 'Zephra - Air Quality Monitoring',
  appVersion: import.meta.env?.VITE_APP_VERSION || '2.0.0',
  isDevelopment: import.meta.env?.DEV || false,
  isProduction: import.meta.env?.PROD || true,
} as const;

// Debug information (remove after fixing Vercel)
console.log('🔧 API Config Debug:', {
  apiBaseUrl: config.apiBaseUrl,
  envApiUrl: import.meta.env?.VITE_API_BASE_URL,
  envMode: import.meta.env?.MODE,
  location: window.location.origin
});

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