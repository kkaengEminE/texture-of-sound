export function displayToInternal(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  internal: { width: number; height: number }
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * internal.width;
  const y = ((clientY - rect.top) / rect.height) * internal.height;
  return { x, y };
}
