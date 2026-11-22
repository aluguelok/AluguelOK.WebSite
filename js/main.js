"use strict";

(function () {
  function hidePageLoader() {
    var pageLoading = document.querySelector(".page-loading");
    if (!pageLoading) return;
    pageLoading.classList.add("hide");
    setTimeout(function () {
      pageLoading.style.display = "none";
    }, 600);
  }

  window.addEventListener("load", hidePageLoader);

  function getSavedTheme() {
    var theme = localStorage.getItem("Inazuma_WebTheme");
    if (theme !== "light" && theme !== "dark") {
      theme = "light";
      localStorage.setItem("Inazuma_WebTheme", theme);
    }
    return theme;
  }

  function applyTheme(theme) {
    var html = document.documentElement;
    var webThemeBtn = document.querySelector("[data-web-trigger=web-theme]");
    html.dataset.webTheme = theme;
    if (webThemeBtn) {
      webThemeBtn.innerHTML =
        theme === "dark"
          ? '<i class="lni lni-sun"></i>'
          : '<i class="lni lni-night"></i>';
    }
  }

  function initUI() {
    var navbar = document.querySelector(".ic-navbar");
    var navbarToggler = navbar
      ? navbar.querySelector("[data-web-toggle=navbar-collapse]")
      : null;

    function toggleNavbarMenu(state) {
      if (!navbar || !navbarToggler) return;
      if (state === true) {
        navbar.classList.add("menu-show");
        navbarToggler.setAttribute("aria-expanded", "true");
        navbarToggler.innerHTML = '<i class="lni lni-close"></i>';
      } else if (state === false) {
        navbar.classList.remove("menu-show");
        navbarToggler.setAttribute("aria-expanded", "false");
        navbarToggler.innerHTML = '<i class="lni lni-menu"></i>';
      } else {
        toggleNavbarMenu(!navbar.classList.contains("menu-show"));
      }
    }

    if (!document.documentElement.dataset.aluguelokUiClickBound) {
      document.documentElement.dataset.aluguelokUiClickBound = "true";
      document.addEventListener("click", function (e) {
        var currentNavbar = document.querySelector(".ic-navbar");
        var currentToggler = currentNavbar
          ? currentNavbar.querySelector("[data-web-toggle=navbar-collapse]")
          : null;
        if (!currentToggler) return;

        if (currentToggler.contains(e.target)) {
          toggleNavbarMenu();
        } else if (!e.target.closest("#navbarMenu")) {
          toggleNavbarMenu(false);
        }
      });
    }

    function updateStickyNavbar() {
      var currentNavbar = document.querySelector(".ic-navbar");
      if (!currentNavbar) return;
      if (window.scrollY >= 72) {
        currentNavbar.classList.add("sticky");
      } else {
        currentNavbar.classList.remove("sticky");
      }
    }

    function updateScrollTopButton() {
      var st = document.querySelector("[data-web-trigger=scroll-top]");
      if (!st) return;
      if (
        document.body.scrollTop > 50 ||
        document.documentElement.scrollTop > 50
      ) {
        st.classList.remove("is-hided");
      } else {
        st.classList.add("is-hided");
      }
    }

    function runScrollspy() {
      var links = document.querySelectorAll(".ic-page-scroll");
      if (!links.length) return;
      var scrollpos =
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop;
      var topminus = scrollpos + 88;

      links.forEach(function (currentLink) {
        var dataTarget = currentLink.getAttribute("href");
        if (!dataTarget || dataTarget.charAt(0) !== "#") return;
        var targetElement = document.querySelector(dataTarget);
        if (!targetElement) return;

        if (
          targetElement.offsetTop <= topminus &&
          targetElement.offsetTop + targetElement.offsetHeight > topminus
        ) {
          links.forEach(function (l) {
            l.classList.remove("active");
          });
          currentLink.classList.add("active");
        } else {
          currentLink.classList.remove("active");
        }
      });
    }

    if (!document.documentElement.dataset.aluguelokScrollBound) {
      document.documentElement.dataset.aluguelokScrollBound = "true";
      window.addEventListener("scroll", function () {
        updateStickyNavbar();
        updateScrollTopButton();
        runScrollspy();
      });
    }

    updateStickyNavbar();
    updateScrollTopButton();

    // Web theme
    applyTheme(getSavedTheme());
    var webTheme = document.querySelector("[data-web-trigger=web-theme]");
    if (webTheme && !webTheme.dataset.themeBound) {
      webTheme.dataset.themeBound = "true";
      webTheme.addEventListener("click", function () {
        var nextTheme = getSavedTheme() === "dark" ? "light" : "dark";
        localStorage.setItem("Inazuma_WebTheme", nextTheme);
        applyTheme(nextTheme);
      });
    }

    // Menu smooth scroll
    var pageLinks = document.querySelectorAll(".ic-page-scroll");
    pageLinks.forEach(function (link) {
      if (link.dataset.scrollBound) return;
      link.dataset.scrollBound = "true";
      link.addEventListener("click", function (e) {
        var href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        var targetElement = document.querySelector(href);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
        toggleNavbarMenu(false);
      });
    });

    // Scroll to top click
    var stBtn = document.querySelector("[data-web-trigger=scroll-top]");
    if (stBtn && !stBtn.dataset.stBound) {
      stBtn.dataset.stBound = "true";
      stBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Tabs (legacy + artigos/ferramentas)
    var tabs = document.querySelectorAll(".tabs");
    tabs.forEach(function (tab) {
      if (tab.dataset.tabsBound) return;
      tab.dataset.tabsBound = "true";

      var links = tab.querySelectorAll(".tabs-nav .tabs-link");
      var contents = tab.querySelectorAll(".tabs-content");
      if (!links.length || !contents.length) return;

      function activateTab(activeLink) {
        var targetId = activeLink.dataset.webTarget;
        var targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        contents.forEach(function (c) {
          c.classList.add("hide");
          c.classList.add("hidden");
        });
        links.forEach(function (l) {
          l.classList.remove("active");
          l.setAttribute("aria-selected", "false");
        });

        activeLink.classList.add("active");
        activeLink.setAttribute("aria-selected", "true");
        targetEl.classList.remove("hide");
        targetEl.classList.remove("hidden");
      }

      activateTab(links[0]);

      links.forEach(function (link) {
        var targetId = link.dataset.webTarget;
        if (document.getElementById(targetId)) {
          link.addEventListener("click", function () {
            activateTab(link);
          });
        } else {
          link.disabled = true;
        }
      });
    });

    // Portfolio filter (kept for backwards compatibility)
    var portfolioFilters = document.querySelectorAll(".portfolio-menu button");
    portfolioFilters.forEach(function (filter) {
      if (filter.dataset.filterBound) return;
      filter.dataset.filterBound = "true";
      filter.addEventListener("click", function () {
        portfolioFilters.forEach(function (btn) {
          btn.classList.remove("active");
        });
        this.classList.add("active");

        var selected = filter.getAttribute("data-filter");
        var itemsToHide = document.querySelectorAll(
          '.portfolio-grid .portfolio :not([data-filter="' + selected + '"])'
        );
        var itemsToShow = document.querySelectorAll(
          '.portfolio-grid .portfolio [data-filter="' + selected + '"]'
        );

        if (selected === "all") {
          itemsToHide = [];
          itemsToShow = document.querySelectorAll(
            ".portfolio-grid .portfolio [data-filter]"
          );
        }

        itemsToHide.forEach(function (el) {
          el.parentElement.classList.add("hide");
          el.parentElement.classList.remove("show");
        });
        itemsToShow.forEach(function (el) {
          el.parentElement.classList.remove("hide");
          el.parentElement.classList.add("show");
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }

  window.AluguelOKUI = {
    init: initUI,
    hideLoader: hidePageLoader,
  };
})();
