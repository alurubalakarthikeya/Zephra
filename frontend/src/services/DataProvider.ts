// Sophisticated Atmospheric Mock Data Service for Backend Switching
// Features:
// - EPA-compliant AQI calculations using official breakpoints and formulas
// - Atmospheric science-based pollution patterns (diurnal, seasonal, meteorological)
// - Realistic pollutant correlations and atmospheric chemistry
// - Location-specific pollution baselines and patterns
// - Meteorologically accurate weather modeling with physical correlations
// - Satellite data based on atmospheric optics and remote sensing principles
// - Consistent daily-seeded generation that changes only at midnight
// - Health impact assessments following WHO and EPA guidelines
// - ML-style forecast predictions with realistic uncertainty modeling

export interface MockAirQualityData {
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

export interface MockWeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  visibility: number;
  windDirection: string;
}

class DataProvider {
  private static instance: DataProvider;
  private currentLocation: string = 'New York';
  private dailySeed: number;

  public static getInstance(): DataProvider {
    if (!DataProvider.instance) {
      DataProvider.instance = new DataProvider();
    }
    return DataProvider.instance;
  }

  constructor() {
    // Generate daily seed based on current date (YYYY-MM-DD)
    this.updateDailySeed();
  }

  // Update daily seed - called automatically and can be called manually for testing
  private updateDailySeed(): void {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.dailySeed = this.hashCode(dateString);
  }

  // Public method to check if we need to update the seed (can be called periodically)
  public checkAndUpdateDailySeed(): boolean {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const newSeed = this.hashCode(dateString);
    
    if (newSeed !== this.dailySeed) {
      this.dailySeed = newSeed;
      return true; // Seed was updated
    }
    return false; // No update needed
  }

  // Simple hash function to convert string to number
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Seeded random number generator (deterministic)
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // Generate multiple seeded random numbers
  private getSeededValues(baseSeed: number, count: number): number[] {
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(this.seededRandom(baseSeed + i));
    }
    return values;
  }

  private generateRealisticAQI(seed: number, hour: number, dayOfYear: number, location: string): number {
    // Sophisticated AQI generation based on atmospheric science
    const random1 = this.seededRandom(seed);
    const random2 = this.seededRandom(seed + 1);
    const random3 = this.seededRandom(seed + 2);
    
    // Base pollution level varies by location type
    const locationFactors = {
      'New York': { base: 55, industrial: 1.3, traffic: 1.4 },
      'Los Angeles': { base: 70, industrial: 1.2, traffic: 1.6 },
      'Beijing': { base: 120, industrial: 1.8, traffic: 1.3 },
      'Tokyo': { base: 45, industrial: 1.1, traffic: 1.2 },
      'London': { base: 40, industrial: 1.0, traffic: 1.3 },
      'Delhi': { base: 150, industrial: 2.0, traffic: 1.5 }
    };
    
    const cityData = locationFactors[location as keyof typeof locationFactors] || locationFactors['New York'];
    const baseAQI = cityData.base + random1 * 30;
    
    // Seasonal patterns (pollution higher in winter due to heating, inversions)
    const season = Math.floor((dayOfYear - 1) / 91); // 0=Winter, 1=Spring, 2=Summer, 3=Fall
    const seasonalFactors = [1.4, 0.9, 0.8, 1.1]; // Winter worst, summer best
    const seasonalFactor = seasonalFactors[season] + (random2 - 0.5) * 0.3;
    
    // Realistic daily pattern based on urban atmospheric dynamics
    let dailyFactor = 1.0;
    if (hour >= 6 && hour <= 9) {
      // Morning rush hour + atmospheric inversion
      dailyFactor = 1.3 + (random3 - 0.5) * 0.4;
    } else if (hour >= 17 && hour <= 20) {
      // Evening rush hour + stable atmosphere
      dailyFactor = 1.2 + (random3 - 0.5) * 0.3;
    } else if (hour >= 21 && hour <= 6) {
      // Night time inversion layer
      dailyFactor = 1.1 + (random3 - 0.5) * 0.2;
    } else {
      // Midday - better mixing height
      dailyFactor = 0.8 + (random3 - 0.5) * 0.2;
    }
    
    // Industrial activity factor (weekdays vs weekends)
    const dayOfWeek = Math.floor((dayOfYear + 3) % 7); // Approximate day of week
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0;
    
    // Apply all factors with some random meteorological variation
    const weatherVariation = 0.8 + random1 * 0.4; // Weather dispersal effects
    const finalAQI = baseAQI * seasonalFactor * dailyFactor * weekendFactor * weatherVariation;
    
    return Math.max(5, Math.min(500, Math.round(finalAQI)));
  }

  private generatePollutantValue(aqi: number, pollutant: string, seed: number, hour: number): number {
    const random1 = this.seededRandom(seed);
    const random2 = this.seededRandom(seed + 10);
    
    // EPA AQI breakpoints and concentration relationships
    const epaBreakpoints = {
      pm25: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0.0, concHigh: 12.0 },
        { aqiLow: 51, aqiHigh: 100, concLow: 12.1, concHigh: 35.4 },
        { aqiLow: 101, aqiHigh: 150, concLow: 35.5, concHigh: 55.4 },
        { aqiLow: 151, aqiHigh: 200, concLow: 55.5, concHigh: 150.4 },
        { aqiLow: 201, aqiHigh: 300, concLow: 150.5, concHigh: 250.4 },
        { aqiLow: 301, aqiHigh: 500, concLow: 250.5, concHigh: 500.4 }
      ],
      pm10: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0, concHigh: 54 },
        { aqiLow: 51, aqiHigh: 100, concLow: 55, concHigh: 154 },
        { aqiLow: 101, aqiHigh: 150, concLow: 155, concHigh: 254 },
        { aqiLow: 151, aqiHigh: 200, concLow: 255, concHigh: 354 },
        { aqiLow: 201, aqiHigh: 300, concLow: 355, concHigh: 424 },
        { aqiLow: 301, aqiHigh: 500, concLow: 425, concHigh: 604 }
      ],
      o3: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0, concHigh: 54 },
        { aqiLow: 51, aqiHigh: 100, concLow: 55, concHigh: 70 },
        { aqiLow: 101, aqiHigh: 150, concLow: 71, concHigh: 85 },
        { aqiLow: 151, aqiHigh: 200, concLow: 86, concHigh: 105 },
        { aqiLow: 201, aqiHigh: 300, concLow: 106, concHigh: 200 }
      ],
      no2: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0, concHigh: 53 },
        { aqiLow: 51, aqiHigh: 100, concLow: 54, concHigh: 100 },
        { aqiLow: 101, aqiHigh: 150, concLow: 101, concHigh: 360 },
        { aqiLow: 151, aqiHigh: 200, concLow: 361, concHigh: 649 }
      ],
      so2: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0, concHigh: 35 },
        { aqiLow: 51, aqiHigh: 100, concLow: 36, concHigh: 75 },
        { aqiLow: 101, aqiHigh: 150, concLow: 76, concHigh: 185 }
      ],
      co: [
        { aqiLow: 0, aqiHigh: 50, concLow: 0.0, concHigh: 4.4 },
        { aqiLow: 51, aqiHigh: 100, concLow: 4.5, concHigh: 9.4 },
        { aqiLow: 101, aqiHigh: 150, concLow: 9.5, concHigh: 12.4 },
        { aqiLow: 151, aqiHigh: 200, concLow: 12.5, concHigh: 15.4 }
      ]
    };
    
    const breakpoints = epaBreakpoints[pollutant as keyof typeof epaBreakpoints];
    if (!breakpoints) return Math.round(random1 * 50);
    
    // Find appropriate breakpoint for AQI
    let targetBreakpoint = breakpoints[0];
    for (const bp of breakpoints) {
      if (aqi >= bp.aqiLow && aqi <= bp.aqiHigh) {
        targetBreakpoint = bp;
        break;
      }
    }
    
    // Linear interpolation within breakpoint
    const aqiRange = targetBreakpoint.aqiHigh - targetBreakpoint.aqiLow;
    const concRange = targetBreakpoint.concHigh - targetBreakpoint.concLow;
    const aqiPosition = (aqi - targetBreakpoint.aqiLow) / aqiRange;
    const baseConc = targetBreakpoint.concLow + (aqiPosition * concRange);
    
    // Add realistic diurnal variation specific to each pollutant
    let diurnalFactor = 1.0;
    switch (pollutant) {
      case 'pm25':
      case 'pm10':
        // PM peaks in morning/evening, lower midday due to mixing
        diurnalFactor = hour < 10 || hour > 18 ? 1.1 + random2 * 0.3 : 0.8 + random2 * 0.2;
        break;
      case 'no2':
        // NO2 peaks during rush hours (traffic)
        diurnalFactor = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 1.3 + random2 * 0.2 : 0.7 + random2 * 0.3;
        break;
      case 'o3':
        // O3 peaks midday due to photochemical reactions
        diurnalFactor = hour >= 11 && hour <= 16 ? 1.4 + random2 * 0.3 : 0.6 + random2 * 0.2;
        break;
      case 'co':
        // CO higher during rush hours and inversions
        diurnalFactor = hour < 8 || (hour >= 17 && hour <= 20) ? 1.2 + random2 * 0.2 : 0.8 + random2 * 0.2;
        break;
      case 'so2':
        // SO2 from industrial sources, peaks during business hours
        diurnalFactor = hour >= 9 && hour <= 17 ? 1.1 + random2 * 0.2 : 0.9 + random2 * 0.1;
        break;
    }
    
    const finalConc = baseConc * diurnalFactor * (0.8 + random1 * 0.4);
    
    // Convert CO to ppm for display, others stay in µg/m³ or ppb
    if (pollutant === 'co') {
      return Math.max(0, Math.round(finalConc * 100) / 100); // Round to 2 decimal places
    }
    
    return Math.max(0, Math.round(finalConc));
  }

  private getAQIStatus(aqi: number): MockAirQualityData['status'] {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  public async getDashboardData(location?: string): Promise<any> {
    // Simulate API delay with consistent timing
    await new Promise(resolve => setTimeout(resolve, 150));

    const currentLoc = location || this.currentLocation;
    
    // Generate comprehensive dashboard data with daily seed
    const now = new Date();
    const locationSeed = this.hashCode(currentLoc);
    const combinedSeed = this.dailySeed + locationSeed;
    
    const mockData = {
      success: true,
      location_info: {
        name: currentLoc,
        country: 'United States',
        timezone: 'America/New_York',
        local_time: now.toISOString()
      },
      
      // Air quality data (24 hours) - Sophisticated atmospheric modeling
      air_quality: Array.from({ length: 24 }, (_, i) => {
        const hour = (now.getHours() - (23 - i) + 24) % 24;
        const hourSeed = combinedSeed + i;
        const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        // Generate individual pollutant concentrations first
        const pm25 = this.generatePollutantValue(100, 'pm25', hourSeed + 1, hour); // Base PM2.5
        const pm10 = Math.max(pm25, this.generatePollutantValue(100, 'pm10', hourSeed + 2, hour)); // PM10 >= PM2.5
        const o3 = this.generatePollutantValue(100, 'o3', hourSeed + 3, hour);
        const no2 = this.generatePollutantValue(100, 'no2', hourSeed + 4, hour);
        const so2 = this.generatePollutantValue(100, 'so2', hourSeed + 5, hour);
        const co = this.generatePollutantValue(100, 'co', hourSeed + 6, hour);
        
        // Calculate AQI as the maximum of individual pollutant AQIs (EPA method)
        const calculateAQI = (conc: number, pollutant: string): number => {
          const breakpoints = {
            pm25: [[0, 12.0, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 150.4, 151, 200]],
            pm10: [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200]],
            o3: [[0, 54, 0, 50], [55, 70, 51, 100], [71, 85, 101, 150], [86, 105, 151, 200]],
            no2: [[0, 53, 0, 50], [54, 100, 51, 100], [101, 360, 101, 150], [361, 649, 151, 200]],
            so2: [[0, 35, 0, 50], [36, 75, 51, 100], [76, 185, 101, 150]],
            co: [[0, 4.4, 0, 50], [4.5, 9.4, 51, 100], [9.5, 12.4, 101, 150], [12.5, 15.4, 151, 200]]
          };
          
          const bps = breakpoints[pollutant as keyof typeof breakpoints] || breakpoints.pm25;
          for (const [cLow, cHigh, aqiLow, aqiHigh] of bps) {
            if (conc >= cLow && conc <= cHigh) {
              return Math.round(((aqiHigh - aqiLow) / (cHigh - cLow)) * (conc - cLow) + aqiLow);
            }
          }
          return conc > 200 ? 200 : 50; // Fallback
        };
        
        // Calculate individual AQIs and take the maximum (EPA standard)
        const aqiValues = [
          calculateAQI(pm25, 'pm25'),
          calculateAQI(pm10, 'pm10'),
          calculateAQI(o3, 'o3'),
          calculateAQI(no2, 'no2'),
          calculateAQI(so2, 'so2'),
          calculateAQI(co, 'co')
        ];
        
        const aqi = Math.max(...aqiValues);
        
        return {
          timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString(),
          aqi,
          pm25: Math.round(pm25 * 10) / 10, // One decimal place
          pm10: Math.round(pm10),
          o3: Math.round(o3),
          no2: Math.round(no2),
          so2: Math.round(so2),
          co: Math.round(co * 10) / 10 // One decimal place for CO
        };
      }),
      
      // Weather data (24 hours) - Realistic meteorological patterns
      weather: Array.from({ length: 24 }, (_, i) => {
        const hour = (now.getHours() - (23 - i) + 24) % 24;
        const hourSeed = combinedSeed + 100 + i;
        const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        const random1 = this.seededRandom(hourSeed);
        const random2 = this.seededRandom(hourSeed + 1);
        const random3 = this.seededRandom(hourSeed + 2);
        const random4 = this.seededRandom(hourSeed + 3);
        const random5 = this.seededRandom(hourSeed + 4);
        const random6 = this.seededRandom(hourSeed + 5);
        const random7 = this.seededRandom(hourSeed + 6);
        
        // Seasonal temperature baseline (Northern Hemisphere)
        const seasonalTemp = 15 + 15 * Math.cos(2 * Math.PI * (dayOfYear - 172) / 365); // Peak in summer
        
        // Realistic diurnal temperature cycle
        const diurnalAmplitude = 8 + random1 * 4; // Daily temperature range
        const diurnalTemp = seasonalTemp + diurnalAmplitude * Math.sin(2 * Math.PI * (hour - 6) / 24);
        const temperature = Math.round(diurnalTemp + (random2 - 0.5) * 6); // Weather variation
        
        // Humidity inversely correlated with temperature (realistic atmospheric physics)
        const baseHumidity = 70 - (temperature - 20) * 1.5; // Cooler air holds more moisture
        const humidity = Math.max(20, Math.min(95, Math.round(baseHumidity + (random3 - 0.5) * 30)));
        
        // Realistic pressure systems (1000-1040 hPa range with weather patterns)
        const baseP = 1013 + random4 * 20 - 10; // Weather system variation
        const pressure = Math.round(baseP + Math.sin(i / 6) * 5); // Slow pressure changes
        
        // Wind speed correlated with pressure gradients
        const pressureGradient = i > 0 ? Math.abs(pressure - (1013 + this.seededRandom(combinedSeed + 99 + i) * 20 - 10)) : 5;
        const windSpeed = Math.max(0, Math.round(3 + pressureGradient * 0.8 + random5 * 8));
        
        // Visibility affected by humidity and pollution
        const aqiForVisibility = this.generateRealisticAQI(hourSeed + 50, hour, dayOfYear, currentLoc);
        const humidityFactor = humidity > 80 ? 0.7 : 1.0; // High humidity reduces visibility
        const pollutionFactor = Math.max(0.3, 1 - aqiForVisibility / 300); // High pollution reduces visibility
        const baseVisibility = 15 * humidityFactor * pollutionFactor;
        const visibility = Math.max(1, Math.round(baseVisibility + (random6 - 0.5) * 8));
        
        // Wind direction persistence (wind doesn't change dramatically hour to hour)
        const prevDirection = i > 0 ? Math.floor(this.seededRandom(combinedSeed + 99 + i) * 8) : Math.floor(random7 * 8);
        const directionChange = Math.floor((random7 - 0.5) * 3); // Small changes
        const windDirectionIndex = Math.max(0, Math.min(7, prevDirection + directionChange));
        const windDirection = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][windDirectionIndex];
        
        return {
          timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString(),
          temperature,
          humidity,
          windSpeed,
          pressure,
          visibility,
          windDirection
        };
      }),
      
      // Satellite data (24 hours) - Realistic atmospheric optics and satellite measurements
      satellite: Array.from({ length: 24 }, (_, i) => {
        const hour = (now.getHours() - (23 - i) + 24) % 24;
        const hourSeed = combinedSeed + 200 + i;
        const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        const random1 = this.seededRandom(hourSeed);
        const random2 = this.seededRandom(hourSeed + 1);
        const random3 = this.seededRandom(hourSeed + 2);
        const random4 = this.seededRandom(hourSeed + 3);
        const random5 = this.seededRandom(hourSeed + 4);
        const random6 = this.seededRandom(hourSeed + 5);
        
        // Realistic cloud formation patterns (meteorologically accurate)
        // Morning: radiation fog and low clouds
        // Afternoon: convective clouds from heating
        // Evening: stratiform clouds
        let baseCloudCover = 40;
        if (hour >= 6 && hour <= 10) {
          // Morning fog and low clouds
          baseCloudCover = 45 + random1 * 30;
        } else if (hour >= 11 && hour <= 16) {
          // Afternoon convective activity
          baseCloudCover = 35 + random1 * 35;
        } else if (hour >= 17 && hour <= 22) {
          // Evening stratiform development
          baseCloudCover = 50 + random1 * 25;
        } else {
          // Night - stable conditions
          baseCloudCover = 30 + random1 * 20;
        }
        
        // Seasonal cloud patterns
        const season = Math.floor((dayOfYear - 1) / 91);
        const seasonalCloudFactors = [1.2, 1.0, 0.7, 1.1]; // Winter more clouds, summer fewer
        baseCloudCover *= seasonalCloudFactors[season];
        
        const cloudCover = Math.max(0, Math.min(100, Math.round(baseCloudCover)));
        
        // Aerosol Optical Depth (AOD) - correlated with pollution and humidity
        const currentAqi = this.generateRealisticAQI(hourSeed + 10, hour, dayOfYear, currentLoc);
        const humidity = 70 - (15 * Math.sin(2 * Math.PI * (hour - 6) / 24)) + random2 * 20; // Diurnal humidity cycle
        
        // AOD increases with pollution and humidity (hygroscopic growth)
        const pollutionAOD = (currentAqi / 100) * 0.3; // Pollution contribution
        const humidityAOD = (humidity / 100) * 0.2; // Hygroscopic growth
        const dustAOD = random3 * 0.1; // Background dust/aerosols
        const aod = Math.max(0.05, Math.min(2.0, pollutionAOD + humidityAOD + dustAOD));
        
        // Surface reflectance varies with cloud cover and surface type
        // Urban areas: 0.1-0.2, Vegetation: 0.05-0.15, Snow: 0.8-0.9
        const urbanReflectance = 0.12 + random4 * 0.08;
        const cloudReflectance = (cloudCover / 100) * 0.6; // Clouds are highly reflective
        const surfaceReflectance = Math.max(0.05, Math.min(0.9, 
          urbanReflectance * (1 - cloudCover / 100) + cloudReflectance
        ));
        
        // Atmospheric visibility from satellite perspective
        // Affected by AOD, cloud cover, and atmospheric clarity
        const aodVisibility = Math.max(1, 15 * Math.exp(-aod * 2)); // Exponential decay with AOD
        const cloudVisibility = Math.max(1, 20 * (1 - cloudCover / 150)); // Reduced by clouds
        const atmosphericVisibility = Math.min(aodVisibility, cloudVisibility);
        const visibility = Math.max(1, Math.round(atmosphericVisibility + (random5 - 0.5) * 4));
        
        // UV Index - realistic solar radiation model
        // Depends on solar elevation, ozone, clouds, aerosols
        const solarElevation = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12)); // Simplified solar angle
        const ozoneFactor = 0.9 + random6 * 0.2; // Ozone variation
        const cloudAttenuation = 1 - (cloudCover / 100) * 0.6; // Clouds reduce UV
        const aerosolAttenuation = Math.exp(-aod * 1.5); // Aerosols scatter/absorb UV
        
        const maxUV = 10; // Maximum possible UV index
        const uvIndex = Math.max(0, Math.round(
          maxUV * solarElevation * ozoneFactor * cloudAttenuation * aerosolAttenuation
        ));
        
        return {
          timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString(),
          aerosol_optical_depth: Math.round(aod * 1000) / 1000, // 3 decimal places
          cloud_cover: cloudCover,
          surface_reflectance: Math.round(surfaceReflectance * 1000) / 1000, // 3 decimal places
          visibility: visibility,
          uv_index: uvIndex
        };
      }),
      
      // Health data (24 hours) - Realistic health impact modeling
      health: Array.from({ length: 24 }, (_, i) => {
        const hour = (now.getHours() - (23 - i) + 24) % 24;
        const hourSeed = combinedSeed + 300 + i;
        const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const hourAqi = this.generateRealisticAQI(hourSeed, hour, dayOfYear, currentLoc);
        
        // Generate health indices based on WHO and EPA health guidelines
        const overallHealth = Math.max(0, Math.min(10, 10 - (hourAqi / 50) * 2));
        const respiratoryRisk = Math.max(0, Math.min(10, (hourAqi / 30) * 2));
        const cardiovascularRisk = Math.max(0, Math.min(10, (hourAqi / 40) * 2.5));
        
        // More detailed health recommendations based on AQI ranges
        let recommendations = 'Air quality is good for outdoor activities';
        let riskLevel = 'Low';
        let vulnerableGroups: string[] = [];
        
        if (hourAqi <= 50) {
          recommendations = 'Excellent air quality. Ideal for all outdoor activities.';
          riskLevel = 'Low';
        } else if (hourAqi <= 100) {
          recommendations = 'Moderate air quality. Sensitive individuals should consider reducing prolonged outdoor exertion.';
          riskLevel = 'Moderate';
          vulnerableGroups = ['People with respiratory conditions'];
        } else if (hourAqi <= 150) {
          recommendations = 'Unhealthy for sensitive groups. Reduce outdoor activities if you experience symptoms.';
          riskLevel = 'Unhealthy for Sensitive Groups';
          vulnerableGroups = ['Children', 'Elderly', 'People with heart or lung disease'];
        } else if (hourAqi <= 200) {
          recommendations = 'Unhealthy air quality. Limit outdoor activities and consider wearing masks.';
          riskLevel = 'Unhealthy';
          vulnerableGroups = ['Everyone', 'Especially children and elderly'];
        } else {
          recommendations = 'Very unhealthy air quality. Avoid outdoor activities.';
          riskLevel = 'Very Unhealthy';
          vulnerableGroups = ['All individuals should avoid outdoor exposure'];
        }
        
        return {
          timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString(),
          overall_health_index: Math.round(overallHealth * 10) / 10,
          respiratory_risk: Math.round(respiratoryRisk * 10) / 10,
          cardiovascular_risk: Math.round(cardiovascularRisk * 10) / 10,
          health_index: hourAqi,
          risk_level: riskLevel,
          recommendations: recommendations,
          vulnerable_groups: vulnerableGroups
        };
      }),
      
      // Forecast data (next 7 days) - Realistic ML-style predictions with uncertainty
      forecast: Array.from({ length: 7 }, (_, i) => {
        const forecastDay = i + 1;
        const forecastSeed = combinedSeed + 400 + i;
        const random1 = this.seededRandom(forecastSeed);
        const random2 = this.seededRandom(forecastSeed + 1);
        const dayOfYear = Math.floor((Date.now() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)) + i;
        
        // Get current AQI for trend analysis
        const currentAqi = this.generateRealisticAQI(combinedSeed, now.getHours(), dayOfYear - i, currentLoc);
        
        // Forecast uncertainty increases with time (realistic ML behavior)
        const uncertainty = 1.0 + (i * 0.15); // 15% increase per day
        
        // Weather persistence with gradual change (realistic meteorological forecasting)
        const trendFactor = 0.9 + (random1 - 0.5) * 0.3; // Small trend changes
        const weatherVariation = 0.8 + random2 * 0.4; // Weather-induced variation
        
        // Predict based on current conditions with increasing uncertainty
        let predictedAqi = currentAqi * trendFactor * weatherVariation * uncertainty;
        
        // Add some randomness but keep it within reasonable bounds
        predictedAqi = Math.max(10, Math.min(300, Math.round(predictedAqi)));
        
        // Confidence decreases with forecast horizon (like real ML models)
        const baseConfidence = 95 - (i * 8); // Decrease ~8% per day
        const confidence = Math.max(45, Math.round(baseConfidence + (random1 - 0.5) * 10));
        
        return {
          hour: `Day ${forecastDay}`,
          predicted_aqi: predictedAqi,
          confidence: confidence
        };
      }),
      
      // Status data
      status: {
        api_status: 'Mock Data Active',
        data_freshness: 100,
        last_update: now.toISOString()
      },
      
      timestamp: now.toISOString()
    };

    return mockData;
  }

  public setLocation(location: string): void {
    this.currentLocation = location;
  }
}

export default DataProvider;