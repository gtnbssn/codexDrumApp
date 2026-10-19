/** Native dialogs provide focus trapping, background inertness, and focus return. */
export function openDialog(node: HTMLDialogElement, close: () => void) {
  node.showModal();
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const cancel = (event: Event) => {
    event.preventDefault();
    close();
  };
  node.addEventListener('cancel', cancel);
  return {
    update(next: () => void) {
      close = next;
    },
    destroy() {
      node.removeEventListener('cancel', cancel);
      node.close();
      document.body.style.overflow = previousOverflow;
    },
  };
}
