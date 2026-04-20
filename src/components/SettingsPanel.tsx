import React from 'react';

interface SettingsProps {
  aspectRatio: string;
  setAspectRatio: (val: any) => void;
  resolution: string;
  setResolution: (val: any) => void;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
}

export const SettingsPanel: React.FC<SettingsProps> = ({
  aspectRatio, setAspectRatio,
  resolution, setResolution,
  customPrompt, setCustomPrompt
}) => {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-2xl shadow-zinc-200/20 flex flex-col gap-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-zinc-900 font-display uppercase tracking-[0.2em]">
              画布比例 (Ratio)
            </label>
            <span className="text-[10px] text-zinc-300 font-mono">01</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {['1:1', '3:4', '9:16', '16:9'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`py-3 px-1 rounded-xl text-[10px] font-black transition-all duration-300 border ${
                  aspectRatio === ratio
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/20 transform scale-105'
                    : 'bg-zinc-50 border-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-zinc-900 font-display uppercase tracking-[0.2em]">
              渲染画质 (Quality)
            </label>
            <span className="text-[10px] text-zinc-300 font-mono">02</span>
          </div>
          <div className="flex gap-3">
            {['1K', '2K', '4K'].map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all duration-300 border ${
                  resolution === res
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/20 transform scale-105'
                    : 'bg-zinc-50 border-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-zinc-900 font-display uppercase tracking-[0.2em]">
            AI 创意引导 (Prompt)
          </label>
          <span className="text-[10px] text-zinc-300 font-mono">Optional</span>
        </div>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="例如：高级灰调、极简主义、大理石地面..."
          className="w-full h-32 p-5 rounded-2xl border border-zinc-100 focus:border-zinc-900 bg-zinc-50/50 focus:bg-white transition-all resize-none text-xs placeholder:text-zinc-300 font-bold leading-relaxed"
        />
      </div>
    </div>
  );
};
