import * as THREE from 'three';

// Screenshots, and sharing them.

const MARK = 'TreeLab · Studio Gray Lake';

// The view as a PNG, `scale` times the screen's size (as far as the GPU
// allows), with "TreeLab" in the corner if `mark`.
export async function capture({ renderer, scene, camera, scale = 1, mark = true }) {
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const gl = renderer.getContext();
  const most = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS), 8192);
  const fit = Math.min(1, most / (Math.max(size.x, size.y) * scale));
  const width = Math.round(size.x * scale * fit), height = Math.round(size.y * scale * fit);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    g.drawImage(renderer.domElement, 0, 0); // (before the browser shows the frame, so the picture is still there)
  } finally {
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.x, size.y, false);
    renderer.render(scene, camera);
  }

  if (mark) {
    const em = Math.max(12, Math.round(height / 48));
    g.font = `600 ${em}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    const pad = Math.round(em * 0.6);
    const w = g.measureText(MARK).width + pad * 2, h = em + pad * 1.4;
    const x = width - w - pad, y = height - h - pad;
    g.fillStyle = 'rgba(246, 248, 243, 0.78)';
    g.beginPath();
    g.roundRect(x, y, w, h, pad);
    g.fill();
    g.fillStyle = '#1f2a1c';
    g.textBaseline = 'middle';
    g.fillText(MARK, x + pad, y + h / 2);
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the browser could not make the picture'))), 'image/png'));
}

// Shares a screenshot: through the system's share sheet where the browser
// has one that takes pictures (phones, some desktops), which can send it to
// any app. Elsewhere, social networks can't take a picture from a web page,
// so the picture is downloaded and a dialog offers the link, to copy or to
// post to X, Bluesky, Reddit or Facebook with the picture added there.
// Returns 'shared', 'cancelled' or 'dialog'.
export async function shareImage({ blob, name, link, download }) {
  const text = 'Trees I grew in TreeLab';
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'TreeLab', text, url: link });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      // (otherwise fall through to the dialog)
    }
  }
  download(blob, name);
  const dialog = document.getElementById('share-dialog');
  const image = document.getElementById('share-image');
  URL.revokeObjectURL(image.src);
  image.src = URL.createObjectURL(blob);
  const q = encodeURIComponent;
  document.getElementById('share-x').href = `https://x.com/intent/post?text=${q(text)}&url=${q(link)}`;
  document.getElementById('share-bluesky').href = `https://bsky.app/intent/compose?text=${q(`${text} ${link}`)}`;
  document.getElementById('share-reddit').href = `https://www.reddit.com/submit?url=${q(link)}&title=${q(text)}`;
  document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${q(link)}`;
  const copy = document.getElementById('share-copy');
  copy.textContent = 'Copy link';
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = 'Copied';
    } catch {
      prompt('Copy this link:', link);
    }
  };
  document.getElementById('share-close').onclick = () => dialog.close();
  dialog.showModal();
  return 'dialog';
}
