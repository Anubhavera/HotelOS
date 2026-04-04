import styles from "./Input.module.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  required,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={styles["input-group"]}>
      {label && (
        <label
          htmlFor={inputId}
          className={`${styles.label} ${required ? styles["label--required"] : ""}`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${styles.input} ${error ? styles["input--error"] : ""} ${className}`}
        {...props}
      />
      {error && <span className={styles["error-text"]}>{error}</span>}
      {helperText && !error && (
        <span className={styles["helper-text"]}>{helperText}</span>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  required,
  options,
  placeholder,
  className = "",
  id,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={styles["input-group"]}>
      {label && (
        <label
          htmlFor={selectId}
          className={`${styles.label} ${required ? styles["label--required"] : ""}`}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`${styles.input} ${styles.select} ${error ? styles["input--error"] : ""} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className={styles["error-text"]}>{error}</span>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Textarea({
  label,
  error,
  required,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={styles["input-group"]}>
      {label && (
        <label
          htmlFor={textareaId}
          className={`${styles.label} ${required ? styles["label--required"] : ""}`}
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`${styles.input} ${styles.textarea} ${error ? styles["input--error"] : ""} ${className}`}
        {...props}
      />
      {error && <span className={styles["error-text"]}>{error}</span>}
    </div>
  );
}
