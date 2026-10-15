(() => {
  "use strict";

  /* =========================================================
     全局状态与工具
     ========================================================= */
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THEME_STORAGE_KEY = "LLLowy-theme";
  const dom = {};

  /**
   * 集中缓存常用 DOM 元素。
   * 后续函数直接使用 dom 对象，避免反复查找元素，方便阅读和讲解。
   */
  function cacheDom() {
    dom.html = document.documentElement;
    dom.header = document.getElementById("siteHeader");
    dom.themeToggle = document.getElementById("themeToggle");
    dom.navToggle = document.getElementById("navToggle");
    dom.navMenu = document.getElementById("navMenu");
    dom.scrollProgress = document.getElementById("scrollProgress");
    dom.backToTop = document.getElementById("backToTop");
    dom.terminalOutput = document.getElementById("terminalOutput");
    dom.qqCard = document.getElementById("qqCard");
    dom.toast = document.getElementById("toast");
    dom.toastMessage = document.getElementById("toastMessage");
  }

  /**
   * 封装 localStorage。
   * 部分浏览器在隐私模式下可能禁止访问，所以读写都加 try/catch。
   */
  function getStorageValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function setStorageValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // 保存失败时仍然允许本次页面会话正常切换主题。
    }
  }

  /* =========================================================
     1. 主题切换
     功能：切换深色/浅色主题，并把用户选择保存到 localStorage。
     ========================================================= */
  function initThemeToggle() {
    const savedTheme = getStorageValue(THEME_STORAGE_KEY);
    const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const initialTheme = savedTheme || (systemPrefersLight ? "light" : "dark");

    applyTheme(initialTheme);

    dom.themeToggle.addEventListener("click", () => {
      const nextTheme = dom.html.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      setStorageValue(THEME_STORAGE_KEY, nextTheme);
    });
  }

  /**
   * 只修改 html 的 data-theme。
   * 具体颜色变化由 CSS 变量完成，逻辑简单，也便于现场解释。
   */
  function applyTheme(theme) {
    dom.html.dataset.theme = theme;
    dom.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "切换到浅色主题" : "切换到深色主题"
    );

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "dark" ? "#0a0e14" : "#f4f7fb");
    }
  }

  /* =========================================================
     2. 移动端导航
     功能：点击汉堡按钮打开菜单，点击链接、Esc 或外部区域关闭菜单。
     ========================================================= */
  function initMobileNav() {
    const setMenuOpen = (isOpen) => {
      dom.header.classList.toggle("menu-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
      dom.navToggle.setAttribute("aria-expanded", String(isOpen));
      dom.navToggle.setAttribute("aria-label", isOpen ? "关闭导航菜单" : "打开导航菜单");
    };

    dom.navToggle.addEventListener("click", () => {
      setMenuOpen(!dom.header.classList.contains("menu-open"));
    });

    dom.navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });

    document.addEventListener("click", (event) => {
      if (!dom.header.contains(event.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 767) {
        setMenuOpen(false);
      }
    });
  }

  /* =========================================================
     3. 滚动进度与页头状态
     功能：滚动时更新顶部进度条，并切换导航栏毛玻璃样式。
     ========================================================= */
  function initScrollProgress() {
    let ticking = false;

    const update = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;

      dom.html.style.setProperty("--scroll-progress", progress.toFixed(4));
      dom.header.classList.toggle("scrolled", window.scrollY > 12);
      dom.backToTop.classList.toggle("visible", window.scrollY > window.innerHeight);
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  }

  /* =========================================================
     4. 导航高亮
     功能：使用 IntersectionObserver 监听主要区块，高亮当前导航项。
     ========================================================= */
  function initNavHighlight() {
    const navLinks = Array.from(document.querySelectorAll(".nav-link"));
    const sections = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          navLinks.forEach((link) => {
            const isCurrent = link.getAttribute("href") === `#${entry.target.id}`;
            link.classList.toggle("active", isCurrent);

            if (isCurrent) {
              link.setAttribute("aria-current", "location");
            } else {
              link.removeAttribute("aria-current");
            }
          });
        });
      },
      {
        // 只关注屏幕中间区域，避免相邻区块同时被判断为当前区块。
        rootMargin: "-35% 0px -55% 0px",
        threshold: 0
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /* =========================================================
     5. 元素进入视口动画
     功能：IntersectionObserver 添加 is-visible，data-stagger 下交错出现。
     ========================================================= */
  function initRevealAnimations() {
    const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));

    document.querySelectorAll("[data-stagger]").forEach((group) => {
      const children = Array.from(group.querySelectorAll(":scope > [data-reveal]"));

      children.forEach((element, index) => {
        element.style.setProperty("--reveal-delay", `${index * 80}ms`);
      });
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.12
      }
    );

    revealElements.forEach((element) => observer.observe(element));
  }

  /* =========================================================
     6. Hero 终端打字机
     功能：使用 requestAnimationFrame 模拟逐行命令行输出。
     ========================================================= */
  function initTerminalTyping() {
    const lines = [
      {
        command: "whoami",
        output: "→ 刘智龙 / 清雾晚照"
      },
      {
        command: "cat school.txt",
        output: "→ 武汉科技大学 软件工程 2504 班"
      },
      {
        command: "ls skills/",
        output: "→ C语言 Java MATLAB Anaconda"
      },
      {
        command: "./plan --career",
        output: "→ Java 后端开发"
      }
    ];

    if (prefersReducedMotion) {
      renderTerminalImmediately(lines);
      return;
    }

    playTerminal(lines);
  }

  function renderTerminalImmediately(lines) {
    lines.forEach((item) => {
      appendTerminalCommand(item.command);
      appendTerminalOutput(item.output);
    });

    appendTerminalCursor();
  }

  async function playTerminal(lines) {
    for (const item of lines) {
      const commandElement = appendTerminalCommand("");
      await typeText(commandElement, item.command, 34);
      await waitFrames(150);

      const outputElement = appendTerminalOutput("");
      await typeText(outputElement, item.output, 18);
      await waitFrames(210);
    }

    appendTerminalCursor();
  }

  /**
   * 添加一条命令并返回可继续输入的节点。
   * initialText 为空时，打字函数会往节点中逐字追加。
   */
  function appendTerminalCommand(initialText) {
    const line = document.createElement("div");
    line.className = "terminal-line";

    const prompt = document.createElement("span");
    prompt.className = "terminal-prompt";
    prompt.textContent = "LLLowy@wust:~$ ";

    const command = document.createElement("span");
    command.className = "terminal-command";
    command.textContent = initialText;

    line.append(prompt, command);
    dom.terminalOutput.appendChild(line);

    return command;
  }

  function appendTerminalOutput(text) {
    const line = document.createElement("div");
    line.className = "terminal-line";

    const output = document.createElement("span");
    output.className = "terminal-output";
    output.textContent = text;

    line.appendChild(output);
    dom.terminalOutput.appendChild(line);

    return output;
  }

  function appendTerminalCursor() {
    const cursor = document.createElement("span");
    cursor.className = "terminal-cursor";
    cursor.setAttribute("aria-hidden", "true");
    dom.terminalOutput.appendChild(cursor);
  }

  /**
   * 按时间累计字符。
   * 使用 requestAnimationFrame 可以让打字速度跟随浏览器刷新节拍，避免 setInterval 抖动。
   */
  function typeText(element, text, speed) {
    return new Promise((resolve) => {
      let index = 0;
      let lastTime = performance.now();
      let accumulatedTime = 0;

      const step = (now) => {
        const delta = Math.min(now - lastTime, 72);
        lastTime = now;
        accumulatedTime += delta;

        while (accumulatedTime >= speed && index < text.length) {
          element.textContent += text[index];
          index += 1;
          accumulatedTime -= speed;
        }

        if (index < text.length) {
          window.requestAnimationFrame(step);
        } else {
          resolve();
        }
      };

      window.requestAnimationFrame(step);
    });
  }

  function waitFrames(duration) {
    return new Promise((resolve) => {
      const start = performance.now();

      const step = (now) => {
        if (now - start >= duration) {
          resolve();
        } else {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    });
  }

  /* =========================================================
     7. 技能 Tab 切换
     功能：点击技能分类按钮时，只显示对应的技能面板。
     ========================================================= */
  function initSkillTabs() {
    const buttons = Array.from(document.querySelectorAll("[data-skill-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-skill-panel]"));

    const activate = (tabName, shouldFocus = false) => {
      buttons.forEach((button) => {
        const isActive = button.dataset.skillTab === tabName;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;

        if (isActive && shouldFocus) {
          button.focus();
        }
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.skillPanel === tabName;
        panel.classList.toggle("active", isActive);
        panel.setAttribute("aria-hidden", String(!isActive));
      });
    };

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => activate(button.dataset.skillTab));

      button.addEventListener("keydown", (event) => {
        const keyMap = {
          ArrowRight: (index + 1) % buttons.length,
          ArrowLeft: (index - 1 + buttons.length) % buttons.length,
          Home: 0,
          End: buttons.length - 1
        };

        if (!(event.key in keyMap)) {
          return;
        }

        event.preventDefault();
        const nextButton = buttons[keyMap[event.key]];
        activate(nextButton.dataset.skillTab, true);
      });
    });
  }

  /* =========================================================
     8. 学习目标折叠展开
     功能：点击标题时切换卡片状态，通过 max-height 实现高度过渡。
     ========================================================= */
  function initAccordions() {
    const items = Array.from(document.querySelectorAll("[data-accordion]"));

    items.forEach((item) => {
      const trigger = item.querySelector(".accordion-trigger");
      trigger.addEventListener("click", () => {
        if (item.classList.contains("open")) {
          closeAccordion(item);
        } else {
          openAccordion(item);
        }
      });
    });

    window.addEventListener("resize", () => {
      items.forEach((item) => {
        if (item.classList.contains("open")) {
          const content = item.querySelector(".accordion-content");
          content.style.maxHeight = `${content.scrollHeight}px`;
        }
      });
    });
  }

  function openAccordion(item) {
    const trigger = item.querySelector(".accordion-trigger");
    const content = item.querySelector(".accordion-content");

    item.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    content.setAttribute("aria-hidden", "false");
    content.style.maxHeight = `${content.scrollHeight}px`;
  }

  function closeAccordion(item) {
    const trigger = item.querySelector(".accordion-trigger");
    const content = item.querySelector(".accordion-content");

    item.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    content.setAttribute("aria-hidden", "true");

    // 先保留当前高度，下一帧再设为 0，确保浏览器能够播放收起动画。
    content.style.maxHeight = `${content.scrollHeight}px`;
    window.requestAnimationFrame(() => {
      content.style.maxHeight = "0px";
    });
  }

  /* =========================================================
     9. 技能进度条
     功能：技能条目进入视口后，设置 CSS 变量并播放数字增长。
     ========================================================= */
  function initSkillBars() {
    const skillItems = Array.from(document.querySelectorAll("[data-skill-item]"));

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      skillItems.forEach((item) => {
        setSkillLevel(item);
        const number = item.querySelector("[data-skill-number]");
        number.textContent = `${item.dataset.level}%`;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          setSkillLevel(entry.target);
          animateSkillNumber(entry.target);
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.45
      }
    );

    skillItems.forEach((item) => observer.observe(item));
  }

  function setSkillLevel(item) {
    const level = Number(item.dataset.level) || 0;
    item.style.setProperty("--skill-level", `${level}%`);
    item.classList.add("is-visible");
  }

  function animateSkillNumber(item) {
    const numberElement = item.querySelector("[data-skill-number]");
    const target = Number(item.dataset.level) || 0;
    const duration = 900;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      numberElement.textContent = `${Math.round(target * eased)}%`;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }

  /* =========================================================
     10. QQ 复制
     功能：复制 QQ 号，并显示 Toast。
     ========================================================= */
  function initCopyQQ() {
    dom.qqCard.addEventListener("click", async () => {
      const qqNumber = dom.qqCard.dataset.copy;

      try {
        await copyText(qqNumber);
        showToast("已复制 QQ 号，欢迎加好友");
      } catch (error) {
        showToast(`复制失败，请手动复制：${qqNumber}`);
      }
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("复制失败");
    }
  }

  let toastTimer = 0;

  function showToast(message) {
    dom.toastMessage.textContent = message;
    dom.toast.classList.add("show");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove("show");
    }, 2200);
  }

  /* =========================================================
     11. 回到顶部
     功能：点击悬浮按钮返回顶部，减少动态时直接跳转。
     ========================================================= */
  function initBackToTop() {
    dom.backToTop.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    });
  }

  /* =========================================================
     初始化
     先缓存元素，再逐项启动功能，便于按模块讲解代码。
     ========================================================= */
  function init() {
    cacheDom();
    initThemeToggle();
    initMobileNav();
    initScrollProgress();
    initNavHighlight();
    initRevealAnimations();
    initTerminalTyping();
    initSkillTabs();
    initAccordions();
    initSkillBars();
    initCopyQQ();
    initBackToTop();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
