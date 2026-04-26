export function exportPNG(canvasElement: HTMLCanvasElement | null) {
  if (!canvasElement) {
    alert('2D-схема недоступна для экспорта');
    return;
  }

  try {
    const dataUrl = canvasElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'interior-plan.png';
    a.click();
  } catch {
    alert('Не удалось экспортировать изображение');
  }
}
