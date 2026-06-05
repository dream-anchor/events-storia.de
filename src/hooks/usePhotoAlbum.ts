import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhotoAlbumEntry {
  id: string;
  url: string;
  storage_path: string;
  filename: string | null;
  width: number | null;
  height: number | null;
  category: string | null;
  tags: string[];
  ai_classified: boolean;
  ai_confidence: number | null;
  ai_error: string | null;
  title: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
}

export const usePhotoAlbum = (opts?: {
  category?: string | null;
  tags?: string[];
  includeArchived?: boolean;
}) => {
  const qc = useQueryClient();

  // Realtime: refresh on changes
  useEffect(() => {
    const ch = supabase
      .channel("photo_album_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photo_album" },
        () => {
          qc.invalidateQueries({ queryKey: ["photo-album"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["photo-album", opts?.category ?? null, opts?.tags ?? [], opts?.includeArchived ?? false],
    queryFn: async (): Promise<PhotoAlbumEntry[]> => {
      let q = supabase.from("photo_album" as never).select("*").order("created_at", { ascending: false });
      if (!opts?.includeArchived) q = q.eq("is_archived", false);
      if (opts?.category) q = q.eq("category", opts.category);
      if (opts?.tags && opts.tags.length > 0) q = q.contains("tags", opts.tags);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PhotoAlbumEntry[];
    },
  });
};

const PHOTO_BUCKET = "photo-album";

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export const useUploadPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<PhotoAlbumEntry> => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const now = new Date();
      const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

      const dims = await getImageDimensions(file);

      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { data: user } = await supabase.auth.getUser();

      const { data: row, error: insErr } = await supabase
        .from("photo_album" as never)
        .insert({
          storage_path: path,
          url: publicUrl,
          filename: file.name,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          file_size: file.size,
          created_by: user.user?.id ?? null,
        } as never)
        .select("*")
        .single();
      if (insErr) throw insErr;

      const entry = row as unknown as PhotoAlbumEntry;

      // Trigger classification (fire and forget — realtime updates UI)
      supabase.functions
        .invoke("classify-photo", { body: { photoId: entry.id, photoUrl: entry.url } })
        .catch((e) => console.error("classify-photo invoke failed", e));

      return entry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};

export const useReclassifyPhoto = () => {
  return useMutation({
    mutationFn: async (photo: { id: string; url: string }) => {
      const { error } = await supabase.functions.invoke("classify-photo", {
        body: { photoId: photo.id, photoUrl: photo.url },
      });
      if (error) throw error;
    },
  });
};

export const useUpdatePhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<PhotoAlbumEntry, "category" | "tags" | "title" | "description" | "is_archived">>;
    }) => {
      const { error } = await supabase.from("photo_album" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};

export const useDeletePhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
      const { error } = await supabase.from("photo_album" as never).delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};