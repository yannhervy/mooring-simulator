import React, { useState } from 'react';

const SimulatorControls = ({
  txt,
  startLanguage,
  setLanguage,
  weatherMode,
  setWeatherMode,
  waterLevelCm,
  setWaterLevelCm,
  seabedDepthCm,
  setSeabedDepthCm,
  dockHeightCm,
  setDockHeightCm,
  isFloatingDock,
  setIsFloatingDock,
  isSunk,
  waveHeightCm,
  setWaveHeightCm,
  windSpeedMs,
  setWindSpeedMs,
  windDirection,
  setWindDirection,
  sternTotalLengthCm,
  setSternTotalLengthCm,
  sternChainPercent,
  setSternChainPercent,
  setSternChainLengthCm,
  setSternRopeLengthCm,
  chainThickness,
  setChainThickness,
  anchorPositionXCm,
  setAnchorPositionXCm,
  bowRopeLengthCm,
  setBowRopeLengthCm,
  boatLengthCm,
  setBoatLengthCm
}) => {
  const [isOpen, setIsOpen] = useState(window.innerWidth > 1400);

  return (
    <>
      {/* Toggle Button (Always visible) */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="absolute top-4 right-4 z-30 p-2 bg-slate-900/90 text-sky-400 rounded-lg border border-slate-700 shadow-xl hover:bg-slate-800 transition-colors"
        aria-label="Toggle Controls"
      >
        {isOpen ? (
          // X Icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger Icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Controls Panel */}
      <div className={`absolute top-16 right-4 bottom-4 z-20 bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-2xl w-80 overflow-y-auto scrollbar-hide text-left transition-transform duration-300 origin-top-right ${isOpen ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-4">
          <h3 className="font-bold text-[10px] uppercase tracking-widest text-sky-400 italic">{txt.title}</h3>
          <div className="flex gap-1">
            <button onClick={() => setLanguage('sv')} className={`text-[9px] px-1 rounded ${startLanguage === 'sv' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}>SV</button>
            <button onClick={() => setLanguage('en')} className={`text-[9px] px-1 rounded ${startLanguage === 'en' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}>EN</button>
          </div>
        </div>
        
        <div className="space-y-4 text-[11px]">
          <div>
            <label className="text-[9px] uppercase font-bold text-sky-300 mb-1 block">{txt.weatherLabel}</label>
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                {['OFF', 'NORMAL', 'EXTREME'].map((mode) => (
                <button key={mode} onClick={() => setWeatherMode(mode)} className={`flex-1 py-2 rounded text-[9px] font-bold transition ${weatherMode === mode ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>{txt.modes[mode]}</button>
                ))}
            </div>
          </div>
          
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-sky-400">{txt.waterLevel} <span className="font-mono">{waterLevelCm} cm</span></label>
              <div className="flex items-center gap-2">
                <button onClick={() => !isSunk && weatherMode === 'OFF' && setWaterLevelCm(Math.max(-300, waterLevelCm - 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-sky-400 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>-</button>
                <input type="range" min="-300" max="300" value={waterLevelCm} onChange={(e) => setWaterLevelCm(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunk || weatherMode !== 'OFF'} />
                <button onClick={() => !isSunk && weatherMode === 'OFF' && setWaterLevelCm(Math.min(300, waterLevelCm + 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-sky-400 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>+</button>
              </div>
            </div>
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.depth} <span className="font-mono">{seabedDepthCm} cm</span></label>
              <div className="flex items-center gap-2">
                <button onClick={() => !isSunk && setSeabedDepthCm(Math.max(0, seabedDepthCm - 10))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
                <input type="range" min="0" max="1200" value={seabedDepthCm} onChange={(e) => setSeabedDepthCm(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} />
                <button onClick={() => !isSunk && setSeabedDepthCm(Math.min(1200, seabedDepthCm + 10))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
              </div>
            </div>
            
            {/* Dock Height Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="uppercase font-bold text-amber-500">{txt.dockHeight} <span className="font-mono">{dockHeightCm} cm</span></label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="floatingDock" checked={isFloatingDock} onChange={(e) => setIsFloatingDock(e.target.checked)} className="w-3 h-3 accent-amber-500" disabled={isSunk} />
                  <label htmlFor="floatingDock" className="text-[9px] text-amber-300 font-bold uppercase cursor-pointer">{txt.floatingDock}</label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => !isSunk && !isFloatingDock && setDockHeightCm(Math.max(100, dockHeightCm - 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-amber-500 font-bold disabled:opacity-50" disabled={isSunk || isFloatingDock}>-</button>
                <input type="range" min="100" max="500" value={dockHeightCm} onChange={(e) => setDockHeightCm(parseInt(e.target.value))} className={`flex-1 h-1 rounded-lg appearance-none ${isFloatingDock ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-700 accent-amber-500'}`} disabled={isSunk || isFloatingDock} />
                <button onClick={() => !isSunk && !isFloatingDock && setDockHeightCm(Math.min(500, dockHeightCm + 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-amber-500 font-bold disabled:opacity-50" disabled={isSunk || isFloatingDock}>+</button>
              </div>
            </div>

            {/* Wave Height Slider */}
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-slate-400">{txt.waveHeight} <span className="font-mono">{waveHeightCm} cm</span></label>
              <div className="flex items-center gap-2">
                 <button onClick={() => !isSunk && weatherMode === 'OFF' && setWaveHeightCm(Math.max(0, waveHeightCm - 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-slate-400 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>-</button>
                 <input type="range" min="0" max="100" value={waveHeightCm} onChange={(e) => setWaveHeightCm(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunk || weatherMode !== 'OFF'} />
                 <button onClick={() => !isSunk && weatherMode === 'OFF' && setWaveHeightCm(Math.min(100, waveHeightCm + 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-slate-400 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>+</button>
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
            <label className="flex justify-between mb-2 uppercase font-bold text-sky-300">{txt.windSpeed} <span className="font-mono">{windSpeedMs} m/s</span></label>
            <div className="flex items-center gap-2">
              <button onClick={() => !isSunk && weatherMode === 'OFF' && setWindSpeedMs(Math.max(0, windSpeedMs - 1))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-sky-300 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>-</button>
              <input type="range" min="0" max="40" value={windSpeedMs} onChange={(e) => setWindSpeedMs(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-sky-400" disabled={isSunk || weatherMode !== 'OFF'} />
              <button onClick={() => !isSunk && weatherMode === 'OFF' && setWindSpeedMs(Math.min(40, windSpeedMs + 1))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-sky-300 font-bold disabled:opacity-50" disabled={isSunk || weatherMode !== 'OFF'}>+</button>
            </div>
            <div className="flex gap-2 mt-3 text-[9px] font-bold uppercase text-center">
              <button onClick={() => setWindDirection(-1)} className={`flex-1 py-1 rounded border transition ${windDirection === -1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunk || weatherMode !== 'OFF'}>{txt.fromDock}</button>
              <button onClick={() => setWindDirection(1)} className={`flex-1 py-1 rounded border transition ${windDirection === 1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunk || weatherMode !== 'OFF'}>{txt.fromSea}</button>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3 text-left">
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-blue-400">{txt.totalSternLength} <span className="font-mono">{sternTotalLengthCm} cm</span></label>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                     if(isSunk) return;
                     const val = Math.max(0, sternTotalLengthCm - 10);
                     setSternTotalLengthCm(val);
                     const chainLen = Math.round(val * (sternChainPercent / 100));
                     setSternChainLengthCm(chainLen);
                     setSternRopeLengthCm(val - chainLen);
                }} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-blue-400 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
                <input type="range" min="0" max="3000" value={sternTotalLengthCm} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSternTotalLengthCm(val);
                  const chainLen = Math.round(val * (sternChainPercent / 100));
                  setSternChainLengthCm(chainLen);
                  setSternRopeLengthCm(val - chainLen);
                }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-blue-600" disabled={isSunk} />
                <button onClick={() => {
                     if(isSunk) return;
                     const val = Math.min(3000, sternTotalLengthCm + 10);
                     setSternTotalLengthCm(val);
                     const chainLen = Math.round(val * (sternChainPercent / 100));
                     setSternChainLengthCm(chainLen);
                     setSternRopeLengthCm(val - chainLen);
                }} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-blue-400 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
              </div>
            </div>
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-slate-100">{txt.chainPercent} <span className="font-mono">{sternChainPercent}%</span></label>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                     if(isSunk) return;
                     const val = Math.max(0, sternChainPercent - 5);
                     setSternChainPercent(val);
                     const chainLen = Math.round(sternTotalLengthCm * (val / 100));
                     setSternChainLengthCm(chainLen);
                     setSternRopeLengthCm(sternTotalLengthCm - chainLen);
                }} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-slate-100 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
                <input type="range" min="0" max="100" value={sternChainPercent} onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSternChainPercent(val);
                  const chainLen = Math.round(sternTotalLengthCm * (val / 100));
                  setSternChainLengthCm(chainLen);
                  setSternRopeLengthCm(sternTotalLengthCm - chainLen);
                }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-slate-400" disabled={isSunk} />
                 <button onClick={() => {
                     if(isSunk) return;
                     const val = Math.min(100, sternChainPercent + 5);
                     setSternChainPercent(val);
                     const chainLen = Math.round(sternTotalLengthCm * (val / 100));
                     setSternChainLengthCm(chainLen);
                     setSternRopeLengthCm(sternTotalLengthCm - chainLen);
                }} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-slate-100 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5">
              <label className="flex justify-between mb-2 uppercase font-bold text-emerald-400">{txt.thickness} <span className="font-mono">{chainThickness} mm</span></label>
              <div className="flex items-center gap-2">
                 <button onClick={() => !isSunk && setChainThickness(Math.max(6, chainThickness - 1))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
                 <input type="range" min="6" max="16" step="1" value={chainThickness} onChange={(e) => setChainThickness(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} />
                 <button onClick={() => !isSunk && setChainThickness(Math.min(16, chainThickness + 1))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
              </div>
            </div>
            <div>
              <label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.anchorPos} <span className="font-mono">{anchorPositionXCm} cm</span></label>
              <div className="flex items-center gap-2">
                <button onClick={() => !isSunk && setAnchorPositionXCm(Math.max(0, anchorPositionXCm - 10))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
                <input type="range" min="0" max="2000" value={anchorPositionXCm} onChange={(e) => setAnchorPositionXCm(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} />
                <button onClick={() => !isSunk && setAnchorPositionXCm(Math.min(2000, anchorPositionXCm + 10))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-emerald-400 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-left">
            <label className="flex justify-between mb-1 uppercase font-bold text-amber-400">{txt.bowLine} <span className="font-mono">{bowRopeLengthCm} cm</span></label>
            <div className="flex items-center gap-2">
              <button onClick={() => !isSunk && setBowRopeLengthCm(Math.max(10, bowRopeLengthCm - 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-amber-400 font-bold disabled:opacity-50" disabled={isSunk}>-</button>
              <input type="range" min="10" max="200" value={bowRopeLengthCm} onChange={(e) => setBowRopeLengthCm(parseInt(e.target.value))} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none accent-amber-400" disabled={isSunk} />
              <button onClick={() => !isSunk && setBowRopeLengthCm(Math.min(200, bowRopeLengthCm + 5))} className="w-6 h-6 bg-slate-700 rounded hover:bg-slate-600 text-amber-400 font-bold disabled:opacity-50" disabled={isSunk}>+</button>
            </div>
          </div>


        </div>
      </div>
    </>
  );
};

export default SimulatorControls;
