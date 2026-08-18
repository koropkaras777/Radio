export const PHONE_RATIO = 20 / 9;

export function cropToPhoneJpg(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;
        const sourceRatio = img.height / img.width;

        if (sourceRatio > PHONE_RATIO) {
          sh = Math.round(img.width * PHONE_RATIO);
          sy = Math.max(0, Math.round((img.height - sh) / 2));
        } else {
          sw = Math.round(img.height / PHONE_RATIO);
          sx = Math.max(0, Math.round((img.width - sw) / 2));
        }

        const outWidth = 900;
        const outHeight = Math.round(outWidth * PHONE_RATIO);

        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Failed to create JPG'));
            return;
          }
          const croppedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '') + '.jpg',
            { type: 'image/jpeg' }
          );
          const previewUrl = URL.createObjectURL(blob);
          resolve({ file: croppedFile, previewUrl });
        }, 'image/jpeg', 0.92);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image'));
    };

    img.src = objectUrl;
  });
}