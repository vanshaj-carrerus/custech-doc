import { upload } from "@imagekit/next";

function extensionForMime(mime: string) {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "bin";
}

// The file is uploaded straight from the browser to ImageKit (not through our
// own server), so it never has to round-trip through our database.
export async function uploadDocumentFile(
  savedId: string,
  fileUrl: string,
  fileType: string | null | undefined,
  onProgress?: (done: number, total: number) => void
) {
  const mime =
    fileUrl.startsWith("data:") && fileUrl.includes(";")
      ? fileUrl.slice(5, fileUrl.indexOf(";"))
      : fileType || "application/pdf";

  const file = await (await fetch(fileUrl)).blob();

  const authRes = await fetch("/api/imagekit-auth");
  const auth = await authRes.json();
  if (!authRes.ok || !auth.success) {
    throw new Error(auth.message || "Could not authorize the upload");
  }

  const result = await upload({
    file,
    fileName: `document-${savedId}.${extensionForMime(mime)}`,
    publicKey: auth.publicKey,
    signature: auth.signature,
    token: auth.token,
    expire: auth.expire,
    useUniqueFileName: true,
    onProgress: (event) => onProgress?.(event.loaded, event.total),
  });

  if (!result.url) {
    throw new Error("ImageKit did not return a file URL");
  }

  const saveRes = await fetch(`/api/documents/${savedId}/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileUrl: result.url, fileType: mime }),
  });
  const saveData = await saveRes.json();
  if (!saveRes.ok || !saveData.success) {
    throw new Error(saveData.message || "Could not finish uploading the document");
  }
}
