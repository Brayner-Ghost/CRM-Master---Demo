import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

const Pagination = ({
  currentPage,
  totalItems,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage
}) => {
  const { t } = useTheme();

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * (itemsPerPage === 'all' ? totalItems : itemsPerPage);
  const endIndex = itemsPerPage === 'all' ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  if (totalPages <= 1 && totalItems <= 25) return null;

  return (
    <div style={{
      padding: '1.25rem 2rem',
      borderTop: t.border,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: t.bg,
      flexWrap: 'wrap',
      gap: '1.5rem',
      borderRadius: `0 0 ${t.radiusMedium} ${t.radiusMedium}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.85rem',
          color: t.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          Mostrando
          <span style={{ color: t.text, fontWeight: 600 }}>
            {totalItems > 0 ? startIndex + 1 : 0} - {endIndex}
          </span>
          de
          <span style={{ color: t.text, fontWeight: 600 }}>{totalItems}</span>
          itens
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Itens por página:
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setItemsPerPage(val === 'all' ? 'all' : Number(val));
                setCurrentPage(1);
              }}
              style={{
                appearance: 'none',
                backgroundColor: t.bgSecondary,
                border: t.border,
                borderRadius: '10px',
                padding: '6px 32px 6px 12px',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: t.text,
                cursor: 'pointer',
                outline: 'none',
                transition: t.transition
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value="all">Tudo</option>
            </select>
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: t.textSecondary }}>
              <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
            </div>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              border: t.border,
              backgroundColor: t.bg,
              color: currentPage === 1 ? t.textSecondary : t.text,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
              transition: t.transition
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {getPageNumbers().map((p, i) => (
              p === '...' ? (
                <div key={`dots-${i}`} style={{ padding: '0 0.5rem', color: t.textSecondary }}>
                  <MoreHorizontal size={16} />
                </div>
              ) : (
                <motion.button
                  key={p}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    minWidth: '36px',
                    height: '36px',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    border: currentPage === p ? 'none' : t.border,
                    backgroundColor: currentPage === p ? t.accent : t.bg,
                    color: currentPage === p ? t.accentContrast : t.text,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: t.transition,
                    boxShadow: currentPage === p ? `0 4px 12px ${t.accent}44` : 'none'
                  }}
                >
                  {p}
                </motion.button>
              )
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              border: t.border,
              backgroundColor: t.bg,
              color: currentPage === totalPages ? t.textSecondary : t.text,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
              transition: t.transition
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
