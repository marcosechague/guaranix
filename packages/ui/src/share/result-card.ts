import brodiUrl from '../assets/brodi.png';
import wordmarkUrl from '../assets/guaranix-wordmark.png';
import { darkColors } from '../tokens/colors';

/** Everything on the card comes in already translated and formatted. */
export interface ResultCardContent {
  boxName: string;
  date: string;
  eyebrow: string;
  title: string;
  score: string;
  details: string[];
  /** Brodi joins the card on a personal record. */
  withBrodi: boolean;
}

/** Instagram story size. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
const MARGIN = 96;
const DISPLAY_FONT = "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif";
const TEXT_FONT = "'Inter Variable', Inter, system-ui, sans-serif";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // A card without the picture is still worth sharing.
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** The largest size, up to `max`, at which `text` fits in `width`. */
export function fittingFontSize(
  measure: (size: number) => number,
  width: number,
  max: number,
  min = 48,
): number {
  let size = max;
  while (size > min && measure(size) > width) size -= 4;
  return size;
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  family: string,
  max: number,
): number {
  const width = CARD_WIDTH - MARGIN * 2;
  const size = fittingFontSize(
    (candidate) => {
      context.font = `${weight} ${candidate}px ${family}`;
      return context.measureText(text).width;
    },
    width,
    max,
  );
  context.font = `${weight} ${size}px ${family}`;
  return size;
}

async function drawCard(context: CanvasRenderingContext2D, content: ResultCardContent) {
  const colors = darkColors;
  const [wordmark, brodi] = await Promise.all([
    loadImage(wordmarkUrl),
    content.withBrodi ? loadImage(brodiUrl) : Promise.resolve(null),
  ]);
  await document.fonts.ready;

  context.fillStyle = colors.background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = colors.accent;
  context.fillRect(MARGIN, MARGIN, 120, 12);
  context.textBaseline = 'alphabetic';

  context.fillStyle = colors.textSecondary;
  fitText(context, `${content.boxName} · ${content.date}`, 500, TEXT_FONT, 40);
  context.fillText(`${content.boxName} · ${content.date}`, MARGIN, MARGIN + 100);

  let y = 560;
  context.fillStyle = colors.accent;
  context.font = `700 44px ${TEXT_FONT}`;
  context.fillText(content.eyebrow.toUpperCase(), MARGIN, y);
  y += 130;
  context.fillStyle = colors.text;
  const titleSize = fitText(context, content.title, 700, DISPLAY_FONT, 110);
  context.fillText(content.title, MARGIN, y);
  y += Math.max(260, titleSize + 220);
  context.fillStyle = colors.accent;
  fitText(context, content.score, 700, DISPLAY_FONT, 300);
  context.fillText(content.score, MARGIN - 8, y);
  y += 110;
  context.fillStyle = colors.textSoft;
  context.font = `500 52px ${TEXT_FONT}`;
  for (const line of content.details) {
    context.fillText(line, MARGIN, y);
    y += 76;
  }

  if (brodi) context.drawImage(brodi, CARD_WIDTH - MARGIN - 300, CARD_HEIGHT - 640, 300, 300);
  if (wordmark) {
    const height = 72;
    const width = (wordmark.width / wordmark.height) * height;
    context.drawImage(wordmark, MARGIN, CARD_HEIGHT - MARGIN - height, width, height);
  }
}

/** Draws the card as a PNG, ready to share or download. */
export async function renderResultCard(content: ResultCardContent): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  await drawCard(context, content);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png'),
  );
}
