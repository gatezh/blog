// Mobile navigation toggle for the header partial.

const menuBtn = document.getElementById("mobile-menu-btn");
const mobileMenu = document.getElementById("mobile-menu");

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", () => {
    const isExpanded = menuBtn.getAttribute("aria-expanded") === "true";
    menuBtn.setAttribute("aria-expanded", String(!isExpanded));
    mobileMenu.classList.toggle("hidden");
    mobileMenu.setAttribute("aria-hidden", String(isExpanded));
  });
}

export {};
