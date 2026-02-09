export function Button({ variant, className = "", ...props }) {
  const variantClass = variant === "outline" ? "btn-outline" : "";
  return (
    <button
      className={[variantClass, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
