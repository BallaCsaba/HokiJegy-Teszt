import { useState } from 'react';

export function useSectorModal() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState(null);

  function handleSectorClick(sector) {
    setSelectedSector(sector);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedSector(null);
  }

  return {
    modalOpen,
    selectedSector,
    handleSectorClick,
    closeModal,
  };
}