import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { convertFileToWebp, toWebpFilename } from "@/lib/convertToWebp";

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
      const rows = (data ?? []) as unknown as PhotoAlbumEntry[];

      // Der Bucket ist privat → signed URLs erzeugen (1h), damit <img> sie laden kann.
      const paths = rows.map((r) => r.storage_path).filter(Boolean);
      if (paths.length === 0) return rows;

      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(paths, 60 * 60);

      const byPath = new Map<string, string>();
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
      }
      return rows.map((r) => ({ ...r, url: byPath.get(r.storage_path) ?? r.url }));
    },
  });
};

const PHOTO_BUCKET = "photo-album";

export const useUploadPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<PhotoAlbumEntry> => {
      // Convert to optimized WebP (max 1920px, q0.82) before upload.
      // Falls back to original if browser cannot encode webp.
      const converted = await convertFileToWebp(file);
      const useWebp = converted.isWebp;
      const ext = useWebp ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase();
      const contentType = useWebp ? "image/webp" : file.type;
      const finalFilename = useWebp ? toWebpFilename(file.name) : file.name;

      const now = new Date();
      const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, converted.blob, {
        contentType,
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
          filename: finalFilename,
          width: converted.width || null,
          height: converted.height || null,
          file_size: converted.blob.size,
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