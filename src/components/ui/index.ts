/**
 * ZY Steel Design System — component barrel.
 * Import from "@/components/ui" instead of individual files.
 *
 * @example
 *   import { Button, Card, Badge, useToast } from "@/components/ui";
 */

export { Button } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";

export { Badge, statusColor } from "./Badge";
export type { BadgeColor, BadgeSize } from "./Badge";

export { Card, KpiCard } from "./Card";

export { PageHeader } from "./PageHeader";

export { Spinner, PageLoader, Skeleton } from "./Spinner";

export { Alert, FieldError } from "./Alert";
export type { AlertLevel } from "./Alert";

export { FieldWrapper, Input, Select, Textarea } from "./FormField";

export { Dialog, ConfirmDialog } from "./Dialog";

export { Pagination } from "./Pagination";

export { DataTable } from "./DataTable";

export { ToastProvider, useToast } from "./Toast";
export type { Toast, ToastLevel } from "./Toast";
