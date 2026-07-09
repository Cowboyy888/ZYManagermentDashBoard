import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listIoTDevices, getIoTDeviceSummary } from "@/actions/factory/iot";
import IoTRegistry from "./IoTRegistry";

export const dynamic = "force-dynamic";

export default async function IoTPage() {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const [devicesRes, summaryRes] = await Promise.all([
    listIoTDevices(),
    getIoTDeviceSummary(),
  ]);

  const devices = devicesRes.ok ? devicesRes.data : [];
  const summary = summaryRes.ok ? summaryRes.data : { total: 0, active: 0, offline: 0, online: 0, byType: [] };

  return <IoTRegistry devices={devices} summary={summary} />;
}
