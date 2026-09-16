/** Fit a border-box textarea to its content, including when text is removed. */
export function fitTextarea(field: HTMLTextAreaElement): void {
  field.style.height = "auto";
  const borderHeight = field.offsetHeight - field.clientHeight;
  field.style.height = `${field.scrollHeight + borderHeight}px`;
}
