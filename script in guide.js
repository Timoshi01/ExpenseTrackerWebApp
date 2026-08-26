document.addEventListener('DOMContentLoaded', () => {
  // --- Image Lightbox / Overlay ---
  const screenshotCards = document.querySelectorAll('.screenshot-card');
  
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = 'image-overlay';
  const overlayImg = document.createElement('img');
  overlay.appendChild(overlayImg);
  document.body.appendChild(overlay);

  screenshotCards.forEach(card => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img');
      if (img) {
        overlayImg.src = img.src;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling when overlay is open
      }
    });
  });

  overlay.addEventListener('click', () => {
    overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  });

  // --- Scroll Animation (Reveal on Scroll) ---
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll('.step-item, .feature-card, .quote');
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
  });

  console.log('PennyPilot Guide Script Loaded 🚀');
});
