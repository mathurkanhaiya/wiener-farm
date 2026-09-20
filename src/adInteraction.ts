export function trackAdInteraction() {
  let interaction = false;
  const onBlur = () => {
    interaction = true;
  };

  return {
    start() {
      interaction = false;
      window.addEventListener('blur', onBlur);
    },
    interacted() {
      return interaction;
    },
    stop() {
      window.removeEventListener('blur', onBlur);
    },
  };
}
