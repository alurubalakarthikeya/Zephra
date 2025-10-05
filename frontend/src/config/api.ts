// API Configuration for different environments
// RUNTIME-ONLY URL determination to completely bypass build-time env vars
const getRuntimeApiUrl = (): string => {
  // Construct the URL at runtime to avoid ANY build-time substitution
  const baseUrl = 'https://' + 'zephra.onrender.com';
  return baseUrl;
};

export const config = {
  // This will be evaluated at runtime, not build time
  get apiBaseUrl() { 
    return getRuntimeApiUrl(); 
  },
  appTitle: 'Zephra - Air Quality Monitoring',
  appVersion: '2.0.0',
  isDevelopment: false,
  isProduction: true,
} as const;

// Debug information to verify the URL
console.log('🔧 Runtime API Config Debug:', {
  apiBaseUrl: config.apiBaseUrl,
  constructedUrl: getRuntimeApiUrl(),
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