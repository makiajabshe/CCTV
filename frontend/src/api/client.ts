import type { DeviceOut, HourlyOut, StoreOut, SummaryOut } from "./types";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const DASHBOARD_KEY = process.env.REACT_APP_DASHBOARD_KEY;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  if (!BACKEND_URL) throw new ApiError(0, "REACT_APP_BACKEND_URL tidak dikonfigurasi");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (DASHBOARD_KEY) headers["X-Dashboard-Key"] = DASHBOARD_KEY;
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api${path}`, { headers });
  } catch {
    throw new ApiError(0, "Tidak dapat terhubung ke server API");
  }
  if (!res.ok) throw new ApiError(res.status, `API mengembalikan HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  stores: () => get<StoreOut[]>("/v1/stores"),
  summary: (storeId: string, date: string) => get<SummaryOut>(`/v1/stores/${storeId}/summary?date=${date}`),
  hourly: (storeId: string, date: string) => get<HourlyOut>(`/v1/stores/${storeId}/hourly?date=${date}`),
  devices: (storeId: string) => get<DeviceOut[]>(`/v1/stores/${storeId}/devices`),
};
