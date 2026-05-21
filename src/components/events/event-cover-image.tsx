import Image from "next/image";
import { cn } from "@/lib/utils";

interface EventCoverImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/** Suporta URLs remotas (next/image) e data URLs de upload local. */
export function EventCoverImage({
  src,
  alt,
  fill = false,
  width,
  height,
  priority = false,
  sizes,
  className,
}: EventCoverImageProps) {
  if (src.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(fill && "absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
