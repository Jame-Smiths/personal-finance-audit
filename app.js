/* 财务体检信息采集表单逻辑 */
(function () {
  "use strict";

  const DRAFT_KEY = "audit-form-draft-v1";
  const TOTAL_STEPS = 5;
  let currentStep = 1;
  let assets = []; // 资产动态列表 [{id,name,type,value,cost,hold,note}]
  let assetSeq = 0;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------- 草稿（断点续填） ---------- */
  function saveDraft() {
    const data = {
      fields: collectNamedInputs(),
      chips: collectChips(),
      assets,
      step: currentStep,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      showDraftBadge();
    } catch (e) {
      /* 存储满等异常忽略 */
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      // 恢复普通输入
      if (data.fields) {
        Object.entries(data.fields).forEach(([name, val]) => {
          const el = document.querySelector(`[name="${name}"]`);
          if (el && el.type !== "checkbox") el.value = val;
        });
      }
      // 恢复胶囊选项
      if (data.chips) {
        Object.entries(data.chips).forEach(([name, val]) => setChip(name, val));
      }
      // 恢复资产
      if (Array.isArray(data.assets) && data.assets.length) {
        assets = data.assets;
        assetSeq = assets.length;
        renderAssets();
      }
      refreshConditionals();
      updateSummary();
      return data.step || 1;
    } catch (e) {
      return 1;
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    const badge = $("#draftBadge");
    if (badge) badge.hidden = true;
  }

  let badgeTimer = null;
  function showDraftBadge() {
    const badge = $("#draftBadge");
    if (!badge) return;
    badge.hidden = false;
    badge.textContent = "已自动保存";
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => (badge.hidden = true), 1500);
  }

  /* ---------- 表单数据收集 ---------- */
  function collectNamedInputs() {
    const out = {};
    $$("input[name], textarea[name]").forEach((el) => {
      out[el.name] = el.value;
    });
    return out;
  }

  function collectChips() {
    const out = {};
    $$(".chips").forEach((group) => {
      const on = group.querySelector(".chip.on");
      if (on) out[group.dataset.name] = on.dataset.value;
    });
    return out;
  }

  function setChip(name, value) {
    const group = document.querySelector(`.chips[data-name="${name}"]`);
    if (!group) return;
    group.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("on", c.dataset.value === value);
    });
  }

  function getChip(name) {
    const group = document.querySelector(`.chips[data-name="${name}"]`);
    if (!group) return "";
    const on = group.querySelector(".chip.on");
    return on ? on.dataset.value : "";
  }

  function toNum(v) {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function buildPayload() {
    const named = collectNamedInputs();
    const chips = collectChips();
    const client = {
      name: named.name || "",
      age: toNum(named.age),
      marital: chips.marital || "",
      childrenCount: toNum(named.childrenCount),
      childrenAges: named.childrenAges || "",
      hasInfant: chips.hasInfant || "",
      supportElders: chips.supportElders || "",
      housing: chips.housing || "",
      rentCity: named.rentCity || "",
      rentMonthly: toNum(named.rentMonthly),
      firstHomeLoan: chips.firstHomeLoan || "",
      salaryPreTax: toNum(named.salaryPreTax),
      socialBase: toNum(named.socialBase),
      fundBase: toNum(named.fundBase),
      yearEndBonus: toNum(named.yearEndBonus),
      commissionRule: named.commissionRule || "",
      commissionPayer: chips.commissionPayer || "",
      commissionCycle: chips.commissionCycle || "",
      commissionMonthly: toNum(named.commissionMonthly),
      otherIncome: named.otherIncome || "",
      deductions: chips.deductions || "",
      bonusTaxMethod: chips.bonusTaxMethod || "",
      netMonthly: toNum(named.netMonthly),
      expHousing: toNum(named.expHousing),
      expFood: toNum(named.expFood),
      expTransport: toNum(named.expTransport),
      expEducation: toNum(named.expEducation),
      expSupport: toNum(named.expSupport),
      expInsurance: toNum(named.expInsurance),
      expOther: toNum(named.expOther),
      loanMortgage: toNum(named.loanMortgage),
      loanCar: toNum(named.loanCar),
      loanConsumer: toNum(named.loanConsumer),
      loanCreditCard: toNum(named.loanCreditCard),
      otherDebt: named.otherDebt || "",
      note: named.note || "",
    };
    const assetList = assets
      .filter((a) => a.name && a.name.trim())
      .map((a) => ({
        name: a.name,
        type: a.type || "其他",
        value: toNum(a.value),
        cost: toNum(a.cost),
        hold: a.hold || "",
        note: a.note || "",
      }));
    return { client, assets: assetList };
  }

  /* ---------- 汇总与三张表初稿 ---------- */
  function computeSummary() {
    const p = buildPayload();
    const c = p.client;
    const assetTotal = p.assets.reduce((s, a) => s + (a.value || 0), 0);
    const debtTotal =
      (c.loanMortgage || 0) + (c.loanCar || 0) + (c.loanConsumer || 0) + (c.loanCreditCard || 0);
    const expTotal =
      (c.expHousing || 0) + (c.expFood || 0) + (c.expTransport || 0) +
      (c.expEducation || 0) + (c.expSupport || 0) + (c.expInsurance || 0) + (c.expOther || 0);
    const incTotal = (c.netMonthly || 0) + (c.commissionMonthly || 0);
    return {
      name: c.name,
      assetTotal,
      debtTotal,
      netWorth: assetTotal - debtTotal,
      expTotal,
      incTotal,
      surplus: incTotal - expTotal,
      assetCount: p.assets.length,
    };
  }

  const fmt = (n) =>
    (n === null || n === undefined || Number.isNaN(n) ? 0 : n).toLocaleString("zh-CN");

  function renderSummary(targetSel) {
    const s = computeSummary();
    const el = $(targetSel);
    if (!el) return;
    el.innerHTML = `
      <div class="sum-group">一、资产负债表（截至今天）</div>
      <div class="sum-item"><span>资产合计（${s.assetCount} 项）</span><b>${fmt(s.assetTotal)} 元</b></div>
      <div class="sum-item"><span>负债合计</span><b>${fmt(s.debtTotal)} 元</b></div>
      <div class="sum-item"><span>净资产</span><b class="sum-total">${fmt(s.netWorth)} 元</b></div>
      <div class="sum-group">二、收支结余表（平均每月）</div>
      <div class="sum-item"><span>月收入（到手工资＋提成）</span><b>${fmt(s.incTotal)} 元</b></div>
      <div class="sum-item"><span>月支出合计</span><b>${fmt(s.expTotal)} 元</b></div>
      <div class="sum-item"><span>月结余</span><b class="sum-total">${fmt(s.surplus)} 元</b></div>
      <div class="sum-group">三、现金流量表（月净现金流）</div>
      <div class="sum-item"><span>每月净现金流入（约等于月结余）</span><b>${fmt(s.surplus)} 元</b></div>
      <div class="sum-item"><span>提示</span><b style="font-weight:400;font-size:13px;color:#646a73">大额一次性收支请写在"补充说明"里</b></div>
    `;
  }

  function updateSummary() {
    renderSummary("#summaryCards");
    renderSummary("#successSummary");
  }

  /* ---------- 资产动态列表 ---------- */
  const ASSET_TYPES = [
    "银行存款", "现金", "货币基金", "银行理财", "股票", "基金", "房产",
    "车辆", "公司股权", "保险现金价值", "公积金账户", "借出款项", "其他",
  ];
  const HOLD_WAYS = ["个人名下", "配偶名下", "夫妻共同", "公司名下", "其他"];

  function assetTemplate(a) {
    return `
      <div class="asset-item" data-aid="${a.id}">
        <div class="asset-head">
          <span class="asset-index">资产 ${a.idx}</span>
          <button type="button" class="asset-del" data-del="${a.id}">删除</button>
        </div>
        <label class="field">
          <span class="f-label">这是什么？<span class="f-hint">例如：杭州的房子、工行存款、XX股票</span></span>
          <input type="text" data-af="name" maxlength="50" value="${escapeHtml(a.name || "")}" placeholder="例如：工行存款">
        </label>
        <div class="field">
          <span class="f-label">类型</span>
          <select data-af="type">
            ${ASSET_TYPES.map((t) => `<option value="${t}" ${a.type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="grid2">
          <label class="field">
            <span class="f-label">现在大概值多少（元）</span>
            <input type="number" data-af="value" min="0" inputmode="decimal" value="${a.value || ""}" placeholder="0">
          </label>
          <label class="field">
            <span class="f-label">当初花了多少（元）<span class="f-hint">选填</span></span>
            <input type="number" data-af="cost" min="0" inputmode="decimal" value="${a.cost || ""}" placeholder="选填">
          </label>
        </div>
        <div class="field">
          <span class="f-label">在谁名下？</span>
          <select data-af="hold">
            ${HOLD_WAYS.map((h) => `<option value="${h}" ${a.hold === h ? "selected" : ""}>${h}</option>`).join("")}
          </select>
        </div>
        <label class="field">
          <span class="f-label">备注<span class="f-hint">选填</span></span>
          <input type="text" data-af="note" maxlength="100" value="${escapeHtml(a.note || "")}" placeholder="选填">
        </label>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderAssets() {
    const box = $("#assetItems");
    if (!box) return;
    box.innerHTML = assets.map((a) => assetTemplate(a)).join("");
    $("#assetCount").textContent = assets.length;
  }

  function syncAssetFromDom() {
    $$(".asset-item").forEach((item) => {
      const aid = Number(item.dataset.aid);
      const a = assets.find((x) => x.id === aid);
      if (!a) return;
      item.querySelectorAll("[data-af]").forEach((el) => {
        a[el.dataset.af] = el.value;
      });
    });
    updateSummary();
    saveDraft();
  }

  /* ---------- 步骤切换 ---------- */
  function showStep(n) {
    currentStep = n;
    $$(".step").forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    $$(".p-step").forEach((s) => {
      const sn = Number(s.dataset.step);
      s.classList.toggle("active", sn === n);
      s.classList.toggle("done", sn < n);
    });
    $("#progressFill").style.width = `${(n / TOTAL_STEPS) * 100}%`;
    $("#btnPrev").hidden = n === 1;
    const nextBtn = $("#btnNext");
    if (n === TOTAL_STEPS) {
      $("#navBtns").hidden = true;
    } else {
      $("#navBtns").hidden = false;
      nextBtn.textContent = "下一步";
    }
    window.scrollTo({ top: 0 });
    saveDraft();
  }

  /* ---------- 条件显示 ---------- */
  function refreshConditionals() {
    const kids = Number($("#fKids") ? $("#fKids").value : 0) || 0;
    $("#kidsAgesWrap").hidden = kids <= 0;

    const housing = getChip("housing");
    $("#rentWrap").hidden = housing !== "租房";
    $("#loanWrap").hidden = housing !== "自有住房·有房贷";

    $("#commissionWrap").hidden = getChip("hasCommission") !== "有";
  }

  /* ---------- 校验 ---------- */
  function validateStep(n) {
    if (n === 1) {
      const name = $("#fName").value.trim();
      if (!name) {
        alert("请先填写「怎么称呼您」");
        $("#fName").focus();
        return false;
      }
    }
    if (n === 2) {
      const salary = $("#fSalary").value;
      if (!salary || Number(salary) <= 0) {
        alert("请填写「每月税前工资」");
        $("#fSalary").focus();
        return false;
      }
    }
    return true;
  }

  /* ---------- 提交 ---------- */
  async function doSubmit() {
    const payload = buildPayload();
    if (!payload.client.name.trim()) {
      showStep(1);
      return;
    }
    const btn = $("#btnSubmit");
    const err = $("#submitError");
    btn.disabled = true;
    btn.textContent = "正在提交…";
    err.hidden = true;
    try {
      const cfg = window.APP_CONFIG || {};
      const res = await fetch(cfg.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-form-token": cfg.FORM_TOKEN || "",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `提交失败（${res.status}）`;
        try {
          const j = await res.json();
          if (j && j.error && j.error.message) msg = j.error.message;
        } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      // 成功：清草稿、展示成功页
      clearDraft();
      renderSummary("#successSummary");
      $(".page").hidden = true;
      $("#successPage").hidden = false;
      window.scrollTo({ top: 0 });
    } catch (e) {
      err.textContent = e.message || "网络异常，请检查网络后重试";
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "重新提交";
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 胶囊选择
    $$(".chips").forEach((group) => {
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        const isOn = chip.classList.contains("on");
        group.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
        if (!isOn) chip.classList.add("on");
        refreshConditionals();
        saveDraft();
      });
    });

    // 输入即保存
    document.addEventListener("input", (e) => {
      if (e.target.matches("input, textarea")) {
        refreshConditionals();
        saveDraft();
      }
    });
    document.addEventListener("change", (e) => {
      if (e.target.matches("input, textarea")) {
        refreshConditionals();
        updateSummary();
        saveDraft();
      }
    });

    // 资产列表
    $("#btnAddAsset").addEventListener("click", () => {
      assetSeq += 1;
      assets.push({ id: assetSeq, idx: assetSeq, name: "", type: "银行存款", value: "", cost: "", hold: "个人名下", note: "" });
      renderAssets();
      syncAssetFromDom();
    });
    $("#assetItems").addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]");
      if (!del) return;
      const aid = Number(del.dataset.del);
      assets = assets.filter((a) => a.id !== aid);
      assets.forEach((a, i) => (a.idx = i + 1));
      renderAssets();
      saveDraft();
      updateSummary();
    });
    $("#assetItems").addEventListener("input", syncAssetFromDom);
    $("#assetItems").addEventListener("change", syncAssetFromDom);

    // 导航
    $("#btnNext").addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      showStep(currentStep + 1);
      if (currentStep === TOTAL_STEPS) updateSummary();
    });
    $("#btnPrev").addEventListener("click", () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });

    // 提交
    $("#mainForm").addEventListener("submit", (e) => {
      e.preventDefault();
      doSubmit();
    });

    // 重新提交（回到表单并恢复草稿）
    $("#btnAgain").addEventListener("click", () => {
      const data = buildPayload();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields: {}, chips: {}, assets, step: TOTAL_STEPS }));
      } catch (e) { /* ignore */ }
      $("#successPage").hidden = true;
      $(".page").hidden = false;
      showStep(5);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    const restored = loadDraft();
    bindEvents();
    refreshConditionals();
    updateSummary();
    if (restored && restored > 1) {
      // 提示有草稿，但默认从第 1 步开始，让客户自己点下一步即可
    }
    showStep(1);
  }

  init();
})();
