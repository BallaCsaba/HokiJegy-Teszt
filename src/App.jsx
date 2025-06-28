import React from 'react';
import MapContainer from './VectorShapes';
import { useSectorModal } from './hooks/useSectorModal';
import SectorModal from './components/SectorModal';

function App() {
  // Use the modal state at the root level
  const {
    modalOpen,
    selectedSector,
    handleSectorClick: openSectorModal,
    closeModal,
  } = useSectorModal();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-400 flex flex-col items-center justify-center">
      <main className="flex-1 w-full flex flex-col items-center justify-center">
        <div className="container-custom w-full flex flex-col items-center justify-center">
          <MapContainer
            modalOpen={modalOpen}
            selectedSector={selectedSector}
            openSectorModal={openSectorModal}
            closeModal={closeModal}
          />
        </div>
      </main>
      <SectorModal open={modalOpen} sector={selectedSector} onClose={closeModal} modalOpen={modalOpen} />
    </div>
  );
}

export default App;
