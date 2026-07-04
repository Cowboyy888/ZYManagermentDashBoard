import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { listIoTDevices, getIoTDeviceSummary } from "@/actions/factory/iot";
import IoTRegistry from "./IoTRegistry";

export const dynamic = "force-dynamic";

export default async function IoTPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [devicesRes, summaryRes] = await Promise.all([
    listIoTDevices(),
    getIoTDeviceSummary(),
  ]);

  const devices = devicesRes.ok ? devicesRes.data : [];
  const summary = summaryRes.ok ? summaryRes.data : { total: 0, active: 0, offline: 0, online: 0, byType: [] };

  return <IoTRegistry devices={devices} summary={summary} />;
}
