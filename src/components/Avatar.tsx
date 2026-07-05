import Image from "next/image";

interface Props {
  photoUrl: string | null;
  name: string;
  size?: number;
  radius?: number;
  priority?: boolean;
}

const BLOB_SUFFIX = ".blob.vercel-storage.com";

function resolvePhotoUrl(url: string): string {
  // Private Vercel Blob URLs must go through our authenticated proxy
  if (url.includes(BLOB_SUFFIX)) {
    return `/api/employee-photo?url=${encodeURIComponent(url)}`;
  }
  // Local /uploads/... paths served directly as static files
  return url;
}

export function Avatar({ photoUrl, name, size = 32, radius = 8, priority = false }: Props) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  if (photoUrl) {
    const src = resolvePhotoUrl(photoUrl);
    const isLocal = src.startsWith("/uploads/");

    if (isLocal) {
      // Local static file — next/image handles it directly
      return (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          priority={priority}
          style={{ borderRadius: radius, objectFit: "cover", flexShrink: 0 }}
        />
      );
    }

    // Proxy URL — use plain <img> (next/image can't optimize private blob proxies)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        style={{
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          width: size,
          height: size,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: "var(--steel-light)", color: "var(--steel)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.34), fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}
