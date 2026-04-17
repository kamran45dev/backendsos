// Print cost calculation utilities

const DEFAULT_PRICING = {
  costPerPageBW: parseFloat(process.env.COST_PER_PAGE_BW) || 0.08,
  costPerPageColor: parseFloat(process.env.COST_PER_PAGE_COLOR) || 0.25,
  a3Multiplier: parseFloat(process.env.A3_MULTIPLIER) || 1.5
};

// Parse page range string (e.g., "1-3,5,7-10") into array of page numbers
export const parsePageRange = (rangeStr, totalPages) => {
  if (!rangeStr || rangeStr.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set();
  const parts = rangeStr.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = Math.max(1, start); i <= Math.min(end, totalPages); i++) {
          pages.add(i);
        }
      }
    } else {
      const page = Number(part);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
};

// Validate page range string
export const validatePageRange = (rangeStr, totalPages) => {
  if (!rangeStr || rangeStr.toLowerCase() === 'all') {
    return { valid: true, pages: totalPages };
  }

  const pages = parsePageRange(rangeStr, totalPages);
  
  if (pages.length === 0) {
    return { valid: false, error: 'Invalid page range' };
  }

  return { valid: true, pages: pages.length };
};

// Calculate print cost
export const calculatePrintCost = (options) => {
  const {
    pageCount,
    color = 'bw',
    paperSize = 'A4',
    layout = 'full'
  } = options;

  const pricing = DEFAULT_PRICING;
  
  // Base cost per page
  let costPerPage = color === 'color' 
    ? pricing.costPerPageColor 
    : pricing.costPerPageBW;
  
  // Apply paper size multiplier
  if (paperSize === 'A3') {
    costPerPage *= pricing.a3Multiplier;
  }
  
  // Note: Layout does NOT reduce cost per page (as per requirements)
  // The layout is for visual organization only
  
  const totalCost = pageCount * costPerPage;
  
  return {
    pageCount,
    costPerPage: Math.round(costPerPage * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown: {
      baseRate: color === 'color' ? pricing.costPerPageColor : pricing.costPerPageBW,
      paperSizeMultiplier: paperSize === 'A3' ? pricing.a3Multiplier : 1,
      layoutNote: 'Layout does not affect cost'
    }
  };
};

// Get layout grid configuration
export const getLayoutConfig = (layout) => {
  const configs = {
    full: { cols: 1, rows: 1, name: 'Full Page' },
    '1': { cols: 1, rows: 1, name: '1 Slide per Page' },
    '2': { cols: 2, rows: 1, name: '2 Slides Horizontal' },
    '3': { cols: 3, rows: 1, name: '3 Slides Horizontal' },
    '4h': { cols: 2, rows: 2, name: '4 Slides Horizontal' },
    '6h': { cols: 3, rows: 2, name: '6 Slides Horizontal' },
    '9h': { cols: 3, rows: 3, name: '9 Slides Horizontal' },
    '4v': { cols: 2, rows: 2, name: '4 Slides Vertical' },
    '6v': { cols: 2, rows: 3, name: '6 Slides Vertical' },
    '9v': { cols: 3, rows: 3, name: '9 Slides Vertical' }
  };
  
  return configs[layout] || configs.full;
};

// Format currency
export const formatCurrency = (amount) => {
  return `$${amount.toFixed(2)}`;
};
