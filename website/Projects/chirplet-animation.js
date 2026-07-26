/**
 * chirplet-animation.js
 *
 * Renders the chirplet decomposition animation from a precomputed JSON file
 * (chirplet_animation_data.json). Works with any number of chirplet orders.
 *
 * Requires Chart.js, loaded before this script:
 *   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
 */

(function () {
  "use strict";

  const JSON_PATH = "chirplet_animation.json";
  const STEP_INTERVAL_MS = 900;

  let DATA = null;
  let ORDER = 0;
  let currentStep = 0;
  let playing = false;
  let timer = null;
  let chartMain = null;
  let chartNorm = null;

  function showError(message) {
    const container = document.getElementById("chirplet-anim");
    if (!container) return;
    container.innerHTML =
      '<div class="anim-error"><i class="fas fa-triangle-exclamation"></i> ' +
      message +
      "</div>";
  }

  function initCharts() {
    const labels = Array.from({ length: DATA.epoch_length }, (_, i) => i);
    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const tickColor = isDark ? "#888" : "#aaa";

    if (chartMain) chartMain.destroy();
    if (chartNorm) chartNorm.destroy();

    chartMain = new Chart(document.getElementById("c-main"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Original",
            data: DATA.signal,
            borderColor: "#378ADD",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
          },
          {
            label: "Approx",
            data: new Array(DATA.epoch_length).fill(0),
            borderColor: "#1D9E75",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
          },
          {
            label: "Chirplet",
            data: new Array(DATA.epoch_length).fill(0),
            borderColor: "#c0a900",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
          },
          {
            label: "Residual",
            data: DATA.signal,
            borderColor: "#D85A30",
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
            borderDash: [4, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 5 },
          },
        },
      },
    });

    chartNorm = new Chart(document.getElementById("c-norm"), {
      type: "line",
      data: {
        labels: Array.from({ length: ORDER }, (_, i) => `C${i + 1}`),
        datasets: [
          {
            label: "Norm residue",
            data: new Array(ORDER).fill(null),
            borderColor: "#D85A30",
            backgroundColor: "rgba(216,90,48,0.08)",
            borderWidth: 2,
            pointRadius: 4,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 11 } },
          },
          y: {
            min: 0,
            max: 1.05,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (v) => (v * 100).toFixed(0) + "%",
            },
          },
        },
      },
    });
  }

  function updateDisplay(step) {
    if (!DATA) return;
    const s = DATA.steps[step];

    chartMain.data.datasets[1].data = s.approx;
    chartMain.data.datasets[2].data = s.atom;
    chartMain.data.datasets[3].data = s.residue;
    chartMain.update();

    const normData = Array.from({ length: ORDER }, (_, i) =>
      i <= step ? DATA.steps[i].norm_residue : null,
    );
    chartNorm.data.datasets[0].data = normData;
    chartNorm.update();

    const explained = ((1 - s.norm_residue) * 100).toFixed(1);
    document.getElementById("m-step").textContent = `${step + 1} / ${ORDER}`;
    document.getElementById("m-explained").textContent = `${explained}%`;
    document.getElementById("m-norm").textContent = s.norm_residue.toFixed(3);
    document.getElementById("prog").style.width =
      `${((step + 1) / ORDER) * 100}%`;
    document.getElementById("scrubber").value = step;
    document.getElementById("step-label").textContent =
      `Chirplet ${step + 1} of ${ORDER}`;
  }

  function togglePlay() {
    if (playing) {
      stopPlay();
      return;
    }
    playing = true;
    document.getElementById("btn-play").textContent = "⏸ Pause";
    if (currentStep >= ORDER - 1) currentStep = 0;
    tick();
  }

  function stopPlay() {
    playing = false;
    clearTimeout(timer);
    const btn = document.getElementById("btn-play");
    if (btn) btn.textContent = "▶ Play";
  }

  function tick() {
    if (!playing) return;
    updateDisplay(currentStep);
    if (currentStep < ORDER - 1) {
      currentStep++;
      timer = setTimeout(tick, STEP_INTERVAL_MS);
    } else {
      stopPlay();
    }
  }

  function scrub(step) {
    stopPlay();
    currentStep = step;
    updateDisplay(step);
  }

  function bindControls() {
    document.getElementById("btn-play").addEventListener("click", togglePlay);
    document.getElementById("scrubber").addEventListener("input", function () {
      scrub(parseInt(this.value));
    });
  }

  function hideLoading() {
    const loading = document.getElementById("anim-loading");
    if (loading) loading.style.display = "none";
    const body = document.getElementById("anim-body");
    if (body) body.style.display = "";
  }

  function boot(json) {
    DATA = json;
    if (DATA.snapshots && !DATA.steps) DATA.steps = DATA.snapshots;

    if (!DATA.steps || !DATA.steps.length) {
      showError("Animation data is empty or malformed.");
      return;
    }

    ORDER = DATA.steps.length;
    document.getElementById("scrubber").max = ORDER - 1;

    hideLoading();
    initCharts();
    bindControls();
    updateDisplay(0);
  }

  function init() {
    if (typeof Chart === "undefined") {
      showError(
        "Could not load the charting library. Please refresh the page.",
      );
      return;
    }
    fetch(JSON_PATH)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(boot)
      .catch((err) => {
        console.error("Could not load chirplet animation data:", err);
        showError(
          "Could not load the animation data. Please check back later.",
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
