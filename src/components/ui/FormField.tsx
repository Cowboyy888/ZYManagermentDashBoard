import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { FieldError } from "./Alert";

// ─── Shared field wrapper ────────────────────────────────────────────────────

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  required?: boolean;
  errors?: string[] | null;
  htmlFor?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, hint, required, errors, htmlFor, children }: FieldWrapperProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label
          htmlFor={htmlFor}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}
        >
          {label}
          {required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {hint && !errors?.length && (
        <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{hint}</p>
      )}
      <FieldError errors={errors} />
    </div>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errors?: string[] | null;
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, errors, hasError, style, ...props },
  ref
) {
  const invalid = hasError || (errors && errors.length > 0);
  return (
    <FieldWrapper label={label} hint={hint} required={props.required} errors={errors} htmlFor={props.id ?? props.name}>
      <input
        ref={ref}
        id={props.id ?? props.name}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 7,
          border: `1px solid ${invalid ? "var(--red)" : "var(--border)"}`,
          fontSize: 13,
          color: "var(--text)",
          background: props.disabled ? "var(--surface-2)" : "var(--surface)",
          outline: "none",
          boxSizing: "border-box",
          ...style,
        }}
        {...props}
      />
    </FieldWrapper>
  );
});

// ─── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  errors?: string[] | null;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, errors, placeholder, style, children, ...props },
  ref
) {
  const invalid = errors && errors.length > 0;
  return (
    <FieldWrapper label={label} hint={hint} required={props.required} errors={errors} htmlFor={props.id ?? props.name}>
      <select
        ref={ref}
        id={props.id ?? props.name}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 7,
          border: `1px solid ${invalid ? "var(--red)" : "var(--border)"}`,
          fontSize: 13,
          color: "var(--text)",
          background: props.disabled ? "var(--surface-2)" : "var(--surface)",
          outline: "none",
          boxSizing: "border-box",
          ...style,
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </FieldWrapper>
  );
});

// ─── Textarea ────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  errors?: string[] | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, errors, style, ...props },
  ref
) {
  const invalid = errors && errors.length > 0;
  return (
    <FieldWrapper label={label} hint={hint} required={props.required} errors={errors} htmlFor={props.id ?? props.name}>
      <textarea
        ref={ref}
        id={props.id ?? props.name}
        rows={3}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 7,
          border: `1px solid ${invalid ? "var(--red)" : "var(--border)"}`,
          fontSize: 13,
          color: "var(--text)",
          background: props.disabled ? "var(--surface-2)" : "var(--surface)",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
          fontFamily: "inherit",
          ...style,
        }}
        {...props}
      />
    </FieldWrapper>
  );
});
