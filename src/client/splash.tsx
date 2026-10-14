import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[380px] p-6 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white selection:bg-[#ff4500]">
      <div className="relative w-full max-w-sm rounded-3xl p-6 bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
        {/* Glow accent */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 bg-gradient-to-b from-orange-500/20 to-transparent blur-2xl pointer-events-none" />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff4500] to-[#ff8700] p-0.5 shadow-lg shadow-orange-500/25 mb-4 flex items-center justify-center">
          <div className="w-full h-full rounded-[14px] bg-slate-950/60 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        {/* Title & Tagline */}
        <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded-full border border-orange-800/40 mb-2">
          Community Gallery
        </span>
        <h1 className="text-xl font-bold text-white tracking-tight mb-1.5">
          r/{context.subredditName ?? 'Community'} Photos
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mb-6">
          Browse community image posts in an iOS-style gallery by timeline, global places, and science topics.
        </p>

        {/* CTA Button */}
        <button
          type="button"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#ff4500] to-[#ff6a00] hover:from-[#ff5722] hover:to-[#ff7a1a] text-white font-semibold text-sm shadow-lg shadow-orange-500/25 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Open Full Gallery</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        <p className="text-[10px] text-slate-500 mt-4">
          Reddit-native • Auto-syncs image posts
        </p>
      </div>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Splash />
    </StrictMode>
  );
}
