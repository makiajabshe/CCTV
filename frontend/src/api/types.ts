/** Dashboard read models. Mirror of docs/CONTRACTS.md ("Dashboard → Backend"). Do not add fields here that the API does not return. */

export interface StoreOut {
  store_id: string;
  tenant_id: string;
  name: string;
  timezone: string;
}

export interface SummaryOut {
  store_id: string;
  date: string; // YYYY-MM-DD in store timezone
  timezone: string;
  enter: number;
  exit: number;
  occupancy_estimate: number;
  last_event_at: string | null; // UTC ISO
}

export interface HourBucket {
  hour_start: string; // store-local ISO with offset
  enter: number;
  exit: number;
}

export interface HourlyOut {
  store_id: string;
  date: string;
  timezone: string;
  buckets: HourBucket[];
}

export interface DeviceOut {
  device_id: string;
  name: string;
  api_key_prefix: string;
  is_active: boolean;
  last_seen_at: string | null; // UTC ISO
}
