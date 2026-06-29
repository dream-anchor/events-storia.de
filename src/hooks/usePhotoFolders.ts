import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhotoFolder {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface PhotoFolderItem {
  folder_id: string;
  photo_id: string;
}

/**
 * Liste aller Ordner (sortiert). Realtime: aktualisiert bei Änderungen.
 */
export const usePhotoFolders = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("photo_folders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photo_folders" },
        () => qc.invalidateQueries({ queryKey: ["photo-folders"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["photo-folders"],
    queryFn: async (): Promise<PhotoFolder[]> => {
      const { data, error } = await supabase
        .from("photo_folders" as never)
        .select("id, name, color, sort_order, created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PhotoFolder[];
    },
  });
};

/**
 * Alle Foto<->Ordner-Zuordnungen. Daraus werden Zähler pro Ordner und die
 * Mitgliedschaft pro Foto abgeleitet (Tabelle ist klein -> ein Query genügt).
 */
export const usePhotoFolderItems = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("photo_folder_items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photo_folder_items" },
        () => qc.invalidateQueries({ queryKey: ["photo-folder-items"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const query = useQuery({
    queryKey: ["photo-folder-items"],
    queryFn: async (): Promise<PhotoFolderItem[]> => {
      const { data, error } = await supabase
        .from("photo_folder_items" as never)
        .select("folder_id, photo_id");
      if (error) throw error;
      return (data ?? []) as unknown as PhotoFolderItem[];
    },
  });

  const derived = useMemo(() => {
    const items = query.data ?? [];
    const countByFolder = new Map<string, number>();
    const foldersByPhoto = new Map<string, Set<string>>();
    const photosByFolder = new Map<string, Set<string>>();
    for (const it of items) {
      countByFolder.set(it.folder_id, (countByFolder.get(it.folder_id) ?? 0) + 1);
      if (!foldersByPhoto.has(it.photo_id)) foldersByPhoto.set(it.photo_id, new Set());
      foldersByPhoto.get(it.photo_id)!.add(it.folder_id);
      if (!photosByFolder.has(it.folder_id)) photosByFolder.set(it.folder_id, new Set());
      photosByFolder.get(it.folder_id)!.add(it.photo_id);
    }
    return { countByFolder, foldersByPhoto, photosByFolder };
  }, [query.data]);

  return { ...query, ...derived };
};

export const useCreateFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string | null }): Promise<PhotoFolder> => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("photo_folders" as never)
        .insert({ name: name.trim(), color: color ?? null, created_by: user.user?.id ?? null } as never)
        .select("id, name, color, sort_order, created_at")
        .single();
      if (error) throw error;
      return data as unknown as PhotoFolder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-folders"] }),
  });
};

export const useUpdateFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string | null }) => {
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      const { error } = await supabase.from("photo_folders" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-folders"] }),
  });
};

export const useDeleteFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Zuordnungen werden per ON DELETE CASCADE mitgelöscht (Fotos bleiben erhalten).
      const { error } = await supabase.from("photo_folders" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photo-folders"] });
      qc.invalidateQueries({ queryKey: ["photo-folder-items"] });
    },
  });
};

/** Fügt mehrere Fotos einem Ordner hinzu (Duplikate werden ignoriert). */
export const useAddPhotosToFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, photoIds }: { folderId: string; photoIds: string[] }) => {
      if (photoIds.length === 0) return;
      const rows = photoIds.map((photo_id) => ({ folder_id: folderId, photo_id }));
      const { error } = await supabase
        .from("photo_folder_items" as never)
        .upsert(rows as never, { onConflict: "folder_id,photo_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-folder-items"] }),
  });
};

/** Entfernt ein Foto aus einem Ordner (Foto bleibt erhalten). */
export const useRemovePhotoFromFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, photoId }: { folderId: string; photoId: string }) => {
      const { error } = await supabase
        .from("photo_folder_items" as never)
        .delete()
        .eq("folder_id", folderId)
        .eq("photo_id", photoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-folder-items"] }),
  });
};

/** Setzt die Ordner-Mitgliedschaft EINES Fotos exakt auf die übergebene Menge. */
export const useSetPhotoFolders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ photoId, folderIds }: { photoId: string; folderIds: string[] }) => {
      const { data: existing, error: selErr } = await supabase
        .from("photo_folder_items" as never)
        .select("folder_id")
        .eq("photo_id", photoId);
      if (selErr) throw selErr;
      const current = new Set(((existing ?? []) as unknown as { folder_id: string }[]).map((r) => r.folder_id));
      const next = new Set(folderIds);

      const toAdd = folderIds.filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));

      if (toAdd.length > 0) {
        const rows = toAdd.map((folder_id) => ({ folder_id, photo_id: photoId }));
        const { error } = await supabase
          .from("photo_folder_items" as never)
          .upsert(rows as never, { onConflict: "folder_id,photo_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("photo_folder_items" as never)
          .delete()
          .eq("photo_id", photoId)
          .in("folder_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-folder-items"] }),
  });
};
