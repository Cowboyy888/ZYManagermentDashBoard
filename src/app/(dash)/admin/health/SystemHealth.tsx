"use client";

type CronJob = {
  name: string;
  path: string;
  description: string;
  schedule: string;
};

type HealthData = {
  db: { ok: boolean; latencyMs: number };
  uptime: number;
  activeUsers: number;
  unreadNotifications: number;
  recentAuditCount: number;
  pendingLeave: number;
  pendingOT: number;
  openOrders: number;
  lowStockCount: number;
  cronJobs: CronJob[];
};

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_DOT = {
  ok: "bg-green-500",
  warn: "bg-amber-400",
  error: "bg-red-500",
};

export default function SystemHealth({ data }: { data: HealthData }) {
  return (
    <div className="space-y-6">
      {/* DB + App Status */}
      <div className="panel">
        <div className="panel-head">System Status</div>
        <div className="panel-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="kpi-card">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${data.db.ok ? STATUS_DOT.ok : STATUS_DOT.error}`} />
                <span className="kpi-label">Database</span>
              </div>
              <div className="kpi-value text-base">{data.db.ok ? "Connected" : "Error"}</div>
              <div className="text-xs text-gray-400">{data.db.latencyMs}ms latency</div>
            </div>

            <div className="kpi-card">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.ok}`} />
                <span className="kpi-label">App Server</span>
              </div>
              <div className="kpi-value text-base">Online</div>
              <div className="text-xs text-gray-400">Uptime: {fmtUptime(data.uptime)}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label mb-1">Active Sessions</div>
              <div className="kpi-value">{data.activeUsers}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label mb-1">Unread Notifications</div>
              <div className={`kpi-value ${data.unreadNotifications > 0 ? "text-amber-600" : ""}`}>
                {data.unreadNotifications}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Work */}
      <div className="panel">
        <div className="panel-head">Pending Work</div>
        <div className="panel-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="kpi-card">
              <div className="kpi-label mb-1">Leave Requests</div>
              <div className={`kpi-value ${data.pendingLeave > 0 ? "text-amber-600" : ""}`}>{data.pendingLeave}</div>
              <div className="text-xs text-gray-400">pending approval</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label mb-1">Overtime</div>
              <div className={`kpi-value ${data.pendingOT > 0 ? "text-amber-600" : ""}`}>{data.pendingOT}</div>
              <div className="text-xs text-gray-400">pending approval</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label mb-1">Production Orders</div>
              <div className="kpi-value">{data.openOrders}</div>
              <div className="text-xs text-gray-400">open / in-progress</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label mb-1">Low Stock Items</div>
              <div className={`kpi-value ${data.lowStockCount > 0 ? "text-red-600" : ""}`}>{data.lowStockCount}</div>
              <div className="text-xs text-gray-400">at or below min stock</div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Activity */}
      <div className="panel">
        <div className="panel-head">Recent Activity</div>
        <div className="panel-body">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-indigo-600">{data.recentAuditCount}</span>
            <span className="text-sm text-gray-500">audit log entries in the last 24 hours</span>
          </div>
          <a href="/admin/audit" className="text-sm text-indigo-600 underline mt-2 inline-block">
            View full audit log →
          </a>
        </div>
      </div>

      {/* Cron Jobs */}
      <div className="panel">
        <div className="panel-head">Scheduled Jobs</div>
        <div className="panel-body">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Schedule</th>
                  <th>Description</th>
                  <th>Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {data.cronJobs.map((job) => (
                  <tr key={job.path}>
                    <td className="font-medium">{job.name}</td>
                    <td>
                      <span className="tag" style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3" }}>
                        {job.schedule}
                      </span>
                    </td>
                    <td className="text-gray-500">{job.description}</td>
                    <td className="font-mono text-xs text-gray-400">{job.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
