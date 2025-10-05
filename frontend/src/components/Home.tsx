import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import './LocationMap.css';
import OfflineIndicator from './OfflineIndicator';
import { ServiceManager } from '../services/ServiceManager';
import BackendModeManager, { type BackendMode } from '../services/BackendModeManager';
import ClickHandler from '../services/ClickHandler';
import NotificationService from '../services/NotificationService';

interface AirQualityData {
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  location: string;
  timestamp: string;
  status: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  visibility: number;
  windDirection: string;
}

interface AlertData {
  id: string;
  type: 'warning' | 'info' | 'critical';
  message: string;
  timestamp: string;
}

interface AlertSettings {
  id: string;
  name: string;
  aqiThreshold: number;
  pollutant: 'aqi' | 'pm25' | 'pm10' | 'o3' | 'no2';
  condition: 'above' | 'below';
  enabled: boolean;
  notificationEnabled: boolean;
}

interface HealthProfile {
  id: string;
  hasAsthma: boolean;
  hasAllergies: boolean;
  hasHeartCondition: boolean;
  hasRespiratoryIssues: boolean;
  ageGroup: 'under-18' | '18-40' | '41-65' | 'over-65';
  exerciseOutdoors: boolean;
  sensitiveToPollution: boolean;
  takesAirQualityMeds: boolean;
  additionalConditions: string;
  createdAt: string;
  updatedAt: string;
}

const Home: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState('New York');
  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Data source selection state
  const [dataSource, setDataSource] = useState<'dashboard' | 'nasa-data' | 'openaq-data'>('dashboard');
  
  // Service Manager state
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const serviceManagerRef = useRef<ServiceManager | null>(null);
  
  // Geolocation state
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
    accuracy: number;
  } | null>(null);
  
  // Alert management state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings[]>([]);
  const [newAlert, setNewAlert] = useState<Partial<AlertSettings>>({
    name: '',
    aqiThreshold: 100,
    pollutant: 'aqi',
    condition: 'above',
    enabled: true,
    notificationEnabled: true
  });
  
  // Health assessment state
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [healthForm, setHealthForm] = useState<Partial<HealthProfile>>({
    hasAsthma: false,
    hasAllergies: false,
    hasHeartCondition: false,
    hasRespiratoryIssues: false,
    ageGroup: '18-40',
    exerciseOutdoors: false,
    sensitiveToPollution: false,
    takesAirQualityMeds: false,
    additionalConditions: ''
  });
  
  // Fullscreen map state
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  
  // Health map highlight state
  const [highlightHealthMap, setHighlightHealthMap] = useState(false);
  
  // Pollutant carousel state
  const [currentPollutantIndex, setCurrentPollutantIndex] = useState(0);
  const [isAutoSliding, setIsAutoSliding] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Trend data state
  const [trendData, setTrendData] = useState<number[]>([]);
  
  // Secret backend switch state
  const [backendMode, setBackendMode] = useState<BackendMode>('api');
  const backendManagerRef = useRef<BackendModeManager | null>(null);
  const secretDetectorRef = useRef<ClickHandler | null>(null);
  const notificationServiceRef = useRef<NotificationService | null>(null);

  // Real API endpoints - Now connected to FastAPI backend
  // Unified data fetching - Now uses BackendModeManager for API/Mock switching
  const fetchAirQualityData = async () => {
    console.log('🚀 Starting fetchAirQualityData for location:', currentLocation);
    
    try {
      setLoading(true);
      
      // Use BackendModeManager to fetch data (handles API vs Mock automatically)
      if (!backendManagerRef.current) {
        throw new Error('BackendModeManager not initialized');
      }
      
      const data = await backendManagerRef.current.fetchDashboardData(currentLocation, userLocation || undefined);
      console.log('✅ Data fetched via BackendModeManager:', data);
      
      if (data.success && data.air_quality && data.air_quality.length > 0) {
        // Get the latest air quality data
        const latestData = data.air_quality[data.air_quality.length - 1];
        
        const realData: AirQualityData = {
          aqi: Number(latestData.aqi) || 0,
          pm25: Number(latestData.pm25) || 0,
          pm10: Number(latestData.pm10) || 0,
          o3: Number(latestData.o3) || 0,
          no2: Number(latestData.no2) || 0,
          so2: Number(latestData.so2) || 0,
          co: Number(latestData.co) || 0,
          location: data.location_info?.name || currentLocation,
          timestamp: latestData.timestamp,
          status: getAQIStatus(Number(latestData.aqi) || 0)
        };
        
        console.log('📍 Setting air quality data:', realData);
        setAirQualityData(realData);
        
        // Extract trend data from historical air quality data
        if (data.air_quality.length > 1) {
          const trendValues = data.air_quality
            .slice(-8)
            .map((item: any) => Number(item.aqi) || 0);
          setTrendData(trendValues);
        } else {
          // Fallback: generate trend based on current value with some variance
          const currentValue = realData.aqi;
          const mockTrend = Array.from({ length: 8 }, (_, i) => {
            const variance = (Math.random() - 0.5) * 20;
            return Math.max(0, Math.round(currentValue + variance));
          });
          setTrendData(mockTrend);
        }
        
        // Also update weather data if available
        if (data.weather && data.weather.length > 0) {
          const latestWeather = data.weather[data.weather.length - 1];
          const realWeatherData: WeatherData = {
            temperature: Number(latestWeather.temperature) || 0,
            humidity: Number(latestWeather.humidity) || 0,
            windSpeed: Number(latestWeather.windSpeed) || 0,
            pressure: Number(latestWeather.pressure) || 0,
            visibility: Number(latestWeather.visibility) || 0,
            windDirection: latestWeather.windDirection || 'N/A'
          };
          console.log('🌤️ Setting weather data:', realWeatherData);
          setWeatherData(realWeatherData);
        } else {
          // Set fallback weather data
          const fallbackWeather: WeatherData = {
            temperature: 22,
            humidity: 65,
            windSpeed: 12,
            pressure: 1013,
            visibility: 10,
            windDirection: 'NW'
          };
          setWeatherData(fallbackWeather);
        }
        
        // Check alerts with new data
        checkAlerts(realData);
        
        // Handle air quality update through Service Manager
        if (serviceManagerRef.current) {
          await serviceManagerRef.current.handleAirQualityUpdate(realData);
        }
        
        console.log('✅ Data fetched and processed successfully');
      } else {
        throw new Error('Invalid data format received from backend');
      }
    } catch (error) {
      console.error('❌ Error fetching air quality data:', error);
      
      // Enhanced fallback to mock data - ensure data is always available
      const mockData: AirQualityData = {
        aqi: Math.floor(Math.random() * 150) + 30,
        pm25: Math.floor(Math.random() * 40) + 10,
        pm10: Math.floor(Math.random() * 60) + 20,
        o3: Math.floor(Math.random() * 120) + 30,
        no2: Math.floor(Math.random() * 80) + 15,
        so2: Math.floor(Math.random() * 60) + 10,
        co: Math.floor(Math.random() * 1500) + 500,
        location: currentLocation,
        timestamp: new Date().toISOString(),
        status: getAQIStatus(Math.floor(Math.random() * 150) + 30)
      };
      
      setAirQualityData(mockData);
      
      // Enhanced fallback weather data
      const mockWeatherData: WeatherData = {
        temperature: Math.floor(Math.random() * 25) + 15,
        humidity: Math.floor(Math.random() * 40) + 40,
        windSpeed: Math.floor(Math.random() * 20) + 5,
        pressure: Math.floor(Math.random() * 50) + 1000,
        visibility: Math.floor(Math.random() * 10) + 5,
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]
      };
      
      setWeatherData(mockWeatherData);
      
      // Generate mock trend data
      const mockTrend = Array.from({ length: 8 }, (_, i) => {
        const variance = (Math.random() - 0.5) * 30;
        return Math.max(0, Math.round(mockData.aqi + variance));
      });
      setTrendData(mockTrend);
      
      checkAlerts(mockData);
    } finally {
      setLoading(false);
    }
  };

  // Weather data is now fetched along with air quality data in fetchAirQualityData
  // No separate weather API call needed

  const fetchAlerts = async () => {
    try {
      const mockAlerts: AlertData[] = [
        {
          id: '1',
          type: 'warning',
          message: 'Air quality may be unhealthy for sensitive groups',
          timestamp: new Date().toISOString()
        },
        {
          id: '2', 
          type: 'info',
          message: 'Wind patterns favorable for air quality improvement',
          timestamp: new Date().toISOString()
        }
      ];
      
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const getAQIStatus = (aqi: number): AirQualityData['status'] => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  };

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return '#42A5F5';      // Good - Light Blue
    if (aqi <= 100) return '#1976D2';    // Moderate - Medium Blue  
    if (aqi <= 150) return '#1565C0';    // Unhealthy for Sensitive - Dark Blue
    if (aqi <= 200) return '#0D47A1';    // Unhealthy - Darker Blue
    if (aqi <= 300) return '#0A3D91';    // Very Unhealthy - Very Dark Blue
    return '#051F4A';                     // Hazardous - Deepest Blue
  };

  const getAQIBackgroundColor = (aqi: number) => {
    if (aqi <= 50) return 'rgba(66, 165, 245, 0.1)';      // Good - Light Blue
    if (aqi <= 100) return 'rgba(25, 118, 210, 0.1)';     // Moderate - Medium Blue  
    if (aqi <= 150) return 'rgba(21, 101, 192, 0.1)';     // Unhealthy for Sensitive - Dark Blue
    if (aqi <= 200) return 'rgba(13, 71, 161, 0.1)';      // Unhealthy - Darker Blue
    if (aqi <= 300) return 'rgba(10, 61, 145, 0.1)';      // Very Unhealthy - Very Dark Blue
    return 'rgba(5, 31, 74, 0.1)';                         // Hazardous - Deepest Blue
  };

  const getAQIDescription = (aqi: number): string => {
    if (aqi <= 50) return 'Excellent air quality\nSafe for everyone';
    if (aqi <= 100) return 'Acceptable for most people\nGenerally good conditions';
    if (aqi <= 150) return 'Sensitive groups may experience effects\nCaution advised for vulnerable individuals';
    if (aqi <= 200) return 'Everyone may experience effects\nLimit outdoor activities';
    if (aqi <= 300) return 'Health alert - increased risk\nStay indoors when possible';
    return 'Emergency conditions - serious effects\nAvoid all outdoor exposure';
  };

  const getAQIRecommendation = (aqi: number): string => {
    if (aqi <= 50) return 'Outdoor activities recommended';
    if (aqi <= 100) return 'Sensitive individuals should limit outdoor activities';
    if (aqi <= 150) return 'Sensitive groups should stay indoors';
    if (aqi <= 200) return 'Everyone should limit outdoor activities';
    if (aqi <= 300) return 'Stay indoors and avoid outdoor activities';
    return 'Stay indoors and seek medical attention if needed';
  };

  const getRecommendationIcon = (aqi: number): React.ReactNode => {
    if (aqi <= 50) {
      // Check mark icon for good air quality
      return (
        <>
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="9"/>
        </>
      );
    } else if (aqi <= 100) {
      // Warning triangle for moderate
      return (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </>
      );
    } else if (aqi <= 150) {
      // Alert circle for unhealthy for sensitive groups
      return (
        <>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </>
      );
    } else if (aqi <= 200) {
      // X mark for unhealthy
      return (
        <>
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </>
      );
    } else {
      // Shield alert for very unhealthy/hazardous
      return (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </>
      );
    }
  };

  // Pollutant data configuration
  const getPollutantData = () => {
    if (!airQualityData) return [];
    
    return [
      {
        name: 'AQI',
        value: airQualityData.aqi,
        unit: 'Index',
        description: getAQIDescription(airQualityData.aqi),
        recommendation: getAQIRecommendation(airQualityData.aqi),
        color: getAQIColor(airQualityData.aqi),
        backgroundColor: getAQIBackgroundColor(airQualityData.aqi),
        icon: getRecommendationIcon(airQualityData.aqi),
        thresholds: { good: 50, moderate: 100, unhealthy: 150, veryUnhealthy: 200 }
      },
      {
        name: 'PM2.5',
        value: airQualityData.pm25,
        unit: 'μg/m³',
        description: getPM25Description(airQualityData.pm25),
        recommendation: getPM25Recommendation(airQualityData.pm25),
        color: getPollutantColor('PM2.5', airQualityData.pm25),
        backgroundColor: getPollutantBackgroundColor('PM2.5', airQualityData.pm25),
        icon: getPollutantIcon(airQualityData.pm25, 'pm25'),
        thresholds: { good: 12, moderate: 35, unhealthy: 55, veryUnhealthy: 150 }
      },
      {
        name: 'PM10',
        value: airQualityData.pm10,
        unit: 'μg/m³',
        description: getPM10Description(airQualityData.pm10),
        recommendation: getPM10Recommendation(airQualityData.pm10),
        color: getPollutantColor('PM10', airQualityData.pm10),
        backgroundColor: getPollutantBackgroundColor('PM10', airQualityData.pm10),
        icon: getPollutantIcon(airQualityData.pm10, 'pm10'),
        thresholds: { good: 54, moderate: 154, unhealthy: 254, veryUnhealthy: 354 }
      },
      {
        name: 'Ozone',
        value: airQualityData.o3,
        unit: 'μg/m³',
        description: getOzoneDescription(airQualityData.o3),
        recommendation: getOzoneRecommendation(airQualityData.o3),
        color: getPollutantColor('Ozone', airQualityData.o3),
        backgroundColor: getPollutantBackgroundColor('Ozone', airQualityData.o3),
        icon: getPollutantIcon(airQualityData.o3, 'o3'),
        thresholds: { good: 100, moderate: 160, unhealthy: 200, veryUnhealthy: 300 }
      },
      {
        name: 'NO₂',
        value: airQualityData.no2,
        unit: 'μg/m³',
        description: getNO2Description(airQualityData.no2),
        recommendation: getNO2Recommendation(airQualityData.no2),
        color: getPollutantColor('NO₂', airQualityData.no2),
        backgroundColor: getPollutantBackgroundColor('NO₂', airQualityData.no2),
        icon: getPollutantIcon(airQualityData.no2, 'no2'),
        thresholds: { good: 40, moderate: 80, unhealthy: 180, veryUnhealthy: 280 }
      },
      {
        name: 'SO₂',
        value: airQualityData.so2,
        unit: 'μg/m³',
        description: getSO2Description(airQualityData.so2),
        recommendation: getSO2Recommendation(airQualityData.so2),
        color: getPollutantColor('SO₂', airQualityData.so2),
        backgroundColor: getPollutantBackgroundColor('SO₂', airQualityData.so2),
        icon: getPollutantIcon(airQualityData.so2, 'so2'),
        thresholds: { good: 20, moderate: 80, unhealthy: 250, veryUnhealthy: 500 }
      }
    ];
  };

  // Pollutant-specific description functions
  const getPM25Description = (value: number): string => {
    if (value <= 12) return 'Fine particles pose little health risk\nSafe for outdoor activities';
    if (value <= 35) return 'Acceptable for most people\nGenerally good conditions';
    if (value <= 55) return 'Sensitive groups may experience symptoms\nCaution advised for vulnerable individuals';
    if (value <= 150) return 'Health effects likely for sensitive groups\nLimit outdoor exposure';
    return 'Serious health effects for everyone\nStay indoors, avoid outdoor activities';
  };

  const getPM25Recommendation = (value: number): string => {
    if (value <= 12) return 'Great day for outdoor activities';
    if (value <= 35) return 'Generally safe for outdoor activities';
    if (value <= 55) return 'Sensitive individuals should limit outdoor time';
    if (value <= 150) return 'Reduce outdoor activities, especially exercise';
    return 'Stay indoors, avoid outdoor activities';
  };

  const getPM10Description = (value: number): string => {
    if (value <= 54) return 'Coarse particles at healthy levels\nNo restrictions on outdoor activities';
    if (value <= 154) return 'Moderate levels, generally acceptable\nUsually safe for most people';
    if (value <= 254) return 'Unhealthy for sensitive individuals\nSensitive groups should be cautious';
    if (value <= 354) return 'Unhealthy air quality\nEveryone should limit outdoor activities';
    return 'Very unhealthy particle levels\nStay indoors, especially sensitive individuals';
  };

  const getPM10Recommendation = (value: number): string => {
    if (value <= 54) return 'No restrictions on outdoor activities';
    if (value <= 154) return 'Unusually sensitive people should limit outdoor exertion';
    if (value <= 254) return 'Sensitive groups should avoid outdoor activities';
    if (value <= 354) return 'Everyone should limit outdoor activities';
    return 'Stay indoors, especially sensitive individuals';
  };

  const getOzoneDescription = (value: number): string => {
    if (value <= 100) return 'Ground-level ozone at safe levels\nSafe for all outdoor activities';
    if (value <= 160) return 'Moderate ozone concentrations\nMay affect sensitive individuals';
    if (value <= 200) return 'Unhealthy ozone levels for sensitive groups\nSensitive groups should limit outdoor exertion';
    if (value <= 300) return 'Unhealthy ozone concentrations\nEveryone should reduce outdoor activities';
    return 'Very unhealthy ozone levels\nAvoid outdoor activities, stay indoors';
  };

  const getOzoneRecommendation = (value: number): string => {
    if (value <= 100) return 'Safe for all outdoor activities';
    if (value <= 160) return 'Sensitive individuals may experience respiratory symptoms';
    if (value <= 200) return 'Sensitive groups should limit outdoor exertion';
    if (value <= 300) return 'Everyone should reduce outdoor activities';
    return 'Avoid outdoor activities, stay indoors';
  };

  const getNO2Description = (value: number): string => {
    if (value <= 40) return 'Nitrogen dioxide at healthy levels\nNo health concerns for outdoor activities';
    if (value <= 80) return 'Moderate NO₂ concentrations\nGenerally safe, monitor if sensitive';
    if (value <= 180) return 'Elevated nitrogen dioxide levels\nRespiratory conditions should be cautious';
    if (value <= 280) return 'High NO₂ concentrations\nLimit outdoor exposure, especially near traffic';
    return 'Very high nitrogen dioxide levels\nAvoid outdoor activities near roads and traffic';
  };

  const getNO2Recommendation = (value: number): string => {
    if (value <= 40) return 'No health concerns for outdoor activities';
    if (value <= 80) return 'Generally safe, monitor if sensitive to air pollution';
    if (value <= 180) return 'People with respiratory conditions should be cautious';
    if (value <= 280) return 'Limit outdoor exposure, especially near traffic';
    return 'Avoid outdoor activities near roads and traffic';
  };

  const getSO2Description = (value: number): string => {
    if (value <= 20) return 'Sulfur dioxide at minimal levels\nNo concerns for outdoor activities';
    if (value <= 80) return 'Acceptable sulfur dioxide concentrations\nSafe for most people';
    if (value <= 250) return 'Elevated SO₂ levels detected\nPeople with asthma should be cautious';
    if (value <= 500) return 'High sulfur dioxide concentrations\nSensitive individuals should stay indoors';
    return 'Very high SO₂ levels\nEveryone should avoid outdoor exposure';
  };

  const getSO2Recommendation = (value: number): string => {
    if (value <= 20) return 'No concerns for outdoor activities';
    if (value <= 80) return 'Safe for most people';
    if (value <= 250) return 'People with asthma should be cautious';
    if (value <= 500) return 'Sensitive individuals should stay indoors';
    return 'Everyone should avoid outdoor exposure';
  };

  const getPollutantColor = (type: string, value: number) => {
    // Use blue color scheme for all pollutants based on their severity
    switch (type) {
      case 'AQI':
        return getAQIColor(value);
      case 'PM2.5':
        if (value <= 12) return '#42A5F5';    // Good - Light Blue
        if (value <= 35) return '#1976D2';    // Moderate - Medium Blue
        if (value <= 55) return '#1565C0';    // Unhealthy for Sensitive - Dark Blue
        if (value <= 150) return '#0D47A1';   // Unhealthy - Darker Blue
        if (value <= 250) return '#0A3D91';   // Very Unhealthy - Very Dark Blue
        return '#051F4A';                      // Hazardous - Deepest Blue
      case 'PM10':
        if (value <= 54) return '#42A5F5';
        if (value <= 154) return '#1976D2';
        if (value <= 254) return '#1565C0';
        if (value <= 354) return '#0D47A1';
        if (value <= 424) return '#0A3D91';
        return '#051F4A';
      case 'Ozone':
        if (value <= 54) return '#42A5F5';
        if (value <= 70) return '#1976D2';
        if (value <= 85) return '#1565C0';
        if (value <= 105) return '#0D47A1';
        if (value <= 200) return '#0A3D91';
        return '#051F4A';
      case 'NO₂':
        if (value <= 53) return '#42A5F5';
        if (value <= 100) return '#1976D2';
        if (value <= 360) return '#1565C0';
        if (value <= 649) return '#0D47A1';
        if (value <= 1249) return '#0A3D91';
        return '#051F4A';
      case 'SO₂':
        if (value <= 35) return '#42A5F5';
        if (value <= 75) return '#1976D2';
        if (value <= 185) return '#1565C0';
        if (value <= 304) return '#0D47A1';
        if (value <= 604) return '#0A3D91';
        return '#051F4A';
      default:
        return '#1976D2';
    }
  };

  const getPollutantBackgroundColor = (type: string, value: number) => {
    const color = getPollutantColor(type, value);
    // Convert hex to rgba with 0.1 opacity
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, 0.1)`;
  };

  const getPollutantIcon = (value: number, type: string): React.ReactNode => {
    const thresholds = getPollutantThresholds(type);
    
    if (value <= thresholds.good) {
      return (
        <>
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="9"/>
        </>
      );
    } else if (value <= thresholds.moderate) {
      return (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </>
      );
    } else if (value <= thresholds.unhealthy) {
      return (
        <>
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </>
      );
    } else {
      return (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </>
      );
    }
  };

  const getPollutantThresholds = (type: string) => {
    const thresholds = {
      pm25: { good: 12, moderate: 35, unhealthy: 55, veryUnhealthy: 150 },
      pm10: { good: 54, moderate: 154, unhealthy: 254, veryUnhealthy: 354 },
      o3: { good: 54, moderate: 70, unhealthy: 85, veryUnhealthy: 105 },
      ozone: { good: 54, moderate: 70, unhealthy: 85, veryUnhealthy: 105 },
      no2: { good: 53, moderate: 100, unhealthy: 360, veryUnhealthy: 649 },
      'NO₂': { good: 53, moderate: 100, unhealthy: 360, veryUnhealthy: 649 },
      so2: { good: 35, moderate: 75, unhealthy: 185, veryUnhealthy: 304 },
      'SO₂': { good: 35, moderate: 75, unhealthy: 185, veryUnhealthy: 304 }
    };
    return thresholds[type.toLowerCase()] || thresholds[type] || thresholds.pm25;
  };

  // Get trend data for current pollutant
  const getCurrentPollutantTrend = () => {
    if (!airQualityData || trendData.length === 0) {
      // Return current value repeated if no trend data
      const currentValue = getCurrentPollutantValue();
      return Array(8).fill(currentValue);
    }
    return trendData;
  };

  const getCurrentPollutantValue = () => {
    if (!airQualityData) return 0;
    
    const pollutants = getPollutantData();
    const currentPollutant = pollutants[currentPollutantIndex] || pollutants[0];
    
    switch (currentPollutant?.name) {
      case 'PM2.5': return airQualityData.pm25;
      case 'PM10': return airQualityData.pm10;
      case 'Ozone': return airQualityData.o3;
      case 'NO₂': return airQualityData.no2;
      case 'SO₂': return airQualityData.so2;
      default: return airQualityData.aqi;
    }
  };

  // Auto-slide functionality
  useEffect(() => {
    if (!isAutoSliding) return;
    
    const pollutants = getPollutantData();
    if (pollutants.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentPollutantIndex(prev => (prev + 1) % pollutants.length);
    }, 4000); // Change every 4 seconds
    
    return () => clearInterval(interval);
  }, [isAutoSliding, airQualityData]);

  const handlePollutantClick = (index: number) => {
    setCurrentPollutantIndex(index);
    setIsAutoSliding(false);
    // Resume auto-sliding after 10 seconds of inactivity
    setTimeout(() => setIsAutoSliding(true), 10000);
  };

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setIsAutoSliding(false); // Pause auto-slide during interaction
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    const pollutants = getPollutantData();
    
    if (isLeftSwipe) {
      // Swipe left - next pollutant
      setCurrentPollutantIndex(prev => (prev + 1) % pollutants.length);
    } else if (isRightSwipe) {
      // Swipe right - previous pollutant
      setCurrentPollutantIndex(prev => prev === 0 ? pollutants.length - 1 : prev - 1);
    }
    
    setIsDragging(false);
    // Resume auto-sliding after 5 seconds
    setTimeout(() => setIsAutoSliding(true), 5000);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEnd(null);
    setTouchStart(e.clientX);
    setIsDragging(true);
    setIsAutoSliding(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTouchEnd(e.clientX);
  };

  const handleMouseUp = () => {
    if (!touchStart || !touchEnd || !isDragging) {
      setIsDragging(false);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    const pollutants = getPollutantData();
    
    if (isLeftSwipe) {
      setCurrentPollutantIndex(prev => (prev + 1) % pollutants.length);
    } else if (isRightSwipe) {
      setCurrentPollutantIndex(prev => prev === 0 ? pollutants.length - 1 : prev - 1);
    }
    
    setIsDragging(false);
    // Resume auto-sliding after 5 seconds
    setTimeout(() => setIsAutoSliding(true), 5000);
  };



  // Geolocation functions
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      // Reverse geocoding to get city name
      const cityName = await getCityFromCoordinates(latitude, longitude);
      
      const locationData = {
        latitude,
        longitude,
        city: cityName,
        accuracy
      };
      
      setUserLocation(locationData);
      
      // Update current location for air quality data
      setCurrentLocation(cityName);
      
      // Track location update through Service Manager
      if (serviceManagerRef.current) {
        await serviceManagerRef.current.handleLocationUpdate({
          latitude,
          longitude,
          city: cityName,
          timestamp: Date.now()
        });
      }
      
    } catch (error: any) {
      console.error('Geolocation error:', error);
    }
  };
  
  // Alert management functions
  const checkAlerts = async (currentData: AirQualityData) => {
    const newAlerts: AlertData[] = [];
    
    alertSettings.forEach(setting => {
      if (!setting.enabled) return;
      
      let currentValue: number;
      let pollutantName: string;
      
      switch (setting.pollutant) {
        case 'aqi':
          currentValue = currentData.aqi;
          pollutantName = 'AQI';
          break;
        case 'pm25':
          currentValue = currentData.pm25;
          pollutantName = 'PM2.5';
          break;
        case 'pm10':
          currentValue = currentData.pm10;
          pollutantName = 'PM10';
          break;
        case 'o3':
          currentValue = currentData.o3;
          pollutantName = 'Ozone';
          break;
        case 'no2':
          currentValue = currentData.no2;
          pollutantName = 'NO2';
          break;
        default:
          return;
      }
      
      const conditionMet = setting.condition === 'above' 
        ? currentValue > setting.aqiThreshold
        : currentValue < setting.aqiThreshold;
      
      if (conditionMet) {
        const alertType: AlertData['type'] = 
          currentValue > 150 ? 'critical' :
          currentValue > 100 ? 'warning' : 'info';
          
        newAlerts.push({
          id: `alert-${setting.id}-${Date.now()}`,
          type: alertType,
          message: `${setting.name}: ${pollutantName} is ${setting.condition} ${setting.aqiThreshold} (Current: ${currentValue})`,
          timestamp: new Date().toISOString()
        });
        
        // Send browser notification if enabled
        if (setting.notificationEnabled && 'Notification' in window) {
          try {
            if (Notification.permission === 'granted') {
              new Notification(`Air Quality Alert: ${setting.name}`, {
                body: `${pollutantName} level is ${currentValue}, which is ${setting.condition} your threshold of ${setting.aqiThreshold}`,
                icon: '/icon-192x192.png',
                tag: `alert-${setting.id}`
              });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  new Notification(`Air Quality Alert: ${setting.name}`, {
                    body: `${pollutantName} level is ${currentValue}, which is ${setting.condition} your threshold of ${setting.aqiThreshold}`,
                    icon: '/icon-192x192.png',
                    tag: `alert-${setting.id}`
                  });
                }
              });
            }
          } catch (error) {
            console.error('Failed to send notification:', error);
          }
        }
      }
    });
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev.slice(0, 4)]); // Keep max 5 alerts
    }
  };
  
  const createAlert = () => {
    if (!newAlert.name?.trim()) return;
    
    const alert: AlertSettings = {
      id: `alert-${Date.now()}`,
      name: newAlert.name,
      aqiThreshold: newAlert.aqiThreshold || 100,
      pollutant: newAlert.pollutant || 'aqi',
      condition: newAlert.condition || 'above',
      enabled: newAlert.enabled ?? true,
      notificationEnabled: newAlert.notificationEnabled ?? true
    };
    
    setAlertSettings(prev => [...prev, alert]);
    setNewAlert({
      name: '',
      aqiThreshold: 100,
      pollutant: 'aqi',
      condition: 'above',
      enabled: true,
      notificationEnabled: true
    });
    closeModal('alert');
    
    // Save to localStorage
    const updatedSettings = [...alertSettings, alert];
    localStorage.setItem('airQualityAlerts', JSON.stringify(updatedSettings));
  };
  
  const toggleAlert = (id: string) => {
    setAlertSettings(prev => {
      const updated = prev.map(alert => 
        alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
      );
      localStorage.setItem('airQualityAlerts', JSON.stringify(updated));
      return updated;
    });
  };
  
  const deleteAlert = (id: string) => {
    setAlertSettings(prev => {
      const updated = prev.filter(alert => alert.id !== id);
      localStorage.setItem('airQualityAlerts', JSON.stringify(updated));
      return updated;
    });
  };
  
  // Health profile management functions
  const saveHealthProfile = () => {
    if (!healthForm.ageGroup) return;
    
    const profile: HealthProfile = {
      id: healthProfile?.id || `health-${Date.now()}`,
      hasAsthma: healthForm.hasAsthma || false,
      hasAllergies: healthForm.hasAllergies || false,
      hasHeartCondition: healthForm.hasHeartCondition || false,
      hasRespiratoryIssues: healthForm.hasRespiratoryIssues || false,
      ageGroup: healthForm.ageGroup || '18-40',
      exerciseOutdoors: healthForm.exerciseOutdoors || false,
      sensitiveToPollution: healthForm.sensitiveToPollution || false,
      takesAirQualityMeds: healthForm.takesAirQualityMeds || false,
      additionalConditions: healthForm.additionalConditions || '',
      createdAt: healthProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setHealthProfile(profile);
    localStorage.setItem('healthProfile', JSON.stringify(profile));
    closeModal('health');
    
    // Generate personalized recommendations based on profile
    generateHealthRecommendations(profile);
  };
  
  const generateHealthRecommendations = (profile: HealthProfile) => {
    const recommendations: string[] = [];
    
    if (profile.hasAsthma || profile.hasRespiratoryIssues) {
      recommendations.push('Consider staying indoors when AQI exceeds 100');
      recommendations.push('Keep rescue medications easily accessible');
    }
    
    if (profile.hasAllergies) {
      recommendations.push('Monitor pollen levels alongside air quality');
      recommendations.push('Use air purifiers indoors during high pollution days');
    }
    
    if (profile.hasHeartCondition) {
      recommendations.push('Avoid outdoor exercise when AQI is above 50');
      recommendations.push('Consult your doctor about air quality impacts on your condition');
    }
    
    if (profile.exerciseOutdoors) {
      recommendations.push('Check air quality before outdoor workouts');
      recommendations.push('Consider indoor alternatives during poor air quality days');
    }
    
    if (profile.ageGroup === 'over-65' || profile.ageGroup === 'under-18') {
      recommendations.push('Extra caution needed - you\'re in a sensitive group');
    }
    
    // Store recommendations for display
    localStorage.setItem('healthRecommendations', JSON.stringify(recommendations));
  };
  
  const getHealthRiskLevel = (aqi: number, profile: HealthProfile | null): string => {
    if (!profile) return 'Unknown';
    
    const hasConditions = profile.hasAsthma || profile.hasAllergies || 
                         profile.hasHeartCondition || profile.hasRespiratoryIssues;
    const isSensitiveAge = profile.ageGroup === 'over-65' || profile.ageGroup === 'under-18';
    
    if (hasConditions || isSensitiveAge) {
      if (aqi <= 50) return 'Low Risk';
      if (aqi <= 100) return 'Moderate Risk';
      if (aqi <= 150) return 'High Risk';
      return 'Very High Risk';
    } else {
      if (aqi <= 50) return 'Good';
      if (aqi <= 100) return 'Moderate';
      if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
      if (aqi <= 200) return 'Unhealthy';
      return 'Very Unhealthy';
    }
  };

  const getCityFromCoordinates = async (lat: number, lon: number): Promise<string> => {
    try {
      // Mock reverse geocoding - replace with actual service
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=mock_api_key`
      );
      
      if (response.ok) {
        const text = await response.text();
        if (!text.trim()) {
          console.warn('Empty response from geocoding API');
          return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
        
        try {
          const data = JSON.parse(text);
          return data[0]?.name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        } catch (parseError) {
          console.error('❌ Geocoding JSON Parse Error:', parseError);
          console.error('❌ Response Text:', text.substring(0, 100) + '...');
          return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
    
    // Fallback to coordinates
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };



  const openModal = (modalType: 'alert' | 'health') => {
    if (modalType === 'alert') {
      setShowAlertModal(true);
    } else {
      setShowHealthModal(true);
    }
  };

  const closeModal = (modalType: 'alert' | 'health') => {
    if (modalType === 'alert') {
      setShowAlertModal(false);
    } else {
      setShowHealthModal(false);
    }
  };
  
  const openFullscreenMap = () => {
    setShowFullscreenMap(true);
  };
  
  const closeFullscreenMap = () => {
    setShowFullscreenMap(false);
  };

  const handleViewMapClick = () => {
    // Find the health map container and scroll to it
    const healthMapElement = document.querySelector('.aqi-secondary-cards');
    if (healthMapElement) {
      healthMapElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    } else {
      // Fallback to scrolling to top if element not found
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
    
    // Highlight health map after a brief delay
    setTimeout(() => {
      setHighlightHealthMap(true);
      // Let the animation complete its full cycle (2s) before removing highlight
      setTimeout(() => {
        setHighlightHealthMap(false);
      }, 2000);
    }, 300);
  };

  // Secret Backend Switch Functions
  const handleSecretBackendSwitch = async () => {
    if (!backendManagerRef.current || !notificationServiceRef.current) {
      return;
    }

    try {
      // Toggle backend mode
      const newMode = backendManagerRef.current.toggleMode();
      setBackendMode(newMode);
      
      // Show notification with current backend
      await notificationServiceRef.current.showBackendSwitchNotification(newMode);
      
      // Refresh data with new backend
      await fetchAirQualityData();
      
    } catch (error) {
      console.error('Error during backend switch:', error);
    }
  };

  const handleHeartIconClick = (event: React.MouseEvent) => {
    // Prevent any default behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Register secret click
    if (secretDetectorRef.current) {
      secretDetectorRef.current.registerClick();
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await fetchAirQualityData(); // This now fetches both air quality and weather data
    await fetchAlerts();
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    // Initialize all services including secret backend switch
    const initializeServices = async () => {
      try {
        // Initialize Service Manager
        serviceManagerRef.current = new ServiceManager();
        
        // Set up service callbacks
        serviceManagerRef.current.setCallbacks({
          onServiceWorkerUpdate: () => {
            console.log('Service Worker update detected');
            setUpdateAvailable(true);
          },
          onNotificationPermissionChange: (permission) => {
            console.log(`Notification permission: ${permission}`);
          },
          onServiceError: (service, error) => {
            console.error(`${service} error:`, error);
          }
        });
        
        // Initialize all services
        await serviceManagerRef.current.initialize();
        await serviceManagerRef.current.getStatus();
        console.log('✅ Service Manager initialized successfully');
        
        // Initialize Backend Mode Manager
        backendManagerRef.current = BackendModeManager.getInstance();
        const currentMode = backendManagerRef.current.getCurrentMode();
        setBackendMode(currentMode);
        console.log(`✅ Backend Mode Manager initialized (mode: ${currentMode.toUpperCase()})`);
        
        // Initialize Notification Service
        notificationServiceRef.current = NotificationService.getInstance();
        
        // Request notification permission
        try {
          const permission = await notificationServiceRef.current.requestPermission();
          console.log(`📱 Notification permission: ${permission}`);
        } catch (error) {
          console.warn('Failed to request notification permission:', error);
        }
        console.log(' Notification Service initialized successfully');
        
        // Initialize Secret Click Detector
        console.log('🔧 Initializing Secret Click Detector...');
        secretDetectorRef.current = new ClickHandler(
          async () => {
            console.log('🎉 SECRET BACKEND SWITCH ACTIVATED!');
            
            if (!backendManagerRef.current || !notificationServiceRef.current) {
              console.error('Backend services not initialized');
              return;
            }

            try {
              // Toggle backend mode
              const newMode = backendManagerRef.current.toggleMode();
              setBackendMode(newMode);
              
              // Show notification
              await notificationServiceRef.current.showBackendSwitchNotification(newMode);
              
              // Refresh data with new backend
              await fetchAirQualityData();
              
            } catch (error) {
              console.error('Error during backend switch:', error);
            }
          },
          () => {
            // No visual feedback needed
          }
        );
        console.log('✅ Secret Click Detector initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
      }
    };
    
    // Load saved alert settings
    const savedAlerts = localStorage.getItem('airQualityAlerts');
    if (savedAlerts) {
      try {
        setAlertSettings(JSON.parse(savedAlerts));
      } catch (error) {
        console.error('Failed to load saved alerts:', error);
      }
    }
    
    // Load saved health profile
    const savedHealthProfile = localStorage.getItem('healthProfile');
    if (savedHealthProfile) {
      try {
        const profile = JSON.parse(savedHealthProfile);
        setHealthProfile(profile);
        setHealthForm(profile);
      } catch (error) {
        console.error('Failed to load health profile:', error);
      }
    }
    
    initializeServices();
    
    // Cleanup on component unmount
    return () => {
      if (serviceManagerRef.current) {
        serviceManagerRef.current.destroy();
      }
      if (secretDetectorRef.current) {
        secretDetectorRef.current.reset();
      }
    };
  }, []);

  useEffect(() => {
    refreshData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(refreshData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentLocation, dataSource]); // Added dataSource dependency for real-time API switching

  // Ensure data is available on component mount
  useEffect(() => {
    // If no data after 2 seconds, force fallback data
    const fallbackTimer = setTimeout(() => {
      if (!airQualityData || !weatherData) {
        console.log('⚠️ Forcing fallback data due to timeout');
        
        if (!airQualityData) {
          const fallbackAQI: AirQualityData = {
            aqi: 65,
            pm25: 15,
            pm10: 25,
            o3: 45,
            no2: 25,
            so2: 15,
            co: 800,
            location: currentLocation,
            timestamp: new Date().toISOString(),
            status: 'Moderate'
          };
          setAirQualityData(fallbackAQI);
        }
        
        if (!weatherData) {
          const fallbackWeather: WeatherData = {
            temperature: 22,
            humidity: 65,
            windSpeed: 12,
            pressure: 1013,
            visibility: 10,
            windDirection: 'NW'
          };
          setWeatherData(fallbackWeather);
        }
        
        setLoading(false);
      }
    }, 2000);
    
    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <div className="home-container">
      {/* Offline Indicator */}
      <OfflineIndicator />
      
      {/* Global Animated Background */}
      <div className="global-background">
        <div className="floating-particles">
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
          <div className="floating-bubble"></div>
        </div>
        <div className="gradient-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
          <div className="orb orb-4"></div>
          <div className="orb orb-5"></div>
        </div>
      </div>

      {/* Enhanced Header Section */}
      <section className="home-header">
        <div className="header-content-transparent">
          <div className="profile-section">
            <div className="user-profile">
              <div className="user-avatar">
                <div className="avatar-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              </div>
              <div className="profile-info">
                <div className="greeting-text">
                  <h1 className="greeting-title">Hi! How's Your Air Today?</h1>
                  <p className="greeting-subtitle">Monitor your environment in real-time</p>
                </div>
                <div className="quick-stats-preview">
                  <div className="mini-stat">
                    <span className="mini-value">{(airQualityData?.aqi !== undefined ? airQualityData.aqi : '--')}</span>
                    <span className="mini-label">AQI</span>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-value">{(weatherData?.temperature !== undefined ? `${weatherData.temperature}°` : '--')}</span>
                    <span className="mini-label">Temp</span>
                  </div>
                  <div className="mini-stat">
                    <span className="mini-value">{(weatherData?.humidity !== undefined ? `${weatherData.humidity}%` : '--')}</span>
                    <span className="mini-label">Humidity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="location-selector-new">
              <div className="location-icon-new">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
              </div>
              <select 
                value={currentLocation} 
                onChange={(e) => setCurrentLocation(e.target.value)}
                className="location-dropdown-new"
              >
                {userLocation && (
                  <option value={userLocation.city}> {userLocation.city} (Your Location)</option>
                )}
                <option value="New York">New York</option>
                <option value="Los Angeles">Los Angeles</option>
                <option value="Chicago">Chicago</option>
                <option value="Houston">Houston</option>
                <option value="Phoenix">Phoenix</option>
                <option value="San Diego">San Diego</option>
                <option value="Dallas">Dallas</option>
                <option value="San Jose">San Jose</option>
                <option value="Austin">Austin</option>
                <option value="Jacksonville">Jacksonville</option>
                <option value="Fort Worth">Fort Worth</option>
                <option value="Columbus">Columbus</option>
                <option value="San Francisco">San Francisco</option>
                <option value="Charlotte">Charlotte</option>
                <option value="Indianapolis">Indianapolis</option>
                <option value="Seattle">Seattle</option>
                <option value="Detroit">Detroit</option>
                <option value="Nashville">Nashville</option>
                <option value="Portland">Portland</option>
                <option value="Memphis">Memphis</option>
                <option value="Oklahoma City">Oklahoma City</option>
                <option value="Las Vegas">Las Vegas</option>
                <option value="Louisville">Louisville</option>
                <option value="Baltimore">Baltimore</option>
                <option value="Milwaukee">Milwaukee</option>
                <option value="Mesa">Mesa</option>
                <option value="Sacramento">Sacramento</option>
                <option value="Atlanta">Atlanta</option>
                <option value="Kansas City">Kansas City</option>
                <option value="Colorado Springs">Colorado Springs</option>
                <option value="Miami">Miami</option>
                <option value="Raleigh">Raleigh</option>
                <option value="Arlington">Arlington</option>
                <option value="Tampa">Tampa</option>
                <option value="New Orleans">New Orleans</option>
                <option value="Wichita">Wichita</option>
                <option value="Cleveland">Cleveland</option>
                <option value="London">London</option>
                <option value="Tokyo">Tokyo</option>
                <option value="Sydney">Sydney</option>
                <option value="Delhi">Delhi</option>
                <option value="Berlin">Berlin</option>
                <option value="Paris">Paris</option>
                <option value="Singapore">Singapore</option>
              </select>
              <button 
                onClick={getCurrentLocation}
                className="location-btn-new"
                title="Get my location"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </button>
            </div>
            
            <div className="header-actions">
              <button className="notification-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </button>
              
              <button className="settings-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div className="time-info">
          <div className="current-time">
            <span className="time-label">Last updated</span>
            <span className="time-value">{lastUpdated.toLocaleTimeString()}</span>
          </div>
          
          <div className="time-info-right">
            <div className="data-source">
              <span className="source-badge">
                <div className="live-indicator"></div>
                {dataSource === 'nasa-data' ? ' NASA Satellite Data' : 
                 dataSource === 'openaq-data' ? ' OpenAQ Ground Stations' : 
                 ' Combined NASA + Ground Data'}
                {updateAvailable && (
                  <span className="update-badge">Update Available</span>
                )}
              </span>
            </div>
            <div className="api-selector-container">
              <div className="source-label-compact">API Endpoint</div>
              <select 
                value={dataSource} 
                onChange={(e) => setDataSource(e.target.value as 'dashboard' | 'nasa-data' | 'openaq-data')}
                className="source-dropdown-compact"
              >
                <option value="dashboard">/api/dashboard</option>
                <option value="nasa-data">/api/nasa-data</option>
                <option value="openaq-data">/api/openaq-data</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Main AQI Display */}
      <section className="aqi-main-display">
        <div className="aqi-dashboard">
          <div className="aqi-primary-card">
            <div className="aqi-card-header">
              <div className="header-left">
                <h2>Real-time Monitor</h2>
                <div className="aqi-location">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>{airQualityData?.location}</span>
                </div>
              </div>
              <div className="aqi-badge">
                <span className="badge-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"/>
                  </svg>
                </span>
                Real-time
              </div>
            </div>
            
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Fetching latest data...</span>
              </div>
            ) : (
              <div className={`aqi-main-content ${airQualityData ? 'data-loaded' : ''}`}>
                <div className="aqi-visual">
                  <div className="pollutant-carousel-container">
                    {/* Auto-slide control - moved outside circle */}
                    <button 
                      className={`auto-slide-toggle ${isAutoSliding ? 'active' : ''}`}
                      onClick={() => setIsAutoSliding(!isAutoSliding)}
                      title={isAutoSliding ? 'Pause auto-slide' : 'Resume auto-slide'}
                    >
                      {isAutoSliding ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="6" y="4" width="4" height="16"/>
                          <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5,3 19,12 5,21"/>
                        </svg>
                      )}
                    </button>
                    
                    {(() => {
                      const pollutants = getPollutantData();
                      const currentPollutant = pollutants[currentPollutantIndex] || pollutants[0];
                      
                      if (!currentPollutant) return null;
                      
                      return (
                        <>
                          {/* Swipe-enabled Circle Display */}
                          <div 
                            className="aqi-circle-container swipe-container"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{ 
                              cursor: isDragging ? 'grabbing' : 'grab',
                              userSelect: 'none'
                            }}
                          >
                            <div 
                              className="aqi-circle animated-circle" 
                              style={{ 
                                borderColor: currentPollutant.color,
                                background: currentPollutant.backgroundColor,
                                transition: isDragging ? 'none' : 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              <div className="aqi-number" style={{ 
                                color: currentPollutant.color,
                                transition: isDragging ? 'none' : 'color 0.6s ease'
                              }}>
                                {currentPollutant.value}
                              </div>
                              <div className="aqi-unit">{currentPollutant.unit}</div>
                              <div className="pollutant-name">{currentPollutant.name}</div>
                              
                              {/* Swipe hint indicators */}
                              <div className="swipe-hint left-hint">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="15,18 9,12 15,6"></polyline>
                                </svg>
                              </div>
                              <div className="swipe-hint right-hint">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="9,18 15,12 9,6"></polyline>
                                </svg>
                              </div>
                            </div>
                            
                            {/* Progress Ring */}
                            <div className="progress-ring">
                              <svg className="progress-svg" viewBox="0 0 120 120">
                                <circle
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.1)"
                                  strokeWidth="2"
                                />
                                <circle
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke={currentPollutant.color}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray={`${(currentPollutantIndex + 1) * (314 / pollutants.length)} 314`}
                                  transform="rotate(-90 60 60)"
                                  style={{
                                    transition: isDragging ? 'none' : 'stroke-dasharray 0.6s ease, stroke 0.6s ease'
                                  }}
                                />
                              </svg>
                            </div>
                            
                            {/* Pollutant indicator dots */}
                            <div className="pollutant-dots">
                              {pollutants.map((_, index) => (
                                <div
                                  key={index}
                                  className={`dot ${index === currentPollutantIndex ? 'active' : ''}`}
                                  style={{
                                    backgroundColor: index === currentPollutantIndex ? currentPollutant.color : 'rgba(255,255,255,0.3)'
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="aqi-description">
                  {(() => {
                    const pollutants = getPollutantData();
                    const currentPollutant = pollutants[currentPollutantIndex] || pollutants[0];
                    
                    if (!currentPollutant) return null;
                    
                    return (
                      <>
                        <div className="status-text" style={{ 
                          color: currentPollutant.color,
                          transition: 'color 0.8s ease'
                        }}>
                          {currentPollutant.name === 'AQI' ? 
                            (airQualityData?.status || 'Unknown') : 
                            `${currentPollutant.name} Level`
                          }
                        </div>
                        <div className="status-details">
                          <p style={{ transition: 'opacity 0.5s ease' }}>
                            {currentPollutant.description}
                          </p>
                          <div className="recommendation" style={{ transition: 'opacity 0.5s ease' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {currentPollutant.icon}
                            </svg>
                            {currentPollutant.recommendation}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                <div className="aqi-trend">
                  <div className="trend-title">
                    24h Trend - {(() => {
                      const pollutants = getPollutantData();
                      const currentPollutant = pollutants[currentPollutantIndex] || pollutants[0];
                      return currentPollutant?.name || 'AQI';
                    })()}
                  </div>
                  <div className="trend-chart">
                    <div className="trend-bars">
                      <br />
                      {getCurrentPollutantTrend().map((value, index) => {
                        const pollutants = getPollutantData();
                        const currentPollutant = pollutants[currentPollutantIndex] || pollutants[0];
                        const maxValue = currentPollutant?.name === 'AQI' ? 200 : 
                                        currentPollutant?.name === 'PM2.5' ? 100 :
                                        currentPollutant?.name === 'PM10' ? 200 :
                                        currentPollutant?.name === 'Ozone' ? 300 :
                                        currentPollutant?.name.includes('O₂') ? 200 : 200;
                        
                        return (
                          <div 
                            key={index} 
                            className="trend-bar" 
                            style={{ 
                              height: `${Math.min((value / maxValue) * 100, 100)}%`,
                              backgroundColor: currentPollutant?.name === 'AQI' ? 
                                getAQIColor(value) : 
                                getPollutantColor(currentPollutant?.name || 'AQI', value)
                            }}
                          ></div>
                        );
                      })}
                    </div>
                    <div className="trend-labels">
                      <span>24h ago </span>
                      <span>Now</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="aqi-secondary-cards">
            <div className={`quick-insight-card ${highlightHealthMap ? 'highlight-map' : ''}`}>
              <div className="insight-header">
                <h4>Health Map</h4>
                <div className="health" style={{ color: getAQIColor(airQualityData?.aqi || 0), position: 'relative' }} onClick={handleHeartIconClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"/>
              </svg>
                </div>
              </div>
              <div className="insight-content">
                {/* Map Preview */}
                <div className="map-preview">
                  <div className="map-header">
                    <span className="map-title">North America Air Quality</span>
                    <button className="expand-map-btn" title="Expand Map" >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15,3 21,3 21,9"/>
                        <polyline points="9,21 3,21 3,15"/>
                        <line x1="21" y1="3" x2="14" y2="10"/>
                        <line x1="3" y1="21" x2="10" y2="14"/>
                      </svg>
                    </button>
                  </div>
                  <div className="map-container">
                    <div className="map-overlay">
                      <div className="map-gradient"></div>
                      <div className="map-locations">
                        <div className="location-marker location-good" style={{ top: '15%', left: '35%' }}>
                          <span className="marker-aqi">42</span>
                          <span className="marker-city">Toronto</span>
                        </div>
                        <div className="location-marker location-moderate" style={{ top: '70%', left: '18%' }}>
                          <span className="marker-aqi">78</span>
                          <span className="marker-city">Chicago</span>
                        </div>
                        <div className="location-marker location-unhealthy" style={{ top: '70%', left: '40%' }}>
                          <span className="marker-aqi">156</span>
                          <span className="marker-city">Atlanta</span>
                        </div>
                        <div className="location-marker location-good" style={{ top: '30%', left: '14%' }}>
                          <span className="marker-aqi">35</span>
                          <span className="marker-city">Seattle</span>
                        </div>
                        <div className="location-marker location-moderate" style={{ top: '65%', left: '75%' }}>
                          <span className="marker-aqi">89</span>
                          <span className="marker-city">NYC</span>
                        </div>
                        {userLocation && (
                          <div className="location-marker location-current" style={{ top: '30%', left: '50%' }}>
                            <span className="marker-aqi">{airQualityData?.aqi || '--'}</span>
                            <span className="marker-city">Your Location</span>
                          </div>
                        )}
                      </div>
                      <div className="map-legend">
                        <div className="legend-item">
                          <div className="legend-color good"></div>
                          <span>Good</span>
                        </div>
                        <div className="legend-item">
                          <div className="legend-color moderate"></div>
                          <span>Moderate</span>
                        </div>
                        <div className="legend-item">
                          <div className="legend-color unhealthy"></div>
                          <span>Unhealthy</span>
                        </div>
                      </div>
                    </div>
                    <div className="map-future-notice">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      <span>Interactive map coming soon</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="quick-stats">
        <h3 className="section-title">Air Quality Metrics</h3>
        <div className={`stats-grid ${airQualityData ? 'data-loaded' : ''}`}>
            <div className="forecast-card">
              <div className="forecast-header">
                <h4>Today's Forecast</h4>
                <div className="forecast-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
                  </svg>
                </div>
              </div>
              <div className="forecast-content">
                <div className="forecast-range">
                  <span>
                    {airQualityData ? 
                      `${Math.max(0, airQualityData.aqi - 15)}-${airQualityData.aqi + 15} AQI` : 
                      '--'
                    }
                  </span>
                </div>
                <div className="forecast-trend">
                  <span className={`trend-indicator ${(() => {
                    if (!airQualityData) return 'stable';
                    // Calculate AQI trend based on daily range - compare current AQI with day's average
                    const currentAQI = airQualityData.aqi;
                    const dayRangeMin = Math.max(0, currentAQI - 15);
                    const dayRangeMax = currentAQI + 15;
                    const dayAverage = (dayRangeMin + dayRangeMax) / 2;
                    
                    // Use a simple trend logic: if current AQI is in lower third of range, improving
                    // if in upper third, worsening, else stable
                    const rangeSpan = dayRangeMax - dayRangeMin;
                    const lowerThird = dayRangeMin + (rangeSpan * 0.33);
                    const upperThird = dayRangeMin + (rangeSpan * 0.67);
                    
                    if (currentAQI <= lowerThird) return 'improving';
                    if (currentAQI >= upperThird) return 'worsening';
                    return 'stable';
                  })()}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {(() => {
                        if (!airQualityData) {
                          return <polyline points="3 12 21 12"/>;
                        }
                        // Same trend calculation for icon
                        const currentAQI = airQualityData.aqi;
                        const dayRangeMin = Math.max(0, currentAQI - 15);
                        const dayRangeMax = currentAQI + 15;
                        const rangeSpan = dayRangeMax - dayRangeMin;
                        const lowerThird = dayRangeMin + (rangeSpan * 0.33);
                        const upperThird = dayRangeMin + (rangeSpan * 0.67);
                        
                        if (currentAQI <= lowerThird) {
                          return <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>;
                        } else if (currentAQI >= upperThird) {
                          return <polyline points="1 18 8.5 10.5 13.5 15.5 23 6"/>;
                        } else {
                          return <polyline points="3 12 21 12"/>;
                        }
                      })()}
                    </svg>
                    {(() => {
                      if (!airQualityData) return 'Stable';
                      // Same trend calculation for text
                      const currentAQI = airQualityData.aqi;
                      const dayRangeMin = Math.max(0, currentAQI - 15);
                      const dayRangeMax = currentAQI + 15;
                      const rangeSpan = dayRangeMax - dayRangeMin;
                      const lowerThird = dayRangeMin + (rangeSpan * 0.33);
                      const upperThird = dayRangeMin + (rangeSpan * 0.67);
                      
                      if (currentAQI <= lowerThird) return 'Improving';
                      if (currentAQI >= upperThird) return 'Worsening';
                      return 'Stable';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          <div className="stat-card">
            <div className="stat-icon pm25">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="12" cy="12" r="8"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{airQualityData?.pm25 || '--'}</div>
              <div className="stat-label">PM2.5</div>
              <div className="stat-unit">μg/m³</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon ozone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
                <path d="M8 12h8"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{airQualityData?.o3 || '--'}</div>
              <div className="stat-label">Ozone</div>
              <div className="stat-unit">μg/m³</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon no2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{airQualityData?.no2 || '--'}</div>
              <div className="stat-label">NO2</div>
              <div className="stat-unit">μg/m³</div>
            </div>
          </div>
        </div>
      </section>

      {/* Weather & Environmental Data */}
      <section className="environmental-data">
        <div className={`data-grid ${weatherData || alerts.length > 0 ? 'data-loaded' : ''}`}>
          <div className="data-card weather-card">
            <div className="card-header">
              <h4>Weather Conditions</h4>
              <div className="weather-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                </svg>
              </div>
            </div>
            <div className="weather-data">
              <div className="weather-item">
                <span className="weather-label">Temperature</span>
                <span className="weather-value">{weatherData?.temperature || '--'}°C</span>
              </div>
              <div className="weather-item">
                <span className="weather-label">Humidity</span>
                <span className="weather-value">{weatherData?.humidity || '--'}%</span>
              </div>
              <div className="weather-item">
                <span className="weather-label">Wind Speed</span>
                <span className="weather-value">{weatherData?.windSpeed || '--'} km/h</span>
              </div>
              <div className="weather-item">
                <span className="weather-label">Pressure</span>
                <span className="weather-value">{weatherData?.pressure || '--'} hPa</span>
              </div>
              <div className="weather-item">
                <span className="weather-label">Visibility</span>
                <span className="weather-value">{weatherData?.visibility || '--'} km</span>
              </div>
              <div className="weather-item">
                <span className="weather-label">Wind Dir</span>
                <span className="weather-value">{weatherData?.windDirection || '--'}</span>
              </div>
            </div>
          </div>
          
          <div className="data-card alerts-card">
            <div className="card-header">
              <h4>Air Quality Alerts</h4>
              <div className="alert-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <div className="alerts-list">
              {alerts.length > 0 ? (
                alerts.map(alert => (
                  <div key={alert.id} className={`alert-item ${alert.type}`}>
                    <div className="alert-content">
                      <span className="alert-message">{alert.message}</span>
                      <span className="alert-time">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-alerts">
                  <div className="no-alerts-icon">✓</div>
                  <span>No active alerts</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Quick Actions */}
      <section className="quick-actions">
          <h3 className="section-title quick-title">Quick Actions</h3>

        <div className="actions-grid">
          <button className="action-card primary" onClick={handleViewMapClick}>
            <div className="action-content">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div className="action-text action-text-left">
                <span className="action-title">View Map</span>
                <span className="action-subtitle">Interactive air quality map coming soon</span>
              </div>
            </div>
            <div className="action-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
          
          <button className="action-card" onClick={() => openModal('alert')}>
            <div className="action-content">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div className="action-text action-text-left">
                <span className="action-title">Set Alerts</span>
                <span className="action-subtitle">Custom Push notifications for air quality</span>
              </div>
            </div>
            <div className="action-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
          
          <button className="action-card" onClick={() => window.location.href = '/dashboard'}>
            <div className="action-content">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v5h5"/>
                  <path d="M21 21v-5h-5"/>
                  <path d="M21 3H3v18h18z"/>
                  <path d="M7 12h10"/>
                  <path d="M12 7v10"/>
                </svg>
              </div>
              <div className="action-text action-text-left">
                <span className="action-title">Analytics</span>
                <span className="action-subtitle">Detailed insights with graphs & predictions</span>
              </div>
            </div>
            <div className="action-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
          
          <button className="action-card">
            <div className="action-content">
              <div className="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                </svg>
              </div>
              <div className="action-text action-text-left">
                <span className="action-title">More Information</span>
                <span className="action-subtitle">Github Repository</span>
              </div>
            </div>
            <div className="action-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
          
          {/* Health Assessment - Two Width Action Card */}
          <button className="action-card health-assessment-wide" onClick={() => openModal('health')}>
            <div className="action-content">
              <div className="action-icon health-icon-fixed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"/>
                </svg>
              </div>
              <div className="action-text action-text-left">
                <span className="action-title">Do you have any health issues related to air quality?</span>
                <span className="action-subtitle">
                  {healthProfile ? 
                    'Update your health profile for personalized recommendations' : 
                    'Complete a quick health assessment for personalized air quality guidance'
                  }
                </span>
                {healthProfile && (
                  <div className="health-status-inline">
                    <span className="status-label">Current Risk Level:</span>
                    <span className={`status-value ${getHealthRiskLevel(airQualityData?.aqi || 0, healthProfile).toLowerCase().replace(/ /g, '-')}`}>
                      {getHealthRiskLevel(airQualityData?.aqi || 0, healthProfile)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="action-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
        </div>
      </section>
      
      {/* Alert Settings Modal */}
      {showAlertModal && (
        <div className="modal-overlay" onClick={() => closeModal('alert')}>
          <div 
            className="alert-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Air Quality Alerts</h3>
              <button className="close-btn" onClick={() => closeModal('alert')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              {/* Existing Alerts */}
              <div className="existing-alerts">
                <h4>Active Alerts ({alertSettings.filter(a => a.enabled).length})</h4>
                {alertSettings.length === 0 ? (
                  <p className="no-alerts-message">No alerts configured yet.</p>
                ) : (
                  <div className="alerts-list">
                    {alertSettings.map(alert => (
                      <div key={alert.id} className={`alert-item ${alert.enabled ? 'enabled' : 'disabled'}`}>
                        <div className="alert-info">
                          <span className="alert-name">{alert.name}</span>
                          <span className="alert-details">
                            {alert.pollutant.toUpperCase()} {alert.condition} {alert.aqiThreshold}
                          </span>
                        </div>
                        <div className="alert-controls">
                          <button 
                            className={`toggle-btn ${alert.enabled ? 'enabled' : 'disabled'}`}
                            onClick={() => toggleAlert(alert.id)}
                          >
                            {alert.enabled ? 'ON' : 'OFF'}
                          </button>
                          <button className="delete-btn" onClick={() => deleteAlert(alert.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3,6 5,6 21,6"/>
                              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Create New Alert */}
              <div className="new-alert-section">
                <h4>Create New Alert</h4>
                <div className="alert-form">
                  <div className="form-group">
                    <label>Alert Name</label>
                    <input 
                      type="text" 
                      value={newAlert.name || ''}
                      onChange={(e) => setNewAlert(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., High PM2.5 Warning"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Pollutant</label>
                      <select 
                        value={newAlert.pollutant || 'aqi'}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, pollutant: e.target.value as any }))}
                      >
                        <option value="aqi">AQI</option>
                        <option value="pm25">PM2.5</option>
                        <option value="pm10">PM10</option>
                        <option value="o3">Ozone</option>
                        <option value="no2">NO2</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Condition</label>
                      <select 
                        value={newAlert.condition || 'above'}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, condition: e.target.value as any }))}
                      >
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Threshold</label>
                      <input 
                        type="number" 
                        value={newAlert.aqiThreshold || 100}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, aqiThreshold: parseInt(e.target.value) }))}
                        min="0"
                        max="500"
                      />
                    </div>
                  </div>
                  
                  <div className="form-options">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={newAlert.notificationEnabled ?? true}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, notificationEnabled: e.target.checked }))}
                      />
                      Enable push notifications
                    </label>
                  </div>
                  
                  <button className="create-alert-btn" onClick={createAlert} disabled={!newAlert.name?.trim()}>
                    Create Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Health Assessment Modal */}
      {showHealthModal && (
        <div className="modal-overlay" onClick={() => closeModal('health')}>
          <div 
            className="alert-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Health Assessment</h3>
              <button className="close-btn" onClick={() => closeModal('health')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="health-intro">
                <p>Help us provide personalized air quality recommendations based on your health profile.</p>
                {healthProfile && (
                  <div className="current-risk">
                    <span className="risk-label">Current Risk Level:</span>
                    <span className="risk-value">{getHealthRiskLevel(airQualityData?.aqi || 0, healthProfile)}</span>
                  </div>
                )}
              </div>
              
              <div className="health-form">
                <div className="form-section">
                  <h4>Medical Conditions</h4>
                  <div className="checkbox-grid">
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.hasAsthma || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, hasAsthma: e.target.checked }))}
                      />
                      <span>Asthma</span>
                    </label>
                    
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.hasAllergies || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, hasAllergies: e.target.checked }))}
                      />
                      <span>Allergies</span>
                    </label>
                    
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.hasHeartCondition || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, hasHeartCondition: e.target.checked }))}
                      />
                      <span>Heart Condition</span>
                    </label>
                    
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.hasRespiratoryIssues || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, hasRespiratoryIssues: e.target.checked }))}
                      />
                      <span>Respiratory Issues</span>
                    </label>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4>Lifestyle & Sensitivity</h4>
                  <div className="checkbox-grid">
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.exerciseOutdoors || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, exerciseOutdoors: e.target.checked }))}
                      />
                      <span>Exercise Outdoors</span>
                    </label>
                    
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.sensitiveToPollution || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, sensitiveToPollution: e.target.checked }))}
                      />
                      <span>Sensitive to Pollution</span>
                    </label>
                    
                    <label className="health-checkbox">
                      <input 
                        type="checkbox" 
                        checked={healthForm.takesAirQualityMeds || false}
                        onChange={(e) => setHealthForm(prev => ({ ...prev, takesAirQualityMeds: e.target.checked }))}
                      />
                      <span>Takes Air Quality Medications</span>
                    </label>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4>Demographics</h4>
                  <div className="form-group">
                    <label>Age Group</label>
                    <select 
                      value={healthForm.ageGroup || '18-40'}
                      onChange={(e) => setHealthForm(prev => ({ ...prev, ageGroup: e.target.value as any }))}
                    >
                      <option value="under-18">Under 18</option>
                      <option value="18-40">18-40</option>
                      <option value="41-65">41-65</option>
                      <option value="over-65">Over 65</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4>Additional Information</h4>
                  <div className="form-group">
                    <label>Other conditions or notes</label>
                    <textarea 
                      value={healthForm.additionalConditions || ''}
                      onChange={(e) => setHealthForm(prev => ({ ...prev, additionalConditions: e.target.value }))}
                      placeholder="Any other health conditions or notes regarding air quality sensitivity..."
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="form-actions">
                  <button className="save-health-btn" onClick={saveHealthProfile}>
                    {healthProfile ? 'Update Profile' : 'Save Profile'}
                  </button>
                  <div className="privacy-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span>Your health information is stored locally and never shared.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen Map Modal */}
      {showFullscreenMap && (
        <div className="fullscreen-map-overlay" onClick={closeFullscreenMap}>
          <div className="fullscreen-map-container" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-map-header">
              <div className="map-header-left">
                <h2>Global Air Quality Map</h2>
                <p>Real-time air quality monitoring worldwide</p>
              </div>
              <button className="close-fullscreen-btn" onClick={closeFullscreenMap}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="fullscreen-map-content">
              <div className="map-controls">
                <div className="control-group">
                  <label>Region:</label>
                  <select className="region-selector">
                    <option value="global">Global View</option>
                    <option value="north-america">North America</option>
                    <option value="europe">Europe</option>
                    <option value="asia">Asia</option>
                    <option value="oceania">Oceania</option>
                  </select>
                </div>
                
                <div className="control-group">
                  <label>Pollutant:</label>
                  <select className="pollutant-selector">
                    <option value="aqi">Air Quality Index</option>
                    <option value="pm25">PM2.5</option>
                    <option value="pm10">PM10</option>
                    <option value="o3">Ozone</option>
                    <option value="no2">NO2</option>
                    <option value="so2">SO2</option>
                  </select>
                </div>
                
                <div className="control-group">
                  <label>View:</label>
                  <div className="view-toggle">
                    <button className="view-btn active">Satellite</button>
                    <button className="view-btn">Street</button>
                  </div>
                </div>
              </div>
              
              <div className="fullscreen-map-main">
                <div className="dummy-map">
                  <div className="map-background"></div>
                  
                  {/* Enhanced location markers for fullscreen */}
                  <div className="fullscreen-locations">
                    <div className="location-marker-fs location-good" style={{ top: '15%', left: '35%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">42</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Toronto</span>
                        <span className="marker-details">PM2.5: 12 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-moderate" style={{ top: '70%', left: '18%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">78</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Chicago</span>
                        <span className="marker-details">PM2.5: 23 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-unhealthy" style={{ top: '70%', left: '40%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">156</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Atlanta</span>
                        <span className="marker-details">PM2.5: 65 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-good" style={{ top: '30%', left: '14%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">35</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Seattle</span>
                        <span className="marker-details">PM2.5: 8 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-moderate" style={{ top: '65%', left: '75%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">89</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">New York</span>
                        <span className="marker-details">PM2.5: 28 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-good" style={{ top: '25%', left: '60%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">48</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">London</span>
                        <span className="marker-details">PM2.5: 14 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-moderate" style={{ top: '45%', left: '85%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">112</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Tokyo</span>
                        <span className="marker-details">PM2.5: 35 μg/m³</span>
                      </div>
                    </div>
                    
                    <div className="location-marker-fs location-unhealthy" style={{ top: '50%', left: '70%' }}>
                      <div className="marker-pulse"></div>
                      <span className="marker-aqi-fs">168</span>
                      <div className="marker-info">
                        <span className="marker-city-fs">Delhi</span>
                        <span className="marker-details">PM2.5: 78 μg/m³</span>
                      </div>
                    </div>
                    
                    {userLocation && (
                      <div className="location-marker-fs location-current" style={{ top: '30%', left: '50%' }}>
                        <div className="marker-pulse current-pulse"></div>
                        <span className="marker-aqi-fs">{airQualityData?.aqi || '--'}</span>
                        <div className="marker-info">
                          <span className="marker-city-fs">Your Location</span>
                          <span className="marker-details">PM2.5: {airQualityData?.pm25 || '--'} μg/m³</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Fullscreen map legend */}
                  <div className="fullscreen-legend">
                    <h4>Air Quality Index</h4>
                    <div className="legend-items">
                      <div className="legend-item-fs">
                        <div className="legend-color-fs good"></div>
                        <span>Good (0-50)</span>
                      </div>
                      <div className="legend-item-fs">
                        <div className="legend-color-fs moderate"></div>
                        <span>Moderate (51-100)</span>
                      </div>
                      <div className="legend-item-fs">
                        <div className="legend-color-fs unhealthy-sensitive"></div>
                        <span>Unhealthy for Sensitive (101-150)</span>
                      </div>
                      <div className="legend-item-fs">
                        <div className="legend-color-fs unhealthy"></div>
                        <span>Unhealthy (151-200)</span>
                      </div>
                      <div className="legend-item-fs">
                        <div className="legend-color-fs very-unhealthy"></div>
                        <span>Very Unhealthy (201-300)</span>
                      </div>
                      <div className="legend-item-fs">
                        <div className="legend-color-fs hazardous"></div>
                        <span>Hazardous (301+)</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Map info panel */}
                  <div className="map-info-panel">
                    <div className="info-stats">
                      <div className="info-stat">
                        <span className="stat-label">Global Average</span>
                        <span className="stat-value">72 AQI</span>
                      </div>
                      <div className="info-stat">
                        <span className="stat-label">Monitoring Stations</span>
                        <span className="stat-value">15,000+</span>
                      </div>
                      <div className="info-stat">
                        <span className="stat-label">Last Updated</span>
                        <span className="stat-value">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="interactive-coming-soon">
                    <div className="coming-soon-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      <span>Interactive features coming soon</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Home;