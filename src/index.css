@import "tailwindcss";

@theme {
  --color-bg: #FCF4E9;
  --color-text: #957E6B;
  --color-primary: #AEC8DB;
  --color-primary-hover: #9ab4c7;
  --color-card: #ffffff;
  --color-border: rgba(149, 126, 107, 0.2);
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.card {
  background-color: var(--color-card);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(149, 126, 107, 0.08);
  border: 1px solid var(--color-border);
}

.btn-primary {
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  transition: all 0.2s ease;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-text);
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  transition: all 0.2s ease;
  font-weight: 500;
}

.btn-secondary:hover {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.input-field {
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-card);
  color: var(--color-text);
  transition: all 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(174, 200, 219, 0.3);
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Print Styles */
@media print {
  body {
    background-color: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  .receipt-container {
    width: 100%;
    padding: 0;
    display: block !important;
    overflow: visible !important;
  }
  .receipt-item {
    display: block !important;
    overflow: visible !important;
    page-break-after: always;
    break-after: page;
    page-break-inside: auto;
    break-inside: auto;
    margin-bottom: 0;
    box-shadow: none !important;
    border: none !important;
    padding: 10mm !important;
  }
  /* Allow table rows to break across pages if a single receipt is very long */
  .receipt-item table {
    page-break-inside: auto;
  }
  .receipt-item tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  /* Reset main padding and width for print */
  main, .min-h-screen, .max-w-6xl {
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
    max-width: none !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .card {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
}
