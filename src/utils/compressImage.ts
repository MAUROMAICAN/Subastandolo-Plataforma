/**
 * Compress an image file before uploading to Supabase storage.
 * Converts to WebP, resizes to maxWidth, and targets a quality level.
 * Typically reduces image size by 60-80%.
 */
export async function compressImage(
    file: File,
    maxWidth = 1200,
    quality = 0.75,
): Promise<File> {
    // Skip non-image files
    if (!file.type.startsWith("image/")) return file;

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions keeping aspect ratio
            let w = img.width;
            let h = img.height;
            if (w > maxWidth) {
                h = Math.round((h * maxWidth) / w);
                w = maxWidth;
            }

            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file); // fallback to original
                        return;
                    }
                    // Only use compressed version if it's actually smaller
                    if (blob.size < file.size) {
                        const ext = "webp";
                        const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
                        resolve(new File([blob], name, { type: `image/${ext}` }));
                    } else {
                        resolve(file); // original was already small
                    }
                },
                "image/webp",
                quality,
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // fallback on error
        };
        img.src = url;
    });
}
