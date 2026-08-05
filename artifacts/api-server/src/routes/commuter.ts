import { Router, type IRouter } from "express";
import {
  CreateBookingBody,
  CreateBookingResponse,
  CreateReportBody,
  CreateReportResponse,
  GetCommuterSummaryResponse,
  GetWalletResponse,
  ListRoutesQueryParams,
  ListRoutesResponse,
  SearchTripsQueryParams,
  SearchTripsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const routes = [
  {
    id: "route-1",
    name: "Osu — Madina",
    from: "Osu Oxford Street",
    to: "Madina Zongo",
    mode: "BRT",
    durationMinutes: 42,
    fare: 8.5,
    status: "On time",
    nextDeparture: "08:12",
    color: "gold",
  },
  {
    id: "route-2",
    name: "Circle — Adenta",
    from: "Kwame Nkrumah Circle",
    to: "Adenta Barrier",
    mode: "Trotro",
    durationMinutes: 48,
    fare: 7.0,
    status: "On time",
    nextDeparture: "08:20",
    color: "green",
  },
  {
    id: "route-3",
    name: "Airport — Tema",
    from: "Kotoka Airport",
    to: "Tema Community 1",
    mode: "Bus",
    durationMinutes: 55,
    fare: 12.0,
    status: "Moderate traffic",
    nextDeparture: "08:35",
    color: "blue",
  },
  {
    id: "route-4",
    name: "Kaneshie — Achimota",
    from: "Kaneshie Market",
    to: "Achimota Mall",
    mode: "Trotro",
    durationMinutes: 26,
    fare: 5.0,
    status: "On time",
    nextDeparture: "08:42",
    color: "coral",
  },
];

const trips = [
  {
    id: "trip-1",
    routeName: "Osu — Madina",
    mode: "BRT",
    durationMinutes: 42,
    fare: 8.5,
    departure: "08:12",
    arrival: "08:54",
    occupancy: 68,
    stops: 9,
    status: "Boarding soon",
  },
  {
    id: "trip-2",
    routeName: "Osu — Madina",
    mode: "Trotro",
    durationMinutes: 51,
    fare: 7.0,
    departure: "08:24",
    arrival: "09:15",
    occupancy: 42,
    stops: 12,
    status: "Seats available",
  },
  {
    id: "trip-3",
    routeName: "Osu — Madina",
    mode: "Bus",
    durationMinutes: 45,
    fare: 9.5,
    departure: "08:40",
    arrival: "09:25",
    occupancy: 31,
    stops: 10,
    status: "Seats available",
  },
  {
    id: "trip-4",
    routeName: "Circle — Adenta",
    mode: "Trotro",
    durationMinutes: 48,
    fare: 7.0,
    departure: "08:20",
    arrival: "09:08",
    occupancy: 57,
    stops: 11,
    status: "Seats available",
  },
  {
    id: "trip-5",
    routeName: "Airport — Tema",
    mode: "Bus",
    durationMinutes: 55,
    fare: 12.0,
    departure: "08:35",
    arrival: "09:30",
    occupancy: 46,
    stops: 8,
    status: "Seats available",
  },
];

const bookings: Array<{
  id: string;
  tripId: string;
  routeName: string;
  passengerCount: number;
  totalFare: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}> = [];

const reports: Array<{
  id: string;
  reportType: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}> = [];

const wallet = {
  balance: 126.5,
  currency: "GHS",
  autoTopup: true,
  methods: [
    { id: "momo", label: "MTN Mobile Money", type: "mobile_money", isDefault: true },
    { id: "card", label: "Visa ending 4832", type: "card", isDefault: false },
  ],
  transactions: [
    { id: "txn-1", description: "Osu — Madina", date: "Today, 07:42", amount: -8.5, status: "Completed" },
    { id: "txn-2", description: "Wallet top-up", date: "Yesterday, 18:06", amount: 100, status: "Completed" },
    { id: "txn-3", description: "Circle — Adenta", date: "Yesterday, 07:58", amount: -7, status: "Completed" },
  ],
};

router.get("/commuter/summary", (_req, res): void => {
  const summary = {
    firstName: "Ama",
    walletBalance: wallet.balance,
    activeTrip: {
      id: "active-1",
      routeName: "Osu — Madina",
      destination: "Madina Zongo",
      etaMinutes: 18,
      progress: 61,
      status: "In transit",
      vehicle: "BRT 204",
    },
    recentTrips: [
      ...bookings.slice(-2).reverse().map((booking) => ({
        id: booking.id,
        routeName: booking.routeName,
        date: "Just now",
        fare: booking.totalFare,
        status: booking.status,
      })),
      { id: "recent-1", routeName: "Circle — Adenta", date: "Yesterday", fare: 7, status: "Completed" },
      { id: "recent-2", routeName: "Osu — Madina", date: "Mon, 28 Jul", fare: 8.5, status: "Completed" },
    ].slice(0, 4),
    savedRoutes: routes.slice(0, 3),
    impact: { minutesSaved: 146, carbonReduced: 18.4, tripsCompleted: 24 + bookings.length },
  };

  res.json(GetCommuterSummaryResponse.parse(summary));
});

router.get("/routes", (req, res): void => {
  const parsed = ListRoutesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.toLowerCase().trim();
  const result = search
    ? routes.filter((route) =>
        [route.name, route.from, route.to, route.mode].some((value) =>
          value.toLowerCase().includes(search),
        ),
      )
    : routes;

  res.json(ListRoutesResponse.parse(result));
});

router.get("/trips/search", (req, res): void => {
  const parsed = SearchTripsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = `${parsed.data.origin} ${parsed.data.destination}`.toLowerCase();
  const result = trips.filter((trip) => {
    if (search.includes("circle") || search.includes("adenta")) {
      return trip.routeName === "Circle — Adenta";
    }
    if (search.includes("airport") || search.includes("tema")) {
      return trip.routeName === "Airport — Tema";
    }
    return trip.routeName === "Osu — Madina";
  });

  res.json(SearchTripsResponse.parse(result));
});

router.post("/bookings", (req, res): void => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const trip = trips.find((candidate) => candidate.id === parsed.data.tripId);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const booking = {
    id: `booking-${Date.now()}`,
    tripId: trip.id,
    routeName: trip.routeName,
    passengerCount: parsed.data.passengerCount,
    totalFare: trip.fare * parsed.data.passengerCount,
    paymentMethod: parsed.data.paymentMethod,
    status: "Confirmed",
    createdAt: new Date().toISOString(),
  };
  bookings.push(booking);
  res.status(201).json(CreateBookingResponse.parse(booking));
});

router.get("/wallet", (_req, res): void => {
  res.json(GetWalletResponse.parse(wallet));
});

router.post("/reports", (req, res): void => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const report = {
    id: `report-${Date.now()}`,
    ...parsed.data,
    status: "Received",
    createdAt: new Date().toISOString(),
  };
  reports.push(report);
  res.status(201).json(CreateReportResponse.parse(report));
});

export default router;