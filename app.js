"use strict";

const STORAGE_KEY = "freshMarketPosDataV1";
const RECOVERY_STORAGE_KEY = "freshMarketPosRecoveryV1";
const DRAFT_STORAGE_KEY = "freshMarketPosDraftV1";
const APP_VERSION = 1;

let state;
let cart = [];
let reportSales = [];
let currentInvoice = null;
let toastTimer = null;
let activeTab = "items";

const $ = (id) => document.getElementById(id);

function createDefaultState() {
  return {
    version: APP_VERSION,
    settings: {
      shopName: "Fresh Market",
      shopPhone: "",
      shopAddress: "",
      defaultCurrency: "BOTH",
      exchangeRate: 89500,
      thankYouMessage: "Thank you for shopping with us!",
      nextInvoiceNumber: 1
    },
    items: [
      {
        id: "item-apple",
        name: "Apple",
        category: "Fruit",
        unit: "kg",
        price: 2.25,
        currency: "USD",
        costPrice: null,
        stockQuantity: 30,
        lowStockThreshold: 5,
        barcode: "100001",
        active: true
      },
      {
        id: "item-banana",
        name: "Banana",
        category: "Fruit",
        unit: "kg",
        price: 1.5,
        currency: "USD",
        costPrice: null,
        stockQuantity: 25,
        lowStockThreshold: 5,
        barcode: "100002",
        active: true
      },
      {
        id: "item-tomato",
        name: "Tomato",
        category: "Vegetable",
        unit: "kg",
        price: 90000,
        currency: "LBP",
        costPrice: null,
        stockQuantity: 20,
        lowStockThreshold: 5,
        barcode: "200001",
        active: true
      },
      {
        id: "item-potato",
        name: "Potato",
        category: "Vegetable",
        unit: "kg",
        price: 65000,
        currency: "LBP",
        costPrice: null,
        stockQuantity: 40,
        lowStockThreshold: 5,
        barcode: "200002",
        active: true
      },
      {
        id: "item-cucumber",
        name: "Cucumber",
        category: "Vegetable",
        unit: "kg",
        price: 75000,
        currency: "LBP",
        costPrice: null,
        stockQuantity: 18,
        lowStockThreshold: 5,
        barcode: "200003",
        active: true
      },
      {
        id: "item-orange",
        name: "Orange",
        category: "Fruit",
        unit: "kg",
        price: 2,
        currency: "USD",
        costPrice: null,
        stockQuantity: 22,
        lowStockThreshold: 5,
        barcode: "100003",
        active: true
      }
    ],
    sales: []
  };
}

function loadData() {
  let saved = null;
  let recovery = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
    recovery = localStorage.getItem(RECOVERY_STORAGE_KEY);
  } catch (error) {
    console.error("Unable to access local POS storage:", error);
  }

  const mainData = parseStoredState(saved);
  if (mainData) {
    state = normalizeState(mainData);
    return;
  }

  const recoveryData = parseStoredState(recovery);
  if (recoveryData) {
    state = normalizeState(recoveryData);
    saveData();
    showToast("Local recovery copy restored.");
    return;
  }

  state = createDefaultState();
  saveData();
  if (saved || recovery) showToast("Saved data was invalid. Default data was loaded.", true);
}

function parseStoredState(value) {
  if (!value) return null;
  try {
    const data = JSON.parse(value);
    return data
      && typeof data.settings === "object"
      && Array.isArray(data.items)
      && Array.isArray(data.sales)
      ? data
      : null;
  } catch (error) {
    console.error("Unable to parse saved POS data:", error);
    return null;
  }
}

function normalizeState(data) {
  const defaults = createDefaultState();
  const normalized = {
    version: APP_VERSION,
    settings: Object.assign({}, defaults.settings, data && data.settings ? data.settings : {}),
    items: Array.isArray(data && data.items) ? data.items.map(normalizeItem) : defaults.items,
    sales: Array.isArray(data && data.sales) ? data.sales : []
  };

  normalized.settings.exchangeRate = positiveNumber(normalized.settings.exchangeRate, 89500);
  normalized.settings.defaultCurrency = ["USD", "LBP", "BOTH"].includes(normalized.settings.defaultCurrency)
    ? normalized.settings.defaultCurrency
    : "BOTH";
  normalized.settings.nextInvoiceNumber = Math.max(
    1,
    Math.floor(positiveNumber(normalized.settings.nextInvoiceNumber, normalized.sales.length + 1))
  );
  normalized.settings.shopName = String(normalized.settings.shopName || "Fresh Market");
  normalized.settings.shopPhone = String(normalized.settings.shopPhone || "");
  normalized.settings.shopAddress = String(normalized.settings.shopAddress || "");
  normalized.settings.thankYouMessage = String(
    normalized.settings.thankYouMessage || "Thank you for shopping with us!"
  );

  return normalized;
}

function normalizeItem(item) {
  item = item && typeof item === "object" ? item : {};
  const stock = item.stockQuantity === null || item.stockQuantity === "" || item.stockQuantity === undefined
    ? null
    : nonNegativeNumber(item.stockQuantity, null);

  return {
    id: String(item.id || makeId("item")),
    name: String(item.name || "Unnamed Item"),
    category: ["Fruit", "Vegetable", "Other"].includes(item.category) ? item.category : "Other",
    unit: ["kg", "piece", "box"].includes(item.unit) ? item.unit : "kg",
    price: nonNegativeNumber(item.price, 0),
    currency: item.currency === "LBP" ? "LBP" : "USD",
    costPrice: item.costPrice === null || item.costPrice === "" || item.costPrice === undefined
      ? null
      : nonNegativeNumber(item.costPrice, null),
    stockQuantity: stock,
    lowStockThreshold: nonNegativeNumber(item.lowStockThreshold, 5),
    barcode: String(item.barcode || ""),
    active: item.active !== false
  };
}

function saveData() {
  try {
    state.lastSavedAt = new Date().toISOString();
    const savedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, savedState);
    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, savedState);
    } catch (recoveryError) {
      console.error("Unable to update local recovery copy:", recoveryError);
    }
    return true;
  } catch (error) {
    console.error("Unable to save POS data:", error);
    showToast("Could not save data. Check available browser storage.", true);
    return false;
  }
}

function loadDraftState() {
  let savedDraft = null;
  try {
    savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.error("Unable to read saved checkout draft:", error);
  }

  if (!savedDraft) return "items";

  try {
    const draft = JSON.parse(savedDraft);
    const savedCart = Array.isArray(draft.cart) ? draft.cart : [];

    cart = savedCart.reduce((lines, entry) => {
      const item = state.items.find((product) => product.id === entry.itemId && product.active);
      let quantity = nonNegativeNumber(entry.quantity, 0);
      if (!item || quantity <= 0) return lines;
      if (item.stockQuantity !== null) quantity = Math.min(quantity, item.stockQuantity);
      if (quantity > 0) lines.push({ itemId: item.id, quantity: round(quantity, 3) });
      return lines;
    }, []);

    $("discountType").value = ["none", "fixed", "percent"].includes(draft.discountType)
      ? draft.discountType
      : "none";
    $("discountValue").value = String(nonNegativeNumber(draft.discountValue, 0));
    $("paymentCurrency").value = draft.paymentCurrency === "LBP" ? "LBP" : "USD";
    $("cashReceived").value = draft.cashReceived === undefined
      || draft.cashReceived === null
      || draft.cashReceived === ""
      ? ""
      : String(nonNegativeNumber(draft.cashReceived, ""));

    return ["items", "sales", "reports", "settings"].includes(draft.activeTab)
      ? draft.activeTab
      : "items";
  } catch (error) {
    console.error("Unable to restore saved checkout draft:", error);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (removeError) {
      console.error("Unable to clear invalid checkout draft:", removeError);
    }
    return "items";
  }
}

function saveDraftState() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      cart,
      discountType: $("discountType") ? $("discountType").value : "none",
      discountValue: $("discountValue") ? nonNegativeNumber($("discountValue").value, 0) : 0,
      paymentCurrency: $("paymentCurrency") ? $("paymentCurrency").value : "USD",
      cashReceived: $("cashReceived") ? $("cashReceived").value : "",
      activeTab,
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch (error) {
    console.error("Unable to save checkout draft:", error);
    return false;
  }
}

function requestPersistentStorage() {
  if (!navigator.storage || typeof navigator.storage.persist !== "function") return;
  navigator.storage.persist().catch(() => {
    // LocalStorage still works when persistent storage permission is unavailable.
  });
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatUSD(value) {
  const number = Number(value) || 0;
  return `$${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatLBP(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("en-US")} LBP`;
}

function formatQuantity(value) {
  return (Number(value) || 0).toLocaleString("en-US", {
    maximumFractionDigits: 3
  });
}

function formatNative(value, currency) {
  return currency === "LBP" ? formatLBP(value) : formatUSD(value);
}

function formatBoth(usd, lbp) {
  return `${formatUSD(usd)} / ${formatLBP(lbp)}`;
}

function formatMixed(usd, lbp) {
  return `${formatUSD(usd)} + ${formatLBP(lbp)}`;
}

function getMixedChange(changeUSD, changeLBP, rate) {
  const usd = Math.floor((Number(changeUSD) || 0) + 0.000001);
  return {
    usd,
    lbp: Math.max(0, Math.round((Number(changeLBP) || 0) - usd * rate))
  };
}

function formatByDisplay(usd, lbp, displayCurrency) {
  if (displayCurrency === "USD") return formatUSD(usd);
  if (displayCurrency === "LBP") return formatLBP(lbp);
  return formatBoth(usd, lbp);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function localDateString(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getItemPrices(item, rate) {
  if (item.currency === "LBP") {
    return {
      usd: item.price / rate,
      lbp: item.price
    };
  }

  return {
    usd: item.price,
    lbp: item.price * rate
  };
}

function isLowStock(item) {
  return item.stockQuantity !== null && item.stockQuantity <= item.lowStockThreshold;
}

function showToast(message, isError) {
  const toast = $("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}Tab`);
  });

  if (tabName === "sales") {
    setTimeout(() => $("posSearch").focus(), 0);
  } else if (tabName === "reports") {
    renderReports();
  }
  saveDraftState();
}

function renderHeader() {
  const lowStockCount = state.items.filter(isLowStock).length;
  $("connectionStatus").textContent = navigator.onLine ? "Offline ready • Saved locally" : "Offline • Saved locally";
  $("headerShopName").textContent = state.settings.shopName;
  $("headerRate").textContent = `1 USD = ${formatLBP(state.settings.exchangeRate)}`;
  $("headerLowStock").textContent = `${lowStockCount} low stock`;
  $("salesRateNote").textContent = `Prices use 1 USD = ${formatLBP(state.settings.exchangeRate)}.`;

  const alert = $("lowStockAlert");
  if (lowStockCount > 0) {
    const names = state.items.filter(isLowStock).map((item) => item.name).slice(0, 6);
    alert.textContent = `Low stock alert: ${names.join(", ")}${lowStockCount > 6 ? ` and ${lowStockCount - 6} more` : ""}.`;
    alert.classList.remove("hidden");
  } else {
    alert.classList.add("hidden");
  }
}

function getFilteredItems() {
  const query = $("itemSearch").value.trim().toLowerCase();
  const category = $("itemCategoryFilter").value;
  const status = $("itemStatusFilter").value;

  return state.items.filter((item) => {
    const matchesQuery = !query
      || item.name.toLowerCase().includes(query)
      || item.barcode.toLowerCase().includes(query);
    const matchesCategory = category === "all" || item.category === category;
    const matchesStatus = status === "all"
      || (status === "active" && item.active)
      || (status === "inactive" && !item.active)
      || (status === "low" && isLowStock(item));
    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function renderItems() {
  const items = getFilteredItems();
  const body = $("itemsTableBody");

  body.innerHTML = items.map((item) => {
    const prices = getItemPrices(item, state.settings.exchangeRate);
    let statusBadge = item.active
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';
    if (isLowStock(item)) {
      statusBadge += ' <span class="badge badge-low">Low stock</span>';
    }

    const stockText = item.stockQuantity === null
      ? '<span class="subtext">Not tracked</span>'
      : `${formatQuantity(item.stockQuantity)} ${escapeHTML(item.unit)}`;

    return `
      <tr>
        <td>
          <span class="item-name">${escapeHTML(item.name)}</span>
          ${item.barcode ? `<span class="subtext">Barcode: ${escapeHTML(item.barcode)}</span>` : ""}
        </td>
        <td>${escapeHTML(item.category)}</td>
        <td>${escapeHTML(item.unit)}</td>
        <td>${formatNative(item.price, item.currency)}</td>
        <td>${formatUSD(prices.usd)}</td>
        <td>${formatLBP(prices.lbp)}</td>
        <td>${stockText}</td>
        <td>${statusBadge}</td>
        <td class="actions-col">
          <div class="row-actions">
            <button class="btn btn-secondary btn-small" type="button" data-item-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
            <button class="btn btn-danger-outline btn-small" type="button" data-item-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  $("itemsEmpty").classList.toggle("hidden", items.length > 0);
  document.querySelector("#itemsTab .table-wrap").classList.toggle("hidden", items.length === 0);
}

function openItemModal(itemId) {
  const item = itemId ? state.items.find((entry) => entry.id === itemId) : null;
  $("itemForm").reset();
  $("itemId").value = item ? item.id : "";
  $("itemModalTitle").textContent = item ? "Edit Item" : "Add Item";
  $("itemName").value = item ? item.name : "";
  $("itemCategory").value = item ? item.category : "Fruit";
  $("itemUnit").value = item ? item.unit : "kg";
  $("itemPrice").value = item ? item.price : "";
  $("itemCurrency").value = item ? item.currency : "USD";
  $("itemCostPrice").value = item && item.costPrice !== null ? item.costPrice : "";
  $("itemStock").value = item && item.stockQuantity !== null ? item.stockQuantity : "";
  $("itemLowStock").value = item ? item.lowStockThreshold : 5;
  $("itemBarcode").value = item ? item.barcode : "";
  $("itemActive").checked = item ? item.active : true;
  updateItemPricePreview();
  openModal("itemModal");
  setTimeout(() => $("itemName").focus(), 0);
}

function updateItemPricePreview() {
  const price = nonNegativeNumber($("itemPrice").value, 0);
  const currency = $("itemCurrency").value;
  const prices = getItemPrices({ price, currency }, state.settings.exchangeRate);
  $("itemPricePreview").textContent = `Current equivalent: ${formatBoth(prices.usd, prices.lbp)}`;
}

function addItem(event) {
  event.preventDefault();

  const existingId = $("itemId").value;
  const name = $("itemName").value.trim();
  const barcode = $("itemBarcode").value.trim();
  const duplicateBarcode = barcode && state.items.some((item) => item.barcode === barcode && item.id !== existingId);

  if (!name) {
    showToast("Item name is required.", true);
    $("itemName").focus();
    return;
  }

  if (duplicateBarcode) {
    showToast("This barcode is already used by another item.", true);
    $("itemBarcode").focus();
    return;
  }

  const item = normalizeItem({
    id: existingId || makeId("item"),
    name,
    category: $("itemCategory").value,
    unit: $("itemUnit").value,
    price: $("itemPrice").value,
    currency: $("itemCurrency").value,
    costPrice: $("itemCostPrice").value === "" ? null : $("itemCostPrice").value,
    stockQuantity: $("itemStock").value === "" ? null : $("itemStock").value,
    lowStockThreshold: $("itemLowStock").value === "" ? 5 : $("itemLowStock").value,
    barcode,
    active: $("itemActive").checked
  });

  if (existingId) {
    const index = state.items.findIndex((entry) => entry.id === existingId);
    if (index >= 0) state.items[index] = item;
  } else {
    state.items.push(item);
  }

  saveData();
  closeModal("itemModal");
  renderAll();
  showToast(existingId ? "Item updated." : "Item added.");
}

function editItem(itemId) {
  openItemModal(itemId);
}

function deleteItem(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  if (!window.confirm(`Delete "${item.name}"? Saved sales will not be changed.`)) return;

  state.items = state.items.filter((entry) => entry.id !== itemId);
  cart = cart.filter((entry) => entry.itemId !== itemId);
  saveData();
  renderAll();
  showToast("Item deleted.");
}

function getFilteredProducts() {
  const query = $("posSearch").value.trim().toLowerCase();
  const category = $("posCategoryFilter").value;

  return state.items.filter((item) => {
    const matchesQuery = !query
      || item.name.toLowerCase().includes(query)
      || item.barcode.toLowerCase().includes(query);
    const matchesCategory = category === "all" || item.category === category;
    return item.active && matchesQuery && matchesCategory;
  });
}

function renderProducts() {
  const products = getFilteredProducts();
  const grid = $("productGrid");

  grid.innerHTML = products.map((item) => {
    const prices = getItemPrices(item, state.settings.exchangeRate);
    const outOfStock = item.stockQuantity !== null && item.stockQuantity <= 0;
    const stockText = item.stockQuantity === null
      ? "Stock not tracked"
      : `${formatQuantity(item.stockQuantity)} ${escapeHTML(item.unit)} in stock`;

    return `
      <button class="product-btn" type="button" data-product-id="${escapeHTML(item.id)}" ${outOfStock ? "disabled" : ""}>
        <span class="product-category">${escapeHTML(item.category)}</span>
        <span class="product-name">${escapeHTML(item.name)}</span>
        <span class="product-price">${formatByDisplay(prices.usd, prices.lbp, state.settings.defaultCurrency)}</span>
        <span class="product-stock">${outOfStock ? "Out of stock" : stockText}</span>
      </button>
    `;
  }).join("");

  $("productsEmpty").classList.toggle("hidden", products.length > 0);
  grid.classList.toggle("hidden", products.length === 0);
}

function addToCart(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || !item.active) {
    showToast("This item is not available.", true);
    return;
  }

  const existing = cart.find((entry) => entry.itemId === itemId);
  const newQuantity = existing ? existing.quantity + 1 : 1;

  if (item.stockQuantity !== null && newQuantity > item.stockQuantity) {
    showToast(`Only ${formatQuantity(item.stockQuantity)} ${item.unit} of ${item.name} is in stock.`, true);
    return;
  }

  if (existing) {
    existing.quantity = round(newQuantity, 3);
  } else {
    cart.push({ itemId, quantity: 1 });
  }

  renderCart();
}

function updateCart(itemId, quantity) {
  const entry = cart.find((line) => line.itemId === itemId);
  const item = state.items.find((product) => product.id === itemId);
  if (!entry || !item) return;

  const parsedQuantity = nonNegativeNumber(quantity, 0);
  if (parsedQuantity <= 0) {
    cart = cart.filter((line) => line.itemId !== itemId);
  } else if (item.stockQuantity !== null && parsedQuantity > item.stockQuantity) {
    entry.quantity = item.stockQuantity;
    showToast(`Quantity limited to available stock: ${formatQuantity(item.stockQuantity)} ${item.unit}.`, true);
  } else {
    entry.quantity = round(parsedQuantity, 3);
  }

  renderCart();
}

function removeFromCart(itemId) {
  cart = cart.filter((entry) => entry.itemId !== itemId);
  renderCart();
}

function getCartTotals() {
  const rate = state.settings.exchangeRate;
  let subtotalUSD = 0;

  cart.forEach((entry) => {
    const item = state.items.find((product) => product.id === entry.itemId);
    if (!item) return;
    subtotalUSD += getItemPrices(item, rate).usd * entry.quantity;
  });

  const subtotalLBP = subtotalUSD * rate;
  const discountType = $("discountType").value;
  const rawDiscount = nonNegativeNumber($("discountValue").value, 0);
  const paymentCurrency = $("paymentCurrency").value;
  let discountUSD = 0;

  if (discountType === "percent") {
    discountUSD = subtotalUSD * Math.min(rawDiscount, 100) / 100;
  } else if (discountType === "fixed") {
    discountUSD = paymentCurrency === "LBP" ? rawDiscount / rate : rawDiscount;
  }

  discountUSD = Math.min(discountUSD, subtotalUSD);
  const discountLBP = discountUSD * rate;
  const finalUSD = Math.max(0, subtotalUSD - discountUSD);
  const finalLBP = finalUSD * rate;

  return {
    subtotalUSD,
    subtotalLBP,
    discountUSD,
    discountLBP,
    finalUSD,
    finalLBP,
    discountType,
    discountValue: rawDiscount,
    paymentCurrency
  };
}

function getCashPayment(totals) {
  const rate = state.settings.exchangeRate;
  const currency = totals.paymentCurrency;
  const input = $("cashReceived");
  const rawValue = input ? input.value.trim() : "";
  const numericValue = Number(rawValue);
  const hasReceived = rawValue !== "" && Number.isFinite(numericValue) && numericValue >= 0;
  const cashReceived = hasReceived
    ? (currency === "LBP" ? Math.round(numericValue) : round(numericValue, 2))
    : 0;
  const amountDue = currency === "LBP" ? Math.round(totals.finalLBP) : round(totals.finalUSD, 2);
  const difference = cashReceived - amountDue;
  const isSufficient = amountDue <= 0 || (hasReceived && difference >= -0.000001);
  const change = isSufficient ? Math.max(0, difference) : 0;
  const shortfall = isSufficient ? 0 : Math.max(0, -difference);
  const changeUSD = currency === "LBP" ? change / rate : change;
  const changeLBP = currency === "LBP" ? change : change * rate;
  const mixedChange = getMixedChange(changeUSD, changeLBP, rate);

  return {
    currency,
    hasReceived,
    cashReceived,
    cashReceivedUSD: currency === "LBP" ? cashReceived / rate : cashReceived,
    cashReceivedLBP: currency === "LBP" ? cashReceived : cashReceived * rate,
    amountDue,
    isSufficient,
    change,
    changeUSD,
    changeLBP,
    mixedChangeUSD: mixedChange.usd,
    mixedChangeLBP: mixedChange.lbp,
    shortfall,
    shortfallUSD: currency === "LBP" ? shortfall / rate : shortfall,
    shortfallLBP: currency === "LBP" ? shortfall : shortfall * rate
  };
}

function renderCart() {
  cart = cart.filter((entry) => state.items.some((item) => item.id === entry.itemId));
  const body = $("cartTableBody");
  const rate = state.settings.exchangeRate;

  body.innerHTML = cart.map((entry) => {
    const item = state.items.find((product) => product.id === entry.itemId);
    const prices = getItemPrices(item, rate);
    const totalUSD = prices.usd * entry.quantity;
    const totalLBP = totalUSD * rate;

    return `
      <tr>
        <td>
          <span class="item-name">${escapeHTML(item.name)}</span>
          <span class="subtext">${formatNative(item.price, item.currency)} / ${escapeHTML(item.unit)}</span>
        </td>
        <td>
          <input class="qty-input" type="number" min="0.001" step="0.001" value="${entry.quantity}" data-cart-qty="${escapeHTML(item.id)}" aria-label="Quantity for ${escapeHTML(item.name)}">
        </td>
        <td>
          <strong>${formatByDisplay(totalUSD, totalLBP, state.settings.defaultCurrency)}</strong>
        </td>
        <td>
          <button class="remove-cart-btn" type="button" data-cart-remove="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.name)}">&times;</button>
        </td>
      </tr>
    `;
  }).join("");

  const quantityCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const totals = getCartTotals();
  const paymentCurrency = $("paymentCurrency").value;
  const cashPayment = getCashPayment(totals);

  $("cartEmpty").classList.toggle("hidden", cart.length > 0);
  $("cartCount").textContent = `${formatQuantity(quantityCount)} item${quantityCount === 1 ? "" : "s"}`;
  $("cartSubtotal").textContent = formatBoth(totals.subtotalUSD, totals.subtotalLBP);
  $("cartDiscount").textContent = formatBoth(totals.discountUSD, totals.discountLBP);
  $("cartTotal").textContent = formatBoth(totals.finalUSD, totals.finalLBP);
  $("amountDueLabel").textContent = `Amount due (${paymentCurrency})`;
  $("amountDue").textContent = formatNative(cashPayment.amountDue, paymentCurrency);
  $("cashReceivedLabel").textContent = `Cash received (${paymentCurrency})`;
  $("cashReceivedDisplay").textContent = cashPayment.hasReceived
    ? formatNative(cashPayment.cashReceived, paymentCurrency)
    : "Not entered";
  $("changeDue").textContent = formatBoth(cashPayment.changeUSD, cashPayment.changeLBP);
  $("mixedChangeDue").textContent = formatMixed(cashPayment.mixedChangeUSD, cashPayment.mixedChangeLBP);

  const paymentStatus = $("cashPaymentStatus");
  paymentStatus.classList.remove("ready", "shortfall");
  if (cart.length === 0) {
    paymentStatus.textContent = "Add items to begin a cash sale.";
  } else if (cashPayment.amountDue <= 0) {
    paymentStatus.textContent = "No payment is required.";
    paymentStatus.classList.add("ready");
  } else if (!cashPayment.hasReceived) {
    paymentStatus.textContent = "Enter the cash received to calculate change.";
  } else if (!cashPayment.isSufficient) {
    paymentStatus.textContent = `Still due: ${formatBoth(cashPayment.shortfallUSD, cashPayment.shortfallLBP)}`;
    paymentStatus.classList.add("shortfall");
  } else if (cashPayment.change > 0) {
    paymentStatus.textContent = `Suggested return: ${formatMixed(cashPayment.mixedChangeUSD, cashPayment.mixedChangeLBP)}.`;
    paymentStatus.classList.add("ready");
  } else {
    paymentStatus.textContent = "Exact amount received. No change to return.";
    paymentStatus.classList.add("ready");
  }

  $("completeSaleBtn").disabled = cart.length === 0 || !cashPayment.isSufficient;
  saveDraftState();
}

function updateDiscountControls() {
  const type = $("discountType").value;
  const input = $("discountValue");
  input.disabled = type === "none";

  if (type === "none") {
    input.value = "0";
    $("discountValueLabel").textContent = "Discount value";
  } else if (type === "percent") {
    input.max = "100";
    input.step = "0.01";
    $("discountValueLabel").textContent = "Discount percentage";
  } else {
    input.removeAttribute("max");
    input.step = $("paymentCurrency").value === "LBP" ? "1" : "0.01";
    $("discountValueLabel").textContent = `Fixed discount (${$("paymentCurrency").value})`;
  }

  const cashInput = $("cashReceived");
  cashInput.step = $("paymentCurrency").value === "LBP" ? "1" : "0.01";
  cashInput.placeholder = $("paymentCurrency").value === "LBP"
    ? "Example: 5,000,000"
    : "Example: 50 or 100";

  renderCart();
}

function resetCheckoutInputs() {
  $("discountType").value = "none";
  $("discountValue").value = "0";
  $("discountValue").disabled = true;
  $("discountValue").removeAttribute("max");
  $("discountValueLabel").textContent = "Discount value";
  $("cashReceived").value = "";
}

function clearCart() {
  if (cart.length > 0 && !window.confirm("Clear the current cart?")) return;
  cart = [];
  resetCheckoutInputs();
  updateDiscountControls();
}

function completeSale() {
  if (cart.length === 0) {
    showToast("Add at least one item before completing the sale.", true);
    return;
  }

  for (const entry of cart) {
    const item = state.items.find((product) => product.id === entry.itemId);
    if (!item) {
      showToast("A cart item no longer exists. Remove it and try again.", true);
      return;
    }
    if (item.stockQuantity !== null && entry.quantity > item.stockQuantity) {
      showToast(`Not enough stock for ${item.name}.`, true);
      return;
    }
  }

  const totals = getCartTotals();
  const cashPayment = getCashPayment(totals);
  if (!cashPayment.isSufficient) {
    const message = cashPayment.hasReceived
      ? `Cash received is short by ${formatNative(cashPayment.shortfall, cashPayment.currency)}.`
      : "Enter the cash received before completing the sale.";
    showToast(message, true);
    $("cashReceived").focus();
    return;
  }

  const rate = state.settings.exchangeRate;
  const invoiceNumber = `INV-${String(state.settings.nextInvoiceNumber).padStart(6, "0")}`;
  const saleItems = cart.map((entry) => {
    const item = state.items.find((product) => product.id === entry.itemId);
    const prices = getItemPrices(item, rate);
    return {
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity: entry.quantity,
      unitPrice: item.price,
      itemCurrency: item.currency,
      unitPriceUSD: round(prices.usd, 6),
      unitPriceLBP: round(prices.lbp, 4),
      totalUSD: round(prices.usd * entry.quantity, 6),
      totalLBP: round(prices.lbp * entry.quantity, 4)
    };
  });

  const sale = {
    id: makeId("sale"),
    invoiceNumber,
    date: new Date().toISOString(),
    items: saleItems,
    exchangeRate: rate,
    subtotalUSD: round(totals.subtotalUSD, 6),
    subtotalLBP: round(totals.subtotalLBP, 4),
    discountType: totals.discountType,
    discountValue: totals.discountValue,
    discountCurrency: totals.discountType === "fixed" ? totals.paymentCurrency : "%",
    discountUSD: round(totals.discountUSD, 6),
    discountLBP: round(totals.discountLBP, 4),
    finalTotalUSD: round(totals.finalUSD, 6),
    finalTotalLBP: round(totals.finalLBP, 4),
    paymentCurrency: totals.paymentCurrency,
    cashReceived: round(cashPayment.cashReceived, totals.paymentCurrency === "LBP" ? 0 : 2),
    cashReceivedUSD: round(cashPayment.cashReceivedUSD, 6),
    cashReceivedLBP: round(cashPayment.cashReceivedLBP, 4),
    changeUSD: round(cashPayment.changeUSD, 6),
    changeLBP: round(cashPayment.changeLBP, 4)
  };

  cart.forEach((entry) => {
    const item = state.items.find((product) => product.id === entry.itemId);
    if (item.stockQuantity !== null) {
      item.stockQuantity = round(Math.max(0, item.stockQuantity - entry.quantity), 3);
    }
  });

  state.sales.push(sale);
  state.settings.nextInvoiceNumber += 1;
  currentInvoice = sale;
  cart = [];
  resetCheckoutInputs();
  saveData();
  renderAll();
  renderInvoice(sale);
  openModal("invoiceModal");
  showToast(`${invoiceNumber} completed and saved.`);
}

function renderInvoice(sale) {
  if (!sale) return;

  const settings = state.settings;
  const itemRows = sale.items.map((item) => {
    const nativeTotal = item.itemCurrency === "LBP" ? item.totalLBP : item.totalUSD;
    return `
      <tr>
        <td>${escapeHTML(item.name)}<br><small>${escapeHTML(item.unit)}</small></td>
        <td>${formatQuantity(item.quantity)}</td>
        <td>${formatNative(item.unitPrice, item.itemCurrency)}</td>
        <td>${formatNative(nativeTotal, item.itemCurrency)}</td>
        <td>${escapeHTML(item.itemCurrency)}</td>
      </tr>
    `;
  }).join("");

  const display = settings.defaultCurrency;
  const discountLabel = sale.discountType === "percent"
    ? `Discount (${formatQuantity(sale.discountValue)}%)`
    : "Discount";
  const paymentTotal = sale.paymentCurrency === "LBP"
    ? formatLBP(sale.finalTotalLBP)
    : formatUSD(sale.finalTotalUSD);
  const hasCashDetails = Number.isFinite(Number(sale.cashReceived));
  const mixedChange = getMixedChange(sale.changeUSD, sale.changeLBP, sale.exchangeRate);
  const cashDetailRows = hasCashDetails
    ? `
      <div><span>Cash received</span><strong>${formatNative(sale.cashReceived, sale.paymentCurrency)}</strong></div>
      <div><span>Change due</span><strong>${formatBoth(sale.changeUSD, sale.changeLBP)}</strong></div>
      <div><span>Suggested mixed return</span><strong>${formatMixed(mixedChange.usd, mixedChange.lbp)}</strong></div>
    `
    : "";
  const finalTotalRows = display === "LBP"
    ? `
      <div class="receipt-grand"><span>Final Total LBP</span><strong>${formatLBP(sale.finalTotalLBP)}</strong></div>
      <div><span>Final Total USD (equivalent)</span><strong>${formatUSD(sale.finalTotalUSD)}</strong></div>
    `
    : display === "USD"
      ? `
        <div class="receipt-grand"><span>Final Total USD</span><strong>${formatUSD(sale.finalTotalUSD)}</strong></div>
        <div><span>Final Total LBP (equivalent)</span><strong>${formatLBP(sale.finalTotalLBP)}</strong></div>
      `
      : `
        <div class="receipt-grand"><span>Final Total USD</span><strong>${formatUSD(sale.finalTotalUSD)}</strong></div>
        <div class="receipt-grand"><span>Final Total LBP</span><strong>${formatLBP(sale.finalTotalLBP)}</strong></div>
      `;

  $("printArea").innerHTML = `
    <article class="receipt">
      <header class="receipt-header">
        <h2>${escapeHTML(settings.shopName)}</h2>
        ${settings.shopPhone ? `<p>${escapeHTML(settings.shopPhone)}</p>` : ""}
        ${settings.shopAddress ? `<p>${escapeHTML(settings.shopAddress)}</p>` : ""}
      </header>
      <div class="receipt-meta">
        <span>Invoice</span><span>${escapeHTML(sale.invoiceNumber)}</span>
        <span>Date</span><span>${escapeHTML(formatDateTime(sale.date))}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Cur.</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="receipt-totals">
        <div><span>Subtotal</span><strong>${formatByDisplay(sale.subtotalUSD, sale.subtotalLBP, display)}</strong></div>
        ${sale.discountUSD > 0 ? `<div><span>${discountLabel}</span><strong>${formatByDisplay(sale.discountUSD, sale.discountLBP, display)}</strong></div>` : ""}
        ${finalTotalRows}
        <div><span>Cash currency</span><strong>${escapeHTML(sale.paymentCurrency)}</strong></div>
        <div><span>Amount due</span><strong>${paymentTotal}</strong></div>
        ${cashDetailRows}
        <div><span>Exchange rate used</span><strong>1 USD = ${formatLBP(sale.exchangeRate)}</strong></div>
      </div>
      <footer class="receipt-footer">
        <p>${escapeHTML(settings.thankYouMessage)}</p>
      </footer>
    </article>
  `;
  $("invoiceModalTitle").textContent = sale.invoiceNumber;
}

function printInvoice(sale) {
  if (sale) {
    currentInvoice = sale;
    renderInvoice(sale);
  }
  if (!currentInvoice) {
    showToast("There is no invoice to print.", true);
    return;
  }
  window.print();
}

function openInvoice(saleId) {
  const sale = state.sales.find((entry) => entry.id === saleId);
  if (!sale) return;
  renderInvoice(sale);
  openModal("invoiceModal");
}

function setReportDates() {
  const period = $("reportPeriod").value;
  const today = new Date();
  let from = new Date(today);
  let to = new Date(today);

  if (period === "weekly") {
    const day = today.getDay() || 7;
    from.setDate(today.getDate() - day + 1);
    to.setDate(from.getDate() + 6);
  } else if (period === "monthly") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  const isCustom = period === "custom";
  $("reportFrom").disabled = !isCustom;
  $("reportTo").disabled = !isCustom;

  if (!isCustom || !$("reportFrom").value || !$("reportTo").value) {
    $("reportFrom").value = localDateString(from);
    $("reportTo").value = localDateString(to);
  }
}

function filterReports() {
  const from = $("reportFrom").value;
  const to = $("reportTo").value;

  reportSales = state.sales
    .filter((sale) => {
      const date = localDateString(sale.date);
      return (!from || date >= from) && (!to || date <= to);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return reportSales;
}

function renderReports() {
  const sales = filterReports();
  const totalUSD = sales.reduce((sum, sale) => sum + (Number(sale.finalTotalUSD) || 0), 0);
  const totalLBP = sales.reduce((sum, sale) => sum + (Number(sale.finalTotalLBP) || 0), 0);
  const totalQuantity = sales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0);
  }, 0);
  const itemTotals = {};
  const paymentCounts = { USD: 0, LBP: 0 };
  const paymentAmounts = { USD: 0, LBP: 0 };

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      itemTotals[item.name] = (itemTotals[item.name] || 0) + (Number(item.quantity) || 0);
    });
    const currency = sale.paymentCurrency === "LBP" ? "LBP" : "USD";
    paymentCounts[currency] += 1;
    paymentAmounts[currency] += currency === "LBP"
      ? Number(sale.finalTotalLBP) || 0
      : Number(sale.finalTotalUSD) || 0;
  });

  const bestItems = Object.keys(itemTotals)
    .sort((a, b) => itemTotals[b] - itemTotals[a])
    .slice(0, 3)
    .map((name) => `${name}: ${formatQuantity(itemTotals[name])}`)
    .join(" | ");

  $("reportTotalUSD").textContent = formatUSD(totalUSD);
  $("reportTotalLBP").textContent = formatLBP(totalLBP);
  $("reportInvoiceCount").textContent = String(sales.length);
  $("reportQuantity").textContent = formatQuantity(totalQuantity);
  $("reportBestItems").textContent = bestItems || "No sales";
  $("reportPayments").textContent = `USD: ${paymentCounts.USD} invoices (${formatUSD(paymentAmounts.USD)}) | LBP: ${paymentCounts.LBP} invoices (${formatLBP(paymentAmounts.LBP)})`;

  $("reportsTableBody").innerHTML = sales.map((sale) => {
    const items = sale.items
      .map((item) => `${escapeHTML(item.name)} × ${formatQuantity(item.quantity)}`)
      .join(", ");

    return `
      <tr>
        <td><span class="item-name">${escapeHTML(sale.invoiceNumber)}</span></td>
        <td>${escapeHTML(formatDateTime(sale.date))}</td>
        <td>${items}</td>
        <td>1 USD = ${formatLBP(sale.exchangeRate)}</td>
        <td>${formatUSD(sale.finalTotalUSD)}</td>
        <td>${formatLBP(sale.finalTotalLBP)}</td>
        <td>${escapeHTML(sale.paymentCurrency)}</td>
        <td class="actions-col">
          <button class="btn btn-secondary btn-small" type="button" data-report-action="view" data-id="${escapeHTML(sale.id)}">View / Print</button>
        </td>
      </tr>
    `;
  }).join("");

  $("reportsEmpty").classList.toggle("hidden", sales.length > 0);
  document.querySelector("#reportsTab .table-wrap").classList.toggle("hidden", sales.length === 0);
}

function spreadsheetCell(value, type, style) {
  const dataType = type || "String";
  const styleAttribute = style ? ` ss:StyleID="${style}"` : "";
  const safeValue = dataType === "Number" ? String(Number(value) || 0) : escapeXml(value);
  return `<Cell${styleAttribute}><Data ss:Type="${dataType}">${safeValue}</Data></Cell>`;
}

function spreadsheetRow(values, isHeader) {
  return `<Row>${values.map((entry) => {
    if (entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "value")) {
      return spreadsheetCell(entry.value, entry.type, isHeader ? "Header" : entry.style);
    }
    return spreadsheetCell(entry, "String", isHeader ? "Header" : "");
  }).join("")}</Row>`;
}

function exportReports() {
  const sales = filterReports();
  if (sales.length === 0) {
    showToast("There are no report rows to export.", true);
    return;
  }

  const headers = [
    "Invoice Number",
    "Date",
    "Item Sold",
    "Quantity",
    "Unit",
    "Unit Price",
    "Item Currency",
    "Exchange Rate Used",
    "Item Total USD",
    "Item Total LBP",
    "Discount Type",
    "Discount Value",
    "Discount USD",
    "Discount LBP",
    "Final Invoice Total USD",
    "Final Invoice Total LBP",
    "Cash Currency",
    "Cash Received",
    "Cash Received USD",
    "Cash Received LBP",
    "Change Due USD",
    "Change Due LBP"
  ];

  const rows = [spreadsheetRow(headers, true)];
  sales.forEach((sale) => {
    const hasCashDetails = Number.isFinite(Number(sale.cashReceived));
    const cashColumns = hasCashDetails
      ? [
        { value: sale.cashReceived, type: "Number" },
        { value: sale.cashReceivedUSD, type: "Number" },
        { value: sale.cashReceivedLBP, type: "Number" },
        { value: sale.changeUSD, type: "Number" },
        { value: sale.changeLBP, type: "Number" }
      ]
      : ["", "", "", "", ""];

    sale.items.forEach((item) => {
      rows.push(spreadsheetRow([
        sale.invoiceNumber,
        formatDateTime(sale.date),
        item.name,
        { value: item.quantity, type: "Number" },
        item.unit,
        { value: item.unitPrice, type: "Number" },
        item.itemCurrency,
        { value: sale.exchangeRate, type: "Number" },
        { value: item.totalUSD, type: "Number" },
        { value: item.totalLBP, type: "Number" },
        sale.discountType,
        { value: sale.discountValue, type: "Number" },
        { value: sale.discountUSD, type: "Number" },
        { value: sale.discountLBP, type: "Number" },
        { value: sale.finalTotalUSD, type: "Number" },
        { value: sale.finalTotalLBP, type: "Number" },
        sale.paymentCurrency,
        ...cashColumns
      ]));
    });
  });

  const totalUSD = sales.reduce((sum, sale) => sum + (Number(sale.finalTotalUSD) || 0), 0);
  const totalLBP = sales.reduce((sum, sale) => sum + (Number(sale.finalTotalLBP) || 0), 0);
  const totalQuantity = sales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0);
  }, 0);
  const summaryRows = [
    spreadsheetRow(["Metric", "Value"], true),
    spreadsheetRow(["Report From", $("reportFrom").value]),
    spreadsheetRow(["Report To", $("reportTo").value]),
    spreadsheetRow(["Invoice Count", { value: sales.length, type: "Number" }]),
    spreadsheetRow(["Total Quantity Sold", { value: totalQuantity, type: "Number" }]),
    spreadsheetRow(["Total Sales USD", { value: totalUSD, type: "Number" }]),
    spreadsheetRow(["Total Sales LBP", { value: totalLBP, type: "Number" }])
  ];

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#DCEFE3" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Sales"><Table>${rows.join("")}</Table></Worksheet>
 <Worksheet ss:Name="Summary"><Table>${summaryRows.join("")}</Table></Worksheet>
</Workbook>`;

  downloadBlob(
    new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `sales-report-${$("reportFrom").value}-to-${$("reportTo").value}.xls`
  );
  showToast("Excel report exported.");
}

function fillSettingsForm() {
  $("shopName").value = state.settings.shopName;
  $("shopPhone").value = state.settings.shopPhone;
  $("shopAddress").value = state.settings.shopAddress;
  $("exchangeRate").value = state.settings.exchangeRate;
  $("defaultCurrency").value = state.settings.defaultCurrency;
  $("thankYouMessage").value = state.settings.thankYouMessage;
  setSettingsSaveStatus("All settings saved locally.", "saved");
}

function setSettingsSaveStatus(message, status) {
  const element = $("settingsSaveStatus");
  if (!element) return;
  element.textContent = message;
  element.classList.remove("saved", "unsaved", "error");
  element.classList.add(status);
}

function markSettingsUnsaved() {
  setSettingsSaveStatus("Unsaved changes. Select Save All Settings.", "unsaved");
}

function saveSettings(event) {
  event.preventDefault();
  const exchangeRate = positiveNumber($("exchangeRate").value, 0);

  if (!exchangeRate) {
    showToast("Enter a valid exchange rate greater than zero.", true);
    $("exchangeRate").focus();
    return;
  }

  const previousSettings = Object.assign({}, state.settings);
  state.settings.shopName = $("shopName").value.trim() || "Fresh Market";
  state.settings.shopPhone = $("shopPhone").value.trim();
  state.settings.shopAddress = $("shopAddress").value.trim();
  state.settings.exchangeRate = exchangeRate;
  state.settings.defaultCurrency = $("defaultCurrency").value;
  state.settings.thankYouMessage = $("thankYouMessage").value.trim() || "Thank you for shopping with us!";

  if (!saveData()) {
    state.settings = previousSettings;
    setSettingsSaveStatus("Save failed. Your changes are still shown but were not stored.", "error");
    return;
  }

  fillSettingsForm();
  renderAll();
  showToast("All settings saved locally.");
}

function backupData() {
  const backup = {
    app: "Fresh Market POS",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  };
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" }),
    `fresh-market-pos-backup-${localDateString(new Date())}.json`
  );
  showToast("Backup downloaded.");
}

function restoreData(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = parsed && parsed.data ? parsed.data : parsed;
      if (!incoming || !Array.isArray(incoming.items) || !Array.isArray(incoming.sales) || !incoming.settings) {
        throw new Error("Missing required POS data");
      }
      if (!window.confirm("Restore this backup? Current local data will be replaced.")) return;

      state = normalizeState(incoming);
      cart = [];
      resetCheckoutInputs();
      currentInvoice = state.sales.length ? state.sales[state.sales.length - 1] : null;
      saveData();
      fillSettingsForm();
      setReportDates();
      renderAll();
      showToast("Backup restored.");
    } catch (error) {
      console.error("Unable to restore backup:", error);
      showToast("The selected file is not a valid POS backup.", true);
    } finally {
      $("restoreFileInput").value = "";
    }
  };
  reader.onerror = () => showToast("Could not read the backup file.", true);
  reader.readAsText(file);
}

function resetSales() {
  if (!window.confirm("Delete all sales? Items and settings will be kept.")) return;
  if (!window.confirm("Confirm deletion of all saved sales. This cannot be undone.")) return;

  state.sales = [];
  state.settings.nextInvoiceNumber = 1;
  currentInvoice = null;
  saveData();
  renderAll();
  showToast("All sales were deleted.");
}

function resetAllData() {
  if (!window.confirm("Reset the entire system? All items, sales, and settings will be replaced.")) return;
  if (!window.confirm("Final confirmation: reset all local POS data?")) return;

  state = createDefaultState();
  cart = [];
  resetCheckoutInputs();
  currentInvoice = null;
  saveData();
  fillSettingsForm();
  setReportDates();
  renderAll();
  switchTab("items");
  showToast("System reset to default data.");
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openModal(modalId) {
  $(modalId).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(modalId) {
  $(modalId).classList.add("hidden");
  document.body.style.overflow = "";
}

function renderAll() {
  renderHeader();
  renderItems();
  renderProducts();
  renderCart();
  renderReports();
  $("printLastInvoiceBtn").disabled = !currentInvoice;
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  $("addItemBtn").addEventListener("click", () => openItemModal());
  $("itemForm").addEventListener("submit", addItem);
  $("itemPrice").addEventListener("input", updateItemPricePreview);
  $("itemCurrency").addEventListener("change", updateItemPricePreview);
  $("itemSearch").addEventListener("input", renderItems);
  $("itemCategoryFilter").addEventListener("change", renderItems);
  $("itemStatusFilter").addEventListener("change", renderItems);

  $("itemsTableBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-item-action]");
    if (!button) return;
    if (button.dataset.itemAction === "edit") editItem(button.dataset.id);
    if (button.dataset.itemAction === "delete") deleteItem(button.dataset.id);
  });

  $("posSearch").addEventListener("input", renderProducts);
  $("posCategoryFilter").addEventListener("change", renderProducts);
  $("posSearch").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = $("posSearch").value.trim().toLowerCase();
    const products = getFilteredProducts();
    const exact = products.find((item) => item.barcode.toLowerCase() === query || item.name.toLowerCase() === query);
    const item = exact || products[0];
    if (item) {
      addToCart(item.id);
      $("posSearch").value = "";
      renderProducts();
    }
  });
  $("productGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (button && !button.disabled) addToCart(button.dataset.productId);
  });

  $("cartTableBody").addEventListener("change", (event) => {
    if (event.target.matches("[data-cart-qty]")) {
      updateCart(event.target.dataset.cartQty, event.target.value);
    }
  });
  $("cartTableBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-remove]");
    if (button) removeFromCart(button.dataset.cartRemove);
  });
  $("clearCartBtn").addEventListener("click", clearCart);
  $("discountType").addEventListener("change", updateDiscountControls);
  $("discountValue").addEventListener("input", renderCart);
  $("paymentCurrency").addEventListener("change", () => {
    $("cashReceived").value = "";
    updateDiscountControls();
  });
  $("cashReceived").addEventListener("input", renderCart);
  $("completeSaleBtn").addEventListener("click", completeSale);
  $("printLastInvoiceBtn").addEventListener("click", () => {
    if (!currentInvoice) return;
    renderInvoice(currentInvoice);
    openModal("invoiceModal");
  });
  $("printInvoiceBtn").addEventListener("click", () => printInvoice());

  $("reportPeriod").addEventListener("change", () => {
    setReportDates();
    renderReports();
  });
  $("applyReportFilterBtn").addEventListener("click", () => {
    if ($("reportFrom").value && $("reportTo").value && $("reportFrom").value > $("reportTo").value) {
      showToast("The report start date must be before the end date.", true);
      return;
    }
    renderReports();
  });
  $("exportReportsBtn").addEventListener("click", exportReports);
  $("reportsTableBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-action]");
    if (button && button.dataset.reportAction === "view") openInvoice(button.dataset.id);
  });

  $("settingsForm").addEventListener("submit", saveSettings);
  $("settingsForm").addEventListener("input", markSettingsUnsaved);
  $("settingsForm").addEventListener("change", markSettingsUnsaved);
  $("backupDataBtn").addEventListener("click", backupData);
  $("restoreDataBtn").addEventListener("click", () => $("restoreFileInput").click());
  $("restoreFileInput").addEventListener("change", (event) => restoreData(event.target.files[0]));
  $("resetSalesBtn").addEventListener("click", resetSales);
  $("resetAllBtn").addEventListener("click", resetAllData);

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", () => {
      closeModal(element.dataset.closeModal === "item" ? "itemModal" : "invoiceModal");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("itemModal").classList.contains("hidden")) closeModal("itemModal");
    if (!$("invoiceModal").classList.contains("hidden")) closeModal("invoiceModal");
  });
  window.addEventListener("online", renderHeader);
  window.addEventListener("offline", renderHeader);
  window.addEventListener("pagehide", saveDraftState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveDraftState();
  });
}

function initializeApp() {
  loadData();
  bindEvents();
  fillSettingsForm();
  setReportDates();
  currentInvoice = state.sales.length ? state.sales[state.sales.length - 1] : null;
  const restoredTab = loadDraftState();
  updateDiscountControls();
  renderAll();
  switchTab(restoredTab);
  requestPersistentStorage();
}

document.addEventListener("DOMContentLoaded", initializeApp);
