// Pricing configuration
const PRICING = {
  A4: {
    bw: 0.08,
    color: 0.50
  },
  A3: {
    bw: 0.40,
    color: 1.20
  },
  Letter: {
    bw: 0.08,
    color: 0.50
  },
  Legal: {
    bw: 0.10,
    color: 0.60
  }
};

// Base rates for layouts (multiplier for slides per page)
const LAYOUT_MULTIPLIERS = {
  full: 1,
  '1': 1,
  '2': 0.5,
  '3': 0.34,
  '4h': 0.25,
  '6h': 0.17,
  '9h': 0.12,
  '4v': 0.25,
  '6v': 0.17,
  '9v': 0.12
};

export const calculatePrintCost = ({ pageCount, color, paperSize, layout }) => {
  const pricePerPage = PRICING[paperSize][color];
  const layoutMultiplier = LAYOUT_MULTIPLIERS[layout] || 1;
  
  const adjustedPageCount = Math.ceil(pageCount * layoutMultiplier);
  const totalCost = adjustedPageCount * pricePerPage;
  
  return {
    pageCount: adjustedPageCount,
    costPerPage: pricePerPage,
    totalCost,
    breakdown: {
      baseRate: pricePerPage,
      paperSizeMultiplier: 1,
      layoutNote: layout === 'full' ? 'Single page per sheet' : `${Math.round(1 / layoutMultiplier)} slides per page`
    }
  };
};

export const parsePageRange = (range, totalPages) => {
  if (range === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  const pages = [];
  const parts = range.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      const endPage = end || totalPages;
      for (let i = start; i <= endPage; i++) {
        if (i >= 1 && i <= totalPages) {
          pages.push(i);
        }
      }
    } else {
      const page = Number(trimmed);
      if (page >= 1 && page <= totalPages) {
        pages.push(page);
      }
    }
  }
  
  return [...new Set(pages)].sort((a, b) => a - b);
};

export const validatePageRange = (range, totalPages) => {
  if (range === 'all') {
    return { valid: true, pages: totalPages };
  }
  
  try {
    const pages = parsePageRange(range, totalPages);
    if (pages.length === 0) {
      return { valid: false, error: 'No valid pages specified', pages: 0 };
    }
    return { valid: true, pages: pages.length };
  } catch (error) {
    return { valid: false, error: 'Invalid page range format', pages: 0 };
  }
};

export const getLayoutConfig = (layout) => {
  const configs = {
    full: { cols: 1, rows: 1, label: 'Full Page' },
    '1': { cols: 1, rows: 1, label: '1 Slide' },
    '2': { cols: 2, rows: 1, label: '2 Slides' },
    '3': { cols: 3, rows: 1, label: '3 Slides' },
    '4h': { cols: 2, rows: 2, label: '4 Slides (Horizontal)' },
    '6h': { cols: 3, rows: 2, label: '6 Slides (Horizontal)' },
    '9h': { cols: 3, rows: 3, label: '9 Slides (Horizontal)' },
    '4v': { cols: 2, rows: 2, label: '4 Slides (Vertical)' },
    '6v': { cols: 2, rows: 3, label: '6 Slides (Vertical)' },
    '9v': { cols: 3, rows: 3, label: '9 Slides (Vertical)' }
  };
  return configs[layout] || configs.full;
};