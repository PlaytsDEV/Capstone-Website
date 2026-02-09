import { useState } from "react";

export function ImageWithFallback({ src, alt, fallbackSrc, className, ...rest }) {
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setCurrentSrc(
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
    );
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...rest}
    />
  );
}
