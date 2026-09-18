/**
 * Glow Beauty Salon - Official Website Concierge & Booking Widget
 *
 * Self-contained, cross-origin embeddable widget for GitHub Pages, WordPress, Wix, Squarespace, and custom HTML sites.
 * Features:
 * - Native DOM Rendering (Zero-iframe dependency; immune to CSP frame-ancestors & cookie blocks)
 * - Chloe AI Concierge with complete salon service knowledge & lead capture
 * - Direct REST API integration with fallback client-side intelligence
 * - Responsive desktop & mobile support with smooth animations
 */
(function () {
  'use strict';

  // Prevent multiple initializations if the tag is loaded multiple times
  if (window.__GLOW_SALON_WIDGET_INITIALIZED__) {
    return;
  }
  window.__GLOW_SALON_WIDGET_INITIALIZED__ = true;

  // 1. Locate current script tag and read configuration
  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i];
      if (s.src && (s.src.indexOf('widget.js') !== -1 || s.getAttribute('data-salon-widget') === 'true')) {
        currentScript = s;
        break;
      }
    }
  }

  var scriptSrc = currentScript ? currentScript.src : '';

  // Host API origin resolution
  var explicitAppUrl = (
    (currentScript && (
      currentScript.getAttribute('data-app-url') ||
      currentScript.getAttribute('data-origin') ||
      currentScript.getAttribute('data-salon-url')
    )) ||
    window.GLOW_SALON_APP_URL ||
    window.GLOW_SALON_ORIGIN ||
    ''
  );

  var appOrigin = '';
  if (explicitAppUrl) {
    try {
      appOrigin = new URL(explicitAppUrl, window.location.href).origin;
    } catch (e) {
      appOrigin = explicitAppUrl.replace(/\/+$/, '');
    }
  }

  if (!appOrigin && scriptSrc) {
    try {
      var parsedUrl = new URL(scriptSrc, window.location.href);
      // Avoid using self origin if running from an unrelated static site like github.io unless explicitly intended
      if (parsedUrl.hostname !== 'glow-beauty-salon.run.app' && !parsedUrl.hostname.includes('github.io')) {
        appOrigin = parsedUrl.origin;
      }
    } catch (e) {}
  }

  // Customization options from data attributes
  var primaryColor = (currentScript && currentScript.getAttribute('data-primary-color')) || '#8E2D3B';
  var position = (currentScript && currentScript.getAttribute('data-position')) || 'right';
  var buttonText = (currentScript && currentScript.getAttribute('data-button-text')) || 'Chat & Book';
  var autoOpen = currentScript && currentScript.getAttribute('data-auto-open') === 'true';
  var salonName = (currentScript && currentScript.getAttribute('data-salon-name')) || 'Glow Beauty Salon';
  var isPositionLeft = position === 'left';

  // Customer ID Management for isolated sessions
  function getCustomerId() {
    try {
      var cid = localStorage.getItem('glow_widget_customer_id');
      if (!cid) {
        cid = 'cust_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('glow_widget_customer_id', cid);
      }
      return cid;
    } catch (e) {
      return 'cust_guest_' + Math.random().toString(36).substring(2, 7);
    }
  }
  var customerId = getCustomerId();

  // Salon Knowledge Base for reliable, instant responses (Matches Glow Beauty Salon specifications)
  var SALON_INFO = {
    name: 'Glow Beauty Salon',
    phone: '+1 (555) 345-6789',
    whatsapp: '+1 (555) 345-6789',
    email: 'hello@glowbeautysalon.com',
    address: '142 Elegance Blvd, Suite 200, Beverly Hills, CA 90210',
    hours: 'Monday – Saturday: 9:00 AM – 7:30 PM | Sunday: 10:00 AM – 5:00 PM',
  };

  var INITIAL_GREETING = {
    id: 'msg-welcome',
    sender: 'assistant',
    text: '👋 Welcome to **' + salonName + '**! How can we help you today?\n\nI can assist you with our services, prices, bridal packages, hours, or help you book an appointment.',
    timestamp: 'Just now'
  };

  var QUICK_ACTIONS = [
    { label: '📅 Book an Appointment', query: 'I would like to book an appointment. How do I request a chair slot?' },
    { label: '✂️ Hair Styling & Color', query: 'What hair services and haircuts do you offer, and what are the prices?' },
    { label: '✨ Facials & Skincare', query: 'Tell me about your signature facials, skincare treatments, and prices.' },
    { label: '💅 Nail Studio', query: 'What are your manicure, pedicure, and nail art options and pricing?' },
    { label: '👑 Bridal Packages', query: 'What bridal packages do you offer for weddings, and what is included?' },
    { label: '🏷️ Prices & Offers', query: 'What are your latest promotions, discounts, and service price ranges?' },
    { label: '🕒 Opening Hours & Location', query: 'What are your salon opening hours and where are you located?' }
  ];

  // In-memory conversation state
  var messages = [INITIAL_GREETING];
  var isOpen = false;
  var isExpanded = false;
  var isTyping = false;

  // 2. Inject Scoped CSS Styles
  var styleTag = document.createElement('style');
  styleTag.id = 'glow-salon-widget-style';
  styleTag.textContent = `
    #glow-widget-root {
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    #glow-widget-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Floating Launcher Button */
    .glow-launcher-btn {
      position: fixed;
      bottom: 24px;
      ${isPositionLeft ? 'left: 24px;' : 'right: 24px;'}
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px 12px 14px;
      border-radius: 9999px;
      background: ${primaryColor};
      color: #FAF2EE;
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 10px 28px rgba(142, 45, 59, 0.38), 0 2px 8px rgba(0, 0, 0, 0.14);
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, background-color 0.2s ease;
      text-decoration: none;
      outline: none;
    }
    .glow-launcher-btn:hover {
      transform: scale(1.04);
      background: #78232F;
      box-shadow: 0 14px 32px rgba(142, 45, 59, 0.45), 0 4px 12px rgba(0, 0, 0, 0.16);
    }
    .glow-launcher-btn:active {
      transform: scale(0.96);
    }

    .glow-launcher-crest {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .glow-launcher-crest svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: #FAF2EE;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .glow-pulse-dot {
      position: absolute;
      top: -1px;
      right: -1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10B981;
      border: 2px solid ${primaryColor};
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
    }

    .glow-launcher-text {
      text-align: left;
      line-height: 1.25;
    }
    .glow-launcher-title {
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #FFFFFF;
      display: block;
    }
    .glow-launcher-sub {
      font-size: 11px;
      color: #F8D7DA;
      font-weight: 500;
      display: block;
    }

    /* Floating Chat Box Container */
    .glow-chat-card {
      position: fixed;
      bottom: 86px;
      ${isPositionLeft ? 'left: 24px;' : 'right: 24px;'}
      z-index: 2147483646;
      width: 420px;
      height: 620px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 104px);
      border-radius: 20px;
      overflow: hidden;
      background: #FAF8F5;
      border: 1px solid rgba(220, 210, 200, 0.95);
      box-shadow: 0 20px 50px rgba(28, 24, 22, 0.24), 0 4px 16px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
      transform: translateY(20px) scale(0.96);
      transform-origin: ${isPositionLeft ? 'bottom left' : 'bottom right'};
      transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
                  visibility 0.24s,
                  width 0.24s ease,
                  height 0.24s ease;
    }

    .glow-chat-card.glow-open {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
      transform: translateY(0) scale(1);
    }

    .glow-chat-card.glow-expanded {
      width: min(800px, calc(100vw - 32px));
      height: min(740px, calc(100vh - 104px));
    }

    /* Chat Header */
    .glow-header {
      background: #8E2D3B;
      color: #FAF2EE;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      flex-shrink: 0;
    }
    .glow-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .glow-avatar-badge {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #78232F, #B83B4D);
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .glow-avatar-badge svg {
      width: 20px;
      height: 20px;
      color: #FAF2EE;
    }
    .glow-header-title {
      font-size: 14px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .glow-header-sub {
      font-size: 11px;
      color: #F8D7DA;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }
    .glow-live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10B981;
      display: inline-block;
    }
    .glow-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .glow-icon-btn {
      background: transparent;
      border: none;
      color: #F8D7DA;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    .glow-icon-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #FFFFFF;
    }
    .glow-icon-btn svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
      stroke: currentColor;
      fill: none;
    }

    /* Message Stream */
    .glow-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #FAF8F5;
      scroll-behavior: smooth;
    }
    .glow-msg-row {
      display: flex;
      gap: 10px;
      max-width: 88%;
      animation: glowFadeIn 0.2s ease forwards;
    }
    .glow-msg-user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .glow-msg-bot {
      align-self: flex-start;
    }
    .glow-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #8E2D3B;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .glow-msg-avatar svg {
      width: 15px;
      height: 15px;
      stroke-width: 2;
      stroke: currentColor;
      fill: none;
    }
    .glow-bubble {
      padding: 12px 14px;
      font-size: 13.5px;
      line-height: 1.5;
      color: #1C1816;
      border-radius: 16px;
      position: relative;
      word-break: break-word;
    }
    .glow-msg-user .glow-bubble {
      background: #8E2D3B;
      color: #FFFFFF;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 12px rgba(142, 45, 59, 0.2);
    }
    .glow-msg-bot .glow-bubble {
      background: #FFFFFF;
      border: 1px solid #EAE3DB;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .glow-msg-time {
      font-size: 10px;
      color: #8C827A;
      margin-top: 4px;
      text-align: right;
    }
    .glow-msg-user .glow-msg-time {
      color: rgba(255, 255, 255, 0.7);
    }

    /* Markdown styling inside bubble */
    .glow-bubble strong, .glow-bubble b {
      font-weight: 600;
      color: inherit;
    }
    .glow-bubble p {
      margin-bottom: 8px;
    }
    .glow-bubble p:last-child {
      margin-bottom: 0;
    }
    .glow-bubble ul {
      margin-left: 18px;
      margin-top: 4px;
      margin-bottom: 6px;
    }
    .glow-bubble li {
      margin-bottom: 3px;
    }

    /* Lead Confirmation Card */
    .glow-lead-card {
      background: #FDF9F7;
      border: 1.5px solid #8E2D3B;
      border-radius: 14px;
      padding: 14px;
      margin-top: 8px;
      font-size: 12.5px;
      color: #2D2725;
      box-shadow: 0 4px 12px rgba(142, 45, 59, 0.08);
    }
    .glow-lead-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #EED9DC;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .glow-lead-tag {
      background: #8E2D3B;
      color: white;
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .glow-lead-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .glow-lead-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .glow-lead-label {
      color: #786C66;
      font-weight: 500;
    }
    .glow-lead-val {
      font-weight: 600;
      color: #1C1816;
      text-align: right;
    }

    /* Booking Form Card in Chat */
    .glow-form-card {
      background: #FFFFFF;
      border: 1px solid #E2D7CE;
      border-radius: 14px;
      padding: 14px;
      margin-top: 8px;
    }
    .glow-form-title {
      font-size: 13px;
      font-weight: 700;
      color: #8E2D3B;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .glow-input-group {
      margin-bottom: 8px;
    }
    .glow-input-label {
      display: block;
      font-size: 11px;
      color: #554D49;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .glow-input-field {
      width: 100%;
      padding: 8px 10px;
      font-size: 12.5px;
      border: 1px solid #D8CFC8;
      border-radius: 8px;
      background: #FAF8F5;
      color: #1C1816;
      outline: none;
      font-family: inherit;
    }
    .glow-input-field:focus {
      border-color: #8E2D3B;
      background: #FFFFFF;
    }
    .glow-form-submit {
      width: 100%;
      background: #8E2D3B;
      color: white;
      border: none;
      padding: 9px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 6px;
      transition: background-color 0.15s;
    }
    .glow-form-submit:hover {
      background: #78232F;
    }

    /* Typing Indicator */
    .glow-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: #FFFFFF;
      border: 1px solid #EAE3DB;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      width: fit-content;
      margin-left: 38px;
    }
    .glow-dot {
      width: 6px;
      height: 6px;
      background: #8E2D3B;
      border-radius: 50%;
      opacity: 0.5;
      animation: glowBounce 1.2s infinite ease-in-out;
    }
    .glow-dot:nth-child(2) { animation-delay: 0.2s; }
    .glow-dot:nth-child(3) { animation-delay: 0.4s; }

    /* Quick Action Chips */
    .glow-quick-chips {
      padding: 8px 12px 6px 12px;
      background: #FAF8F5;
      border-top: 1px solid #EAE3DB;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
      -ms-overflow-style: none;
      flex-shrink: 0;
    }
    .glow-quick-chips::-webkit-scrollbar {
      display: none;
    }
    .glow-chip-btn {
      background: #FAF2EE;
      color: #8E2D3B;
      border: 1px solid #EED9DC;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .glow-chip-btn:hover {
      background: #8E2D3B;
      color: #FFFFFF;
      border-color: #8E2D3B;
    }

    /* Input Footer */
    .glow-footer {
      background: #FFFFFF;
      border-top: 1px solid #EAE3DB;
      padding: 12px 14px 10px 14px;
      flex-shrink: 0;
    }
    .glow-input-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #FAF8F5;
      border: 1.5px solid #E2D7CE;
      border-radius: 24px;
      padding: 4px 6px 4px 14px;
      transition: border-color 0.15s, background-color 0.15s;
    }
    .glow-input-box:focus-within {
      border-color: #8E2D3B;
      background: #FFFFFF;
    }
    .glow-chat-input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #1C1816;
      font-family: inherit;
    }
    .glow-send-btn {
      background: #8E2D3B;
      color: #FFFFFF;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.15s, transform 0.15s;
      flex-shrink: 0;
    }
    .glow-send-btn:hover {
      background: #78232F;
      transform: scale(1.05);
    }
    .glow-send-btn svg {
      width: 15px;
      height: 15px;
      stroke-width: 2.2;
      stroke: currentColor;
      fill: none;
    }
    .glow-footnote {
      text-align: center;
      font-size: 10px;
      color: #8C827A;
      margin-top: 6px;
    }

    @keyframes glowFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes glowBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Mobile view */
    @media (max-width: 520px) {
      .glow-launcher-btn {
        bottom: 16px;
        ${isPositionLeft ? 'left: 16px;' : 'right: 16px;'}
        padding: 10px 14px 10px 12px;
      }
      .glow-chat-card {
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
      }
    }
  `;
  document.head.appendChild(styleTag);

  // 3. Build DOM Tree
  var root = document.createElement('div');
  root.id = 'glow-widget-root';

  // Launcher Button
  var launcherBtn = document.createElement('button');
  launcherBtn.className = 'glow-launcher-btn';
  launcherBtn.type = 'button';
  launcherBtn.setAttribute('aria-label', 'Open ' + salonName + ' Concierge');
  launcherBtn.innerHTML = `
    <div class="glow-launcher-crest">
      <svg viewBox="0 0 24 24">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
      <span class="glow-pulse-dot" title="Online"></span>
    </div>
    <div class="glow-launcher-text">
      <span class="glow-launcher-title">${buttonText}</span>
      <span class="glow-launcher-sub">Chloe • Online</span>
    </div>
  `;

  // Chat Card
  var chatCard = document.createElement('div');
  chatCard.className = 'glow-chat-card';
  chatCard.setAttribute('role', 'dialog');
  chatCard.setAttribute('aria-label', salonName + ' Concierge');

  chatCard.innerHTML = `
    <!-- Header -->
    <div class="glow-header">
      <div class="glow-header-left">
        <div class="glow-avatar-badge">
          <svg viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
        </div>
        <div>
          <div class="glow-header-title">Chloe • AI Concierge</div>
          <div class="glow-header-sub">
            <span class="glow-live-dot"></span>
            <span>${salonName} • Beverly Hills</span>
          </div>
        </div>
      </div>
      <div class="glow-header-actions">
        <button type="button" class="glow-icon-btn glow-btn-reset" title="Clear chat history" aria-label="Reset chat">
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        </button>
        <button type="button" class="glow-icon-btn glow-btn-expand" title="Expand window" aria-label="Expand window">
          <svg class="glow-expand-icon" viewBox="0 0 24 24"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
        </button>
        <button type="button" class="glow-icon-btn glow-btn-close" title="Close concierge" aria-label="Close concierge">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
        </button>
      </div>
    </div>

    <!-- Message Stream -->
    <div class="glow-body" id="glow-messages-stream"></div>

    <!-- Typing Indicator -->
    <div class="glow-typing" id="glow-typing-indicator" style="display: none;">
      <span class="glow-dot"></span>
      <span class="glow-dot"></span>
      <span class="glow-dot"></span>
    </div>

    <!-- Quick Action Chips -->
    <div class="glow-quick-chips" id="glow-quick-chips"></div>

    <!-- Footer Input -->
    <div class="glow-footer">
      <form id="glow-chat-form" class="glow-input-box">
        <input
          type="text"
          id="glow-chat-input"
          class="glow-chat-input"
          placeholder="Ask about haircuts, facials, bridal packages, or book..."
          autocomplete="off"
        />
        <button type="submit" class="glow-send-btn" title="Send message" aria-label="Send">
          <svg viewBox="0 0 24 24"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
        </button>
      </form>
      <div class="glow-footnote">Instant Salon Confirmation • Front Desk: ${SALON_INFO.phone}</div>
    </div>
  `;

  root.appendChild(chatCard);
  root.appendChild(launcherBtn);

  // References to DOM components
  var streamEl = chatCard.querySelector('#glow-messages-stream');
  var chipsEl = chatCard.querySelector('#glow-quick-chips');
  var formEl = chatCard.querySelector('#glow-chat-form');
  var inputEl = chatCard.querySelector('#glow-chat-input');
  var typingEl = chatCard.querySelector('#glow-typing-indicator');
  var btnClose = chatCard.querySelector('.glow-btn-close');
  var btnReset = chatCard.querySelector('.glow-btn-reset');
  var btnExpand = chatCard.querySelector('.glow-btn-expand');

  // Format simple markdown into HTML
  function formatMarkdown(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold text **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Bullet points
    var lines = escaped.split('\n');
    var result = '';
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('• ') === 0 || line.indexOf('- ') === 0) {
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        result += '<li>' + line.substring(2) + '</li>';
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (line) {
          result += '<p>' + line + '</p>';
        }
      }
    }
    if (inList) result += '</ul>';
    return result;
  }

  // Render quick chips
  function renderQuickChips() {
    chipsEl.innerHTML = '';
    QUICK_ACTIONS.forEach(function (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'glow-chip-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        handleUserMessage(action.query);
      });
      chipsEl.appendChild(btn);
    });
  }

  // Render messages
  function renderMessages() {
    streamEl.innerHTML = '';
    messages.forEach(function (msg) {
      var row = document.createElement('div');
      row.className = 'glow-msg-row glow-msg-' + (msg.sender === 'user' ? 'user' : 'bot');

      var avatarHtml =
        msg.sender === 'assistant'
          ? `<div class="glow-msg-avatar"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div>`
          : '';

      var bubbleContent = formatMarkdown(msg.text);

      // If this message contains a booking confirmation card
      if (msg.bookingLead) {
        var lead = msg.bookingLead;
        bubbleContent += `
          <div class="glow-lead-card">
            <div class="glow-lead-header">
              <span class="glow-lead-tag">Booking Request Logged</span>
              <span style="font-weight:700; color:#8E2D3B;">ID: ${lead.id || 'GLW-' + Math.floor(Math.random() * 9000 + 1000)}</span>
            </div>
            <div class="glow-lead-grid">
              <div class="glow-lead-row"><span class="glow-lead-label">Client Name:</span><span class="glow-lead-val">${lead.clientName || lead.customerName}</span></div>
              <div class="glow-lead-row"><span class="glow-lead-label">Phone / WhatsApp:</span><span class="glow-lead-val">${lead.phone || lead.whatsapp}</span></div>
              <div class="glow-lead-row"><span class="glow-lead-label">Service:</span><span class="glow-lead-val">${lead.serviceName || lead.service}</span></div>
              <div class="glow-lead-row"><span class="glow-lead-label">Preferred Date:</span><span class="glow-lead-val">${lead.preferredDate}</span></div>
              <div class="glow-lead-row"><span class="glow-lead-label">Preferred Time:</span><span class="glow-lead-val">${lead.preferredTime}</span></div>
              ${lead.isBridal ? `<div class="glow-lead-row"><span class="glow-lead-label">Event:</span><span class="glow-lead-val">Bridal Party (${lead.bridalPackage || 'Selected'})</span></div>` : ''}
            </div>
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #EED9DC; font-size:11px; color:#78232F;">
              ✓ The salon team will call or WhatsApp you to confirm your chair slot.
            </div>
          </div>
        `;
      }

      // If this message is a prompt to book an appointment, provide 1-click Quick Booking Form
      if (msg.showBookingForm) {
        bubbleContent += `
          <div class="glow-form-card" id="form-${msg.id}">
            <div class="glow-form-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>
              <span>Quick Booking Request</span>
            </div>
            <div class="glow-input-group">
              <label class="glow-input-label">Full Name *</label>
              <input type="text" class="glow-input-field book-name" placeholder="e.g. Sarah Jenkins" required />
            </div>
            <div class="glow-input-group">
              <label class="glow-input-label">Phone or WhatsApp *</label>
              <input type="tel" class="glow-input-field book-phone" placeholder="e.g. +1 555-234-5678" required />
            </div>
            <div class="glow-input-group">
              <label class="glow-input-label">Service *</label>
              <select class="glow-input-field book-service">
                <option value="Balayage ($150+)">Balayage ($150+)</option>
                <option value="Women's Haircut ($35)">Women's Haircut ($35)</option>
                <option value="Blow Dry ($30)">Blow Dry ($30)</option>
                <option value="Glow Facial ($85)">Glow Facial ($85)</option>
                <option value="Hydrating Facial ($80)">Hydrating Facial ($80)</option>
                <option value="Gel Manicure ($45)">Gel Manicure ($45)</option>
                <option value="Gel Pedicure ($55)">Gel Pedicure ($55)</option>
                <option value="Beauty Combo: Facial + Mani + Pedi ($150)">Beauty Combo: Facial + Mani + Pedi ($150)</option>
                <option value="Bridal Package — Essential ($250)">Bridal Package — Essential ($250)</option>
                <option value="Bridal Package — Premium ($450)">Bridal Package — Premium ($450)</option>
                <option value="Bridal Package — Luxury ($650)">Bridal Package — Luxury ($650)</option>
              </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div class="glow-input-group">
                <label class="glow-input-label">Preferred Date *</label>
                <input type="text" class="glow-input-field book-date" placeholder="e.g. Saturday" required />
              </div>
              <div class="glow-input-group">
                <label class="glow-input-label">Preferred Time *</label>
                <input type="text" class="glow-input-field book-time" placeholder="e.g. 2:00 PM" required />
              </div>
            </div>
            <button type="button" class="glow-form-submit btn-submit-booking">Confirm Booking Request</button>
          </div>
        `;
      }

      row.innerHTML = `
        ${avatarHtml}
        <div>
          <div class="glow-bubble">${bubbleContent}</div>
          <div class="glow-msg-time">${msg.timestamp}</div>
        </div>
      `;

      streamEl.appendChild(row);

      // Attach booking form submission handler if rendered
      if (msg.showBookingForm) {
        var formContainer = row.querySelector('#form-' + msg.id);
        if (formContainer) {
          var submitBtn = formContainer.querySelector('.btn-submit-booking');
          submitBtn.addEventListener('click', function () {
            var nameVal = formContainer.querySelector('.book-name').value.trim();
            var phoneVal = formContainer.querySelector('.book-phone').value.trim();
            var serviceVal = formContainer.querySelector('.book-service').value;
            var dateVal = formContainer.querySelector('.book-date').value.trim();
            var timeVal = formContainer.querySelector('.book-time').value.trim();

            if (!nameVal || !phoneVal) {
              alert('Please enter your name and phone number so the salon can confirm your booking.');
              return;
            }

            var promptText = 'Booking request: ' + nameVal + ', ' + phoneVal + ', ' + serviceVal + ', ' + (dateVal || 'Upcoming date') + ', ' + (timeVal || 'Preferred time');
            handleUserMessage(promptText, {
              clientName: nameVal,
              phone: phoneVal,
              serviceName: serviceVal,
              preferredDate: dateVal || 'Upcoming date',
              preferredTime: timeVal || 'Preferred time'
            });
          });
        }
      }
    });

    streamEl.scrollTop = streamEl.scrollHeight;
  }

  // Client-side salon intelligence engine (Ensures 100% reliability on GitHub Pages, offline, or CORS-restricted sites)
  function computeSalonReply(userQuery, explicitLead) {
    var q = userQuery.toLowerCase();

    // 1. Medical / Dermatology disclaimer
    if (
      q.includes('infection') ||
      q.includes('allergic reaction') ||
      q.includes('allergy') ||
      q.includes('severe rash') ||
      q.includes('dermatitis') ||
      q.includes('eczema') ||
      q.includes('doctor')
    ) {
      return {
        reply: `Our facial and skincare treatments are strictly wellness and beauty services. I am an AI assistant and not a medical professional, so I cannot diagnose skin conditions or recommend treatments for medical concerns.\n\nIf you are experiencing severe irritation, allergic reaction, or infection, we recommend consulting a healthcare professional. Once cleared, our team would love to welcome you! Feel free to call our desk at **${SALON_INFO.phone}**.`,
      };
    }

    // 2. Lead booking extraction
    var phoneMatch = userQuery.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    var emailMatch = userQuery.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    var isBookingAttempt =
      explicitLead ||
      phoneMatch ||
      (q.includes('book') && (q.includes('name') || q.includes('phone') || q.includes('saturday') || q.includes('tomorrow') || q.includes('pm') || q.includes('am')));

    if (isBookingAttempt) {
      var clientName = explicitLead ? explicitLead.clientName : 'Valued Guest';
      var phone = explicitLead ? explicitLead.phone : (phoneMatch ? phoneMatch[0] : '+1 555-123-4567');
      var email = emailMatch ? emailMatch[0] : (explicitLead ? explicitLead.email : '');
      var serviceName = explicitLead ? explicitLead.serviceName : 'Hair & Beauty Consultation';
      var preferredDate = explicitLead ? explicitLead.preferredDate : 'Upcoming Date';
      var preferredTime = explicitLead ? explicitLead.preferredTime : 'Afternoon';

      if (!explicitLead) {
        var nameMatch = userQuery.match(/(?:my name is|i am|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (nameMatch) clientName = nameMatch[1];

        if (q.includes('balayage')) serviceName = 'Balayage ($150+)';
        else if (q.includes('haircut') || q.includes('cut')) serviceName = "Women's Haircut ($35)";
        else if (q.includes('glow facial')) serviceName = 'Glow Facial ($85)';
        else if (q.includes('facial')) serviceName = 'Classic Facial ($60)';
        else if (q.includes('pedicure')) serviceName = 'Gel Pedicure ($55)';
        else if (q.includes('manicure')) serviceName = 'Gel Manicure ($45)';
        else if (q.includes('bridal') || q.includes('wedding')) serviceName = 'Bridal Package — Premium ($450+)';

        if (q.includes('tomorrow')) preferredDate = 'Tomorrow';
        else if (q.includes('saturday')) preferredDate = 'Saturday';
        else if (q.includes('friday')) preferredDate = 'Friday';
        else if (q.includes('sunday')) preferredDate = 'Sunday';

        var timeMatch = userQuery.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
        if (timeMatch) preferredTime = timeMatch[1];
      }

      var isBridal = serviceName.toLowerCase().includes('bridal') || q.includes('wedding');

      var leadObj = {
        id: 'GLW-' + Math.floor(Math.random() * 90000 + 10000),
        clientName: clientName,
        customerName: clientName,
        phone: phone,
        whatsapp: phone,
        email: email,
        serviceName: serviceName,
        service: serviceName,
        preferredDate: preferredDate,
        preferredTime: preferredTime,
        isBridal: isBridal,
        bridalPackage: isBridal ? serviceName : '',
        status: 'pending_confirmation',
        submittedAt: new Date().toISOString()
      };

      // Save lead locally
      try {
        var existing = JSON.parse(localStorage.getItem('glow_saved_leads') || '[]');
        existing.unshift(leadObj);
        localStorage.setItem('glow_saved_leads', JSON.stringify(existing));
      } catch (e) {}

      return {
        reply: `Thank you, **${clientName}**! Your appointment request has been logged:\n\n• **Client:** ${clientName}\n• **Phone / WhatsApp:** ${phone}\n• **Service:** ${serviceName}\n• **Preferred Date:** ${preferredDate}\n• **Preferred Time:** ${preferredTime}\n\n**Your booking request has been received. The salon team will confirm availability.**\n\nOur salon coordinator will contact you shortly to confirm your chair slot! If you need urgent assistance, please call **${SALON_INFO.phone}**.`,
        bookingLead: leadObj
      };
    }

    // 3. Hair Services
    if (q.includes('hair') || q.includes('cut') || q.includes('balayage') || q.includes('blow') || q.includes('color') || q.includes('keratin')) {
      return {
        reply: `Here are our popular hair services at **${salonName}**:\n\n• **Women's Haircut:** $35 (Includes wash, cut, & styling)\n• **Blow Dry & Styling:** $30\n• **Balayage & Ombré:** $150+ (Custom hand-painted highlights)\n• **Full Hair Color:** $95+\n• **Highlights / Lowlights:** $120+\n• **Keratin Smoothing Treatment:** $180+\n\nWould you like to reserve a chair with our master stylists? Click **Book an Appointment** or reply with your preferred day!`,
        showBookingForm: true
      };
    }

    // 4. Facials & Skincare
    if (q.includes('facial') || q.includes('skin') || q.includes('hydrating') || q.includes('glow facial') || q.includes('peel')) {
      return {
        reply: `Here are our signature facials & skincare treatments:\n\n• **Signature Glow Facial:** $85 (Deep cleansing, radiance serum, and jade rolling)\n• **Hydrating Moisture Infusion:** $80 (Hyaluronic acid plumping mask)\n• **Classic European Facial:** $60\n• **Anti-Aging Collagen Facial:** $110\n\nAll treatments use organic, cruelty-free botanical products. Would you like to book a facial?`,
        showBookingForm: true
      };
    }

    // 5. Nail Studio
    if (q.includes('nail') || q.includes('mani') || q.includes('pedi') || q.includes('gel')) {
      return {
        reply: `Here are our nail studio offerings:\n\n• **Gel Manicure:** $45 (Long-lasting LED cured gel polish)\n• **Gel Pedicure:** $55 (Exfoliating scrub, massage, & gel polish)\n• **Classic Manicure & Pedicure Combo:** $75\n• **Custom Nail Art:** $15+\n\nWould you like to schedule nail care today?`,
        showBookingForm: true
      };
    }

    // 6. Bridal Packages
    if (q.includes('bridal') || q.includes('wedding') || q.includes('bride')) {
      return {
        reply: `We offer three bespoke luxury **Bridal Packages**:\n\n1. **Essential Bridal ($250):** Bridal hair styling, bridal makeup with trial, and classic manicure.\n2. **Premium Bridal ($450):** Hair styling + trial, HD airbrush makeup + trial, deluxe facial 3 days prior, and gel mani & pedi.\n3. **Luxury Royal Bridal ($650):** Hair & luxury makeup, pre-wedding skin detox, VIP private suite, complimentary champagne, plus styling for Maid of Honor.\n\nBridal trials are highly recommended 3–4 weeks before your big day. Would you like to schedule a bridal consultation?`,
        showBookingForm: true
      };
    }

    // 7. Prices & Offers
    if (q.includes('price') || q.includes('cost') || q.includes('offer') || q.includes('discount') || q.includes('promo')) {
      return {
        reply: `Here are our current specials at **${salonName}**:\n\n• **Glow Welcome Special:** 10% OFF your first visit for all new clients!\n• **Beauty Trio Combo:** Facial + Gel Manicure + Gel Pedicure for **$150** (Save $30)\n• **Bridal Party Savings:** 15% discount for wedding parties of 4 or more.\n\nMention code **GLOW10** when booking to apply your welcome discount!`,
        showBookingForm: true
      };
    }

    // 8. Hours & Location
    if (q.includes('hour') || q.includes('open') || q.includes('time') || q.includes('location') || q.includes('where') || q.includes('address')) {
      return {
        reply: `**Opening Hours & Location**:\n\n• **Address:** ${SALON_INFO.address}\n• **Phone:** ${SALON_INFO.phone}\n• **Email:** ${SALON_INFO.email}\n\n**Hours of Operation**:\n• **Monday – Saturday:** 9:00 AM – 7:30 PM\n• **Sunday:** 10:00 AM – 5:00 PM\n\nWalk-ins are welcomed based on stylist availability, but appointments are recommended!`,
      };
    }

    // 9. Booking request
    if (q.includes('book') || q.includes('appointment') || q.includes('schedule') || q.includes('reserve')) {
      return {
        reply: `We'd love to have you at **${salonName}**! 💕\n\nYou can use the quick booking form below, or simply reply with your:\n1. **Full Name**\n2. **Phone Number**\n3. **Service**\n4. **Preferred Date & Time**`,
        showBookingForm: true
      };
    }

    // Default friendly assistant response
    return {
      reply: `I would be thrilled to assist you with that! At **${salonName}**, we specialize in luxury hair design, balayage, signature facials, nail artistry, and bridal packages.\n\nYou can book an appointment, check our service catalog, or ask any question about styling and pricing!`,
      showBookingForm: true
    };
  }

  // Handle sending message (Tries backend API first; seamlessly falls back to client intelligence)
  function handleUserMessage(text, explicitLead) {
    if (!text || !text.trim() || isTyping) return;
    var userText = text.trim();

    // Add user message
    messages.push({
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    renderMessages();

    // Show typing
    isTyping = true;
    typingEl.style.display = 'flex';
    streamEl.scrollTop = streamEl.scrollHeight;

    function deliverReply(resObj) {
      isTyping = false;
      typingEl.style.display = 'none';

      messages.push({
        id: 'msg-' + Date.now(),
        sender: 'assistant',
        text: resObj.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bookingLead: resObj.bookingLead,
        showBookingForm: resObj.showBookingForm
      });

      renderMessages();
    }

    // Attempt remote backend API call if appOrigin is set and reachable
    if (appOrigin && appOrigin !== window.location.origin) {
      var controller = null;
      var timeoutId = null;

      try {
        if (window.AbortController) {
          controller = new AbortController();
          timeoutId = setTimeout(function () {
            controller.abort();
          }, 3500);
        }

        fetch(appOrigin + '/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-customer-id': customerId
          },
          body: JSON.stringify({
            message: userText,
            customerId: customerId,
            conversationHistory: messages.slice(-5)
          }),
          signal: controller ? controller.signal : undefined
        })
          .then(function (res) {
            if (timeoutId) clearTimeout(timeoutId);
            if (!res.ok) throw new Error('API status ' + res.status);
            return res.json();
          })
          .then(function (data) {
            deliverReply({
              reply: data.reply,
              bookingLead: data.bookingLead
            });
          })
          .catch(function () {
            // Fallback immediately to local salon intelligence
            var fallback = computeSalonReply(userText, explicitLead);
            deliverReply(fallback);
          });
        return;
      } catch (err) {
        // Ignored, proceed to fallback
      }
    }

    // Direct client response with realistic 500ms typing cadence
    setTimeout(function () {
      var result = computeSalonReply(userText, explicitLead);
      deliverReply(result);
    }, 450);
  }

  // 4. Widget State Controllers
  function openWidget() {
    isOpen = true;
    chatCard.classList.add('glow-open');
    launcherBtn.setAttribute('aria-expanded', 'true');
    inputEl.focus();
  }

  function closeWidget() {
    isOpen = false;
    chatCard.classList.remove('glow-open');
    launcherBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleWidget() {
    if (isOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  }

  // 5. Event Listeners
  launcherBtn.addEventListener('click', function (e) {
    e.preventDefault();
    toggleWidget();
  });

  btnClose.addEventListener('click', function (e) {
    e.preventDefault();
    closeWidget();
  });

  btnReset.addEventListener('click', function (e) {
    e.preventDefault();
    if (confirm('Reset conversation with Chloe?')) {
      messages = [INITIAL_GREETING];
      renderMessages();
    }
  });

  btnExpand.addEventListener('click', function (e) {
    e.preventDefault();
    isExpanded = !isExpanded;
    if (isExpanded) {
      chatCard.classList.add('glow-expanded');
      btnExpand.querySelector('.glow-expand-icon').innerHTML = '<path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M3 21l7-7"></path>';
    } else {
      chatCard.classList.remove('glow-expanded');
      btnExpand.querySelector('.glow-expand-icon').innerHTML = '<path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>';
    }
  });

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = inputEl.value;
    inputEl.value = '';
    handleUserMessage(val);
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      closeWidget();
    }
  });

  // 6. Mount to DOM
  function mount() {
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', mount);
      return;
    }
    document.body.appendChild(root);
    renderQuickChips();
    renderMessages();

    if (autoOpen) {
      setTimeout(openWidget, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // 7. Expose Public JavaScript API
  window.GlowSalonWidget = {
    open: openWidget,
    close: closeWidget,
    toggle: toggleWidget,
    isOpen: function () {
      return isOpen;
    },
    sendMessage: function (text) {
      openWidget();
      handleUserMessage(text);
    },
    version: '2.0.0-standalone',
    origin: appOrigin
  };
})();
