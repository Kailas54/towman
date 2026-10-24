import { whatsappLink } from '../config';

export function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-form-status]')!;
  const locate = form.querySelector<HTMLButtonElement>('[data-locate]')!;
  const location = form.elements.namedItem('location') as HTMLInputElement;

  locate.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      status.textContent = 'Location is not available on this device. Please type your area or landmark.';
      return;
    }
    status.textContent = 'Finding you…';
    locate.disabled = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        location.value = `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
        location.classList.remove('is-invalid');
        status.textContent = 'Location pinned. We will see exactly where you are.';
        locate.disabled = false;
      },
      () => {
        status.textContent = 'Could not get your location. Please type your area or a nearby landmark.';
        locate.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });

  form.addEventListener('input', (e) => (e.target as HTMLElement).classList.remove('is-invalid'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();

    const missing = ['name', 'location'].filter((k) => !get(k));
    missing.forEach((k) => (form.elements.namedItem(k) as HTMLElement).classList.add('is-invalid'));
    if (missing.length) {
      status.textContent = 'Please add your name and location so we can reach you.';
      (form.elements.namedItem(missing[0]) as HTMLElement).focus();
      return;
    }

    const lines = [
      '*Towman Assistance Request*',
      `Name: ${get('name')}`,
      get('phone') && `Phone: ${get('phone')}`,
      `Service: ${get('service')}`,
      get('vehicle') && `Vehicle: ${get('vehicle')}`,
      `Location: ${get('location')}`,
      get('notes') && `Notes: ${get('notes')}`,
    ].filter(Boolean);

    window.open(whatsappLink(lines.join('\n')), '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp. Just hit send and help is on the way.';
  });
}
