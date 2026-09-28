import DOMPurify from 'dompurify';

/** Propiedades de color que el modelo no puede imponer: la app decide colores legibles. */
const COLOR_PROPS = ['color', 'background', 'background-color', 'background-image', 'border-color', 'opacity'];

/**
 * Sanitiza el HTML que genera el modelo (resúmenes y respuestas) y le quita los colores
 * de texto y fondo de sus estilos inline, para que no salgan combinaciones ilegibles
 * (por ejemplo, fondo azul oscuro con títulos negros). Se conservan el resto de estilos
 * (márgenes, tablas, negritas) y los avisos propios de la app, marcados con data-keep-style.
 */
export function cleanModelHtml(html: string): string {
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true }) as DocumentFragment;
  fragment.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    if (el.closest('[data-keep-style]')) return;
    COLOR_PROPS.forEach((prop) => el.style.removeProperty(prop));
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  });
  // bgcolor y color como atributos HTML antiguos.
  fragment.querySelectorAll('[bgcolor], font[color]').forEach((el) => {
    if (el.closest('[data-keep-style]')) return;
    el.removeAttribute('bgcolor');
    el.removeAttribute('color');
  });
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}
