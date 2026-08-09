/**
 * Clipboard polyfill compatible avec les anciens navigateurs.
 * Utilise navigator.clipboard quand disponible, sinon fallback sur execCommand('copy').
 */

function fallbackCopy(text: string): Promise<boolean> {
  return new Promise(function (resolve) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    // Empêcher le défilement
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      var ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      resolve(ok);
    } catch (_e) {
      document.body.removeChild(textarea);
      resolve(false);
    }
  });
}

export async function clipboardCopy(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_e) {
    // Fallback below
  }
  return fallbackCopy(text);
}

export function isClipboardSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function');
}
