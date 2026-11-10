import type { ImgHTMLAttributes } from "react";
import { useSocialImageUrl } from "@/lib/socialImages";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined };

/** <img> som visar bilder från social-images via signerad URL. */
export function SocialImage({ src, alt = "", ...rest }: Props) {
  const resolved = useSocialImageUrl(src);
  if (!resolved) return <div className={rest.className} aria-hidden="true" />;
  return <img src={resolved} alt={alt} {...rest} />;
}

export default SocialImage;
