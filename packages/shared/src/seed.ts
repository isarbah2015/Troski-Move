import type { RouteStop } from './types';

// TODO: Replace with real GPRTU fares and surveyed stop coordinates when union data is provided.
// Coordinates are approximate landmark positions, good enough for a ~200 m alighting check and distance-based ETA.
export const SEED_ROUTES: Array<{
  routeId: string;
  origin: string;
  destination: string;
  routeName: string;
  distanceKm: string;
  stops: RouteStop[];
  vehicles: Array<{ shortCode: string; driverName: string; conductorName: string }>;
}> = [
  {
    routeId: "CIR-KSA-01",
    origin: "Circle",
    destination: "Kasoa",
    routeName: "Circle → Kasoa via Kaneshie",
    distanceKm: "35.0",
    stops: [
      { name: "Circle", fare: 0, etaMinutes: 0, lat: 5.57, lng: -0.218 },
      { name: "Kaneshie", fare: 1.5, etaMinutes: 8, lat: 5.5683, lng: -0.2366 },
      { name: "Odorkor", fare: 3.5, etaMinutes: 10, lat: 5.5546, lng: -0.2599 },
      { name: "Mallam", fare: 6.0, etaMinutes: 12, lat: 5.5367, lng: -0.2894 },
      { name: "Kasoa", fare: 10.0, etaMinutes: 20, lat: 5.534, lng: -0.417 },
    ],
    vehicles: [
      { shortCode: "CIR01", driverName: "Kwame Mensah", conductorName: "Yaw Boateng" },
      { shortCode: "CIR02", driverName: "Kofi Asante", conductorName: "Kojo Owusu" },
      { shortCode: "CIR03", driverName: "Nii Armah", conductorName: "Ebo Quaye" },
    ],
  },
  {
    routeId: "MAD-ACC-01",
    origin: "Madina",
    destination: "Accra Central",
    routeName: "Madina → Accra Central via Legon",
    distanceKm: "17.0",
    stops: [
      { name: "Madina", fare: 0, etaMinutes: 0, lat: 5.6828, lng: -0.167 },
      { name: "Legon", fare: 2.5, etaMinutes: 12, lat: 5.6502, lng: -0.187 },
      { name: "Tetteh Quarshie", fare: 4.0, etaMinutes: 8, lat: 5.627, lng: -0.175 },
      { name: "Circle", fare: 5.5, etaMinutes: 12, lat: 5.57, lng: -0.218 },
      { name: "Accra Central", fare: 7.0, etaMinutes: 15, lat: 5.5486, lng: -0.2067 },
    ],
    vehicles: [{ shortCode: "MAD05", driverName: "Kwabena Darko", conductorName: "Yaw Sarpong" }],
  },
  {
    routeId: "TEM-C1-01",
    origin: "Tema Station",
    destination: "Tema Community 1",
    routeName: "Tema Station → Tema Community 1",
    distanceKm: "8.0",
    stops: [
      { name: "Tema Station", fare: 0, etaMinutes: 0, lat: 5.639, lng: 0.018 },
      { name: "Community 4", fare: 1.0, etaMinutes: 5, lat: 5.645, lng: 0.013 },
      { name: "Community 3", fare: 1.5, etaMinutes: 4, lat: 5.652, lng: 0.01 },
      { name: "Community 2", fare: 2.0, etaMinutes: 5, lat: 5.66, lng: 0.008 },
      { name: "Community 1", fare: 2.5, etaMinutes: 5, lat: 5.67, lng: 0.006 },
    ],
    vehicles: [{ shortCode: "TEM03", driverName: "Nii Lamptey", conductorName: "Kwesi Appiah" }],
  },
];

