import { useState } from "react";
import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { usePhotoAlbum } from "@/hooks/usePhotoAlbum";

interface PhotoAlbumGalleryProps {
  category?: string;
  tags?: string[];
  className?: string;
}

/**
 * Reusable public photo gallery powered by the Foto-Album CMS.
 * Drop into any public page: <PhotoAlbumGallery category="ambiente" />
 */
export const PhotoAlbumGallery = ({ category, tags, className }: PhotoAlbumGalleryProps) => {
  const { data: photos } = usePhotoAlbum({ category, tags });
  const [index, setIndex] = useState(-1);

  const items =
    photos?.map((p) => ({
      src: p.url,
      width: p.width ?? 1200,
      height: p.height ?? 800,
      alt: p.title || p.description || p.filename || "",
    })) ?? [];

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <RowsPhotoAlbum
        photos={items}
        targetRowHeight={220}
        onClick={({ index: i }) => setIndex(i)}
      />
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={items}
      />
    </div>
  );
};

export default PhotoAlbumGallery;