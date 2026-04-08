import { publicPath } from "@/utils/publicPath";
// @ts-ignore
import ModalImage from "react-modal-image";

export const getImageFilenameBase = (alt: string, separator: "_" | "-" = "_") =>
  alt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(separator === "-" ? /^-+|-+$/g : /^_+|_+$/g, "");

interface DocImageProps {
  alt: string;
  src?: string;
  maxWidth?: string;
  imageMap?: Record<string, string>;
  subfolder?: string;
  separator?: "_" | "-";
  fallbackExt?: string;
  ext?: string;
  caption?: string;
  modalClassName?: string;
  plainImgExts?: string[];
  plainImgClassName?: string;
  getDefaultMaxWidth?: (filenameBase: string, ext: string) => string | undefined;
}

export default function DocImage({
  alt,
  src,
  maxWidth,
  imageMap,
  subfolder,
  separator = "_",
  fallbackExt = "png",
  ext,
  caption,
  modalClassName = "img-fluid mb-5 mt-3 border rounded shadow-sm w-100 zoom-cursor-img",
  plainImgExts = [],
  plainImgClassName = "img-fluid mb-5 mt-3",
  getDefaultMaxWidth,
}: DocImageProps) {
  const filenameBase = getImageFilenameBase(alt, separator);
  const modalAlt = filenameBase
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const finalExt = ext ?? (imageMap && imageMap[filenameBase]) ?? fallbackExt;
  const generatedSrc = publicPath(
    src ?? (subfolder ? `/${subfolder}/${filenameBase}.${finalExt}` : `/${filenameBase}.${finalExt}`)
  );
  const isPlain = plainImgExts.some(
    (e) => e.toLowerCase() === finalExt.toLowerCase()
  );

  if (isPlain) {
    return <img src={generatedSrc} className={plainImgClassName} alt={modalAlt} />;
  }

  const resolvedMaxWidth = maxWidth ?? getDefaultMaxWidth?.(filenameBase, finalExt);

  return (
    <div style={{ width: "100%", maxWidth: resolvedMaxWidth, margin: "0 auto" }}>
      <ModalImage
        small={generatedSrc}
        large={generatedSrc}
        alt={modalAlt}
        className={modalClassName}
        imageBackgroundColor="#fff"
      />
      {caption && <p className="text-muted small mb-0 text-center">{caption}</p>}
    </div>
  );
}
