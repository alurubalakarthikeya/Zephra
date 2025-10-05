/**
 * AQI Forecast Component
 * Displays ML-predicted 24h AQI forecasts with interactive charts
 */

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import "./AQIForecast_School.css";
import { endpoints } from "../config/api";

interface ForecastData {
  hour: number;
  timestamp: string;
  predicted_aqi: number;
  category: string;
  category_level: number;
  confidence: number;
  timeLabel: string; // Formatted time like "21:00" or "Now"
  dateLabel?: string; // Date label like "4/10" for multi-day
  dayLabel?: string; // Day name like "Today", "Tomorrow", "Sun"
}

interface AQIForecastProps {
  location?: string;
  lat?: number;
  lon?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

const AQIForecast: React.FC<AQIForecastProps> = ({
  location = "New York",
  lat: propLat,
  lon: propLon,
  autoRefresh = true,
  refreshInterval = 300, // 5 minutes default
}) => {
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Geolocation state
  const [currentLat, setCurrentLat] = useState<number | undefined>(propLat);
  const [currentLon, setCurrentLon] = useState<number | undefined>(propLon);
  const [currentLocation, setCurrentLocation] = useState<string>(location);
  const [geoPermission, setGeoPermission] = useState<string>("prompt");

  // Sync with prop changes from parent (Dashboard)
  useEffect(() => {
    if (propLat !== undefined && propLon !== undefined) {
      setCurrentLat(propLat);
      setCurrentLon(propLon);
      setCurrentLocation(location);
      setGeoPermission("granted");
    }
  }, [propLat, propLon, location]);

  // Get user's current location only if no coordinates are provided
  useEffect(() => {
    const getUserLocation = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLat(latitude);
            setCurrentLon(longitude);
            setGeoPermission("granted");

            // Reverse geocode to get location name
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );
              const data = await response.json();
              const locationName =
                data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.display_name.split(",")[0];
              setCurrentLocation(locationName);
            } catch (err) {
              console.error("Error getting location name:", err);
              setCurrentLocation(
                `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`
              );
            }
          },
          (error) => {
            console.error("Geolocation error:", error);
            setGeoPermission("denied");
            // Fall back to prop values or defaults
            setCurrentLat(propLat);
            setCurrentLon(propLon);
            setCurrentLocation(location);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000, // Cache for 5 minutes
          }
        );
      } else {
        console.warn("Geolocation not supported");
        setCurrentLat(propLat);
        setCurrentLon(propLon);
        setCurrentLocation(location);
      }
    };

    // Only get location if no coordinates are provided from props
    if (propLat === undefined || propLon === undefined) {
      getUserLocation();
    }
  }, []); // Only run once on mount

  // AQI category colors
  const aqiCategories = [
    {
      max: 50,
      name: "Good",
      color: "#00E400",
      bgColor: "rgba(0, 228, 0, 0.1)",
    },
    {
      max: 100,
      name: "Moderate",
      color: "#b3a408ff",
      bgColor: "rgba(255, 255, 0, 0.1)",
    },
    {
      max: 150,
      name: "Unhealthy for Sensitive",
      color: "#FF7E00",
      bgColor: "rgba(255, 126, 0, 0.1)",
    },
    {
      max: 200,
      name: "Unhealthy",
      color: "#FF0000",
      bgColor: "rgba(255, 0, 0, 0.1)",
    },
    {
      max: 300,
      name: "Very Unhealthy",
      color: "#99004C",
      bgColor: "rgba(153, 0, 76, 0.1)",
    },
    {
      max: 500,
      name: "Hazardous",
      color: "#7E0023",
      bgColor: "rgba(126, 0, 35, 0.1)",
    },
  ];

  const getAQICategory = (aqi: number) => {
    return (
      aqiCategories.find((cat) => aqi <= cat.max) ||
      aqiCategories[aqiCategories.length - 1]
    );
  };

  const getAQICategoryClass = (aqi: number) => {
    if (aqi <= 50) return "aqi-good";
    if (aqi <= 100) return "aqi-moderate";
    if (aqi <= 150) return "aqi-unhealthy-sensitive";
    if (aqi <= 200) return "aqi-unhealthy";
    if (aqi <= 300) return "aqi-very-unhealthy";
    return "aqi-hazardous";
  };

  const getWeatherIcon = (aqi: number) => {
    if (aqi <= 50) return "☀️";
    if (aqi <= 100) return "⛅";
    if (aqi <= 150) return "☁️";
    if (aqi <= 200) return "🌫️";
    return "😷";
  };

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard data which includes ML forecasts
      let url = `https://zephra.onrender.com/api/dashboard`;
      if (currentLat !== undefined && currentLon !== undefined) {
        url += `?lat=${currentLat}&lon=${currentLon}`;
      } else {
        url += `?location=${encodeURIComponent(currentLocation)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Process forecast data - Full 24 hours
      if (data.forecast && Array.isArray(data.forecast)) {
        const now = new Date();
        const processedForecast = data.forecast.map(
          (item: any, index: number) => {
            // Use item timestamp if available, otherwise calculate from now
            const forecastTime = item.timestamp
              ? new Date(item.timestamp)
              : new Date(now.getTime() + index * 3600000);

            const hours = forecastTime.getHours();
            const minutes = forecastTime.getMinutes();
            const date = forecastTime.getDate();
            const month = forecastTime.getMonth() + 1;

            // Get day label
            let dayLabel = "";
            const dayDiff = Math.floor(
              (forecastTime.getTime() - now.getTime()) / (24 * 3600000)
            );
            if (dayDiff === 0) dayLabel = "Today";
            else if (dayDiff === 1) dayLabel = "Tomorrow";
            else {
              const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              dayLabel = days[forecastTime.getDay()];
            }

            return {
              hour: index + 1,
              timestamp: item.timestamp || forecastTime.toISOString(),
              predicted_aqi: item.predicted_aqi,
              category:
                item.category || getAQICategory(item.predicted_aqi).name,
              category_level: item.category_level || 0,
              confidence: item.confidence || 80,
              timeLabel:
                index === 0
                  ? "Now"
                  : `${hours.toString().padStart(2, "0")}:${minutes
                      .toString()
                      .padStart(2, "0")}`,
              dateLabel: `${month}/${date}`,
              dayLabel: dayLabel,
            };
          }
        );
        setForecastData(processedForecast);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error fetching forecast:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch forecast data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have location data (either coordinates or location name)
    if (currentLat !== undefined || currentLocation) {
      fetchForecast();
    }

    if (autoRefresh && (currentLat !== undefined || currentLocation)) {
      const interval = setInterval(fetchForecast, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [currentLocation, currentLat, currentLon, autoRefresh, refreshInterval]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const category = getAQICategory(data.predicted_aqi || data.aqi);

      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">
            {data.timeLabel || "Now"}
            {data.dateLabel && ` (${data.dateLabel})`}
          </p>
          <p className="tooltip-aqi">
            <strong>AQI: {Math.round(data.predicted_aqi || data.aqi)}</strong>
          </p>
          <p className="tooltip-category" style={{ color: category.color }}>
            {category.name}
          </p>
          {data.confidence && (
            <p className="tooltip-confidence">Confidence: {data.confidence}%</p>
          )}
          {data.temperature && (
            <>
              <p className="tooltip-weather">
                🌡️ {data.temperature.toFixed(1)}°C
              </p>
              <p className="tooltip-weather">💧 {data.humidity?.toFixed(0)}%</p>
              <p className="tooltip-weather">
                💨 {data.wind_speed?.toFixed(1)} m/s
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading && forecastData.length === 0) {
    return (
      <div className="aqi-forecast-container loading">
        <div className="loading-spinner"></div>
        <p>
          {geoPermission === "prompt"
            ? "Detecting your location..."
            : "Loading ML forecast..."}
        </p>
        {geoPermission === "denied" && (
          <p style={{ fontSize: "0.9rem", opacity: 0.8, marginTop: "10px" }}>
            📍 Location access denied. Using default location: {currentLocation}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="aqi-forecast-container error">
        <h3>⚠️ Error Loading Forecast</h3>
        <p>{error}</p>
        <button onClick={fetchForecast}>Retry</button>
      </div>
    );
  }

  return (
    <div className="aqi-forecast-container">
      {/* Top Header */}
      <div className="top-header">
        <div className="header-left-section">
          <h1 className="main-title">24-Hour AQI Forecast</h1>
        </div>
{/*         <button
          className="home-btn"
          onClick={() => (window.location.href = "/")}
        >
          🔊 Home
        </button> */}
      </div>

      {/* Update Times */}
      <div className="update-times">
        <span className="update-time">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </span>
        <span className="update-time">Last updated: {currentLocation}</span>
      </div>

      {/* 24-Hour Line Chart */}
      <div className="chart-section">
        <h2 className="chart-title">24-Hour Prediction</h2>
        <div className="chart-scroll-wrapper">
          <div className="chart-wrapper-new" style={{ minWidth: "800px" }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={forecastData.slice(0, 24)}
                margin={{ top: 20, right: 20, bottom: 40, left: 10 }}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a90e2" stopOpacity={0.3} />
                    <stop
                      offset="100%"
                      stopColor="#7cb5ec"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#cbd5e1"
                  vertical={false}
                  opacity={0.5}
                />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fill: "#1976d2", fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  interval={1}
                  height={40}
                />
                <YAxis
                  tick={{ fill: "#1976d2", fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  domain={["dataMin - 10", "dataMax + 10"]}
                  width={50}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "rgba(77, 160, 219, 0.3)", strokeWidth: 2 }}
                  wrapperStyle={{ zIndex: 1000, outline: "none" }}
                />

                <Area
                  type="natural"
                  dataKey="predicted_aqi"
                  stroke="none"
                  fill="url(#areaGradient)"
                  fillOpacity={1}
                />
                <Line
                  type="natural"
                  dataKey="predicted_aqi"
                  stroke="#4a90e2"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#ffffff",
                    stroke: "#4a90e2",
                    strokeWidth: 3,
                  }}
                  activeDot={{
                    r: 7,
                    fill: "#4a90e2",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hourly Forecast Cards */}
      <div className="hourly-section">
        <h2 className="section-title">24-Hour Detailed Forecast</h2>
        <div className="hourly-scroll-new">
          {forecastData.slice(0, 24).map((forecast, index) => {
            const category = getAQICategory(forecast.predicted_aqi);
            const categoryClass = getAQICategoryClass(forecast.predicted_aqi);
            const isNow = index === 0;

            return (
              <div
                key={forecast.hour}
                className={`hourly-card-new ${categoryClass} ${
                  isNow ? "now-card" : ""
                }`}
              >
                {isNow && <div className="now-badge">NOW</div>}
                <div className="hourly-time-new">
                  {isNow ? "NOW" : forecast.timeLabel}
                </div>
                <div className="hourly-aqi-new">
                  {Math.round(forecast.predicted_aqi)}
                </div>
                <div className="hourly-category-new">
                  {category.name.split(" ")[0]}
                </div>
                <div className="hourly-icon-new">
                  {getWeatherIcon(forecast.predicted_aqi)}
                </div>
                <div className="hourly-confidence-new">
                  {forecast.confidence}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AQIForecast;
