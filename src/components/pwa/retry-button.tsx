"use client";

export interface RetryButtonProps {
  className?: string;
}

export function RetryButton({ className }: RetryButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.location.reload();
      }}
    >
      Try again
    </button>
  );
}
