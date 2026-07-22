import { defaultDocumentContent } from "./utils.js";

const notes = (sb) => sb.schema("notes");
const tokenless = () => window.RootsUserBridge?.TOKENLESS_EMBED === true;
const broker = (payload) => window.RootsUserBridge.request("notes", payload);

export async function listFolders(sb, userId) {
  if (tokenless()) return (await broker({ action: "list" })).folders || [];
  const { data, error } = await notes(sb).from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createFolder(sb, userId, name, color = "#206efb") {
  if (tokenless()) return broker({ action: "create-folder", name, color });
  const { data, error } = await notes(sb).from("folders")
    .insert({ user_id: userId, name, color })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateFolder(sb, id, patch) {
  if (tokenless()) return broker({ action: "update-folder", id, patch });
  const { data, error } = await notes(sb).from("folders")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFolder(sb, id) {
  if (tokenless()) { await broker({ action: "delete-folder", id }); return; }
  const { error } = await notes(sb).from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function listDocuments(sb, userId) {
  if (tokenless()) return (await broker({ action: "list" })).documents || [];
  const { data, error } = await notes(sb).from("documents")
    .select("id,title,folder_id,tags,cluster_label,is_favorite,thumbnail,content,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDocument(sb, id) {
  if (tokenless()) return broker({ action: "get-document", id });
  const { data, error } = await notes(sb).from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDocument(sb, userId, { title, folderId, tags = [], clusterLabel = null, pagePreset = "a4-portrait" } = {}) {
  if (tokenless()) {
    return broker({
      action: "create-document",
      title,
      folder_id: folderId || null,
      tags,
      cluster_label: clusterLabel,
      content: defaultDocumentContent(pagePreset),
    });
  }
  const { data, error } = await notes(sb).from("documents")
    .insert({
      user_id: userId,
      title: title || "Unbenanntes Dokument",
      folder_id: folderId || null,
      tags,
      cluster_label: clusterLabel,
      content: defaultDocumentContent(pagePreset),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateDocument(sb, id, patch) {
  if (tokenless()) return broker({ action: "update-document", id, patch });
  const { data, error } = await notes(sb).from("documents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(sb, id) {
  if (tokenless()) { await broker({ action: "delete-document", id }); return; }
  const { error } = await notes(sb).from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function ensureDefaultFolder(sb, userId) {
  const folders = await listFolders(sb, userId);
  if (folders.length) return folders;
  return [await createFolder(sb, userId, "Meine Dokumente")];
}
