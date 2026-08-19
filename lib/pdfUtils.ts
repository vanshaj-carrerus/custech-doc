/**
 * Utility to detect the exact page count of a PDF file or Base64 data URL.
 */
export function detectPdfPageCount(dataUrlOrFile: string | File): Promise<number> {
  return new Promise((resolve) => {
    try {
      if (dataUrlOrFile instanceof File) {
        // Image files are strictly 1 page
        if (dataUrlOrFile.type.startsWith("image/")) {
          return resolve(1);
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            parsePdfText(result, resolve);
          } else if (result instanceof ArrayBuffer) {
            const dec = new TextDecoder("latin1");
            const text = dec.decode(result);
            parsePdfText(text, resolve);
          } else {
            resolve(1);
          }
        };
        reader.onerror = () => resolve(1);
        reader.readAsArrayBuffer(dataUrlOrFile);
      } else if (typeof dataUrlOrFile === "string") {
        if (dataUrlOrFile.startsWith("data:image/")) {
          return resolve(1);
        }
        if (dataUrlOrFile.startsWith("data:application/pdf") || dataUrlOrFile.includes("%PDF")) {
          const base64Part = dataUrlOrFile.split(",")[1];
          let rawText = dataUrlOrFile;
          if (base64Part) {
            try {
              rawText = atob(base64Part);
            } catch {
              rawText = dataUrlOrFile;
            }
          }
          parsePdfText(rawText, resolve);
        } else {
          resolve(1);
        }
      } else {
        resolve(1);
      }
    } catch {
      resolve(1);
    }
  });
}

function parsePdfText(text: string, resolve: (val: number) => void) {
  try {
    // 1. Search for /Type /Pages ... /Count N catalog structure
    const countMatches = [...text.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const lastMatch = countMatches[countMatches.length - 1];
      const pageCount = parseInt(lastMatch[1], 10);
      if (pageCount > 0 && pageCount < 500) {
        return resolve(pageCount);
      }
    }

    // 2. Count occurrences of /Type /Page
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return resolve(pageMatches.length);
    }

    // 3. Fallback check for /Page \b
    const altMatches = text.match(/\/Page\b/g);
    if (altMatches && altMatches.length > 0) {
      // Filter out /Pages
      const actualPages = altMatches.filter((m) => !m.includes("Pages"));
      if (actualPages.length > 0) {
        return resolve(Math.min(actualPages.length, 50));
      }
    }
  } catch {}
  resolve(1);
}
