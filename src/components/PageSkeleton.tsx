// Shared skeleton shell for per-segment loading.tsx files

const pulse: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: 6,
  animation: "zy-pulse 1.4s ease-in-out infinite",
};

function Bar({ w, h = 14 }: { w: string | number; h?: number }) {
  return <div style={{ ...pulse, width: w, height: h, flexShrink: 0 }} />;
}

function Card() {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <Bar w="55%" h={11} />
      <Bar w="38%" h={26} />
    </div>
  );
}

function Row() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ ...pulse, width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Bar w="42%" />
        <Bar w="28%" h={11} />
      </div>
      <Bar w={60} h={22} />
      <Bar w={50} h={22} />
    </div>
  );
}

interface PageSkeletonProps {
  cards?: number;
  rows?: number;
  wide?: boolean;
}

export default function PageSkeleton({ cards = 4, rows = 8, wide = false }: PageSkeletonProps) {
  return (
    <div style={{ padding: 24 }}>
      <style>{`@keyframes zy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Bar w={220} h={24} />
        <div style={{ marginTop: 8 }}><Bar w={340} h={13} /></div>
      </div>

      {/* KPI card grid */}
      {cards > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? cards : "auto-fill"}, minmax(180px, 1fr))`, gap: 14, marginBottom: 24 }}>
          {Array.from({ length: cards }).map((_, i) => <Card key={i} />)}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ ...pulse, width: 220, height: 36, borderRadius: 8 }} />
        <div style={{ ...pulse, width: 140, height: 36, borderRadius: 8 }} />
        <div style={{ ...pulse, width: 100, height: 36, borderRadius: 8 }} />
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Bar w={160} h={15} />
          <Bar w={80} h={30} />
        </div>
        <div style={{ padding: "0 16px" }}>
          {Array.from({ length: rows }).map((_, i) => <Row key={i} />)}
        </div>
      </div>
    </div>
  );
}
