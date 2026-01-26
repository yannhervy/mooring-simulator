import React from 'react';

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
  return (
    <div className="absolute top-6 right-6 z-20 bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-2xl w-80 max-h-[95vh] overflow-y-auto scrollbar-hide text-left">
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
          <div><label className="flex justify-between mb-1 uppercase font-bold text-sky-400">{txt.waterLevel} <span className="font-mono">{waterLevelCm} cm</span></label>
          <input type="range" min="-300" max="300" value={waterLevelCm} onChange={(e) => setWaterLevelCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunk || weatherMode !== 'OFF'} /></div>
          <div><label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.depth} <span className="font-mono">{seabedDepthCm} cm</span></label>
          <input type="range" min="0" max="1200" value={seabedDepthCm} onChange={(e) => setSeabedDepthCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} /></div>
          
          {/* Dock Height Slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="uppercase font-bold text-amber-500">{txt.dockHeight} <span className="font-mono">{dockHeightCm} cm</span></label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="floatingDock" checked={isFloatingDock} onChange={(e) => setIsFloatingDock(e.target.checked)} className="w-3 h-3 accent-amber-500" disabled={isSunk} />
                <label htmlFor="floatingDock" className="text-[9px] text-amber-300 font-bold uppercase cursor-pointer">{txt.floatingDock}</label>
              </div>
            </div>
            <input type="range" min="100" max="500" value={dockHeightCm} onChange={(e) => setDockHeightCm(parseInt(e.target.value))} className={`w-full h-1 rounded-lg appearance-none ${isFloatingDock ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-700 accent-amber-500'}`} disabled={isSunk || isFloatingDock} />
          </div>

          {/* Wave Height Slider */}
          <div><label className="flex justify-between mb-1 uppercase font-bold text-slate-400">{txt.waveHeight} <span className="font-mono">{waveHeightCm} cm</span></label>
          <input type="range" min="0" max="100" value={waveHeightCm} onChange={(e) => setWaveHeightCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-500" disabled={isSunk || weatherMode !== 'OFF'} /></div>
        </div>

        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
          <label className="flex justify-between mb-2 uppercase font-bold text-sky-300">{txt.windSpeed} <span className="font-mono">{windSpeedMs} m/s</span></label>
          <input type="range" min="0" max="40" value={windSpeedMs} onChange={(e) => setWindSpeedMs(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-sky-400" disabled={isSunk || weatherMode !== 'OFF'} />
          <div className="flex gap-2 mt-3 text-[9px] font-bold uppercase text-center">
            <button onClick={() => setWindDirection(-1)} className={`flex-1 py-1 rounded border transition ${windDirection === -1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunk || weatherMode !== 'OFF'}>{txt.fromDock}</button>
            <button onClick={() => setWindDirection(1)} className={`flex-1 py-1 rounded border transition ${windDirection === 1 ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} disabled={isSunk || weatherMode !== 'OFF'}>{txt.fromSea}</button>
          </div>
        </div>

        <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3 text-left">
          <div>
            <label className="flex justify-between mb-1 uppercase font-bold text-blue-400">{txt.totalSternLength} <span className="font-mono">{sternTotalLengthCm} cm</span></label>
            <input type="range" min="0" max="3000" value={sternTotalLengthCm} onChange={(e) => {
              const val = parseInt(e.target.value);
              setSternTotalLengthCm(val);
              const chainLen = Math.round(val * (sternChainPercent / 100));
              setSternChainLengthCm(chainLen);
              setSternRopeLengthCm(val - chainLen);
            }} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-blue-600" disabled={isSunk} />
          </div>
          <div>
            <label className="flex justify-between mb-1 uppercase font-bold text-slate-100">{txt.chainPercent} <span className="font-mono">{sternChainPercent}%</span></label>
            <input type="range" min="0" max="100" value={sternChainPercent} onChange={(e) => {
              const val = parseInt(e.target.value);
              setSternChainPercent(val);
              const chainLen = Math.round(sternTotalLengthCm * (val / 100));
              setSternChainLengthCm(chainLen);
              setSternRopeLengthCm(sternTotalLengthCm - chainLen);
            }} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-slate-400" disabled={isSunk} />
          </div>
          <div className="pt-2 border-t border-white/5"><label className="flex justify-between mb-2 uppercase font-bold text-emerald-400">{txt.thickness} <span className="font-mono">{chainThickness} mm</span></label>
          <input type="range" min="6" max="16" step="1" value={chainThickness} onChange={(e) => setChainThickness(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} /></div>
          <div><label className="flex justify-between mb-1 uppercase font-bold text-emerald-400">{txt.anchorPos} <span className="font-mono">{anchorPositionXCm} cm</span></label>
          <input type="range" min="0" max="2000" value={anchorPositionXCm} onChange={(e) => setAnchorPositionXCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-emerald-500" disabled={isSunk} /></div>
        </div>

        <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-left">
          <label className="flex justify-between mb-1 uppercase font-bold text-amber-400">{txt.bowLine} <span className="font-mono">{bowRopeLengthCm} cm</span></label>
          <input type="range" min="10" max="200" value={bowRopeLengthCm} onChange={(e) => setBowRopeLengthCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-amber-400" disabled={isSunk} />
        </div>

        {/* New Boat Length Slider */}
        <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-left">
          <label className="flex justify-between mb-1 uppercase font-bold text-purple-400">{txt.boatLength} <span className="font-mono">{boatLengthCm} cm</span></label>
          <input type="range" min="300" max="670" value={boatLengthCm} onChange={(e) => setBoatLengthCm(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-purple-400" disabled={isSunk} />
        </div>
      </div>
    </div>
  );
};

export default SimulatorControls;
