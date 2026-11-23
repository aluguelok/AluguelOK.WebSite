"use strict";

(function () {
  // =========================================================================
  // CONFIGURAÇÃO CENTRAL DA INTEGRAÇÃO COM O APP (AluguelOK.App)
  // =========================================================================
  var isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  var CONFIG = {
    APP_BASE_URL: isLocal
      ? "https://localhost:7263"
      : "https://app.aluguelok.com.br",
    API_BASE_URL: isLocal
      ? "https://localhost:7262"
      : "https://api.aluguelok.com.br",
    ASSIGN_TIMEOUT_MS: 550,
    STORAGE_KEY: "aluguelok_ab_variant",
    VARIANTS: ["A", "B", "C"],
    VARIANT_PATHS: {
      A: "./lp/a.html",
      B: "./lp/b.html",
      C: "./lp/c.html",
    },
  };

  function normalizeVariant(val) {
    if (!val) return null;
    var upper = String(val).trim().toUpperCase();
    return CONFIG.VARIANTS.indexOf(upper) !== -1 ? upper : null;
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function persistAssignedVariant(variant) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, variant);
      document.cookie =
        "aluguelok_ab=" +
        variant +
        "; path=/; max-age=2592000; SameSite=Lax";
    } catch (e) {}
  }

  function randomFallbackVariant() {
    var randomIndex = Math.floor(Math.random() * CONFIG.VARIANTS.length);
    if (window.crypto && window.crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      randomIndex = arr[0] % CONFIG.VARIANTS.length;
    }
    return CONFIG.VARIANTS[randomIndex];
  }

  function resolveStoredOrForcedVariant() {
    var reset = getQueryParam("reset_ab");
    if (reset === "1") {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      } catch (e) {}
    }

    var forced =
      normalizeVariant(getQueryParam("lp")) ||
      normalizeVariant(getQueryParam("variant"));
    if (forced) {
      persistAssignedVariant(forced);
      return forced;
    }

    var stored = null;
    try {
      stored = normalizeVariant(localStorage.getItem(CONFIG.STORAGE_KEY));
    } catch (e) {}

    return stored;
  }

  function resolveVariant() {
    var existing = resolveStoredOrForcedVariant();
    if (existing) return existing;

    var assigned = randomFallbackVariant();
    persistAssignedVariant(assigned);
    return assigned;
  }

  async function resolveVariantProportionalAsync() {
    var existing = resolveStoredOrForcedVariant();
    if (existing) return existing;

    var assigned = null;
    if (window.location.protocol !== "file:" && typeof fetch === "function") {
      var controller =
        typeof AbortController === "function" ? new AbortController() : null;
      var timerId = controller
        ? setTimeout(function () {
            controller.abort();
          }, CONFIG.ASSIGN_TIMEOUT_MS)
        : null;

      try {
        var res = await fetch(CONFIG.API_BASE_URL + "/api/v1/ab/assign", {
          method: "GET",
          cache: "no-store",
          signal: controller ? controller.signal : undefined,
        });
        if (res.ok) {
          var data = await res.json();
          assigned = normalizeVariant(data && data.variant);
        }
      } catch (e) {
        // Fallback automático abaixo caso API esteja indisponível/timeout
      } finally {
        if (timerId !== null) clearTimeout(timerId);
      }
    }

    if (!assigned) {
      assigned = randomFallbackVariant();
    }

    persistAssignedVariant(assigned);
    return assigned;
  }

  function profileCode(profile) {
    if (!profile) return "G";
    var p = String(profile).toLowerCase();
    if (p.indexOf("inq") === 0) return "I";
    if (p.indexOf("prop") === 0) return "P";
    return "G";
  }

  function buildAppUrl(profile, variant, cta) {
    var base = CONFIG.APP_BASE_URL.replace(/\/+$/, "");
    var params = new URLSearchParams();
    params.set("lp", variant);
    if (cta) params.set("c", cta);

    if (profile === "Inquilino" || profile === "Proprietario") {
      return base + "/Upload/" + profile + "?" + params.toString();
    }
    if (profile === "Policy") {
      return base + "/Policy?" + params.toString();
    }
    if (profile === "Help") {
      return base + "/Help?" + params.toString();
    }
    return base + "/?" + params.toString();
  }

  function stampReferrerUrl(variant, profile, cta) {
    try {
      var params = new URLSearchParams(window.location.search);
      params.set("lp", variant);
      if (profile) {
        params.set("p", profileCode(profile));
      }
      if (cta) {
        params.set("c", String(cta).slice(0, 16));
      }
      // Mantém a URL completa abaixo de 64 chars para [Visitor].[Origin] no backend
      // Ex: https://aluguelok.com.br/?lp=A&p=I&c=hero (42 chars)
      var cleanPath = window.location.pathname;
      if (cleanPath === "/index.html") cleanPath = "/";
      var nextUrl = cleanPath + "?" + params.toString();
      window.history.replaceState(null, "", nextUrl);
    } catch (e) {}
  }

  function trackClarity(variant, eventName) {
    try {
      if (typeof window.clarity === "function") {
        window.clarity("set", "ab_variant", variant);
        if (eventName) {
          window.clarity("event", eventName);
        }
      }
    } catch (e) {}
  }

  function bindCTAs(variant) {
    var nodes = document.querySelectorAll("[data-cta]");
    nodes.forEach(function (el) {
      var profile = el.getAttribute("data-profile") || "";
      var ctaName = el.getAttribute("data-cta") || "cta";
      var targetUrl = buildAppUrl(profile, variant, ctaName);

      if (el.tagName === "A") {
        el.setAttribute("href", targetUrl);
        el.setAttribute("referrerpolicy", "unsafe-url");
      }

      if (!el.dataset.abBound) {
        el.dataset.abBound = "true";

        var prepareOrigin = function () {
          var liveProfile = el.getAttribute("data-profile") || "";
          var liveCta = el.getAttribute("data-cta") || "cta";
          if (el.tagName === "A") {
            el.setAttribute("href", buildAppUrl(liveProfile, variant, liveCta));
          }
          stampReferrerUrl(variant, liveProfile, liveCta);
          trackClarity(
            variant,
            "lp_" + variant + "_" + liveCta + "_" + profileCode(liveProfile)
          );
        };

        el.addEventListener("pointerdown", prepareOrigin);
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") prepareOrigin();
        });
        el.addEventListener("click", function (e) {
          prepareOrigin();
          if (el.tagName !== "A") {
            e.preventDefault();
            var liveProfile = el.getAttribute("data-profile") || "";
            var liveCta = el.getAttribute("data-cta") || "cta";
            window.location.href = buildAppUrl(liveProfile, variant, liveCta);
          }
        });
      }
    });
  }

  function injectDebugBarIfRequested(variant) {
    if (getQueryParam("debug") !== "1") return;
    if (document.getElementById("aluguelok-ab-debug")) return;

    var bar = document.createElement("div");
    bar.id = "aluguelok-ab-debug";
    bar.style.cssText =
      "position:fixed;bottom:16px;left:16px;z-index:99999;background:#0f172a;color:#fff;padding:8px 12px;border-radius:12px;font-size:12px;font-family:Inter,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 10px 25px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);";
    bar.innerHTML =
      '<span style="opacity:.75;">A/B Test:</span>' +
      ["A", "B", "C"]
        .map(function (v) {
          var active = v === variant;
          return (
            '<a href="?lp=' +
            v +
            '&debug=1" style="padding:3px 9px;border-radius:6px;text-decoration:none;font-weight:700;' +
            (active
              ? "background:#0d6efd;color:#fff;"
              : "background:rgba(255,255,255,0.1);color:#cbd5e1;") +
            '">' +
            v +
            "</a>"
          );
        })
        .join("") +
      '<a href="?reset_ab=1&debug=1" style="margin-left:4px;color:#38bdf8;text-decoration:underline;">Sortear</a>';
    document.body.appendChild(bar);
  }

  function runVariantScripts(container) {
    var scripts = container.querySelectorAll("script[data-variant-script]");
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement("script");
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      document.body.appendChild(newScript);
    });
  }

  function normalizeImportedPaths(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll("[src], [href]").forEach(function (node) {
      ["src", "href"].forEach(function (attr) {
        var val = node.getAttribute(attr);
        if (val && val.indexOf("../") === 0) {
          node.setAttribute(attr, "./" + val.slice(3));
        }
      });
    });
  }

  async function mountOrchestratedVariant(variant) {
    var path = CONFIG.VARIANT_PATHS[variant] || CONFIG.VARIANT_PATHS.A;
    stampReferrerUrl(variant, "", "");
    document.documentElement.setAttribute("data-ab-variant", variant);

    try {
      var response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var htmlText = await response.text();
      var doc = new DOMParser().parseFromString(htmlText, "text/html");

      // Atualiza classes do body e título
      if (doc.body && doc.body.className) {
        document.body.className = doc.body.className;
      }
      if (doc.title) {
        document.title = doc.title;
      }

      // Remove estilos anteriores de variante e injeta novos
      document
        .querySelectorAll("style[data-variant-style]")
        .forEach(function (s) {
          s.remove();
        });
      doc.querySelectorAll("style[data-variant-style]").forEach(function (s) {
        var clonedStyle = document.createElement("style");
        clonedStyle.setAttribute("data-variant-style", "true");
        clonedStyle.textContent = s.textContent;
        document.head.appendChild(clonedStyle);
      });

      // Substitui shell visual principal mantendo loader/PWA intactos
      var headerEl = doc.querySelector("header.ic-navbar");
      var mainEl = doc.querySelector("main");
      var footerEl = doc.querySelector("footer");

      var curHeader = document.querySelector("header.ic-navbar");
      var curMain = document.querySelector("main");
      var curFooter = document.querySelector("footer");

      if (headerEl && curHeader) {
        var importedHeader = document.importNode(headerEl, true);
        normalizeImportedPaths(importedHeader);
        curHeader.replaceWith(importedHeader);
      }
      if (mainEl && curMain) {
        var importedMain = document.importNode(mainEl, true);
        normalizeImportedPaths(importedMain);
        curMain.replaceWith(importedMain);
      }
      if (footerEl && curFooter) {
        var importedFooter = document.importNode(footerEl, true);
        normalizeImportedPaths(importedFooter);
        curFooter.replaceWith(importedFooter);
      }

      runVariantScripts(doc);

      if (window.AluguelOKUI && typeof window.AluguelOKUI.init === "function") {
        window.AluguelOKUI.init();
      }
      bindCTAs(variant);
      trackClarity(variant, "view_lp_" + variant);
      injectDebugBarIfRequested(variant);

      if (
        window.AluguelOKUI &&
        typeof window.AluguelOKUI.hideLoader === "function"
      ) {
        window.AluguelOKUI.hideLoader();
      }
    } catch (err) {
      // Fallback seguro quando aberto via file:// sem servidor HTTP
      if (window.location.protocol === "file:") {
        window.location.replace(path + window.location.search);
        return;
      }
      console.warn("AB fallback inline:", err);
      bindCTAs(variant);
      if (
        window.AluguelOKUI &&
        typeof window.AluguelOKUI.hideLoader === "function"
      ) {
        window.AluguelOKUI.hideLoader();
      }
    }
  }

  function init() {
    var pageKind = document.querySelector('meta[name="aluguelok-page-kind"]');
    if (pageKind && pageKind.getAttribute("content") === "content") {
      // Páginas editoriais/calculadoras: preserva variante já sorteada sem consumir slot do A/B
      var existingVariant = resolveStoredOrForcedVariant() || "SITE";
      bindCTAs(existingVariant);
      return;
    }

    var metaVariant = document.querySelector('meta[name="aluguelok-variant"]');
    if (metaVariant) {
      // Execução direta de lp/a.html, lp/b.html ou lp/c.html
      var standaloneVariant =
        normalizeVariant(metaVariant.getAttribute("content")) || "A";
      document.documentElement.setAttribute(
        "data-ab-variant",
        standaloneVariant
      );
      bindCTAs(standaloneVariant);
      trackClarity(standaloneVariant, "view_lp_" + standaloneVariant);
      injectDebugBarIfRequested(standaloneVariant);
      return;
    }

    // Execução via index.html (Orquestrador A/B/C proporcional via API)
    resolveVariantProportionalAsync().then(function (assigned) {
      mountOrchestratedVariant(assigned);
    });
  }

  window.AluguelOKAB = {
    getConfig: function () {
      return CONFIG;
    },
    getVariant: function () {
      return (
        document.documentElement.getAttribute("data-ab-variant") ||
        resolveVariant()
      );
    },
    buildAppUrl: buildAppUrl,
    bindCTAs: bindCTAs,
    stampReferrerUrl: stampReferrerUrl,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
