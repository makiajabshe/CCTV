import { Activity, Clock, Cpu, PowerOff } from "lucide-react";
import type { DeviceOut } from "../../api/types";
import { formatDateTimeInTz, isStale, relativeTime } from "../../lib/time";

interface Props {
  devices: DeviceOut[] | undefined;
  tz: string;
  now: Date;
}

type Status = "active" | "stale" | "never" | "inactive";

const STATUS: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
  active: { label: "Event baru < 5 mnt", cls: "bg-emerald-soft text-emerald-brand border-emerald-200", Icon: Activity },
  stale: { label: "Belum ada event baru", cls: "bg-surface-2 text-txt-2 border-line", Icon: Clock },
  never: { label: "Belum pernah mengirim event", cls: "bg-surface-2 text-txt-2 border-line", Icon: Clock },
  inactive: { label: "Nonaktif", cls: "bg-danger-soft text-danger border-red-200", Icon: PowerOff },
};

const statusOf = (d: DeviceOut, now: Date): Status =>
  !d.is_active ? "inactive" : d.last_seen_at === null ? "never" : isStale(d.last_seen_at, now) ? "stale" : "active";

export const DeviceList = ({ devices, tz, now }: Props) => (
  <section data-testid="device-list-card" aria-labelledby="devices-title" className="card fade-in p-5 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-txt-2"><Cpu className="h-4 w-4" /></span>
      <div>
        <h2 id="devices-title" className="text-base md:text-lg font-semibold text-txt">Perangkat</h2>
        <p className="text-xs text-txt-3">Status berdasarkan event terakhir yang dikirim, bukan sinyal langsung dari kamera.</p>
      </div>
    </div>
    {devices && devices.length === 0 && (
      <p data-testid="device-empty" className="text-sm text-txt-2">Belum ada perangkat terdaftar untuk toko ini.</p>
    )}
    {!devices && <p data-testid="device-unavailable" className="text-sm text-txt-2">Daftar perangkat belum berhasil dimuat.</p>}
    <ul className="divide-y divide-line">
      {(devices ?? []).map((d) => {
        const st = statusOf(d, now);
        const { Icon } = STATUS[st];
        return (
          <li key={d.device_id} data-testid="device-item-row" className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-txt">{d.name}</p>
              <p data-testid="device-last-seen" className="text-xs text-txt-2 tnum">
                {d.last_seen_at
                  ? `Terakhir mengirim event ${relativeTime(d.last_seen_at, now)} · ${formatDateTimeInTz(d.last_seen_at, tz)}`
                  : "Belum ada event yang diterima dari perangkat ini"}
              </p>
            </div>
            <span data-testid="device-status-badge" data-status={st}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[st].cls}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {STATUS[st].label}
            </span>
          </li>
        );
      })}
    </ul>
  </section>
);
