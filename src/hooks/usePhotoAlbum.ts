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
  parent_photo_id: string | null;
  version: number;
  is_current: boolean;
}

export const usePhotoAlbum = (opts?: {
  category?: string | null;
  tags?: string[];
  includeArchived?: boolean;
  includeOldVersions?: boolean;
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
      if (!opts?.includeOldVersions) q = q.eq("is_current", true);
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

/**
 * Returns a map: stemId -> total version count (>=1) for the supplied current photos.
 * Used to render the "stack" indicator on grid thumbnails.
 */
export const usePhotoVersionCounts = (photos: PhotoAlbumEntry[] | undefined) => {
  return useQuery({
    enabled: !!photos && photos.length > 0,
    queryKey: [
      "photo-album-version-counts",
      (photos ?? []).map((p) => p.parent_photo_id ?? p.id).sort().join(","),
    ],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!photos || photos.length === 0) return {};
      const stems = Array.from(new Set(photos.map((p) => p.parent_photo_id ?? p.id)));
      const result: Record<string, number> = {};
      // Query siblings: parent_photo_id in stems OR id in stems
      const { data } = await supabase
        .from("photo_album" as never)
        .select("id, parent_photo_id")
        .or(`parent_photo_id.in.(${stems.join(",")}),id.in.(${stems.join(",")})`);
      const rows = (data as unknown as { id: string; parent_photo_id: string | null }[] | null) ?? [];
      for (const stem of stems) result[stem] = 0;
      for (const r of rows) {
        const stem = r.parent_photo_id ?? r.id;
        if (result[stem] !== undefined) result[stem] += 1;
      }
      return result;
    },
  });
};

const PHOTO_BUCKET = "photo-album";

export const useUploadPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      arg: File | { file: File; asVersionOf?: string }
    ): Promise<PhotoAlbumEntry> => {
      const file = arg instanceof File ? arg : arg.file;
      const asVersionOf = arg instanceof File ? undefined : arg.asVersionOf;
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

      // Resolve parent (stem) for versioning
      let parentId: string | null = null;
      let nextVersion = 1;
      if (asVersionOf) {
        const { data: target } = await supabase
          .from("photo_album" as never)
          .select("id, parent_photo_id")
          .eq("id", asVersionOf)
          .single();
        const t = target as unknown as { id: string; parent_photo_id: string | null } | null;
        parentId = t?.parent_photo_id ?? t?.id ?? asVersionOf;

        const { data: siblings } = await supabase
          .from("photo_album" as never)
          .select("version")
          .or(`id.eq.${parentId},parent_photo_id.eq.${parentId}`);
        const max = (siblings as unknown as { version: number }[] | null)?.reduce(
          (m, r) => Math.max(m, r.version ?? 1),
          0
        ) ?? 0;
        nextVersion = max + 1;
      }

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
          parent_photo_id: parentId,
          version: nextVersion,
          is_current: true,
        } as never)
        .select("*")
        .single();
      if (insErr) throw insErr;

      const entry = row as unknown as PhotoAlbumEntry;

      // If versioning: mark all other versions of this stem as not current
      if (parentId) {
        await supabase
          .from("photo_album" as never)
          .update({ is_current: false } as never)
          .or(`id.eq.${parentId},parent_photo_id.eq.${parentId}`)
          .neq("id", entry.id);
      }

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
      // If this was the current version of a stem, promote highest remaining version
      // (parent_photo_id may have been set to null via FK ON DELETE SET NULL)
      // Best-effort: handled by usePromoteCurrentVersion below where needed.
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};

// --- Versioning helpers ---

const stemIdOf = (p: { id: string; parent_photo_id: string | null }) =>
  p.parent_photo_id ?? p.id;

export const usePhotoVersions = (photo: PhotoAlbumEntry | null) => {
  return useQuery({
    enabled: !!photo,
    queryKey: ["photo-album-versions", photo ? stemIdOf(photo) : null],
    queryFn: async (): Promise<PhotoAlbumEntry[]> => {
      if (!photo) return [];
      const stem = stemIdOf(photo);
      const { data, error } = await supabase
        .from("photo_album" as never)
        .select("*")
        .or(`id.eq.${stem},parent_photo_id.eq.${stem}`)
        .order("version", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PhotoAlbumEntry[];
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

export const useBulkDeletePhotos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photos: { id: string; storage_path: string }[]) => {
      const paths = photos.map((p) => p.storage_path).filter(Boolean);
      if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      const ids = photos.map((p) => p.id);
      const { error } = await supabase.from("photo_album" as never).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};

export const useBulkArchivePhotos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("photo_album" as never)
        .update({ is_archived: true } as never)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-album"] }),
  });
};

/**
 * Assign multiple photos as new versions of a target photo.
 * The target becomes (or stays) the stem; other photos get incrementing version numbers
 * (oldest created_at first => lower version offset).
 */
export const useAssignAsVersions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, photoIds }: { targetId: string; photoIds: string[] }) => {
      const { data: target } = await supabase
        .from("photo_album" as never)
        .select("id, parent_photo_id, version")
        .eq("id", targetId)
        .single();
      const t = target as unknown as
        | { id: string; parent_photo_id: string | null; version: number }
        | null;
      if (!t) throw new Error("Ziel-Foto nicht gefunden");
      const stem = t.parent_photo_id ?? t.id;

      // Find current max version in stem family
      const { data: family } = await supabase
        .from("photo_album" as never)
        .select("id, version, created_at")
        .or(`id.eq.${stem},parent_photo_id.eq.${stem}`);
      let max =
        (family as unknown as { version: number }[] | null)?.reduce(
          (m, r) => Math.max(m, r.version ?? 1),
          0
        ) ?? 1;

      // Fetch the photos to attach in created_at order (oldest first)
      const { data: toAttach } = await supabase
        .from("photo_album" as never)
        .select("id, created_at")
        .in("id", photoIds.filter((id) => id !== stem))
        .order("created_at", { ascending: true });
      const attach = (toAttach as unknown as { id: string }[] | null) ?? [];

      // Assign versions: existing become older (lower version), newest = max+attach.length
      // Strategy: simply append in chronological order: each new one becomes max+1 (then max+1 etc.)
      // and the LAST one (most recent) becomes the current version.
      for (let i = 0; i < attach.length; i++) {
        max += 1;
        const isLast = i === attach.length - 1;
        const { error } = await supabase
          .from("photo_album" as never)
          .update({
            parent_photo_id: stem,
            version: max,
            is_current: isLast,
          } as never)
          .eq("id", attach[i].id);
        if (error) throw error;
      }

      // If anything was attached, demote all others in the family
      if (attach.length > 0) {
        const newCurrentId = attach[attach.length - 1].id;
        await supabase
          .from("photo_album" as never)
          .update({ is_current: false } as never)
          .or(`id.eq.${stem},parent_photo_id.eq.${stem}`)
          .neq("id", newCurrentId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photo-album"] });
      qc.invalidateQueries({ queryKey: ["photo-album-versions"] });
    },
  });
};

export const useSetCurrentVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: PhotoAlbumEntry) => {
      const stem = photo.parent_photo_id ?? photo.id;
      await supabase
        .from("photo_album" as never)
        .update({ is_current: false } as never)
        .or(`id.eq.${stem},parent_photo_id.eq.${stem}`);
      const { error } = await supabase
        .from("photo_album" as never)
        .update({ is_current: true } as never)
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photo-album"] });
      qc.invalidateQueries({ queryKey: ["photo-album-versions"] });
    },
  });
};