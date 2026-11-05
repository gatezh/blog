// Mobile navigation toggle for the header partial.

const menuBtn = document.getElementById("mobile-menu-btn");
const mobileMenu = document.getElementById("mobile-menu");

if (menuBtn && mobileMenu) {
  // The hidden attribute also takes the closed menu out of the accessibility
  // tree, so it needs no aria-hidden of its own.
  menuBtn.addEventListener("click", () => {
    mobileMenu.hidden = !mobileMenu.hidden;
    menuBtn.setAttribute("aria-expanded", String(!mobileMenu.hidden));
  });
}

export {};
