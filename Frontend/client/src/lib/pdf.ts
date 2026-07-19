import type { jsPDF } from 'jspdf';
import usbLogo from '../../../assets/images/Logo_USB.png';

let usbLogoPromise: Promise<HTMLImageElement> | null = null;

function loadUsbLogo(): Promise<HTMLImageElement> {
  if (usbLogoPromise) {
    return usbLogoPromise;
  }

  usbLogoPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Impossible de charger Logo_USB.png.'));
    image.src = usbLogo;
  });

  return usbLogoPromise;
}

export async function addPdfUsbLogo(
  doc: jsPDF,
  options: { x: number; y: number; width: number; gap?: number; scale?: number; offsetY?: number },
): Promise<{ contentX: number; logoBottomY: number }> {
  const { x, y, width, gap = 8, scale = 0.9, offsetY = 4 } = options;
  const image = await loadUsbLogo();
  const ratio = image.height / image.width;
  const scaledWidth = width * scale;
  const height = scaledWidth * ratio;
  const adjustedY = y + offsetY;

  doc.addImage(image, 'PNG', x, adjustedY, scaledWidth, height);

  return {
    contentX: x + scaledWidth + gap,
    logoBottomY: adjustedY + height,
  };
}