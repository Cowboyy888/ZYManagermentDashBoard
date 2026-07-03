export default function DashLoading() {
  return (
    <div style={{ padding: 24 }}>
      <div className="skeleton" style={{ height: 26, width: 200, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: 300, marginBottom: 24 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card" style={{ height: 88 }}>
            <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 28, width: "38%" }} />
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="skeleton" style={{ height: 16, width: 140 }} />
          <div className="skeleton" style={{ height: 32, width: 100, borderRadius: 8 }} />
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="skeleton" style={{ height: 13, width: `${55 + (i % 3) * 12}%` }} />
                <div className="skeleton" style={{ height: 11, width: "35%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
