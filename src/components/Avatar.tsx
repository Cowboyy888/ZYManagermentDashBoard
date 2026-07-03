import Image from "next/image";

interface Props {
  photoUrl: string | null;
  name: string;
  size?: number;
  radius?: number;
  priority?: boolean;
}

export function Avatar({ photoUrl, name, size = 32, radius = 8, priority = false }: Props) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        priority={priority}
        style={{ borderRadius: radius, objectFit: "cover", flexShrink: 0 }}
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
