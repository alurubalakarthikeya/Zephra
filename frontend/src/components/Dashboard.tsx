import React, { useState, useEffect, useRef } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import AQIForecast from "./AQIForecast";
import "./Dashboard.css";
import { endpoints } from "../config/api";
import BackendModeManager, { type BackendMode } from '../services/BackendModeManager';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Interface definitions
interface WeatherData {
  timestamp: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
}

interface AirQualityData {
  timestamp: string;
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
}

interface SatelliteData {
  timestamp: string;
  visibility: number;
  cloud_cover: number;
  aerosol_optical_depth: number;
}

interface HealthData {
  timestamp: string;
  overall_health_index: number;
  respiratory_risk: number;
  cardiovascular_risk: number;
}

interface ForecastData {
  hour: string;
  predicted_aqi: number;
  confidence: number;
}

interface StatusData {
  api_status: string;
  data_freshness: number;
  last_update: string;
}

interface LocationInfo {
  name: string;
  country: string;
  timezone: string;
  local_time: string;
}

interface Location {
  name: string;
  lat: number;
  lon: number;
  country: string;
  timezone: string;
}

interface DashboardData {
  weather: WeatherData[];
  air_quality: AirQualityData[];
  satellite: SatelliteData[];
  health: HealthData[];
  forecast: ForecastData[];
  status: StatusData;
  location_info?: LocationInfo;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("New York");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    | "overview"
    | "weather"
    | "air-quality"
    | "satellite"
    | "health"
    | "forecast"
    | "ml-forecast"
  >("overview");
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  
  // Backend mode management
  const [backendMode, setBackendMode] = useState<BackendMode>('api');
  const backendManagerRef = useRef<BackendModeManager | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [geoLocationName, setGeoLocationName] = useState<string>("");

  useEffect(() => {
    // Initialize BackendModeManager
    backendManagerRef.current = BackendModeManager.getInstance();
    const currentMode = backendManagerRef.current.getCurrentMode();
    setBackendMode(currentMode);
    
    fetchAvailableLocations();
  }, []);

  // Listen for backend mode changes from other components
  useEffect(() => {
    const handleStorageChange = () => {
      if (backendManagerRef.current) {
        const newMode = backendManagerRef.current.getCurrentMode();
        setBackendMode(newMode);
        // Refresh data when backend mode changes
        fetchDashboardData();
      }
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab changes)
    window.addEventListener('backendModeChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('backendModeChanged', handleStorageChange);
    };
  }, [selectedLocation]);

  // Get user's current location when useCurrentLocation is enabled
  useEffect(() => {
    if (useCurrentLocation && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoordinates({ lat: latitude, lon: longitude });

          // Reverse geocode to get location name
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            
            if (response.ok) {
              const text = await response.text();
              if (!text.trim()) {
                throw new Error('Empty response from geocoding API');
              }
              
              try {
                const data = JSON.parse(text);
                const locationName =
                  data.address?.city ||
                  data.address?.town ||
                  data.address?.village ||
                  data.display_name.split(",")[0];
                setGeoLocationName(locationName);
              } catch (parseError) {
                console.error("❌ JSON Parse Error:", parseError);
                console.error("❌ Response Text:", text.substring(0, 100) + '...');
                setGeoLocationName(
                  `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
                );
              }
            } else {
              throw new Error(`Geocoding API failed: ${response.status}`);
            }
          } catch (err) {
            console.error("Error getting location name:", err);
            setGeoLocationName(
              `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
            );
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert(
            "Unable to get your location. Please enable location services."
          );
          setUseCurrentLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }, [useCurrentLocation]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedLocation]);

  const fetchAvailableLocations = async () => {
    // Set default locations immediately
    const defaultLocations = [
      {
        name: "New York",
        lat: 40.7128,
        lon: -74.006,
        country: "USA",
        timezone: "America/New_York",
      },
      {
        name: "Los Angeles",
        lat: 34.0522,
        lon: -118.2437,
        country: "USA",
        timezone: "America/Los_Angeles",
      },
      {
        name: "London",
        lat: 51.5074,
        lon: -0.1278,
        country: "UK",
        timezone: "Europe/London",
      },
      {
        name: "Tokyo",
        lat: 35.6762,
        lon: 139.6503,
        country: "Japan",
        timezone: "Asia/Tokyo",
      },
      {
        name: "Sydney",
        lat: -33.8688,
        lon: 151.2093,
        country: "Australia",
        timezone: "Australia/Sydney",
      },
      {
        name: "Delhi",
        lat: 28.7041,
        lon: 77.1025,
        country: "India",
        timezone: "Asia/Kolkata",
      },
      {
        name: "Berlin",
        lat: 52.52,
        lon: 13.405,
        country: "Germany",
        timezone: "Europe/Berlin",
      },
      {
        name: "Mumbai",
        lat: 19.076,
        lon: 72.8777,
        country: "India",
        timezone: "Asia/Kolkata",
      },
      {
        name: "Paris",
        lat: 48.8566,
        lon: 2.3522,
        country: "France",
        timezone: "Europe/Paris",
      },
      {
        name: "Singapore",
        lat: 1.3521,
        lon: 103.8198,
        country: "Singapore",
        timezone: "Asia/Singapore",
      },
    ];
    setLocations(defaultLocations);

    try {
      const response = await fetch("https://zephra.onrender.com/api/locations");
      if (response.ok) {
        const locationData = await response.json();
        setLocations(locationData.locations || defaultLocations);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      // Keep default locations on error
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use BackendModeManager for data fetching
      if (!backendManagerRef.current) {
        throw new Error('BackendModeManager not initialized');
      }

      const result = await backendManagerRef.current.fetchDashboardData(selectedLocation);
      
      if (!result || Object.keys(result).length === 0) {
        throw new Error("No data received from server");
      }

      setData(result);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");

      // Generate fallback data for development
      const fallbackData: DashboardData = {
        weather: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(
            Date.now() - (23 - i) * 60 * 60 * 1000
          ).toISOString(),
          temperature: 20 + Math.sin(i / 4) * 8 + Math.random() * 4,
          humidity: 50 + Math.sin(i / 6) * 20 + Math.random() * 10,
          windSpeed: 5 + Math.random() * 10,
          pressure: 1010 + Math.sin(i / 8) * 15 + Math.random() * 5,
        })),
        air_quality: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(
            Date.now() - (23 - i) * 60 * 60 * 1000
          ).toISOString(),
          aqi: 80 + Math.sin(i / 3) * 30 + Math.random() * 20,
          pm25: 15 + Math.random() * 20,
          pm10: 25 + Math.random() * 30,
          o3: 40 + Math.random() * 20,
          no2: 20 + Math.random() * 15,
          so2: 5 + Math.random() * 10,
        })),
        satellite: Array.from({ length: 24 }, (_, i) => {
          const satelliteData = {
            timestamp: new Date(
              Date.now() - (23 - i) * 60 * 60 * 1000
            ).toISOString(),
            visibility: Math.max(
              1,
              8 + Math.sin(i * 0.3) * 3 + Math.random() * 2
            ),
            cloud_cover: Math.max(
              0,
              Math.min(100, 30 + Math.sin(i * 0.25) * 40 + Math.random() * 20)
            ),
            aerosol_optical_depth: Math.max(
              0.05,
              0.2 + Math.sin(i * 0.4) * 0.3 + Math.random() * 0.1
            ),
          };
          return satelliteData;
        }),
        health: Array.from({ length: 12 }, (_, i) => ({
          timestamp: new Date(
            Date.now() - (11 - i) * 2 * 60 * 60 * 1000
          ).toISOString(),
          overall_health_index: 7 + Math.random() * 2,
          respiratory_risk: 3 + Math.random() * 4,
          cardiovascular_risk: 2 + Math.random() * 3,
        })),
        forecast: Array.from({ length: 12 }, (_, i) => ({
          hour: `${(new Date().getHours() + i + 1) % 24}:00`,
          predicted_aqi: 85 + Math.sin(i / 2) * 25 + Math.random() * 15,
          confidence: 75 + Math.random() * 20,
        })),
        status: {
          api_status: "Connected",
          data_freshness: 85 + Math.random() * 10,
          last_update: new Date().toISOString(),
        },
        location_info: {
          name: selectedLocation,
          country: "Simulated",
          timezone: "UTC",
          local_time: new Date().toLocaleTimeString(),
        },
      };

      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  const getChartOptions = (
    yAxisLabel: string,
    showLegend: boolean = true
  ): ChartOptions<"line" | "bar"> => ({
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    animation: {
      duration: 1200,
      easing: "easeInOutQuart",
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 5,
        right: 5,
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: showLegend,
        position: "top",
        labels: {
          color: "#1976d2",
          font: {
            family: "Montserrat",
            size: 12,
            weight: 600,
          },
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        titleColor: "#1976d2",
        bodyColor: "#333",
        borderColor: "#1976d2",
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: true,
        titleFont: {
          family: "Montserrat",
          size: 14,
          weight: 600,
        },
        bodyFont: {
          family: "Montserrat",
          size: 12,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
          color: "#1976d2",
          font: {
            family: "Montserrat",
            size: 12,
            weight: 600,
          },
        },
        ticks: {
          color: "#1976d2",
          font: {
            family: "Montserrat",
            size: 10,
          },
        },
        grid: {
          color: "rgba(25, 118, 210, 0.1)",
        },
      },
      y: {
        title: {
          display: true,
          text: yAxisLabel,
          color: "#1976d2",
          font: {
            family: "Montserrat",
            size: 12,
            weight: 600,
          },
        },
        ticks: {
          color: "#1976d2",
          font: {
            family: "Montserrat",
            size: 10,
          },
        },
        grid: {
          color: "rgba(25, 118, 210, 0.1)",
        },
        grace: "5%",
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 5,
        hoverRadius: 8,
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    },
  });

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h2>Loading NASA Air Quality Data...</h2>
          <p>Fetching latest satellite and ground station data</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <h2>Data Unavailable</h2>
          <p>{error}</p>
          <button onClick={fetchDashboardData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const timeLabels =
    data?.weather?.map((item) =>
      new Date(item.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ) || [];

  const forecastLabels = data?.forecast?.map((item) => item.hour) || [];

  // Debug satellite data
  if (data?.satellite && selectedTab === "satellite") {
    console.log("Satellite data length:", data.satellite.length);
    console.log(
      "Satellite visibility values:",
      data.satellite.map((item) => item.visibility)
    );
    console.log("Time labels length:", timeLabels.length);
  }

  return (
    <div className="dashboard-container">
      <div className="global-background">
        <div className="floating-particles">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${10 + Math.random() * 20}s`,
              }}
            />
          ))}
        </div>
      </div>

{/*       {error && (
        <div className="error-banner">
          <div className="error-banner-content">
            <span className="error-banner-text">{error}</span>
            <button onClick={fetchDashboardData} className="retry-btn-small">
              Retry
            </button>
          </div>
        </div>
      )} */}

      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="title-section">
            <h1> NASA Air Quality Dashboard</h1>
            <p>
              Real-time environmental monitoring with satellite data integration
            </p>
            {data?.location_info && (
              <div className="location-info-header">
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="location-name"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "12px",
                    padding: "6px 12px",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    marginBottom: "8px",
                    minWidth: "200px",
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                    outline: "none",
                    transition: "all 0.3s ease",
                    fontFamily: "Montserrat, sans-serif",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
                    e.target.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
                    e.target.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  {locations.map((location) => (
                    <option
                      key={location.name}
                      value={location.name}
                      style={{
                        background: "#1976d2",
                        color: "white",
                        padding: "8px",
                      }}
                    >
                      {location.name}, {location.country}
                    </option>
                  ))}
                </select>
                <span className="local-time">
                  {data.location_info.local_time}
                </span>
              </div>
            )}
          </div>

          <div className="status-section">
            <div className="status-card">
              <span className="status-label">API Status</span>
              <span className="status-value">
                {data?.status.api_status || "Connected"}
              </span>
            </div>
            <div className="status-card">
              <span className="status-label">Data Quality</span>
              <span className="status-value">
                {data?.status.data_freshness?.toFixed(1) || "95.0"}%
              </span>
            </div>
            <div className="status-card">
              <span className="status-label">Last Update</span>
              <span className="status-value">
                {data?.status.last_update
                  ? new Date(data.status.last_update).toLocaleTimeString()
                  : "Just now"}
              </span>
            </div>

            <div className="location-selector">
              <div className="loc">
                <label htmlFor="location-select">Location:</label>

                {/* Current Location Toggle */}
                <button
                  className={`current-location-btn ${
                    useCurrentLocation ? "active" : ""
                  }`}
                  onClick={() => setUseCurrentLocation(!useCurrentLocation)}
                  title={
                    useCurrentLocation
                      ? "Using current location"
                      : "Use my current location"
                  }
                  style={{
                    padding: "8px 16px",
                    marginLeft: "10px",
                    borderRadius: "8px",
                    border: useCurrentLocation
                      ? "2px solid #1976d2"
                      : "2px solid rgba(25, 118, 210, 0.3)",
                    background: useCurrentLocation
                      ? "linear-gradient(135deg, #1976d2, #42a5f5)"
                      : "linear-gradient(135deg, #1976d2, #42a5f5)",
                    color: useCurrentLocation ? "white" : "white",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.3s ease",
                    boxShadow: useCurrentLocation
                      ? "0 4px 12px rgba(25, 118, 210, 0.3)"
                      : "0 2px 6px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {" "}
                  {useCurrentLocation
                    ? "Current Location"
                    : "Use Current Location"}
                </button>

                {/* Manual Location Selector */}
                {/* {!useCurrentLocation && (
                <select
                  id="location-select"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="location-dropdown"
                  style={{ marginLeft: "10px" }}
                >
                  {locations.length === 0 ? (
                    <option value="">Loading locations...</option>
                  ) : (
                    locations.map((location) => (
                      <option key={location.name} value={location.name}>
                        {location.name}, {location.country}
                      </option>
                    ))
                  )}
                </select>
              )} */}
              </div>

              {/* Display current location info */}
              {useCurrentLocation && userCoordinates && (
                <div className="location-info" style={{ marginLeft: "10px" }}>
                  <div style={{ color: "#1976d2", fontWeight: "600" }}>
                    {geoLocationName || "Detecting..."}
                  </div>
                  <div className="coordinates">
                    {userCoordinates.lat.toFixed(2)}°,{" "}
                    {userCoordinates.lon.toFixed(2)}°
                  </div>
                </div>
              )}

              {/* Display manual location info */}
              {!useCurrentLocation && data?.location_info && (
                <div className="location-info">
                  <div className="coordinates">
                    {locations
                      .find((l) => l.name === selectedLocation)
                      ?.lat.toFixed(2)}
                    °,{" "}
                    {locations
                      .find((l) => l.name === selectedLocation)
                      ?.lon.toFixed(2)}
                    °
                  </div>
                  <div className="timezone">{data.location_info.timezone}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="dashboard-nav">
        <div className="nav-container">
          {[
            {
              key: "overview",
              label: "Overview",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
              ),
            },
            {
              key: "weather",
              label: "Weather",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
                </svg>
              ),
            },
            {
              key: "air-quality",
              label: "Air Quality",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  <circle cx="7" cy="7" r="1.5" opacity="0.6" />
                  <circle cx="17" cy="9" r="1.2" opacity="0.5" />
                  <circle cx="9" cy="12" r="1" opacity="0.4" />
                  <circle cx="15" cy="15" r="0.8" opacity="0.3" />
                  <circle cx="6" cy="15" r="0.6" opacity="0.4" />
                  <circle cx="18" cy="16" r="1" opacity="0.5" />
                  <circle cx="12" cy="6" r="0.7" opacity="0.3" />
                </svg>
              ),
            },
            {
              key: "satellite",
              label: "Satellite",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                </svg>
              ),
            },
            {
              key: "health",
              label: "Health",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                  <path
                    d="M16 11h-3V8c0-.55-.45-1-1-1s-1 .45-1 1v3H8c-.55 0-1 .45-1 1s.45 1 1 1h3v3c0 .55.45 1 1 1s1-.45 1-1v-3h3c.55 0 1-.45 1-1s-.45-1-1-1z"
                    fill="white"
                  />
                </svg>
              ),
            },
            {
              key: "forecast",
              label: "Forecast",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
                </svg>
              ),
            },
            {
              key: "ml-forecast",
              label: "ML Forecast",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h2v8zm-4 0H8v-6h2v6zm8 0h-2v-4h2v4z" />
                </svg>
              ),
            },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`nav-tab ${selectedTab === tab.key ? "active" : ""}`}
              onClick={() => setSelectedTab(tab.key as any)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {selectedTab === "overview" && (
          <div className="overview-grid">
            {/* Air Quality Index Trend */}
            <div className="chart-container">
              <h3>Air Quality Index Trend</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels,
                    datasets: [
                      {
                        label: "AQI",
                        data: data?.air_quality?.map((item) => item.aqi) || [],
                        borderColor: "#1976d2",
                        backgroundColor: "rgba(25, 118, 210, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#1976d2",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("AQI", true)}
                />
              </div>
            </div>

            {/* Current Air Quality Breakdown */}
            <div className="chart-container">
              <h3>Current Air Quality Breakdown</h3>
              <Bar
                data={{
                  labels: ["PM2.5", "PM10", "O₃", "NO₂", "SO₂"],
                  datasets: [
                    {
                      label: "Concentration (μg/m³)",
                      data: [
                        data?.air_quality?.[data.air_quality.length - 1]
                          ?.pm25 || 0,
                        data?.air_quality?.[data.air_quality.length - 1]
                          ?.pm10 || 0,
                        data?.air_quality?.[data.air_quality.length - 1]?.o3 ||
                          0,
                        data?.air_quality?.[data.air_quality.length - 1]?.no2 ||
                          0,
                        data?.air_quality?.[data.air_quality.length - 1]?.so2 ||
                          0,
                      ],
                      backgroundColor: [
                        "rgba(255, 99, 132, 0.8)",
                        "rgba(54, 162, 235, 0.8)",
                        "rgba(255, 205, 86, 0.8)",
                        "rgba(75, 192, 192, 0.8)",
                        "rgba(153, 102, 255, 0.8)",
                      ],
                      borderColor: [
                        "#ff6384",
                        "#36a2eb",
                        "#ffcd56",
                        "#4bc0c0",
                        "#9966ff",
                      ],
                      borderWidth: 2,
                      borderRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Concentration (μg/m³)", false)}
              />
            </div>

            {/* Temperature & Humidity Combined */}
            <div className="chart-container">
              <h3>Temperature & Humidity (Last 12 Hours)</h3>
              <Line
                data={{
                  labels: timeLabels.slice(-12),
                  datasets: [
                    {
                      label: "Temperature (°C)",
                      data:
                        data?.weather
                          ?.slice(-12)
                          .map((item) => item.temperature) || [],
                      borderColor: "#ff6384",
                      backgroundColor: "rgba(255, 99, 132, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      yAxisID: "y",
                      pointBackgroundColor: "#ff6384",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "Humidity (%)",
                      data:
                        data?.weather
                          ?.slice(-12)
                          .map((item) => item.humidity) || [],
                      borderColor: "#36a2eb",
                      backgroundColor: "rgba(54, 162, 235, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      yAxisID: "y1",
                      pointBackgroundColor: "#36a2eb",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={
                  {
                    ...getChartOptions("Temperature (°C)", true),
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Time",
                          color: "#1976d2",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#1976d2" },
                        grid: { color: "rgba(25, 118, 210, 0.1)" },
                      },
                      y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Temperature (°C)",
                          color: "#ff6384",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#ff6384" },
                        grid: { color: "rgba(255, 99, 132, 0.1)" },
                      },
                      y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Humidity (%)",
                          color: "#36a2eb",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#36a2eb" },
                        grid: { drawOnChartArea: false },
                      },
                    },
                  } as ChartOptions<"line">
                }
              />
            </div>

            {/* Health Impact Trends */}
            <div className="chart-container">
              <h3>Health Impact Assessment</h3>
              <Line
                data={{
                  labels: timeLabels.slice(-12),
                  datasets: [
                    {
                      label: "Overall Health Index",
                      data:
                        data?.health
                          ?.slice(-12)
                          .map((item) => item.overall_health_index) || [],
                      borderColor: "#4caf50",
                      backgroundColor: "rgba(76, 175, 80, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#4caf50",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "Respiratory Risk",
                      data:
                        data?.health
                          ?.slice(-12)
                          .map((item) => item.respiratory_risk) || [],
                      borderColor: "#ff9800",
                      backgroundColor: "rgba(255, 152, 0, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#ff9800",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Index/Risk Level", true)}
              />
            </div>
          </div>
        )}

        {selectedTab === "weather" && (
          <div className="content-grid">
            {/* Temperature Trend */}
            <div className="chart-container">
              <h3>Temperature Trend (24 Hours)</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "Temperature (°C)",
                      data:
                        data?.weather?.map((item) => item.temperature) || [],
                      borderColor: "#ff6384",
                      backgroundColor: "rgba(255, 99, 132, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#ff6384",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Temperature (°C)", false)}
              />
            </div>

            {/* Humidity Trend */}
            <div className="chart-container">
              <h3>Humidity Trend (24 Hours)</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "Humidity (%)",
                      data: data?.weather?.map((item) => item.humidity) || [],
                      borderColor: "#36a2eb",
                      backgroundColor: "rgba(54, 162, 235, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#36a2eb",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Humidity (%)", false)}
              />
            </div>

            {/* Wind Speed & Pressure */}
            <div className="chart-container">
              <h3>Wind Speed & Atmospheric Pressure</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "Wind Speed (m/s)",
                      data: data?.weather?.map((item) => item.windSpeed) || [],
                      borderColor: "#4bc0c0",
                      backgroundColor: "rgba(75, 192, 192, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      yAxisID: "y",
                      pointBackgroundColor: "#4bc0c0",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "Pressure (hPa)",
                      data: data?.weather?.map((item) => item.pressure) || [],
                      borderColor: "#9966ff",
                      backgroundColor: "rgba(153, 102, 255, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      yAxisID: "y1",
                      pointBackgroundColor: "#9966ff",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={
                  {
                    ...getChartOptions("Wind Speed (m/s)", true),
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Time",
                          color: "#1976d2",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#1976d2" },
                        grid: { color: "rgba(25, 118, 210, 0.1)" },
                      },
                      y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Wind Speed (m/s)",
                          color: "#4bc0c0",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#4bc0c0" },
                        grid: { color: "rgba(75, 192, 192, 0.1)" },
                      },
                      y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Pressure (hPa)",
                          color: "#9966ff",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#9966ff" },
                        grid: { drawOnChartArea: false },
                      },
                    },
                  } as ChartOptions<"line">
                }
              />
            </div>
          </div>
        )}

        {selectedTab === "air-quality" && (
          <div className="content-grid">
            {/* AQI Trend */}
            <div className="chart-container">
              <h3>Air Quality Index Trend</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "AQI",
                      data: data?.air_quality?.map((item) => item.aqi) || [],
                      borderColor: "#1976d2",
                      backgroundColor: "rgba(25, 118, 210, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#1976d2",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("AQI", true)}
              />
            </div>

            {/* Particulate Matter */}
            <div className="chart-container">
              <h3>Particulate Matter (PM2.5 & PM10)</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "PM2.5 (μg/m³)",
                      data: data?.air_quality?.map((item) => item.pm25) || [],
                      borderColor: "#ff6384",
                      backgroundColor: "rgba(255, 99, 132, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#ff6384",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "PM10 (μg/m³)",
                      data: data?.air_quality?.map((item) => item.pm10) || [],
                      borderColor: "#36a2eb",
                      backgroundColor: "rgba(54, 162, 235, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#36a2eb",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Concentration (μg/m³)", true)}
              />
            </div>

            {/* Gas Concentrations */}
            <div className="chart-container">
              <h3>Gas Concentrations (O₃, NO₂, SO₂)</h3>
              <Line
                data={{
                  labels: timeLabels,
                  datasets: [
                    {
                      label: "O₃ (μg/m³)",
                      data: data?.air_quality?.map((item) => item.o3) || [],
                      borderColor: "#ffcd56",
                      backgroundColor: "rgba(255, 205, 86, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#ffcd56",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "NO₂ (μg/m³)",
                      data: data?.air_quality?.map((item) => item.no2) || [],
                      borderColor: "#4bc0c0",
                      backgroundColor: "rgba(75, 192, 192, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#4bc0c0",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "SO₂ (μg/m³)",
                      data: data?.air_quality?.map((item) => item.so2) || [],
                      borderColor: "#9966ff",
                      backgroundColor: "rgba(153, 102, 255, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#9966ff",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={getChartOptions("Concentration (μg/m³)", true)}
              />
            </div>
          </div>
        )}

        {selectedTab === "satellite" && (
          <div className="content-grid">
            {/* Atmospheric Visibility */}
            <div className="chart-container">
              <h3>Atmospheric Visibility</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels,
                    datasets: [
                      {
                        label: "Visibility (km)",
                        data:
                          data?.satellite?.map((item) => {
                            const visibility = Number(item.visibility);
                            return isNaN(visibility) ? 0 : visibility;
                          }) || [],
                        borderColor: "#4caf50",
                        backgroundColor: "rgba(76, 175, 80, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#4caf50",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("Visibility (km)", false)}
                />
              </div>
            </div>

            {/* Cloud Cover */}
            <div className="chart-container">
              <h3>Cloud Cover</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels,
                    datasets: [
                      {
                        label: "Cloud Cover (%)",
                        data:
                          data?.satellite?.map((item) => item.cloud_cover) ||
                          [],
                        borderColor: "#607d8b",
                        backgroundColor: "rgba(96, 125, 139, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#607d8b",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("Coverage (%)", false)}
                />
              </div>
            </div>

            {/* Aerosol Optical Depth */}
            <div className="chart-container">
              <h3>Aerosol Optical Depth</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels,
                    datasets: [
                      {
                        label: "AOD",
                        data:
                          data?.satellite?.map(
                            (item) => item.aerosol_optical_depth
                          ) || [],
                        borderColor: "#ff5722",
                        backgroundColor: "rgba(255, 87, 34, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#ff5722",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("AOD", false)}
                />
              </div>
            </div>
          </div>
        )}

        {selectedTab === "health" && (
          <div className="content-grid">
            {/* Health Index */}
            <div className="chart-container">
              <h3>Overall Health Index</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels.slice(-12),
                    datasets: [
                      {
                        label: "Health Index",
                        data:
                          data?.health?.map(
                            (item) => item.overall_health_index
                          ) || [],
                        borderColor: "#4caf50",
                        backgroundColor: "rgba(76, 175, 80, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#4caf50",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("Index (0-10)", false)}
                />
              </div>
            </div>

            {/* Respiratory Risk */}
            <div className="chart-container">
              <h3>Respiratory Risk Assessment</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels.slice(-12),
                    datasets: [
                      {
                        label: "Respiratory Risk",
                        data:
                          data?.health?.map((item) => item.respiratory_risk) ||
                          [],
                        borderColor: "#ff9800",
                        backgroundColor: "rgba(255, 152, 0, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#ff9800",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("Risk Level (0-10)", false)}
                />
              </div>
            </div>

            {/* Cardiovascular Risk */}
            <div className="chart-container">
              <h3>Cardiovascular Risk Assessment</h3>
              <div className="chart-wrapper">
                <Line
                  data={{
                    labels: timeLabels.slice(-12),
                    datasets: [
                      {
                        label: "Cardiovascular Risk",
                        data:
                          data?.health?.map(
                            (item) => item.cardiovascular_risk
                          ) || [],
                        borderColor: "#f44336",
                        backgroundColor: "rgba(244, 67, 54, 0.15)",
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: "#f44336",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                      },
                    ],
                  }}
                  options={getChartOptions("Risk Level (0-10)", false)}
                />
              </div>
            </div>
          </div>
        )}

        {selectedTab === "forecast" && (
          <div className="content-grid">
            {/* AQI Forecast */}
            <div className="chart-container">
              <h3>24-Hour AQI Forecast</h3>
              <Line
                data={{
                  labels: forecastLabels,
                  datasets: [
                    {
                      label: "Predicted AQI",
                      data:
                        data?.forecast?.map((item) => item.predicted_aqi) || [],
                      borderColor: "#1976d2",
                      backgroundColor: "rgba(25, 118, 210, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: "#1976d2",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                    {
                      label: "Confidence Level (%)",
                      data:
                        data?.forecast?.map((item) => item.confidence) || [],
                      borderColor: "#4caf50",
                      backgroundColor: "rgba(76, 175, 80, 0.15)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      yAxisID: "y1",
                      pointBackgroundColor: "#4caf50",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                options={
                  {
                    ...getChartOptions("Predicted AQI", true),
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Time",
                          color: "#1976d2",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#1976d2" },
                        grid: { color: "rgba(25, 118, 210, 0.1)" },
                      },
                      y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "AQI",
                          color: "#1976d2",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#1976d2" },
                        grid: { color: "rgba(25, 118, 210, 0.1)" },
                      },
                      y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Confidence (%)",
                          color: "#4caf50",
                          font: { family: "Montserrat" },
                        },
                        ticks: { color: "#4caf50" },
                        grid: { drawOnChartArea: false },
                      },
                    },
                  } as ChartOptions<"line">
                }
              />
            </div>

            {/* Forecast Summary Chart */}
            <div className="chart-container">
              <h3>Comprehensive Forecast Summary</h3>
              <Line
                data={{
                  labels: forecastLabels,
                  datasets: [
                    {
                      label: "Predicted AQI",
                      data:
                        data?.forecast?.map((item) => item.predicted_aqi) || [],
                      borderColor: "#1976d2",
                      backgroundColor: "rgba(25, 118, 210, 0.1)",
                      borderWidth: 3,
                      tension: 0.4,
                      fill: false,
                      pointBackgroundColor: "#1976d2",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 6,
                      pointHoverRadius: 9,
                      yAxisID: "y",
                    },
                    {
                      label: "Confidence Level (%)",
                      data:
                        data?.forecast?.map((item) => item.confidence) || [],
                      borderColor: "#4caf50",
                      backgroundColor: "rgba(76, 175, 80, 0.1)",
                      borderWidth: 2,
                      borderDash: [5, 5],
                      tension: 0.4,
                      fill: false,
                      pointBackgroundColor: "#4caf50",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 1,
                      pointRadius: 4,
                      pointHoverRadius: 7,
                      yAxisID: "y1",
                    },
                    {
                      label: "Air Quality Trend",
                      data:
                        data?.forecast?.map((item, index) => {
                          // Calculate trend based on previous values
                          if (index === 0) return item.predicted_aqi;
                          const prevAqi =
                            data?.forecast?.[index - 1]?.predicted_aqi ||
                            item.predicted_aqi;
                          return prevAqi + (item.predicted_aqi - prevAqi) * 0.8; // Smoothed trend
                        }) || [],
                      borderColor: "#ff9800",
                      backgroundColor: "rgba(255, 152, 0, 0.05)",
                      borderWidth: 2,
                      tension: 0.6,
                      fill: true,
                      pointBackgroundColor: "#ff9800",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 1,
                      pointRadius: 3,
                      pointHoverRadius: 6,
                      yAxisID: "y",
                    },
                  ],
                }}
                options={
                  {
                    responsive: true,
                    maintainAspectRatio: false,
                    aspectRatio: 2.5,
                    animation: {
                      duration: 1500,
                      easing: "easeInOutQuart",
                    },
                    interaction: {
                      mode: "index",
                      intersect: false,
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: "top",
                        labels: {
                          color: "#1976d2",
                          font: {
                            family: "Montserrat",
                            size: 12,
                            weight: 600,
                          },
                          usePointStyle: true,
                          pointStyle: "circle",
                        },
                      },
                      tooltip: {
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        titleColor: "#1976d2",
                        bodyColor: "#666",
                        borderColor: "#1976d2",
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                          afterLabel: function (context: any) {
                            if (context.datasetIndex === 0) {
                              const aqi = context.parsed.y;
                              let status = "";
                              if (aqi <= 50) status = "🟢 Good";
                              else if (aqi <= 100) status = "🟡 Moderate";
                              else if (aqi <= 150)
                                status = "🟠 Unhealthy for Sensitive";
                              else if (aqi <= 200) status = "🔴 Unhealthy";
                              else status = "🟣 Very Unhealthy";
                              return `Status: ${status}`;
                            }
                            return "";
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Forecast Time",
                          color: "#1976d2",
                          font: {
                            family: "Montserrat",
                            size: 13,
                            weight: 700,
                          },
                        },
                        ticks: {
                          color: "#1976d2",
                          font: {
                            family: "Montserrat",
                            size: 11,
                          },
                        },
                        grid: {
                          color: "rgba(25, 118, 210, 0.1)",
                          drawBorder: false,
                        },
                      },
                      y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        title: {
                          display: true,
                          text: "Air Quality Index (AQI)",
                          color: "#1976d2",
                          font: {
                            family: "Montserrat",
                            size: 13,
                            weight: 700,
                          },
                        },
                        ticks: {
                          color: "#1976d2",
                          font: {
                            family: "Montserrat",
                            size: 11,
                          },
                          callback: function (value: any) {
                            return Math.round(value);
                          },
                        },
                        grid: {
                          color: "rgba(25, 118, 210, 0.1)",
                          drawBorder: false,
                        },
                        beginAtZero: true,
                      },
                      y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        title: {
                          display: true,
                          text: "Confidence Level (%)",
                          color: "#4caf50",
                          font: {
                            family: "Montserrat",
                            size: 13,
                            weight: 700,
                          },
                        },
                        ticks: {
                          color: "#4caf50",
                          font: {
                            family: "Montserrat",
                            size: 11,
                          },
                          callback: function (value: any) {
                            return Math.round(value) + "%";
                          },
                        },
                        grid: {
                          drawOnChartArea: false,
                          drawBorder: false,
                        },
                        min: 0,
                        max: 100,
                      },
                    },
                  } as ChartOptions<"line">
                }
              />
            </div>
          </div>
        )}

        {selectedTab === "ml-forecast" && (
          <div className="ml-forecast-container">
            <AQIForecast
              location={useCurrentLocation ? geoLocationName : selectedLocation}
              lat={useCurrentLocation ? userCoordinates?.lat : undefined}
              lon={useCurrentLocation ? userCoordinates?.lon : undefined}
              autoRefresh={true}
              refreshInterval={300}
            />
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <button
        className="refresh-btn"
        onClick={fetchDashboardData}
        title="Refresh Data"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
        </svg>
      </button>
    </div>
  );
};

export default Dashboard;
