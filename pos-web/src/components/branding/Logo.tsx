"use client";

import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  href?: string;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  imageClassName?: string;
  size?: number;
  priority?: boolean;
  label?: string;
};

export function Logo({
  href,
  showText = true,
  className,
  textClassName,
  imageClassName,
  size = 40,
  priority,
  label = "Kyla Cafe System",
}: LogoProps) {
  const baseClasses = ["flex items-center gap-3", className]
    .filter(Boolean)
    .join(" ");
  const imageClasses = [imageClassName].filter(Boolean).join(" ");

  const content = (
    <>
      <Image
        src="/kyla-cafe-system-logo.png"
        alt="Kyla Cafe System logo"
        width={size}
        height={size}
        priority={priority}
        className={imageClasses || undefined}
      />
      {showText ? (
        <span
          className={textClassName ?? "text-base font-semibold text-slate-900"}
        >
          {label}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
