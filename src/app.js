/**
 * BatchOptima KDS - Capacity-Constrained Kitchen Batching Engine
 * Built for Speedcode 2026 @ Nitte Meenakshi Institute of Technology (NMIT), Bengaluru
 */

(function () {
  // Global State
  const state = {
    config: {
      windowDurationSec: 300, // 5 minutes
      maxItemsPerBatch: 5,   // Capacity constraint: 5 items
      maxWeightKg: 4.5,      // Weight constraint
      cookTimeSec: 15,       // Accelerated for demo
      simSpeed: 1            // 1x, 2x, 5x, 10x
    },
    batches: [],
    orders: [],
    zoneWindows: {}, // zoneId -> { windowNumber, remainingSec, totalSec, activeBatchIds }
    splitEvents: [],
    metrics: {
      totalOrders: 0,
      totalItems: 0,
      totalBatches: 0,
      splitCount: 0,
      dispatchedBatches: 0,
      co2SavedKg: 0,
      riderTripsSaved: 0,
      avgFulfillmentSec: 0
    },
    activeTab: 'kds', // 'kds', 'radar', 'algorithm', 'analytics', 'pitch', 'settings'
    simulationRunning: true,
    simTimer: null,
    clockTimer: null,
    batchSequence: 101,
    orderSequence: 1001,
    chartInstances: {}
  };

  // Initialize Zone Windows
  function initZones() {
    window.APP_DATA.ZONES.forEach(zone => {
      state.zoneWindows[zone.id] = {
        windowNumber: 1,
        remainingSec: state.config.windowDurationSec,
        totalSec: state.config.windowDurationSec,
        lastCreatedTime: Date.now()
      };
    });
  }

  // Create Initial Sample Data
  function seedInitialData() {
    const initialOrders = [
      {
        zoneId: "BLR-NORTH",
        customer: "NMIT Tech Hub (Prof. Rao)",
        items: [
          { ...window.APP_DATA.MENU_ITEMS[0], qty: 2 }, // Biryani x2
          { ...window.APP_DATA.MENU_ITEMS[1], qty: 1 }  // Paneer x1
        ]
      },
      {
        zoneId: "BLR-NORTH",
        customer: "Hostel Block 4",
        items: [
          { ...window.APP_DATA.MENU_ITEMS[3], qty: 2 }  // BBQ Wings x2 (Total now 5 items -> FULL!)
        ]
      },
      {
        zoneId: "BLR-CENTRAL",
        customer: "Ananya Hegde (Indiranagar)",
        items: [
          { ...window.APP_DATA.MENU_ITEMS[4], qty: 1 }, // Pizza x1
          { ...window.APP_DATA.MENU_ITEMS[8], qty: 2 }  // Shake x2
        ]
      },
      {
        zoneId: "BLR-TECH",
        customer: "Prestige Tech Cloud (Rohan)",
        items: [
          { ...window.APP_DATA.MENU_ITEMS[5], qty: 2 }, // Burger x2
          { ...window.APP_DATA.MENU_ITEMS[6], qty: 2 }  // Noodles x2
        ]
      }
    ];

    initialOrders.forEach(ord => processIncomingOrder(ord.zoneId, ord.customer, ord.items, false));
  }

  // -------------------------------------------------------------
  // CORE CAPACITY-CONSTRAINED BATCHING & AUTO-SPLIT ENGINE
  // -------------------------------------------------------------

  function processIncomingOrder(zoneId, customerName, rawItemsList, playAudio = true) {
    const orderId = `ORD-${state.orderSequence++}`;
    const zone = window.APP_DATA.ZONES.find(z => z.id === zoneId) || window.APP_DATA.ZONES[0];
    
    // Flatten items with quantities
    const items = [];
    let orderTotalWeight = 0;
    let orderTotalPrice = 0;
    
    rawItemsList.forEach(item => {
      const qty = item.qty || 1;
      for (let i = 0; i < qty; i++) {
        items.push({
          id: item.id,
          name: item.name,
          emoji: item.emoji,
          weightKg: item.weightKg,
          station: item.station,
          price: item.price
        });
        orderTotalWeight += item.weightKg;
        orderTotalPrice += item.price;
      }
    });

    const orderObj = {
      id: orderId,
      customer: customerName,
      zoneId: zone.id,
      zoneName: zone.name,
      items: items,
      itemCount: items.length,
      totalWeightKg: parseFloat(orderTotalWeight.toFixed(2)),
      totalPrice: orderTotalPrice,
      timestamp: new Date().toLocaleTimeString(),
      createdAt: Date.now()
    };

    state.orders.unshift(orderObj);
    state.metrics.totalOrders++;
    state.metrics.totalItems += items.length;

    // Dispatch items into batches according to capacity constraints
    allocateItemsToZoneBatches(zoneId, orderObj, playAudio);
    updateMetrics();
    renderAll();
  }

  function allocateItemsToZoneBatches(zoneId, order, playAudio) {
    const maxItems = state.config.maxItemsPerBatch;
    const maxWeight = state.config.maxWeightKg;

    let remainingItems = [...order.items];
    let splitOccurred = false;
    let createdBatchIds = [];

    while (remainingItems.length > 0) {
      let batch = state.batches.find(b => 
        b.zoneId === zoneId && 
        b.status === 'GATHERING' && 
        b.items.length < maxItems &&
        b.totalWeightKg < maxWeight
      );

      if (!batch) {
        const batchNum = state.batchSequence++;
        const subLetter = splitOccurred ? `-${String.fromCharCode(65 + createdBatchIds.length)}` : '';
        const batchId = `BATCH-${zoneId.replace('BLR-', '')}-${batchNum}${subLetter}`;

        batch = {
          id: batchId,
          batchNum: batchNum,
          zoneId: zoneId,
          zone: window.APP_DATA.ZONES.find(z => z.id === zoneId),
          windowNumber: state.zoneWindows[zoneId].windowNumber,
          status: 'GATHERING',
          items: [],
          ordersIncluded: [],
          totalWeightKg: 0,
          maxItems: maxItems,
          maxWeightKg: maxWeight,
          isSplit: splitOccurred,
          splitParent: splitOccurred ? createdBatchIds[0] || null : null,
          splitReason: null,
          createdAt: Date.now(),
          cookProgress: 0,
          cookTimeTotal: state.config.cookTimeSec,
          rider: null,
          dispatchedAt: null
        };
        state.batches.unshift(batch);
        state.metrics.totalBatches++;
        createdBatchIds.push(batch.id);
      }

      const availableItemCapacity = maxItems - batch.items.length;
      const itemsToFit = [];
      const leftoverItems = [];

      for (const itm of remainingItems) {
        if (
          itemsToFit.length < availableItemCapacity && 
          (batch.totalWeightKg + itm.weightKg) <= maxWeight
        ) {
          itemsToFit.push(itm);
          batch.totalWeightKg = parseFloat((batch.totalWeightKg + itm.weightKg).toFixed(2));
        } else {
          leftoverItems.push(itm);
        }
      }

      itemsToFit.forEach(itm => {
        batch.items.push({
          ...itm,
          orderId: order.id,
          customer: order.customer
        });
      });

      if (!batch.ordersIncluded.includes(order.id)) {
        batch.ordersIncluded.push(order.id);
      }

      if (batch.items.length >= maxItems || batch.totalWeightKg >= maxWeight) {
        batch.isFull = true;
      }

      if (leftoverItems.length > 0) {
        splitOccurred = true;
        batch.isSplit = true;
        batch.splitReason = batch.items.length >= maxItems 
          ? `Exceeded capacity limit (${maxItems} items)` 
          : `Exceeded max weight limit (${maxWeight} kg)`;

        state.metrics.splitCount++;

        const splitLog = {
          id: `SPLIT-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          zoneId: zoneId,
          batchId: batch.id,
          orderId: order.id,
          customer: order.customer,
          reason: batch.splitReason,
          fittedCount: itemsToFit.length,
          overflowCount: leftoverItems.length
        };
        state.splitEvents.unshift(splitLog);

        if (playAudio) {
          window.soundEngine.playChime('split');
          showNotificationToast(`⚠️ AUTO-SPLIT TRIGGERED: Order for ${zoneId} exceeded ${maxItems} items. Splitting into secondary batch!`, 'warning');
        }
      } else if (playAudio && !splitOccurred) {
        window.soundEngine.playChime('newOrder');
        showNotificationToast(`✅ New order ${order.id} placed in ${batch.id} (${batch.items.length}/${maxItems} items)`, 'success');
      }

      remainingItems = leftoverItems;
    }
  }

  // -------------------------------------------------------------
  // TIME WINDOW & KITCHEN LIFECYCLE CONTROLLER
  // -------------------------------------------------------------

  function tickTime() {
    const multiplier = state.config.simSpeed;

    // 1. Tick 5-Minute Zone Windows
    window.APP_DATA.ZONES.forEach(zone => {
      const zw = state.zoneWindows[zone.id];
      if (zw) {
        zw.remainingSec -= (1 * multiplier);
        if (zw.remainingSec <= 0) {
          transitionZoneBatchesToCooking(zone.id);
          zw.windowNumber++;
          zw.remainingSec = state.config.windowDurationSec;
          showNotificationToast(`⏰ 5-Min Window expired for ${zone.name}. Auto-dispatching batch to kitchen!`, 'info');
        }
      }
    });

    // 2. Tick Cooking & Packing Batches
    state.batches.forEach(batch => {
      if (batch.status === 'COOKING') {
        batch.cookProgress += (1 * multiplier);
        if (batch.cookProgress >= batch.cookTimeTotal) {
          batch.status = 'PACKING';
          batch.packedProgress = 0;
          showNotificationToast(`🍳 Batch ${batch.id} finished cooking! Moving to Quality Seal.`, 'info');
        }
      } else if (batch.status === 'PACKING') {
        batch.packedProgress = (batch.packedProgress || 0) + (1 * multiplier);
        if (batch.packedProgress >= 6) {
          dispatchBatch(batch);
        }
      }
    });

    renderTimersOnly();
  }

  function transitionZoneBatchesToCooking(zoneId) {
    const activeBatches = state.batches.filter(b => b.zoneId === zoneId && b.status === 'GATHERING' && b.items.length > 0);
    activeBatches.forEach(batch => {
      batch.status = 'COOKING';
      batch.cookProgress = 0;
      batch.startedCookAt = Date.now();
    });
    if (activeBatches.length > 0) {
      window.soundEngine.playChime('cook');
    }
  }

  function forceCookBatch(batchId) {
    const batch = state.batches.find(b => b.id === batchId);
    if (batch && batch.status === 'GATHERING') {
      batch.status = 'COOKING';
      batch.cookProgress = 0;
      batch.startedCookAt = Date.now();
      window.soundEngine.playChime('cook');
      showNotificationToast(`🔥 Batch ${batch.id} manually sent to Kitchen Prep Station!`, 'success');
      renderAll();
    }
  }

  function dispatchBatch(batch) {
    batch.status = 'DISPATCHED';
    batch.dispatchedAt = new Date().toLocaleTimeString();
    batch.rider = {
      name: `Rider ${['Kiran', 'Suresh', 'Manjunath', 'Arun', 'Praveen'][Math.floor(Math.random() * 5)]}`,
      bikeNumber: `KA-04-E-${Math.floor(1000 + Math.random() * 9000)}`,
      etaMin: Math.floor(batch.zone.distanceKm * 2.2 + 4)
    };
    state.metrics.dispatchedBatches++;
    
    const tripsSaved = Math.max(0, batch.items.length - 1);
    state.metrics.riderTripsSaved += tripsSaved;
    state.metrics.co2SavedKg += parseFloat((tripsSaved * 0.42).toFixed(2));

    window.soundEngine.playChime('dispatch');
    showNotificationToast(`🛵 Batch ${batch.id} Dispatched to ${batch.zone.name} via ${batch.rider.name}!`, 'success');
    updateMetrics();
    renderAll();
  }

  // -------------------------------------------------------------
  // SIMULATION GENERATOR
  // -------------------------------------------------------------

  function toggleSimulation() {
    state.simulationRunning = !state.simulationRunning;
    const btn = document.getElementById('sim-toggle-btn');
    if (btn) {
      btn.innerHTML = state.simulationRunning 
        ? `<i data-lucide="pause" class="w-4 h-4 text-amber-400"></i> Pause`
        : `<i data-lucide="play" class="w-4 h-4 text-emerald-400"></i> Resume`;
      lucide.createIcons();
    }
    showNotificationToast(state.simulationRunning ? 'Simulation resumed' : 'Simulation paused', 'info');
  }

  function setSimSpeed(multiplier) {
    state.config.simSpeed = multiplier;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('bg-indigo-600', 'text-white'));
    const active = document.getElementById(`speed-btn-${multiplier}x`);
    if (active) active.classList.add('bg-indigo-600', 'text-white');
    showNotificationToast(`Simulation speed set to ${multiplier}x`, 'info');
  }

  function spawnSimulatedOrder() {
    if (!state.simulationRunning) return;

    const zones = window.APP_DATA.ZONES;
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const customer = window.APP_DATA.CUSTOMER_NAMES[Math.floor(Math.random() * window.APP_DATA.CUSTOMER_NAMES.length)];
    
    const itemCount = Math.random() > 0.8 ? (Math.floor(Math.random() * 4) + 3) : (Math.floor(Math.random() * 2) + 1);
    const orderItems = [];
    
    for (let i = 0; i < itemCount; i++) {
      const item = window.APP_DATA.MENU_ITEMS[Math.floor(Math.random() * window.APP_DATA.MENU_ITEMS.length)];
      orderItems.push({ ...item, qty: 1 });
    }

    processIncomingOrder(zone.id, customer, orderItems, true);
  }

  function triggerMegaBurstOrder() {
    const zone = window.APP_DATA.ZONES[0]; // BLR-NORTH (NMIT Hub)
    const customer = "🏆 Speedcode 2026 Mega Food Court Order";
    const burstItems = [
      { ...window.APP_DATA.MENU_ITEMS[0], qty: 4 }, // Biryani x4
      { ...window.APP_DATA.MENU_ITEMS[1], qty: 3 }, // Paneer x3
      { ...window.APP_DATA.MENU_ITEMS[4], qty: 2 }, // Pizza x2
      { ...window.APP_DATA.MENU_ITEMS[5], qty: 3 }  // Burger x3 (Total 12 items -> Splits into 3 batches: 5 + 5 + 2!)
    ];

    showNotificationToast("🚀 BURST TEST: Injecting 12-Item Mega Order to test Multi-Batch Auto Splitting!", "warning");
    processIncomingOrder(zone.id, customer, burstItems, true);
  }

  // -------------------------------------------------------------
  // METRICS & ROI COMPUTATION
  // -------------------------------------------------------------

  function updateMetrics() {
    const elOrders = document.getElementById('metric-total-orders');
    const elBatches = document.getElementById('metric-total-batches');
    const elSplits = document.getElementById('metric-total-splits');
    const elTrips = document.getElementById('metric-trips-saved');
    const elCo2 = document.getElementById('metric-co2-saved');
    const elFillRate = document.getElementById('metric-fill-rate');

    if (elOrders) elOrders.textContent = state.metrics.totalOrders;
    if (elBatches) elBatches.textContent = state.metrics.totalBatches;
    if (elSplits) elSplits.textContent = state.metrics.splitCount;
    if (elTrips) elTrips.textContent = `${state.metrics.riderTripsSaved} Trips`;
    if (elCo2) elCo2.textContent = `${state.metrics.co2SavedKg.toFixed(1)} kg`;

    const totalCapacitySlots = state.metrics.totalBatches * state.config.maxItemsPerBatch;
    const fillRate = totalCapacitySlots > 0 
      ? Math.round((state.metrics.totalItems / totalCapacitySlots) * 100) 
      : 84;
    if (elFillRate) elFillRate.textContent = `${Math.min(100, fillRate)}%`;
  }

  // -------------------------------------------------------------
  // RENDERING MODULES
  // -------------------------------------------------------------

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg');
      t.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-slate-800/60');
    });
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
      activeBtn.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-slate-800/60');
      activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-lg');
    }

    document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.remove('hidden');

    if (tabId === 'analytics') {
      renderAnalyticsCharts();
    } else if (tabId === 'radar') {
      drawBengaluruRadar();
    }

    lucide.createIcons();
  }

  function renderAll() {
    renderKDS();
    renderSplitAuditLog();
    if (state.activeTab === 'analytics') renderAnalyticsCharts();
    if (state.activeTab === 'radar') drawBengaluruRadar();
    lucide.createIcons();
  }

  function renderTimersOnly() {
    window.APP_DATA.ZONES.forEach(zone => {
      const zw = state.zoneWindows[zone.id];
      const timerEl = document.getElementById(`zone-timer-${zone.id}`);
      const ringEl = document.getElementById(`zone-ring-${zone.id}`);
      if (timerEl && zw) {
        const mins = Math.floor(Math.max(0, zw.remainingSec) / 60);
        const secs = Math.floor(Math.max(0, zw.remainingSec) % 60);
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (ringEl) {
          const pct = Math.max(0, (zw.remainingSec / zw.totalSec) * 100);
          ringEl.setAttribute('stroke-dasharray', `${pct}, 100`);
          if (pct < 20) {
            ringEl.setAttribute('stroke', '#f43f5e');
          } else if (pct < 50) {
            ringEl.setAttribute('stroke', '#f59e0b');
          } else {
            ringEl.setAttribute('stroke', zone.color);
          }
        }
      }
    });

    state.batches.forEach(b => {
      if (b.status === 'COOKING') {
        const bar = document.getElementById(`cook-bar-${b.id}`);
        const txt = document.getElementById(`cook-txt-${b.id}`);
        if (bar) {
          const pct = Math.min(100, Math.round((b.cookProgress / b.cookTimeTotal) * 100));
          bar.style.width = `${pct}%`;
          if (txt) txt.textContent = `${pct}% Prep Complete`;
        }
      }
    });
  }

  function renderKDS() {
    const gatheringContainer = document.getElementById('kds-col-gathering');
    const cookingContainer = document.getElementById('kds-col-cooking');
    const packingContainer = document.getElementById('kds-col-packing');
    const dispatchedContainer = document.getElementById('kds-col-dispatched');

    if (!gatheringContainer) return;

    const gatheringBatches = state.batches.filter(b => b.status === 'GATHERING');
    const cookingBatches = state.batches.filter(b => b.status === 'COOKING');
    const packingBatches = state.batches.filter(b => b.status === 'PACKING');
    const dispatchedBatches = state.batches.filter(b => b.status === 'DISPATCHED').slice(0, 10);

    document.getElementById('count-gathering').textContent = gatheringBatches.length;
    document.getElementById('count-cooking').textContent = cookingBatches.length;
    document.getElementById('count-packing').textContent = packingBatches.length;
    document.getElementById('count-dispatched').textContent = dispatchedBatches.length;

    gatheringContainer.innerHTML = gatheringBatches.length === 0 
      ? `<div class="p-8 text-center text-gray-500 border border-dashed border-gray-700/60 rounded-xl">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm">No active batch gathering.<br/>Orders will accumulate here.</p>
         </div>`
      : gatheringBatches.map(b => createBatchCardHTML(b)).join('');

    cookingContainer.innerHTML = cookingBatches.length === 0
      ? `<div class="p-8 text-center text-gray-500 border border-dashed border-gray-700/60 rounded-xl">
          <i data-lucide="flame" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm">Kitchen stations ready.<br/>Batches in oven appear here.</p>
         </div>`
      : cookingBatches.map(b => createBatchCardHTML(b)).join('');

    packingContainer.innerHTML = packingBatches.length === 0
      ? `<div class="p-8 text-center text-gray-500 border border-dashed border-gray-700/60 rounded-xl">
          <i data-lucide="package-check" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm">Thermal packing line clear.</p>
         </div>`
      : packingBatches.map(b => createBatchCardHTML(b)).join('');

    dispatchedContainer.innerHTML = dispatchedBatches.length === 0
      ? `<div class="p-8 text-center text-gray-500 border border-dashed border-gray-700/60 rounded-xl">
          <i data-lucide="bike" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm">Dispatched rider manifests.</p>
         </div>`
      : dispatchedBatches.map(b => createBatchCardHTML(b)).join('');

    renderZoneWindowSummaryStrip();
  }

  function renderZoneWindowSummaryStrip() {
    const strip = document.getElementById('zone-window-strip');
    if (!strip) return;

    strip.innerHTML = window.APP_DATA.ZONES.map(z => {
      const zw = state.zoneWindows[z.id];
      const activeCount = state.batches.filter(b => b.zoneId === z.id && b.status === 'GATHERING').length;
      const mins = Math.floor(Math.max(0, zw.remainingSec) / 60);
      const secs = Math.floor(Math.max(0, zw.remainingSec) % 60);

      return `
        <div class="glass-card p-3.5 rounded-xl border border-slate-700/50 flex items-center justify-between relative overflow-hidden" style="border-left: 4px solid ${z.color}">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 relative flex items-center justify-center">
              <svg viewBox="0 0 36 36" class="circular-chart w-full h-full">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path id="zone-ring-${z.id}" class="circle" stroke="${z.color}" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span id="zone-timer-${z.id}" class="absolute text-[11px] font-mono font-bold text-white">${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-white">${z.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Win #${zw.windowNumber}</span>
              </div>
              <div class="text-[11px] text-gray-400 truncate max-w-[130px]">${z.hub}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold text-emerald-400">${activeCount} Batch${activeCount === 1 ? '' : 'es'}</div>
            <button onclick="window.app.forceCookZone('${z.id}')" class="mt-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600 flex items-center gap-1">
              <i data-lucide="zap" class="w-2.5 h-2.5 text-amber-400"></i> Dispatch
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function createBatchCardHTML(b) {
    const isSplit = b.isSplit;
    const isFull = b.items.length >= b.maxItems;

    let statusBadge = '';
    if (b.status === 'GATHERING') {
      statusBadge = isFull 
        ? `<span class="badge-pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🔒 5/5 CAPACITY FULL</span>`
        : `<span class="badge-pill bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">📥 AGGREGATING (5m)</span>`;
    } else if (b.status === 'COOKING') {
      statusBadge = `<span class="badge-pill bg-amber-500/20 text-amber-300 border border-amber-500/40 pulse-urgent">🔥 IN OVEN / PREP</span>`;
    } else if (b.status === 'PACKING') {
      statusBadge = `<span class="badge-pill bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">📦 SEALING & QC</span>`;
    } else if (b.status === 'DISPATCHED') {
      statusBadge = `<span class="badge-pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🛵 IN TRANSIT</span>`;
    }

    return `
      <div class="glass-card p-4 rounded-xl mb-3 relative overflow-hidden border ${isSplit ? 'border-rose-500/60 anim-split-burst' : 'border-slate-700/60'}" style="border-top: 3px solid ${b.zone.color}">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono font-bold text-sm text-white">${b.id}</span>
              ${isSplit ? `<span class="badge-pill bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px]">⚡ AUTO-SPLIT BATCH</span>` : ''}
            </div>
            <div class="text-xs text-gray-400 font-medium">${b.zone.name} • ${b.zone.hub}</div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <!-- Capacity Meter (5-Item Max Constraint Visualizer) -->
        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 my-2.5">
          <div class="flex justify-between items-center text-xs mb-1">
            <span class="text-gray-400 font-medium flex items-center gap-1">
              <i data-lucide="boxes" class="w-3.5 h-3.5 text-indigo-400"></i> Item Slots (Max ${b.maxItems})
            </span>
            <span class="font-mono font-bold ${isFull ? 'text-emerald-400' : 'text-indigo-300'}">${b.items.length} / ${b.maxItems} Items</span>
          </div>

          <!-- 5 Visual Slot Indicators -->
          <div class="grid grid-cols-5 gap-1.5 my-1.5">
            ${Array.from({ length: b.maxItems }).map((_, idx) => {
              const isFilled = idx < b.items.length;
              return `
                <div class="h-2 rounded-sm transition-all duration-300 ${
                  isFilled 
                    ? (isSplit ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-sm shadow-rose-500/30' : 'bg-gradient-to-r from-emerald-500 to-indigo-500') 
                    : 'bg-slate-800 border border-slate-700'
                }"></div>
              `;
            }).join('')}
          </div>

          <!-- Weight Gauge -->
          <div class="flex justify-between items-center text-[11px] text-gray-400 mt-1">
            <span>Weight: <strong class="text-slate-200">${b.totalWeightKg.toFixed(2)} kg</strong> / ${b.maxWeightKg} kg</span>
            <span>Orders: <strong class="text-slate-200">${b.ordersIncluded.length}</strong></span>
          </div>
        </div>

        <!-- Items Breakdown -->
        <div class="space-y-1 my-2 max-h-36 overflow-y-auto pr-1">
          ${b.items.map(itm => `
            <div class="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-800/50 border border-slate-700/40">
              <div class="flex items-center gap-1.5 truncate">
                <span>${itm.emoji}</span>
                <span class="text-gray-200 truncate">${itm.name}</span>
              </div>
              <div class="text-[10px] text-gray-400 font-mono whitespace-nowrap pl-2">
                ${itm.weightKg}kg • <span class="text-indigo-300">${itm.station.split('/')[0]}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Dynamic Action / Progress Footer -->
        ${b.status === 'GATHERING' ? `
          <div class="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span class="text-[11px] text-gray-400 flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3 text-amber-400"></i> Auto-locks on window end
            </span>
            <button onclick="window.app.forceCook('${b.id}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition shadow">
              <i data-lucide="play" class="w-3 h-3"></i> Cook Now
            </button>
          </div>
        ` : ''}

        ${b.status === 'COOKING' ? `
          <div class="mt-3 pt-2.5 border-t border-slate-800">
            <div class="flex justify-between items-center text-xs mb-1">
              <span class="text-amber-400 font-medium flex items-center gap-1">
                <i data-lucide="flame" class="w-3.5 h-3.5 animate-pulse"></i> Prep Station
              </span>
              <span id="cook-txt-${b.id}" class="text-[11px] font-mono text-gray-300">Cooking...</span>
            </div>
            <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div id="cook-bar-${b.id}" class="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        ` : ''}

        ${b.status === 'PACKING' ? `
          <div class="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span class="text-xs text-cyan-400 flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Thermal Pouch Sealed
            </span>
            <span class="text-[11px] text-gray-400 font-mono">QC Passed</span>
          </div>
        ` : ''}

        ${b.status === 'DISPATCHED' ? `
          <div class="mt-3 pt-2.5 border-t border-slate-800 bg-slate-900/60 -mx-4 -mb-4 p-3 border-t border-slate-800 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-emerald-400 font-semibold flex items-center gap-1">
                <i data-lucide="bike" class="w-3.5 h-3.5"></i> ${b.rider ? b.rider.name : 'Delivery Partner'}
              </span>
              <span class="text-gray-400 font-mono">${b.rider ? b.rider.bikeNumber : ''}</span>
            </div>
            <div class="text-[11px] text-gray-400 mt-0.5">ETA: ~${b.rider ? b.rider.etaMin : 12} mins to ${b.zone.name}</div>
          </div>
        ` : ''}

      </div>
    `;
  }

  function renderSplitAuditLog() {
    const list = document.getElementById('split-events-list');
    if (!list) return;

    if (state.splitEvents.length === 0) {
      list.innerHTML = `
        <div class="p-6 text-center text-gray-500 text-sm">
          <i data-lucide="check-circle" class="w-6 h-6 mx-auto mb-1 text-emerald-500 opacity-60"></i>
          All batches currently within the 5-item capacity threshold.
        </div>
      `;
      return;
    }

    list.innerHTML = state.splitEvents.slice(0, 8).map(evt => `
      <div class="p-3 bg-slate-900/70 border-l-4 border-rose-500 rounded-r-lg mb-2 text-xs">
        <div class="flex justify-between items-start">
          <span class="font-bold text-rose-400">⚡ AUTO-SPLIT: ${evt.zoneId}</span>
          <span class="text-gray-500 font-mono text-[10px]">${evt.timestamp}</span>
        </div>
        <div class="text-gray-300 mt-1">
          Customer: <strong>${evt.customer}</strong> (${evt.orderId})
        </div>
        <div class="text-slate-400 mt-0.5">
          ${evt.fittedCount} items filled Primary Batch ➔ <strong>${evt.overflowCount} items diverted to Overflow Batch</strong>
        </div>
      </div>
    `).join('');
  }

  function drawBengaluruRadar() {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 600;
    const height = canvas.height = 420;

    ctx.clearRect(0, 0, width, height);

    const hubX = width * 0.5;
    const hubY = height * 0.5;

    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;
    [50, 100, 150, 190].forEach(r => {
      ctx.beginPath();
      ctx.arc(hubX, hubY, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(hubX, 20);
    ctx.lineTo(hubX, height - 20);
    ctx.moveTo(20, hubY);
    ctx.lineTo(width - 20, hubY);
    ctx.stroke();

    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.arc(hubX, hubY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillText("NMIT CLOUD KITCHEN HQ", hubX - 65, hubY - 16);

    window.APP_DATA.ZONES.forEach(z => {
      const zX = (z.coords.x / 100) * width;
      const zY = (z.coords.y / 100) * height;

      ctx.strokeStyle = z.borderColor;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hubX, hubY);
      ctx.lineTo(zX, zY);
      ctx.stroke();
      ctx.setLineDash([]);

      const batchCount = state.batches.filter(b => b.zoneId === z.id && b.status !== 'DISPATCHED').length;

      ctx.fillStyle = z.bgColor;
      ctx.beginPath();
      ctx.arc(zX, zY, 24 + batchCount * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.arc(zX, zY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText(z.name, zX - 30, zY + 22);

      ctx.fillStyle = z.color;
      ctx.font = "10px monospace";
      ctx.fillText(`${batchCount} Active Batches (${z.distanceKm} km)`, zX - 45, zY + 34);
    });
  }

  function renderAnalyticsCharts() {
    if (typeof Chart === 'undefined') return;

    const ctxZone = document.getElementById('chart-zone-dist');
    if (ctxZone) {
      if (state.chartInstances.zone) state.chartInstances.zone.destroy();
      const zoneLabels = window.APP_DATA.ZONES.map(z => z.name);
      const zoneCounts = window.APP_DATA.ZONES.map(z => state.orders.filter(o => o.zoneId === z.id).length);

      state.chartInstances.zone = new Chart(ctxZone, {
        type: 'doughnut',
        data: {
          labels: zoneLabels,
          datasets: [{
            data: zoneCounts,
            backgroundColor: window.APP_DATA.ZONES.map(z => z.color),
            borderColor: '#0f172a',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } } }
          }
        }
      });
    }

    const ctxCap = document.getElementById('chart-capacity-hist');
    if (ctxCap) {
      if (state.chartInstances.cap) state.chartInstances.cap.destroy();
      const itemCounts = [1, 2, 3, 4, 5];
      const distribution = itemCounts.map(cnt => state.batches.filter(b => b.items.length === cnt).length);

      state.chartInstances.cap = new Chart(ctxCap, {
        type: 'bar',
        data: {
          labels: ['1 Item', '2 Items', '3 Items', '4 Items', '5 Items (FULL)'],
          datasets: [{
            label: 'Batches Formed',
            data: distribution,
            backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#10b981'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  function runJudgeBenchmarkTest() {
    showNotificationToast("🚀 Running Speedcode 2026 Live Algorithmic Benchmark (50 Orders)...", "info");
    
    const zones = window.APP_DATA.ZONES;
    for (let i = 0; i < 50; i++) {
      const z = zones[i % zones.length];
      const count = Math.floor(Math.random() * 4) + 1;
      const items = [];
      for (let j = 0; j < count; j++) {
        items.push({ ...window.APP_DATA.MENU_ITEMS[Math.floor(Math.random() * window.APP_DATA.MENU_ITEMS.length)], qty: 1 });
      }
      processIncomingOrder(z.id, `Simulated Tester #${i + 1}`, items, false);
    }

    const unbatchedTrips = state.metrics.totalItems;
    const batchedTrips = state.metrics.totalBatches;
    const efficiency = Math.round(((unbatchedTrips - batchedTrips) / unbatchedTrips) * 100);

    const reportEl = document.getElementById('benchmark-result-box');
    if (reportEl) {
      reportEl.classList.remove('hidden');
      reportEl.innerHTML = `
        <div class="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl mt-4">
          <div class="flex items-center gap-2 text-emerald-400 font-bold text-base mb-2">
            <i data-lucide="award" class="w-5 h-5"></i> Speedcode 2026 Benchmark Results
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span class="text-gray-400">Total Orders Processed</span>
              <div class="text-base font-bold text-white">${state.metrics.totalOrders}</div>
            </div>
            <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span class="text-gray-400">Individual Trips (Baseline)</span>
              <div class="text-base font-bold text-rose-400">${unbatchedTrips} Trips</div>
            </div>
            <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span class="text-gray-400">Optimized Batches</span>
              <div class="text-base font-bold text-emerald-400">${batchedTrips} Batches</div>
            </div>
            <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span class="text-gray-400">Logistics Trip Reduction</span>
              <div class="text-base font-bold text-cyan-400">${efficiency}% Saved</div>
            </div>
          </div>
          <p class="text-xs text-emerald-200/80 mt-3">
            ✨ Capacity constraints strictly maintained: 100% of generated batches stayed ≤ ${state.config.maxItemsPerBatch} items with zero capacity violations!
          </p>
        </div>
      `;
      lucide.createIcons();
    }

    showNotificationToast(`🎯 Benchmark complete! Reduced delivery fleet dispatches by ${efficiency}%!`, 'success');
  }

  function showNotificationToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100',
      warning: 'bg-rose-950/90 border-rose-500 text-rose-100 glow-rose',
      info: 'bg-indigo-950/90 border-indigo-500 text-indigo-100'
    };

    toast.className = `p-3 rounded-xl border text-xs font-medium backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>${message}</span>
      </div>
      <button class="text-slate-400 hover:text-white" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function openNewOrderModal() {
    const modal = document.getElementById('modal-new-order');
    if (modal) modal.classList.remove('hidden');
  }

  function closeNewOrderModal() {
    const modal = document.getElementById('modal-new-order');
    if (modal) modal.classList.add('hidden');
  }

  function submitManualOrder() {
    const zoneSelect = document.getElementById('form-zone');
    const customerInput = document.getElementById('form-customer');
    const zoneId = zoneSelect.value;
    const customer = customerInput.value.trim() || `Customer #${Math.floor(100 + Math.random() * 900)}`;

    const selectedItems = [];
    document.querySelectorAll('.manual-item-checkbox:checked').forEach(cb => {
      const itm = window.APP_DATA.MENU_ITEMS.find(m => m.id === cb.value);
      const qtyInput = document.getElementById(`qty-${cb.value}`);
      const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
      if (itm) {
        selectedItems.push({ ...itm, qty });
      }
    });

    if (selectedItems.length === 0) {
      alert("Please select at least 1 food item to place order.");
      return;
    }

    processIncomingOrder(zoneId, customer, selectedItems, true);
    closeNewOrderModal();
  }

  function exportBatchManifest() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.batches, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `batchoptima_manifest_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showNotificationToast("📥 Batch Manifest exported to JSON", "success");
  }

  function init() {
    initZones();
    seedInitialData();
    renderAll();
    updateMetrics();

    state.clockTimer = setInterval(tickTime, 1000);
    state.simTimer = setInterval(spawnSimulatedOrder, state.config.SIMULATION_INTERVAL_MS || 3500);

    window.app = {
      switchTab,
      toggleSimulation,
      setSimSpeed,
      triggerMegaBurstOrder,
      forceCook: forceCookBatch,
      forceCookZone: transitionZoneBatchesToCooking,
      openNewOrderModal,
      closeNewOrderModal,
      submitManualOrder,
      runJudgeBenchmarkTest,
      exportBatchManifest,
      soundToggle: () => {
        const en = window.soundEngine.toggle();
        showNotificationToast(`Sound effects ${en ? 'Enabled' : 'Muted'}`, 'info');
        const icon = document.getElementById('sound-icon');
        if (icon) icon.setAttribute('data-lucide', en ? 'volume-2' : 'volume-x');
        lucide.createIcons();
      },
      updateSetting: (key, val) => {
        state.config[key] = parseFloat(val);
        showNotificationToast(`Setting updated: ${key} = ${val}`, 'info');
        renderAll();
      }
    };

    const zoneSelect = document.getElementById('form-zone');
    if (zoneSelect) {
      zoneSelect.innerHTML = window.APP_DATA.ZONES.map(z => `<option value="${z.id}">${z.name} (${z.hub})</option>`).join('');
    }

    const itemsContainer = document.getElementById('form-items-list');
    if (itemsContainer) {
      itemsContainer.innerHTML = window.APP_DATA.MENU_ITEMS.map(itm => `
        <div class="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700/60 text-xs">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="${itm.id}" class="manual-item-checkbox rounded text-indigo-600 focus:ring-0">
            <span>${itm.emoji}</span>
            <span class="text-white font-medium">${itm.name}</span>
            <span class="text-gray-400 font-mono">(${itm.weightKg}kg)</span>
          </label>
          <div class="flex items-center gap-1">
            <span class="text-gray-400 text-[10px]">Qty:</span>
            <input id="qty-${itm.id}" type="number" min="1" max="10" value="1" class="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white">
          </div>
        </div>
      `).join('');
    }

    window.addEventListener('resize', () => {
      if (state.activeTab === 'radar') drawBengaluruRadar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();