// Прокрутка горизонтальних рядів мишею: затиснути й потягнути. Смуги прокрутки на сайті сховані.
// Працює для всіх рядів одразу. На сенсорних екранах нічого не змінює.

const DRAG_THRESHOLD = 6;
const IGNORED = "input, textarea, select, .swiper, .cp-root";

function scrollableRowAt(target) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth - el.clientWidth <= 1) continue;
    const overflow = getComputedStyle(el).overflowX;
    if (overflow === "auto" || overflow === "scroll") return el;
  }
  return null;
}

export function installDragScroll() {
  let row = null;
  let startX = 0;
  let startScroll = 0;
  let scale = 1;
  let dragging = false;

  const stop = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (dragging) {
      row.style.scrollBehavior = "";
      row.style.scrollSnapType = "";
      row.style.userSelect = "";
      document.body.style.cursor = "";
    }
  };

  function onMove(event) {
    const moved = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(moved) < DRAG_THRESHOLD) return;
      dragging = true;
      // Плавна прокрутка й прив'язка карток заважали б рухати ряд за курсором.
      row.style.scrollBehavior = "auto";
      row.style.scrollSnapType = "none";
      row.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    }
    event.preventDefault();
    row.scrollLeft = startScroll - moved / scale;
  }

  function onUp() {
    stop();
    if (!dragging) return;
    // Клік після перетягування не має відкривати картку під курсором.
    const swallow = (click) => {
      click.preventDefault();
      click.stopPropagation();
    };
    document.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
    dragging = false;
  }

  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || event.target.closest?.(IGNORED)) return;
    row = scrollableRowAt(event.target);
    if (!row) return;
    startX = event.clientX;
    startScroll = row.scrollLeft;
    // На великих екранах сторінка масштабована, тому рух миші перераховуємо.
    scale = row.getBoundingClientRect().width / row.offsetWidth || 1;
    dragging = false;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Інакше браузер починає тягнути саму картинку чи посилання замість ряду.
  document.addEventListener("dragstart", (event) => {
    if (scrollableRowAt(event.target)) event.preventDefault();
  });
}
